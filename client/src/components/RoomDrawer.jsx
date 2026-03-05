import { useState } from 'react'
import { useFacilityStore, STATUS } from '../store/facilityStore'
import DefoliationModal from './DefoliationModal'

const STATUS_LABEL = {
  [STATUS.NORMAL]: 'NORMAL',
  [STATUS.WARN]:   'ISSUE ACTIVE',
  [STATUS.ALERT]:  'ALERT',
  [STATUS.IDLE]:   'IDLE',
}

const TYPE_COLOR = {
  flower:  { label: '#4ade80', border: '#1a4d2a', bg: '#0a1f12' },
  veg:     { label: '#86cf36', border: '#2d5010', bg: '#111c08' },
  support: { label: '#60a5fa', border: '#1a3566', bg: '#091427' },
  utility: { label: '#a78bfa', border: '#3a2d6a', bg: '#14102a' },
}

const STATUS_COLORS = {
  [STATUS.NORMAL]: { label: '#4ade80', border: '#1a4d2a', bg: '#0a1f12' },
  [STATUS.WARN]:   { label: '#facc15', border: '#6b5c00', bg: '#1a1600' },
  [STATUS.ALERT]:  { label: '#f87171', border: '#7a1a1a', bg: '#1f0909' },
  [STATUS.IDLE]:   { label: '#6b7280', border: '#2a2d35', bg: '#0d0f13' },
}

const SYMBOL_DISPLAY = {
  ipm:          { glyph: '🐛', label: 'IPM Active' },
  defoliation:  { glyph: '✂',  label: 'Defoliation Logged' },
  transfer:     { glyph: '⇄',  label: 'Transfer Pending' },
  mode_change:  { glyph: '⚙',  label: 'Mode Changed' },
  supply_ready: { glyph: '◈',  label: 'Supply Ready' },
  calendar:     { glyph: '◷',  label: 'Calendar Event' },
  issue:        { glyph: '⚠',  label: 'Open Issue' },
}

const mockEvents = () => [
  { id: 1, type: 'IPM',         desc: 'Hermie hunt – 2 found and removed', time: '09:14',     by: 'Austin',  edited: true  },
  { id: 2, type: 'Inspection',  desc: 'Weekly walkthrough complete',        time: 'Yesterday', by: 'Marcus',  edited: false },
  { id: 3, type: 'Mode Change', desc: 'Flip to 12/12 initiated',            time: '2d ago',    by: 'Austin',  edited: false },
]

export default function RoomDrawer() {
  const { selectedRoomId, drawerOpen, closeDrawer, getRoom, updateRoomStatus } = useFacilityStore()
  const room = selectedRoomId ? getRoom(selectedRoomId) : null
  const sc   = room ? STATUS_COLORS[room.status] : STATUS_COLORS[STATUS.NORMAL]
  const tc   = room ? (TYPE_COLOR[room.type] || TYPE_COLOR.utility) : TYPE_COLOR.utility

  const [defolOpen, setDefolOpen] = useState(false)

  const hasDefoliation = room?.symbols?.includes('defoliation')

  return (
    <>
      <div className={`drawer-backdrop ${drawerOpen ? 'open' : ''}`} onClick={closeDrawer} aria-hidden />

      <aside className={`room-drawer ${drawerOpen ? 'open' : ''}`} aria-label="Room detail panel">
        {room && (
          <>
            {/* ── Header ──────────────────────────────────────────── */}
            <div className="drawer-header" style={{ borderBottomColor: sc.border }}>
              <div className="drawer-header-top">
                <div className="drawer-status-dot" style={{ background: sc.label }} />
                <h2 className="drawer-room-name">{room.name}</h2>
                <span className="drawer-status-badge"
                  style={{ color: sc.label, borderColor: sc.border, background: sc.bg }}>
                  {STATUS_LABEL[room.status]}
                </span>
                <button className="drawer-close" onClick={closeDrawer}>✕</button>
              </div>

              <div className="drawer-meta">
                <span className="meta-chip">
                  <span className="meta-label">TYPE</span>
                  <span className="meta-value" style={{ color: tc.label }}>{room.type.toUpperCase()}</span>
                </span>
                <span className="meta-chip">
                  <span className="meta-label">STAGE</span>
                  <span className="meta-value">{room.stage}</span>
                </span>
                {room.batch && (
                  <span className="meta-chip">
                    <span className="meta-label">BATCH</span>
                    <span className="meta-value">{room.batch}</span>
                  </span>
                )}
              </div>
            </div>

            {/* ── Recent events ────────────────────────────────────── */}
            <section className="drawer-section">
              <h3 className="section-title">RECENT EVENTS</h3>
              <div className="event-list">
                {mockEvents().map(ev => (
                  <div key={ev.id} className="event-row">
                    <div className="event-row-top">
                      <span className="event-type">{ev.type}</span>
                      {ev.edited && <span className="event-edited-badge">EDITED</span>}
                      <span className="event-time">{ev.time}</span>
                    </div>
                    <p className="event-desc">{ev.desc}</p>
                    <span className="event-by">by {ev.by}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Status override ──────────────────────────────────── */}
            <section className="drawer-section">
              <h3 className="section-title">DEV – STATUS OVERRIDE</h3>
              <div className="status-override-row">
                {Object.entries(STATUS_COLORS).map(([s, c]) => (
                  <button key={s}
                    className={`status-btn ${room.status === s ? 'active' : ''}`}
                    style={{ borderColor: c.border, color: c.label, background: room.status === s ? c.bg : 'transparent' }}
                    onClick={() => updateRoomStatus(room.id, s)}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </section>

            {/* ── Active flags (with pencil on defoliation) ────────── */}
            {room.symbols?.length > 0 && (
              <section className="drawer-section">
                <h3 className="section-title">ACTIVE FLAGS</h3>
                <div className="flags-grid">
                  {room.symbols.map(sym => {
                    const s = SYMBOL_DISPLAY[sym]
                    if (!s) return null
                    const isDefol = sym === 'defoliation'
                    return (
                      <div key={sym} className={`flag-chip ${isDefol ? 'flag-chip--editable' : ''}`}>
                        <span className="flag-glyph">{s.glyph}</span>
                        <span className="flag-label">{s.label}</span>
                        {isDefol && (
                          <button
                            className="flag-edit-btn"
                            onClick={() => setDefolOpen(true)}
                            aria-label="Edit defoliation progress"
                            title="Edit table progress"
                          >
                            ✏
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Action buttons ───────────────────────────────────── */}
            <div className="drawer-actions">
              <button className="action-btn primary">Log Event</button>
              <button className="action-btn">View Timeline</button>
              <button className="action-btn">View Issues</button>
            </div>
          </>
        )}
      </aside>

      {/* Defoliation editor modal */}
      {defolOpen && room && hasDefoliation && (
        <DefoliationModal
          roomId={room.id}
          roomName={room.name}
          onClose={() => setDefolOpen(false)}
        />
      )}
    </>
  )
}
