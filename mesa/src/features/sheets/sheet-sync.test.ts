import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SheetApiError,
  type ResourcePatch,
  type ResourceResult,
  type SheetSummary,
} from '@/features/sheets/sheet-api'
import {
  applySheetValues,
  createSheetSync,
  detectTokenEdit,
  emptySyncState,
  type SheetLinkStatus,
  type TokenResourceChanges,
} from '@/features/sheets/sheet-sync'
import type { Token } from '@/features/tokens/token-types'

const SECRET = 'ohi_segredo-que-nao-pode-vazar'
const resources = (hp: number, mana = 30, hpMax = 25, manaMax = 30) => [
  { id: 'vida' as const, rotulo: 'Vida', atual: hp, max: hpMax },
  { id: 'mana' as const, rotulo: 'Mana', atual: mana, max: manaMax },
]
const makeSummary = (hp: number, atualizado: number): SheetSummary => ({
  schemaVersion: 1,
  id: 'f1',
  nome: 'Kael',
  atualizado,
  retrato: null,
  recursos: resources(hp),
  acoes: [],
  magias: [],
})
const makeToken = (changes: Partial<Token> = {}): Token => ({
  id: 't1',
  name: 'Kael',
  x: 0,
  y: 0,
  size: 1,
  rotation: 0,
  spriteIds: [],
  activeSpriteId: null,
  flipX: false,
  color: '#000000',
  ownerIds: [],
  hidden: false,
  characterId: 'f1',
  ...changes,
})

describe('detectTokenEdit', () => {
  it('only records the token on the first look', () => {
    const { state, patch } = detectTokenEdit(emptySyncState(), { hpCurrent: 5 })
    expect(patch).toBeNull()
    expect(state.seen).toEqual({ hp: 5, mana: undefined })
  })

  it('sends a real token edit, rounded down', () => {
    const state = { synced: { hp: 10, mana: 30 }, seen: { hp: 10, mana: 30 }, updatedAt: 1 }
    expect(detectTokenEdit(state, { hpCurrent: 7.5, manaCurrent: 30 }).patch).toEqual({ vidaAtual: 7 })
  })

  it('does not send a value that came from the sheet', () => {
    const state = { synced: { hp: 20, mana: 30 }, seen: { hp: 10, mana: 30 }, updatedAt: 1 }
    expect(detectTokenEdit(state, { hpCurrent: 20, manaCurrent: 30 }).patch).toBeNull()
  })

  it('does not send the old value while the room has not confirmed the new one', () => {
    const state = { synced: { hp: 20, mana: 30 }, seen: { hp: 10, mana: 30 }, updatedAt: 1 }
    expect(detectTokenEdit(state, { hpCurrent: 10, manaCurrent: 30 }).patch).toBeNull()
  })

  it('ignores a cleared field', () => {
    const state = { synced: { hp: 10, mana: 30 }, seen: { hp: 10, mana: 30 }, updatedAt: 1 }
    expect(detectTokenEdit(state, { manaCurrent: 30 }).patch).toBeNull()
  })
})

describe('applySheetValues', () => {
  it('fills the token on the first read', () => {
    expect(applySheetValues(emptySyncState(), {}, resources(10), 5).changes).toEqual({
      hpCurrent: 10,
      hpMax: 25,
      manaCurrent: 30,
      manaMax: 30,
    })
  })

  it('ignores an older response', () => {
    const state = { synced: { hp: 10, mana: 30 }, seen: null, updatedAt: 9 }
    const result = applySheetValues(state, {}, resources(1), 5)
    expect(result.changes).toBeNull()
    expect(result.state).toBe(state)
  })

  it('keeps a pending token edit when the sheet did not change', () => {
    const state = { synced: { hp: 10, mana: 30 }, seen: null, updatedAt: 1 }
    const token = { hpCurrent: 4, hpMax: 25, manaCurrent: 30, manaMax: 30 }
    expect(applySheetValues(state, token, resources(10), 2).changes).toBeNull()
  })

  it('always takes the maximum from the sheet', () => {
    const state = { synced: { hp: 10, mana: 30 }, seen: null, updatedAt: 1 }
    const token = { hpCurrent: 10, hpMax: 999, manaCurrent: 30, manaMax: 30 }
    expect(applySheetValues(state, token, resources(10), 2).changes).toEqual({ hpMax: 25 })
  })

  it('forces the stored value after a save that was cut to the maximum', () => {
    const state = { synced: { hp: 25, mana: 30 }, seen: null, updatedAt: 1 }
    const token = { hpCurrent: 5000, hpMax: 25, manaCurrent: 30, manaMax: 30 }
    expect(applySheetValues(state, token, resources(25), 2, true).changes).toEqual({ hpCurrent: 25 })
  })
})

