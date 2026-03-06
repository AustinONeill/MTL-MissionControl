import { useState } from 'react'
import { useFacilityStore, STATUS, MODES } from '../store/facilityStore'
import DefoliationModal from './DefoliationModal'
import SprayLogModal from './SprayLogModal'
import SprayLogList from './SprayLogList'
import TransferModal from './TransferModal'
import NetModal from './NetModal'
import PreVegZoneMap from './PreVegZoneMap'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('stack-auth-token')
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

async function uploadPhoto(roomId, logType, file) {
  const presign = await apiFetch('/api/photos/presign', {
    method: 'POST',
    body: JSON.stringify({ roomId, logType, contentType: file.type }),
  })
  await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
  return presign.publicUrl
}

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
  { value: MODES.OFF,  label: 'Off' },
  { value: MODES.AUTO, label: 'Auto' },
  { value: MODES.CROP, label: 'Crop' },
  { value: MODES.FILL, label: 'Fill' },
]

const SYMBOL_DISPLAY = {
  ipm:           { glyph: '🐛', label: 'IPM Active' },
  net:           { glyph: '🕸', label: 'Net Active' },
  pot_check:     { glyph: '🪴', label: 'Pot Check Due' },
  filter_change: { glyph: '🌬', label: 'Filter Change Due' },
  defoliation:   { glyph: '✂',  label: 'Defoliation Logged' },
  transfer:      { glyph: '⇄',  label: 'Transfer Pending' },
  harvest_ready: { glyph: '◷',  label: 'Harvest Ready' },
  mode_change:   { glyph: '⚙',  label: 'Mode Changed' },
  supply_ready:  { glyph: '◈',  label: 'Supply Ready' },
  issue:         { glyph: '⚠',  label: 'Open Issue' },
}

const DRAWER_TABS = ['OVERVIEW', 'SPRAY LOGS', 'POT CHECK', 'FILTER CHANGE']

