import type { Server as HttpServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import { z } from 'zod'
import { DiceExpressionError, rollDice } from '../src/features/chat/dice-parser.js'
import type { ChatMessage } from '../src/features/chat/chat-types.js'
import { TAMANHO_MAXIMO, TAMANHO_MINIMO, alturaDoToken, estaSangrando, type Token, type TokenPosition, type TokenSprite, type VagaImagem, type AjusteImagem, idDaVaga } from '../src/features/tokens/token-types.js'
import type {
  ClientToServerEvents, Combate, NevoaDaMesa, RoomCommand, RoomGrid, RoomPlayer, RoomScene, RoomSnapshot,
  ServerRoomMessage, ServerToClientEvents,
} from '../src/shared/room-protocol.js'
import {
  GM_TOKEN_FIELDS, NULLABLE_TOKEN_FIELDS, PLAYER_TOKEN_FIELDS, can, validCharacterId, validRollLabel,
} from '../src/shared/permissions.js'
import { cenarioNoPonto } from '../src/shared/cenarios.js'
import { avancarVez, tirarDoCombate } from '../src/shared/combate.js'
import { CAMADA_MUNDO, MAX_NUMEROS_NEVOA, MAX_OPS_NEVOA, celulasParaOps, tamanhoDaNevoa } from '../src/shared/nevoa.js'
import * as R from '../../lib/regras'
import type { ImagemMonstro } from '../../lib/servidor/schema'
import { expressaoDaRolagem, lerAcao } from '../../lib/resumoFicha'
import { ouvirMesa, type EventoMesa } from '../../lib/servidor/barramento'
import { alterarFicha, detalheRolagem, gravarRolagem, textoDaRolagem } from '../../lib/servidor/rotas'
import { COOKIE, usuarioDoToken } from '../../lib/servidor/sessao'
import {
  LIMITE_MONSTROS, campanhaExiste, carregarHistorico, contarMonstros, gravarMonstro, lerMonstro, carregarMesa, gravarMensagem, lerAcesso, lerFicha, lerFichasDaCampanha, lerMembros, rolagemParaChat, salvarMesa, type EstadoMesa,
} from './armazem'

const MAX_IMAGE_DATA_URL_LENGTH = 700_000
const MAX_SCENE_DATA_URL_LENGTH = 950_000
const MAX_SPRITES_PER_TOKEN = 12
const MAX_TOKENS_PER_ROOM = 200
const MAX_MESSAGE_LENGTH = 1000
const ROOM_TTL_MS = 30 * 60 * 1000
const INTERVALO_SALVAR_MS = 1000
const INTERVALO_SESSAO_MS = 60 * 1000
const defaultGrid: RoomGrid = { enabled: true, cellSize: 70, opacity: 0.24 }
const NOME_FICHA_PRIVADA = '???'
const CORES_TOKEN_AUTOMATICO = ['#5a54b8', '#3f6fc4', '#7a4fc0', '#4f7fd0', '#6a4fb0', '#3f5fae']
/* Fora do centro do cenário: o token novo não pode cair em cima do que o mestre está mostrando. */
const CELULAS_ATE_TOKEN_NOVO = 3
const INTERVALO_PING_MS = 300
const ESCALA_MINIMA = 0.05
const ESCALA_MAXIMA = 5
const TOKENS_NOVOS_POR_LINHA = 8

type SocketData = { usuario: { id: string; nome: string }; token: string; campanhaId?: string }
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
  return isRecord(value) && typeof value.id === 'string' && value.id.length <= 80 && value.id !== CAMADA_MUNDO && validScene(value.imageUrl) &&
    (value.nome === undefined || (typeof value.nome === 'string' && value.nome.length <= 60)) &&
    (value.oculto === undefined || typeof value.oculto === 'boolean') &&
    (value.escala === undefined || (typeof value.escala === 'number' && value.escala >= ESCALA_MINIMA && value.escala <= ESCALA_MAXIMA)) &&
    (value.travado === undefined || typeof value.travado === 'boolean') &&
    isFiniteNumber(value.x) && isFiniteNumber(value.y) && Number.isFinite(value.width) && Number(value.width) > 0 && Number(value.width) <= 10000 &&
    Number.isFinite(value.height) && Number(value.height) > 0 && Number(value.height) <= 10000
}
/* Em quartos de célula: o bastante para ajuste fino, e os valores continuam exatos na grade. */
function tamanhoValido(value: unknown) {
  return typeof value === 'number' && value >= TAMANHO_MINIMO && value <= TAMANHO_MAXIMO && Number.isInteger(value * 4)
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
    tamanhoValido(value.size) && (value.altura === undefined || tamanhoValido(value.altura)) && typeof value.rotation === 'number' &&
    Number.isFinite(value.rotation) && value.rotation >= 0 && value.rotation < 360 && Array.isArray(ids) &&
    ids.length <= MAX_SPRITES_PER_TOKEN && ids.every((id) => typeof id === 'string') && ids.length === sprites.length &&
    ids.every((id, i) => id === sprites[i]?.id) && (value.activeSpriteId === null ||
    (typeof value.activeSpriteId === 'string' && ids.includes(value.activeSpriteId))) && typeof value.flipX === 'boolean' &&
    typeof value.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color) &&
    (value.characterId === undefined || (typeof value.characterId === 'string' && value.characterId.length <= 80)) &&
    resource(value.hpCurrent) && resource(value.hpMax) && resource(value.manaCurrent) && resource(value.manaMax) &&
    (value.fotoFichaPrivada === undefined || typeof value.fotoFichaPrivada === 'boolean') &&
    (value.automatico === undefined || typeof value.automatico === 'boolean') &&
    (value.spriteSangrandoId === undefined || (typeof value.spriteSangrandoId === 'string' && ids.includes(value.spriteSangrandoId))) &&
    (value.spriteArmadoId === undefined || (typeof value.spriteArmadoId === 'string' && ids.includes(value.spriteArmadoId))) &&
    (value.armado === undefined || typeof value.armado === 'boolean') &&
    (value.sangrando === undefined || typeof value.sangrando === 'boolean') &&
    (value.condicoes === undefined || (Array.isArray(value.condicoes) && value.condicoes.length <= 10 && value.condicoes.every((c) => typeof c === 'string' && c.length >= 1 && c.length <= 24))) &&
    (value.nomeDaFicha === undefined || typeof value.nomeDaFicha === 'boolean') &&
    (value.cenarioId === undefined || (typeof value.cenarioId === 'string' && value.cenarioId.length <= 80))
    && Array.isArray(value.ownerIds) && value.ownerIds.length <= 100 &&
    value.ownerIds.every((id) => typeof id === 'string' && id.length <= 100) &&
    typeof value.hidden === 'boolean' &&
    (value.createdByPlayerKey === undefined || typeof value.createdByPlayerKey === 'string')
}

