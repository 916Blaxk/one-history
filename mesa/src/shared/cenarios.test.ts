import { describe, expect, it } from 'vitest'
import { cenarioNoPonto } from './cenarios'

const cena = (id: string, x: number, y: number, escala?: number) => ({ id, x, y, width: 100, height: 100, escala })

describe('cenário sob um ponto', () => {
  it('o cenário tem o centro em x e y, e a escala muda o tamanho', () => {
    expect(cenarioNoPonto([cena('a', 0, 0)], 50, -50)?.id).toBe('a')
    expect(cenarioNoPonto([cena('a', 0, 0)], 51, 0)).toBeUndefined()
    expect(cenarioNoPonto([cena('a', 0, 0, 2)], 100, 0)?.id).toBe('a')
  })

  it('com cenários sobrepostos, vale o de cima, que é o último da lista', () => {
    expect(cenarioNoPonto([cena('baixo', 0, 0), cena('cima', 10, 0)], 5, 0)?.id).toBe('cima')
    expect(cenarioNoPonto([cena('baixo', 0, 0), cena('cima', 10, 0)], -45, 0)?.id).toBe('baixo')
  })
})
