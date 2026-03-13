import { useEffect, useRef } from 'react'

const MIN_DISTANCE = 60   // px — minimum swipe length to trigger
const MAX_CROSS    = 80   // px — max allowed movement on the perpendicular axis

/**
 * Global swipe gesture handler for mobile panel navigation.
 *
 * Swipe right  → open chat
 * Swipe left   → close chat
 * Swipe down   → open tasks
 * Swipe up     → close tasks
 *
 * Ignored when touch starts inside a scrollable element or an open panel's content.
 */
export default function useSwipeGestures({ chatOpen, setChatOpen, whiteboardOpen, setWhiteboardOpen }) {
  const touch = useRef(null)

  useEffect(() => {
    const onStart = (e) => {
      // Ignore multi-touch
      if (e.touches.length !== 1) { touch.current = null; return }

      const t = e.touches[0]
      // Ignore if touch starts inside an open panel (let the panel scroll normally)
      // but always allow starting from a swipe-handle
      const target = document.elementFromPoint(t.clientX, t.clientY)
      if (!target?.closest('.swipe-handle') &&
          target?.closest('.chat-panel, .whiteboard-panel, .room-drawer, .modal-backdrop, .hub-shell')) {
        touch.current = null
        return
      }

      touch.current = { x: t.clientX, y: t.clientY }
    }

    const onEnd = (e) => {
      if (!touch.current) return
      const t = e.changedTouches[0]
      const dx = t.clientX - touch.current.x
      const dy = t.clientY - touch.current.y
      touch.current = null

      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      // Horizontal swipe
      if (absDx >= MIN_DISTANCE && absDy <= MAX_CROSS) {
        if (dx > 0) setChatOpen(true)   // swipe right  → open chat
        else        setChatOpen(false)  // swipe left   → close chat
        return
      }

      // Vertical swipe
      if (absDy >= MIN_DISTANCE && absDx <= MAX_CROSS) {
        if (dy > 0) setWhiteboardOpen(true)   // swipe down → open tasks
        else        setWhiteboardOpen(false)  // swipe up   → close tasks
      }
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend',   onEnd,   { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend',   onEnd)
    }
  }, [chatOpen, setChatOpen, whiteboardOpen, setWhiteboardOpen])
}
