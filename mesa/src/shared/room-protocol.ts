import type { ChatMessage } from '../features/chat/chat-types.js'
import type {
  Token,
  TokenPosition,
  TokenSprite,
} from '../features/tokens/token-types.js'

export type RoomGrid = { enabled: boolean; cellSize: number; opacity: number }
export type RoomScene = { id: string; imageUrl: string; x: number; y: number; width: number; height: number }
export type RoomPlayer = {
  id: string
  name: string
  status: 'connected' | 'offline'
  role: 'gm' | 'player' | 'spectator'
}
export type RoomSnapshot = {
  tokens: Token[]
  spritesByTokenId: Record<string, TokenSprite[]>
  grid: RoomGrid
  scenes: RoomScene[]
  fogCells: string[]
  messages: ChatMessage[]
  players: RoomPlayer[]
  role: RoomPlayer['role']
  selfId: string
}

export type RoomTokenChanges = {
  [Key in keyof Omit<Token, 'id'>]?: Omit<Token, 'id'>[Key] | null
}

export type RoomCommand =
  | { type: 'token:create'; token: Token; sprites: TokenSprite[] }
  | { type: 'token:update'; id: string; changes: RoomTokenChanges }
  | { type: 'token:sprites'; id: string; sprites: TokenSprite[] }
  | { type: 'token:sprite:add'; id: string; sprite: TokenSprite }
  | { type: 'token:sprite:rename'; id: string; spriteId: string; label: string }
  | { type: 'token:sprite:remove'; id: string; spriteId: string }
  | { type: 'token:remove'; id: string }
  | { type: 'token:move'; id: string; position: TokenPosition; final: boolean }
  | { type: 'grid:update'; grid: RoomGrid }
  | { type: 'player:role'; playerKey: string; role: 'player' | 'spectator' }
  | { type: 'player:remove'; playerKey: string }
  | { type: 'scene:add'; scene: RoomScene }
  | { type: 'scene:move'; id: string; x: number; y: number }
  | { type: 'scene:remove'; id: string }
  | { type: 'fog:paint'; x: number; y: number; radius: number; reveal: boolean }
  | { type: 'fog:clear' }
  | {
      type: 'chat:send'
      message: {
        type: 'normal' | 'whisper' | 'gm' | 'action'
        text: string
        recipient?: string
      }
    }
  | { type: 'chat:roll'; expression: string; label?: string }
  | { type: 'ficha:rolar'; fichaId: string; acao: string }

export type ServerRoomMessage =
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
  | { type: 'scene:added'; scene: RoomScene }
  | { type: 'scene:moved'; id: string; x: number; y: number }
  | { type: 'scene:removed'; id: string }
  | { type: 'fog:updated'; cells: string[]; reveal: boolean }
  | { type: 'fog:cleared' }
  | { type: 'chat:message'; message: ChatMessage }
  | { type: 'chat:error'; text: string }
  | { type: 'permission:error' }
  | { type: 'player:kicked' }
  | { type: 'room:denied' }
  | { type: 'ficha:atualizada'; fichaId: string }
  | { type: 'player:joined'; player: RoomPlayer; players: RoomPlayer[] }
  | { type: 'player:left'; playerId: string; players: RoomPlayer[] }

export interface ClientToServerEvents {
  'room:join': (data: { campanhaId: string }) => void
  'room:command': (message: RoomCommand) => void
  'ficha:observar': (fichaId: string) => void
}

export interface ServerToClientEvents {
  'room:snapshot': (snapshot: RoomSnapshot, playerId: string) => void
  'room:event': (message: ServerRoomMessage) => void
  'ficha:mudou': (fichaId: string) => void
}
