import { create } from 'zustand'
import type {
  Token,
  TokenPosition,
  TokenSprite,
  VagaImagem,
  AjusteImagem,
} from '@mesa/features/tokens/token-types'
import { alturaDoToken } from '@mesa/features/tokens/token-types'
import {
  isRoomMode,
  sendRoomCommand,
  sendRoomMove,
} from '@mesa/features/rooms/room-commands'
import { fileToRoomImage } from '@mesa/features/rooms/image-serializer'
import type { RoomTokenChanges } from '@mesa/shared/room-protocol'

const tokenColors = [
  '#5a54b8',
  '#7a4fc0',
  '#3f6fc4',
  '#6a4fb0',
  '#4f7fd0',
  '#3f5fae',
  '#8058c8',
  '#4a4aa8',
]
let nextTokenNumber = 1
type OriginalDaImagem = { imagem: string | null; ajuste: AjusteImagem | null }
/* O original não vem com o token, para não pesar a mesa de todos: é pedido só na hora de reajustar. */
const esperandoOriginal = new Map<string, (dados: OriginalDaImagem | null) => void>()

type TokenState = {
  tokens: Token[]
  spritesByTokenId: Record<string, TokenSprite[]>
  selectedTokenId: string | null
  addToken: (position: TokenPosition) => Token
  updateToken: (id: string, changes: Partial<Omit<Token, 'id'>>) => void
  definirImagem: (tokenId: string, vaga: VagaImagem, rotulo: string, file: File, reajuste: { imagem: string | null; ajuste: AjusteImagem }) => void
  pedirOriginal: (tokenId: string, spriteId: string) => Promise<OriginalDaImagem | null>
  receberOriginal: (spriteId: string, dados: OriginalDaImagem) => void
  removeTokenSprite: (tokenId: string, spriteId: string) => void
  updateTokenPosition: (id: string, position: TokenPosition) => void
  snapTokenToGrid: (id: string, cellSize: number) => void
  snapTokensToGrid: (cellSize: number) => void
  removeToken: (id: string) => void
  selectToken: (id: string | null) => void
  applyRoomSnapshot: (
    tokens: Token[],
    spritesByTokenId: Record<string, TokenSprite[]>,
  ) => void
  applyRoomToken: (token: Token, sprites: TokenSprite[]) => void
  removeRoomToken: (id: string) => void
  applyRoomPosition: (id: string, position: TokenPosition) => void
}

function snapCenter(value: number, size: number, cellSize: number) {
  return (Math.round(value / cellSize - size / 2) + size / 2) * cellSize
}

