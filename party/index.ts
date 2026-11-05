import type * as Party from 'partykit/server'
import { rollDice, DiceExpressionError } from '../src/features/chat/dice-parser'
import type { ChatMessage } from '../src/features/chat/chat-types'
import type {
  Token,
  TokenPosition,
  TokenSprite,
} from '../src/features/tokens/token-types'
import type {
  ClientRoomMessage,
  RoomGrid,
  RoomPlayer,
  RoomSnapshot,
  ServerRoomMessage,
} from '../src/shared/room-protocol'

const MAX_IMAGE_DATA_URL_LENGTH = 700_000
const MAX_SCENE_DATA_URL_LENGTH = 4_000_000
const MAX_SPRITES_PER_TOKEN = 12
const MAX_TOKENS_PER_ROOM = 200
const MAX_MESSAGE_LENGTH = 1000

const defaultGrid: RoomGrid = { enabled: true, cellSize: 70, opacity: 0.24 }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown, limit = 1_000_000): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= limit
  )
}

function validPosition(value: unknown): value is TokenPosition {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
}

function validGrid(value: unknown): value is RoomGrid {
  return (
    isRecord(value) &&
    typeof value.enabled === 'boolean' &&
    typeof value.cellSize === 'number' &&
    Number.isInteger(value.cellSize) &&
    value.cellSize >= 30 &&
    value.cellSize <= 160 &&
    typeof value.opacity === 'number' &&
    Number.isFinite(value.opacity) &&
    value.opacity >= 0.05 &&
    value.opacity <= 0.7
  )
}

function validSceneDataUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_SCENE_DATA_URL_LENGTH &&
    /^data:image\/(webp|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
}

function validSprite(value: unknown): value is TokenSprite {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.id.length > 80 ||
    typeof value.label !== 'string' ||
    value.label.length > 40 ||
    typeof value.imageUrl !== 'string' ||
    value.imageUrl.length > MAX_IMAGE_DATA_URL_LENGTH
  )
    return false
  const match = value.imageUrl.match(
    /^data:image\/(webp|png);base64,([A-Za-z0-9+/]+={0,2})$/,
  )
  return Boolean(match && match[2].length * 0.75 <= 512_000)
}

function validSprites(value: unknown): value is TokenSprite[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_SPRITES_PER_TOKEN &&
    value.every(validSprite) &&
    new Set(value.map((sprite) => sprite.id)).size === value.length
  )
}

function validToken(value: unknown, sprites: TokenSprite[]): value is Token {
  if (!isRecord(value)) return false
  const spriteIds = value.spriteIds
  const maxResource = (amount: unknown) =>
    amount === undefined ||
    (typeof amount === 'number' &&
      Number.isFinite(amount) &&
      amount >= 0 &&
      amount <= 999_999)
  return (
    typeof value.id === 'string' &&
    value.id.length <= 80 &&
    typeof value.name === 'string' &&
    value.name.length >= 1 &&
    value.name.length <= 32 &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    [1, 2, 3, 4].includes(value.size as number) &&
    Number.isInteger(value.size) &&
    typeof value.rotation === 'number' &&
    Number.isFinite(value.rotation) &&
    value.rotation >= 0 &&
    value.rotation < 360 &&
    Array.isArray(spriteIds) &&
    spriteIds.length <= MAX_SPRITES_PER_TOKEN &&
    spriteIds.every((id) => typeof id === 'string') &&
    spriteIds.length === sprites.length &&
    spriteIds.every((id, index) => id === sprites[index]?.id) &&
    (value.activeSpriteId === null ||
      (typeof value.activeSpriteId === 'string' &&
        spriteIds.includes(value.activeSpriteId))) &&
    typeof value.flipX === 'boolean' &&
    typeof value.color === 'string' &&
    /^#[0-9a-f]{6}$/i.test(value.color) &&
    (value.characterId === undefined ||
      (typeof value.characterId === 'string' &&
        value.characterId.length <= 80)) &&
    maxResource(value.hpCurrent) &&
    maxResource(value.hpMax) &&
    maxResource(value.manaCurrent) &&
    maxResource(value.manaMax)
  )
}

