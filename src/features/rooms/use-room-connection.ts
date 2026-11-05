import { useEffect } from 'react'
import PartySocket from 'partysocket'
import type {
  ClientRoomMessage,
  ServerRoomMessage,
} from '@/shared/room-protocol'
import { useTokenStore } from '@/features/tokens/token-store'
import { useChatStore } from '@/features/chat/chat-store'
import { useUiStore } from '@/stores/ui-store'
import { setRoomCommandSender } from '@/features/rooms/room-commands'
import { useRoomStore } from '@/features/rooms/room-store'

function isServerMessage(value: unknown): value is ServerRoomMessage {
  return typeof value === 'object' && value !== null && 'type' in value
}

export function useRoomConnection(roomCode: string, displayName: string) {
  useEffect(() => {
    const localTokens = useTokenStore.getState()
    const localGrid = useUiStore.getState().grid
    const localBackgroundUrl = useUiStore.getState().backgroundUrl
    const localMessages = useChatStore.getState().messages
    const localSelectedTokenId = localTokens.selectedTokenId
    const socket = new PartySocket({
      host: import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999',
      room: roomCode.toLowerCase(),
    })
    let ready = false
    let active = true
    const pending: ClientRoomMessage[] = []
    const send = (message: ClientRoomMessage) => {
      if (!active) return
      if (!ready) pending.push(message)
      else socket.send(JSON.stringify(message))
    }
    setRoomCommandSender(send)
    useRoomStore.getState().setStatus('connecting')
    useRoomStore.getState().setPlayers([])
    useRoomStore.getState().setPlayerId(null)
    useRoomStore.getState().setNotice(null)

    const onOpen = () => {
      ready = true
      useRoomStore.getState().setStatus('connected')
      socket.send(
        JSON.stringify({
          type: 'join',
          displayName,
        } satisfies ClientRoomMessage),
      )
      while (pending.length) socket.send(JSON.stringify(pending.shift()))
    }
    const onClose = () => {
      ready = false
      useRoomStore.getState().setStatus('reconnecting')
    }
    const onMessage = (event: MessageEvent) => {
      let message: unknown
      try {
        message = JSON.parse(String(event.data))
      } catch {
        return
      }
      if (!isServerMessage(message)) return
      switch (message.type) {
        case 'snapshot':
          useTokenStore
            .getState()
            .applyRoomSnapshot(
              message.snapshot.tokens,
              message.snapshot.spritesByTokenId,
            )
          useUiStore.getState().applyRoomGrid(message.snapshot.grid)
          useUiStore
            .getState()
            .applyRoomBackgroundUrl(message.snapshot.backgroundUrl)
          useChatStore.getState().replaceRoomMessages(message.snapshot.messages)
          useRoomStore.getState().setPlayers(message.snapshot.players)
          useRoomStore.getState().setPlayerId(message.playerId)
          break
        case 'token:added':
        case 'token:updated':
          useTokenStore
            .getState()
            .applyRoomToken(message.token, message.sprites)
          if (
            message.type === 'token:added' &&
            message.playerId === useRoomStore.getState().playerId
          )
            useTokenStore.getState().selectToken(message.token.id)
          break
        case 'token:removed':
          useTokenStore.getState().removeRoomToken(message.id)
          break
        case 'token:moved':
          if (
            message.playerId !== useRoomStore.getState().playerId ||
            message.final
          )
            useTokenStore
              .getState()
              .applyRoomPosition(message.id, message.position)
          break
        case 'grid:updated': {
          const state = useTokenStore.getState()
          state.applyRoomSnapshot(message.tokens, state.spritesByTokenId)
          useUiStore.getState().applyRoomGrid(message.grid)
          break
        }
        case 'background:updated':
          useUiStore.getState().applyRoomBackgroundUrl(message.backgroundUrl)
          break
        case 'chat:message':
          useChatStore.getState().receiveRoomMessage(message.message)
          break
        case 'chat:error':
          useChatStore.getState().receiveRoomMessage({
            id: crypto.randomUUID(),
            type: 'system',
            author: 'Sistema',
            text: message.text,
            timestamp: Date.now(),
          })
          break
        case 'player:joined':
        case 'player:left':
          useRoomStore.getState().setPlayers(message.players)
          break
      }
    }
    socket.addEventListener('open', onOpen)
    socket.addEventListener('close', onClose)
    socket.addEventListener('message', onMessage)

    return () => {
      active = false
      ready = false
      setRoomCommandSender(null)
      socket.removeEventListener('open', onOpen)
      socket.removeEventListener('close', onClose)
      socket.removeEventListener('message', onMessage)
      socket.close()
      useTokenStore
        .getState()
        .applyRoomSnapshot(localTokens.tokens, localTokens.spritesByTokenId)
      useTokenStore.getState().selectToken(localSelectedTokenId)
      useUiStore.getState().applyRoomGrid(localGrid)
      useUiStore.getState().applyRoomBackgroundUrl(localBackgroundUrl)
      useChatStore.getState().replaceRoomMessages(localMessages)
      useRoomStore.getState().setStatus('offline')
    }
  }, [roomCode, displayName])
}