export const useTokenStore = create<TokenState>((set) => ({
  tokens: [],
  spritesByTokenId: {},
  selectedTokenId: null,
  addToken: (position) => {
    const token: Token = {
      id: crypto.randomUUID(),
      name: `Token ${nextTokenNumber++}`,
      ...position,
      size: 1,
      rotation: 0,
      spriteIds: [],
      activeSpriteId: null,
      flipX: false,
      color: tokenColors[Math.floor(Math.random() * tokenColors.length)],
      ownerIds: [],
      hidden: false,
    }
    if (sendRoomCommand({ type: 'token:create', token, sprites: [] }))
      return token
    set((state) => ({
      tokens: [...state.tokens, token],
      spritesByTokenId: { ...state.spritesByTokenId, [token.id]: [] },
      selectedTokenId: token.id,
    }))
    return token
  },
  updateToken: (id, changes) => {
    if (isRoomMode()) {
      const roomChanges = Object.fromEntries(
        Object.entries(changes).map(([key, value]) => [
          key,
          value === undefined ? null : value,
        ]),
      ) as RoomTokenChanges
      sendRoomCommand({ type: 'token:update', id, changes: roomChanges })
      return
    }
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === id ? { ...token, ...changes } : token,
      ),
    }))
  },
  pedirOriginal: (tokenId, spriteId) => new Promise((resolver) => {
    const fim = setTimeout(() => { esperandoOriginal.delete(spriteId); resolver(null) }, 10_000)
    esperandoOriginal.set(spriteId, (dados) => { clearTimeout(fim); esperandoOriginal.delete(spriteId); resolver(dados) })
    if (!sendRoomCommand({ type: 'token:sprite:pedir-original', id: tokenId, spriteId })) esperandoOriginal.get(spriteId)?.(null)
  }),
  receberOriginal: (spriteId, dados) => esperandoOriginal.get(spriteId)?.(dados),
  definirImagem: (tokenId, vaga, rotulo, file, reajuste) => {
    void (async () => {
      try {
        const sprite: TokenSprite = { id: crypto.randomUUID(), label: rotulo, imageUrl: await fileToRoomImage(file) }
        sendRoomCommand({ type: 'token:sprite:add', id: tokenId, sprite, vaga })
        /* Em outro comando: os dois juntos poderiam passar do limite de uma mensagem. */
        if (reajuste.imagem) sendRoomCommand({ type: 'token:sprite:original', id: tokenId, spriteId: sprite.id, imagem: reajuste.imagem, ajuste: reajuste.ajuste })
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Não foi possível preparar a imagem.')
      }
    })()
  },
  removeTokenSprite: (tokenId, spriteId) => {
    if (isRoomMode()) {
      sendRoomCommand({ type: 'token:sprite:remove', id: tokenId, spriteId })
      return
    }
    set((state) => {
      const sprites = state.spritesByTokenId[tokenId] ?? []
      const removed = sprites.find((sprite) => sprite.id === spriteId)
      if (removed?.imageUrl.startsWith('blob:'))
        URL.revokeObjectURL(removed.imageUrl)
      const remaining = sprites.filter((sprite) => sprite.id !== spriteId)
      return {
        spritesByTokenId: { ...state.spritesByTokenId, [tokenId]: remaining },
        tokens: state.tokens.map((token) => {
          if (token.id !== tokenId) return token
          const spriteIds = token.spriteIds.filter((id) => id !== spriteId)
          return {
            ...token,
            spriteIds,
            activeSpriteId:
              token.activeSpriteId === spriteId
                ? (spriteIds[0] ?? null)
                : token.activeSpriteId,
          }
        }),
      }
    })
  },
  updateTokenPosition: (id, position) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === id ? { ...token, ...position } : token,
      ),
    }))
    sendRoomMove(id, position)
  },
  snapTokenToGrid: (id, cellSize) => {
    const token = useTokenStore.getState().tokens.find((item) => item.id === id)
    if (!token) return
    const position = {
      x: snapCenter(token.x, token.size, cellSize),
      y: snapCenter(token.y, alturaDoToken(token), cellSize),
    }
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === id
          ? {
              ...token,
              ...position,
            }
          : token,
      ),
    }))
    sendRoomMove(id, position, true)
  },
  snapTokensToGrid: (cellSize) => {
    if (isRoomMode()) return
    set((state) => ({
      tokens: state.tokens.map((token) => ({
        ...token,
        x: snapCenter(token.x, token.size, cellSize),
        y: snapCenter(token.y, alturaDoToken(token), cellSize),
      })),
    }))
  },
  removeToken: (id) => {
    if (sendRoomCommand({ type: 'token:remove', id })) return
    set((state) => {
      for (const sprite of state.spritesByTokenId[id] ?? []) {
        if (sprite.imageUrl.startsWith('blob:'))
          URL.revokeObjectURL(sprite.imageUrl)
      }
      return {
        tokens: state.tokens.filter((token) => token.id !== id),
        spritesByTokenId: Object.fromEntries(
          Object.entries(state.spritesByTokenId).filter(
            ([tokenId]) => tokenId !== id,
          ),
        ),
        selectedTokenId:
          state.selectedTokenId === id ? null : state.selectedTokenId,
      }
    })
  },
  selectToken: (selectedTokenId) => set({ selectedTokenId }),
  applyRoomSnapshot: (tokens, spritesByTokenId) =>
    set((state) => ({
      tokens,
      spritesByTokenId,
      selectedTokenId: tokens.some(
        (token) => token.id === state.selectedTokenId,
      )
        ? state.selectedTokenId
        : null,
    })),
  applyRoomToken: (token, sprites) =>
    set((state) => ({
      tokens: state.tokens.some((item) => item.id === token.id)
        ? state.tokens.map((item) => (item.id === token.id ? token : item))
        : [...state.tokens, token],
      spritesByTokenId: { ...state.spritesByTokenId, [token.id]: sprites },
    })),
  removeRoomToken: (id) =>
    set((state) => ({
      tokens: state.tokens.filter((token) => token.id !== id),
      spritesByTokenId: Object.fromEntries(
        Object.entries(state.spritesByTokenId).filter(
          ([tokenId]) => tokenId !== id,
        ),
      ),
      selectedTokenId:
        state.selectedTokenId === id ? null : state.selectedTokenId,
    })),
  applyRoomPosition: (id, position) =>
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === id ? { ...token, ...position } : token,
      ),
    })),
}))
