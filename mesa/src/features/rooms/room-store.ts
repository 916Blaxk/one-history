import { create } from 'zustand'
import type { RoomPlayer } from '@mesa/shared/room-protocol'
import type { RoomRole } from '@mesa/shared/permissions'

export type RoomConnectionStatus =
  'connecting' | 'connected' | 'reconnecting' | 'offline'

type RoomUiState = {
  status: RoomConnectionStatus
  players: RoomPlayer[]
  playerId: string | null
  playerKey: string | null
  role: RoomRole | null
  notice: string | null
  setStatus: (status: RoomConnectionStatus) => void
  setPlayers: (players: RoomPlayer[]) => void
  setPlayerId: (playerId: string | null) => void
  setPlayerKey: (playerKey: string | null) => void
  setRole: (role: RoomRole | null) => void
  setNotice: (notice: string | null) => void
}

export const useRoomStore = create<RoomUiState>((set) => ({
  status: 'connecting',
  players: [],
  playerId: null,
  playerKey: null,
  role: null,
  notice: null,
  setStatus: (status) => set({ status }),
  setPlayers: (players) => set({ players }),
  setPlayerId: (playerId) => set({ playerId }),
  setPlayerKey: (playerKey) => set({ playerKey }),
  setRole: (role) => set({ role }),
  setNotice: (notice) => set({ notice }),
}))
