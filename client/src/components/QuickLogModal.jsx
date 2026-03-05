import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFacilityStore } from '../store/facilityStore'
import { SYMBOL_ITEMS } from './LegendPanel'

/**
 * Fired when a legend symbol is dropped onto a map room.
 * props: { roomId, symbolKey, onClose }
 */
export default function QuickLogModal({ roomId, symbolKey, onClose }) {
  const [note, setNote] = useState('')
  const textRef = useRef(null)

  const room           = useFacilityStore(s => s.rooms.find(r => r.id === roomId))
  const addSymbol      = useFacilityStore(s => s.addSymbolToRoom)

  const symbolItem = SYMBOL_ITEMS.find(s => s.key === symbolKey)
  const alreadySet = room?.symbols?.includes(symbolKey)

  useEffect(() => {
    // Focus textarea on open
    setTimeout(() => textRef.current?.focus(), 50)
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!room || !symbolItem) return null

  const handleConfirm = () => {
    addSymbol(roomId, symbolKey)
    // Future: append note to room event log here
    onClose()
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-box ql-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Flag drop – ${room.name}`}
      >
        {/* Header */}
        <div className="modal-header">
          <span className="ql-glyph">{symbolItem.glyph}</span>
          <div className="modal-header-text">
            <div className="modal-title">Flag Drop — {room.name}</div>
            <div className="modal-subtitle">
              {alreadySet
                ? 'This flag is already active on this room.'
                : `Add "${symbolItem.label}" to ${room.name}?`}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cancel">✕</button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {alreadySet ? (
            <p className="ql-already-msg">
              <span>⚠</span> <strong>{symbolItem.label}</strong> is already flagged on this room.
              Remove it first from the room drawer if you want to re-log.
            </p>
          ) : (
            <>
              <label className="ql-label" htmlFor="ql-note">
                Note <span className="ql-optional">(optional)</span>
              </label>
              <textarea
                ref={textRef}
                id="ql-note"
                className="ql-textarea"
                placeholder={`What's happening in ${room.name}? e.g. "Lower canopy only, 3 rows done"`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
              <p className="modal-hint">
                The flag will appear as an overlay on the room tile.
                Open the room drawer to manage or remove it later.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="ql-btn-cancel" onClick={onClose}>Cancel</button>
          {!alreadySet && (
            <button className="ql-btn-confirm" onClick={handleConfirm}>
              {symbolItem.glyph} Add Flag
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
