import { useEffect, useRef } from 'react'
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
/* O CSP do site proíbe eval, e o PixiJS gera funções em tempo de execução sem este módulo. */
import 'pixi.js/unsafe-eval'
import { useUiStore } from '@mesa/stores/ui-store'
import { useTokenStore } from '@mesa/features/tokens/token-store'
import { isRoomMode, sendRoomCommand, sendRoomMove } from '@mesa/features/rooms/room-commands'
import { useRoomStore } from '@mesa/features/rooms/room-store'
import { spriteDoToken, type TokenSprite } from '@mesa/features/tokens/token-types'
import type { OpNevoa, RoomScene } from '@mesa/shared/room-protocol'
import { CAMADA_MUNDO, limitesDaOp } from '@mesa/shared/nevoa'
import { can } from '@mesa/shared/permissions'
import { CamadaNevoa, type Limites } from '@mesa/features/map/camada-nevoa'
import {
  createTokenView,
  destroyTokenView,
  setTokenAlphaMask,
  tokenArmadoButtonHitTest,
  tokenFlipButtonHitTest,
  tokenHitTest,
  updateTokenView,
  type TokenView,
} from '@mesa/features/map/TokenLayer'

const MIN_ZOOM = 0.2
const MAX_ZOOM = 4
const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
/* O mestre precisa ver o que está por baixo para preparar; o jogador não pode. */
const ALFA_NEVOA_MESTRE = 0.55
const ALFA_CENARIO_OCULTO = 0.65
const FOLGA_CAMADA_MUNDO = 256
const INTERVALO_TRACO_MS = 40
const MAX_NUMEROS_POR_ENVIO = 250
const DURACAO_PING_MS = 2200
const escalaDe = (scene: RoomScene) => scene.escala ?? 1
const acertouCena = (scene: RoomScene, x: number, y: number) =>
  Math.abs(x - scene.x) <= (scene.width * escalaDe(scene)) / 2 && Math.abs(y - scene.y) <= (scene.height * escalaDe(scene)) / 2

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
    let fogContainer: Container | undefined
    const camadasNevoa = new Map<string, CamadaNevoa>()
    let opsMundoVistas: readonly OpNevoa[] | undefined
    let limitesMundo: Limites | undefined
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
    let tracoNevoa:
      | {
          camada: string
          g: string
          origemX: number
          origemY: number
          escala: number
          revelar: boolean
          raio: number
          raioMapa: number
          camadas: Set<string>
          pendentes: number[]
          ultimo?: [number, number]
          timer?: ReturnType<typeof setTimeout>
        }
      | undefined

    let regua: { pointerId: number; x: number; y: number } | undefined

    const initialize = async () => {
      const pixi = new Application()
      app = pixi
      await pixi.init({
        backgroundColor: 0x0d0e24,
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
      fogContainer = fogLayer
      fogLayer.sortableChildren = true
      const cursorNevoa = new Graphics()
      const linhaRegua = new Graphics()
      const textoRegua = new Text({
        text: '',
        style: { fontFamily: 'DM Sans, sans-serif', fontSize: 15, fontWeight: '600', fill: 0xffffff, stroke: { color: 0x0a0b20, width: 4 } },
      })
      textoRegua.anchor.set(0.5, 1)
      const anelPing = new Graphics()
      uiLayer.addChild(cursorNevoa, linhaRegua, textoRegua, anelPing)
      const animarPings = () => {
        const { pings, camera } = useUiStore.getState()
        anelPing.clear()
        const agora = Date.now()
        for (const ping of pings) {
          const progresso = Math.min(1, (agora - ping.em) / DURACAO_PING_MS)
          for (const atraso of [0, 0.35]) {
            const fase = Math.max(0, progresso - atraso) / (1 - atraso)
            if (fase <= 0) continue
            anelPing.circle(ping.x, ping.y, (10 + fase * 70) / camera.zoom).stroke({ color: 0xa78bfa, alpha: 1 - fase, width: 4 / camera.zoom })
          }
        }
      }
      pixi.ticker.add(animarPings)

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
          const activeSprite = spriteDoToken(token, tokenState.spritesByTokenId[token.id])
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
            state.combate?.vez === token.id,
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
          const currentSprite = currentToken && spriteDoToken(currentToken, useTokenStore.getState().spritesByTokenId[tokenId])
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
            useUiStore.getState().combate?.vez === currentToken.id,
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
            color: 0x6a6fd8,
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
          if (sprite) {
            sprite.position.set(scene.x, scene.y)
            sprite.alpha = scene.oculto ? ALFA_CENARIO_OCULTO : 1
            sprite.width = scene.width * escalaDe(scene)
            sprite.height = scene.height * escalaDe(scene)
          } else void loadScene(scene)
        }
        if (!state.fogMode) cursorNevoa.clear()
        renderNevoa(state)
        renderTokens()
      }

      /* A camada do mapa não tem borda: cresce quando um traço passa do que ela já cobre. */
      const calcularLimitesMundo = (ops: readonly OpNevoa[]) => {
        if (ops === opsMundoVistas && limitesMundo) return limitesMundo
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
        for (const op of ops) {
          const l = limitesDaOp(op)
          if (!l) continue
          x0 = Math.min(x0, l.x0); y0 = Math.min(y0, l.y0); x1 = Math.max(x1, l.x1); y1 = Math.max(y1, l.y1)
        }
        opsMundoVistas = ops
        const justos = { x: x0, y: y0, largura: x1 - x0, altura: y1 - y0 }
        if (!limitesMundo || !camadasNevoa.get(CAMADA_MUNDO)?.contem(justos)) {
          limitesMundo = {
            x: Math.floor(x0 - FOLGA_CAMADA_MUNDO), y: Math.floor(y0 - FOLGA_CAMADA_MUNDO),
            largura: Math.ceil(x1 - x0 + FOLGA_CAMADA_MUNDO * 2), altura: Math.ceil(y1 - y0 + FOLGA_CAMADA_MUNDO * 2),
          }
        }
        return limitesMundo
      }

      const renderNevoa = (state: ReturnType<typeof useUiStore.getState>) => {
        const alfa = !isRoomMode() || useRoomStore.getState().role === 'gm' ? ALFA_NEVOA_MESTRE : 1
        const vivas = new Set<string>()
        for (const [camada, ops] of Object.entries(state.nevoa)) {
          if (!ops.length) continue
          const scene = state.scenes.find((item) => item.id === camada)
          if (!scene && camada !== CAMADA_MUNDO) continue
          const limites = scene
            ? { x: -scene.width / 2, y: -scene.height / 2, largura: scene.width, altura: scene.height }
            : calcularLimitesMundo(ops)
          let view = camadasNevoa.get(camada)
          if (!view) {
            view = new CamadaNevoa()
            view.sprite.zIndex = scene ? 1 : 0
            camadasNevoa.set(camada, view)
            fogContainer?.addChild(view.sprite)
          }
          view.atualizar(ops, limites)
          view.posicionar(scene?.x ?? 0, scene?.y ?? 0, scene ? escalaDe(scene) : 1)
          view.sprite.alpha = alfa
          vivas.add(camada)
        }
        for (const [camada, view] of camadasNevoa) {
          if (vivas.has(camada)) continue
          view.destruir()
          camadasNevoa.delete(camada)
          if (camada === CAMADA_MUNDO) { limitesMundo = undefined; opsMundoVistas = undefined }
        }
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
          sprite.alpha = useUiStore.getState().scenes.find((item) => item.id === scene.id)?.oculto ? ALFA_CENARIO_OCULTO : 1
          const atual = useUiStore.getState().scenes.find((item) => item.id === scene.id) ?? scene
          sprite.width = atual.width * escalaDe(atual)
          sprite.height = atual.height * escalaDe(atual)
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
      canvas.addEventListener('pointerleave', limparCursorNevoa)
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
        const ferramenta = useUiStore.getState().ferramenta
        if (canSelect && ferramenta === 'medir') {
          regua = { pointerId: event.pointerId, x: worldX, y: worldY }
          return
        }
        if (canSelect && (ferramenta === 'ping' || event.altKey)) {
          sendRoomCommand({ type: 'mapa:ping', x: worldX, y: worldY })
          return
        }
        const fogMode = useUiStore.getState().fogMode
        if (canSelect && fogMode && (!isRoomMode() || role === 'gm')) {
          fogPointerId = event.pointerId
          iniciarTracoNevoa(worldX, worldY)
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
        if (
          canSelect &&
          selectedToken &&
          tokenArmadoButtonHitTest(
            tokenViews.get(selectedToken.id),
            selectedToken,
            worldX,
            worldY,
            camera.zoom,
          )
        ) {
          tokenState.updateToken(selectedToken.id, {
            armado: !selectedToken.armado,
          })
          panStart = undefined
          tokenDrag = undefined
          return
        }
        const hitToken =
          canSelect && !spaceDown
            ? [...tokenState.tokens].reverse().find((token) => {
                const sprite = spriteDoToken(token, tokenState.spritesByTokenId[token.id])
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
          const hitScene = [...useUiStore.getState().scenes].reverse().find((scene) => !scene.travado && acertouCena(scene, worldX, worldY))
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
        desenharCursorNevoa(event.clientX - rect.left, event.clientY - rect.top)
        const point = pointers.get(event.pointerId)
        if (!point) return
        point.x = event.clientX - rect.left
        point.y = event.clientY - rect.top
        if (regua?.pointerId === event.pointerId) {
          const { camera, grid } = useUiStore.getState()
          const fimX = (point.x - camera.x) / camera.zoom
          const fimY = (point.y - camera.y) / camera.zoom
          linhaRegua.clear().moveTo(regua.x, regua.y).lineTo(fimX, fimY).stroke({ color: 0xffffff, width: 2 / camera.zoom })
          linhaRegua.circle(regua.x, regua.y, 4 / camera.zoom).fill(0xffffff)
          const celulas = Math.hypot(fimX - regua.x, fimY - regua.y) / grid.cellSize
          textoRegua.text = `${celulas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${celulas === 1 ? 'célula' : 'células'}`
          textoRegua.scale.set(1 / camera.zoom)
          textoRegua.position.set(fimX, fimY - 10 / camera.zoom)
        } else if (fogPointerId === event.pointerId) {
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
        if (regua?.pointerId === event.pointerId) {
          regua = undefined
          linhaRegua.clear()
          textoRegua.text = ''
        }
        if (fogPointerId === event.pointerId) {
          fogPointerId = null
          enviarTracoNevoa()
          if (tracoNevoa) useUiStore.getState().registrarTraco([...tracoNevoa.camadas], tracoNevoa.g)
          tracoNevoa = undefined
        }
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

      function limparCursorNevoa() {
        cursorNevoa.clear()
      }

      /* Mostra exatamente a área do pincel, já que ele não segue mais a grade. */
      function desenharCursorNevoa(telaX: number, telaY: number) {
        cursorNevoa.clear()
        const state = useUiStore.getState()
        if (!state.fogMode || (isRoomMode() && useRoomStore.getState().role !== 'gm')) return
        const { camera } = state
        cursorNevoa
          .circle((telaX - camera.x) / camera.zoom, (telaY - camera.y) / camera.zoom, state.fogBrushRadius)
          .stroke({ color: state.fogMode === 'reveal' ? 0xc9bcff : 0xffffff, alpha: 0.9, width: 1.5 / camera.zoom })
      }

      function iniciarTracoNevoa(x: number, y: number) {
        const state = useUiStore.getState()
        /* O traço pertence ao cenário onde começou, para acompanhá-lo quando ele for movido. */
        const scene = [...state.scenes].reverse().find((item) => acertouCena(item, x, y))
        const escala = scene ? escalaDe(scene) : 1
        tracoNevoa = {
          camada: scene?.id ?? CAMADA_MUNDO,
          g: crypto.randomUUID(),
          origemX: scene?.x ?? 0,
          origemY: scene?.y ?? 0,
          escala,
          revelar: state.fogMode === 'reveal',
          /* Os traços ficam na medida original do cenário: o círculo do pincel vale o que aparece na tela. */
          raio: Math.min(300, Math.max(1, Math.round(state.fogBrushRadius / escala))),
          raioMapa: state.fogBrushRadius,
          camadas: new Set(),
          pendentes: [],
        }
        paintFogAt(x, y)
      }

      function paintFogAt(x: number, y: number) {
        const traco = tracoNevoa
        if (!traco) return
        const px = Math.round((x - traco.origemX) / traco.escala)
        const py = Math.round((y - traco.origemY) / traco.escala)
        if (traco.ultimo?.[0] === px && traco.ultimo[1] === py) return
        /* Cada envio recomeça no último ponto do anterior, para o traço não ficar com falhas. */
        if (!traco.pendentes.length && traco.ultimo) traco.pendentes.push(...traco.ultimo)
        traco.pendentes.push(px, py)
        traco.ultimo = [px, py]
        if (traco.pendentes.length >= MAX_NUMEROS_POR_ENVIO) enviarTracoNevoa()
        else traco.timer ??= setTimeout(enviarTracoNevoa, INTERVALO_TRACO_MS)
      }

      function enviarTracoNevoa() {
        const traco = tracoNevoa
        if (!traco) return
        if (traco.timer) clearTimeout(traco.timer)
        traco.timer = undefined
        if (!traco.pendentes.length) return
        const pontos = traco.pendentes
        traco.pendentes = []
        const state = useUiStore.getState()
        state.pintarNevoa(traco.camada, pontos, traco.raio, traco.revelar, traco.g)
        traco.camadas.add(traco.camada)
        /* Névoa pintada fora de um cenário pode cobri-lo. Revelar precisa abrir essa camada também. */
        if (traco.revelar && traco.camada !== CAMADA_MUNDO && state.nevoa[CAMADA_MUNDO]?.length) {
          const noMapa = pontos.map((valor, i) => Math.round(valor * traco.escala + (i % 2 === 0 ? traco.origemX : traco.origemY)))
          state.pintarNevoa(CAMADA_MUNDO, noMapa, traco.raioMapa, true, traco.g)
          traco.camadas.add(CAMADA_MUNDO)
        }
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
        if (!isEditing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && (!isRoomMode() || useRoomStore.getState().role === 'gm')) {
          useUiStore.getState().desfazerTraco()
          event.preventDefault()
          return
        }
        if (
          !isEditing &&
          (event.key === 'Delete' || event.key === 'Backspace')
        ) {
          const { selectedTokenId: selectedId, tokens } = useTokenStore.getState()
          const selecionado = tokens.find((token) => token.id === selectedId)
          /* Uma tecla apertada sem querer não pode apagar um token: o da ficha não volta sozinho. */
          const { role, playerKey } = useRoomStore.getState()
          const podeRemover = selecionado && (!isRoomMode() || (role && can(role, 'token:remove', selecionado, playerKey ?? undefined)))
          if (podeRemover && window.confirm(`Remover o token ${selecionado.name}?`)) useTokenStore.getState().removeToken(selecionado.id)
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
        pixi.ticker.remove(animarPings)
        canvas.removeEventListener('wheel', onWheel)
        canvas.removeEventListener('pointerdown', onPointerDown)
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerleave', limparCursorNevoa)
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
      if (tracoNevoa?.timer) clearTimeout(tracoNevoa.timer)
      unsubscribe()
      unsubscribeTokens()
      resizeObserver?.disconnect()
      cleanupPixi()
      for (const view of tokenViews.values()) destroyTokenView(view)
      tokenViews.clear()
      for (const sprite of sceneSprites.values()) sprite.destroy({ texture: true, textureSource: true })
      sceneSprites.clear()
      for (const camada of camadasNevoa.values()) camada.destruir()
      camadasNevoa.clear()
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
