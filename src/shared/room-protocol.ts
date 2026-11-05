import type { ChatMessage } from '../features/chat/chat-types'
import type {
  Token,
  TokenPosition,
  TokenSprite,
} from '../features/tokens/token-types'

export type RoomGrid = { enabled: boolean; cellSize: number; opacity: number }
export type RoomPlayer = {
  id: string
  name: string
  status: 'connected' | 'offline'
}
export type RoomSnapshot = {
  tokens: Token[]
  spritesByTokenId: Record<string, TokenSprite[]>
  grid: RoomGrid
  backgroundUrl: string | null
  messages: ChatMessage[]
  players: RoomPlayer[]
}

export type RoomTokenChanges = {
  [Key in keyof Omit<Token, 'id'>]?: Omit<Token, 'id'>[Key] | null
}

export type ClientRoomMessage =
  | { type: 'join'; displayName: string }
  | { type: 'token:create'; token: Token; sprites: TokenSprite[] }
  | { type: 'token:update'; id: string; changes: RoomTokenChanges }
  | { type: 'token:sprites'; id: string; sprites: TokenSprite[] }
  | { type: 'token:remove'; id: string }
  | { type: 'token:move'; id: string; position: TokenPosition; final: boolean }
  | { type: 'grid:update'; grid: RoomGrid }
  | { type: 'background:update'; backgroundUrl: string }
  | {
      type: 'chat:send'
      message: {
        type: 'normal' | 'whisper' | 'gm' | 'action'
        text: string
        recipient?: string
      }
    }
  | { type: 'chat:roll'; expression: string }

export type ServerRoomMessage =
  | { type: 'snapshot'; snapshot: RoomSnapshot; playerId: string }
  | {
      type: 'token:added'
      token: Token
      sprites: TokenSprite[]
      playerId: string
    }
  | { type: 'token:updated'; token: Token; sprites: TokenSprite[] }
  | { type: 'token:removed'; id: string }
  | {
      type: 'token:moved'
      id: string
      position: TokenPosition
      final: boolean
      playerId: string
    }
  | { type: 'grid:updated'; grid: RoomGrid; tokens: Token[] }
  | { type: 'background:updated'; backgroundUrl: string }
  | { type: 'chat:message'; message: ChatMessage }
  | { type: 'chat:error'; text: string }
  | { type: 'player:joined'; player: RoomPlayer; players: RoomPlayer[] }
  | { type: 'player:left'; playerId: string; players: RoomPlayer[] }
