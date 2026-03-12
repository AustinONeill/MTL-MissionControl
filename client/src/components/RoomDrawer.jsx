import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFacilityStore, STATUS, MODES } from '../store/facilityStore'
import DefoliationModal from './DefoliationModal'
import SprayLogModal from './SprayLogModal'
import SprayLogList from './SprayLogList'
import TransferModal from './TransferModal'
import NetModal from './NetModal'
import PreVegZoneMap from './PreVegZoneMap'
import { getRelevantSops, getSopForOverlay } from '../data/sops'
import { apiFetch, uploadPhoto } from '../lib/apiFetch'

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

const DRAWER_TABS = ['OVERVIEW', 'SPRAY LOGS', 'CHECKS', 'PPE', 'SOPs']

// ── Yes/No quick log ───────────────────────────────────────────────────────
function YesNoLog({ label, apiPath, bodyFn }) {
  const authUser    = useFacilityStore(s => s.authUser)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved]           = useState(null)
  const [error, setError]           = useState(null)
  const displayName = authUser?.displayName ?? authUser?.primaryEmail ?? 'Unknown'

  const handleTap = async (completed) => {
    setSubmitting(true); setError(null)
    const now = new Date()
    try {
      if (API_BASE) await apiFetch(apiPath, { method: 'POST', body: JSON.stringify(bodyFn(completed)) })
      setSaved({ completed, by: displayName, at: now })
      setTimeout(() => setSaved(null), 5000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (saved) return (
    <div className="yn-confirm" style={{ color: saved.completed ? '#4ade80' : '#f87171' }}>
      <div className="yn-confirm-status">{saved.completed ? `✓ ${label} — Complete` : `✕ ${label} — Not Done`}</div>
      <div className="yn-confirm-meta">
        <span className="yn-confirm-by">{saved.by}</span>
        <span className="yn-confirm-at">
          {saved.at.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false })}
          {' · '}{saved.at.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </div>
  )

  return (
    <div className="checks-yn-block">
      <p className="yn-prompt">{label} complete?</p>
      <div className="yn-signed-as">Signing as <strong>{displayName}</strong></div>
      {error && <p className="form-error">{error}</p>}
      <div className="yn-btn-row">
        <button className="yn-btn yn-btn--yes" disabled={submitting} onClick={() => handleTap(true)}>YES</button>
        <button className="yn-btn yn-btn--no"  disabled={submitting} onClick={() => handleTap(false)}>NO</button>
      </div>
    </div>
  )
}

// ── Inline-editable task row ───────────────────────────────────────────────
const PRIORITY_COLORS = { low: '#6b7280', normal: '#60a5fa', high: '#f87171' }

function TaskRow({ task, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState({ title: task.title, priority: task.priority })

  const next        = { todo: 'in_progress', in_progress: 'done' }[task.status]
  const statusColor = task.status === 'in_progress' ? '#f59e0b' : '#6b7280'
  const statusLabel = task.status === 'in_progress' ? 'IN PROGRESS' : 'TO DO'

  const saveEdit = () => {
    if (draft.title.trim()) {
      onUpdate({ title: draft.title.trim(), priority: draft.priority })
    }
    setEditing(false)
  }

  const cancelEdit = () => {
    setDraft({ title: task.title, priority: task.priority })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="room-task-row room-task-row--editing">
        <input
          className="room-task-edit-input"
          value={draft.title}
          onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))}
          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
          autoFocus
        />
        <select
          className="room-task-edit-priority"
          value={draft.priority}
          onChange={(e) => setDraft(d => ({ ...d, priority: e.target.value }))}
        >
          <option value="low">LOW</option>
          <option value="normal">NORMAL</option>
          <option value="high">HIGH</option>
        </select>
        <button className="room-task-edit-save" onClick={saveEdit} aria-label="Save">✓</button>
        <button className="room-task-edit-cancel" onClick={cancelEdit} aria-label="Cancel">✕</button>
      </div>
    )
  }

  return (
    <div className="room-task-row">
      <span
        className="wb-priority-dot"
        style={{ background: PRIORITY_COLORS[task.priority] ?? '#60a5fa', flexShrink: 0 }}
      />
      <span className="room-task-title">{task.title}</span>
      <button
        className="room-task-status"
        style={{ color: statusColor, borderColor: statusColor }}
        onClick={() => onUpdate({ status: next })}
        title="Advance status"
      >
        {statusLabel}
      </button>
      <button
        className="room-task-edit-btn"
        onClick={() => { setDraft({ title: task.title, priority: task.priority }); setEditing(true) }}
        aria-label="Edit task"
      >✏</button>
      <button className="room-task-delete" onClick={onDelete} aria-label="Delete">✕</button>
    </div>
  )
}

