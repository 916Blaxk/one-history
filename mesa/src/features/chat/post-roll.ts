import { useChatStore } from '@mesa/features/chat/chat-store'
import { sendRoomCommand } from '@mesa/features/rooms/room-commands'

/* Quem sorteia é sempre o servidor. */
export function postRoll(expression: string, label?: string) {
  sendRoomCommand({ type: 'chat:roll', expression, label })
  useChatStore.getState().requestOpen()
}

export function postSheetRoll(fichaId: string, acao: string) {
  sendRoomCommand({ type: 'ficha:rolar', fichaId, acao })
  useChatStore.getState().requestOpen()
}
