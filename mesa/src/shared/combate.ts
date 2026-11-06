import type { Combate, EntradaCombate } from './room-protocol.js'

/* Quem ainda não rolou fica no fim, para a lista não pular enquanto todos rolam. */
export function ordenarCombate(lista: readonly EntradaCombate[]) {
  return [...lista].sort((a, b) => (b.iniciativa ?? -Infinity) - (a.iniciativa ?? -Infinity))
}

export function avancarVez(combate: Combate, direcao: 1 | -1): Combate {
  const ordem = ordenarCombate(combate.lista)
  if (!ordem.length) return { ...combate, vez: null }
  const atual = ordem.findIndex((item) => item.tokenId === combate.vez)
  if (atual < 0) return { ...combate, vez: ordem[0]!.tokenId }
  const proximo = atual + direcao
  if (proximo >= ordem.length) return { ...combate, rodada: combate.rodada + 1, vez: ordem[0]!.tokenId }
  if (proximo < 0) return { ...combate, rodada: Math.max(1, combate.rodada - 1), vez: ordem[ordem.length - 1]!.tokenId }
  return { ...combate, vez: ordem[proximo]!.tokenId }
}

export function tirarDoCombate(combate: Combate, tokenId: string): Combate {
  const base = combate.vez === tokenId ? avancarVez(combate, 1) : combate
  const lista = base.lista.filter((item) => item.tokenId !== tokenId)
  return { ...base, lista, vez: base.vez === tokenId ? null : base.vez }
}
