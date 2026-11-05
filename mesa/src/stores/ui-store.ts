import { create } from 'zustand'
import { isRoomMode, sendRoomCommand } from '@mesa/features/rooms/room-commands'
import type { NevoaDaMesa, OpNevoa, RoomScene } from '@mesa/shared/room-protocol'

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
  increment: () => void
  setCamera: (camera: Camera) => void
  setGrid: (grid: Partial<GridSettings>) => void
  applyRoomGrid: (grid: GridSettings) => void
  addScene: (scene: RoomScene) => void
  moveScene: (id: string, x: number, y: number) => void
  updateScene: (id: string, changes: { nome?: string; oculto?: boolean }) => void
  focarEm: (x: number, y: number) => void
  removeScene: (id: string) => void
  applyRoomScenes: (scenes: RoomScene[]) => void
  setFogMode: (mode: 'hide' | 'reveal' | null) => void
  setFogBrushRadius: (radius: number) => void
  pintarNevoa: (camada: string, pontos: number[], raio: number, revelar: boolean) => void
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
  applyRoomScenes: (scenes) => set({ scenes }),
  setFogMode: (fogMode) => set({ fogMode }),
  setFogBrushRadius: (fogBrushRadius) => set({ fogBrushRadius }),
  /* O traço aparece na hora para quem pinta: o servidor só o repassa aos outros. */
  pintarNevoa: (camada, pontos, raio, revelar) => {
    useUiStore.getState().applyNevoaOp(camada, { tipo: 'traco', revelar, raio, pontos })
    sendRoomCommand({ type: 'fog:traco', camada, revelar, raio, pontos })
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