function validClientMessage(value: unknown): value is ClientRoomMessage {
  if (!isRecord(value) || typeof value.type !== 'string') return false
  switch (value.type) {
    case 'join':
      return (
        typeof value.displayName === 'string' &&
        value.displayName.trim().length > 0 &&
        value.displayName.trim().length <= 24
      )
    case 'token:create':
      return isRecord(value.token) && validSprites(value.sprites)
    case 'token:update':
      return (
        typeof value.id === 'string' &&
        value.id.length <= 80 &&
        isRecord(value.changes)
      )
    case 'token:sprites':
      return (
        typeof value.id === 'string' &&
        value.id.length <= 80 &&
        validSprites(value.sprites)
      )
    case 'token:remove':
      return typeof value.id === 'string' && value.id.length <= 80
    case 'token:move':
      return (
        typeof value.id === 'string' &&
        value.id.length <= 80 &&
        validPosition(value.position) &&
        typeof value.final === 'boolean'
      )
    case 'grid:update':
      return validGrid(value.grid)
    case 'background:update':
      return validSceneDataUrl(value.backgroundUrl)
    case 'chat:send':
      return (
        isRecord(value.message) &&
        ['normal', 'whisper', 'gm', 'action'].includes(
          String(value.message.type),
        ) &&
        typeof value.message.text === 'string' &&
        value.message.text.length <= MAX_MESSAGE_LENGTH &&
        (value.message.type !== 'whisper' ||
          (typeof value.message.recipient === 'string' &&
            value.message.recipient.trim().length > 0 &&
            value.message.recipient.length <= 24)) &&
        (value.message.recipient === undefined ||
          typeof value.message.recipient === 'string')
      )
    case 'chat:roll':
      return (
        typeof value.expression === 'string' && value.expression.length <= 120
      )
    default:
      return false
  }
}

function snap(value: number, size: Token['size'], cellSize: number) {
  return (Math.round(value / cellSize - size / 2) + size / 2) * cellSize
}

export default class TablebolaRoom implements Party.Server {
  private tokens = new Map<string, Token>()
  private sprites = new Map<string, TokenSprite[]>()
  private players = new Map<string, RoomPlayer>()
  private messages: ChatMessage[] = []
  private privateMessages = new Map<string, ChatMessage[]>()
  private grid: RoomGrid = { ...defaultGrid }
  private backgroundUrl: string | null = null
  private lastMoveAt = new Map<string, number>()

  constructor(readonly room: Party.Room) {}

  onMessage(raw: string | ArrayBuffer, sender: Party.Connection) {
    if (typeof raw !== 'string' || raw.length > 8_500_000) return
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return
    }
    if (!validClientMessage(parsed)) return