/* Primeira barreira: forma e tamanho de cada comando. As regras de cada campo vêm depois, com o estado da sala. */
const idCurto = z.string().max(80)
const numero = z.number().refine((n) => isFiniteNumber(n))
const esquemaComando = z.discriminatedUnion('type', [
  z.object({ type: z.literal('token:create'), token: z.record(z.string(), z.unknown()), sprites: z.unknown().refine(validSprites) }),
  z.object({ type: z.literal('token:update'), id: idCurto, changes: z.record(z.string(), z.unknown()) }),
  z.object({ type: z.literal('token:sprites'), id: idCurto, sprites: z.unknown().refine(validSprites) }),
  z.object({ type: z.literal('token:sprite:add'), id: idCurto, sprite: z.unknown().refine(validSprite), vaga: z.enum(['normal', 'machucado', 'armado']) }),
  z.object({ type: z.literal('token:sprite:original'), id: idCurto, spriteId: idCurto, imagem: z.string().max(R.LIMITE_ORIGINAL).regex(/^data:image\/(webp|png);base64,[A-Za-z0-9+/]+={0,2}$/), ajuste: z.object({ zoom: z.number().min(1).max(1000), x: numero, y: numero, forca: z.number().min(0).max(100) }) }),
  z.object({ type: z.literal('token:sprite:pedir-original'), id: idCurto, spriteId: idCurto }),
  z.object({ type: z.literal('token:sprite:rename'), id: idCurto, spriteId: idCurto, label: z.string().max(40) }),
  z.object({ type: z.literal('token:sprite:remove'), id: idCurto, spriteId: idCurto }),
  z.object({ type: z.literal('token:remove'), id: idCurto }),
  z.object({ type: z.literal('token:move'), id: idCurto, position: z.unknown().refine(validPosition), final: z.boolean() }),
  z.object({ type: z.literal('grid:update'), grid: z.unknown().refine(validGrid) }),
  z.object({ type: z.literal('player:role'), playerKey: z.string().max(100), role: z.enum(['player', 'spectator']) }),
  z.object({ type: z.literal('player:remove'), playerKey: z.string().max(100) }),
  z.object({ type: z.literal('scene:add'), scene: z.unknown().refine(isRoomScene) }),
  z.object({ type: z.literal('scene:move'), id: idCurto, x: numero, y: numero }),
  z.object({
    type: z.literal('scene:update'), id: idCurto, nome: z.string().max(60).optional(), oculto: z.boolean().optional(),
    escala: z.number().min(ESCALA_MINIMA).max(ESCALA_MAXIMA).optional(), travado: z.boolean().optional(),
  }),
  z.object({ type: z.literal('scene:remove'), id: idCurto }),
  z.object({
    type: z.literal('fog:traco'), camada: idCurto, revelar: z.boolean(), raio: z.number().int().min(1).max(300),
    pontos: z.array(z.number().int().min(-1_000_000).max(1_000_000)).min(2).max(256).refine((p) => p.length % 2 === 0),
    g: z.string().max(40).optional(),
  }),
  z.object({ type: z.literal('fog:desfazer'), camada: idCurto, g: z.string().max(40) }),
  z.object({ type: z.literal('mapa:ping'), x: numero, y: numero }),
  z.object({ type: z.literal('mapa:focar'), x: numero, y: numero }),
  z.object({ type: z.literal('combate:iniciar') }),
  z.object({ type: z.literal('combate:entrar'), tokenId: idCurto }),
  z.object({ type: z.literal('combate:sair'), tokenId: idCurto }),
  z.object({ type: z.literal('combate:iniciativa'), tokenId: idCurto, valor: z.number().int().min(-999).max(999) }),
  z.object({ type: z.literal('combate:rolar'), tokenId: idCurto.optional() }),
  z.object({ type: z.literal('combate:vez'), direcao: z.union([z.literal(1), z.literal(-1)]) }),
  z.object({ type: z.literal('combate:encerrar') }),
  z.object({ type: z.literal('fog:cobrir'), camada: idCurto }),
  z.object({ type: z.literal('fog:limpar'), camada: idCurto }),
  z.object({ type: z.literal('fog:clear') }),
  z.object({
    type: z.literal('chat:send'),
    message: z.object({
      type: z.enum(['normal', 'whisper', 'gm', 'action']),
      text: z.string().max(MAX_MESSAGE_LENGTH),
      recipient: z.string().max(60).optional(),
    }).refine((m) => m.type !== 'whisper' || Boolean(m.recipient?.trim())),
  }),
  z.object({ type: z.literal('chat:roll'), expression: z.string().max(120), label: z.unknown().refine(validRollLabel).optional() }),
  z.object({ type: z.literal('ficha:rolar'), fichaId: idCurto, acao: z.string().max(60) }),
  z.object({ type: z.literal('biblioteca:salvar'), tokenId: idCurto }),
  z.object({ type: z.literal('biblioteca:colocar'), monstroId: idCurto, x: numero, y: numero }),
])
const esquemaEntrada = z.object({ campanhaId: z.string().min(1).max(80) })

function snap(value: number, size: number, cellSize: number) {
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
  nevoa: NevoaDaMesa = {}
  fichasComToken = new Set<string>()
  combate: Combate | null = null
  ultimoPing = new Map<string, number>()
  lastMoveAt = new Map<string, number>()
  cleanupTimer?: ReturnType<typeof setTimeout>
  /* Só para saber quem vê a vida e a mana de um token vinculado, sem consultar o banco a cada envio. */
  donosFicha = new Map<string, string>()
  espectadores = new Set<string>()
  mestreId = ''
  imagensSalvas = new Set<string>()
  /* A imagem antes do ajuste, para reajustar. Não vai com os sprites: pesaria a mesa de todos. */
  originais = new Map<string, { imagem: string; ajuste: AjusteImagem }>()
  suja = false
  timerSalvar?: ReturnType<typeof setTimeout>
  /* Os comandos de uma sala rodam em ordem: o vínculo com a ficha consulta o banco no meio do caminho. */
  fila: Promise<unknown> = Promise.resolve()
  apagada = false
  constructor(readonly code: string) {}
  /* `leve`: a imagem de cada cenário sobe uma vez só. O navegador já a tem, e reenviar várias a cada ajuste trava a mesa. */
  snapshot(player: RoomPlayer, leve = false): RoomSnapshot {
    const cenas = player.role === 'gm' ? this.scenes : this.scenes.filter((scene) => !scene.oculto)
    const tokens = [...this.tokens.values()].filter((token) => visivelPara(this, token, player))
    const ids = new Set(tokens.map((token) => token.id))
    return {
      tokens: tokens.map((token) => visaoDoToken(this, token, player)),
      spritesByTokenId: Object.fromEntries([...this.sprites].filter(([id]) => ids.has(id))),
      grid: this.grid,
      scenes: leve ? cenas.map((scene) => ({ ...scene, imageUrl: '' })) : cenas,
      combate: visaoDoCombate(this, player),
      nevoa: player.role === 'gm' ? this.nevoa : Object.fromEntries(Object.entries(this.nevoa).filter(([camada]) => !camadaOculta(this, camada))),
      messages: [...this.messages, ...(this.privateMessages.get(player.id) ?? [])]
        .sort((a, b) => a.timestamp - b.timestamp).slice(-200),
      players: [...this.players.values()],
      role: player.role,
      selfId: player.id,
    }
  }
}

/* Personagem de jogador fica fora dos cenários: ninguém pode perder o próprio token de vista. */
const tokenDeJogador = (room: RoomState, token: Token) => token.ownerIds.some((id) => id !== room.mestreId)
/* Único critério do que o jogador não recebe de um token: oculto por ele mesmo ou pelo cenário onde está. */
function tokenOculto(room: RoomState, token: Token) {
  if (token.hidden) return true
  return Boolean(token.cenarioId && !tokenDeJogador(room, token) && room.scenes.some((scene) => scene.id === token.cenarioId && scene.oculto))
}
const visivelPara = (room: RoomState, token: Token, player: RoomPlayer) => player.role === 'gm' || !tokenOculto(room, token)
/* O cenário vem sempre da posição guardada no servidor: o navegador não escolhe, porque isso esconde ou revela o token. */
function comCenario(room: RoomState, token: Token): Token {
  const cenario = tokenDeJogador(room, token) ? undefined : cenarioNoPonto(room.scenes, token.x, token.y)
  const atualizado = { ...token }
  if (cenario) atualizado.cenarioId = cenario.id
  else delete atualizado.cenarioId
  return atualizado
}
const tokensDoCenario = (room: RoomState, cenarioId: string) =>
  [...room.tokens.values()].filter((token) => token.cenarioId === cenarioId && !tokenDeJogador(room, token))

/* Cópias do mesmo monstro ganham número, para o mestre e os jogadores saberem qual goblin foi atingido. */
function nomeLivre(room: RoomState, base: string) {
  const usados = new Set([...room.tokens.values()].map((token) => token.name))
  if (!usados.has(base)) return base
  for (let n = 2; ; n++) {
    const sufixo = ` ${n}`
    const nome = base.slice(0, 32 - sufixo.length) + sufixo
    if (!usados.has(nome)) return nome
  }
}

async function salvarNaBiblioteca(socket: TableSocket, room: RoomState, player: RoomPlayer, tokenId: string) {
  const avisar = (texto: string, salvo: boolean) => socket.emit('room:event', { type: 'biblioteca:aviso', texto, salvo })
  const token = room.tokens.get(tokenId)
  if (!token) return
  if (await contarMonstros(player.id) >= LIMITE_MONSTROS) return avisar(`Sua biblioteca chegou a ${LIMITE_MONSTROS} monstros. Apague algum para salvar outro.`, false)
  const sprites = room.sprites.get(tokenId) ?? []
  const imagens: Partial<Record<VagaImagem, ImagemMonstro>> = {}
  for (const vaga of ['normal', 'machucado', 'armado'] as const) {
    const sprite = sprites.find((item) => item.id === idDaVaga(token, vaga))
    if (!sprite) continue
    const original = room.originais.get(sprite.id)
    imagens[vaga] = { rotulo: sprite.label, imagem: sprite.imageUrl, ...(original ? { original: original.imagem, ajuste: original.ajuste } : {}) }
  }
  await gravarMonstro(player.id, token.name, {
    tamanho: token.size, ...(token.altura !== undefined ? { altura: token.altura } : {}), cor: token.color, espelhado: token.flipX,
    ...(token.hpMax !== undefined ? { vidaMax: token.hpMax } : {}), ...(token.manaMax !== undefined ? { manaMax: token.manaMax } : {}),
  }, imagens)
  avisar(`${token.name} foi salvo na biblioteca.`, true)
}

