import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import type { Token, TokenSprite } from '@/features/tokens/token-types'

type AlphaMask = { data: Uint8ClampedArray; width: number; height: number }

export type TokenView = {
  root: Container
  circle: Graphics
  initials: Text
  direction: Container
  shadow: Graphics
  sprite: Sprite
  selection: Graphics
  health: Graphics
  label: Text
  flipButton: Graphics
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
    .fill({ color: 0xe0b35d, alpha: 0.8 })
  direction.addChild(directionMark)
  const circle = new Graphics()
  const sprite = new Sprite(Texture.EMPTY)
  const initials = new Text({
    text: '',
    style: {
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 32,
      fill: 0xfff5e7,
      fontWeight: '600',
    },
  })
  const selection = new Graphics()
  const health = new Graphics()
  const flipButton = new Graphics()
  const label = new Text({
    text: '',
    style: {
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 14,
      fill: 0xeee8dc,
      stroke: { color: 0x101114, width: 3 },
    },
  })

  sprite.anchor.set(0.5, 1)
  sprite.position.set(0, 0)
  sprite.visible = false
  initials.anchor.set(0.5)
  label.anchor.set(0.5, 0)
  root.addChild(
    shadow,
    circle,
    direction,
    sprite,
    initials,
    selection,
    health,
    label,
    flipButton,
  )

  return {
    root,
    circle,
    initials,
    direction,
    shadow,
    sprite,
    selection,
    health,
    label,
    flipButton,
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
) {
  const diameter = token.size * cellSize
  const radius = diameter / 2
  const hasImage = Boolean(
    sprite &&
    view.sprite.visible &&
    view.activeSpriteId === sprite.id &&
    view.imageUrl === sprite.imageUrl,
  )
  const color = Number.parseInt(token.color.replace('#', ''), 16)
  view.root.position.set(token.x, token.y)
  view.circle.clear()
  if (!hasImage) view.circle.circle(0, 0, radius).fill(color)

  view.direction.position.set(0, hasImage ? cellSize * 0.1 : -cellSize * 0.28)
  view.direction.rotation = (token.rotation * Math.PI) / 180
  view.direction.scale.set(cellSize / 70)
  view.shadow.clear()
  if (hasImage)
    view.shadow
      .ellipse(0, 0, diameter * 0.34, cellSize * 0.12)
      .fill({ color: 0x08090a, alpha: 0.46 })

  if (view.texture && hasImage) {
    view.sprite.width = diameter
    view.sprite.height = diameter * (view.texture.height / view.texture.width)
    view.sprite.scale.x = Math.abs(view.sprite.scale.x) * (token.flipX ? -1 : 1)
  }
  view.initials.text = token.name.trim().charAt(0).toLocaleUpperCase() || '?'
  view.initials.style.fontSize = Math.max(14, diameter * 0.46)
  view.initials.visible = !hasImage

  view.selection.clear()
  if (selectedId === token.id) {
    if (sprite)
      view.selection
        .ellipse(0, 0, diameter * 0.4, cellSize * 0.19)
        .stroke({ color: 0xe0b35d, width: 2 / zoom })
    else
      view.selection
        .circle(0, 0, radius)
        .stroke({ color: 0xe0b35d, width: 2 / zoom })
  }

  const belowBase = radius + 5
  const hasHealth = token.hpMax !== undefined && token.hpMax > 0
  const hasMana = token.manaMax !== undefined && token.manaMax > 0
  view.health.clear()
  const barWidth = Math.min(54, Math.max(34, diameter * 0.8))
  const barHeight = 5 / zoom
  const drawResourceBar = (y: number, ratio: number, color: number) => {
    view.health
      .roundRect(-barWidth / 2, y, barWidth, barHeight, barHeight / 2)
      .fill({ color: 0x17181a, alpha: 0.9 })
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
  view.flipButton.clear()
  view.flipButton.visible = selectedId === token.id && hasImage
  if (view.flipButton.visible) {
    const width = 42 / zoom
    const height = 28 / zoom
    const y =
      view.label.position.y + Math.max(view.label.height, 16 / zoom) + 5 / zoom
    view.flipButtonY = y
    view.flipButton
      .roundRect(-width / 2, y, width, height, 6 / zoom)
      .fill({ color: 0x17181a, alpha: 0.94 })
      .stroke({ color: 0xc49a52, alpha: 0.9, width: 1.5 / zoom })
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
      .stroke({ color: 0xe0b35d, width: 1.5 / zoom })
    view.flipButton
      .moveTo(-12 / zoom, iconY)
      .lineTo(-7 / zoom, iconY - 3 / zoom)
      .moveTo(-12 / zoom, iconY)
      .lineTo(-7 / zoom, iconY + 3 / zoom)
      .moveTo(12 / zoom, iconY)
      .lineTo(7 / zoom, iconY - 3 / zoom)
      .moveTo(12 / zoom, iconY)
      .lineTo(7 / zoom, iconY + 3 / zoom)
      .stroke({ color: 0xe0b35d, width: 1.5 / zoom })
  }
}

export function tokenFlipButtonHitTest(
  view: TokenView | undefined,
  token: Token,
  x: number,
  y: number,
  zoom: number,
) {
  if (!view?.flipButton.visible) return false
  const width = 42 / zoom
  const height = 28 / zoom
  const localX = x - token.x
  const localY = y - token.y
  return (
    Math.abs(localX) <= width / 2 &&
    localY >= view.flipButtonY &&
    localY <= view.flipButtonY + height
  )
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
  const localX = x - token.x
  const localY = y - token.y
  if (!sprite) return Math.hypot(localX, localY) <= diameter / 2

  // The ground footprint remains draggable even in transparent gaps around a standee.
  if (Math.abs(localX) <= diameter / 2 && Math.abs(localY) <= diameter / 2)
    return true
  const mask = view?.alphaMask
  if (!mask || !view?.sprite.visible || view.activeSpriteId !== sprite.id)
    return false
  const imageHeight = (diameter * mask.height) / mask.width
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
