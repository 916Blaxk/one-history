/* Chamadas ao site de fichas (One History). O contrato completo está em
   https://github.com/916Blaxk/one-history/blob/main/docs/contrato-integracao.md */
export const SUPPORTED_SCHEMA_VERSION = 1

export type SheetResource = {
  id: 'vida' | 'mana'
  rotulo: string
  atual: number
  max: number
}
export type SheetAction = {
  id: string
  categoria: string
  rotulo: string
  expressao: string
}
export type SheetSpell = {
  id: string
  nome: string
  elemento: string
  custo: number
}
export type SheetSummary = {
  schemaVersion: number
  id: string
  nome: string
  atualizado: number
  retrato: { versao: number; url: string } | null
  recursos: SheetResource[]
  acoes: SheetAction[]
  magias: SheetSpell[]
}
export type ResourcePatch = { vidaAtual?: number; manaAtual?: number }
export type ResourceResult = { recursos: SheetResource[]; atualizado: number }

export type SheetErrorKind =
  | 'invalid-key'
  | 'origin'
  | 'unsupported'
  | 'invalid-response'
  | 'bad-request'
  | 'network'
  | 'server'

const ERROR_MESSAGES: Record<SheetErrorKind, string> = {
  'invalid-key': 'Esta chave não abre a ficha. Ela pode ter sido revogada.',
  origin: 'O site de fichas não autorizou este endereço do Tablebola.',
  unsupported:
    'A ficha usa uma versão mais nova do formato. Atualize o Tablebola.',
  'invalid-response': 'O site de fichas enviou uma resposta inesperada.',
  'bad-request': 'O site de fichas recusou os valores enviados.',
  network: 'Sem conexão com o site de fichas. Tentando de novo…',
  server: 'O site de fichas está com problemas. Tentando de novo…',
}

export function sheetErrorMessage(kind: SheetErrorKind) {
  return ERROR_MESSAGES[kind]
}

export class SheetApiError extends Error {
  readonly kind: SheetErrorKind

  constructor(kind: SheetErrorKind) {
    super(ERROR_MESSAGES[kind])
    this.kind = kind
  }
}

export function getSheetsOrigin(
  raw: string | undefined = import.meta.env.VITE_FICHAS_URL,
) {
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.origin
      : null
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
const isText = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

function parseResources(value: unknown): SheetResource[] {
  if (!Array.isArray(value)) throw new SheetApiError('invalid-response')
  const resources = value.filter(
    (item): item is SheetResource =>
      isRecord(item) &&
      (item.id === 'vida' || item.id === 'mana') &&
      isText(item.rotulo) &&
      isNumber(item.atual) &&
      isNumber(item.max),
  )
  if (!resources.some((item) => item.id === 'vida'))
    throw new SheetApiError('invalid-response')
  if (!resources.some((item) => item.id === 'mana'))
    throw new SheetApiError('invalid-response')
  return resources
}

/* Campos novos são ignorados de propósito: acrescentar campo não muda a versão do contrato. */
export function parseSummary(value: unknown, expectedId: string): SheetSummary {
  if (!isRecord(value) || !isNumber(value.schemaVersion))
    throw new SheetApiError('invalid-response')
  if (value.schemaVersion > SUPPORTED_SCHEMA_VERSION)
    throw new SheetApiError('unsupported')
  if (
    value.id !== expectedId ||
    !isText(value.nome) ||
    !isNumber(value.atualizado) ||
    !Array.isArray(value.acoes) ||
    !Array.isArray(value.magias)
  )
    throw new SheetApiError('invalid-response')
  const portrait = value.retrato
  return {
    schemaVersion: value.schemaVersion,
    id: expectedId,
    nome: value.nome,
    atualizado: value.atualizado,
    retrato:
      isRecord(portrait) && isNumber(portrait.versao) && isText(portrait.url)
        ? { versao: portrait.versao, url: portrait.url }
        : null,
    recursos: parseResources(value.recursos),
    acoes: value.acoes
      .filter(
        (item): item is SheetAction =>
          isRecord(item) &&
          isText(item.id) &&
          isText(item.categoria) &&
          isText(item.rotulo) &&
          isText(item.expressao),
      )
      .map(({ id, categoria, rotulo, expressao }) => ({
        id,
        categoria,
        rotulo,
        expressao,
      })),
    magias: value.magias
      .filter(
        (item): item is SheetSpell =>
          isRecord(item) &&
          isText(item.id) &&
          isText(item.nome) &&
          isText(item.elemento) &&
          isNumber(item.custo),
      )
      .map(({ id, nome, elemento, custo }) => ({ id, nome, elemento, custo })),
  }
}

async function send(url: string, key: string, init: RequestInit = {}) {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      credentials: 'omit',
      headers: { ...init.headers, Authorization: `Bearer ${key}` },
    })
  } catch {
    throw new SheetApiError('network')
  }
  if (response.ok) return response
  if (response.status === 401 || response.status === 404)
    throw new SheetApiError('invalid-key')
  if (response.status === 403) throw new SheetApiError('origin')
  if (response.status === 400) throw new SheetApiError('bad-request')
  throw new SheetApiError('server')
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new SheetApiError('invalid-response')
  }
}

const sheetPath = (base: string, id: string) =>
  `${base}/api/integracao/fichas/${encodeURIComponent(id)}`

export async function fetchSheetSummary(
  base: string,
  id: string,
  key: string,
) {
  const response = await send(`${sheetPath(base, id)}/resumo`, key)
  return parseSummary(await readJson(response), id)
}

export async function patchSheetResources(
  base: string,
  id: string,
  key: string,
  patch: ResourcePatch,
): Promise<ResourceResult> {
  const response = await send(`${sheetPath(base, id)}/recursos`, key, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const body = await readJson(response)
  if (!isRecord(body) || !isNumber(body.atualizado))
    throw new SheetApiError('invalid-response')
  return { recursos: parseResources(body.recursos), atualizado: body.atualizado }
}

/* A URL vem na resposta do servidor: a chave só acompanha pedidos ao próprio site de fichas. */
export async function fetchSheetPortrait(
  base: string,
  portraitUrl: string,
  key: string,
) {
  const url = new URL(portraitUrl, base)
  if (url.origin !== base) throw new SheetApiError('invalid-response')
  const response = await send(url.href, key)
  return response.blob()
}
