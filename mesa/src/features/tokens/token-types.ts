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
  /* Ficha privada do mestre: o jogador não recebe o nome dela. Só o servidor preenche. */
  fotoFichaPrivada?: boolean
  /* O token nasceu sozinho com a ficha: sai da mesa quando ela sai da campanha. */
  automatico?: boolean
  condicoes?: string[]
  /* Imagem Machucado: aparece abaixo da metade da vida. Fica fora das imagens normais. */
  spriteSangrandoId?: string
  /* Imagem Armado: aparece com `armado` ligado, se o token não estiver machucado. */
  spriteArmadoId?: string
  armado?: boolean
  /* Só o servidor preenche, para quem não recebe a vida deste token. */
  sangrando?: boolean
  /* O nome acompanha o da ficha até alguém renomear o token. */
  nomeDaFicha?: boolean
  ownerIds: string[]
  hidden: boolean
  createdByPlayerKey?: string
  /* O cenário onde o token foi solto: aparece e se move com ele. Só o servidor preenche, e token de jogador não tem. */
  cenarioId?: string
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

export type VagaImagem = 'normal' | 'machucado' | 'armado'
/* Como a imagem foi ajustada, para reabrir a janela do mesmo jeito. */
export type AjusteImagem = { zoom: number; x: number; y: number; forca: number }
export function idDaVaga(token: Pick<Token, 'activeSpriteId' | 'spriteSangrandoId' | 'spriteArmadoId'>, vaga: VagaImagem) {
  if (vaga === 'machucado') return token.spriteSangrandoId
  if (vaga === 'armado') return token.spriteArmadoId
  return token.activeSpriteId ?? undefined
}

export function estaSangrando(token: Pick<Token, 'hpCurrent' | 'hpMax' | 'sangrando'>) {
  if (token.sangrando !== undefined) return token.sangrando
  return token.hpMax !== undefined && token.hpMax > 0 && token.hpCurrent !== undefined && token.hpCurrent < token.hpMax / 2
}

/* O machucado vem primeiro: todos precisam ver que o token está ferido, mesmo armado. */
export function spriteDoToken(token: Token, sprites: readonly TokenSprite[] = []): TokenSprite | undefined {
  const daVaga = (vaga: VagaImagem) => sprites.find((sprite) => sprite.id === idDaVaga(token, vaga))
  return (estaSangrando(token) ? daVaga('machucado') : undefined) ?? (token.armado ? daVaga('armado') : undefined) ?? daVaga('normal')
}
