import { create } from 'zustand'

type Camera = { x: number; y: number; zoom: number }
type GridSettings = { enabled: boolean; cellSize: number; opacity: number }

type UiState = {
  counter: number
  camera: Camera
  grid: GridSettings
  backgroundUrl: string | null
  increment: () => void
  setCamera: (camera: Camera) => void
  setGrid: (grid: Partial<GridSettings>) => void
  setBackgroundUrl: (url: string | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  counter: 0,
  camera: { x: 0, y: 0, zoom: 1 },
  grid: { enabled: true, cellSize: 70, opacity: 0.24 },
  backgroundUrl: null,
  increment: () => set((state) => ({ counter: state.counter + 1 })),
  setCamera: (camera) => set({ camera }),
  setGrid: (grid) => set((state) => ({ grid: { ...state.grid, ...grid } })),
  setBackgroundUrl: (backgroundUrl) => set({ backgroundUrl }),
}))
