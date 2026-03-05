import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useFacilityStore } from '../store/facilityStore'

// Stable fallback — never recreated, so Zustand snapshot comparison stays stable
const EMPTY_TABLES = Object.freeze(
  Array.from({ length: 6 }, (_, i) =>
    Object.freeze({ id: i, left: false, right: false })
  )
)

// ─── Shared table grid ────────────────────────────────────────────────────────
export function TableGrid({ tables, onToggle, readOnly = false }) {
  const fullCount    = tables.filter(t => t.left && t.right).length
  const partialCount = tables.filter(t => (t.left || t.right) && !(t.left && t.right)).length
  const totalHalves  = tables.reduce((n, t) => n + (t.left ? 1 : 0) + (t.right ? 1 : 0), 0)

  return (
    <div className="defol-grid">
      <div className="defol-summary">
        <span className="defol-stat full">{fullCount}<span>full</span></span>
        <span className="defol-stat partial">{partialCount}<span>partial</span></span>
        <span className="defol-stat total">{totalHalves}<span>/ 12 halves</span></span>
      </div>

      {tables.map((table, idx) => {
        const isPartial = (table.left || table.right) && !(table.left && table.right)
        const isFull    = table.left && table.right
        return (
          <div key={table.id} className={`defol-table ${isFull ? 'full' : isPartial ? 'partial' : ''}`}>
            <span className="defol-table-num">{idx + 1}</span>

            <button
              className={`defol-half left ${table.left ? 'done' : ''}`}
              onClick={() => !readOnly && onToggle?.(table.id, 'left')}
              disabled={readOnly}
              aria-label={`Table ${idx + 1} left half – ${table.left ? 'done' : 'not done'}`}
            >
              {table.left && <span className="defol-check">✓</span>}
              <span className="defol-half-label">A</span>
            </button>

            <span className="defol-divider" />

            <button
              className={`defol-half right ${table.right ? 'done' : ''}`}
              onClick={() => !readOnly && onToggle?.(table.id, 'right')}
              disabled={readOnly}
              aria-label={`Table ${idx + 1} right half – ${table.right ? 'done' : 'not done'}`}
            >
              {table.right && <span className="defol-check">✓</span>}
              <span className="defol-half-label">B</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─── Editor modal ─────────────────────────────────────────────────────────────
export default function DefoliationModal({ roomId, roomName, onClose }) {
  // Select raw data — stable reference if unchanged
  const rawTables  = useFacilityStore(s => s.defoliationTables[roomId])
  const toggleHalf = useFacilityStore(s => s.toggleDefolHalf)
  const tables     = rawTables ?? EMPTY_TABLES

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal aria-label="Defoliation progress">
      <div className="modal-box defol-modal" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <span className="modal-icon">✂</span>
          <div className="modal-header-text">
            <span className="modal-title">DEFOLIATION</span>
            <span className="modal-subtitle">{roomName}</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          <p className="modal-hint">Click each half to mark it complete. Click again to undo.</p>
          <TableGrid
            tables={tables}
            onToggle={(tableId, half) => toggleHalf(roomId, tableId, half)}
          />
        </div>

        <div className="modal-footer">
          <button className="action-btn primary" onClick={onClose}>DONE</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Info modal (read-only, scissors click on map) ────────────────────────────
export function DefoliationInfoModal() {
  const roomId    = useFacilityStore(s => s.defolInfoRoomId)
  const closeInfo = useFacilityStore(s => s.closeDefolInfo)
  // Select the whole map — stable object reference if no write occurred
  const allTables = useFacilityStore(s => s.defoliationTables)
  const rooms     = useFacilityStore(s => s.rooms)

  if (!roomId) return null

  const tables = allTables[roomId] ?? EMPTY_TABLES
  const room   = rooms.find(r => r.id === roomId)

  return createPortal(
    <div className="modal-backdrop info" onClick={closeInfo} role="dialog" aria-modal aria-label="Defoliation status">
      <div className="modal-box defol-info-modal" onClick={e => e.stopPropagation()}>

        <div className="modal-header compact">
          <span className="modal-icon small">✂</span>
          <div className="modal-header-text">
            <span className="modal-title">DEFOL STATUS</span>
            <span className="modal-subtitle">{room?.name ?? roomId}</span>
          </div>
          <button className="modal-close" onClick={closeInfo} aria-label="Close">✕</button>
        </div>

        <div className="modal-body compact">
          <TableGrid tables={tables} readOnly />
        </div>

      </div>
    </div>,
    document.body
  )
}
