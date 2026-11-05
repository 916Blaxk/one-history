import { describe, expect, it } from 'vitest'
import { DiceExpressionError, rollDice } from '@mesa/features/chat/dice-parser'

function sequence(values: number[]) {
  let index = 0
  return (sides: number) => Math.min(values[index++] ?? 1, sides)
}

describe('rollDice', () => {
  it('adds and subtracts dice groups and modifiers', () => {
    const result = rollDice('1d8+1d4+2-1', sequence([6, 3]))
    expect(result.total).toBe(10)
    expect(result.groups.map((group) => group.total)).toEqual([6, 4])
    expect(result.groups[1].modifier).toBe(1)
  })

  it('keeps the highest die and applies a modifier', () => {
    const result = rollDice('2d20kh1+5', sequence([7, 18]))
    expect(result.total).toBe(23)
    expect(result.groups[0].dice.map((die) => die.kept)).toEqual([false, true])
  })

  it('keeps the lowest die', () => {
    const result = rollDice('2d20kl1', sequence([1, 20]))
    expect(result.total).toBe(1)
    expect(result.groups[0].criticalFailure).toBe(true)
  })

  it('drops the lowest die', () => {
    const result = rollDice('4d6dl1', sequence([1, 2, 3, 6]))
    expect(result.total).toBe(11)
    expect(result.groups[0].dice.map((die) => die.kept)).toEqual([
      false,
      true,
      true,
      true,
    ])
  })

  it('drops the highest die', () => {
    const result = rollDice('4d6dh1', sequence([1, 2, 3, 6]))
    expect(result.total).toBe(6)
    expect(result.groups[0].dice.map((die) => die.kept)).toEqual([
      true,
      true,
      true,
      false,
    ])
  })

  it('explodes maximum rolls', () => {
    const result = rollDice('3d6!', sequence([6, 2, 3, 5]))
    expect(result.total).toBe(16)
    expect(result.groups[0].dice[0].rolls).toEqual([6, 2])
  })

  it('stops after 100 explosion rerolls per group', () => {
    const result = rollDice('1d6!', () => 6)
    expect(result.groups[0].dice[0].rolls).toHaveLength(101)
    expect(result.groups[0].explosionLimitReached).toBe(true)
  })

  it('marks natural d20 criticals and failures', () => {
    expect(rollDice('d20', () => 20).groups[0].critical).toBe(true)
    expect(rollDice('d20', () => 1).groups[0].criticalFailure).toBe(true)
  })

  it.each(['abc', '0d6', '101d6', 'd1', '4d6dl4', '1d6+'])(
    'returns a clear error for invalid expression %s',
    (expression) => {
      expect(() => rollDice(expression)).toThrow(DiceExpressionError)
    },
  )

  it('rejects sides above the safety limit', () => {
    expect(() => rollDice('1d1001')).toThrow('de 2 a 1000')
  })
})
