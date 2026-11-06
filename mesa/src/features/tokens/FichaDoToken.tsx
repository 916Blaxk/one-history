import { useMemo, useState } from 'react'
import { ExternalLink, Search } from 'lucide-react'
import useSWR from 'swr'
import { api, buscar, mensagem, urlFoto } from '@/lib/cliente'
import type { AcaoRolagem, ResumoDaFicha } from '@/lib/resumoFicha'
import type { DetalheCampanha } from '@/lib/tipos'
import { postSheetRoll } from '@mesa/features/chat/post-roll'
import { useRoomStore } from '@mesa/features/rooms/room-store'
import { useTokenStore } from '@mesa/features/tokens/token-store'
import type { Token } from '@mesa/features/tokens/token-types'

/* A lista vem da campanha: mostra só as fichas que a pessoa pode usar, as dela e, para o mestre, todas. */
export function FichaDoToken({ token, campanhaId }: { token: Token; campanhaId: string }) {
  return (
    <section className="mini-sheet" aria-label="Ficha do personagem">
      <span className="token-sprites-title">Ficha</span>
      {token.characterId ? (
        <FichaVinculada key={token.characterId} token={token} fichaId={token.characterId} />
      ) : (
        <EscolherFicha tokenId={token.id} campanhaId={campanhaId} />
      )}
    </section>
  )
}

function EscolherFicha({ tokenId, campanhaId }: { tokenId: string; campanhaId: string }) {
  const { data, error } = useSWR<DetalheCampanha>(`/api/campanhas/${campanhaId}`, buscar)
  const [escolhida, setEscolhida] = useState('')
  if (error) return <p className="mini-sheet-error">{mensagem(error)}</p>
  if (!data) return <p className="mini-sheet-note">Abrindo as fichas…</p>
  const fichas = data.fichas.filter((f) => f.completo)
  if (!fichas.length)
    return <p className="mini-sheet-note">Nenhuma ficha sua nesta campanha. Adicione uma na página da campanha.</p>
  const fichaId = escolhida || fichas[0].id
  return (
    <div className="mini-sheet-form">
      <label className="token-field">
        Usar a ficha
        <select value={fichaId} onChange={(event) => setEscolhida(event.target.value)}>
          {fichas.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome || 'Sem nome'}
              {data.papel === 'mestre' ? ` · ${f.donoNome}` : ''}
            </option>
          ))}
        </select>
      </label>
      <button
        className="token-image-button"
        type="button"
        onClick={() => useTokenStore.getState().updateToken(tokenId, { characterId: fichaId })}
      >
        Vincular ficha
      </button>
    </div>
  )
}

