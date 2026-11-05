import 'dotenv/config'
import { createServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import { DiceExpressionError, rollDice } from '../src/features/chat/dice-parser.js'
import type { ChatMessage } from '../src/features/chat/chat-types.js'
import type { Token, TokenPosition, TokenSprite } from '../src/features/tokens/token-types.js'
import type {
  ClientToServerEvents, RoomCommand, RoomGrid, RoomPlayer, RoomScene, RoomSnapshot,
  ServerRoomMessage, ServerToClientEvents,
} from '../src/shared/room-protocol.js'
import {
  GM_TOKEN_FIELDS, NULLABLE_TOKEN_FIELDS, PLAYER_TOKEN_FIELDS, can, validCharacterId, validRollLabel,
} from '../src/shared/permissions.js'

const PORT = Number(process.env.PORT) || 3001
const MAX_IMAGE_DATA_URL_LENGTH = 700_000
const MAX_SCENE_DATA_URL_LENGTH = 950_000
const MAX_SPRITES_PER_TOKEN = 12
const MAX_TOKENS_PER_ROOM = 200
const MAX_MESSAGE_LENGTH = 1000
const ROOM_TTL_MS = 30 * 60 * 1000
const defaultGrid: RoomGrid = { enabled: true, cellSize: 70, opacity: 0.24 }

type SocketData = { roomCode?: string; displayName?: string; playerKey?: string }
type TableSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function isFiniteNumber(value: unknown, limit = 1_000_000): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit
}
function validPosition(value: unknown): value is TokenPosition {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
}
function validGrid(value: unknown): value is RoomGrid {
  return isRecord(value) && typeof value.enabled === 'boolean' && Number.isInteger(value.cellSize) &&
    Number(value.cellSize) >= 30 && Number(value.cellSize) <= 160 && typeof value.opacity === 'number' &&
    Number.isFinite(value.opacity) && Number(value.opacity) >= 0.05 && Number(value.opacity) <= 0.7
}
function validScene(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_SCENE_DATA_URL_LENGTH &&
    /^data:image\/(webp|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) &&
    (value.match(/,([A-Za-z0-9+/]+={0,2})$/)?.[1].length ?? Infinity) * 0.75 <= 700_000
}
function isRoomScene(value: unknown): value is RoomScene {
  return isRecord(value) && typeof value.id === 'string' && value.id.length <= 80 && validScene(value.imageUrl) &&
    isFiniteNumber(value.x) && isFiniteNumber(value.y) && Number.isFinite(value.width) && Number(value.width) > 0 && Number(value.width) <= 10000 &&
    Number.isFinite(value.height) && Number(value.height) > 0 && Number(value.height) <= 10000
}
function validSprite(value: unknown): value is TokenSprite {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length > 80 ||
      typeof value.label !== 'string' || value.label.length > 40 || typeof value.imageUrl !== 'string' ||
      value.imageUrl.length > MAX_IMAGE_DATA_URL_LENGTH) return false
  const data = value.imageUrl.match(/^data:image\/(webp|png);base64,([A-Za-z0-9+/]+={0,2})$/)?.[2]
  return Boolean(data && data.length * 0.75 <= 512_000)
}
function validSprites(value: unknown): value is TokenSprite[] {
  return Array.isArray(value) && value.length <= MAX_SPRITES_PER_TOKEN && value.every(validSprite) &&
    new Set(value.map((sprite) => sprite.id)).size === value.length
}
function validToken(value: unknown, sprites: TokenSprite[]): value is Token {
  if (!isRecord(value)) return false
  const ids = value.spriteIds
  const resource = (n: unknown) => n === undefined || (typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 999_999)
  return typeof value.id === 'string' && value.id.length <= 80 && typeof value.name === 'string' &&
    value.name.length >= 1 && value.name.length <= 32 && isFiniteNumber(value.x) && isFiniteNumber(value.y) &&
    [1, 2, 3, 4].includes(value.size as number) && Number.isInteger(value.size) && typeof value.rotation === 'number' &&
    Number.isFinite(value.rotation) && value.rotation >= 0 && value.rotation < 360 && Array.isArray(ids) &&
    ids.length <= MAX_SPRITES_PER_TOKEN && ids.every((id) => typeof id === 'string') && ids.length === sprites.length &&
    ids.every((id, i) => id === sprites[i]?.id) && (value.activeSpriteId === null ||
    (typeof value.activeSpriteId === 'string' && ids.includes(value.activeSpriteId))) && typeof value.flipX === 'boolean' &&
    typeof value.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color) &&
    (value.characterId === undefined || (typeof value.characterId === 'string' && value.characterId.length <= 80)) &&
    resource(value.hpCurrent) && resource(value.hpMax) && resource(value.manaCurrent) && resource(value.manaMax)
    && Array.isArray(value.ownerIds) && value.ownerIds.length <= 100 &&
    value.ownerIds.every((id) => typeof id === 'string' && id.length <= 100) &&
    typeof value.hidden === 'boolean' &&
    (value.createdByPlayerKey === undefined || typeof value.createdByPlayerKey === 'string')
}
function validCommand(value: unknown): value is RoomCommand {
  if (!isRecord(value) || typeof value.type !== 'string') return false
  switch (value.type) {
    case 'token:create': return isRecord(value.token) && validSprites(value.sprites)
    case 'token:update': return typeof value.id === 'string' && value.id.length <= 80 && isRecord(value.changes)
    case 'token:sprites': return typeof value.id === 'string' && value.id.length <= 80 && validSprites(value.sprites)
    case 'token:sprite:add': return typeof value.id === 'string' && value.id.length <= 80 && validSprite(value.sprite)
    case 'token:sprite:rename': return typeof value.id === 'string' && value.id.length <= 80 && typeof value.spriteId === 'string' && value.spriteId.length <= 80 && typeof value.label === 'string' && value.label.length <= 40
    case 'token:sprite:remove': return typeof value.id === 'string' && value.id.length <= 80 && typeof value.spriteId === 'string' && value.spriteId.length <= 80
    case 'token:remove': return typeof value.id === 'string' && value.id.length <= 80
    case 'token:move': return typeof value.id === 'string' && value.id.length <= 80 && validPosition(value.position) && typeof value.final === 'boolean'
    case 'grid:update': return validGrid(value.grid)
    case 'player:role': return typeof value.playerKey === 'string' && ['gm','player','spectator'].includes(String(value.role))
    case 'player:remove': return typeof value.playerKey === 'string'
    case 'scene:add': return isRoomScene(value.scene)
    case 'scene:move': return typeof value.id === 'string' && value.id.length <= 80 && isFiniteNumber(value.x) && isFiniteNumber(value.y)
    case 'scene:remove': return typeof value.id === 'string' && value.id.length <= 80
    case 'fog:paint': return isFiniteNumber(value.x) && isFiniteNumber(value.y) && Number.isInteger(value.radius) && Number(value.radius) >= 1 && Number(value.radius) <= 8 && typeof value.reveal === 'boolean'
    case 'fog:clear': return true
    case 'chat:send': return isRecord(value.message) && ['normal', 'whisper', 'gm', 'action'].includes(String(value.message.type)) &&
      typeof value.message.text === 'string' && value.message.text.length <= MAX_MESSAGE_LENGTH &&
      (value.message.type !== 'whisper' || (typeof value.message.recipient === 'string' && value.message.recipient.trim().length > 0 && value.message.recipient.length <= 24)) &&
      (value.message.recipient === undefined || typeof value.message.recipient === 'string')
    case 'chat:roll': return typeof value.expression === 'string' && value.expression.length <= 120 && validRollLabel(value.label)
    default: return false
  }
}
function snap(value: number, size: Token['size'], cellSize: number) {
  return (Math.round(value / cellSize - size / 2) + size / 2) * cellSize
}

