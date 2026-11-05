import { useRef, type PointerEvent } from 'react'

export function useBottomSheetDismiss(
  enabled: boolean,
  onDismiss?: () => void,
) {
  const startY = useRef<number | null>(null)

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (
      !enabled ||
      (event.target instanceof Element &&
        event.target.closest('button, input, select, a'))
    )
      return
    startY.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (startY.current !== null && event.clientY - startY.current > 64)
      onDismiss?.()
    startY.current = null
  }

  function onPointerCancel() {
    startY.current = null
  }
  return { onPointerDown, onPointerUp, onPointerCancel }
}