async function colocarDaBiblioteca(room: RoomState, player: RoomPlayer, monstroId: string, x: number, y: number) {
  if (room.tokens.size >= MAX_TOKENS_PER_ROOM) return
  /* Só a biblioteca de quem pede: o id vindo do navegador nunca abre o monstro de outra conta. */
  const monstro = await lerMonstro(monstroId, player.id)
  if (!monstro) return
  const sprites: TokenSprite[] = []
  const vagas: Partial<Record<VagaImagem, string>> = {}
  const originais: [string, { imagem: string; ajuste: AjusteImagem }][] = []
  for (const vaga of ['normal', 'machucado', 'armado'] as const) {
    const imagem = monstro.imagens[vaga]
    if (!imagem) continue
    const sprite = { id: crypto.randomUUID(), label: imagem.rotulo, imageUrl: imagem.imagem }
    if (!validSprite(sprite)) continue
    sprites.push(sprite); vagas[vaga] = sprite.id
    if (imagem.original && imagem.ajuste && imagem.original.length <= R.LIMITE_ORIGINAL) originais.push([sprite.id, { imagem: imagem.original, ajuste: imagem.ajuste }])
  }
  const d = monstro.dados
  const pedido: Token = {
    id: crypto.randomUUID(), name: nomeLivre(room, monstro.nome.slice(0, 32) || 'Monstro'), x, y,
    size: d.tamanho, ...(d.altura !== undefined ? { altura: d.altura } : {}), rotation: 0,
    spriteIds: sprites.map((sprite) => sprite.id), activeSpriteId: vagas.normal ?? null,
    ...(vagas.machucado ? { spriteSangrandoId: vagas.machucado } : {}), ...(vagas.armado ? { spriteArmadoId: vagas.armado } : {}),
    flipX: d.espelhado, color: d.cor,
    ...(d.vidaMax !== undefined ? { hpMax: d.vidaMax, hpCurrent: d.vidaMax } : {}),
    ...(d.manaMax !== undefined ? { manaMax: d.manaMax, manaCurrent: d.manaMax } : {}),
    ownerIds: [], hidden: false, createdByPlayerKey: player.id,
  }
  if (!validToken(pedido, sprites)) return
  const token = comCenario(room, pedido)
  room.tokens.set(token.id, token); room.sprites.set(token.id, sprites)
  for (const [spriteId, original] of originais) room.originais.set(spriteId, original)
  broadcastVisible(room, { type: 'token:added', token, sprites, playerId: player.id }, token)
}

/* A vida e a mana de uma ficha só saem do servidor para o mestre e o dono, como no resto do site. */
function visaoDoToken(room: RoomState, token: Token, player: RoomPlayer): Token {
  if (!token.characterId || player.role === 'gm' || room.donosFicha.get(token.characterId) === player.id) return token
  /* A vida fica guardada, mas o sprite ferido é visível: quem olha só recebe se está abaixo da metade. */
  const visao = { ...token, sangrando: estaSangrando(token) }
  delete visao.hpCurrent; delete visao.hpMax; delete visao.manaCurrent; delete visao.manaMax
  /* O mestre pode mostrar o token no mapa, mas o nome da ficha privada continua guardado. */
  if (token.fotoFichaPrivada && token.nomeDaFicha) visao.name = NOME_FICHA_PRIVADA
  delete visao.fotoFichaPrivada
  return visao
}

let io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
const rooms = new Map<string, RoomState>()
const carregando = new Map<string, Promise<RoomState>>()

