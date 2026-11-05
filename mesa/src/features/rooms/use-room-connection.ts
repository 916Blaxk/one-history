import { useEffect } from 'react'
import { io, type Socket } from 'socket.io-client'
import { mutate } from 'swr'
import type {
  ClientToServerEvents,
  RoomCommand,
  ServerRoomMessage,
  ServerToClientEvents,
} from '@mesa/shared/room-protocol'
import { useTokenStore } from '@mesa/features/tokens/token-store'
import { useChatStore } from '@mesa/features/chat/chat-store'
import { useUiStore } from '@mesa/stores/ui-store'
import { setRoomCommandSender } from '@mesa/features/rooms/room-commands'
import { useRoomStore } from '@mesa/features/rooms/room-store'

/* A conexão usa o cookie de sessão do site. O servidor decide quem é a pessoa e qual o papel dela. */
export function useRoomConnection(campanhaId: string) {
  useEffect(() => {
    const socket = io({
      autoConnect: false,
      reconnection: true,
    }) as Socket<ServerToClientEvents, ClientToServerEvents>
    let active = true
    let ready = false
    const pending: RoomCommand[] = []
    const send = (message: RoomCommand) => {
      if (!active) return
      if (!ready) pending.push(message)
      else socket.emit('room:command', message)
    }
    setRoomCommandSender(send)
    useRoomStore.getState().setStatus('connecting')
    useRoomStore.getState().setPlayers([])
    useRoomStore.getState().setPlayerId(null)
    useRoomStore.getState().setPlayerKey(null)
    useRoomStore.getState().setRole(null)
    useRoomStore.getState().setNotice(null)

    const onConnect = () => {
      ready = false
      useRoomStore.getState().setStatus('connected')
      socket.emit('room:join', { campanhaId })
    }
    const onConnectError = (error: Error) => {
      if (!active) return
      if (error.message === 'nao-autenticado') {
        window.location.assign(`/entrar?destino=${encodeURIComponent(window.location.pathname)}`)
        return
      }
      useRoomStore.getState().setStatus('reconnecting')
    }
    const onDisconnect = () => {
      ready = false
      if (active) useRoomStore.getState().setStatus('reconnecting')
    }
    const onReconnectAttempt = () => {
      if (active) useRoomStore.getState().setStatus('reconnecting')
    }
    const onReconnectFailed = () => {
      if (active) useRoomStore.getState().setStatus('offline')
    }
    const onSnapshot = (snapshot: Parameters<ServerToClientEvents['room:snapshot']>[0], playerId: string) => {
      if (!active) return
      useTokenStore.getState().applyRoomSnapshot(snapshot.tokens, snapshot.spritesByTokenId)
      useUiStore.getState().applyRoomGrid(snapshot.grid)
      useUiStore.getState().applyRoomScenes(snapshot.scenes)
      useUiStore.getState().applyFogCells(snapshot.fogCells)
      useChatStore.getState().replaceRoomMessages(snapshot.messages)
      useRoomStore.getState().setPlayers(snapshot.players)
      useRoomStore.getState().setPlayerId(playerId)
      useRoomStore.getState().setPlayerKey(snapshot.selfId)
      useRoomStore.getState().setRole(snapshot.role)
      useRoomStore.getState().setStatus('connected')
      ready = true
      while (pending.length) socket.emit('room:command', pending.shift()!)
    }
    const onRoomEvent = (message: ServerRoomMessage) => {
      if (!active) return
      switch (message.type) {
        case 'token:added':
        case 'token:updated':
          useTokenStore.getState().applyRoomToken(message.token, message.sprites)
          if (message.type === 'token:added' && message.playerId === useRoomStore.getState().playerId)
            useTokenStore.getState().selectToken(message.token.id)
          break
        case 'token:removed':
          useTokenStore.getState().removeRoomToken(message.id)
          break
        case 'token:moved':
          if (message.playerId !== useRoomStore.getState().playerId || message.final)
            useTokenStore.getState().applyRoomPosition(message.id, message.position)
          break
        case 'scene:added':
          useUiStore.setState((state) => state.scenes.some((scene) => scene.id === message.scene.id)
            ? state : { scenes: [...state.scenes, message.scene] })
          break
        case 'scene:moved':
          useUiStore.setState((state) => ({ scenes: state.scenes.map((scene) => scene.id === message.id ? { ...scene, x: message.x, y: message.y } : scene) }))
          break
        case 'scene:removed':
          useUiStore.setState((state) => ({ scenes: state.scenes.filter((scene) => scene.id !== message.id) }))
          break
        case 'fog:updated':
          useUiStore.getState().applyFogUpdate(message.cells, message.reveal)
          break
        case 'fog:cleared':
          useUiStore.getState().applyFogCells([])
          break
        case 'chat:message':
          useChatStore.getState().receiveRoomMessage(message.message)
          break
        case 'chat:error':
          useChatStore.getState().receiveRoomMessage({
            id: crypto.randomUUID(), type: 'system', author: 'Sistema',
            text: message.text, timestamp: Date.now(),
          })
          break
        case 'permission:error':
          useRoomStore.getState().setNotice('Você não pode fazer isso')
          window.setTimeout(() => useRoomStore.getState().setNotice(null), 2200)
          break
        case 'player:kicked':
          useRoomStore.getState().setNotice('Você foi removido da mesa')
          socket.disconnect()
          break
        case 'room:denied':
          useRoomStore.getState().setNotice('Esta mesa não está disponível para a sua conta')
          socket.disconnect()
          break
        case 'ficha:atualizada':
          void mutate(`/api/fichas/${message.fichaId}/resumo`)
          break
        case 'player:joined':
        case 'player:left':
          useRoomStore.getState().setPlayers(message.players)
          break
      }
    }

    socket.on('connect', onConnect)
    socket.on('connect_error', onConnectError)
    socket.on('disconnect', onDisconnect)
    socket.io.on('reconnect_attempt', onReconnectAttempt)
    socket.io.on('reconnect_failed', onReconnectFailed)
    socket.on('room:snapshot', onSnapshot)
    socket.on('room:event', onRoomEvent)
    socket.connect()

    return () => {
      active = false
      ready = false
      setRoomCommandSender(null)
      socket.off('connect', onConnect)
      socket.off('connect_error', onConnectError)
      socket.off('disconnect', onDisconnect)
      socket.io.off('reconnect_attempt', onReconnectAttempt)
      socket.io.off('reconnect_failed', onReconnectFailed)
      socket.off('room:snapshot', onSnapshot)
      socket.off('room:event', onRoomEvent)
      socket.disconnect()
      useRoomStore.getState().setStatus('offline')
      useRoomStore.getState().setRole(null)
    }
  }, [campanhaId])
}
