import type { Token } from '@/features/tokens/token-types'
import {
  SheetApiError,
  type ResourcePatch,
  type ResourceResult,
  type SheetErrorKind,
  type SheetResource,
  type SheetSummary,
} from '@/features/sheets/sheet-api'

type SyncedValues = { hp: number; mana: number }
type SeenValues = { hp?: number; mana?: number }

/* `synced` é o último valor combinado com a ficha. `seen` é o último valor visto no token.
   Em sala, um token só muda depois que o servidor confirma. Comparar os dois impede que o
   valor antigo volte para a ficha enquanto a confirmação não chega. */
export type TokenSyncState = {
  synced: SyncedValues | null
  seen: SeenValues | null
  updatedAt: number
}
export type TokenResourceChanges = Partial<
  Pick<Token, 'hpCurrent' | 'hpMax' | 'manaCurrent' | 'manaMax'>
>
type TokenResources = Pick<
  Token,
  'hpCurrent' | 'hpMax' | 'manaCurrent' | 'manaMax'
>

export const emptySyncState = (): TokenSyncState => ({
  synced: null,
  seen: null,
  updatedAt: 0,
})

/* A ficha só aceita inteiros, e o token aceita decimais. */
const wholeNumber = (value: number | undefined) =>
  value === undefined ? undefined : Math.floor(value)

export function detectTokenEdit(state: TokenSyncState, token: TokenResources) {
  const hp = wholeNumber(token.hpCurrent)
  const mana = wholeNumber(token.manaCurrent)
  const next: TokenSyncState = { ...state, seen: { hp, mana } }
  if (!state.seen) return { state: next, patch: null }
  const patch: ResourcePatch = {}
  if (hp !== undefined && hp !== state.seen.hp && hp !== state.synced?.hp)
    patch.vidaAtual = hp
  if (
    mana !== undefined &&
    mana !== state.seen.mana &&
    mana !== state.synced?.mana
  )
    patch.manaAtual = mana
  return { state: next, patch: Object.keys(patch).length ? patch : null }
}

export function applySheetValues(
  state: TokenSyncState,
  token: TokenResources,
  resources: SheetResource[],
  updatedAt: number,
  force = false,
) {
  if (updatedAt < state.updatedAt) return { state, changes: null }
  const hp = resources.find((item) => item.id === 'vida')!
  const mana = resources.find((item) => item.id === 'mana')!
  const changes: TokenResourceChanges = {}
  const previous = state.synced
  if (
    wholeNumber(token.hpCurrent) !== hp.atual &&
    (force || previous?.hp !== hp.atual)
  )
    changes.hpCurrent = hp.atual
  if (
    wholeNumber(token.manaCurrent) !== mana.atual &&
    (force || previous?.mana !== mana.atual)
  )
    changes.manaCurrent = mana.atual
  /* O máximo vem sempre da ficha. */
  if (token.hpMax !== hp.max) changes.hpMax = hp.max
  if (token.manaMax !== mana.max) changes.manaMax = mana.max
  return {
    state: {
      ...state,
      updatedAt,
      synced: { hp: hp.atual, mana: mana.atual },
    },
    changes: Object.keys(changes).length ? changes : null,
  }
}

export type SheetLinkStatus = {
  summary?: SheetSummary
  error?: SheetErrorKind
}

export type SheetSyncDeps = {
  getTokens: () => Token[]
  subscribeTokens: (listener: () => void) => () => void
  getKey: (sheetId: string) => string | undefined
  subscribeKeys: (listener: () => void) => () => void
  canEdit: (token: Token) => boolean
  applyChanges: (tokenId: string, changes: TokenResourceChanges) => void
  fetchSummary: (sheetId: string, key: string) => Promise<SheetSummary>
  patchResources: (
    sheetId: string,
    key: string,
    patch: ResourcePatch,
  ) => Promise<ResourceResult>
  onStatus: (sheetId: string, status: SheetLinkStatus) => void
  pollMs?: number
  debounceMs?: number
}

const errorKind = (error: unknown): SheetErrorKind =>
  error instanceof SheetApiError ? error.kind : 'server'

/* Estes erros não se resolvem sozinhos: só tenta de novo com outra chave ou a pedido. */
const isBlocking = (kind: SheetErrorKind) =>
  kind === 'invalid-key' || kind === 'origin' || kind === 'unsupported'

