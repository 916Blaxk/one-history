import { useChatStore } from '@/features/chat/chat-store'
import { DiceExpressionError, rollDice } from '@/features/chat/dice-parser'
import { isRoomMode, sendRoomCommand } from '@/features/rooms/room-commands'

/* Em sala, quem sorteia é sempre o servidor. O sorteio local só existe na mesa fora de sala. */
export function postRoll(expression: string, author: string, label?: string) {
  if (isRoomMode()) {
    sendRoomCommand({ type: 'chat:roll', expression, label })
    return
  }
  const { addMessage } = useChatStore.getState()
  try {
    const roll = rollDice(expression)
    addMessage({ type: 'roll', author, text: expression, label, roll })
  } catch (error) {
    addMessage({
      type: 'system',
      author: 'Sistema',
      text:
        error instanceof DiceExpressionError
          ? error.message
          : 'Não foi possível rolar esses dados.',
    })
  }
}
