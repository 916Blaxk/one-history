import { create } from 'zustand'
import { isRoomMode, sendRoomCommand } from '@mesa/features/rooms/room-commands'
import type { Combate, NevoaDaMesa, OpNevoa, RoomScene } from '@mesa/shared/room-protocol'

const DURACAO_PING_MS = 2200
const TRACOS_DESFAZIVEIS = 30
export type Ferramenta = 'medir' | 'ping' | null

type Camera = { x: number; y: number; zoom: number }
type GridSettings = { enabled: boolean; cellSize: number; opacity: number }

type UiState = {
  counter: number
  camera: Camera
  grid: GridSettings
  scenes: RoomScene[]
  nevoa: NevoaDaMesa
  fogMode: 'hide' | 'reveal' | null
  fogBrushRadius: number
  /* Os traços que esta pessoa pode desfazer. Um traço cai em duas camadas quando revela névoa do mapa sobre um cenário. */
  tracosFeitos: { camadas: string[]; g: string }[]
  combate: Combate | null
  ferramenta: Ferramenta
  pings: { id: number; x: number; y: number; em: number }[]
  increment: () => void
  setCamera: (camera: Camera) => void
  setGrid: (grid: Partial<GridSettings>) => void
  applyRoomGrid: (grid: GridSettings) => void
  addScene: (scene: RoomScene) => void
  moveScene: (id: string, x: number, y: number) => void
  updateScene: (id: string, changes: { nome?: string; oculto?: boolean; escala?: number; travado?: boolean }) => void
  setFerramenta: (ferramenta: Ferramenta) => void
  mostrarPing: (x: number, y: number) => void
  applyCombate: (combate: Combate | null) => void
  focarEm: (x: number, y: number) => void
  removeScene: (id: string) => void
  applyRoomScenes: (scenes: RoomScene[]) => void
  setFogMode: (mode: 'hide' | 'reveal' | null) => void
  setFogBrushRadius: (radius: number) => void
  pintarNevoa: (camada: string, pontos: number[], raio: number, revelar: boolean, g: string) => void
  registrarTraco: (camadas: string[], g: string) => void
  desfazerTraco: () => void
  cobrirNevoa: (camada: string) => void
  limparNevoa: (camada: string) => void
  clearFog: () => void
  applyNevoa: (nevoa: NevoaDaMesa) => void
  applyNevoaOp: (camada: string, op: OpNevoa) => void
  applyNevoaCamada: (camada: string, ops: OpNevoa[]) => void
}

