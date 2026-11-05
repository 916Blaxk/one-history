import { describe, expect, it } from 'vitest'
import { can } from './permissions'
import type { Token } from '@/features/tokens/token-types'

const ownedToken = {
  hidden: false,
  ownerIds: ['owner'],
  createdByPlayerKey: 'owner',
} as Token

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
