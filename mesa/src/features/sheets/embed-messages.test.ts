import { describe, expect, it } from 'vitest'
import { parseEmbedMessage } from '@/features/sheets/embed-messages'

const frame = {}
const context = { origin: 'https://fichas.test', frame, sheetId: 'f1' }
const roll = {
  tipo: 'oh:rolagem',
  schemaVersion: 1,
  fichaId: 'f1',
  acao: 'corpo.destreza',
  rotulo: 'Destreza',
  expressao: '1d20+7',
}
const event = (data: unknown, changes = {}) => ({
  origin: context.origin,
  source: frame,
  data,
  ...changes,
})

describe('parseEmbedMessage', () => {
  it('accepts a roll from the open sheet', () => {
    expect(parseEmbedMessage(event(roll), context)).toEqual({
      kind: 'roll',
      expression: '1d20+7',
      label: 'Destreza',
    })
  })

  it('accepts the ready and resources messages', () => {
    const base = { schemaVersion: 1, fichaId: 'f1' }
    expect(parseEmbedMessage(event({ ...base, tipo: 'oh:pronto' }), context)).toEqual({ kind: 'ready' })
    expect(parseEmbedMessage(event({ ...base, tipo: 'oh:recursos' }), context)).toEqual({ kind: 'resources' })
  })

  it('ignores another origin', () => {
    for (const origin of ['https://evil.test', 'https://fichas.test.evil.test', 'http://fichas.test', 'null'])
      expect(parseEmbedMessage(event(roll, { origin }), context)).toBeNull()
  })

  it('ignores another window', () => {
    expect(parseEmbedMessage(event(roll, { source: {} }), context)).toBeNull()
    expect(parseEmbedMessage(event(roll, { source: null }), { ...context, frame: null })).toBeNull()
  })

  it('ignores another sheet', () => {
    expect(parseEmbedMessage(event({ ...roll, fichaId: 'f2' }), context)).toBeNull()
  })

  it('ignores invalid expressions and labels', () => {
    for (const expressao of ['', 'alert(1)', '1d1', `${'1d6+'.repeat(11)}1`, 'x'.repeat(121), 5])
      expect(parseEmbedMessage(event({ ...roll, expressao }), context)).toBeNull()
    for (const rotulo of ['', '   ', 'x'.repeat(61), undefined, 5])
      expect(parseEmbedMessage(event({ ...roll, rotulo }), context)).toBeNull()
  })

  it('ignores malformed data and unknown types', () => {
    for (const data of [null, 'texto', 5, {}, { ...roll, tipo: 'outro' }, { ...roll, schemaVersion: '1' }])
      expect(parseEmbedMessage(event(data), context)).toBeNull()
  })

  it('reports a newer version without using the data', () => {
    expect(parseEmbedMessage(event({ ...roll, schemaVersion: 2 }), context)).toEqual({ kind: 'unsupported' })
  })
})