export const useUiStore = create<UiState>((set) => ({
  counter: 0,
  camera: { x: 0, y: 0, zoom: 1 },
  grid: { enabled: true, cellSize: 70, opacity: 0.24 },
  scenes: [],
  nevoa: {},
  fogMode: null,
  fogBrushRadius: 30,
  tracosFeitos: [],
  combate: null,
  ferramenta: null,
  pings: [],
  increment: () => set((state) => ({ counter: state.counter + 1 })),
  setCamera: (camera) => set({ camera }),
  setGrid: (grid) => {
    if (isRoomMode()) {
      const nextGrid = { ...useUiStore.getState().grid, ...grid }
      sendRoomCommand({ type: 'grid:update', grid: nextGrid })
      return
    }
    set((state) => ({ grid: { ...state.grid, ...grid } }))
  },
  applyRoomGrid: (grid) => set({ grid }),
  addScene: (scene) => {
    if (isRoomMode()) { sendRoomCommand({ type: 'scene:add', scene }); return }
    set((state) => ({ scenes: [...state.scenes, scene] }))
  },
  moveScene: (id, x, y) => {
    if (isRoomMode()) { sendRoomCommand({ type: 'scene:move', id, x, y }); return }
    set((state) => ({ scenes: state.scenes.map((scene) => scene.id === id ? { ...scene, x, y } : scene) }))
  },
  updateScene: (id, changes) => {
    if (isRoomMode()) { sendRoomCommand({ type: 'scene:update', id, ...changes }); return }
    set((state) => ({ scenes: state.scenes.map((scene) => scene.id === id ? { ...scene, ...changes } : scene) }))
  },
  focarEm: (x, y) => set((state) => ({ camera: { zoom: state.camera.zoom, x: window.innerWidth / 2 - x * state.camera.zoom, y: window.innerHeight / 2 - y * state.camera.zoom } })),
  removeScene: (id) => {
    if (isRoomMode()) { sendRoomCommand({ type: 'scene:remove', id }); return }
    useUiStore.getState().applyNevoaCamada(id, [])
    set((state) => ({ scenes: state.scenes.filter((scene) => scene.id !== id) }))
  },
  /* Snapshot leve vem sem imagem: vale a que este navegador já tem. */
  applyRoomScenes: (scenes) => set((state) => ({
    scenes: scenes.flatMap((scene) => {
      if (scene.imageUrl) return [scene]
      const atual = state.scenes.find((item) => item.id === scene.id)
      return atual ? [{ ...scene, imageUrl: atual.imageUrl }] : []
    }),
  })),
  setFogMode: (fogMode) => set({ fogMode, ...(fogMode ? { ferramenta: null } : {}) }),
  setFerramenta: (ferramenta) => set({ ferramenta, ...(ferramenta ? { fogMode: null } : {}) }),
  mostrarPing: (x, y) => {
    const id = Date.now() + Math.random()
    set((state) => ({ pings: [...state.pings, { id, x, y, em: Date.now() }] }))
    setTimeout(() => set((state) => ({ pings: state.pings.filter((ping) => ping.id !== id) })), DURACAO_PING_MS)
  },
  applyCombate: (combate) => set({ combate }),
  setFogBrushRadius: (fogBrushRadius) => set({ fogBrushRadius }),
  /* O traço aparece na hora para quem pinta: o servidor só o repassa aos outros. */
  pintarNevoa: (camada, pontos, raio, revelar, g) => {
    useUiStore.getState().applyNevoaOp(camada, { tipo: 'traco', revelar, raio, pontos, g })
    sendRoomCommand({ type: 'fog:traco', camada, revelar, raio, pontos, g })
  },
  registrarTraco: (camadas, g) => set((state) => ({ tracosFeitos: [...state.tracosFeitos, { camadas, g }].slice(-TRACOS_DESFAZIVEIS) })),
  desfazerTraco: () => {
    const { tracosFeitos, nevoa, applyNevoaCamada } = useUiStore.getState()
    const ultimo = tracosFeitos[tracosFeitos.length - 1]
    if (!ultimo) return
    set({ tracosFeitos: tracosFeitos.slice(0, -1) })
    for (const camada of ultimo.camadas) {
      applyNevoaCamada(camada, (nevoa[camada] ?? []).filter((op) => op.tipo !== 'traco' || op.g !== ultimo.g))
      sendRoomCommand({ type: 'fog:desfazer', camada, g: ultimo.g })
    }
  },
  cobrirNevoa: (camada) => {
    if (sendRoomCommand({ type: 'fog:cobrir', camada })) return
    useUiStore.getState().applyNevoaCamada(camada, [{ tipo: 'cobrir' }])
  },
  limparNevoa: (camada) => {
    if (sendRoomCommand({ type: 'fog:limpar', camada })) return
    useUiStore.getState().applyNevoaCamada(camada, [])
  },
  applyNevoa: (nevoa) => set({ nevoa }),
  applyNevoaOp: (camada, op) => set((state) => ({ nevoa: { ...state.nevoa, [camada]: [...(state.nevoa[camada] ?? []), op] } })),
  applyNevoaCamada: (camada, ops) => set((state) => ({ nevoa: { ...state.nevoa, [camada]: ops } })),
  clearFog: () => {
    if (sendRoomCommand({ type: 'fog:clear' })) return
    set({ nevoa: {} })
  },
}))
