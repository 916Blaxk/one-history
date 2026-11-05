import { useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ImagePlus,
  RotateCcw,
  Trash2,
  UserRoundPlus,
  X,
} from 'lucide-react'
import { Card, CardContent } from '@mesa/components/ui/card'
import { useUiStore } from '@mesa/stores/ui-store'
import { useTokenStore } from '@mesa/features/tokens/token-store'
import { useBottomSheetDismiss } from '@mesa/hooks/use-bottom-sheet-dismiss'
import { isRoomMode } from '@mesa/features/rooms/room-commands'
import { fileToRoomScene } from '@mesa/features/rooms/scene-serializer'
import { useRoomStore } from '@mesa/features/rooms/room-store'

export function MapControls({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen?: boolean
  onMobileClose?: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const grid = useUiStore((state) => state.grid)
  const setGrid = useUiStore((state) => state.setGrid)
  const scenes = useUiStore((state) => state.scenes)
  const addScene = useUiStore((state) => state.addScene)
  const removeScene = useUiStore((state) => state.removeScene)
  const fogMode = useUiStore((state) => state.fogMode)
  const fogRadius = useUiStore((state) => state.fogBrushRadius)
  const setFogBrushRadius = useUiStore((state) => state.setFogBrushRadius)
  const setFogMode = useUiStore((state) => state.setFogMode)
  const clearFog = useUiStore((state) => state.clearFog)
  const addToken = useTokenStore((state) => state.addToken)
  const role = useRoomStore((state) => state.role)
  const gmControls = !isRoomMode() || role === 'gm'
  const canCreateToken = !isRoomMode() || role === 'gm' || role === 'player'
  const mobileMode = mobileOpen !== undefined
  const contentVisible = mobileMode ? mobileOpen : !collapsed
  const dragHandlers = useBottomSheetDismiss(Boolean(mobileOpen), onMobileClose)

  async function selectImages(files: FileList | null) {
    if (!files?.length) return
    let sceneIndex = scenes.length
    for (const file of Array.from(files)) {
      const objectUrl = URL.createObjectURL(file)
      try {
        const image = new Image()
        image.src = objectUrl
        await image.decode()
        const { camera } = useUiStore.getState()
        const x = (window.innerWidth / 2 - camera.x) / camera.zoom + sceneIndex * 36
        const y = (window.innerHeight / 2 - camera.y) / camera.zoom + sceneIndex * 36
        const imageUrl = isRoomMode() ? await fileToRoomScene(file) : objectUrl
        addScene({ id: crypto.randomUUID(), imageUrl, x, y, width: image.naturalWidth, height: image.naturalHeight })
        sceneIndex += 1
        if (isRoomMode()) URL.revokeObjectURL(objectUrl)
      } catch (error) {
        URL.revokeObjectURL(objectUrl)
        window.alert(error instanceof Error ? error.message : 'Não foi possível preparar a imagem.')
      }
    }
  }

  function resetView() {
    useUiStore.getState().setCamera({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      zoom: 1,
    })
  }

  function createToken() {
    const { camera } = useUiStore.getState()
    addToken({
      x: (window.innerWidth / 2 - camera.x) / camera.zoom,
      y: (window.innerHeight / 2 - camera.y) / camera.zoom,
    })
  }

  return (
    <Card
      className={`map-panel mobile-bottom-sheet ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'mobile-sheet-open' : ''}`}
    >
      <div className="map-panel-heading mobile-sheet-heading" {...dragHandlers}>
        <span className="mobile-sheet-handle" />
        <div>
          <span className="map-panel-kicker">MESA DA CAMPANHA</span>
          <h1>Controles do mapa</h1>
        </div>
        <button
          className="collapse-button"
          type="button"
          aria-label={collapsed ? 'Expandir controles' : 'Recolher controles'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
        <button
          className="mobile-sheet-close"
          type="button"
          aria-label="Fechar painel"
          onClick={onMobileClose}
        >
          <X size={18} />
        </button>
      </div>
      {contentVisible && (
        <CardContent className="map-panel-content mobile-sheet-content">
          {gmControls && (
            <>
              <input
                ref={fileInput}
                className="visually-hidden"
                type="file"
                multiple
                accept="image/*"
                onChange={(event) => {
                  void selectImages(event.currentTarget.files)
                  event.currentTarget.value = ''
                }}
              />
              <button
                className="upload-button"
                type="button"
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus size={17} /> Adicionar cenários
              </button>
              <div className="scene-list">
                {scenes.map((scene, index) => (
                  <div className="scene-list-item" key={scene.id}>
                    <span>Cenário {index + 1}</span>
                    <button type="button" aria-label={`Remover cenário ${index + 1}`} onClick={() => {
                      if (scene.imageUrl.startsWith('blob:')) URL.revokeObjectURL(scene.imageUrl)
                      removeScene(scene.id)
                    }}><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
              <div className="fog-controls">
                <span>Fog of war</span>
                <div>
                  <button type="button" className={fogMode === 'hide' ? 'is-active' : ''} onClick={() => setFogMode(fogMode === 'hide' ? null : 'hide')}>Ocultar</button>
                  <button type="button" className={fogMode === 'reveal' ? 'is-active' : ''} onClick={() => setFogMode(fogMode === 'reveal' ? null : 'reveal')}>Revelar</button>
                  <button type="button" onClick={clearFog}>Limpar</button>
                </div>
                <label className="range-control"><span>Pincel <b>{fogRadius} células</b></span>
                  <input type="range" min="1" max="8" value={fogRadius} onChange={(event) => setFogBrushRadius(Number(event.target.value))} />
                </label>
                {fogMode && <small>Arraste no mapa para {fogMode === 'hide' ? 'ocultar' : 'revelar'} áreas.</small>}
              </div>
              <label className="map-toggle">
                <span>Grid quadrado</span>
                <input
                  type="checkbox"
                  checked={grid.enabled}
                  onChange={(event) => setGrid({ enabled: event.target.checked })}
                />
              </label>
              <label className="range-control">
                <span>
                  Tamanho da c&eacute;lula <b>{grid.cellSize} px</b>
                </span>
                <input
                  type="range"
                  min="30"
                  max="160"
                  step="5"
                  value={grid.cellSize}
                  onChange={(event) =>
                    setGrid({ cellSize: Number(event.target.value) })
                  }
                />
              </label>
              <label className="range-control">
                <span>
                  Opacidade <b>{Math.round(grid.opacity * 100)}%</b>
                </span>
                <input
                  type="range"
                  min="5"
                  max="70"
                  step="1"
                  value={Math.round(grid.opacity * 100)}
                  onChange={(event) =>
                    setGrid({ opacity: Number(event.target.value) / 100 })
                  }
                />
              </label>
            </>
          )}
          {canCreateToken && (
            <button
              className="new-token-button"
              type="button"
              onClick={createToken}
            >
              <UserRoundPlus size={17} /> Novo token
            </button>
          )}
          <button className="reset-button" type="button" onClick={resetView}>
            <RotateCcw size={15} /> Resetar vis&atilde;o
          </button>
          <p className="map-hint">
            Roda para zoom · Espa&ccedil;o + arraste para mover
          </p>
        </CardContent>
      )}
    </Card>
  )
}
