export type Token = {
  id: string
  name: string
  x: number
  y: number
  /* Largura, em células. Sem `altura`, o token é tão alto quanto largo, como os tokens antigos. */
  size: number
  altura?: number
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
  /* Versão da foto da ficha vinculada. Só o servidor preenche, e 0 é ficha sem foto. */
  fotoFichaV?: number
  /* O jogador não recebe a foto de ficha privada do mestre. */
  fotoFichaPrivada?: boolean
  /* O token nasceu sozinho com a ficha: sai da mesa quando ela sai da campanha. */
  automatico?: boolean
  condicoes?: string[]
  /* O nome acompanha o da ficha até alguém renomear o token. */
  nomeDaFicha?: boolean
  ownerIds: string[]
  hidden: boolean
  createdByPlayerKey?: string
}

export type TokenSprite = {
  id: string
  label: string
  imageUrl: string
}

export type LegacyImageToken = Omit<
  Token,
  | 'spriteIds'
  | 'activeSpriteId'
  | 'flipX'
  | 'ownerIds'
  | 'hidden'
  | 'createdByPlayerKey'
> & {
  imageUrl?: string
  spriteIds?: string[]
  activeSpriteId?: string | null
  flipX?: boolean
  ownerIds?: string[]
  hidden?: boolean
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
      ownerIds: token.ownerIds ?? [],
      hidden: token.hidden ?? false,
    } satisfies Token,
    sprites: sprite ? [sprite] : [],
  }
}

export type TokenPosition = Pick<Token, 'x' | 'y'>

export const CONDICOES = ['Envenenado', 'Caído', 'Atordoado', 'Paralisado', 'Cego', 'Queimando', 'Sangrando', 'Amedrontado', 'Inconsciente', 'Fortalecido'] as const
export const TAMANHO_MINIMO = 0.25
export const TAMANHO_MAXIMO = 10
export const alturaDoToken = (token: Pick<Token, 'size' | 'altura'>) => token.altura ?? token.size

/* Com a ficha vinculada, a foto dela é a imagem do token. Sem foto, valem os sprites do próprio token. */
export function spriteDoToken(token: Token, sprites: readonly TokenSprite[] = []): TokenSprite | undefined {
  if (token.characterId && token.fotoFichaV) {
    return { id: `ficha-${token.characterId}-${token.fotoFichaV}`, label: 'Foto da ficha', imageUrl: `/api/fichas/${token.characterId}/foto?v=${token.fotoFichaV}` }
  }
  return token.activeSpriteId ? sprites.find((sprite) => sprite.id === token.activeSpriteId) : undefined
}