/* Token oculto não aparece na ordem de quem não pode vê-lo, nem quando é a vez dele. */
function visaoDoCombate(room: RoomState, player: RoomPlayer): Combate | null {
  if (!room.combate) return null
  const visivel = (id: string) => { const token = room.tokens.get(id); return Boolean(token && visivelPara(room, token, player)) }
  return {
    rodada: room.combate.rodada,
    vez: room.combate.vez && visivel(room.combate.vez) ? room.combate.vez : null,
    lista: room.combate.lista.filter((item) => visivel(item.tokenId)),
  }
}
function enviarCombate(room: RoomState) {
  for (const player of room.players.values()) {
    if (player.status === 'connected') io.to(playerRoom(room.code, player.id)).emit('room:event', { type: 'combate:estado', combate: visaoDoCombate(room, player) })
  }
}
function removerTokenDoCombate(room: RoomState, tokenId: string) {
  if (!room.combate?.lista.some((item) => item.tokenId === tokenId)) return
  room.combate = tirarDoCombate(room.combate, tokenId)
  enviarCombate(room)
}
function broadcast(room: RoomState, message: ServerRoomMessage) { io.to(room.code).emit('room:event', message) }
function camadaOculta(room: RoomState, camada: string) {
  return room.scenes.some((scene) => scene.id === camada && scene.oculto)
}
/* O que é de cenário oculto vai só para o mestre: é isso que mantém a preparação escondida dos jogadores. */
function paraQuemVe(room: RoomState, oculto: boolean, message: ServerRoomMessage, exceto?: string) {
  const destino = oculto ? io.to(playerRoom(room.code, room.mestreId)) : io.to(room.code)
  ;(exceto ? destino.except(exceto) : destino).emit('room:event', message)
}
function paraJogadores(room: RoomState, message: ServerRoomMessage) {
  for (const player of room.players.values()) {
    if (player.status === 'connected' && player.role !== 'gm') io.to(playerRoom(room.code, player.id)).emit('room:event', message)
  }
}
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
        io.to(socketId).emit('room:snapshot', room.snapshot(player, true), socketId)
      }
    }
  }
}
function broadcastVisible(room: RoomState, message: Extract<ServerRoomMessage, { token: Token }>, token: Token) {
  for (const player of room.players.values()) {
    if (player.status === 'connected' && visivelPara(room, token, player)) {
      io.to(playerRoom(room.code, player.id)).emit('room:event', { ...message, token: visaoDoToken(room, message.token, player) })
    }
  }
}
function addPublicMessage(room: RoomState, message: ChatMessage) {
  if (room.messages.some((item) => item.id === message.id)) return
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

function marcarSuja(room: RoomState) {
  room.suja = true
  if (room.timerSalvar) return
  room.timerSalvar = setTimeout(() => {
    room.timerSalvar = undefined
    void enfileirar(room, () => salvarSala(room))
  }, INTERVALO_SALVAR_MS)
  room.timerSalvar.unref?.()
}
const idDoOriginal = (spriteId: string) => `original-${spriteId}`
function estadoDaSala(room: RoomState) {
  const imagens = new Map<string, string>()
  const ajustes: Record<string, AjusteImagem> = {}
  for (const lista of room.sprites.values()) for (const s of lista) {
    imagens.set(s.id, s.imageUrl)
    /* Só das imagens que ainda existem: é assim que o original de uma imagem trocada sai do banco. */
    const original = room.originais.get(s.id)
    if (original) { imagens.set(idDoOriginal(s.id), original.imagem); ajustes[s.id] = original.ajuste }
  }
  for (const c of room.scenes) imagens.set(c.id, c.imageUrl)
  const estado: EstadoMesa = {
    tokens: [...room.tokens.values()],
    sprites: Object.fromEntries([...room.sprites].map(([id, lista]) => [id, lista.map(({ id: sid, label }) => ({ id: sid, label }))])),
    grid: room.grid,
    scenes: room.scenes.map(({ imageUrl: _imagem, ...resto }) => resto),
    nevoa: room.nevoa,
    espectadores: [...room.espectadores],
    fichasComToken: [...room.fichasComToken],
    combate: room.combate,
    ajustes,
  }
  return { estado, imagens }
}
async function salvarSala(room: RoomState) {
  if (!room.suja || room.apagada) return
  room.suja = false
  const { estado, imagens } = estadoDaSala(room)
  try {
    room.imagensSalvas = await salvarMesa(room.code, estado, imagens, room.imagensSalvas)
  } catch (error) {
    room.suja = true
    console.error('Não consegui salvar a mesa', room.code, error)
  }
}
function enfileirar<T>(room: RoomState, tarefa: () => Promise<T> | T) {
  const proxima = room.fila.then(tarefa).catch((error) => { console.error('Erro na mesa', room.code, error) })
  room.fila = proxima
  return proxima
}

function valoresDaFicha(room: RoomState, ficha: NonNullable<Awaited<ReturnType<typeof lerFicha>>>) {
  const { dados } = ficha
  return {
    hpCurrent: dados.vidaAtual, hpMax: R.vidaMax(dados), manaCurrent: dados.manaAtual, manaMax: R.manaMax(dados),
    fotoFichaPrivada: R.fichaPrivada(ficha, room.mestreId),
  }
}
const nomeParaToken = (dados: R.DadosFicha) => (dados.nome.trim() || 'Sem nome').slice(0, 32)
function desvincular(room: RoomState, token: Token) {
  if (token.automatico) {
    room.tokens.delete(token.id); room.sprites.delete(token.id)
    broadcast(room, { type: 'token:removed', id: token.id })
    removerTokenDoCombate(room, token.id)
    marcarSuja(room)
    return
  }
  const atualizado = { ...token }
  delete atualizado.characterId; delete atualizado.hpCurrent; delete atualizado.hpMax; delete atualizado.manaCurrent; delete atualizado.manaMax
  delete atualizado.fotoFichaPrivada
  room.tokens.set(token.id, atualizado)
  broadcastVisible(room, { type: 'token:updated', token: atualizado, sprites: room.sprites.get(token.id) ?? [] }, atualizado)
  marcarSuja(room)
}
/* Único caminho da ficha para o token. Só lê a ficha e nunca a grava, então não existe laço. */
async function sincronizarFicha(room: RoomState, fichaId: string) {
  const tokens = [...room.tokens.values()].filter((token) => token.characterId === fichaId)
  if (!tokens.length) return
  const ficha = await lerFicha(fichaId)
  if (!ficha || ficha.campanhaId !== room.code) {
    room.donosFicha.delete(fichaId)
    room.fichasComToken.delete(fichaId)
    for (const token of tokens) desvincular(room, token)
    return
  }
  room.donosFicha.set(fichaId, ficha.donoId)
  const valores = valoresDaFicha(room, ficha)
  for (const token of tokens) {
    const name = token.nomeDaFicha ? nomeParaToken(ficha.dados) : token.name
    if (token.name === name && token.hpCurrent === valores.hpCurrent && token.hpMax === valores.hpMax && token.manaCurrent === valores.manaCurrent && token.manaMax === valores.manaMax &&
      token.fotoFichaPrivada === valores.fotoFichaPrivada) continue
    const atualizado = { ...token, ...valores, name }
    room.tokens.set(token.id, atualizado)
    broadcastVisible(room, { type: 'token:updated', token: atualizado, sprites: room.sprites.get(token.id) ?? [] }, atualizado)
    marcarSuja(room)
  }
}
/* Cada ficha que entra na campanha ganha um token uma vez só. Quem apaga o token não o vê voltar sozinho. */
async function criarTokensDasFichas(room: RoomState) {
  const lista = await lerFichasDaCampanha(room.code)
  const presentes = new Set(lista.map((f) => f.id))
  for (const id of room.fichasComToken) if (!presentes.has(id)) { room.fichasComToken.delete(id); marcarSuja(room) }
  const cenario = room.scenes.filter((scene) => !scene.oculto).at(-1)
  const celula = room.grid.cellSize
  for (const ficha of lista) {
    if (room.fichasComToken.has(ficha.id)) continue
    room.fichasComToken.add(ficha.id)
    marcarSuja(room)
    room.donosFicha.set(ficha.id, ficha.donoId)
    if ([...room.tokens.values()].some((token) => token.characterId === ficha.id) || room.tokens.size >= MAX_TOKENS_PER_ROOM) continue
    const vaga = room.fichasComToken.size - 1
    const x = (cenario?.x ?? 0) + (vaga % TOKENS_NOVOS_POR_LINHA - CELULAS_ATE_TOKEN_NOVO) * celula
    const y = (cenario?.y ?? 0) + (Math.floor(vaga / TOKENS_NOVOS_POR_LINHA) + CELULAS_ATE_TOKEN_NOVO) * celula
    const privada = R.fichaPrivada(ficha, room.mestreId)
    const token = comCenario(room, {
      id: crypto.randomUUID(), name: nomeParaToken(ficha.dados),
      x: snap(x, 1, celula), y: snap(y, 1, celula), size: 1, rotation: 0,
      spriteIds: [], activeSpriteId: null, flipX: false, color: CORES_TOKEN_AUTOMATICO[vaga % CORES_TOKEN_AUTOMATICO.length]!,
      characterId: ficha.id, ...valoresDaFicha(room, ficha),
      ownerIds: ficha.donoId === room.mestreId ? [] : [ficha.donoId],
      hidden: privada, automatico: true, nomeDaFicha: true,
    })
    room.tokens.set(token.id, token); room.sprites.set(token.id, [])
    broadcastVisible(room, { type: 'token:added', token, sprites: [], playerId: '' }, token)
  }
}
async function revalidarVinculos(room: RoomState) {
  const fichas = new Set([...room.tokens.values()].flatMap((token) => (token.characterId ? [token.characterId] : [])))
  for (const fichaId of fichas) await sincronizarFicha(room, fichaId)
}

/* Iniciativa é uma rolagem de Destreza da ficha vinculada: tem a vantagem dela, sem somar o valor. Token oculto rola em segredo: o chat é de todos. */
async function rolarIniciativa(room: RoomState, player: RoomPlayer, tokenId: string) {
  const token = room.tokens.get(tokenId)
  const entrada = room.combate?.lista.find((item) => item.tokenId === tokenId)
  if (!token || !entrada) return
  const ficha = token.characterId ? await lerFicha(token.characterId) : null
  const expressao = expressaoDaRolagem(0, ficha ? R.vantagemDaRolagem(ficha.dados, 'corpo', 'destreza') : 0)
  const roll = rollDice(expressao)
  entrada.iniciativa = roll.total
  if (tokenOculto(room, token)) return
  await gravarRolagem({
    campanhaId: room.code, fichaId: null, usuarioId: player.id,
    autor: token.fotoFichaPrivada && token.nomeDaFicha ? NOME_FICHA_PRIVADA : token.name,
    rotulo: 'Iniciativa', det: detalheRolagem(roll), total: roll.total, expressao, detalhe: roll,
  })
}

async function handleCommand(socket: TableSocket, room: RoomState, player: RoomPlayer, message: RoomCommand) {
  switch (message.type) {
    case 'token:create': {
      if (!can(player.role, 'token:create')) return deny(socket)
      const count = [...room.tokens.values()].filter((token) => token.createdByPlayerKey === player.id).length
      if (room.tokens.size >= MAX_TOKENS_PER_ROOM || room.tokens.has(message.token.id) ||
          (player.role !== 'gm' && count >= 5)) return
      const ownerIds = Array.isArray(message.token.ownerIds) ? message.token.ownerIds : []
      const pedido: Token = {
        ...message.token,
        ownerIds: player.role === 'gm' ? ownerIds.filter((id) => room.players.has(id)) : [player.id],
        hidden: player.role === 'gm' && message.token.hidden,
        createdByPlayerKey: player.id,
      }
      /* O vínculo com a ficha passa sempre pela checagem de token:update. */
      delete pedido.characterId; delete pedido.fotoFichaPrivada; delete pedido.automatico; delete pedido.nomeDaFicha; delete pedido.sangrando; delete pedido.spriteSangrandoId; delete pedido.spriteArmadoId; delete pedido.armado; delete pedido.cenarioId
      if (!validToken(pedido, message.sprites)) return
      const token = comCenario(room, pedido)
      room.tokens.set(token.id, token); room.sprites.set(token.id, message.sprites)
      broadcastVisible(room, { type: 'token:added', token, sprites: message.sprites, playerId: socket.id }, token); return
    }
    case 'token:update': {
      const current = room.tokens.get(message.id); const sprites = room.sprites.get(message.id) ?? []
      if (!current) return
      if (!can(player.role, 'token:update', current, player.id)) return deny(socket)
      const allowed = new Set<string>(player.role === 'gm' ? GM_TOKEN_FIELDS : PLAYER_TOKEN_FIELDS)
      if (!validChanges(message.changes) || Object.keys(message.changes).some((key) => !allowed.has(key))) return deny(socket)
      const changes: Record<string, unknown> = { ...message.changes }
      if ('name' in changes) changes.nomeDaFicha = null
      const vinculoNovo = 'characterId' in changes ? (changes.characterId as string | null) : undefined
      const fichaId = vinculoNovo === undefined ? current.characterId : vinculoNovo
      const pedidoFicha: { vidaAtual?: number; manaAtual?: number } = {}

      if (vinculoNovo) {
        const ficha = await lerFicha(vinculoNovo)
        if (!ficha || ficha.campanhaId !== room.code || (player.role !== 'gm' && ficha.donoId !== player.id)) return deny(socket)
        room.donosFicha.set(ficha.id, ficha.donoId)
        Object.assign(changes, valoresDaFicha(room, ficha))
        /* Quem é dono da ficha precisa poder mexer no token dela. */
        const donos = (changes.ownerIds as string[] | undefined) ?? current.ownerIds
        if (!donos.includes(ficha.donoId)) changes.ownerIds = [...donos, ficha.donoId]
      } else if (vinculoNovo === null) {
        changes.hpCurrent = null; changes.hpMax = null; changes.manaCurrent = null; changes.manaMax = null
        changes.fotoFichaPrivada = null
      } else if (fichaId) {
        /* Token vinculado: a ficha manda. O máximo não muda por aqui, e o valor atual é gravado nela. */
        if ('hpMax' in changes || 'manaMax' in changes) return deny(socket)
        const mexeRecurso = 'hpCurrent' in changes || 'manaCurrent' in changes
        if (mexeRecurso) {
          if (player.role !== 'gm' && room.donosFicha.get(fichaId) !== player.id) return deny(socket)
          for (const [campo, destino] of [['hpCurrent', 'vidaAtual'], ['manaCurrent', 'manaAtual']] as const) {
            if (!(campo in changes)) continue
            const valor = changes[campo]
            delete changes[campo]
            if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) return deny(socket)
            pedidoFicha[destino] = Math.floor(Math.min(valor, 999_999))
          }
        }
      }

      let updated = { ...current }
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) delete (updated as unknown as Record<string, unknown>)[key]
        else (updated as unknown as Record<string, unknown>)[key] = value
      }
      if (!validToken(updated, sprites) || updated.ownerIds.some((id) => !room.players.has(id))) return
      if ('x' in changes || 'y' in changes) updated = comCenario(room, updated)
      /* Virou personagem de jogador: sai do cenário e não volta a sumir com ele. */
      else if (tokenDeJogador(room, updated)) delete updated.cenarioId
      room.tokens.set(message.id, updated)
      if (tokenOculto(room, current) !== tokenOculto(room, updated) || current.ownerIds.join() !== updated.ownerIds.join()) broadcastSnapshots(room)
      else if (Object.keys(changes).length) broadcastVisible(room, { type: 'token:updated', token: updated, sprites }, updated)
      if (fichaId && (pedidoFicha.vidaAtual !== undefined || pedidoFicha.manaAtual !== undefined)) {
        /* Grava como o site grava: normalizar() corta no máximo, e o aviso de ficha alterada atualiza todos os tokens. */
        await alterarFicha(fichaId, (linha) => { linha.dados = R.normalizar({ ...linha.dados, ...pedidoFicha }) })
        await sincronizarFicha(room, fichaId)
      }
      return
    }
    case 'token:sprites': {
      const current = room.tokens.get(message.id); if (!current || !validSprites(message.sprites)) return
      if (!can(player.role, 'token:sprites', current, player.id)) return deny(socket)
      updateSprites(room, message.id, current, message.sprites); return
    }
    case 'token:sprite:original': case 'token:sprite:pedir-original': {
      const current = room.tokens.get(message.id)
      if (!current) return
      if (!can(player.role, 'token:sprites', current, player.id)) return deny(socket)
      if (!(room.sprites.get(message.id) ?? []).some((item) => item.id === message.spriteId)) return
      if (message.type === 'token:sprite:original') {
        room.originais.set(message.spriteId, { imagem: message.imagem, ajuste: message.ajuste })
        marcarSuja(room)
        return
      }
      const original = room.originais.get(message.spriteId)
      socket.emit('room:event', { type: 'token:sprite:original', spriteId: message.spriteId, imagem: original?.imagem ?? null, ajuste: original?.ajuste ?? null })
      return
    }
    case 'token:sprite:add': case 'token:sprite:rename': case 'token:sprite:remove': {
      const current = room.tokens.get(message.id); const sprites = [...(room.sprites.get(message.id) ?? [])]
      if (!current) return
      if (!can(player.role, 'token:sprites', current, player.id)) return deny(socket)
      const vagas: VagasDoToken = { normal: current.activeSpriteId ?? undefined, machucado: current.spriteSangrandoId, armado: current.spriteArmadoId }
      if (message.type === 'token:sprite:add') {
        /* Cada vaga guarda uma imagem: a nova substitui a anterior. */
        const lista = sprites.filter((item) => item.id !== vagas[message.vaga])
        if (!validSprite(message.sprite) || lista.length >= MAX_SPRITES_PER_TOKEN || lista.some((item) => item.id === message.sprite.id)) return
        sprites.splice(0, sprites.length, ...lista, message.sprite)
        vagas[message.vaga] = message.sprite.id
      } else if (message.type === 'token:sprite:rename') {
        if (message.label.trim().length === 0 || message.label.length > 40 || !sprites.some((item) => item.id === message.spriteId)) return
        const index = sprites.findIndex((item) => item.id === message.spriteId); sprites[index] = { ...sprites[index]!, label: message.label }
      } else {
        if (!sprites.some((item) => item.id === message.spriteId)) return
        const index = sprites.findIndex((item) => item.id === message.spriteId); sprites.splice(index, 1)
      }
      updateSprites(room, message.id, current, sprites, vagas); return
    }
    case 'token:remove': {
      const token = room.tokens.get(message.id); if (!token) return
      if (!can(player.role, 'token:remove', token, player.id)) return deny(socket)
      room.tokens.delete(message.id); room.sprites.delete(message.id)
      broadcast(room, { type: 'token:removed', id: message.id })
      removerTokenDoCombate(room, message.id)
      return
    }
    case 'token:move': {
      const token = room.tokens.get(message.id); if (!token) return
      if (!can(player.role, 'token:move', token, player.id)) return deny(socket)
      const now = Date.now(); if (!message.final && now - (room.lastMoveAt.get(player.id) ?? 0) < 35) return
      room.lastMoveAt.set(player.id, now)
      const position = message.final && room.grid.enabled ? { x: snap(message.position.x, token.size, room.grid.cellSize), y: snap(message.position.y, alturaDoToken(token), room.grid.cellSize) } : message.position
      const movido = message.final ? comCenario(room, { ...token, ...position }) : { ...token, ...position }
      room.tokens.set(message.id, movido)
      /* Soltou em outro cenário, e isso muda quem vê o token: quem passa a ver precisa recebê-lo inteiro. */
      if (tokenOculto(room, token) !== tokenOculto(room, movido)) { broadcastSnapshots(room); return }
      if (movido.cenarioId !== token.cenarioId) io.to(playerRoom(room.code, room.mestreId)).emit('room:event', { type: 'token:updated', token: movido, sprites: room.sprites.get(movido.id) ?? [] })
      if (!tokenOculto(room, movido)) {
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
      if (room.grid.enabled) for (const [id, token] of room.tokens) room.tokens.set(id, { ...token, x: snap(token.x, token.size, room.grid.cellSize), y: snap(token.y, alturaDoToken(token), room.grid.cellSize) })
      /* O controle da grade dispara vários comandos por segundo: nada de imagem aqui. */
      for (const alvo of room.players.values()) {
        if (alvo.status !== 'connected') continue
        const posicoes = [...room.tokens.values()].filter((token) => visivelPara(room, token, alvo)).map(({ id, x, y }) => ({ id, x, y }))
        io.to(playerRoom(room.code, alvo.id)).emit('room:event', { type: 'grid:updated', grid: room.grid, posicoes })
      }
      return
    }
    case 'scene:add':
      if (!can(player.role, 'fog:update')) return deny(socket)
      if (!isRoomScene(message.scene) || room.scenes.length >= 30 || room.scenes.some((item) => item.id === message.scene.id)) return
      room.scenes = [...room.scenes, message.scene]
      paraQuemVe(room, Boolean(message.scene.oculto), { type: 'scene:added', scene: message.scene }); return
    case 'scene:move': {
      if (!can(player.role, 'fog:update')) return deny(socket)
      const scene = room.scenes.find((item) => item.id === message.id); if (!scene) return
      room.scenes = room.scenes.map((item) => item.id === scene.id ? { ...item, x: message.x, y: message.y } : item)
      /* Sem encaixar na grade: este comando vem a cada movimento do arraste, e o token precisa manter o lugar no mapa. */
      const dx = message.x - scene.x, dy = message.y - scene.y
      const levados = tokensDoCenario(room, scene.id).map((token) => ({ ...token, x: token.x + dx, y: token.y + dy }))
      for (const token of levados) room.tokens.set(token.id, token)
      for (const alvo of room.players.values()) {
        if (alvo.status !== 'connected' || (scene.oculto && alvo.role !== 'gm')) continue
        const posicoes = levados.filter((token) => visivelPara(room, token, alvo)).map(({ id, x, y }) => ({ id, x, y }))
        io.to(playerRoom(room.code, alvo.id)).emit('room:event', { type: 'scene:moved', id: message.id, x: message.x, y: message.y, posicoes })
      }
      return
    }
    case 'scene:update': {
      if (!can(player.role, 'fog:update')) return deny(socket)
      const scene = room.scenes.find((item) => item.id === message.id); if (!scene) return
      const atualizado: RoomScene = { ...scene }
      if (message.nome !== undefined) atualizado.nome = message.nome.trim()
      if (message.oculto !== undefined) atualizado.oculto = message.oculto
      if (message.escala !== undefined) atualizado.escala = message.escala
      if (message.travado !== undefined) atualizado.travado = message.travado
      /* Em cena, um clique errado não pode arrastar o mapa: ao mostrar, ele já vai travado. */
      if (scene.oculto && message.oculto === false && message.travado === undefined) atualizado.travado = true
      room.scenes = room.scenes.map((item) => item.id === scene.id ? atualizado : item)
      const aviso: ServerRoomMessage = { type: 'scene:updated', id: scene.id, nome: atualizado.nome, oculto: atualizado.oculto, escala: atualizado.escala, travado: atualizado.travado }
      io.to(playerRoom(room.code, room.mestreId)).emit('room:event', aviso)
      /* Para os jogadores, mostrar é o cenário chegar, com a névoa já pronta, e esconder é ele sumir. */
      if (Boolean(scene.oculto) !== Boolean(atualizado.oculto)) {
        paraJogadores(room, atualizado.oculto
          ? { type: 'scene:removed', id: scene.id }
          : { type: 'scene:added', scene: atualizado, nevoa: room.nevoa[scene.id] ?? [], focar: true })
      } else if (!atualizado.oculto) paraJogadores(room, aviso)
      /* Depois do cenário: os tokens dele chegam ou somem junto, e a ordem do combate acompanha. */
      if (Boolean(scene.oculto) !== Boolean(atualizado.oculto) && tokensDoCenario(room, scene.id).length) broadcastSnapshots(room)
      return
    }
    case 'scene:remove': {
      if (!can(player.role, 'fog:update')) return deny(socket)
      const scene = room.scenes.find((item) => item.id === message.id); if (!scene) return
      /* Apagar um cenário oculto não pode revelar o que estava preparado nele: os tokens continuam ocultos, agora por conta própria. */
      const orfaos = [...room.tokens.values()].filter((token) => token.cenarioId === scene.id)
      for (const token of orfaos) {
        const solto = { ...token, hidden: token.hidden || (Boolean(scene.oculto) && !tokenDeJogador(room, token)) }
        delete solto.cenarioId
        room.tokens.set(token.id, solto)
      }
      room.scenes = room.scenes.filter((item) => item.id !== message.id)
      delete room.nevoa[message.id]
      paraQuemVe(room, Boolean(scene.oculto), { type: 'scene:removed', id: message.id })
      if (orfaos.length) broadcastSnapshots(room)
      return
    }
    case 'fog:traco': {
      if (!can(player.role, 'fog:update')) return deny(socket)
      if (message.camada !== CAMADA_MUNDO && !room.scenes.some((item) => item.id === message.camada)) return
      const tamanho = tamanhoDaNevoa(room.nevoa)
      if (tamanho.ops >= MAX_OPS_NEVOA || tamanho.numeros + message.pontos.length > MAX_NUMEROS_NEVOA) {
        socket.emit('room:event', { type: 'chat:error', text: 'A névoa desta mesa chegou ao limite. Use Cobrir ou Limpar em um cenário para liberar espaço.' })
        /* O navegador já pintou o traço: isto o traz de volta ao que ficou guardado. */
        socket.emit('room:snapshot', room.snapshot(player), socket.id)
        return
      }
      const op = { tipo: 'traco' as const, revelar: message.revelar, raio: message.raio, pontos: message.pontos, ...(message.g ? { g: message.g } : {}) }
      room.nevoa[message.camada] = [...(room.nevoa[message.camada] ?? []), op]
      paraQuemVe(room, camadaOculta(room, message.camada), { type: 'fog:traco', camada: message.camada, op }, socket.id)
      return
    }
    case 'fog:desfazer': {
      if (!can(player.role, 'fog:update')) return deny(socket)
      const ops = room.nevoa[message.camada]
      if (!ops) return
      room.nevoa[message.camada] = ops.filter((op) => op.tipo !== 'traco' || op.g !== message.g)
      paraQuemVe(room, camadaOculta(room, message.camada), { type: 'fog:camada', camada: message.camada, ops: room.nevoa[message.camada]! })
      return
    }
    case 'mapa:ping': {
      if (player.role === 'spectator') return deny(socket)
      const agora = Date.now()
      if (agora - (room.ultimoPing.get(player.id) ?? 0) < INTERVALO_PING_MS) return
      room.ultimoPing.set(player.id, agora)
      broadcast(room, { type: 'mapa:ping', x: message.x, y: message.y })
      return
    }
    case 'mapa:focar':
      if (!can(player.role, 'fog:update')) return deny(socket)
      paraJogadores(room, { type: 'mapa:focar', x: message.x, y: message.y })
      return
    case 'combate:iniciar':
      if (!can(player.role, 'fog:update')) return deny(socket)
      if (room.combate) return
      room.combate = {
        rodada: 1, vez: null,
        lista: [...room.tokens.values()].filter((token) => !tokenOculto(room, token)).map((token) => ({ tokenId: token.id, iniciativa: null })),
      }
      enviarCombate(room)
      return
    case 'combate:entrar': {
      const token = room.tokens.get(message.tokenId)
      if (!token || !room.combate) return
      if (!can(player.role, 'token:update', token, player.id)) return deny(socket)
      if (room.combate.lista.some((item) => item.tokenId === token.id)) return
      room.combate = { ...room.combate, lista: [...room.combate.lista, { tokenId: token.id, iniciativa: null }] }
      enviarCombate(room)
      return
    }
    case 'combate:sair': {
      const token = room.tokens.get(message.tokenId)
      if (!token || !room.combate) return
      if (!can(player.role, 'token:update', token, player.id)) return deny(socket)
      removerTokenDoCombate(room, token.id)
      return
    }
    case 'combate:iniciativa': {
      if (!can(player.role, 'fog:update')) return deny(socket)
      const entrada = room.combate?.lista.find((item) => item.tokenId === message.tokenId)
      if (!entrada) return
      entrada.iniciativa = message.valor
      enviarCombate(room)
      return
    }
    case 'combate:rolar': {
      if (!room.combate) return
      if (message.tokenId) {
        const token = room.tokens.get(message.tokenId)
        if (!token) return
        if (!can(player.role, 'token:update', token, player.id)) return deny(socket)
        await rolarIniciativa(room, player, token.id)
      } else {
        if (!can(player.role, 'fog:update')) return deny(socket)
        for (const item of room.combate.lista) if (item.iniciativa === null) await rolarIniciativa(room, player, item.tokenId)
      }
      enviarCombate(room)
      return
    }
    case 'combate:vez': {
      if (!room.combate) return
      /* O jogador só encerra a própria vez. O mestre conduz o resto. */
      const naVez = room.combate.vez ? room.tokens.get(room.combate.vez) : undefined
      const podePassar = message.direcao === 1 && naVez && can(player.role, 'token:update', naVez, player.id)
      if (player.role !== 'gm' && !podePassar) return deny(socket)
      room.combate = avancarVez(room.combate, message.direcao)
      enviarCombate(room)
      return
    }
    case 'combate:encerrar':
      if (!can(player.role, 'fog:update')) return deny(socket)
      room.combate = null
      enviarCombate(room)
      return
    case 'fog:cobrir':
      if (!can(player.role, 'fog:update')) return deny(socket)
      if (!room.scenes.some((item) => item.id === message.camada)) return
      room.nevoa[message.camada] = [{ tipo: 'cobrir' }]
      paraQuemVe(room, camadaOculta(room, message.camada), { type: 'fog:camada', camada: message.camada, ops: room.nevoa[message.camada]! })
      return
    case 'fog:limpar':
      if (!can(player.role, 'fog:update')) return deny(socket)
      delete room.nevoa[message.camada]
      paraQuemVe(room, camadaOculta(room, message.camada), { type: 'fog:camada', camada: message.camada, ops: [] })
      return
    case 'fog:clear':
      if (!can(player.role, 'fog:update')) return deny(socket)
      room.nevoa = {}; broadcast(room, { type: 'fog:cleared' }); return
    case 'chat:send': {
      const text = message.message.text.trim().slice(0, MAX_MESSAGE_LENGTH); if (!text) return
      const type = message.message.type
      const action = type === 'whisper' ? 'chat:whisper' : type === 'action' ? 'chat:action' : type === 'gm' ? 'chat:gm' : 'chat:send'
      if (!can(player.role, action)) return deny(socket)
      const chatMessage: ChatMessage = { id: crypto.randomUUID(), type: message.message.type, author: player.name,
        recipient: message.message.recipient?.trim().slice(0, 60), text, timestamp: Date.now() }
      if (type === 'whisper' || type === 'gm') {
        const destinatario = message.message.recipient?.trim().toLocaleLowerCase()
        const targets = type === 'gm'
          ? [...room.players.values()].filter((item) => item.role === 'gm').map((item) => item.id)
          : [...room.players.values()].filter((item) => item.status === 'connected' && item.name.toLocaleLowerCase() === destinatario).map((item) => item.id)
        const ids = [...new Set([player.id, ...targets])]
        await gravarMensagem(room.code, player.id, chatMessage, ids)
        for (const id of ids) {
          const history = room.privateMessages.get(id) ?? []; room.privateMessages.set(id, [...history, chatMessage].slice(-200))
          io.to(playerRoom(room.code, id)).emit('room:event', { type: 'chat:message', message: chatMessage })
        }
      } else {
        await gravarMensagem(room.code, player.id, chatMessage, null)
        addPublicMessage(room, chatMessage)
      }
      return
    }
    case 'chat:roll': {
      if (!can(player.role, 'chat:roll')) return deny(socket)
      const expression = message.expression.trim()
      if (!expression || (expression.match(/[dD]/g)?.length ?? 0) > 10) { socket.emit('room:event', { type: 'chat:error', text: 'A rolagem excede o limite da mesa.' }); return }
      try {
        const roll = rollDice(expression)
        await gravarRolagem({
          campanhaId: room.code, fichaId: null, usuarioId: player.id, autor: player.name,
          rotulo: message.label?.trim() ?? '', det: textoDaRolagem(roll), total: roll.total, expressao: expression, detalhe: roll,
        })
      } catch (error) {
        if (!(error instanceof DiceExpressionError)) console.error(error)
        socket.emit('room:event', { type: 'chat:error', text: error instanceof DiceExpressionError ? error.message : 'Não foi possível rolar esses dados.' })
      }
      return
    }
    case 'ficha:rolar': {
      if (!can(player.role, 'chat:roll')) return deny(socket)
      const ficha = await lerFicha(message.fichaId)
      if (!ficha || ficha.campanhaId !== room.code || (player.role !== 'gm' && ficha.donoId !== player.id)) return deny(socket)
      const item = lerAcao(ficha.dados, message.acao)
      if (!item) return deny(socket)
      /* O bônus vem da ficha guardada: o navegador só diz qual atributo rolar. */
      const expression = expressaoDaRolagem(item.valor, item.vantagem)
      const roll = rollDice(expression)
      /* Todos da mesa veem a rolagem: o nome e o id entregariam a ficha privada. */
      const privada = R.fichaPrivada(ficha, room.mestreId)
      await gravarRolagem({
        campanhaId: room.code, fichaId: privada ? null : ficha.id, usuarioId: player.id, autor: privada ? 'Mestre' : ficha.dados.nome || 'Sem nome',
        rotulo: item.rotulo, det: detalheRolagem(roll), total: roll.total, expressao: expression, detalhe: roll,
      })
      return
    }
    case 'biblioteca:salvar':
      if (player.role !== 'gm') return deny(socket)
      return salvarNaBiblioteca(socket, room, player, message.tokenId)
    case 'biblioteca:colocar':
      if (player.role !== 'gm') return deny(socket)
      return colocarDaBiblioteca(room, player, message.monstroId, message.x, message.y)
    case 'player:role': {
      if (!can(player.role, 'player:manage')) return deny(socket)
      const target = room.players.get(message.playerKey)
      /* O mestre da campanha é sempre GM, e ninguém mais vira GM: o papel vem do banco. */
      if (!target || target.id === room.mestreId) return deny(socket)
      if (message.role === 'spectator') room.espectadores.add(target.id)
      else room.espectadores.delete(target.id)
      room.players.set(target.id, { ...target, role: message.role })
      broadcastPlayers(room)
      broadcastSnapshots(room)
      return
    }
    case 'player:remove': {
      if (!can(player.role, 'player:manage')) return deny(socket)
      if (message.playerKey === player.id || message.playerKey === room.mestreId) return deny(socket)
      const target = room.players.get(message.playerKey)
      if (!target) return
      room.removedPlayers.add(target.id)
      room.players.set(target.id, { ...target, status: 'offline' })
      for (const socketId of room.connections.get(target.id) ?? []) {
        io.to(socketId).emit('room:event', { type: 'player:kicked' })
        io.sockets.sockets.get(socketId)?.disconnect(true)
      }
      room.connections.delete(target.id)
      broadcastPlayers(room); broadcastSnapshots(room)
    }
  }
}
type VagasDoToken = Partial<Record<VagaImagem, string>>
function updateSprites(room: RoomState, id: string, current: Token, sprites: TokenSprite[], vagas: VagasDoToken = { normal: current.activeSpriteId ?? undefined, machucado: current.spriteSangrandoId, armado: current.spriteArmadoId }) {
  const ids = sprites.map((sprite) => sprite.id)
  const existente = (spriteId?: string) => (spriteId && ids.includes(spriteId) ? spriteId : undefined)
  const machucado = existente(vagas.machucado), armado = existente(vagas.armado)
  /* Tokens antigos podem ter mais de uma imagem normal: ao remover a atual, a próxima assume. */
  const normais = ids.filter((spriteId) => spriteId !== machucado && spriteId !== armado)
  const updated: Token = { ...current, spriteIds: ids, activeSpriteId: normais.includes(vagas.normal ?? '') ? vagas.normal! : (normais[0] ?? null) }
  if (machucado) updated.spriteSangrandoId = machucado
  else delete updated.spriteSangrandoId
  if (armado) updated.spriteArmadoId = armado
  else { delete updated.spriteArmadoId; delete updated.armado }
  if (!validToken(updated, sprites)) return
  room.tokens.set(id, updated); room.sprites.set(id, sprites)
  broadcastVisible(room, { type: 'token:updated', token: updated, sprites }, updated)
}

