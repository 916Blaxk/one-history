'use client'
import { Users } from 'lucide-react'
import { MapPage } from '@mesa/features/map/MapPage'
import { useRoomConnection } from '@mesa/features/rooms/use-room-connection'
import { useRoomStore } from '@mesa/features/rooms/room-store'
import { sendRoomCommand } from '@mesa/features/rooms/room-commands'

export function MesaCliente({ campanha }: { campanha: { id: string; nome: string } }) {
  useRoomConnection(campanha.id)
  const status = useRoomStore((state) => state.status)
  const players = useRoomStore((state) => state.players)
  const playerKey = useRoomStore((state) => state.playerKey)
  const role = useRoomStore((state) => state.role)
  const notice = useRoomStore((state) => state.notice)

  return (
    <>
      <MapPage campanha={campanha} />
      <aside className="room-presence" aria-label="Pessoas na mesa">
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
          <span>{campanha.nome}</span>
        </div>
        <div className="room-presence-people">
          <Users size={14} />
          <span>
            {players
              .filter((player) => player.status === 'connected')
              .map(
                (player) =>
                  `${player.name} · ${player.role === 'gm' ? 'Mestre' : player.role === 'player' ? 'Jogador' : 'Espectador'}`,
              )
              .join(', ')}
          </span>
        </div>
        {role === 'gm' && (
          <div className="room-player-management" aria-label="Gerenciar papéis">
            {players.map((player) =>
              player.id === playerKey ? null : (
                <div className="room-player-row" key={player.id}>
                  <span>{player.name}{player.status === 'offline' ? ' (offline)' : ''}</span>
                  <select
                    aria-label={`Papel de ${player.name}`}
                    value={player.role}
                    onChange={(event) =>
                      sendRoomCommand({
                        type: 'player:role',
                        playerKey: player.id,
                        role: event.target.value === 'spectator' ? 'spectator' : 'player',
                      })
                    }
                  >
                    <option value="player">Jogador</option>
                    <option value="spectator">Espectador</option>
                  </select>
                  <button
                    type="button"
                    aria-label={`Tirar ${player.name} da mesa`}
                    onClick={() =>
                      sendRoomCommand({
                        type: 'player:remove',
                        playerKey: player.id,
                      })
                    }
                  >
                    Tirar da mesa
                  </button>
                </div>
              ),
            )}
          </div>
        )}
      </aside>
      {notice && (
        <div className="room-notice" role="status">
          {notice}
        </div>
      )}
    </>
  )
}
