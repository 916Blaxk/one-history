import { describe, expect, it } from 'vitest'
import { avancarVez, ordenarCombate, tirarDoCombate } from './combate'
import type { Combate } from './room-protocol'

const combate: Combate = {
  rodada: 1,
  vez: null,
  lista: [
    { tokenId: 'b', iniciativa: 5 },
    { tokenId: 'c', iniciativa: null },
    { tokenId: 'a', iniciativa: 18 },
  ],
}

describe('combate', () => {
  it('ordena da maior iniciativa para a menor, com quem não rolou no fim', () => {
    expect(ordenarCombate(combate.lista).map((item) => item.tokenId)).toEqual(['a', 'b', 'c'])
  })

  it('começa no primeiro e passa para a próxima rodada ao chegar no fim', () => {
    let atual = avancarVez(combate, 1)
    expect(atual).toMatchObject({ vez: 'a', rodada: 1 })
    atual = avancarVez(atual, 1)
    atual = avancarVez(atual, 1)
    expect(atual).toMatchObject({ vez: 'c', rodada: 1 })
    atual = avancarVez(atual, 1)
    expect(atual).toMatchObject({ vez: 'a', rodada: 2 })
  })

  it('volta a vez sem deixar a rodada abaixo de 1', () => {
    expect(avancarVez({ ...combate, vez: 'a', rodada: 2 }, -1)).toMatchObject({ vez: 'c', rodada: 1 })
    expect(avancarVez({ ...combate, vez: 'a', rodada: 1 }, -1)).toMatchObject({ vez: 'c', rodada: 1 })
  })

  it('passa a vez adiante quando quem está na vez sai', () => {
    const atual = tirarDoCombate({ ...combate, vez: 'a' }, 'a')
    expect(atual.vez).toBe('b')
    expect(atual.lista).toHaveLength(2)
    expect(tirarDoCombate({ rodada: 1, vez: 'x', lista: [{ tokenId: 'x', iniciativa: 1 }] }, 'x').vez).toBeNull()
  })
})
