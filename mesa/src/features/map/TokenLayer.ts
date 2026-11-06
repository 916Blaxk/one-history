import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { alturaDoToken, type Token, type TokenSprite } from '@mesa/features/tokens/token-types'

type AlphaMask = { data: Uint8ClampedArray; width: number; height: number }
const LARGURA_BOTAO = 42
const ALTURA_BOTAO = 28

export type TokenView = {
  root: Container
  circle: Graphics
  initials: Text
  direction: Container
  shadow: Graphics
  sprite: Sprite
  selection: Graphics
  ownerMark: Graphics
  health: Graphics
  label: Text
  condicoes: Text
  turno: Graphics
  flipButton: Graphics
  armadoButton: Graphics
  flipButtonY: number
  texture: Texture | null
  alphaMask: AlphaMask | null
  imageUrl: string | undefined
  activeSpriteId: string | null
  imageVersion: number
}

export function createTokenView() {
  const root = new Container()
  const shadow = new Graphics()
  const direction = new Container()
  const directionMark = new Graphics()
    .moveTo(0, -8)
    .lineTo(5, 2)
    .lineTo(0, 0)
    .lineTo(-5, 2)
    .closePath()
    .fill({ color: 0x8fb6ff, alpha: 0.8 })
  direction.addChild(directionMark)
  const circle = new Graphics()
  const sprite = new Sprite(Texture.EMPTY)
  const initials = new Text({
    text: '',
    style: {
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 32,
      fill: 0xffffff,
      fontWeight: '600',
    },
  })
  const selection = new Graphics()
  const ownerMark = new Graphics()
  const health = new Graphics()
  const flipButton = new Graphics()
  const armadoButton = new Graphics()
  const turno = new Graphics()
  const condicoes = new Text({
    text: '',
    style: {
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 12,
      fill: 0xc9bcff,
      stroke: { color: 0x0a0b20, width: 3 },
    },
  })
  condicoes.anchor.set(0.5, 0)
  const label = new Text({
    text: '',
    style: {
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 14,
      fill: 0xece9ff,
      stroke: { color: 0x0a0b20, width: 3 },
    },
  })

  sprite.anchor.set(0.5, 1)
  sprite.position.set(0, 0)
  sprite.visible = false
  initials.anchor.set(0.5)
  label.anchor.set(0.5, 0)
  root.addChild(
    turno,
    shadow,
    circle,
    direction,
    sprite,
    initials,
    selection,
    ownerMark,
    health,
    label,
    condicoes,
    flipButton,
    armadoButton,
  )

  return {
    root,
    circle,
    initials,
    direction,
    shadow,
    sprite,
    selection,
    ownerMark,
    health,
    label,
    condicoes,
    turno,
    flipButton,
    armadoButton,
    flipButtonY: 0,
    texture: null,
    alphaMask: null,
    imageUrl: undefined,
    activeSpriteId: null,
    imageVersion: 0,
  } satisfies TokenView
}

