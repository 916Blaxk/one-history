import { create } from 'zustand'
import type { RoomPlayer } from '@/shared/room-protocol'

export type RoomConnectionStatus =
  'connecting' | 'connected' | 'reconnecting' | 'offline'

type RoomUiState = {
  status: RoomConnectionStatus
  players: RoomPlayer[]
  playerId: string | null
  notice: string | null
  setStatus: (status: RoomConnectionStatus) => void
  setPlayers: (players: RoomPlayer[]) => void
  setPlayerId: (playerId: string | null) => void
  setNotice: (notice: string | null) => void
}

export const useRoomStore = create<RoomUiState>((set) => ({
  status: 'connecting',
  players: [],
  playerId: null,
  notice: null,
  setStatus: (status) => set({ status }),
  setPlayers: (players) => set({ players }),
  setPlayerId: (playerId) => set({ playerId }),
  setNotice: (notice) => set({ notice }),
}))
