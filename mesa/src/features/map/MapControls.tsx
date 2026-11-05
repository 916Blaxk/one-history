import { useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  CloudFog,
  Crosshair,
  Eraser,
  Eye,
  EyeOff,
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
  const updateScene = useUiStore((state) => state.updateScene)
  const focarEm = useUiStore((state) => state.focarEm)
  const cobrirNevoa = useUiStore((state) => state.cobrirNevoa)
  const limparNevoa = useUiStore((state) => state.limparNevoa)
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
    /* Lado a lado: cenários empilhados não dariam para pintar nem arrastar separados na preparação. */
    const { camera: cameraInicial, scenes: atuais } = useUiStore.getState()
    let bordaDireita = atuais.length ? Math.max(...atuais.map((scene) => scene.x + scene.width / 2)) + grid.cellSize * 2 : null
    for (const file of Array.from(files)) {
      const objectUrl = URL.createObjectURL(file)
      try {
        const image = new Image()
        image.src = objectUrl
        await image.decode()
        const x = bordaDireita === null ? (window.innerWidth / 2 - cameraInicial.x) / cameraInicial.zoom : bordaDireita + image.naturalWidth / 2
        const y = (window.innerHeight / 2 - cameraInicial.y) / cameraInicial.zoom
        const imageUrl = isRoomMode() ? await fileToRoomScene(file) : objectUrl
        addScene({
          id: crypto.randomUUID(), imageUrl, x, y, width: image.naturalWidth, height: image.naturalHeight,
          nome: file.name.replace(/\.[^.]+$/, '').slice(0, 60), oculto: true,
        })
        bordaDireita = x + image.naturalWidth / 2 + grid.cellSize * 2
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
                {scenes.map((scene, index) => {
                  const nome = scene.nome || `Cenário ${index + 1}`
                  return (
                    <div className={`scene-list-item ${scene.oculto ? 'is-hidden' : ''}`} key={scene.id}>
                      <div className="scene-list-top">
                        <input
                          key={scene.nome ?? ''}
                          aria-label={`Nome de ${nome}`}
                          maxLength={60}
                          defaultValue={scene.nome ?? ''}
                          placeholder={`Cenário ${index + 1}`}
                          onBlur={(event) => { if (event.target.value.trim() !== (scene.nome ?? '')) updateScene(scene.id, { nome: event.target.value }) }}
                        />
                        <span className="scene-status">{scene.oculto ? 'Oculto' : 'Visível'}</span>
                      </div>
                      <div className="scene-list-actions">
                        <button type="button" title={scene.oculto ? 'Mostrar aos jogadores' : 'Esconder dos jogadores'}
                          aria-label={`${scene.oculto ? 'Mostrar aos jogadores' : 'Esconder dos jogadores'}: ${nome}`}
                          onClick={() => updateScene(scene.id, { oculto: !scene.oculto })}>
                          {scene.oculto ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                        <button type="button" title="Ir até o cenário" aria-label={`Ir até ${nome}`} onClick={() => focarEm(scene.x, scene.y)}><Crosshair size={15} /></button>
                        <button type="button" title="Cobrir de névoa" aria-label={`Cobrir de névoa: ${nome}`} onClick={() => cobrirNevoa(scene.id)}><CloudFog size={15} /></button>
                        <button type="button" title="Tirar toda a névoa" aria-label={`Tirar a névoa: ${nome}`} onClick={() => limparNevoa(scene.id)}><Eraser size={15} /></button>
                        <button type="button" title="Remover cenário" aria-label={`Remover ${nome}`} onClick={() => {
                          if (!window.confirm(`Remover ${nome}? A imagem e a névoa dele serão apagadas.`)) return
                          if (scene.imageUrl.startsWith('blob:')) URL.revokeObjectURL(scene.imageUrl)
                          removeScene(scene.id)
                        }}><Trash2 size={15} /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="fog-controls">
                <span>Fog of war</span>
                <div>
                  <button type="button" className={fogMode === 'hide' ? 'is-active' : ''} onClick={() => setFogMode(fogMode === 'hide' ? null : 'hide')}>Ocultar</button>
                  <button type="button" className={fogMode === 'reveal' ? 'is-active' : ''} onClick={() => setFogMode(fogMode === 'reveal' ? null : 'reveal')}>Revelar</button>
                  <button type="button" onClick={() => { if (window.confirm('Tirar a névoa de todos os cenários e do mapa?')) clearFog() }}>Limpar tudo</button>
                </div>
                <label className="range-control"><span>Raio do pincel <b>{fogRadius} px</b></span>
                  <input type="range" min="1" max="200" value={fogRadius} onChange={(event) => setFogBrushRadius(Number(event.target.value))} />
                </label>
                {fogMode && <small>Arraste para {fogMode === 'hide' ? 'ocultar' : 'revelar'}. A névoa fica presa ao cenário onde o traço começa.</small>}
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
