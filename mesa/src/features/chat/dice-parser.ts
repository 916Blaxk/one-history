import type {
  DiceGroupResult,
  DiceRollResult,
  DiceSelection,
  DieResult,
  FlatModifier,
} from './dice-types.js'

export class DiceExpressionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DiceExpressionError'
  }
}

export type DiceRandom = (sides: number) => number

export function secureRandomInt(sides: number): number {
  if (!Number.isInteger(sides) || sides < 2 || sides > 1000) {
    throw new DiceExpressionError('Os dados precisam ter entre 2 e 1000 lados.')
  }
  const range = 0x1_0000_0000
  const limit = Math.floor(range / sides) * sides
  const sample = new Uint32Array(1)
  do {
    crypto.getRandomValues(sample)
  } while (sample[0] >= limit)
  return (sample[0] % sides) + 1
}

function rollGroup(
  count: number,
  sides: number,
  sign: 1 | -1,
  selection: DiceSelection | undefined,
  selectionCount: number | undefined,
  exploding: boolean,
  random: DiceRandom,
): DiceGroupResult {
  const dice: DieResult[] = []
  let rerolls = 0
  let explosionLimitReached = false
  const roll = () => {
    const value = random(sides)
    if (!Number.isInteger(value) || value < 1 || value > sides)
      throw new DiceExpressionError(
        'A fonte aleatória retornou um resultado inválido.',
      )
    return value
  }

  for (let index = 0; index < count; index += 1) {
    const rolls: number[] = []
    let value = roll()
    rolls.push(value)
    while (exploding && value === sides && rerolls < 100) {
      rerolls += 1
      value = roll()
      rolls.push(value)
    }
    if (exploding && value === sides && rerolls === 100)
      explosionLimitReached = true
    dice.push({
      rolls,
      total: rolls.reduce((sum, roll) => sum + roll, 0),
      kept: true,
    })
  }

  if (selection && selectionCount !== undefined) {
    const descending = selection === 'kh' || selection === 'dh'
    const ranked = dice
      .map((die, index) => ({ index, total: die.total }))
      .sort(
        (a, b) =>
          (descending ? b.total - a.total : a.total - b.total) ||
          a.index - b.index,
      )
    const chosen = new Set(
      ranked.slice(0, selectionCount).map((die) => die.index),
    )
    dice.forEach((die, index) => {
      die.kept =
        selection === 'kh' || selection === 'kl'
          ? chosen.has(index)
          : !chosen.has(index)
    })
  }

  const keptTotal = dice.reduce(
    (sum, die) => sum + (die.kept ? die.total : 0),
    0,
  )
  const criticalEligible =
    sides === 20 &&
    (count === 1 ||
      ((selection === 'kh' || selection === 'kl') &&
        dice.filter((die) => die.kept).length === 1))
  const chosenD20 = criticalEligible ? dice.find((die) => die.kept) : undefined
  return {
    count,
    sides,
    sign,
    selection,
    selectionCount,
    exploding,
    explosionLimitReached,
    dice,
    keptTotal,
    modifier: 0,
    total: sign * keptTotal,
    critical: chosenD20?.rolls[0] === 20,
    criticalFailure: chosenD20?.rolls[0] === 1,
  }
}

export function rollDice(
  expression: string,
  random: DiceRandom = secureRandomInt,
): DiceRollResult {
  const original = expression.trim()
  if (!original)
    throw new DiceExpressionError('Digite uma expressão de dados, como 2d6+3.')

  const groups: DiceGroupResult[] = []
  const flatModifiers: FlatModifier[] = []
  let total = 0
  let cursor = 0
  let firstTerm = true

  while (cursor < original.length) {
    while (/\s/.test(original[cursor] ?? '')) cursor += 1
    if (cursor >= original.length) break

    let sign: 1 | -1 = 1
    const signChar = original[cursor]
    if (signChar === '+' || signChar === '-') {
      sign = signChar === '-' ? -1 : 1
      cursor += 1
      while (/\s/.test(original[cursor] ?? '')) cursor += 1
      if (cursor >= original.length)
        throw new DiceExpressionError(
          'Está faltando um dado ou número depois do sinal.',
        )
    } else if (!firstTerm) {
      throw new DiceExpressionError(
        'Separe cada dado ou modificador com + ou -.',
      )
    }
    firstTerm = false

    const remaining = original.slice(cursor)
    const diceMatch = remaining.match(
      /^(?:(\d*)[dD](\d+))(?:\s*(kh|kl|dh|dl)\s*(\d+))?(!)?/i,
    )
    if (diceMatch) {
      const count = diceMatch[1] ? Number(diceMatch[1]) : 1
      const sides = Number(diceMatch[2])
      const selection = diceMatch[3]?.toLowerCase() as DiceSelection | undefined
      const selectionCount = diceMatch[4] ? Number(diceMatch[4]) : undefined
      const exploding = Boolean(diceMatch[5])
      if (!Number.isInteger(count) || count < 1 || count > 100)
        throw new DiceExpressionError(
          'Cada grupo precisa rolar de 1 a 100 dados.',
        )
      if (!Number.isInteger(sides) || sides < 2 || sides > 1000)
        throw new DiceExpressionError(
          'Cada dado precisa ter de 2 a 1000 lados.',
        )
      if (
        selection &&
        (!selectionCount ||
          selectionCount < 1 ||
          selectionCount > count ||
          ((selection === 'dh' || selection === 'dl') &&
            selectionCount >= count))
      ) {
        throw new DiceExpressionError(
          'A quantidade de dados mantidos ou descartados não é válida para esse grupo.',
        )
      }
      const group = rollGroup(
        count,
        sides,
        sign,
        selection,
        selectionCount,
        exploding,
        random,
      )
      groups.push(group)
      total += group.total
      cursor += diceMatch[0].length
    } else {
      const numberMatch = remaining.match(/^\d+/)
      if (!numberMatch)
        throw new DiceExpressionError(
          `Expressão inválida perto de “${remaining.slice(0, 12)}”. Use formatos como 2d6+3.`,
        )
      const value = Number(numberMatch[0]) * sign
      const previousGroup = groups.at(-1)
      if (previousGroup) {
        previousGroup.modifier += value
        previousGroup.total += value
        total += value
      } else {
        flatModifiers.push({ value })
        total += value
      }
      cursor += numberMatch[0].length
    }

    if (cursor < original.length && !/[+\-\s]/.test(original[cursor])) {
      throw new DiceExpressionError(
        `Expressão inválida perto de “${original.slice(cursor, cursor + 12)}”.`,
      )
    }
  }

  if (groups.length === 0 && flatModifiers.length === 0)
    throw new DiceExpressionError(
      'A expressão não contém dados nem modificadores.',
    )
  return { expression: original, total, groups, flatModifiers }
}
