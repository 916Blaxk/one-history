import { create } from 'zustand'
import type { ChatMessage, NewChatMessage } from '@/features/chat/chat-types'

type ChatState = {
  messages: ChatMessage[]
  commandHistory: string[]
  addMessage: (message: NewChatMessage) => void
  addToCommandHistory: (command: string) => void
  clearMessages: () => void
  receiveRoomMessage: (message: ChatMessage) => void
  replaceRoomMessages: (messages: ChatMessage[]) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  commandHistory: [],
  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { ...message, id: crypto.randomUUID(), timestamp: Date.now() },
      ],
    })),
  addToCommandHistory: (command) =>
    set((state) => ({ commandHistory: [...state.commandHistory, command] })),
  clearMessages: () => set({ messages: [] }),
  receiveRoomMessage: (message) =>
    set((state) =>
      state.messages.some((item) => item.id === message.id)
        ? state
        : { messages: [...state.messages, message].slice(-200) },
    ),
  replaceRoomMessages: (messages) => set({ messages: messages.slice(-200) }),
}))
