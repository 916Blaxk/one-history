import { create } from 'zustand'
import { isRoomMode, sendRoomCommand } from '@/features/rooms/room-commands'

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
  applyRoomGrid: (grid: GridSettings) => void
  setBackgroundUrl: (url: string | null) => void
  applyRoomBackgroundUrl: (url: string | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  counter: 0,
  camera: { x: 0, y: 0, zoom: 1 },
  grid: { enabled: true, cellSize: 70, opacity: 0.24 },
  backgroundUrl: null,
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
  setBackgroundUrl: (backgroundUrl) => {
    if (isRoomMode() && backgroundUrl) {
      sendRoomCommand({ type: 'background:update', backgroundUrl })
      return
    }
    set({ backgroundUrl })
  },
  applyRoomBackgroundUrl: (backgroundUrl) => set({ backgroundUrl }),
}))
