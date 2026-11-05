import { useEffect, useRef } from 'react'
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js'
import { useUiStore } from '@/stores/ui-store'
import { useTokenStore } from '@/features/tokens/token-store'
import { isRoomMode, sendRoomMove } from '@/features/rooms/room-commands'
import { useRoomStore } from '@/features/rooms/room-store'
import type { TokenSprite } from '@/features/tokens/token-types'
import type { RoomScene } from '@/shared/room-protocol'
import {
  createTokenView,
  destroyTokenView,
  setTokenAlphaMask,
  tokenFlipButtonHitTest,
  tokenHitTest,
  updateTokenView,
  type TokenView,
} from '@/features/map/TokenLayer'

const MIN_ZOOM = 0.2
const MAX_ZOOM = 4
const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

export function PixiMap({
  onMapInteraction,
}: {
  onMapInteraction?: () => void
}) {
  const onMapInteractionRef = useRef(onMapInteraction)
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    onMapInteractionRef.current = onMapInteraction
  }, [onMapInteraction])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let appInitialized = false
    let app: Application | undefined
    let resizeObserver: ResizeObserver | undefined
    let cleanupPixi = () => {}
    let unsubscribe = () => {}
    const sceneSprites = new Map<string, Sprite>()
    const sceneVersions = new Map<string, number>()
    let currentCellSize = useUiStore.getState().grid.cellSize
    let currentGridEnabled = useUiStore.getState().grid.enabled
    let tokensLayer: Container | undefined
    let sceneLayer: Container | undefined
    let fogGraphics: Graphics | undefined
    let unsubscribeTokens = () => {}
    const tokenViews = new Map<string, TokenView>()
    let spaceDown = false
    let pinchStart:
      | { distance: number; zoom: number; worldX: number; worldY: number }
      | undefined
    const pointers = new Map<
      number,
      { x: number; y: number; type: string; button: number }
    >()
    let panStart:
      | {
          pointerId: number
          x: number
          y: number
          cameraX: number
          cameraY: number
        }
      | undefined
    let tokenDrag:
      | {
          id: string
          pointerId: number
          offsetX: number
          offsetY: number
          moved: boolean
        }
      | undefined
    let sceneDrag: { id: string; pointerId: number; offsetX: number; offsetY: number } | undefined
    let fogPointerId: number | null = null
    let lastFogCell = ''

    const initialize = async () => {
      const pixi = new Application()
      app = pixi
      await pixi.init({
        backgroundColor: 0x101114,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      appInitialized = true
      if (disposed) {
        pixi.destroy(true, {
          children: true,
          texture: true,
          textureSource: true,
        })
        app = undefined
        return
      }

      host.appendChild(pixi.canvas)
      pixi.canvas.className = 'pixi-canvas'
      const world = new Container()
      const backgroundLayer = new Container()
      const gridLayer = new Container()
      const fogLayer = new Container()
      const tokenContainer = new Container()
      const uiLayer = new Container()
      world.addChild(backgroundLayer, gridLayer, tokenContainer, fogLayer, uiLayer)
      tokensLayer = tokenContainer
      sceneLayer = backgroundLayer
      pixi.stage.addChild(world)
      const gridGraphics = new Graphics()
      gridLayer.addChild(gridGraphics)
      fogGraphics = new Graphics()
      fogLayer.addChild(fogGraphics)

      const renderTokens = () => {
        const tokenState = useTokenStore.getState()
        const state = useUiStore.getState()
        const { playerKey, role } = useRoomStore.getState()
        const currentIds = new Set(tokenState.tokens.map((token) => token.id))
        for (const [id, view] of tokenViews) {
          if (!currentIds.has(id)) {
            destroyTokenView(view)
            tokenViews.delete(id)
          }
        }
        for (const token of tokenState.tokens) {
          const activeSprite = token.activeSpriteId
            ? (tokenState.spritesByTokenId[token.id] ?? []).find(
                (sprite) => sprite.id === token.activeSpriteId,
              )
            : undefined
          let view = tokenViews.get(token.id)
          if (!view) {
            view = createTokenView()
            tokenViews.set(token.id, view)
            tokensLayer?.addChild(view.root)
          }
          updateTokenView(
            view,
            token,
            activeSprite,
            state.grid.cellSize,
            tokenState.selectedTokenId,
            state.camera.zoom,
            playerKey,
            !isRoomMode() ||
              role === 'gm' ||
              (role === 'player' &&
                !token.hidden &&
                Boolean(playerKey && token.ownerIds.includes(playerKey))),
          )
          if (
            view.activeSpriteId !== (activeSprite?.id ?? null) ||
            view.imageUrl !== activeSprite?.imageUrl
          ) {
            void loadTokenImage(view, token.id, activeSprite)
          }
        }
      }

      async function loadTokenImage(
        view: TokenView,
        tokenId: string,
        sprite?: TokenSprite,
      ) {
        const version = ++view.imageVersion
        const url = sprite?.imageUrl
        view.activeSpriteId = sprite?.id ?? null
        view.imageUrl = url
        view.sprite.visible = false
        view.sprite.texture = Texture.EMPTY
        view.alphaMask = null
        view.texture?.destroy(true)
        view.texture = null
        if (!url) return
        const image = new Image()
        image.src = url
        try {
          await image.decode()
          if (
            disposed ||
            version !== view.imageVersion ||
            tokenViews.get(tokenId) !== view
          )
            return
          const currentToken = useTokenStore
            .getState()
            .tokens.find((token) => token.id === tokenId)
          const currentSprite = currentToken?.activeSpriteId
            ? (useTokenStore.getState().spritesByTokenId[tokenId] ?? []).find(
                (item) => item.id === currentToken.activeSpriteId,
              )
            : undefined
          if (
            !currentToken ||
            currentSprite?.id !== sprite?.id ||
            currentSprite.imageUrl !== url
          )
            return
          const texture = Texture.from(image)
          view.texture = texture
          view.sprite.texture = texture
          view.sprite.visible = true
          setTokenAlphaMask(view, image)
          updateTokenView(
            view,
            currentToken,
            currentSprite,
            useUiStore.getState().grid.cellSize,
            useTokenStore.getState().selectedTokenId,
            useUiStore.getState().camera.zoom,
            useRoomStore.getState().playerKey,
            !isRoomMode() ||
              useRoomStore.getState().role === 'gm' ||
              (useRoomStore.getState().role === 'player' &&
                !currentToken.hidden &&
                Boolean(
                  useRoomStore.getState().playerKey &&
                    currentToken.ownerIds.includes(
                      useRoomStore.getState().playerKey!,
                    ),
                )),
          )
        } catch {
          if (!disposed && version === view.imageVersion)
            view.initials.visible = true
        }
      }

      const render = (state: ReturnType<typeof useUiStore.getState>) => {
        const { camera, grid } = state
        if (
          grid.cellSize !== currentCellSize ||
          (grid.enabled && !currentGridEnabled)
        ) {
          currentCellSize = grid.cellSize
          if (grid.enabled && !isRoomMode())
            useTokenStore.getState().snapTokensToGrid(grid.cellSize)
        }
        currentGridEnabled = grid.enabled
        world.position.set(camera.x, camera.y)
        world.scale.set(camera.zoom)
        gridGraphics.clear()
        if (grid.enabled) {
          const left = -camera.x / camera.zoom - grid.cellSize
          const right =
            (pixi.screen.width - camera.x) / camera.zoom + grid.cellSize
          const top = -camera.y / camera.zoom - grid.cellSize
          const bottom =
            (pixi.screen.height - camera.y) / camera.zoom + grid.cellSize
          const startX = Math.floor(left / grid.cellSize) * grid.cellSize
          const startY = Math.floor(top / grid.cellSize) * grid.cellSize
          for (let x = startX; x <= right; x += grid.cellSize) {
            gridGraphics.moveTo(x, top).lineTo(x, bottom)
          }
          for (let y = startY; y <= bottom; y += grid.cellSize) {
            gridGraphics.moveTo(left, y).lineTo(right, y)
          }
          gridGraphics.stroke({
            color: 0xc49a52,
            alpha: grid.opacity,
            width: 1 / camera.zoom,
          })
        }
        const liveSceneIds = new Set(state.scenes.map((scene) => scene.id))
        for (const [id, sprite] of sceneSprites) if (!liveSceneIds.has(id)) {
          sprite.destroy({ texture: true, textureSource: true })
          sceneSprites.delete(id)
        }
        for (const scene of state.scenes) {
          const sprite = sceneSprites.get(scene.id)
          if (sprite) sprite.position.set(scene.x, scene.y)
          else void loadScene(scene)
        }
        fogGraphics?.clear()
        for (const cell of state.fogCells) {
          const [x, y] = cell.split(',').map(Number)
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue
          fogGraphics?.rect(x * grid.cellSize, y * grid.cellSize, grid.cellSize, grid.cellSize)
        }
        if (state.fogCells.length) fogGraphics?.fill({ color: 0x090a0d, alpha: 0.94 })
        renderTokens()
      }

      const loadScene = async (scene: RoomScene) => {
        const version = (sceneVersions.get(scene.id) ?? 0) + 1
        sceneVersions.set(scene.id, version)
        const image = new Image()
        image.src = scene.imageUrl
        try {
          await image.decode()
          if (disposed || sceneVersions.get(scene.id) !== version || !app ||
              !useUiStore.getState().scenes.some((item) => item.id === scene.id)) return
          const texture = Texture.from(image)
          const sprite = new Sprite(texture)
          sprite.anchor.set(0.5)
          sprite.position.set(scene.x, scene.y)
          sprite.width = scene.width
          sprite.height = scene.height
          sceneSprites.set(scene.id, sprite)
          sceneLayer?.addChild(sprite)
        } catch {
          // Ignore broken images and keep other scene layers available.
        }
      }

      const initial = useUiStore.getState()
      if (initial.camera.x === 0 && initial.camera.y === 0) {
        useUiStore.getState().setCamera({
          x: pixi.screen.width / 2,
          y: pixi.screen.height / 2,
          zoom: initial.camera.zoom,
        })
      }
      render(useUiStore.getState())
      unsubscribe = useUiStore.subscribe((state) => render(state))
      unsubscribeTokens = useTokenStore.subscribe(() => renderTokens())

      const resize = () => {
        const oldWidth = pixi.screen.width
        const oldHeight = pixi.screen.height
        pixi.renderer.resize(host.clientWidth, host.clientHeight)
        const camera = useUiStore.getState().camera
        useUiStore.getState().setCamera({
          ...camera,
          x: camera.x + (pixi.screen.width - oldWidth) / 2,
          y: camera.y + (pixi.screen.height - oldHeight) / 2,
        })
      }
      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(host)

      const canvas = pixi.canvas
      canvas.addEventListener('wheel', onWheel, { passive: false })
      canvas.addEventListener('pointerdown', onPointerDown)
      canvas.addEventListener('pointermove', onPointerMove)
      canvas.addEventListener('pointerup', onPointerEnd)
      canvas.addEventListener('pointercancel', onPointerEnd)
      canvas.addEventListener('lostpointercapture', onPointerEnd)
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      canvas.addEventListener('contextmenu', preventContextMenu)

      function onWheel(event: WheelEvent) {
        event.preventDefault()
        const rect = canvas.getBoundingClientRect()
        const px = event.clientX - rect.left
        const py = event.clientY - rect.top
        const { camera, setCamera } = useUiStore.getState()
        const zoom = clampZoom(camera.zoom * Math.exp(-event.deltaY * 0.001))
        const worldX = (px - camera.x) / camera.zoom
        const worldY = (py - camera.y) / camera.zoom
        setCamera({ x: px - worldX * zoom, y: py - worldY * zoom, zoom })
      }

      function finalizeTokenMove(id: string) {
        const grid = useUiStore.getState().grid
        if (grid.enabled) {
          useTokenStore.getState().snapTokenToGrid(id, grid.cellSize)
          return
        }
        if (!isRoomMode()) return
        const token = useTokenStore
          .getState()
          .tokens.find((item) => item.id === id)
        if (token) sendRoomMove(id, { x: token.x, y: token.y }, true)
      }

      function onPointerDown(event: PointerEvent) {
        onMapInteractionRef.current?.()
        const rect = canvas.getBoundingClientRect()
        const point = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          type: event.pointerType,
          button: event.button,
        }
        pointers.set(event.pointerId, point)
        canvas.setPointerCapture(event.pointerId)
        if (pointers.size >= 2) {
          if (tokenDrag?.moved) finalizeTokenMove(tokenDrag.id)
          tokenDrag = undefined
          panStart = undefined
          const pair = [...pointers.values()].slice(0, 2)
          const middleX = (pair[0].x + pair[1].x) / 2
          const middleY = (pair[0].y + pair[1].y) / 2
          const { camera } = useUiStore.getState()
          pinchStart = {
            distance: distance(pair[0], pair[1]),
            zoom: camera.zoom,
            worldX: (middleX - camera.x) / camera.zoom,
            worldY: (middleY - camera.y) / camera.zoom,
          }
          panStart = undefined
          return
        }
        const { camera } = useUiStore.getState()
        const worldX = (point.x - camera.x) / camera.zoom
        const worldY = (point.y - camera.y) / camera.zoom
        const canSelect = event.pointerType === 'touch' || event.button === 0
        const { role } = useRoomStore.getState()
        const fogMode = useUiStore.getState().fogMode
        if (canSelect && fogMode && (!isRoomMode() || role === 'gm')) {
          fogPointerId = event.pointerId
          lastFogCell = ''
          paintFogAt(worldX, worldY)
          return
        }
        const tokenState = useTokenStore.getState()
        const selectedToken = tokenState.tokens.find(
          (token) => token.id === tokenState.selectedTokenId,
        )
        if (
          canSelect &&
          selectedToken &&
          tokenFlipButtonHitTest(
            tokenViews.get(selectedToken.id),
            selectedToken,
            worldX,
            worldY,
            camera.zoom,
          )
        ) {
          tokenState.updateToken(selectedToken.id, {
            flipX: !selectedToken.flipX,
          })
          panStart = undefined
          tokenDrag = undefined
          return
        }
        const hitToken =
          canSelect && !spaceDown
            ? [...tokenState.tokens].reverse().find((token) => {
                const sprite = token.activeSpriteId
                  ? (tokenState.spritesByTokenId[token.id] ?? []).find(
                      (item) => item.id === token.activeSpriteId,
                    )
                  : undefined
                return tokenHitTest(
                  tokenViews.get(token.id),
                  token,
                  sprite,
                  worldX,
                  worldY,
                  useUiStore.getState().grid.cellSize,
                )
              })
            : undefined
        if (hitToken) {
          tokenState.selectToken(hitToken.id)
          const { playerKey, role } = useRoomStore.getState()
          const canMove =
            !isRoomMode() ||
            role === 'gm' ||
            (role === 'player' &&
              !hitToken.hidden &&
              Boolean(playerKey && hitToken.ownerIds.includes(playerKey)))
          tokenDrag = canMove
            ? {
                id: hitToken.id,
                pointerId: event.pointerId,
                offsetX: worldX - hitToken.x,
                offsetY: worldY - hitToken.y,
                moved: false,
              }
            : undefined
          panStart = undefined
          canvas.classList.remove('is-panning')
          return
        }
        if (canSelect && (!isRoomMode() || role === 'gm') && !spaceDown) {
          const hitScene = [...useUiStore.getState().scenes].reverse().find((scene) =>
            Math.abs(worldX - scene.x) <= scene.width / 2 && Math.abs(worldY - scene.y) <= scene.height / 2)
          if (hitScene) {
            sceneDrag = { id: hitScene.id, pointerId: event.pointerId, offsetX: worldX - hitScene.x, offsetY: worldY - hitScene.y }
            return
          }
        }
        if (canSelect && event.button !== 1 && !spaceDown)
          tokenState.selectToken(null)
        if (
          event.pointerType === 'touch' ||
          event.button === 1 ||
          (event.button === 0 && spaceDown)
        ) {
          panStart = {
            pointerId: event.pointerId,
            x: point.x,
            y: point.y,
            cameraX: camera.x,
            cameraY: camera.y,
          }
          canvas.classList.add('is-panning')
        }
      }

      function onPointerMove(event: PointerEvent) {
        const rect = canvas.getBoundingClientRect()
        const point = pointers.get(event.pointerId)
        if (!point) return
        point.x = event.clientX - rect.left
        point.y = event.clientY - rect.top
        if (fogPointerId === event.pointerId) {
          const camera = useUiStore.getState().camera
          paintFogAt((point.x - camera.x) / camera.zoom, (point.y - camera.y) / camera.zoom)
        } else if (sceneDrag?.pointerId === event.pointerId) {
          const camera = useUiStore.getState().camera
          useUiStore.getState().moveScene(sceneDrag.id,
            (point.x - camera.x) / camera.zoom - sceneDrag.offsetX,
            (point.y - camera.y) / camera.zoom - sceneDrag.offsetY)
        } else if (tokenDrag?.pointerId === event.pointerId) {
          const camera = useUiStore.getState().camera
          useTokenStore.getState().updateTokenPosition(tokenDrag.id, {
            x: (point.x - camera.x) / camera.zoom - tokenDrag.offsetX,
            y: (point.y - camera.y) / camera.zoom - tokenDrag.offsetY,
          })
          tokenDrag.moved = true
        } else if (pointers.size >= 2 && pinchStart) {
          const pair = [...pointers.values()].slice(0, 2)
          const middleX = (pair[0].x + pair[1].x) / 2
          const middleY = (pair[0].y + pair[1].y) / 2
          const zoom = clampZoom(
            (pinchStart.zoom * distance(pair[0], pair[1])) /
              pinchStart.distance,
          )
          useUiStore.getState().setCamera({
            x: middleX - pinchStart.worldX * zoom,
            y: middleY - pinchStart.worldY * zoom,
            zoom,
          })
        } else if (panStart?.pointerId === event.pointerId) {
          useUiStore.getState().setCamera({
            ...useUiStore.getState().camera,
            x: panStart.cameraX + point.x - panStart.x,
            y: panStart.cameraY + point.y - panStart.y,
          })
        }
      }

      function onPointerEnd(event: PointerEvent) {
        if (!pointers.has(event.pointerId)) return
        if (fogPointerId === event.pointerId) fogPointerId = null
        if (sceneDrag?.pointerId === event.pointerId) sceneDrag = undefined
        if (tokenDrag?.pointerId === event.pointerId) {
          if (tokenDrag.moved) finalizeTokenMove(tokenDrag.id)
          tokenDrag = undefined
        }
        pointers.delete(event.pointerId)
        if (pointers.size < 2) pinchStart = undefined
        if (panStart?.pointerId === event.pointerId) panStart = undefined
        if (!panStart) canvas.classList.remove('is-panning')
        if (canvas.hasPointerCapture(event.pointerId))
          canvas.releasePointerCapture(event.pointerId)
        if (
          !tokenDrag &&
          pointers.size === 1 &&
          [...pointers.values()][0].type === 'touch'
        ) {
          const [pointerId, point] = [...pointers.entries()][0]
          const camera = useUiStore.getState().camera
          panStart = {
            pointerId,
            x: point.x,
            y: point.y,
            cameraX: camera.x,
            cameraY: camera.y,
          }
        }
      }

      function paintFogAt(x: number, y: number) {
        const state = useUiStore.getState()
        const cellX = Math.floor(x / state.grid.cellSize)
        const cellY = Math.floor(y / state.grid.cellSize)
        const key = `${cellX},${cellY}`
        if (key === lastFogCell) return
        lastFogCell = key
        state.paintFog(x, y, state.fogBrushRadius, state.fogMode === 'reveal')
      }

      function onKeyDown(event: KeyboardEvent) {
        const activeElement =
          event.target instanceof HTMLElement ? event.target : null
        const isEditing = Boolean(
          activeElement?.closest(
            'input, textarea, select, [contenteditable="true"]',
          ),
        )
        if (event.key === 'Escape') {
          useTokenStore.getState().selectToken(null)
          return
        }
        if (
          !isEditing &&
          (event.key === 'Delete' || event.key === 'Backspace')
        ) {
          const selectedId = useTokenStore.getState().selectedTokenId
          if (selectedId) useTokenStore.getState().removeToken(selectedId)
          return
        }
        if (
          event.code === 'Space' &&
          !activeElement?.closest(
            'input, textarea, select, button, a, [contenteditable="true"]',
          )
        ) {
          spaceDown = true
          canvas.classList.add('can-pan')
          event.preventDefault()
        }
      }
      function onKeyUp(event: KeyboardEvent) {
        if (event.code === 'Space') {
          spaceDown = false
          canvas.classList.remove('can-pan')
        }
      }
      function preventContextMenu(event: Event) {
        event.preventDefault()
      }

      cleanupPixi = () => {
        canvas.removeEventListener('wheel', onWheel)
        canvas.removeEventListener('pointerdown', onPointerDown)
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerup', onPointerEnd)
        canvas.removeEventListener('pointercancel', onPointerEnd)
        canvas.removeEventListener('lostpointercapture', onPointerEnd)
        canvas.removeEventListener('contextmenu', preventContextMenu)
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
      }
    }

    void initialize()
    return () => {
      disposed = true
      unsubscribe()
      unsubscribeTokens()
      resizeObserver?.disconnect()
      cleanupPixi()
      for (const view of tokenViews.values()) destroyTokenView(view)
      tokenViews.clear()
      for (const sprite of sceneSprites.values()) sprite.destroy({ texture: true, textureSource: true })
      sceneSprites.clear()
      if (app && appInitialized) {
        app.destroy(true, {
          children: true,
          texture: true,
          textureSource: true,
        })
      }
      host.replaceChildren()
    }
  }, [])

  return (
    <div
      className="pixi-map-host"
      ref={hostRef}
      aria-label="Mapa de jogo interativo"
    />
  )
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
