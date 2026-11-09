import { useState } from 'react'
import { BookOpen, Pencil, Plus, ScrollText, Trash2 } from 'lucide-react'
import useSWR from 'swr'
import { api, buscar, mensagem } from '@/lib/cliente'
import { LIMITE_NOTAS_MONSTRO } from '@/lib/regras'
import type { MonstroDaBiblioteca } from '@/lib/tipos'
import { sendRoomCommand } from '@mesa/features/rooms/room-commands'
import { useUiStore } from '@mesa/stores/ui-store'

export const URL_BIBLIOTECA = '/api/biblioteca'

/* Modelos de token do mestre. Cada clique em Colocar cria uma cópia nova, com vida e mana cheias, no centro da tela. */
export function BibliotecaMonstros() {
  const [aberta, setAberta] = useState(false)
  const { data, error, mutate } = useSWR<{ monstros: MonstroDaBiblioteca[] }>(aberta ? URL_BIBLIOTECA : null, buscar)
  /* Uma ficha aberta por vez: a lista é estreita e o texto precisa de espaço. */
  const [fichaAberta, setFichaAberta] = useState<{ id: string; notas: string } | null>(null)
  const [salvando, setSalvando] = useState(false)

  function colocar(monstro: MonstroDaBiblioteca) {
    const { camera } = useUiStore.getState()
    sendRoomCommand({
      type: 'biblioteca:colocar', monstroId: monstro.id,
      x: (window.innerWidth / 2 - camera.x) / camera.zoom,
      y: (window.innerHeight / 2 - camera.y) / camera.zoom,
    })
  }

  async function renomear(monstro: MonstroDaBiblioteca) {
    const nome = window.prompt('Novo nome do monstro:', monstro.nome)?.trim()
    if (!nome || nome === monstro.nome) return
    try { await api('PATCH', `${URL_BIBLIOTECA}/${monstro.id}`, { nome }); await mutate() }
    catch (e) { window.alert(mensagem(e)) }
  }

  async function salvarNotas() {
    if (!fichaAberta) return
    setSalvando(true)
    try { await api('PATCH', `${URL_BIBLIOTECA}/${fichaAberta.id}`, { notas: fichaAberta.notas }); await mutate(); setFichaAberta(null) }
    catch (e) { window.alert(mensagem(e)) }
    finally { setSalvando(false) }
  }

  async function apagar(monstro: MonstroDaBiblioteca) {
    if (!window.confirm(`Apagar ${monstro.nome} da biblioteca? Os tokens já colocados na mesa continuam.`)) return
    try { await api('DELETE', `${URL_BIBLIOTECA}/${monstro.id}`); await mutate() }
    catch (e) { window.alert(mensagem(e)) }
  }

  return (
    <details className="biblioteca" open={aberta} onToggle={(evento) => setAberta(evento.currentTarget.open)}>
      <summary><BookOpen size={15} /> Biblioteca de monstros</summary>
      {error && <p className="biblioteca-nota">{mensagem(error)}</p>}
      {!error && !data && aberta && <p className="biblioteca-nota">Abrindo a biblioteca…</p>}
      {data && data.monstros.length === 0 && (
        <p className="biblioteca-nota">Vazia. Monte um token com nome, tamanho, vida e imagens, e use Salvar na biblioteca no painel dele.</p>
      )}
      {data && data.monstros.length > 0 && (
        <ul className="biblioteca-lista">
          {data.monstros.map((monstro) => (
            <li key={monstro.id} className={monstro.dados.notas ? 'tem-notas' : undefined}>
              <span className="biblioteca-miniatura" style={{ backgroundColor: monstro.dados.cor }}>
                {monstro.temImagem
                  /* eslint-disable-next-line @next/next/no-img-element -- imagem da própria API, com cache; o otimizador do Next não ajuda aqui */
                  ? <img src={`${URL_BIBLIOTECA}/${monstro.id}/imagem?v=${monstro.v}`} alt="" loading="lazy" />
                  : monstro.nome.slice(0, 1).toUpperCase()}
              </span>
              <span className="biblioteca-nome">
                <b>{monstro.nome}</b>
                <small>
                  {monstro.dados.vidaMax !== undefined ? `${monstro.dados.vidaMax} de vida` : 'sem vida'}
                  {monstro.dados.manaMax !== undefined ? ` · ${monstro.dados.manaMax} de mana` : ''}
                </small>
              </span>
              <button type="button" className="biblioteca-colocar" aria-label={`Colocar ${monstro.nome} na mesa`} title="Colocar no centro da tela" onClick={() => colocar(monstro)}>
                <Plus size={15} />
              </button>
              <button
                type="button" aria-label={`Ficha de ${monstro.nome}`} title={monstro.dados.notas ? 'Ver a ficha' : 'Escrever a ficha'}
                aria-expanded={fichaAberta?.id === monstro.id}
                className={monstro.dados.notas ? 'biblioteca-com-ficha' : undefined}
                onClick={() => setFichaAberta(fichaAberta?.id === monstro.id ? null : { id: monstro.id, notas: monstro.dados.notas ?? '' })}
              >
                <ScrollText size={14} />
              </button>
              <button type="button" aria-label={`Renomear ${monstro.nome}`} title="Renomear" onClick={() => void renomear(monstro)}>
                <Pencil size={14} />
              </button>
              <button type="button" aria-label={`Apagar ${monstro.nome} da biblioteca`} title="Apagar da biblioteca" onClick={() => void apagar(monstro)}>
                <Trash2 size={14} />
              </button>
              {fichaAberta?.id === monstro.id && (
                <div className="biblioteca-ficha">
                  <textarea
                    aria-label={`Ficha de ${monstro.nome}`} rows={6} maxLength={LIMITE_NOTAS_MONSTRO} autoFocus
                    placeholder="Ataques, resistências, fraquezas, comportamento… Só você vê estas notas."
                    value={fichaAberta.notas}
                    onChange={(evento) => setFichaAberta({ id: monstro.id, notas: evento.target.value })}
                  />
                  <div>
                    <button type="button" onClick={() => setFichaAberta(null)}>Cancelar</button>
                    <button type="button" className="biblioteca-colocar" disabled={salvando} onClick={() => void salvarNotas()}>{salvando ? 'Salvando…' : 'Salvar ficha'}</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