// ── Simple Yes/No log tab ──────────────────────────────────────────────────
function YesNoTab({ label, apiPath, bodyFn }) {
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved]           = useState(null) // 'yes' | 'no' | null
  const [error, setError]           = useState(null)

  const handleTap = async (completed) => {
    setSubmitting(true); setError(null)
    try {
      if (API_BASE) {
        await apiFetch(apiPath, { method: 'POST', body: JSON.stringify(bodyFn(completed)) })
      }
      setSaved(completed ? 'yes' : 'no')
      setTimeout(() => setSaved(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (saved) return (
    <div className="drawer-section yn-confirm" style={{ color: saved === 'yes' ? '#4ade80' : '#f87171' }}>
      {saved === 'yes' ? `✓ ${label} — Complete` : `✕ ${label} — Not Done`}
    </div>
  )

  return (
    <section className="drawer-section">
      <p className="yn-prompt">{label} complete?</p>
      {error && <p className="form-error">{error}</p>}
      <div className="yn-btn-row">
        <button className="yn-btn yn-btn--yes" disabled={submitting} onClick={() => handleTap(true)}>YES</button>
        <button className="yn-btn yn-btn--no"  disabled={submitting} onClick={() => handleTap(false)}>NO</button>
      </div>
    </section>
  )
}

function PotCheckTab({ roomId }) {
  return (
    <YesNoTab
      label="Pot Check"
      apiPath="/api/pot-check-logs"
      bodyFn={(completed) => ({ roomId, completed, rootHealth: completed ? 'healthy' : 'concern' })}
    />
  )
}

function FilterChangeTab({ roomId }) {
  return (
    <YesNoTab
      label="Filter Change"
      apiPath="/api/filter-change-logs"
      bodyFn={(completed) => ({ roomId, completed, newInstalled: completed })}
    />
  )
}

// ── Main Drawer ────────────────────────────────────────────────────────────
export default function RoomDrawer() {
  const { selectedRoomId, drawerOpen, closeDrawer, getRoom, updateRoomStatus, updateRoomMode, transfers } = useFacilityStore()
  const room = selectedRoomId ? getRoom(selectedRoomId) : null
  const transferAsOrigin = room ? transfers[room.id] : null
  const transferAsDest   = room
    ? Object.entries(transfers).find(([, t]) => t.destinationId === room.id)
    : null
  const sc   = room ? STATUS_COLORS[room.status] ?? STATUS_COLORS[STATUS.NORMAL] : STATUS_COLORS[STATUS.NORMAL]
  const tc   = room ? (TYPE_COLOR[room.type] || TYPE_COLOR.utility) : TYPE_COLOR.utility

  const [tab, setTab]               = useState('OVERVIEW')
  const [defolOpen, setDefolOpen]   = useState(false)
  const [sprayOpen, setSprayOpen]   = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [netOpen, setNetOpen]       = useState(false)
  const [sprayKey, setSprayKey]     = useState(0)

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
                <span className="meta-chip meta-chip-select">
                  <span className="meta-label">MODE</span>
                  <select
                    className="mode-select"
                    value={room.mode ?? MODES.OFF}
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
                        const isNet   = sym === 'net'
                        return (
                          <div key={sym} className={`flag-chip ${(isDefol || isNet) ? 'flag-chip--editable' : ''}`}>
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
                            {isNet && (
                              <button
                                className="flag-edit-btn"
                                onClick={() => setNetOpen(true)}
                                aria-label="Edit net log"
                                title="Log net status"
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

                {/* Transfer info card */}
                {(transferAsOrigin || transferAsDest) && (
                  <section className="drawer-section">
                    <h3 className="section-title">ACTIVE TRANSFER</h3>
                    {transferAsOrigin && (
                      <div className="transfer-info-card">
                        <div className="transfer-info-row">
                          <span className="transfer-info-label">TO</span>
                          <span className="transfer-info-value" style={{ color: '#f59e0b' }}>
                            {getRoom(transferAsOrigin.destinationId)?.name ?? transferAsOrigin.destinationId}
                          </span>
                        </div>
                        {transferAsOrigin.transferType && (
                          <div className="transfer-info-row">
                            <span className="transfer-info-label">TYPE</span>
                            <span className="transfer-info-value">{transferAsOrigin.transferType}</span>
                          </div>
                        )}
                        {transferAsOrigin.transferDate && (
                          <div className="transfer-info-row">
                            <span className="transfer-info-label">DATE</span>
                            <span className="transfer-info-value">
                              {new Date(transferAsOrigin.transferDate).toLocaleString('en-CA', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
                              })}
                            </span>
                          </div>
                        )}
                        {transferAsOrigin.notes && (
                          <p className="transfer-info-notes">{transferAsOrigin.notes}</p>
                        )}
                        <button className="transfer-edit-btn" onClick={() => setTransferOpen(true)}>
                          ✏ Edit Transfer
                        </button>
                      </div>
                    )}
                    {transferAsDest && !transferAsOrigin && (
                      <div className="transfer-info-card transfer-info-card--incoming">
                        <div className="transfer-info-row">
                          <span className="transfer-info-label">FROM</span>
                          <span className="transfer-info-value" style={{ color: '#f59e0b' }}>
                            {getRoom(transferAsDest[0])?.name ?? transferAsDest[0]}
                          </span>
                        </div>
                        <p className="transfer-info-notes">Incoming transfer — edit from origin room.</p>
                      </div>
                    )}
                  </section>
                )}

                {/* PRE-VEG zone map */}
                {room.id === 'PREVEG' && <PreVegZoneMap />}

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

            {/* ── Tab: Pot Check ────────────────────────────────────── */}
            {tab === 'POT CHECK' && (
              <PotCheckTab key={room.id} roomId={room.id} />
            )}

            {/* ── Tab: Filter Change ────────────────────────────────── */}
            {tab === 'FILTER CHANGE' && (
              <FilterChangeTab key={room.id} roomId={room.id} />
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

      {transferOpen && room && transferAsOrigin && (
        <TransferModal
          originRoomId={room.id}
          onClose={() => setTransferOpen(false)}
        />
      )}

      {netOpen && room && (
        <NetModal
          roomId={room.id}
          onClose={() => setNetOpen(false)}
          onSaved={() => setNetOpen(false)}
        />
      )}
    </>
  )
}