class RoomState {
  tokens = new Map<string, Token>()
  sprites = new Map<string, TokenSprite[]>()
  players = new Map<string, RoomPlayer>()
  connections = new Map<string, Set<string>>()
  removedPlayers = new Set<string>()
  messages: ChatMessage[] = []
  privateMessages = new Map<string, ChatMessage[]>()
  grid: RoomGrid = { ...defaultGrid }
  scenes: RoomScene[] = []
  fogCells = new Set<string>()
  lastMoveAt = new Map<string, number>()
  cleanupTimer?: ReturnType<typeof setTimeout>
  constructor(readonly code: string) {}
  snapshot(player: RoomPlayer): RoomSnapshot {
    const tokens = [...this.tokens.values()].filter((token) => !token.hidden || player.role === 'gm')
    const ids = new Set(tokens.map((token) => token.id))
    return {
      tokens,
      spritesByTokenId: Object.fromEntries([...this.sprites].filter(([id]) => ids.has(id))),
      grid: this.grid,
      scenes: this.scenes,
      fogCells: [...this.fogCells],
      messages: [...this.messages, ...(this.privateMessages.get(player.id) ?? [])]
        .sort((a, b) => a.timestamp - b.timestamp).slice(-200),
      players: [...this.players.values()],
      role: player.role,
    }
  }
}

