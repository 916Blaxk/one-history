import { describe, expect, it } from 'vitest'
import {
  GM_TOKEN_FIELDS,
  NULLABLE_TOKEN_FIELDS,
  PLAYER_TOKEN_FIELDS,
  can,
  validCharacterId,
  validRollLabel,
} from './permissions'
import type { Token } from '@mesa/features/tokens/token-types'

const ownedToken = {
  hidden: false,
  ownerIds: ['owner'],
  createdByPlayerKey: 'owner',
} as Token

describe('sheet link fields', () => {
  it('lets GMs and token owners link a sheet, and unlink with null', () => {
    expect(PLAYER_TOKEN_FIELDS).toContain('characterId')
    expect(GM_TOKEN_FIELDS).toContain('characterId')
    expect(NULLABLE_TOKEN_FIELDS).toContain('characterId')
    expect(can('player', 'token:update', ownedToken, 'owner')).toBe(true)
    expect(can('player', 'token:update', ownedToken, 'other')).toBe(false)
    expect(can('spectator', 'token:update', ownedToken, 'owner')).toBe(false)
  })

  it('accepts only sheet ids, never a link or a key with symbols', () => {
    expect(validCharacterId('fePOeHPjmFKtn')).toBe(true)
    for (const value of ['', 'a b', 'https://site/fichas/1', 'x'.repeat(81), 5, null])
      expect(validCharacterId(value)).toBe(false)
  })

  it('accepts an optional short roll label', () => {
    expect(validRollLabel(undefined)).toBe(true)
    expect(validRollLabel('Esquiva')).toBe(true)
    for (const value of ['', '   ', 'x'.repeat(61), 5, null])
      expect(validRollLabel(value)).toBe(false)
  })
})

describe('room permissions', () => {
  it('allows GMs to manage tokens and grid', () => {
    expect(can('gm', 'token:remove', ownedToken, 'other')).toBe(true)
    expect(can('gm', 'grid:update')).toBe(true)
  })

  it('allows owners to move and edit their visible token', () => {
    expect(can('player', 'token:move', ownedToken, 'owner')).toBe(true)
    expect(can('player', 'token:update', ownedToken, 'owner')).toBe(true)
  })

  it('denies non-owners and lets only the creator remove a token', () => {
    expect(can('player', 'token:move', ownedToken, 'other')).toBe(false)
    expect(can('player', 'token:remove', ownedToken, 'other')).toBe(false)
  })

  it('denies spectators actions and hides hidden tokens from players', () => {
    expect(can('spectator', 'chat:roll')).toBe(false)
    expect(can('spectator', 'token:create')).toBe(false)
    expect(can('spectator', 'chat:whisper')).toBe(false)
    expect(can('player', 'chat:whisper')).toBe(true)
    expect(can('player', 'token:move', { ...ownedToken, hidden: true }, 'owner')).toBe(false)
  })
})
