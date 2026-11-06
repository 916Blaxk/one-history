import { useTokenStore } from '@mesa/features/tokens/token-store'
import { useRoomStore } from '@mesa/features/rooms/room-store'
import { sendRoomCommand } from '@mesa/features/rooms/room-commands'
import { ordenarCombate } from '@mesa/shared/combate'
import { useUiStore } from '@mesa/stores/ui-store'

/* A ordem de turnos. O servidor decide o que cada pessoa vê e pode fazer: aqui só se escondem os botões sem uso. */
export function PainelCombate() {
  const combate = useUiStore((state) => state.combate)
  const tokens = useTokenStore((state) => state.tokens)
  const selecionadoId = useTokenStore((state) => state.selectedTokenId)
  const role = useRoomStore((state) => state.role)
  const playerKey = useRoomStore((state) => state.playerKey)
  const mestre = role === 'gm'
  const podeMexer = (tokenId: string) => {
    const token = tokens.find((item) => item.id === tokenId)
    return mestre || Boolean(token && role === 'player' && playerKey && token.ownerIds.includes(playerKey))
  }

  if (!combate) {
    if (!mestre) return null
    return (
      <div className="combate">
        <button type="button" className="combate-acao" onClick={() => sendRoomCommand({ type: 'combate:iniciar' })}>Iniciar combate</button>
      </div>
    )
  }

  const selecionadoFora = selecionadoId && !combate.lista.some((item) => item.tokenId === selecionadoId) && podeMexer(selecionadoId)
  return (
    <section className="combate" aria-label="Ordem de combate">
      <div className="combate-topo">
        <span>Combate</span>
        <b>Rodada {combate.rodada}</b>
      </div>
      <ol className="combate-lista">
        {ordenarCombate(combate.lista).map((item) => {
          const nome = tokens.find((token) => token.id === item.tokenId)?.name ?? 'Token'
          return (
            <li key={item.tokenId} className={combate.vez === item.tokenId ? 'is-turn' : ''} aria-current={combate.vez === item.tokenId ? 'true' : undefined}>
              <span className="combate-nome">{nome}</span>
              {mestre ? (
                <input
                  key={item.iniciativa ?? 'vazio'}
                  type="number"
                  aria-label={`Iniciativa de ${nome}`}
                  defaultValue={item.iniciativa ?? ''}
                  onBlur={(event) => {
                    const valor = Number(event.target.value)
                    if (event.target.value !== '' && Number.isInteger(valor) && valor !== item.iniciativa) sendRoomCommand({ type: 'combate:iniciativa', tokenId: item.tokenId, valor })
                  }}
                />
              ) : (
                <b>{item.iniciativa ?? '—'}</b>
              )}
              {podeMexer(item.tokenId) && (
                <>
                  <button type="button" aria-label={`Rolar iniciativa de ${nome}`} onClick={() => sendRoomCommand({ type: 'combate:rolar', tokenId: item.tokenId })}>d20</button>
                  <button type="button" aria-label={`Tirar ${nome} do combate`} onClick={() => sendRoomCommand({ type: 'combate:sair', tokenId: item.tokenId })}>×</button>
                </>
              )}
            </li>
          )
        })}
      </ol>
      {selecionadoFora && (
        <button type="button" className="combate-acao" onClick={() => sendRoomCommand({ type: 'combate:entrar', tokenId: selecionadoId })}>Adicionar token selecionado</button>
      )}
      {mestre ? (
        <div className="combate-botoes">
          <button type="button" onClick={() => sendRoomCommand({ type: 'combate:rolar' })}>Rolar faltantes</button>
          <button type="button" onClick={() => sendRoomCommand({ type: 'combate:vez', direcao: -1 })}>Voltar</button>
          <button type="button" className="is-primary" onClick={() => sendRoomCommand({ type: 'combate:vez', direcao: 1 })}>{combate.vez ? 'Próximo' : 'Começar'}</button>
          <button type="button" onClick={() => { if (window.confirm('Encerrar o combate?')) sendRoomCommand({ type: 'combate:encerrar' }) }}>Encerrar</button>
        </div>
      ) : (
        combate.vez && podeMexer(combate.vez) && (
          <button type="button" className="combate-acao" onClick={() => sendRoomCommand({ type: 'combate:vez', direcao: 1 })}>Passar a vez</button>
        )
      )}
    </section>
  )
}