async function carregarSala(campanhaId: string) {
  const room = new RoomState(campanhaId)
  const [salva, historico, lista, campanha] = await Promise.all([carregarMesa(campanhaId), carregarHistorico(campanhaId), lerMembros(campanhaId), campanhaExiste(campanhaId)])
  room.mestreId = campanha?.mestreId ?? ''
  room.messages = historico.publicas
  room.privateMessages = historico.privadas
  if (salva) {
    const e = salva.estado
    room.grid = e.grid
    room.nevoa = e.nevoa ?? {}
    if (e.fogCells?.length && !room.nevoa[CAMADA_MUNDO]) room.nevoa[CAMADA_MUNDO] = celulasParaOps(e.fogCells, e.grid.cellSize)
    room.espectadores = new Set(e.espectadores)
    room.fichasComToken = new Set(e.fichasComToken)
    room.combate = e.combate ?? null
    room.scenes = e.scenes.flatMap((c) => {
      const imageUrl = salva.imagens.get(c.id)
      return imageUrl ? [{ ...c, imageUrl }] : []
    })
    for (const token of e.tokens) {
      room.tokens.set(token.id, token)
      room.sprites.set(token.id, (e.sprites[token.id] ?? []).flatMap((s) => {
        const imageUrl = salva.imagens.get(s.id)
        const original = salva.imagens.get(idDoOriginal(s.id)), ajuste = e.ajustes?.[s.id]
        if (original && ajuste) room.originais.set(s.id, { imagem: original, ajuste })
        return imageUrl ? [{ ...s, imageUrl }] : []
      }))
    }
    room.imagensSalvas = new Set(salva.imagens.keys())
  }
  for (const m of lista) {
    room.players.set(m.id, { id: m.id, name: m.nome, status: 'offline', role: papelDaSala(room, m.id) })
  }
  /* A ficha pode ter mudado com o servidor desligado, ou entrado na campanha com a mesa fechada. */
  await revalidarVinculos(room)
  await criarTokensDasFichas(room)
  return room
}
function papelDaSala(room: RoomState, usuarioId: string): RoomPlayer['role'] {
  if (usuarioId === room.mestreId) return 'gm'
  return room.espectadores.has(usuarioId) ? 'spectator' : 'player'
}
async function obterSala(campanhaId: string) {
  const existente = rooms.get(campanhaId)
  if (existente) {
    if (existente.cleanupTimer) clearTimeout(existente.cleanupTimer)
    existente.cleanupTimer = undefined
    return existente
  }
  let promessa = carregando.get(campanhaId)
  if (!promessa) {
    promessa = carregarSala(campanhaId).then((room) => {
      rooms.set(campanhaId, room)
      carregando.delete(campanhaId)
      return room
    }, (error) => {
      carregando.delete(campanhaId)
      throw error
    })
    carregando.set(campanhaId, promessa)
  }
  return promessa
}

