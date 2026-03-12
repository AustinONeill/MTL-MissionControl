import { useState, useRef } from 'react'
import { useChatStore }    from '../store/chatStore'
import { useFacilityStore } from '../store/facilityStore'

const STATUS_ITEMS = [
  { color: '#4ade80', label: 'Normal' },
  { color: '#facc15', label: 'IPM / Cultivation Issue' },
  { color: '#f87171', label: 'Control / Env Alert' },
  { color: '#4a4a68', label: 'Idle / Offline' },
]

export const SYMBOL_ITEMS = [
  { key: 'ipm',           glyph: '🐛', label: 'IPM Active' },
  { key: 'net',           glyph: '🕸', label: 'Net' },
  { key: 'defoliation',   glyph: '✂',  label: 'Defoliation' },
  { key: 'transfer',      glyph: '⇄',  label: 'Transfer' },
  { key: 'harvest_ready', glyph: '◷',  label: 'Harvest Ready' },
  { key: 'mode_change',   glyph: '⚙',  label: 'Mode Change' },
  { key: 'supply_ready',  glyph: '◈',  label: 'Supply Ready' },
  { key: 'issue',         glyph: '⚠',  label: 'Open Issue' },
]

export default function LegendPanel({ onOpenBoard, onOpenMessages }) {
  const [side,         setSide]         = useState('left')
  const [collapsed,    setCollapsed]    = useState(false)
  const [dragging,     setDragging]     = useState(null)
  const [boardOpen,    setBoardOpen]    = useState(false)
  const [messagesOpen, setMessagesOpen] = useState(false)
  const [filtersOpen,  setFiltersOpen]  = useState(false)
  const [hiddenTypes,  setHiddenTypes]  = useState(new Set())
  const ghostRef = useRef(null)

  // Board preview — task summary from store
  const tasks = useFacilityStore(s => s.tasks)
  const todoCount = tasks.filter(t => t.status === 'todo').length
  const inProgCount = tasks.filter(t => t.status === 'in_progress').length
  const recentTasks = tasks.filter(t => t.status !== 'done').slice(0, 3)

  // Messages preview — last 3 messages across all conversations
  const allMessages = useChatStore(s => s.messages)
  const recentMsgs  = Object.values(allMessages)
    .flat()
    .filter(m => m?.content)
    .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
    .slice(0, 3)

  const toggleHidden = (key) => setHiddenTypes(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const handleDragStart = (e, item) => {
    // Set transfer data (text/plain is most reliable for SVG drop targets)
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', item.key)
    e.dataTransfer.setData('application/gardenops-symbol', item.key)

    // Custom drag ghost — large glyph pill
    const ghost = document.createElement('div')
    ghost.textContent = item.glyph
    ghost.setAttribute('aria-hidden', 'true')
    ghost.style.cssText = [
      'position:fixed', 'top:-200px', 'left:-200px',
      'font-size:22px', 'line-height:1',
      'background:#0e2e1e', 'border:1.5px solid #2d5c42',
      'color:#4ade80', 'padding:8px 12px', 'border-radius:6px',
      'box-shadow:0 4px 16px rgba(0,0,0,0.6)',
      'pointer-events:none', 'z-index:9999',
    ].join(';')
    document.body.appendChild(ghost)
    ghostRef.current = ghost
    e.dataTransfer.setDragImage(ghost, 20, 20)

    setDragging(item.key)
  }

  const handleDragEnd = () => {
    setDragging(null)
    if (ghostRef.current) {
      document.body.removeChild(ghostRef.current)
      ghostRef.current = null
    }
  }

  return (
    <div
      className={`legend-panel ${side} ${collapsed ? 'collapsed' : ''}`}
      role="complementary"
      aria-label="Map legend"
    >
      {/* ── Title bar ─────────────────────────────────────────── */}
      <div className="lp-header">
        <button
          className="lp-icon-btn"
          title={side === 'left' ? 'Move to right' : 'Move to left'}
          onClick={() => setSide(s => s === 'left' ? 'right' : 'left')}
          aria-label="Swap panel side"
        >
          {side === 'left' ? '⇥' : '⇤'}
        </button>

        <span className="lp-title">LEGEND</span>

        <button
          className="lp-icon-btn"
          title={collapsed ? 'Expand' : 'Collapse'}
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand legend' : 'Collapse legend'}
        >
          {collapsed ? '+' : '−'}
        </button>
      </div>

      {/* ── Body ──────────────────────────────────────────────── */}
      <div className="lp-body">
        <div className="lp-section-label">STATUS</div>
        <ul className="lp-list">
          {STATUS_ITEMS.map(({ color, label }) => (
            <li key={label} className="lp-row">
              <span className="lp-swatch" style={{ background: color, boxShadow: `0 0 6px ${color}55` }} />
              <span className="lp-row-label">{label}</span>
            </li>
          ))}
        </ul>

        <div className="lp-divider" />

        <div className="lp-section-label">
          OVERLAYS
          <span className="lp-drag-hint">drag to room ↓</span>
        </div>
        <ul className="lp-list">
          {SYMBOL_ITEMS.map((item) => (
            <li
              key={item.key}
              className={`lp-row lp-row--draggable ${dragging === item.key ? 'lp-row--dragging' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              onDragEnd={handleDragEnd}
              title={`Drag onto a room to log: ${item.label}`}
            >
              <span className="lp-drag-handle">⠿</span>
              <span className="lp-glyph">{item.glyph}</span>
              <span className="lp-row-label">{item.label}</span>
            </li>
          ))}
        </ul>

        <div className="lp-divider" />

        <p className="lp-note">
          Colors = operational state only.<br />
          Drag a symbol onto any room to log it.
        </p>
      </div>

      {/* ── Board Toolbox: task summary preview ─────────────── */}
      <div className="lp-accordion">
        <button
          className="lp-accordion-toggle"
          onClick={() => setBoardOpen(o => !o)}
          aria-expanded={boardOpen}
          aria-label={boardOpen ? 'Collapse board preview' : 'Expand board preview'}
        >
          <span className="lp-accordion-label">BOARD</span>
          <span className={`lp-accordion-arrow${boardOpen ? ' open' : ''}`}>{boardOpen ? '−' : '+'}</span>
        </button>
        {boardOpen && (
          <div className="lp-accordion-body lp-toolbox-preview">
            <div className="lp-preview-stats">
              <span className="lp-preview-stat">
                <span className="lp-stat-dot" style={{ background: '#6b7280' }} />
                <span className="lp-stat-val">{todoCount}</span>
                <span className="lp-stat-label">TODO</span>
              </span>
              <span className="lp-preview-stat">
                <span className="lp-stat-dot" style={{ background: '#f59e0b' }} />
                <span className="lp-stat-val">{inProgCount}</span>
                <span className="lp-stat-label">IN PROGRESS</span>
              </span>
            </div>
            {recentTasks.length === 0 ? (
              <p className="lp-chat-empty">No open tasks</p>
            ) : (
              recentTasks.map((t, i) => (
                <div key={t.id ?? i} className="lp-chat-msg">
                  <span className="lp-chat-sender" style={{ color: t.status === 'in_progress' ? '#f59e0b' : 'var(--text-muted)' }}>
                    {t.status === 'in_progress' ? '▶' : '○'} {t.priority?.toUpperCase() ?? 'NORMAL'}
                  </span>
                  <span className="lp-chat-content">{t.title}</span>
                </div>
              ))
            )}
            <button className="lp-expand-btn" onClick={onOpenBoard} aria-label="Open full task board">
              Open Board ↗
            </button>
          </div>
        )}
      </div>

      {/* ── Messages Toolbox: chat preview ───────────────────── */}
      <div className="lp-accordion">
        <button
          className="lp-accordion-toggle"
          onClick={() => setMessagesOpen(o => !o)}
          aria-expanded={messagesOpen}
          aria-label={messagesOpen ? 'Collapse messages preview' : 'Expand messages preview'}
        >
          <span className="lp-accordion-label">MESSAGES</span>
          <span className={`lp-accordion-arrow${messagesOpen ? ' open' : ''}`}>{messagesOpen ? '−' : '+'}</span>
        </button>
        {messagesOpen && (
          <div className="lp-accordion-body lp-toolbox-preview">
            {recentMsgs.length === 0 ? (
              <p className="lp-chat-empty">No recent messages</p>
            ) : (
              recentMsgs.map((msg, i) => (
                <div key={msg.id ?? i} className="lp-chat-msg">
                  <span className="lp-chat-sender">
                    {msg.senderName ?? msg.authorName ?? 'User'}
                  </span>
                  <span className="lp-chat-content">
                    {msg.content.length > 55 ? msg.content.slice(0, 55) + '…' : msg.content}
                  </span>
                </div>
              ))
            )}
            <button className="lp-expand-btn" onClick={onOpenMessages} aria-label="Open full chat">
              Open Chat ↗
            </button>
          </div>
        )}
      </div>

      {/* ── Filters: toggle overlay visibility ───────────────── */}
      <div className="lp-accordion">
        <button
          className="lp-accordion-toggle"
          onClick={() => setFiltersOpen(o => !o)}
          aria-expanded={filtersOpen}
          aria-label={filtersOpen ? 'Collapse filters' : 'Expand overlay filters'}
        >
          <span className="lp-accordion-label">FILTERS</span>
          <span className={`lp-accordion-arrow${filtersOpen ? ' open' : ''}`}>{filtersOpen ? '−' : '+'}</span>
        </button>
        {filtersOpen && (
          <div className="lp-accordion-body" style={{ paddingBottom: 14 }}>
            <ul className="lp-list">
              {SYMBOL_ITEMS.map(item => (
                <li key={item.key} className="lp-row lp-filter-row">
                  <span className="lp-glyph">{item.glyph}</span>
                  <span className="lp-row-label">{item.label}</span>
                  <button
                    className={`lp-toggle${hiddenTypes.has(item.key) ? '' : ' active'}`}
                    onClick={() => toggleHidden(item.key)}
                    role="switch"
                    aria-checked={!hiddenTypes.has(item.key)}
                    aria-label={`${hiddenTypes.has(item.key) ? 'Show' : 'Hide'} ${item.label} overlays`}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
