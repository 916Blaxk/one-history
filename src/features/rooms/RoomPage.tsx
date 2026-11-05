import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Check, Copy, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MapPage } from '@/features/map/MapPage'
import { useRoomConnection } from '@/features/rooms/use-room-connection'
import { useRoomStore } from '@/features/rooms/room-store'
import { sendRoomCommand } from '@/features/rooms/room-commands'
import type { RoomRole } from '@/shared/permissions'

const DISPLAY_NAME_KEY = 'tablebola.display-name'

export function RoomPage() {
  const { code = '' } = useParams()
  const normalizedCode = code.toLowerCase()
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem(DISPLAY_NAME_KEY) ?? '',
  )
  const [submitted, setSubmitted] = useState(() =>
    Boolean(localStorage.getItem(DISPLAY_NAME_KEY)),
  )
  const validCode = /^[a-hj-km-np-z2-9]{6}$/.test(normalizedCode)

  if (!validCode)
    return <main className="map-loading">Código de sala inválido.</main>
  if (!displayName || !submitted) {
    return (
      <NameEntryDialog
        value={displayName}
        onChange={setDisplayName}
        onSubmit={() => {
          const name = displayName.trim().slice(0, 24)
          if (!name) return
          localStorage.setItem(DISPLAY_NAME_KEY, name)
          setDisplayName(name)
          setSubmitted(true)
        }}
      />
    )
  }
  return <ConnectedRoom code={normalizedCode} displayName={displayName} />
}

function NameEntryDialog({
  value,
  onChange,
  onSubmit,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <main className="room-entry-page">
      <form className="room-entry-card" onSubmit={submit}>
        <span className="room-entry-kicker">MESA COMPARTILHADA</span>
        <h1>Como podemos chamar você?</h1>
        <p>Seu nome será exibido para as outras pessoas nesta sala.</p>
        <label>
          Nome de exibição
          <input
            autoFocus
            required
            maxLength={24}
            minLength={1}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Seu nome"
          />
        </label>
        <Button type="submit">Entrar na sala</Button>
      </form>
    </main>
  )
}

function ConnectedRoom({
  code,
  displayName,
}: {
  code: string
  displayName: string
}) {
  useRoomConnection(code, displayName)
  const status = useRoomStore((state) => state.status)
  const players = useRoomStore((state) => state.players)
  const playerKey = useRoomStore((state) => state.playerKey)
  const role = useRoomStore((state) => state.role)
  const notice = useRoomStore((state) => state.notice)
  const setNotice = useRoomStore((state) => state.setNotice)

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setNotice('Link copiado')
      window.setTimeout(() => setNotice(null), 1800)
    } catch {
      setNotice('Não foi possível copiar o link neste navegador')
    }
  }

  return (
    <>
      <MapPage />
      <aside className="room-presence" aria-label="Pessoas na sala">
        <div className="room-presence-status">
          <span className={`connection-dot is-${status}`} />
          <span>
            {status === 'connected'
              ? 'Conectado'
              : status === 'reconnecting'
                ? 'Reconectando'
                : status === 'offline'
                  ? 'Offline'
                  : 'Conectando'}
          </span>
          <b>·</b>
          <span>{code.toUpperCase()}</span>
        </div>
        <div className="room-presence-people">
          <Users size={14} />
          <span>
            {players.length
              ? players
                  .map(
                    (player) =>
                      `${player.name} · ${player.role === 'gm' ? 'GM' : player.role === 'player' ? 'Jogador' : 'Espectador'}${player.status === 'offline' ? ' (offline)' : ''}`,
                  )
                  .join(', ')
              : displayName}
          </span>
        </div>
        {role === 'gm' && (
          <div className="room-player-management" aria-label="Gerenciar papéis">
            {players.map((player) =>
              player.id === playerKey ? null : (
                <div className="room-player-row" key={player.id}>
                  <span>{player.name}</span>
                  <select
                    aria-label={`Papel de ${player.name}`}
                    value={player.role}
                    onChange={(event) =>
                      sendRoomCommand({
                        type: 'player:role',
                        playerKey: player.id,
                        role: event.target.value as RoomRole,
                      })
                    }
                  >
                    <option value="gm">GM</option>
                    <option value="player">Jogador</option>
                    <option value="spectator">Espectador</option>
                  </select>
                  <button
                    type="button"
                    aria-label={`Remover ${player.name}`}
                    onClick={() =>
                      sendRoomCommand({
                        type: 'player:remove',
                        playerKey: player.id,
                      })
                    }
                  >
                    Remover
                  </button>
                </div>
              ),
            )}
          </div>
        )}
        <button
          type="button"
          className="room-copy-link"
          onClick={() => void copyInvite()}
          aria-label="Copiar link de convite"
        >
          {notice === 'Link copiado' ? <Check size={15} /> : <Copy size={15} />}
          <span>
            {notice === 'Link copiado' || notice?.startsWith('Não foi')
              ? notice
              : 'Copiar link'}
          </span>
        </button>
      </aside>
      {notice && notice !== 'Link copiado' && !notice.startsWith('Não foi') && (
        <div className="room-notice" role="status">
          {notice}
        </div>
      )}
    </>
  )
}
