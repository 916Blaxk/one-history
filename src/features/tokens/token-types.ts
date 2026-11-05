export type Token = {
  id: string
  name: string
  x: number
  y: number
  size: 1 | 2 | 3 | 4
  rotation: number
  spriteIds: string[]
  activeSpriteId: string | null
  flipX: boolean
  color: string
  hpCurrent?: number
  hpMax?: number
  manaCurrent?: number
  manaMax?: number
  characterId?: string
}

export type TokenSprite = {
  id: string
  label: string
  imageUrl: string
}

export type LegacyImageToken = Omit<
  Token,
  'spriteIds' | 'activeSpriteId' | 'flipX'
> & {
  imageUrl?: string
  spriteIds?: string[]
  activeSpriteId?: string | null
  flipX?: boolean
}

export function migrateLegacyToken(token: LegacyImageToken) {
  const imageUrl = token.imageUrl
  const properties = { ...token }
  delete properties.imageUrl
  delete properties.spriteIds
  delete properties.activeSpriteId
  delete properties.flipX
  const sprite = imageUrl
    ? { id: crypto.randomUUID(), label: 'Padrão', imageUrl }
    : undefined
  return {
    token: {
      ...properties,
      spriteIds: sprite ? [sprite.id] : [],
      activeSpriteId: sprite?.id ?? null,
      flipX: token.flipX ?? false,
    } satisfies Token,
    sprites: sprite ? [sprite] : [],
  }
}

export type TokenPosition = Pick<Token, 'x' | 'y'>
