import type { Token } from '../features/tokens/token-types.js'
import type { RoomPlayer } from './room-protocol.js'

export type RoomRole = RoomPlayer['role']
export type RoomAction =
  | 'token:create'
  | 'token:move'
  | 'token:update'
  | 'token:sprites'
  | 'token:remove'
  | 'token:assign'
  | 'token:visibility'
  | 'grid:update'
  | 'fog:update'
  | 'chat:send'
  | 'chat:gm'
  | 'chat:roll'
  | 'chat:whisper'
  | 'chat:action'
  | 'player:manage'

export function can(
  role: RoomRole,
  action: RoomAction,
  token?: Pick<Token, 'hidden' | 'ownerIds'> & Pick<Partial<Token>, 'createdByPlayerKey'>,
  playerKey?: string,
) {
  if (role === 'gm') return true

  if (action === 'chat:send') return true
  if (role === 'spectator') return false
  if (
    action === 'chat:gm' ||
    action === 'chat:whisper' ||
    action === 'chat:action'
  )
    return true
  if (action === 'token:create') return true
  if (action === 'token:move' || action === 'token:update' || action === 'token:sprites')
    return Boolean(
      token &&
        !token.hidden &&
        playerKey &&
        token.ownerIds.includes(playerKey),
    )
  if (action === 'token:remove')
    return Boolean(
      token &&
        !token.hidden &&
        playerKey &&
        token.createdByPlayerKey === playerKey,
    )
  return false
}
