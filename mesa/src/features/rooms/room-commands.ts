import type { RoomCommand } from '@/shared/room-protocol'
import type { TokenPosition } from '@/features/tokens/token-types'

type Sender = (message: RoomCommand) => void
let sender: Sender | null = null
let roomActive = false
const moveTimers = new Map<string, ReturnType<typeof setTimeout>>()
const lastMoveAt = new Map<string, number>()
const pendingMoves = new Map<string, TokenPosition>()

export function setRoomCommandSender(nextSender: Sender | null) {
  sender = nextSender
  roomActive = nextSender !== null
  if (!nextSender) {
    for (const timer of moveTimers.values()) clearTimeout(timer)
    moveTimers.clear()
    lastMoveAt.clear()
    pendingMoves.clear()
  }
}

export function sendRoomCommand(message: RoomCommand) {
  if (!sender) return false
  sender(message)
  return true
}

export function isRoomMode() {
  return roomActive
}

export function sendRoomMove(
  id: string,
  position: TokenPosition,
  final = false,
) {
  if (!sender) return
  pendingMoves.set(id, position)
  const now = Date.now()
  const elapsed = now - (lastMoveAt.get(id) ?? 0)
  const send = (isFinal: boolean) => {
    const latest = pendingMoves.get(id)
    if (!latest || !sender) return
    pendingMoves.delete(id)
    lastMoveAt.set(id, Date.now())
    sender({ type: 'token:move', id, position: latest, final: isFinal })
  }

  const pendingTimer = moveTimers.get(id)
  if (final) {
    if (pendingTimer) clearTimeout(pendingTimer)
    moveTimers.delete(id)
    send(true)
    return
  }
  if (elapsed >= 40) {
    if (pendingTimer) clearTimeout(pendingTimer)
    moveTimers.delete(id)
    send(false)
    return
  }
  if (!pendingTimer) {
    moveTimers.set(
      id,
      setTimeout(
        () => {
          moveTimers.delete(id)
          send(false)
        },
        Math.max(0, 40 - elapsed),
      ),
    )
  }
}