/* Quem saiu da campanha sai da mesa na hora, e quem entrou já pode receber tokens. */
async function sincronizarMembros(room: RoomState) {
  const lista = await lerMembros(room.code)
  const ids = new Set(lista.map((m) => m.id))
  for (const player of [...room.players.values()]) {
    if (ids.has(player.id)) continue
    for (const socketId of room.connections.get(player.id) ?? []) {
      io.to(socketId).emit('room:event', { type: 'player:kicked' })
      io.sockets.sockets.get(socketId)?.disconnect(true)
    }
    room.connections.delete(player.id)
    room.players.delete(player.id)
    room.espectadores.delete(player.id)
    room.privateMessages.delete(player.id)
    room.ultimoPing.delete(player.id)
    for (const [id, token] of room.tokens) {
      if (token.ownerIds.includes(player.id)) room.tokens.set(id, { ...token, ownerIds: token.ownerIds.filter((dono) => dono !== player.id) })
    }
    marcarSuja(room)
  }
  for (const m of lista) {
    const atual = room.players.get(m.id)
    room.players.set(m.id, atual ? { ...atual, name: m.nome } : { id: m.id, name: m.nome, status: 'offline', role: papelDaSala(room, m.id) })
  }
  await revalidarVinculos(room)
  await criarTokensDasFichas(room)
  broadcastPlayers(room)
  broadcastSnapshots(room)
}