function FichaVinculada({ token, fichaId }: { token: Token; fichaId: string }) {
  const { data, error, mutate } = useSWR<ResumoDaFicha>(`/api/fichas/${fichaId}/resumo`, buscar, { shouldRetryOnError: false })
  const [busca, setBusca] = useState('')
  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const mapa = new Map<string, AcaoRolagem[]>()
    for (const acao of data?.acoes ?? []) {
      if (termo && !acao.rotulo.toLowerCase().includes(termo)) continue
      mapa.set(acao.categoria, [...(mapa.get(acao.categoria) ?? []), acao])
    }
    return [...mapa]
  }, [data, busca])
  const desvincular = () => useTokenStore.getState().updateToken(token.id, { characterId: undefined })
  const avisar = (texto: string) => {
    useRoomStore.getState().setNotice(texto)
    window.setTimeout(() => useRoomStore.getState().setNotice(null), 3500)
  }
  const url = `/api/fichas/${fichaId}`
  const mestre = useRoomStore((state) => state.role) === 'gm'
  /* A mana e a cena mudam pela mesma rota da página da ficha: as regras e os avisos continuam em um lugar só. */
  async function agir(acao: () => Promise<unknown>) {
    try {
      await acao()
      await mutate()
    } catch (erro) {
      avisar(mensagem(erro))
    }
  }
  function conjurar(magia: { nome: string; custo: number; dano: string }) {
    const mana = data?.recursos.find((recurso) => recurso.id === 'mana')?.atual ?? 0
    const nome = magia.nome || 'Magia sem nome'
    if (magia.custo > mana) {
      avisar(`Mana insuficiente: ${nome} custa ${magia.custo}, e a ficha tem ${mana}.`)
      return
    }
    void agir(async () => {
      await api('PATCH', url, { manaAtual: mana - magia.custo })
      if (magia.dano) avisar(`${nome}: dano ${magia.dano}`)
    })
  }
  function encerrarCena() {
    if (!window.confirm(`Encerrar a cena com ${data?.fadiga ?? 0}% de fadiga? A perda de mana, se houver, é permanente.`)) return
    void agir(async () => {
      const resposta = await api<{ mensagem: string }>('POST', `${url}/encerrar-cena`)
      avisar(resposta.mensagem)
    })
  }

  /* Colega da mesa: o token aparece no mapa, mas a ficha continua privada. */
  if (error) {
    return (
      <div className="mini-sheet-body">
        <p className="mini-sheet-note">Só o mestre e o dono veem esta ficha.</p>
        <button className="mini-sheet-text-button" type="button" onClick={desvincular}>Desvincular</button>
      </div>
    )
  }
  if (!data) return <p className="mini-sheet-note" role="status">Abrindo a ficha…</p>
  return (
    <div className="mini-sheet-body">
      <div className="mini-sheet-head">
        {data.fotoV > 0 && (
          <img className="mini-sheet-portrait" src={urlFoto(fichaId, data.fotoV)} alt={`Retrato de ${data.nome}`} />
        )}
        <div className="mini-sheet-identity">
          <strong>{data.nome}</strong>
          {data.recursos.map((recurso) => (
            <span key={recurso.id}>
              {recurso.rotulo}: <b>{recurso.atual}</b> / {recurso.max}
            </span>
          ))}
        </div>
      </div>
      <a className="token-image-button" href={`/fichas/${fichaId}`} target="_blank" rel="noreferrer">
        <ExternalLink size={15} /> Abrir ficha completa
      </a>
      <label className="mini-sheet-search">
        <Search size={14} />
        <span className="visually-hidden">Buscar rolagem</span>
        <input type="search" placeholder="Buscar rolagem" value={busca} onChange={(event) => setBusca(event.target.value)} />
      </label>
      {grupos.map(([categoria, acoes]) => (
        <details className="mini-sheet-group" key={categoria} open={Boolean(busca)}>
          <summary>{categoria}</summary>
          <ul>
            {acoes.map((acao) => (
              <li key={acao.id}>
                <button
                  type="button"
                  aria-label={`Rolar ${acao.rotulo}: ${acao.expressao}`}
                  onClick={() => postSheetRoll(fichaId, acao.id)}
                >
                  <span>{acao.rotulo}</span>
                  <b>{acao.expressao}</b>
                </button>
              </li>
            ))}
          </ul>
        </details>
      ))}
      {busca && grupos.length === 0 && <p className="mini-sheet-note">Nenhuma rolagem com esse nome.</p>}
      {data.magias.length > 0 && (
        <details className="mini-sheet-group">
          <summary>Magias</summary>
          <ul>
            {data.magias.map((magia) => (
              <li className="mini-sheet-spell" key={magia.id}>
                <span>{magia.nome || 'Magia sem nome'}</span>
                <b>{magia.custo} de mana{magia.dano ? ` · dano ${magia.dano}` : ''}</b>
                <button type="button" className="mini-sheet-text-button" aria-label={`Conjurar ${magia.nome || 'magia sem nome'}`} onClick={() => conjurar(magia)}>Conjurar</button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="mini-sheet-cena">
        {mestre ? (
          <label className="token-field">
            Fadiga mental (%)
            <input
              key={data.fadiga}
              type="number"
              min="0"
              max="100"
              defaultValue={data.fadiga}
              onBlur={(event) => { if (Number(event.target.value) !== data.fadiga) void agir(() => api('PATCH', url, { fadiga: Number(event.target.value) })) }}
              onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
            />
          </label>
        ) : (
          <p className="mini-sheet-note">Fadiga mental: <b>{data.fadiga}%</b>. Só o mestre muda.</p>
        )}
        <button className="token-image-button" type="button" onClick={encerrarCena}>Encerrar cena</button>
      </div>
      <button className="mini-sheet-text-button" type="button" onClick={desvincular}>Desvincular ficha</button>
    </div>
  )
}
