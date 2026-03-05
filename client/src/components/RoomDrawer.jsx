import { useState } from 'react'
import { useFacilityStore, STATUS, MODES } from '../store/facilityStore'
import DefoliationModal from './DefoliationModal'
import SprayLogModal from './SprayLogModal'
import CalibrationLogModal from './CalibrationLogModal'
import SprayLogList from './SprayLogList'
import CalibrationLogList from './CalibrationLogList'

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

const MODE_OPTIONS = [
  { value: MODES.VEG,         label: 'Veg' },
  { value: MODES.FLOWER,      label: 'Flower' },
  { value: MODES.FLUSH,       label: 'Flush' },
  { value: MODES.DRY,         label: 'Dry' },
  { value: MODES.IDLE,        label: 'Idle' },
  { value: MODES.MAINTENANCE, label: 'Maintenance' },
]

const SYMBOL_DISPLAY = {
  ipm:          { glyph: '🐛', label: 'IPM Active' },
  defoliation:  { glyph: '✂',  label: 'Defoliation Logged' },
  transfer:     { glyph: '⇄',  label: 'Transfer Pending' },
  mode_change:  { glyph: '⚙',  label: 'Mode Changed' },
  supply_ready: { glyph: '◈',  label: 'Supply Ready' },
  calendar:     { glyph: '◷',  label: 'Calendar Event' },
  issue:        { glyph: '⚠',  label: 'Open Issue' },
}

const DRAWER_TABS = ['OVERVIEW', 'SPRAY LOGS', 'CALIBRATION']

export default function RoomDrawer() {
  const { selectedRoomId, drawerOpen, closeDrawer, getRoom, updateRoomStatus, updateRoomMode } = useFacilityStore()
  const room = selectedRoomId ? getRoom(selectedRoomId) : null
  const sc   = room ? STATUS_COLORS[room.status] ?? STATUS_COLORS[STATUS.NORMAL] : STATUS_COLORS[STATUS.NORMAL]
  const tc   = room ? (TYPE_COLOR[room.type] || TYPE_COLOR.utility) : TYPE_COLOR.utility

  const [tab, setTab]               = useState('OVERVIEW')
  const [defolOpen, setDefolOpen]   = useState(false)
  const [sprayOpen, setSprayOpen]   = useState(false)
  const [calibOpen, setCalibOpen]   = useState(false)
  const [sprayKey, setSprayKey]     = useState(0)
  const [calibKey, setCalibKey]     = useState(0)

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
                  {STATUS_LABEL[room.status] ?? room.status.toUpperCase()}
                </span>
                <button className="drawer-close" onClick={closeDrawer}>✕</button>
              </div>

              <div className="drawer-meta">
                <span className="meta-chip">
                  <span className="meta-label">TYPE</span>
                  <span className="meta-value" style={{ color: tc.label }}>{room.type?.toUpperCase()}</span>
                </span>
                {room.stage && (
                  <span className="meta-chip">
                    <span className="meta-label">STAGE</span>
                    <span className="meta-value">{room.stage}</span>
                  </span>
                )}
                {/* Mode selector */}
                <span className="meta-chip meta-chip-select">
                  <span className="meta-label">MODE</span>
                  <select
                    className="mode-select"
                    value={room.mode ?? MODES.IDLE}
                    onChange={(e) => updateRoomMode(room.id, e.target.value)}
                  >
                    {MODE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </span>
              </div>
            </div>

            {/* ── Tabs ─────────────────────────────────────────────── */}
            <div className="drawer-tabs">
              {DRAWER_TABS.map(t => (
                <button
                  key={t}
                  className={`drawer-tab ${tab === t ? 'active' : ''}`}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* ── Tab: Overview ────────────────────────────────────── */}
            {tab === 'OVERVIEW' && (
              <>
                {/* Active flags */}
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

                {/* Action buttons */}
                <div className="drawer-actions">
                  <button className="action-btn primary" onClick={() => { setSprayOpen(true) }}>
                    🧪 Log Spray
                  </button>
                  <button className="action-btn" onClick={() => { setCalibOpen(true) }}>
                    🔬 Log Calibration
                  </button>
                </div>

                {/* Dev status override */}
                <section className="drawer-section">
                  <h3 className="section-title" style={{ opacity: 0.4 }}>DEV – STATUS OVERRIDE</h3>
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
              </>
            )}

            {/* ── Tab: Spray Logs ──────────────────────────────────── */}
            {tab === 'SPRAY LOGS' && (
              <section className="drawer-section">
                <div className="section-header-row">
                  <h3 className="section-title">SPRAY LOGS</h3>
                  <button className="action-btn-sm" onClick={() => setSprayOpen(true)}>+ New</button>
                </div>
                <SprayLogList key={sprayKey} roomId={room.id} />
              </section>
            )}

            {/* ── Tab: Calibration ─────────────────────────────────── */}
            {tab === 'CALIBRATION' && (
              <section className="drawer-section">
                <div className="section-header-row">
                  <h3 className="section-title">CALIBRATION LOGS</h3>
                  <button className="action-btn-sm" onClick={() => setCalibOpen(true)}>+ New</button>
                </div>
                <CalibrationLogList key={calibKey} roomId={room.id} />
              </section>
            )}
          </>
        )}
      </aside>

      {/* Modals */}
      {defolOpen && room && hasDefoliation && (
        <DefoliationModal
          roomId={room.id}
          roomName={room.name}
          onClose={() => setDefolOpen(false)}
        />
      )}

      {sprayOpen && room && (
        <SprayLogModal
          roomId={room.id}
          onClose={() => setSprayOpen(false)}
          onSaved={() => { setSprayKey(k => k + 1); setTab('SPRAY LOGS') }}
        />
      )}

      {calibOpen && room && (
        <CalibrationLogModal
          roomId={room.id}
          onClose={() => setCalibOpen(false)}
          onSaved={() => { setCalibKey(k => k + 1); setTab('CALIBRATION') }}
        />
      )}
    </>
  )
}