function encerrarSalaApagada(campanhaId: string) {
  const room = rooms.get(campanhaId)
  if (!room) return
  room.apagada = true
  if (room.timerSalvar) clearTimeout(room.timerSalvar)
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
  rooms.delete(campanhaId)
  io.to(campanhaId).emit('room:event', { type: 'room:denied' })
  io.in(campanhaId).disconnectSockets(true)
}

function aoEvento(evento: EventoMesa) {
  if (evento.tipo === 'ficha') {
    io.to(`ficha:${evento.fichaId}`).emit('ficha:mudou', evento.fichaId)
    const room = evento.campanhaId ? rooms.get(evento.campanhaId) : undefined
    if (room) void enfileirar(room, async () => {
      await sincronizarFicha(room, evento.fichaId)
      broadcast(room, { type: 'ficha:atualizada', fichaId: evento.fichaId })
    })
    return
  }
  if (evento.tipo === 'campanha-apagada') { encerrarSalaApagada(evento.campanhaId); return }
  const room = rooms.get(evento.campanhaId)
  if (!room) return
  if (evento.tipo === 'campanha') { void enfileirar(room, () => sincronizarMembros(room)); return }
  addPublicMessage(room, rolagemParaChat(evento.linha))
}

function lerCookie(cabecalho: string | undefined) {
  for (const parte of (cabecalho ?? '').split(';')) {
    const [nome, valor] = parte.trim().split('=')
    if (nome === COOKIE) return valor
  }
  return undefined
}