// ── SOP Viewer Modal ───────────────────────────────────────────────────────
function SopViewerModal({ sop, onClose }) {
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ maxWidth: 520, width: '95vw' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <span className="modal-glyph">📋</span>
          <span className="modal-title">{sop.id}</span>
          <span className="modal-room">v{sop.version}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '0 24px 24px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#e0e0f0', marginBottom: 16 }}>
            {sop.title}
          </p>
          <ol className="sop-steps sop-steps--modal">
            {sop.steps.map((step, i) => (
              <li key={i} className="sop-step">{step}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── CHECKS tab — Pot Check + Filter Change ────────────────────────────────
function ChecksTab({ roomId }) {
  const [sub, setSub] = useState('pot')
  return (
    <section className="drawer-section">
      <div className="checks-sub-nav">
        <button className={`checks-sub-btn ${sub === 'pot' ? 'active' : ''}`} onClick={() => setSub('pot')}>
          🪴 Pot Check
        </button>
        <button className={`checks-sub-btn ${sub === 'filter' ? 'active' : ''}`} onClick={() => setSub('filter')}>
          🌬 Filter Change
        </button>
      </div>
      {sub === 'pot' && (
        <YesNoLog
          key={`pot-${roomId}`}
          label="Pot Check"
          apiPath="/api/pot-check-logs"
          bodyFn={(completed) => ({ roomId, completed, rootHealth: completed ? 'healthy' : 'concern' })}
        />
      )}
      {sub === 'filter' && (
        <YesNoLog
          key={`filter-${roomId}`}
          label="Filter Change"
          apiPath="/api/filter-change-logs"
          bodyFn={(completed) => ({ roomId, completed, newInstalled: completed })}
        />
      )}
    </section>
  )
}

// ── PPE items config ───────────────────────────────────────────────────────
const BASE_PPE = [
  { id: 'gloves',  label: 'Nitrile Gloves',  icon: '🧤' },
  { id: 'glasses', label: 'Safety Glasses',   icon: '🥽' },
  { id: 'boots',   label: 'Rubber Boots',     icon: '🥾' },
]
const IPM_PPE = [
  { id: 'respirator', label: 'N95/P100 Respirator', icon: '😷', required: true },
  { id: 'coverall',   label: 'Disposable Coverall',  icon: '🦺', required: true },
  { id: 'faceshield', label: 'Face Shield',           icon: '🛡️', required: false },
]
const REENTRY_PPE = [
  { id: 'respirator', label: 'N95/P100 Respirator', icon: '😷', required: true },
  { id: 'coverall',   label: 'Disposable Coverall',  icon: '🦺', required: true },
]

function getPpeItems(symbols, hasReentry) {
  if (hasReentry) return [...BASE_PPE, ...REENTRY_PPE]
  if (symbols?.includes('ipm')) return [...BASE_PPE, ...IPM_PPE]
  return BASE_PPE
}

function getPpeContext(symbols, hasReentry) {
  if (hasReentry) return 'reentry'
  if (symbols?.includes('ipm')) return 'ipm'
  return 'standard'
}

// ── PPE tab ────────────────────────────────────────────────────────────────
function PPETab({ roomId, symbols, reEntryExpiresAt }) {
  const authUser    = useFacilityStore(s => s.authUser)
  const hasReentry  = reEntryExpiresAt && new Date(reEntryExpiresAt) > new Date()
  const items       = getPpeItems(symbols, hasReentry)
  const context     = getPpeContext(symbols, hasReentry)
  const [checked, setChecked]     = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState(null)
  const [notes, setNotes]           = useState('')

  const toggle = (id) => setChecked(c => ({ ...c, [id]: !c[id] }))
  const allRequired = items.filter(i => i.required !== false).every(i => checked[i.id])
  const anyChecked  = items.some(i => checked[i.id])

  const handleConfirm = async () => {
    const worn = items.filter(i => checked[i.id]).map(i => i.id)
    setSubmitting(true); setError(null)
    try {
      if (API_BASE) {
        await apiFetch('/api/ppe-logs', {
          method: 'POST',
          body: JSON.stringify({ roomId, itemsWorn: worn, context, notes: notes || undefined }),
        })
      }
      setSaved(true)
      setTimeout(() => { setSaved(false); setChecked({}); setNotes('') }, 6000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (saved) return (
    <section className="drawer-section">
      <div className="ppe-confirmed">
        <div className="ppe-confirmed-icon">✓</div>
        <div className="ppe-confirmed-text">PPE CONFIRMED</div>
        <div className="ppe-confirmed-sub">Entry logged for {authUser?.name ?? 'operator'}</div>
      </div>
    </section>
  )

  return (
    <section className="drawer-section">
      {hasReentry && (
        <div className="ppe-reentry-banner">
          ⚠ RE-ENTRY PERIOD ACTIVE — enhanced PPE required
        </div>
      )}
      {context === 'ipm' && !hasReentry && (
        <div className="ppe-context-banner ppe-context-banner--ipm">
          🐛 IPM active — respiratory protection required
        </div>
      )}

      <h3 className="section-title">CONFIRM PPE</h3>
      <p className="ppe-instruction">Check each item worn before entering the room.</p>

      <div className="ppe-checklist">
        {items.map(item => (
          <label key={item.id} className={`ppe-item ${checked[item.id] ? 'ppe-item--checked' : ''}`}>
            <input
              type="checkbox"
              checked={!!checked[item.id]}
              onChange={() => toggle(item.id)}
            />
            <span className="ppe-item-icon">{item.icon}</span>
            <span className="ppe-item-label">{item.label}</span>
            {item.required && <span className="ppe-item-req">*</span>}
          </label>
        ))}
      </div>

      <div className="form-row" style={{ marginTop: 12 }}>
        <label>Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Optional…"
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      <button
        className="btn-primary"
        style={{ marginTop: 14, width: '100%' }}
        disabled={submitting || !anyChecked || !allRequired}
        onClick={handleConfirm}
      >
        {submitting ? 'Saving…' : 'Confirm Entry'}
      </button>
      {!allRequired && anyChecked && (
        <p className="ppe-warning">Required items (*) must be checked before confirming.</p>
      )}
    </section>
  )
}

// ── SOPs tab ───────────────────────────────────────────────────────────────
function SOPsTab({ symbols }) {
  const sops = getRelevantSops(symbols)
  const [acknowledged, setAcknowledged] = useState({})

  return (
    <section className="drawer-section">
      <h3 className="section-title">STANDARD OPERATING PROCEDURES</h3>
      <p className="sop-subtitle">{sops.length} SOP{sops.length !== 1 ? 's' : ''} relevant to this room</p>

      <div className="sop-list">
        {sops.map(sop => {
          const ack = acknowledged[sop.id]
          return (
            <div key={sop.id} className={`sop-card ${ack ? 'sop-card--acked' : ''}`}>
              <div className="sop-card-header">
                <div className="sop-card-meta">
                  <span className="sop-id">{sop.id}</span>
                  <span className="sop-version">v{sop.version}</span>
                  {ack && <span className="sop-ack-chip">✓ Read</span>}
                </div>
                <div className="sop-card-title">{sop.title}</div>
              </div>
              <div className="sop-card-body">
                <ol className="sop-steps">
                  {sop.steps.map((step, i) => (
                    <li key={i} className="sop-step">{step}</li>
                  ))}
                </ol>
                {!ack && (
                  <button
                    className="btn-primary sop-ack-btn"
                    onClick={() => setAcknowledged(a => ({ ...a, [sop.id]: true }))}
                  >
                    ✓ Acknowledge
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Main Drawer ────────────────────────────────────────────────────────────
export default function RoomDrawer() {
  const { selectedRoomId, drawerOpen, closeDrawer, getRoom, updateRoomStatus, updateRoomMode, transfers, tasks, updateTask, deleteTask } = useFacilityStore()
  const room = selectedRoomId ? getRoom(selectedRoomId) : null
  const roomTasks = room ? tasks.filter(t => t.roomId === room.id && t.status !== 'done') : []
  const transferAsOrigin = room ? transfers[room.id] : null
  const transferAsDest   = room
    ? Object.entries(transfers).find(([, t]) => t.destinationId === room.id)
    : null
  const sc = room ? STATUS_COLORS[room.status] ?? STATUS_COLORS[STATUS.NORMAL] : STATUS_COLORS[STATUS.NORMAL]
  const tc = room ? (TYPE_COLOR[room.type] || TYPE_COLOR.utility) : TYPE_COLOR.utility

  const [tab, setTab]               = useState('OVERVIEW')
  const [defolOpen, setDefolOpen]   = useState(false)
  const [sprayOpen, setSprayOpen]   = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [netOpen, setNetOpen]       = useState(false)
  const [sprayKey, setSprayKey]     = useState(0)
  const [sopViewing, setSopViewing] = useState(null) // sop object | null

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
                {room.symbols?.length > 0 && (
                  <section className="drawer-section">
                    <h3 className="section-title">ACTIVE FLAGS</h3>
                    <div className="flags-grid">
                      {room.symbols.map(sym => {
                        const s   = SYMBOL_DISPLAY[sym]
                        if (!s) return null
                        const isDefol = sym === 'defoliation'
                        const isNet   = sym === 'net'
                        const sop     = getSopForOverlay(sym)
                        return (
                          <div key={sym} className={`flag-chip ${(isDefol || isNet) ? 'flag-chip--editable' : ''}`}>
                            <span className="flag-glyph">{s.glyph}</span>
                            <span className="flag-label">{s.label}</span>
                            {sop && (
                              <button
                                className="flag-sop-btn"
                                onClick={() => setSopViewing(sop)}
                                aria-label={`View SOP for ${s.label}`}
                              >
                                SOP
                              </button>
                            )}
                            {isDefol && (
                              <button className="flag-edit-btn" onClick={() => setDefolOpen(true)}
                                aria-label="Edit defoliation progress">✏</button>
                            )}
                            {isNet && (
                              <button className="flag-edit-btn" onClick={() => setNetOpen(true)}
                                aria-label="Log net status">✏</button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}

                {roomTasks.length > 0 && (
                  <section className="drawer-section">
                    <h3 className="section-title">OPEN TASKS</h3>
                    <div className="room-tasks-list">
                      {roomTasks.map(task => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          onUpdate={(patch) => {
                            updateTask(task.id, patch)
                            apiFetch(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify(patch) })
                              .catch(() => updateTask(task.id, task))
                          }}
                          onDelete={() => {
                            deleteTask(task.id)
                            apiFetch(`/api/tasks/${task.id}`, { method: 'DELETE' }).catch(() => {})
                          }}
                        />
                      ))}
                    </div>
                  </section>
                )}

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

                {room.id === 'PREVEG' && <PreVegZoneMap />}

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

            {/* ── Tab: Checks ──────────────────────────────────────── */}
            {tab === 'CHECKS' && (
              <ChecksTab key={room.id} roomId={room.id} />
            )}

            {/* ── Tab: PPE ─────────────────────────────────────────── */}
            {tab === 'PPE' && (
              <PPETab
                key={room.id}
                roomId={room.id}
                symbols={room.symbols}
                reEntryExpiresAt={room.reEntryExpiresAt}
              />
            )}

            {/* ── Tab: SOPs ────────────────────────────────────────── */}
            {tab === 'SOPs' && (
              <SOPsTab key={room.id} symbols={room.symbols} />
            )}
          </>
        )}
      </aside>

      {defolOpen && room && hasDefoliation && (
        <DefoliationModal roomId={room.id} roomName={room.name} onClose={() => setDefolOpen(false)} />
      )}
      {sprayOpen && room && (
        <SprayLogModal
          roomId={room.id}
          onClose={() => setSprayOpen(false)}
          onSaved={() => { setSprayKey(k => k + 1); setTab('SPRAY LOGS') }}
        />
      )}
      {transferOpen && room && transferAsOrigin && (
        <TransferModal originRoomId={room.id} onClose={() => setTransferOpen(false)} />
      )}
      {netOpen && room && (
        <NetModal roomId={room.id} onClose={() => setNetOpen(false)} onSaved={() => setNetOpen(false)} />
      )}
      {sopViewing && (
        <SopViewerModal sop={sopViewing} onClose={() => setSopViewing(null)} />
      )}
    </>
  )
}
