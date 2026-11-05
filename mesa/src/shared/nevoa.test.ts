import { describe, expect, it } from 'vitest'
import { celulasParaOps, limitesDaOp, tamanhoDaNevoa } from './nevoa'

describe('névoa', () => {
  it('converte células antigas em retângulos, juntando as vizinhas da mesma linha', () => {
    expect(celulasParaOps(['0,0', '1,0', '3,0', '-1,2', 'lixo'], 10)).toEqual([
      { tipo: 'ret', x: 0, y: 0, largura: 20, altura: 10 },
      { tipo: 'ret', x: 30, y: 0, largura: 10, altura: 10 },
      { tipo: 'ret', x: -10, y: 20, largura: 10, altura: 10 },
    ])
  })

  it('calcula os limites de um traço contando o raio', () => {
    expect(limitesDaOp({ tipo: 'traco', revelar: true, raio: 5, pontos: [0, 0, 10, -20] })).toEqual({ x0: -5, y0: -25, x1: 15, y1: 5 })
    expect(limitesDaOp({ tipo: 'cobrir' })).toBeNull()
  })

  it('conta operações e números de todas as camadas', () => {
    expect(tamanhoDaNevoa({
      mundo: [{ tipo: 'traco', revelar: false, raio: 1, pontos: [0, 0, 1, 1] }],
      c1: [{ tipo: 'cobrir' }, { tipo: 'traco', revelar: true, raio: 1, pontos: [2, 2] }],
    })).toEqual({ ops: 3, numeros: 6 })
  })
})