const origins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((item) => item.trim()).filter(Boolean)
const allowedOrigin = (origin: string | undefined) => {
  if (!origin) return true
  if (origins.includes(origin)) return true
  return process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(?::\d+)?$/.test(origin)
}
const httpServer = createServer((request, response) => {
  if (request.method === 'GET' && new URL(request.url ?? '/', 'http://localhost').pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ status: 'ok' }))
    return
  }
  response.writeHead(404).end('Not found')
})
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
  cors: { origin: (origin, callback) => callback(null, allowedOrigin(origin)), methods: ['GET', 'POST'], credentials: true },
  maxHttpBufferSize: 1_048_576,
})
const rooms = new Map<string, RoomState>()
function getRoom(code: string) {
  let room = rooms.get(code)
  if (!room) { room = new RoomState(code); rooms.set(code, room) }
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
  room.cleanupTimer = undefined
  return room
}
function broadcast(room: RoomState, message: ServerRoomMessage) { io.to(room.code).emit('room:event', message) }
function deny(socket: TableSocket) { socket.emit('room:event', { type: 'permission:error' }) }
function playerRoom(code: string, playerKey: string) { return `${code}:player:${playerKey}` }
function broadcastPlayers(room: RoomState) {
  const players = [...room.players.values()]
  for (const player of players) {
    if (player.status === 'connected') {
      io.to(playerRoom(room.code, player.id)).emit('room:event', {
        type: 'player:joined', player, players,
      } satisfies ServerRoomMessage)
    }
  }
}
function broadcastSnapshots(room: RoomState) {
  for (const player of room.players.values()) {
    if (player.status === 'connected') {
      for (const socketId of room.connections.get(player.id) ?? []) {
        io.to(socketId).emit('room:snapshot', room.snapshot(player), socketId)
      }
    }
  }
}
function broadcastVisible(room: RoomState, message: ServerRoomMessage, token: Token) {
  for (const player of room.players.values()) {
    if (player.status === 'connected' && (!token.hidden || player.role === 'gm')) {
      io.to(playerRoom(room.code, player.id)).emit('room:event', message)
    }
  }
}
function addPublicMessage(room: RoomState, message: ChatMessage) {
  room.messages = [...room.messages, message].slice(-200)
  broadcast(room, { type: 'chat:message', message })
}
function validChanges(changes: Record<string, unknown>) {
  const allowed = new Set<string>(GM_TOKEN_FIELDS)
  const nullable = new Set<string>(NULLABLE_TOKEN_FIELDS)
  return Object.keys(changes).length > 0 && Object.keys(changes).every((key) => allowed.has(key) &&
    (changes[key] !== null || nullable.has(key)) &&
    (key !== 'characterId' || changes[key] === null || validCharacterId(changes[key])) &&
    (key !== 'ownerIds' || (Array.isArray(changes[key]) && changes[key].every((id) => typeof id === 'string'))) &&
    (key !== 'hidden' || typeof changes[key] === 'boolean'))
}

