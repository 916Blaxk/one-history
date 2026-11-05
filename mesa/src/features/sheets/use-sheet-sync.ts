import { useEffect } from 'react'
import { create } from 'zustand'
import { isRoomMode } from '@/features/rooms/room-commands'
import { useRoomStore } from '@/features/rooms/room-store'
import {
  fetchSheetSummary,
  getSheetsOrigin,
  patchSheetResources,
} from '@/features/sheets/sheet-api'
import { useSheetKeyStore } from '@/features/sheets/sheet-keys'
import {
  createSheetSync,
  type SheetLinkStatus,
} from '@/features/sheets/sheet-sync'
import { useTokenStore } from '@/features/tokens/token-store'
import type { Token } from '@/features/tokens/token-types'
import { can } from '@/shared/permissions'

type SheetStatusState = {
  statuses: Record<string, SheetLinkStatus>
  refresh: (sheetId: string) => void
}

export const useSheetStatusStore = create<SheetStatusState>(() => ({
  statuses: {},
  refresh: () => {},
}))

function canEditToken(token: Token) {
  if (!isRoomMode()) return true
  const { role, playerKey } = useRoomStore.getState()
  return Boolean(
    role && playerKey && can(role, 'token:update', token, playerKey),
  )
}

/* Fica ligado com a mesa aberta: a sincronização continua com o painel do token fechado. */
export function useSheetSync() {
  useEffect(() => {
    const base = getSheetsOrigin()
    if (!base) return
    const sync = createSheetSync({
      getTokens: () => useTokenStore.getState().tokens,
      subscribeTokens: (listener) => useTokenStore.subscribe(listener),
      getKey: (sheetId) => useSheetKeyStore.getState().keys[sheetId],
      subscribeKeys: (listener) => useSheetKeyStore.subscribe(listener),
      canEdit: canEditToken,
      applyChanges: (tokenId, changes) =>
        useTokenStore.getState().updateToken(tokenId, changes),
      fetchSummary: (sheetId, key) => fetchSheetSummary(base, sheetId, key),
      patchResources: (sheetId, key, patch) =>
        patchSheetResources(base, sheetId, key, patch),
      onStatus: (sheetId, status) =>
        useSheetStatusStore.setState((state) => ({
          statuses: { ...state.statuses, [sheetId]: status },
        })),
    })
    useSheetStatusStore.setState({ refresh: sync.refresh })
    sync.start()
    return () => {
      sync.stop()
      useSheetStatusStore.setState({ refresh: () => {}, statuses: {} })
    }
  }, [])
}
