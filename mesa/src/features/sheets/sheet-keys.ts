import { create } from 'zustand'

/* A chave fica só neste navegador. Ela nunca vai para o token, o estado da sala, o chat ou o servidor do Tablebola. */
const STORAGE_KEY = 'tablebola.sheet-keys'

export function isValidSheetKey(value: string) {
  return /^ohi_[\w-]{20,100}$/.test(value)
}

function readStoredKeys(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(
      globalThis.localStorage?.getItem(STORAGE_KEY) ?? '{}',
    )
    if (typeof parsed !== 'object' || parsed === null) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === 'string' && isValidSheetKey(entry[1]),
      ),
    )
  } catch {
    return {}
  }
}

function writeStoredKeys(keys: Record<string, string>) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(keys))
  } catch {
    /* Sem armazenamento, a chave vale só até recarregar a página. */
  }
}

type SheetKeyState = {
  keys: Record<string, string>
  setKey: (sheetId: string, key: string) => void
  forgetKey: (sheetId: string) => void
}

export const useSheetKeyStore = create<SheetKeyState>((set, get) => ({
  keys: readStoredKeys(),
  setKey: (sheetId, key) => {
    const keys = { ...get().keys, [sheetId]: key }
    writeStoredKeys(keys)
    set({ keys })
  },
  forgetKey: (sheetId) => {
    const keys = { ...get().keys }
    delete keys[sheetId]
    writeStoredKeys(keys)
    set({ keys })
  },
}))
