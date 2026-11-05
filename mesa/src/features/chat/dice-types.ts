export type DiceSelection = 'kh' | 'kl' | 'dh' | 'dl'

export type DieResult = {
  rolls: number[]
  total: number
  kept: boolean
}

export type DiceGroupResult = {
  count: number
  sides: number
  sign: 1 | -1
  selection?: DiceSelection
  selectionCount?: number
  exploding: boolean
  explosionLimitReached: boolean
  dice: DieResult[]
  keptTotal: number
  modifier: number
  total: number
  critical: boolean
  criticalFailure: boolean
}

export type FlatModifier = { value: number }

export type DiceRollResult = {
  expression: string
  total: number
  groups: DiceGroupResult[]
  flatModifiers: FlatModifier[]
}