    if (parsed.type === 'join') {
      const player: RoomPlayer = {
        id: sender.id,
        name: parsed.displayName.trim(),
        status: 'connected',
      }
      this.players.set(sender.id, player)
      const privateMessages = this.privateMessages.get(sender.id) ?? []
      const snapshot: RoomSnapshot = {
        tokens: [...this.tokens.values()],
        spritesByTokenId: Object.fromEntries(this.sprites),
        grid: this.grid,
        backgroundUrl: this.backgroundUrl,
        messages: [...this.messages, ...privateMessages]
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-200),
        players: [...this.players.values()],
      }
      this.send(sender, { type: 'snapshot', snapshot, playerId: sender.id })
      this.broadcast(
        { type: 'player:joined', player, players: [...this.players.values()] },
        [sender.id],
      )
      return
    }

    const player = this.players.get(sender.id)
    if (!player || player.status !== 'connected') return
    this.handleCommand(parsed, sender, player)
  }

  onClose(connection: Party.Connection) {
    const previous = this.players.get(connection.id)
    if (!previous) return
    this.players.set(connection.id, { ...previous, status: 'offline' })
    this.lastMoveAt.delete(connection.id)
    this.privateMessages.delete(connection.id)
    this.broadcast({
      type: 'player:left',
      playerId: connection.id,
      players: [...this.players.values()],
    })
  }

  private handleCommand(
    message: Exclude<ClientRoomMessage, { type: 'join' }>,
    sender: Party.Connection,
    player: RoomPlayer,
  ) {
    switch (message.type) {
      case 'token:create': {
        if (
          this.tokens.size >= MAX_TOKENS_PER_ROOM ||
          this.tokens.has(message.token.id) ||
          !validToken(message.token, message.sprites)
        )
          return
        this.tokens.set(message.token.id, message.token)
        this.sprites.set(message.token.id, message.sprites)
        this.broadcast({
          type: 'token:added',
          token: message.token,
          sprites: message.sprites,
          playerId: sender.id,
        })
        break
      }
      case 'token:update': {
        const current = this.tokens.get(message.id)
        const sprites = this.sprites.get(message.id) ?? []
        if (!current || !this.validTokenChanges(message.changes)) return
        const updated = { ...current }
        for (const [key, value] of Object.entries(message.changes)) {
          if (value === null)
            delete (updated as unknown as Record<string, unknown>)[key]
          else (updated as unknown as Record<string, unknown>)[key] = value
        }
        if (!validToken(updated, sprites)) return
        this.tokens.set(message.id, updated)
        this.broadcast({ type: 'token:updated', token: updated, sprites })
        break
      }
      case 'token:sprites': {
        const current = this.tokens.get(message.id)
        if (!current || !validSprites(message.sprites)) return
        const ids = message.sprites.map((sprite) => sprite.id)
        const updated = {
          ...current,
          spriteIds: ids,
          activeSpriteId: ids.includes(current.activeSpriteId ?? '')
            ? current.activeSpriteId
            : (ids[0] ?? null),
        }
        if (!validToken(updated, message.sprites)) return
        this.tokens.set(message.id, updated)
        this.sprites.set(message.id, message.sprites)
        this.broadcast({
          type: 'token:updated',
          token: updated,
          sprites: message.sprites,
        })
        break
      }
      case 'token:remove':
        if (!this.tokens.has(message.id)) return
        this.tokens.delete(message.id)
        this.sprites.delete(message.id)
        this.broadcast({ type: 'token:removed', id: message.id })
        break
      case 'token:move': {
        const token = this.tokens.get(message.id)
        if (!token || !validPosition(message.position)) return
        const now = Date.now()
        if (!message.final && now - (this.lastMoveAt.get(sender.id) ?? 0) < 35)
          return
        this.lastMoveAt.set(sender.id, now)
        const position =
          message.final && this.grid.enabled
            ? {
                x: snap(message.position.x, token.size, this.grid.cellSize),
                y: snap(message.position.y, token.size, this.grid.cellSize),
              }
            : message.position
        const updated = { ...token, ...position }
        this.tokens.set(message.id, updated)
        this.broadcast({
          type: 'token:moved',
          id: message.id,
          position,
          final: message.final,
          playerId: sender.id,
        })
        break
      }
      case 'grid:update': {
        if (!validGrid(message.grid)) return
        this.grid = message.grid
        if (this.grid.enabled) {
          for (const [id, token] of this.tokens) {
            this.tokens.set(id, {
              ...token,
              x: snap(token.x, token.size, this.grid.cellSize),
              y: snap(token.y, token.size, this.grid.cellSize),
            })
          }
        }
        this.broadcast({
          type: 'grid:updated',
          grid: this.grid,
          tokens: [...this.tokens.values()],
        })
        break
      }
      case 'background:update': {
        if (!validSceneDataUrl(message.backgroundUrl)) return
        this.backgroundUrl = message.backgroundUrl
        this.broadcast({
          type: 'background:updated',
          backgroundUrl: this.backgroundUrl,
        })
        break
      }
      case 'chat:send': {
        const text = message.message.text.trim().slice(0, MAX_MESSAGE_LENGTH)
        if (!text) return
        const chatMessage: ChatMessage = {
          id: crypto.randomUUID(),
          type: message.message.type,
          author: player.name,
          recipient: message.message.recipient?.trim().slice(0, 24),
          text,
          timestamp: Date.now(),
        }
        if (message.message.type === 'whisper') {
          const recipient = message.message.recipient
            ?.trim()
            .toLocaleLowerCase()
          const targets = [...this.players.values()].filter(
            (item) =>
              item.status === 'connected' &&
              item.name.toLocaleLowerCase() === recipient,
          )
          const recipients = new Set([
            sender.id,
            ...targets.map((item) => item.id),
          ])
          for (const id of recipients) {
            const history = this.privateMessages.get(id) ?? []
            this.privateMessages.set(id, [...history, chatMessage].slice(-200))
            this.connection(id)?.send(
              JSON.stringify({
                type: 'chat:message',
                message: chatMessage,
              } satisfies ServerRoomMessage),
            )
          }
          return
        }
        this.addPublicMessage(chatMessage)
        break
      }
      case 'chat:roll': {
        const expression = message.expression.trim()
        if (!expression || (expression.match(/[dD]/g)?.length ?? 0) > 10) {
          this.send(sender, {
            type: 'chat:error',
            text: 'A rolagem excede o limite da mesa.',
          })
          return
        }
        try {
          const roll = rollDice(expression)
          const message: ChatMessage = {
            id: crypto.randomUUID(),
            type: 'roll',
            author: player.name,
            text: expression,
            roll,
            timestamp: Date.now(),
          }
          this.addPublicMessage(message)
        } catch (error) {
          const text =
            error instanceof DiceExpressionError
              ? error.message
              : 'Não foi possível rolar esses dados.'
          this.send(sender, { type: 'chat:error', text })
        }
        break
      }
    }
  }

  private validTokenChanges(changes: Record<string, unknown>) {
    const allowed = new Set([
      'name',
      'x',
      'y',
      'size',
      'rotation',
      'activeSpriteId',
      'flipX',
      'color',
      'hpCurrent',
      'hpMax',
      'manaCurrent',
      'manaMax',
    ])
    return (
      Object.keys(changes).length > 0 &&
      Object.keys(changes).every(
        (key) =>
          allowed.has(key) &&
          (changes[key] !== null ||
            ['hpCurrent', 'hpMax', 'manaCurrent', 'manaMax'].includes(key)),
      )
    )
  }

  private addPublicMessage(message: ChatMessage) {
    this.messages = [...this.messages, message].slice(-200)
    this.broadcast({ type: 'chat:message', message })
  }

  private connection(id: string) {
    return this.room.getConnections().find((connection) => connection.id === id)
  }

  private send(connection: Party.Connection, message: ServerRoomMessage) {
    connection.send(JSON.stringify(message))
  }

  private broadcast(message: ServerRoomMessage, without: string[] = []) {
    this.room.broadcast(JSON.stringify(message), without)
  }
}
