import { create } from 'zustand'
import { isRoomMode, sendRoomCommand } from '@mesa/features/rooms/room-commands'
import type { RoomScene } from '@mesa/shared/room-protocol'

type Camera = { x: number; y: number; zoom: number }
type GridSettings = { enabled: boolean; cellSize: number; opacity: number }

type UiState = {
  counter: number
  camera: Camera
  grid: GridSettings
  scenes: RoomScene[]
  fogCells: string[]
  fogMode: 'hide' | 'reveal' | null
  fogBrushRadius: number
  increment: () => void
  setCamera: (camera: Camera) => void
  setGrid: (grid: Partial<GridSettings>) => void
  applyRoomGrid: (grid: GridSettings) => void
  addScene: (scene: RoomScene) => void
  moveScene: (id: string, x: number, y: number) => void
  removeScene: (id: string) => void
  applyRoomScenes: (scenes: RoomScene[]) => void
  setFogMode: (mode: 'hide' | 'reveal' | null) => void
  setFogBrushRadius: (radius: number) => void
  paintFog: (x: number, y: number, radius: number, reveal: boolean) => void
  clearFog: () => void
  applyFogCells: (cells: string[]) => void
  applyFogUpdate: (cells: string[], reveal: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  counter: 0,
  camera: { x: 0, y: 0, zoom: 1 },
  grid: { enabled: true, cellSize: 70, opacity: 0.24 },
  scenes: [],
  fogCells: [],
  fogMode: null,
  fogBrushRadius: 2,
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
  removeScene: (id) => {
    if (isRoomMode()) { sendRoomCommand({ type: 'scene:remove', id }); return }
    set((state) => ({ scenes: state.scenes.filter((scene) => scene.id !== id) }))
  },
  applyRoomScenes: (scenes) => set({ scenes }),
  setFogMode: (fogMode) => set({ fogMode }),
  setFogBrushRadius: (fogBrushRadius) => set({ fogBrushRadius }),
  paintFog: (x, y, radius, reveal) => {
    if (isRoomMode()) { sendRoomCommand({ type: 'fog:paint', x, y, radius, reveal }); return }
    const { grid, fogCells } = useUiStore.getState()
    const next = new Set(fogCells)
    const centerX = Math.floor(x / grid.cellSize), centerY = Math.floor(y / grid.cellSize)
    for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
      if (dx * dx + dy * dy > radius * radius + 0.5) continue
      const key = `${centerX + dx},${centerY + dy}`
      if (reveal) next.delete(key); else next.add(key)
    }
    set({ fogCells: [...next] })
  },
  applyFogCells: (fogCells) => set({ fogCells }),
  applyFogUpdate: (cells, reveal) => set((state) => {
    const next = new Set(state.fogCells)
    for (const cell of cells) {
      if (reveal) next.delete(cell)
      else next.add(cell)
    }
    return { fogCells: [...next] }
  }),
  clearFog: () => {
    if (isRoomMode()) { sendRoomCommand({ type: 'fog:clear' }); return }
    set({ fogCells: [] })
  },
}))