export function updateTokenView(
  view: TokenView,
  token: Token,
  sprite: TokenSprite | undefined,
  cellSize: number,
  selectedId: string | null,
  zoom: number,
  playerKey?: string | null,
  canEdit = true,
  naVez = false,
) {
  const diameter = token.size * cellSize
  const radius = diameter / 2
  const alturaBase = alturaDoToken(token) * cellSize
  const radiusY = alturaBase / 2
  const hasImage = Boolean(
    sprite &&
    view.sprite.visible &&
    view.activeSpriteId === sprite.id &&
    view.imageUrl === sprite.imageUrl,
  )
  const color = Number.parseInt(token.color.replace('#', ''), 16)
  view.root.position.set(token.x, token.y)
  view.circle.clear()
  if (!hasImage) view.circle.ellipse(0, 0, radius, radiusY).fill(color)

  view.direction.position.set(0, hasImage ? cellSize * 0.1 : -cellSize * 0.28)
  view.direction.rotation = (token.rotation * Math.PI) / 180
  view.direction.scale.set(cellSize / 70)
  view.shadow.clear()
  if (hasImage)
    view.shadow
      .ellipse(0, 0, diameter * 0.34, cellSize * 0.12)
      .fill({ color: 0x070818, alpha: 0.46 })

  if (view.texture && hasImage) {
    view.sprite.width = diameter
    view.sprite.height = alturaBase * (view.texture.height / view.texture.width)
    view.sprite.scale.x = Math.abs(view.sprite.scale.x) * (token.flipX ? -1 : 1)
  }
  view.initials.text = token.name.trim().charAt(0).toLocaleUpperCase() || '?'
  view.initials.style.fontSize = Math.max(14, Math.min(diameter, alturaBase) * 0.46)
  view.initials.visible = !hasImage

  view.turno.clear()
  if (naVez) {
    view.turno
      .ellipse(0, 0, radius + 7 / zoom, radiusY + 7 / zoom)
      .fill({ color: 0x6fe39a, alpha: 0.22 })
      .stroke({ color: 0x6fe39a, width: 3 / zoom })
  }

  view.selection.clear()
  if (selectedId === token.id) {
    if (sprite)
      view.selection
        .ellipse(0, 0, diameter * 0.4, cellSize * 0.19)
        .stroke({ color: 0x8fb6ff, width: 2 / zoom })
    else
      view.selection
        .ellipse(0, 0, radius, radiusY)
        .stroke({ color: 0x8fb6ff, width: 2 / zoom })
  }
  view.ownerMark.clear()
  if (playerKey && token.ownerIds.includes(playerKey)) {
    view.ownerMark
      .circle(radius * 0.62, radiusY * 0.62, Math.max(3, 5 / zoom))
      .fill({ color: 0x14153a, alpha: 0.9 })
    view.ownerMark
      .circle(radius * 0.62, radiusY * 0.62, Math.max(2, 3.2 / zoom))
      .fill(0x8fb6ff)
  }

  const belowBase = radiusY + 5
  const hasHealth = token.hpMax !== undefined && token.hpMax > 0
  const hasMana = token.manaMax !== undefined && token.manaMax > 0
  view.health.clear()
  const barWidth = Math.min(54, Math.max(34, diameter * 0.8))
  const barHeight = 5 / zoom
  const drawResourceBar = (y: number, ratio: number, color: number) => {
    view.health
      .roundRect(-barWidth / 2, y, barWidth, barHeight, barHeight / 2)
      .fill({ color: 0x14153a, alpha: 0.9 })
    if (ratio > 0)
      view.health
        .roundRect(-barWidth / 2, y, barWidth * ratio, barHeight, barHeight / 2)
        .fill(color)
  }
  let barIndex = 0
  if (hasHealth && token.hpMax) {
    const ratio = Math.max(
      0,
      Math.min(1, (token.hpCurrent ?? token.hpMax) / token.hpMax),
    )
    drawResourceBar(belowBase + (barIndex * 8) / zoom, ratio, 0x55b879)
    barIndex += 1
  }
  if (hasMana && token.manaMax) {
    const ratio = Math.max(
      0,
      Math.min(1, (token.manaCurrent ?? token.manaMax) / token.manaMax),
    )
    drawResourceBar(belowBase + (barIndex * 8) / zoom, ratio, 0x5794e8)
    barIndex += 1
  }
  view.label.text = token.name
  view.label.position.set(0, belowBase + (barIndex * 8) / zoom)
  view.label.style.fontSize = Math.max(12, Math.min(16, 14 / zoom))
  view.condicoes.text = token.condicoes?.join(' · ') ?? ''
  view.condicoes.style.fontSize = Math.max(11, Math.min(14, 12 / zoom))
  view.condicoes.position.set(0, view.label.position.y + Math.max(view.label.height, 16 / zoom))
  const alturaCondicoes = token.condicoes?.length ? view.condicoes.height : 0
  view.flipButton.clear()
  view.armadoButton.clear()
  view.flipButton.visible = canEdit && selectedId === token.id && hasImage
  view.armadoButton.visible = canEdit && selectedId === token.id && Boolean(token.spriteArmadoId)
  const width = LARGURA_BOTAO / zoom
  const height = ALTURA_BOTAO / zoom
  const y =
    view.label.position.y + Math.max(view.label.height, 16 / zoom) + alturaCondicoes + 5 / zoom
  view.flipButtonY = y
  /* Um botão fica no meio; os dois ficam lado a lado. */
  const doisBotoes = view.flipButton.visible && view.armadoButton.visible
  view.flipButton.position.x = doisBotoes ? -(width / 2 + 3 / zoom) : 0
  view.armadoButton.position.x = doisBotoes ? width / 2 + 3 / zoom : 0
  if (view.flipButton.visible) {
    view.flipButton
      .roundRect(-width / 2, y, width, height, 6 / zoom)
      .fill({ color: 0x14153a, alpha: 0.94 })
      .stroke({ color: 0x6a6fd8, alpha: 0.9, width: 1.5 / zoom })
    const iconY = y + height / 2
    view.flipButton
      .moveTo(-9 / zoom, iconY - 4 / zoom)
      .lineTo(-3 / zoom, iconY - 4 / zoom)
      .lineTo(-3 / zoom, iconY + 4 / zoom)
      .lineTo(-9 / zoom, iconY + 4 / zoom)
      .moveTo(9 / zoom, iconY - 4 / zoom)
      .lineTo(3 / zoom, iconY - 4 / zoom)
      .lineTo(3 / zoom, iconY + 4 / zoom)
      .lineTo(9 / zoom, iconY + 4 / zoom)
      .stroke({ color: 0x8fb6ff, width: 1.5 / zoom })
    view.flipButton
      .moveTo(-12 / zoom, iconY)
      .lineTo(-7 / zoom, iconY - 3 / zoom)
      .moveTo(-12 / zoom, iconY)
      .lineTo(-7 / zoom, iconY + 3 / zoom)
      .moveTo(12 / zoom, iconY)
      .lineTo(7 / zoom, iconY - 3 / zoom)
      .moveTo(12 / zoom, iconY)
      .lineTo(7 / zoom, iconY + 3 / zoom)
      .stroke({ color: 0x8fb6ff, width: 1.5 / zoom })
  }
  if (view.armadoButton.visible) {
    /* Aceso quando o token está armado: dá para ver o estado sem abrir o painel. */
    const iconY = y + height / 2
    view.armadoButton
      .roundRect(-width / 2, y, width, height, 6 / zoom)
      .fill({ color: token.armado ? 0x8fb6ff : 0x14153a, alpha: 0.94 })
      .stroke({ color: 0x6a6fd8, alpha: 0.9, width: 1.5 / zoom })
    view.armadoButton
      .moveTo(-7 / zoom, iconY - 7 / zoom)
      .lineTo(7 / zoom, iconY + 7 / zoom)
      .moveTo(7 / zoom, iconY - 7 / zoom)
      .lineTo(-7 / zoom, iconY + 7 / zoom)
      .moveTo(-7 / zoom, iconY + 2 / zoom)
      .lineTo(-2 / zoom, iconY + 7 / zoom)
      .moveTo(7 / zoom, iconY + 2 / zoom)
      .lineTo(2 / zoom, iconY + 7 / zoom)
      .stroke({ color: token.armado ? 0x14153a : 0x8fb6ff, width: 1.8 / zoom })
  }
}

