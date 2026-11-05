import { useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ImagePlus,
  RotateCcw,
  UserRoundPlus,
  X,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useUiStore } from '@/stores/ui-store'
import { useTokenStore } from '@/features/tokens/token-store'
import { useBottomSheetDismiss } from '@/hooks/use-bottom-sheet-dismiss'
import { isRoomMode } from '@/features/rooms/room-commands'
import { fileToRoomScene } from '@/features/rooms/scene-serializer'

export function MapControls({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen?: boolean
  onMobileClose?: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const previousUrl = useRef<string | null>(null)
  const grid = useUiStore((state) => state.grid)
  const setGrid = useUiStore((state) => state.setGrid)
  const setBackgroundUrl = useUiStore((state) => state.setBackgroundUrl)
  const addToken = useTokenStore((state) => state.addToken)
  const mobileMode = mobileOpen !== undefined
  const contentVisible = mobileMode ? mobileOpen : !collapsed
  const dragHandlers = useBottomSheetDismiss(Boolean(mobileOpen), onMobileClose)

  async function selectImage(file?: File) {
    if (!file) return
    if (isRoomMode()) {
      try {
        setBackgroundUrl(await fileToRoomScene(file))
      } catch (error) {
        window.alert(
          error instanceof Error
            ? error.message
            : 'Não foi possível preparar o cenário.',
        )
      }
      return
    }
    if (previousUrl.current) URL.revokeObjectURL(previousUrl.current)
    const url = URL.createObjectURL(file)
    previousUrl.current = url
    setBackgroundUrl(url)
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
          <span className="map-panel-kicker">MESA DE TESTES</span>
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
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept="image/*"
            onChange={(event) => {
              void selectImage(event.currentTarget.files?.[0])
              event.currentTarget.value = ''
            }}
          />
          <button
            className="upload-button"
            type="button"
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus size={17} /> Escolher imagem de fundo
          </button>
          <button
            className="new-token-button"
            type="button"
            onClick={createToken}
          >
            <UserRoundPlus size={17} /> Novo token
          </button>
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