describe('createSheetSync', () => {
  let tokens: Token[]
  let listeners: (() => void)[]
  let applied: TokenResourceChanges[]
  let fetchSummary: ReturnType<typeof vi.fn<(id: string, key: string) => Promise<SheetSummary>>>
  let patchResources: ReturnType<
    typeof vi.fn<(id: string, key: string, patch: ResourcePatch) => Promise<ResourceResult>>
  >
  let onStatus: ReturnType<typeof vi.fn<(id: string, status: SheetLinkStatus) => void>>
  let sheetHp: number
  let version: number
  let stop: () => void

  /* Simula a sala: o token só muda depois de a mudança voltar do servidor. */
  function setToken(changes: Partial<Token>) {
    tokens = tokens.map((token) => ({ ...token, ...changes }))
    listeners.forEach((listener) => listener())
  }
  function startSync(canEdit = true, key: string | undefined = SECRET) {
    const sync = createSheetSync({
      getTokens: () => tokens,
      subscribeTokens: (listener) => {
        listeners.push(listener)
        return () => {}
      },
      getKey: () => key,
      subscribeKeys: () => () => {},
      canEdit: () => canEdit,
      applyChanges: (_id, changes) => {
        applied.push(changes)
        setTimeout(() => setToken(changes), 10)
      },
      fetchSummary,
      patchResources,
      onStatus,
    })
    sync.start()
    stop = sync.stop
    return sync
  }

  beforeEach(() => {
    vi.useFakeTimers()
    tokens = [makeToken()]
    listeners = []
    applied = []
    sheetHp = 10
    version = 1
    fetchSummary = vi.fn(async () => makeSummary(sheetHp, version))
    patchResources = vi.fn(async (_id: string, _key: string, patch: ResourcePatch) => {
      sheetHp = Math.min(patch.vidaAtual ?? sheetHp, 25)
      version += 1
      return { recursos: resources(sheetHp), atualizado: version }
    })
    onStatus = vi.fn()
  })
  afterEach(() => {
    stop?.()
    vi.useRealTimers()
  })

  it('does not poll without a key', async () => {
    startSync(true, '')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchSummary).not.toHaveBeenCalled()
  })

  it('does not poll a token without a linked sheet', async () => {
    tokens = [makeToken({ characterId: undefined })]
    startSync()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchSummary).not.toHaveBeenCalled()
  })

  it('brings sheet values to the token without sending them back', async () => {
    startSync()
    await vi.advanceTimersByTimeAsync(100)
    expect(tokens[0].hpCurrent).toBe(10)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(patchResources).not.toHaveBeenCalled()
    expect(applied).toHaveLength(1)
  })

  it('sends a token edit once, without a loop', async () => {
    startSync()
    await vi.advanceTimersByTimeAsync(100)
    setToken({ hpCurrent: 4 })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(patchResources).toHaveBeenCalledTimes(1)
    expect(patchResources.mock.calls[0][2]).toEqual({ vidaAtual: 4 })
    expect(tokens[0].hpCurrent).toBe(4)
  })

  it('brings a sheet change to the token within one poll', async () => {
    startSync()
    await vi.advanceTimersByTimeAsync(100)
    sheetHp = 18
    version = 2
    await vi.advanceTimersByTimeAsync(3100)
    expect(tokens[0].hpCurrent).toBe(18)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(patchResources).not.toHaveBeenCalled()
  })

  it('ends with the sheet maximum on both sides', async () => {
    startSync()
    await vi.advanceTimersByTimeAsync(100)
    setToken({ hpCurrent: 5000 })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(sheetHp).toBe(25)
    expect(tokens[0].hpCurrent).toBe(25)
    expect(patchResources).toHaveBeenCalledTimes(1)
  })

  it('does not change a token this player cannot edit', async () => {
    startSync(false)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(applied).toHaveLength(0)
    expect(onStatus).toHaveBeenCalled()
  })

  it('stops asking after a revoked key and reports it', async () => {
    fetchSummary.mockRejectedValue(new SheetApiError('invalid-key'))
    startSync()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchSummary).toHaveBeenCalledTimes(1)
    expect(onStatus).toHaveBeenLastCalledWith('f1', { summary: undefined, error: 'invalid-key' })
  })

  it('tries again after a network failure and keeps the edit', async () => {
    startSync()
    await vi.advanceTimersByTimeAsync(100)
    patchResources.mockRejectedValueOnce(new SheetApiError('network'))
    setToken({ hpCurrent: 4 })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(patchResources.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(sheetHp).toBe(4)
  })

  it('tries again when asked after a blocking error', async () => {
    fetchSummary.mockRejectedValueOnce(new SheetApiError('invalid-key'))
    const sync = startSync()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchSummary).toHaveBeenCalledTimes(1)
    sync.refresh('f1')
    await vi.advanceTimersByTimeAsync(10)
    expect(fetchSummary).toHaveBeenCalledTimes(2)
  })

  it('never puts the key in what goes to the room', async () => {
    startSync()
    await vi.advanceTimersByTimeAsync(100)
    setToken({ hpCurrent: 4 })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(applied.length).toBeGreaterThan(0)
    expect(JSON.stringify(applied)).not.toContain(SECRET)
    expect(JSON.stringify(tokens)).not.toContain(SECRET)
    expect(fetchSummary.mock.calls[0][1]).toBe(SECRET)
  })

  it('stops all work when closed', async () => {
    startSync()
    await vi.advanceTimersByTimeAsync(100)
    const calls = fetchSummary.mock.calls.length
    stop()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchSummary).toHaveBeenCalledTimes(calls)
  })
})
