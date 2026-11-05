import { create } from 'zustand'
import type { ChatMessage, NewChatMessage } from '@/features/chat/chat-types'

type ChatState = {
  messages: ChatMessage[]
  commandHistory: string[]
  addMessage: (message: NewChatMessage) => void
  addToCommandHistory: (command: string) => void
  clearMessages: () => void
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
}))
