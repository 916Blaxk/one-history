import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SheetApiError,
  fetchSheetPortrait,
  fetchSheetSummary,
  getSheetsOrigin,
  parseSummary,
  patchSheetResources,
} from '@/features/sheets/sheet-api'

const summary = {
  schemaVersion: 1,
  id: 'f1',
  nome: 'Kael',
  atualizado: 10,
  retrato: null,
  recursos: [
    { id: 'vida', rotulo: 'Vida', atual: 10, max: 25 },
    { id: 'mana', rotulo: 'Mana', atual: 30, max: 30 },
  ],
  acoes: [
    {
      id: 'corpo.destreza',
      grupo: 'corpo',
      categoria: 'Corpo',
      rotulo: 'Destreza',
      valor: 7,
      expressao: '1d20+7',
    },
  ],
  magias: [{ id: 'm1', nome: 'Faísca', elemento: 'fogo', custo: 3 }],
}

function reply(status: number, body: unknown = {}) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }))
}

afterEach(() => vi.unstubAllGlobals())

describe('parseSummary', () => {
  it('reads a valid summary and ignores unknown fields', () => {
    const result = parseSummary({ ...summary, novo: 'campo' }, 'f1')
    expect(result.nome).toBe('Kael')
    expect(result).not.toHaveProperty('novo')
    expect(result.acoes[0]).not.toHaveProperty('valor')
    expect(result.acoes[0].expressao).toBe('1d20+7')
  })

  it('refuses a newer schema version', () => {
    expect(() =>
      parseSummary({ ...summary, schemaVersion: 2 }, 'f1'),
    ).toThrow(expect.objectContaining({ kind: 'unsupported' }))
  })

  it('refuses another sheet and malformed data', () => {
    expect(() => parseSummary(summary, 'outra')).toThrow(SheetApiError)
    expect(() => parseSummary(null, 'f1')).toThrow(SheetApiError)
    expect(() =>
      parseSummary({ ...summary, recursos: summary.recursos.slice(0, 1) }, 'f1'),
    ).toThrow(SheetApiError)
  })

  it('drops malformed list items', () => {
    const result = parseSummary(
      { ...summary, acoes: [...summary.acoes, { id: 5 }], magias: ['x'] },
      'f1',
    )
    expect(result.acoes).toHaveLength(1)
    expect(result.magias).toHaveLength(0)
  })
})

describe('requests', () => {
  it('sends the key only as a bearer token and without cookies', async () => {
    const fetchMock = reply(200, summary)
    vi.stubGlobal('fetch', fetchMock)
    await fetchSheetSummary('https://fichas.test', 'f1', 'ohi_chave')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://fichas.test/api/integracao/fichas/f1/resumo')
    expect(url).not.toContain('ohi_chave')
    expect(init.credentials).toBe('omit')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer ohi_chave' })
  })

  it.each([
    [401, 'invalid-key'],
    [404, 'invalid-key'],
    [403, 'origin'],
    [400, 'bad-request'],
    [500, 'server'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    vi.stubGlobal('fetch', reply(status))
    await expect(
      fetchSheetSummary('https://fichas.test', 'f1', 'k'),
    ).rejects.toMatchObject({ kind })
  })

  it('maps a failed connection to a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('falhou')))
    await expect(
      fetchSheetSummary('https://fichas.test', 'f1', 'k'),
    ).rejects.toMatchObject({ kind: 'network' })
  })

  it('patches resources as JSON and returns the stored values', async () => {
    const fetchMock = reply(200, { recursos: summary.recursos, atualizado: 11 })
    vi.stubGlobal('fetch', fetchMock)
    const result = await patchSheetResources('https://fichas.test', 'f1', 'k', {
      vidaAtual: 10,
    })
    expect(result.atualizado).toBe(11)
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(init.method).toBe('PATCH')
    expect(init.body).toBe('{"vidaAtual":10}')
  })

  it('never sends the key to a portrait on another site', async () => {
    const fetchMock = reply(200)
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      fetchSheetPortrait('https://fichas.test', 'https://evil.test/a.png', 'k'),
    ).rejects.toBeInstanceOf(SheetApiError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('getSheetsOrigin', () => {
  it('accepts only http and https addresses', () => {
    expect(getSheetsOrigin('https://fichas.test/')).toBe('https://fichas.test')
    expect(getSheetsOrigin('javascript:alert(1)')).toBeNull()
    expect(getSheetsOrigin('sem-protocolo')).toBeNull()
    expect(getSheetsOrigin('')).toBeNull()
  })
})
