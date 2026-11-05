import { create } from 'zustand'
import type {
  Token,
  TokenPosition,
  TokenSprite,
} from '@/features/tokens/token-types'

const tokenColors = [
  '#806247',
  '#77565c',
  '#586b63',
  '#655b7c',
  '#8a7045',
  '#4f6874',
  '#7b684f',
  '#6d5847',
]
let nextTokenNumber = 1

type TokenState = {
  tokens: Token[]
  spritesByTokenId: Record<string, TokenSprite[]>
  selectedTokenId: string | null
  addToken: (position: TokenPosition) => Token
  updateToken: (id: string, changes: Partial<Omit<Token, 'id'>>) => void
  addTokenSprites: (tokenId: string, files: File[]) => void
  renameTokenSprite: (tokenId: string, spriteId: string, label: string) => void
  selectTokenSprite: (tokenId: string, spriteId: string) => void
  removeTokenSprite: (tokenId: string, spriteId: string) => void
  updateTokenPosition: (id: string, position: TokenPosition) => void
  snapTokenToGrid: (id: string, cellSize: number) => void
  snapTokensToGrid: (cellSize: number) => void
  removeToken: (id: string) => void
  selectToken: (id: string | null) => void
}

function snapCenter(value: number, size: Token['size'], cellSize: number) {
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
    }
    set((state) => ({
      tokens: [...state.tokens, token],
      spritesByTokenId: { ...state.spritesByTokenId, [token.id]: [] },
      selectedTokenId: token.id,
    }))
    return token
  },
  updateToken: (id, changes) =>
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === id ? { ...token, ...changes } : token,
      ),
    })),
  addTokenSprites: (tokenId, files) =>
    set((state) => {
      const token = state.tokens.find((item) => item.id === tokenId)
      if (!token) return state
      const added = files.map((file): TokenSprite => ({
        id: crypto.randomUUID(),
        label: file.name.replace(/\.[^.]+$/, '').trim() || 'Sprite',
        imageUrl: URL.createObjectURL(file),
      }))
      const sprites = [...(state.spritesByTokenId[tokenId] ?? []), ...added]
      const spriteIds = [
        ...token.spriteIds,
        ...added.map((sprite) => sprite.id),
      ]
      return {
        spritesByTokenId: { ...state.spritesByTokenId, [tokenId]: sprites },
        tokens: state.tokens.map((item) =>
          item.id === tokenId
            ? {
                ...item,
                spriteIds,
                activeSpriteId: item.activeSpriteId ?? added[0]?.id ?? null,
              }
            : item,
        ),
      }
    }),
  renameTokenSprite: (tokenId, spriteId, label) =>
    set((state) => ({
      spritesByTokenId: {
        ...state.spritesByTokenId,
        [tokenId]: (state.spritesByTokenId[tokenId] ?? []).map((sprite) =>
          sprite.id === spriteId ? { ...sprite, label } : sprite,
        ),
      },
    })),
  selectTokenSprite: (tokenId, spriteId) =>
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId && token.spriteIds.includes(spriteId)
          ? { ...token, activeSpriteId: spriteId }
          : token,
      ),
    })),
  removeTokenSprite: (tokenId, spriteId) =>
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
    }),
  updateTokenPosition: (id, position) =>
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === id ? { ...token, ...position } : token,
      ),
    })),
  snapTokenToGrid: (id, cellSize) =>
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === id
          ? {
              ...token,
              x: snapCenter(token.x, token.size, cellSize),
              y: snapCenter(token.y, token.size, cellSize),
            }
          : token,
      ),
    })),
  snapTokensToGrid: (cellSize) =>
    set((state) => ({
      tokens: state.tokens.map((token) => ({
        ...token,
        x: snapCenter(token.x, token.size, cellSize),
        y: snapCenter(token.y, token.size, cellSize),
      })),
    })),
  removeToken: (id) =>
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
    }),
  selectToken: (selectedTokenId) => set({ selectedTokenId }),
}))