function handleCommand(socket: TableSocket, room: RoomState, player: RoomPlayer, message: RoomCommand) {
  switch (message.type) {
    case 'token:create': {
      if (!can(player.role, 'token:create')) return deny(socket)
      const count = [...room.tokens.values()].filter((token) => token.createdByPlayerKey === player.id).length
      if (room.tokens.size >= MAX_TOKENS_PER_ROOM || room.tokens.has(message.token.id) ||
          (player.role !== 'gm' && count >= 5)) return
      const token: Token = {
        ...message.token,
        ownerIds: player.role === 'gm' ? message.token.ownerIds.filter((id) => room.players.has(id)) : [player.id],
        hidden: player.role === 'gm' && message.token.hidden,
        createdByPlayerKey: player.id,
      }
      if (!validToken(token, message.sprites)) return
      room.tokens.set(token.id, token); room.sprites.set(token.id, message.sprites)
      broadcastVisible(room, { type: 'token:added', token, sprites: message.sprites, playerId: socket.id }, token); return
    }
    case 'token:update': {
      const current = room.tokens.get(message.id); const sprites = room.sprites.get(message.id) ?? []
      if (!current) return
      if (!can(player.role, 'token:update', current, player.id)) return deny(socket)
      const allowed = new Set<string>(player.role === 'gm' ? GM_TOKEN_FIELDS : PLAYER_TOKEN_FIELDS)
      if (!validChanges(message.changes) || Object.keys(message.changes).some((key) => !allowed.has(key))) return deny(socket)
      const updated = { ...current }
      for (const [key, value] of Object.entries(message.changes)) {
        if (value === null) delete (updated as unknown as Record<string, unknown>)[key]
        else (updated as unknown as Record<string, unknown>)[key] = value
      }
      if (!validToken(updated, sprites) || updated.ownerIds.some((id) => !room.players.has(id))) return
      room.tokens.set(message.id, updated)
      if (current.hidden !== updated.hidden || current.ownerIds.join() !== updated.ownerIds.join()) broadcastSnapshots(room)
      else broadcastVisible(room, { type: 'token:updated', token: updated, sprites }, updated)
      return
    }
    case 'token:sprites': {
      const current = room.tokens.get(message.id); if (!current || !validSprites(message.sprites)) return
      if (!can(player.role, 'token:sprites', current, player.id)) return deny(socket)
      updateSprites(room, message.id, current, message.sprites); return
    }
    case 'token:sprite:add': case 'token:sprite:rename': case 'token:sprite:remove': {
      const current = room.tokens.get(message.id); const sprites = [...(room.sprites.get(message.id) ?? [])]
      if (!current) return
      if (!can(player.role, 'token:sprites', current, player.id)) return deny(socket)
      if (message.type === 'token:sprite:add') {
        if (!validSprite(message.sprite) || sprites.length >= MAX_SPRITES_PER_TOKEN || sprites.some((item) => item.id === message.sprite.id)) return
        sprites.push(message.sprite)
      } else if (message.type === 'token:sprite:rename') {
        if (message.label.trim().length === 0 || message.label.length > 40 || !sprites.some((item) => item.id === message.spriteId)) return
        const index = sprites.findIndex((item) => item.id === message.spriteId); sprites[index] = { ...sprites[index]!, label: message.label }
      } else {
        if (!sprites.some((item) => item.id === message.spriteId)) return
        const index = sprites.findIndex((item) => item.id === message.spriteId); sprites.splice(index, 1)
      }
      updateSprites(room, message.id, current, sprites); return
    }
    case 'token:remove': {
      const token = room.tokens.get(message.id); if (!token) return
      if (!can(player.role, 'token:remove', token, player.id)) return deny(socket)
      room.tokens.delete(message.id); room.sprites.delete(message.id); broadcastSnapshots(room); return
    }
    case 'token:move': {
      const token = room.tokens.get(message.id); if (!token) return
      if (!can(player.role, 'token:move', token, player.id)) return deny(socket)
      const now = Date.now(); if (!message.final && now - (room.lastMoveAt.get(player.id) ?? 0) < 35) return
      room.lastMoveAt.set(player.id, now)
      const position = message.final && room.grid.enabled ? { x: snap(message.position.x, token.size, room.grid.cellSize), y: snap(message.position.y, token.size, room.grid.cellSize) } : message.position
      room.tokens.set(message.id, { ...token, ...position })
      if (!token.hidden) {
        socket.to(room.code).emit('room:event', { type: 'token:moved', id: message.id, position, final: message.final, playerId: socket.id })
      } else {
        for (const gm of room.players.values()) {
          if (gm.role === 'gm') io.to(playerRoom(room.code, gm.id)).except(socket.id).emit('room:event', {
            type: 'token:moved', id: message.id, position, final: message.final, playerId: socket.id,
          })
        }
      }
      return
    }
    case 'grid:update': {
      if (!can(player.role, 'grid:update')) return deny(socket)
      if (!validGrid(message.grid)) return
      room.grid = message.grid
      if (room.grid.enabled) for (const [id, token] of room.tokens) room.tokens.set(id, { ...token, x: snap(token.x, token.size, room.grid.cellSize), y: snap(token.y, token.size, room.grid.cellSize) })
      broadcastSnapshots(room); return
    }
    case 'scene:add':
      if (!can(player.role, 'fog:update')) return deny(socket)
      if (!isRoomScene(message.scene) || room.scenes.length >= 30 || room.scenes.some((item) => item.id === message.scene.id)) return
      room.scenes = [...room.scenes, message.scene]
      broadcast(room, { type: 'scene:added', scene: message.scene }); return
    case 'scene:move': {
      if (!can(player.role, 'fog:update')) return deny(socket)
      const scene = room.scenes.find((item) => item.id === message.id); if (!scene) return
      room.scenes = room.scenes.map((item) => item.id === scene.id ? { ...item, x: message.x, y: message.y } : item)
      broadcast(room, { type: 'scene:moved', id: message.id, x: message.x, y: message.y }); return
    }
    case 'scene:remove':
      if (!can(player.role, 'fog:update')) return deny(socket)
      if (!room.scenes.some((item) => item.id === message.id)) return
      room.scenes = room.scenes.filter((item) => item.id !== message.id)
      broadcast(room, { type: 'scene:removed', id: message.id }); return
    case 'fog:paint': {
      if (!can(player.role, 'fog:update')) return deny(socket)
      const cellSize = room.grid.cellSize
      const centerX = Math.floor(message.x / cellSize), centerY = Math.floor(message.y / cellSize)
      const changed: string[] = []
      for (let dx = -message.radius; dx <= message.radius; dx++) for (let dy = -message.radius; dy <= message.radius; dy++) {
        if (dx * dx + dy * dy > message.radius * message.radius + 0.5) continue
        const key = `${centerX + dx},${centerY + dy}`
        if (message.reveal) { if (room.fogCells.delete(key)) changed.push(key) }
        else if (room.fogCells.size < 40000 && !room.fogCells.has(key)) { room.fogCells.add(key); changed.push(key) }
      }
      if (changed.length) broadcast(room, { type: 'fog:updated', cells: changed, reveal: message.reveal }); return
    }
    case 'fog:clear':
      if (!can(player.role, 'fog:update')) return deny(socket)
      room.fogCells.clear(); broadcast(room, { type: 'fog:cleared' }); return
    case 'chat:send': {
      const text = message.message.text.trim().slice(0, MAX_MESSAGE_LENGTH); if (!text) return
      const type = message.message.type
      const action = type === 'whisper' ? 'chat:whisper' : type === 'action' ? 'chat:action' : type === 'gm' ? 'chat:gm' : 'chat:send'
      if (!can(player.role, action)) return deny(socket)
      const chatMessage: ChatMessage = { id: crypto.randomUUID(), type: message.message.type, author: player.name,
        recipient: message.message.recipient?.trim().slice(0, 24), text, timestamp: Date.now() }
      if (message.message.type === 'whisper') {
        const recipient = message.message.recipient!.trim().toLocaleLowerCase()
        const targetIds = [...room.players.values()].filter((item) => item.status === 'connected' && item.name.toLocaleLowerCase() === recipient).map((item) => item.id)
        for (const id of new Set([player.id, ...targetIds])) {
          const history = room.privateMessages.get(id) ?? []; room.privateMessages.set(id, [...history, chatMessage].slice(-200))
          io.to(playerRoom(room.code, id)).emit('room:event', { type: 'chat:message', message: chatMessage })
        }
      } else if (type === 'gm') {
        const targets = [...room.players.values()].filter((item) => item.role === 'gm').map((item) => item.id)
        for (const id of new Set([player.id, ...targets])) {
          const history = room.privateMessages.get(id) ?? []; room.privateMessages.set(id, [...history, chatMessage].slice(-200))
          io.to(playerRoom(room.code, id)).emit('room:event', { type: 'chat:message', message: chatMessage })
        }
      } else addPublicMessage(room, chatMessage)
      return
    }
    case 'chat:roll': {
      if (!can(player.role, 'chat:roll')) return deny(socket)
      const expression = message.expression.trim()
      if (!expression || (expression.match(/[dD]/g)?.length ?? 0) > 10) { socket.emit('room:event', { type: 'chat:error', text: 'A rolagem excede o limite da mesa.' }); return }
      try {
        const roll = rollDice(expression)
        addPublicMessage(room, { id: crypto.randomUUID(), type: 'roll', author: player.name, text: expression, label: message.label?.trim(), roll, timestamp: Date.now() })
      } catch (error) {
        socket.emit('room:event', { type: 'chat:error', text: error instanceof DiceExpressionError ? error.message : 'Não foi possível rolar esses dados.' })
      }
      return
    }
    case 'player:role': {
      if (!can(player.role, 'player:manage')) return deny(socket)
      const target = room.players.get(message.playerKey)
      if (!target) return
      const gmCount = [...room.players.values()].filter((item) => item.role === 'gm').length
      if (target.role === 'gm' && message.role !== 'gm' && gmCount <= 1) return deny(socket)
      room.players.set(target.id, { ...target, role: message.role })
      broadcastPlayers(room)
      broadcastSnapshots(room)
      return
    }
    case 'player:remove': {
      if (!can(player.role, 'player:manage')) return deny(socket)
      if (message.playerKey === player.id) return deny(socket)
      const target = room.players.get(message.playerKey)
      if (!target) return
      const gmCount = [...room.players.values()].filter((item) => item.role === 'gm').length
      if (target.role === 'gm' && gmCount <= 1) return deny(socket)
      room.players.delete(target.id); room.removedPlayers.add(target.id)
      room.privateMessages.delete(target.id)
      for (const owner of room.tokens.values()) owner.ownerIds = owner.ownerIds.filter((id) => id !== target.id)
      for (const socketId of room.connections.get(target.id) ?? []) {
        io.to(socketId).emit('room:event', { type: 'player:kicked' })
        io.sockets.sockets.get(socketId)?.disconnect(true)
      }
      room.connections.delete(target.id)
      broadcastPlayers(room); broadcastSnapshots(room)
    }
  }
}
function updateSprites(room: RoomState, id: string, current: Token, sprites: TokenSprite[]) {
  const ids = sprites.map((sprite) => sprite.id)
  const updated = { ...current, spriteIds: ids, activeSpriteId: ids.includes(current.activeSpriteId ?? '') ? current.activeSpriteId : (ids[0] ?? null) }
  if (!validToken(updated, sprites)) return
  room.tokens.set(id, updated); room.sprites.set(id, sprites)
  broadcastVisible(room, { type: 'token:updated', token: updated, sprites }, updated)
}

