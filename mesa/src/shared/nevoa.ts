import type { NevoaDaMesa, OpNevoa } from './room-protocol.js'

/* A névoa de cada cenário fica em coordenadas relativas ao centro dele, para acompanhá-lo quando ele é movido.
   Esta camada guarda o que foi pintado fora de qualquer cenário, em coordenadas do mapa. */
export const CAMADA_MUNDO = 'mundo'

/* Cada traço é guardado: estes limites seguram o tamanho do estado da mesa, que é gravado a cada mudança. */
export const MAX_OPS_NEVOA = 20_000
export const MAX_NUMEROS_NEVOA = 200_000

export function tamanhoDaNevoa(nevoa: NevoaDaMesa) {
  let ops = 0
  let numeros = 0
  for (const lista of Object.values(nevoa)) {
    ops += lista.length
    for (const op of lista) if (op.tipo === 'traco') numeros += op.pontos.length
  }
  return { ops, numeros }
}

/* `cobrir` não tem limites próprios: ocupa a camada inteira. */
export function limitesDaOp(op: OpNevoa) {
  if (op.tipo === 'cobrir') return null
  if (op.tipo === 'ret') return { x0: op.x, y0: op.y, x1: op.x + op.largura, y1: op.y + op.altura }
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i + 1 < op.pontos.length; i += 2) {
    x0 = Math.min(x0, op.pontos[i]!)
    x1 = Math.max(x1, op.pontos[i]!)
    y0 = Math.min(y0, op.pontos[i + 1]!)
    y1 = Math.max(y1, op.pontos[i + 1]!)
  }
  return { x0: x0 - op.raio, y0: y0 - op.raio, x1: x1 + op.raio, y1: y1 + op.raio }
}

/* Mesas salvas antes do pincel livre guardavam a névoa por célula da grade. */
export function celulasParaOps(celulas: readonly string[], tamanhoCelula: number): OpNevoa[] {
  const linhas = new Map<number, number[]>()
  for (const celula of celulas) {
    const [x, y] = celula.split(',').map(Number)
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue
    linhas.set(y!, [...(linhas.get(y!) ?? []), x!])
  }
  const ops: OpNevoa[] = []
  for (const [y, colunas] of linhas) {
    colunas.sort((a, b) => a - b)
    let inicio = colunas[0]!
    for (let i = 1; i <= colunas.length; i++) {
      if (colunas[i] === colunas[i - 1]! + 1) continue
      ops.push({ tipo: 'ret', x: inicio * tamanhoCelula, y: y * tamanhoCelula, largura: (colunas[i - 1]! - inicio + 1) * tamanhoCelula, altura: tamanhoCelula })
      inicio = colunas[i]!
    }
  }
  return ops
}
