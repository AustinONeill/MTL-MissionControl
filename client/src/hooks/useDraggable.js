import { useState, useEffect, useRef, useCallback } from 'react'

// Compute the minimal push vector to move panel (x,y,pw,ph) out of sibEl
function clearOverlap(pw, ph, x, y, sibEl) {
  const sr = sibEl.getBoundingClientRect()
  const right = x + pw, bottom = y + ph

  if (right <= sr.left || x >= sr.right || bottom <= sr.top || y >= sr.bottom) return { x, y }

  const dUp    = bottom - sr.top
  const dDown  = sr.bottom - y
  const dLeft  = right - sr.left
  const dRight = sr.right - x
  const min    = Math.min(dUp, dDown, dLeft, dRight)

  if (min === dUp)    return { x, y: y - dUp    - 8 }
  if (min === dDown)  return { x, y: y + dDown  + 8 }
  if (min === dLeft)  return { x: x - dLeft - 8, y }
  return                     { x: x + dRight + 8, y }
}

/**
 * Makes a panel draggable by its header.
 *
 * @param {React.RefObject} panelRef   - ref attached to the panel's root div
 * @param {object|function} defaultPos - { x, y } or () => { x, y } for lazy init
 * @param {string}          storageKey - localStorage key for persistence
 * @param {Array}           siblingRefs - refs to sibling panels for overlap resolution
 */
export default function useDraggable(panelRef, defaultPos, storageKey, siblingRefs = []) {
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey))
      if (saved?.x != null) return saved
    } catch {}
    return typeof defaultPos === 'function' ? defaultPos() : defaultPos
  })

  const dragging  = useRef(false)
  const offset    = useRef({ x: 0, y: 0 })
  const posRef    = useRef(pos)
  posRef.current  = pos
  const sibsRef   = useRef(siblingRefs)
  sibsRef.current = siblingRefs

  const onDragStart = useCallback((e) => {
    if (e.button !== 0) return
    if (e.target.closest('button, a, input, select, textarea')) return
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    dragging.current = true
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    document.body.style.cursor = 'grabbing'
    e.preventDefault()
  }, [panelRef])

  useEffect(() => {
    const TOPBAR = 56

    const onMove = (e) => {
      if (!dragging.current || !panelRef.current) return
      const pw = panelRef.current.offsetWidth
      const ph = panelRef.current.offsetHeight
      setPos({
        x: Math.max(0,      Math.min(window.innerWidth  - pw, e.clientX - offset.current.x)),
        y: Math.max(TOPBAR, Math.min(window.innerHeight - ph, e.clientY - offset.current.y)),
      })
    }

    const onUp = () => {
      if (!dragging.current || !panelRef.current) return
      dragging.current = false
      document.body.style.cursor = ''

      const pw = panelRef.current.offsetWidth
      const ph = panelRef.current.offsetHeight
      let { x, y } = posRef.current

      // Clamp to viewport
      x = Math.max(0,      Math.min(window.innerWidth  - pw, x))
      y = Math.max(TOPBAR, Math.min(window.innerHeight - ph, y))

      // Resolve overlaps with each sibling
      for (const ref of sibsRef.current) {
        const el = ref?.current
        if (!el) continue
        const pushed = clearOverlap(pw, ph, x, y, el)
        x = Math.max(0,      Math.min(window.innerWidth  - pw, pushed.x))
        y = Math.max(TOPBAR, Math.min(window.innerHeight - ph, pushed.y))
      }

      const resolved = { x, y }
      setPos(resolved)
      posRef.current = resolved
      localStorage.setItem(storageKey, JSON.stringify(resolved))
    }

    // Re-clamp positions when the window is resized
    const onResize = () => {
      if (!panelRef.current) return
      const pw = panelRef.current.offsetWidth
      const ph = panelRef.current.offsetHeight
      setPos(prev => ({
        x: Math.max(0,      Math.min(window.innerWidth  - pw, prev.x)),
        y: Math.max(TOPBAR, Math.min(window.innerHeight - ph, prev.y)),
      }))
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    window.addEventListener('resize',    onResize)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
      window.removeEventListener('resize',    onResize)
    }
  }, [storageKey, panelRef])

  return { pos, onDragStart }
}
