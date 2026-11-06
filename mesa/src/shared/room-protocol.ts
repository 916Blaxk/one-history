import type { ChatMessage } from '../features/chat/chat-types.js'
import type {
  Token,
  TokenPosition,
  TokenSprite,
  VagaImagem,
} from '../features/tokens/token-types.js'

export type RoomGrid = { enabled: boolean; cellSize: number; opacity: number }
/* `oculto`: só o mestre recebe a imagem e a névoa. É como ele prepara o cenário antes da sessão. */
export type RoomScene = { id: string; imageUrl: string; x: number; y: number; width: number; height: number; nome?: string; oculto?: boolean; escala?: number; travado?: boolean }
export type EntradaCombate = { tokenId: string; iniciativa: number | null }
export type Combate = { rodada: number; vez: string | null; lista: EntradaCombate[] }
export type OpNevoa =
  | { tipo: 'traco'; revelar: boolean; raio: number; pontos: number[]; g?: string }
  | { tipo: 'ret'; x: number; y: number; largura: number; altura: number }
  | { tipo: 'cobrir' }
export type NevoaDaMesa = Record<string, OpNevoa[]>
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
  nevoa: NevoaDaMesa
  combate: Combate | null
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
  | { type: 'token:sprite:add'; id: string; sprite: TokenSprite; vaga: VagaImagem }
  | { type: 'token:sprite:rename'; id: string; spriteId: string; label: string }
  | { type: 'token:sprite:remove'; id: string; spriteId: string }
  | { type: 'token:remove'; id: string }
  | { type: 'token:move'; id: string; position: TokenPosition; final: boolean }
  | { type: 'grid:update'; grid: RoomGrid }
  | { type: 'player:role'; playerKey: string; role: 'player' | 'spectator' }
  | { type: 'player:remove'; playerKey: string }
  | { type: 'scene:add'; scene: RoomScene }
  | { type: 'scene:move'; id: string; x: number; y: number }
  | { type: 'scene:update'; id: string; nome?: string; oculto?: boolean; escala?: number; travado?: boolean }
  | { type: 'scene:remove'; id: string }
  | { type: 'fog:traco'; camada: string; revelar: boolean; raio: number; pontos: number[]; g?: string }
  | { type: 'fog:desfazer'; camada: string; g: string }
  | { type: 'fog:cobrir'; camada: string }
  | { type: 'fog:limpar'; camada: string }
  | { type: 'fog:clear' }
  | { type: 'mapa:ping'; x: number; y: number }
  | { type: 'mapa:focar'; x: number; y: number }
  | { type: 'combate:iniciar' }
  | { type: 'combate:entrar'; tokenId: string }
  | { type: 'combate:sair'; tokenId: string }
  | { type: 'combate:iniciativa'; tokenId: string; valor: number }
  | { type: 'combate:rolar'; tokenId?: string }
  | { type: 'combate:vez'; direcao: 1 | -1 }
  | { type: 'combate:encerrar' }
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
  | { type: 'scene:added'; scene: RoomScene; nevoa?: OpNevoa[]; focar?: boolean }
  | { type: 'scene:updated'; id: string; nome?: string; oculto?: boolean; escala?: number; travado?: boolean }
  | { type: 'grid:updated'; grid: RoomGrid; posicoes: { id: string; x: number; y: number }[] }
  | { type: 'mapa:ping'; x: number; y: number }
  | { type: 'mapa:focar'; x: number; y: number }
  | { type: 'combate:estado'; combate: Combate | null }
  | { type: 'scene:moved'; id: string; x: number; y: number }
  | { type: 'scene:removed'; id: string }
  | { type: 'fog:traco'; camada: string; op: OpNevoa }
  | { type: 'fog:camada'; camada: string; ops: OpNevoa[] }
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