function acertouBotao(button: Graphics, buttonY: number, token: Token, x: number, y: number, zoom: number) {
  if (!button.visible) return false
  const localX = x - token.x - button.position.x
  const localY = y - token.y
  return Math.abs(localX) <= LARGURA_BOTAO / zoom / 2 && localY >= buttonY && localY <= buttonY + ALTURA_BOTAO / zoom
}

export function tokenFlipButtonHitTest(
  view: TokenView | undefined,
  token: Token,
  x: number,
  y: number,
  zoom: number,
) {
  return Boolean(view) && acertouBotao(view!.flipButton, view!.flipButtonY, token, x, y, zoom)
}

export function tokenArmadoButtonHitTest(
  view: TokenView | undefined,
  token: Token,
  x: number,
  y: number,
  zoom: number,
) {
  return Boolean(view) && acertouBotao(view!.armadoButton, view!.flipButtonY, token, x, y, zoom)
}

export function setTokenAlphaMask(view: TokenView, image: HTMLImageElement) {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context || !canvas.width || !canvas.height) return
  context.drawImage(image, 0, 0)
  view.alphaMask = {
    data: context.getImageData(0, 0, canvas.width, canvas.height).data,
    width: canvas.width,
    height: canvas.height,
  }
}

export function tokenHitTest(
  view: TokenView | undefined,
  token: Token,
  sprite: TokenSprite | undefined,
  x: number,
  y: number,
  cellSize: number,
) {
  const diameter = token.size * cellSize
  const alturaBase = alturaDoToken(token) * cellSize
  const localX = x - token.x
  const localY = y - token.y
  if (!sprite) return Math.hypot(localX / (diameter / 2), localY / (alturaBase / 2)) <= 1

  // The ground footprint remains draggable even in transparent gaps around a standee.
  if (Math.abs(localX) <= diameter / 2 && Math.abs(localY) <= alturaBase / 2)
    return true
  const mask = view?.alphaMask
  if (!mask || !view?.sprite.visible || view.activeSpriteId !== sprite.id)
    return false
  const imageHeight = (alturaBase * mask.height) / mask.width
  if (
    localX < -diameter / 2 ||
    localX > diameter / 2 ||
    localY < -imageHeight ||
    localY > 0
  )
    return false
  const normalizedX = localX / diameter + 0.5
  const imageX = token.flipX ? 1 - normalizedX : normalizedX
  const pixelX = Math.min(
    mask.width - 1,
    Math.max(0, Math.floor(imageX * mask.width)),
  )
  const pixelY = Math.min(
    mask.height - 1,
    Math.max(
      0,
      Math.floor(((localY + imageHeight) / imageHeight) * mask.height),
    ),
  )
  return mask.data[(pixelY * mask.width + pixelX) * 4 + 3] > 12
}

export function destroyTokenView(view: TokenView) {
  view.imageVersion += 1
  view.root.removeFromParent()
  view.root.destroy({ children: true })
  view.texture?.destroy(true)
}
