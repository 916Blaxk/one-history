import type { DiceRollResult } from './dice-types.js'

export type ChatMessageType =
  'normal' | 'roll' | 'whisper' | 'gm' | 'action' | 'system'

export type ChatMessage = {
  id: string
  type: ChatMessageType
  author: string
  timestamp: number
  text: string
  recipient?: string
  roll?: DiceRollResult
}

export type NewChatMessage = Omit<ChatMessage, 'id' | 'timestamp'>