io.on('connection', (socket) => {
  const client = socket as TableSocket
  client.on('room:join', ({ roomCode, displayName, playerKey }) => {
    if (typeof roomCode !== 'string' || !/^[a-hjkmnp-z2-9]{6}$/i.test(roomCode) ||
        typeof displayName !== 'string' || !displayName.trim() || displayName.trim().length > 24 ||
        typeof playerKey !== 'string' || !/^[0-9a-f-]{36}$/i.test(playerKey)) return
    if (client.data.roomCode) client.leave(client.data.roomCode)
    const room = getRoom(roomCode)
    if (room.removedPlayers.has(playerKey)) {
      client.emit('room:event', { type: 'player:kicked' })
      return
    }
    client.data.roomCode = roomCode
    client.data.displayName = displayName.trim()
    client.data.playerKey = playerKey
    void client.join(roomCode)
    void client.join(playerRoom(roomCode, playerKey))
    const previous = room.players.get(playerKey)
    const player: RoomPlayer = previous
      ? { ...previous, status: 'connected' }
      : { id: playerKey, name: displayName.trim(), status: 'connected', role: room.players.size === 0 ? 'gm' : 'player' }
    room.players.set(playerKey, player)
    const connections = room.connections.get(playerKey) ?? new Set<string>()
    connections.add(client.id)
    room.connections.set(playerKey, connections)
    client.emit('room:snapshot', room.snapshot(player), player.id)
    broadcastPlayers(room)
  })
  client.on('room:command', (value) => {
    const roomCode = client.data.roomCode; if (!roomCode || !validCommand(value)) return
    const room = rooms.get(roomCode); const player = room?.players.get(client.data.playerKey ?? '')
    if (room && player?.status === 'connected') handleCommand(client, room, player, value)
  })
  client.on('disconnect', () => {
    const code = client.data.roomCode; if (!code) return
    const room = rooms.get(code); if (!room) return
    const playerKey = client.data.playerKey
    if (playerKey) {
      const connections = room.connections.get(playerKey)
      connections?.delete(client.id)
      if (!connections?.size) {
        room.connections.delete(playerKey)
        const previous = room.players.get(playerKey)
        if (previous) room.players.set(playerKey, { ...previous, status: 'offline' })
        room.lastMoveAt.delete(playerKey)
        broadcastPlayers(room)
      }
    }
    void io.in(code).fetchSockets().then((sockets) => {
      if (sockets.length !== 0) return
      room.cleanupTimer = setTimeout(() => { if (rooms.get(code) === room) rooms.delete(code) }, ROOM_TTL_MS)
      room.cleanupTimer.unref?.()
    })
  })
})

httpServer.listen(PORT, '0.0.0.0', () => console.log(`Tablebola Socket.IO server listening on ${PORT}`))
