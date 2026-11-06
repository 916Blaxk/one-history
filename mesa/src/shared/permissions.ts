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

export const PLAYER_TOKEN_FIELDS = [
  'name',
  'rotation',
  'activeSpriteId',
  'flipX',
  'hpCurrent',
  'hpMax',
  'manaCurrent',
  'manaMax',
  'characterId',
  'condicoes',
  'spriteSangrandoId',
] as const
export const GM_TOKEN_FIELDS = [
  ...PLAYER_TOKEN_FIELDS,
  'x',
  'y',
  'size',
  'altura',
  'color',
  'ownerIds',
  'hidden',
] as const
export const NULLABLE_TOKEN_FIELDS = [
  'hpCurrent',
  'hpMax',
  'manaCurrent',
  'manaMax',
  'characterId',
  'spriteSangrandoId',
] as const

export function validCharacterId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value)
}

export function validRollLabel(value: unknown) {
  return (
    value === undefined ||
    (typeof value === 'string' &&
      value.trim().length >= 1 &&
      value.length <= 60)
  )
}

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
    action === 'chat:action' ||
    action === 'chat:roll'
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