export function createSheetSync(deps: SheetSyncDeps) {
  const pollMs = deps.pollMs ?? 3000
  const debounceMs = deps.debounceMs ?? 300
  const states = new Map<string, TokenSyncState>()
  const statuses = new Map<string, SheetLinkStatus>()
  const blocked = new Map<string, string>()
  const fetching = new Set<string>()
  const pushing = new Set<string>()
  const pending = new Map<string, ResourcePatch>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  let interval: ReturnType<typeof setInterval> | undefined
  let unsubscribe: (() => void)[] = []
  let stopped = false

  const stateKey = (token: Token) => `${token.id}:${token.characterId}`
  const linkedTokens = () =>
    deps
      .getTokens()
      .filter(
        (token) => token.characterId && deps.getKey(token.characterId),
      )

  function report(sheetId: string, status: SheetLinkStatus) {
    statuses.set(sheetId, status)
    deps.onStatus(sheetId, status)
  }

  function applyValues(
    sheetId: string,
    resources: SheetResource[],
    updatedAt: number,
    forceTokenId?: string,
  ) {
    for (const token of linkedTokens()) {
      if (token.characterId !== sheetId) continue
      const key = stateKey(token)
      const result = applySheetValues(
        states.get(key) ?? emptySyncState(),
        token,
        resources,
        updatedAt,
        token.id === forceTokenId,
      )
      states.set(key, result.state)
      if (result.changes && deps.canEdit(token))
        deps.applyChanges(token.id, result.changes)
    }
  }

  async function pollSheet(sheetId: string) {
    const key = deps.getKey(sheetId)
    if (!key || fetching.has(sheetId) || blocked.get(sheetId) === key) return
    fetching.add(sheetId)
    try {
      const summary = await deps.fetchSummary(sheetId, key)
      if (stopped) return
      applyValues(sheetId, summary.recursos, summary.atualizado)
      report(sheetId, { summary })
    } catch (error) {
      if (stopped) return
      const kind = errorKind(error)
      if (isBlocking(kind)) blocked.set(sheetId, key)
      report(sheetId, { summary: statuses.get(sheetId)?.summary, error: kind })
    } finally {
      fetching.delete(sheetId)
    }
  }

  function poll() {
    const sheets = new Set(linkedTokens().map((token) => token.characterId!))
    for (const sheetId of sheets) void pollSheet(sheetId)
    for (const tokenId of pending.keys()) schedulePush(tokenId)
  }

  async function push(tokenId: string) {
    timers.delete(tokenId)
    const token = deps.getTokens().find((item) => item.id === tokenId)
    const patch = pending.get(tokenId)
    if (!token?.characterId || !patch || pushing.has(tokenId)) return
    const sheetId = token.characterId
    const key = deps.getKey(sheetId)
    if (!key || blocked.get(sheetId) === key) {
      pending.delete(tokenId)
      return
    }
    pending.delete(tokenId)
    pushing.add(tokenId)
    try {
      const result = await deps.patchResources(sheetId, key, patch)
      if (stopped) return
      applyValues(sheetId, result.recursos, result.atualizado, tokenId)
      const summary = statuses.get(sheetId)?.summary
      report(sheetId, {
        summary: summary && {
          ...summary,
          recursos: result.recursos,
          atualizado: result.atualizado,
        },
      })
    } catch (error) {
      if (stopped) return
      const kind = errorKind(error)
      if (isBlocking(kind)) blocked.set(sheetId, key)
      /* Sem conexão, a edição fica guardada para a próxima tentativa. */
      if (kind === 'network' || kind === 'server')
        pending.set(tokenId, { ...patch, ...pending.get(tokenId) })
      report(sheetId, { summary: statuses.get(sheetId)?.summary, error: kind })
    } finally {
      pushing.delete(tokenId)
    }
  }

  function schedulePush(tokenId: string) {
    if (timers.has(tokenId) || pushing.has(tokenId)) return
    timers.set(
      tokenId,
      setTimeout(() => void push(tokenId), debounceMs),
    )
  }

  function checkTokens() {
    if (stopped) return
    for (const token of linkedTokens()) {
      const key = stateKey(token)
      const result = detectTokenEdit(
        states.get(key) ?? emptySyncState(),
        token,
      )
      states.set(key, result.state)
      if (result.patch) {
        pending.set(token.id, { ...pending.get(token.id), ...result.patch })
        schedulePush(token.id)
      }
    }
  }

  return {
    start() {
      checkTokens()
      poll()
      interval = setInterval(poll, pollMs)
      unsubscribe = [
        deps.subscribeTokens(checkTokens),
        deps.subscribeKeys(() => {
          checkTokens()
          poll()
        }),
      ]
    },
    stop() {
      stopped = true
      clearInterval(interval)
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
      for (const off of unsubscribe) off()
    },
    refresh(sheetId: string) {
      blocked.delete(sheetId)
      void pollSheet(sheetId)
    },
  }
}