/* O cookie é SameSite=Lax, mas conferir a origem protege também navegadores antigos: só o próprio site abre o socket. */
function mesmaOrigem(origem: string | undefined, host: string | string[] | undefined, hostEncaminhado: string | string[] | undefined) {
  if (!origem) return true
  try { return new URL(origem).host === (hostEncaminhado ?? host) }
  catch { return false }
}

export function anexarMesa(httpServer: HttpServer) {
  io = new Server(httpServer, {
    maxHttpBufferSize: 1_048_576,
    /* Deixa o recarregamento do Next em desenvolvimento usar as outras conexões. */
    destroyUpgrade: false,
    allowRequest: (req, callback) => callback(null, mesmaOrigem(req.headers.origin, req.headers.host, req.headers['x-forwarded-host'])),
  })

  io.use(async (socket, next) => {
    try {
      const token = lerCookie(socket.handshake.headers.cookie)
      const usuario = await usuarioDoToken(token)
      if (!usuario || !token) { next(new Error('nao-autenticado')); return }
      socket.data.usuario = { id: usuario.id, nome: usuario.nome }
      socket.data.token = token
      next()
    } catch (error) {
      console.error(error)
      next(new Error('erro-interno'))
    }
  })

  const pararOuvir = ouvirMesa(aoEvento)

  /* Sair da conta ou trocar a senha apaga a sessão: a conexão aberta não pode continuar valendo. */
  const conferirSessoes = setInterval(() => {
    void (async () => {
      for (const socket of await io.fetchSockets()) {
        const local = io.sockets.sockets.get(socket.id)
        if (local && !(await usuarioDoToken(local.data.token))) local.disconnect(true)
      }
    })().catch((error) => console.error(error))
  }, INTERVALO_SESSAO_MS)
  conferirSessoes.unref?.()

  io.on('connection', (socket) => {
    const client = socket as TableSocket
    const usuario = client.data.usuario

    client.on('room:join', async (dados) => {
      try {
        const entrada = esquemaEntrada.safeParse(dados)
        const acesso = entrada.success ? await lerAcesso(entrada.data.campanhaId, usuario.id) : null
        if (!entrada.success || !acesso) { client.emit('room:event', { type: 'room:denied' }); return }
        const campanhaId = entrada.data.campanhaId
        const room = await obterSala(campanhaId)
        if (room.removedPlayers.has(usuario.id)) { client.emit('room:event', { type: 'player:kicked' }); return }
        if (client.data.campanhaId) void client.leave(client.data.campanhaId)
        client.data.campanhaId = campanhaId
        void client.join(campanhaId)
        void client.join(playerRoom(campanhaId, usuario.id))
        room.mestreId = acesso.mestreId
        const player: RoomPlayer = { id: usuario.id, name: usuario.nome, status: 'connected', role: papelDaSala(room, usuario.id) }
        room.players.set(usuario.id, player)
        const connections = room.connections.get(usuario.id) ?? new Set<string>()
        connections.add(client.id)
        room.connections.set(usuario.id, connections)
        client.emit('room:snapshot', room.snapshot(player), client.id)
        broadcastPlayers(room)
      } catch (error) {
        console.error(error)
        client.emit('room:event', { type: 'chat:error', text: 'Não consegui abrir a mesa. Recarregue a página.' })
      }
    })

    client.on('room:command', (value) => {
      const campanhaId = client.data.campanhaId
      if (!campanhaId) return
      const comando = esquemaComando.safeParse(value)
      if (!comando.success) return
      const room = rooms.get(campanhaId)
      if (!room) return
      void enfileirar(room, async () => {
        const player = room.players.get(usuario.id)
        if (player?.status !== 'connected') return
        const mensagem = comando.data as RoomCommand
        await handleCommand(client, room, player, mensagem)
        if (mensagem.type !== 'chat:send' && mensagem.type !== 'chat:roll' && mensagem.type !== 'ficha:rolar') marcarSuja(room)
      })
    })

    /* A página da ficha também acompanha pelo socket, com a mesma regra de quem pode editar. */
    client.on('ficha:observar', async (fichaId) => {
      try {
        if (typeof fichaId !== 'string' || fichaId.length > 80) return
        const ficha = await lerFicha(fichaId)
        if (!ficha) return
        const pode = ficha.donoId === usuario.id || (ficha.campanhaId && (await campanhaExiste(ficha.campanhaId))?.mestreId === usuario.id)
        if (pode) void client.join(`ficha:${fichaId}`)
      } catch (error) { console.error(error) }
    })

    client.on('disconnect', () => {
      const code = client.data.campanhaId; if (!code) return
      const room = rooms.get(code); if (!room) return
      const connections = room.connections.get(usuario.id)
      connections?.delete(client.id)
      if (!connections?.size) {
        room.connections.delete(usuario.id)
        const previous = room.players.get(usuario.id)
        if (previous) room.players.set(usuario.id, { ...previous, status: 'offline' })
        room.lastMoveAt.delete(usuario.id)
        broadcastPlayers(room)
      }
      void io.in(code).fetchSockets().then((sockets) => {
        if (sockets.length !== 0) return
        room.cleanupTimer = setTimeout(() => {
          void enfileirar(room, () => salvarSala(room)).then(() => { if (rooms.get(code) === room && !room.connections.size) rooms.delete(code) })
        }, ROOM_TTL_MS)
        room.cleanupTimer.unref?.()
      })
    })
  })

  return async function encerrarMesa() {
    pararOuvir()
    clearInterval(conferirSessoes)
    await Promise.all([...rooms.values()].map((room) => enfileirar(room, () => salvarSala(room))))
    await io.close()
  }
}
