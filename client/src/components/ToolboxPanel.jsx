import { useState, useRef } from 'react'
import { useFacilityStore } from '../store/facilityStore'
import { useChatStore } from '../store/chatStore'
import useDraggable from '../hooks/useDraggable'
import { SYMBOL_ITEMS, STATUS_ITEMS } from '../data/overlaySymbols'

// ─────────────────────────────────────────────────────────────────
// Section content renderers
// ─────────────────────────────────────────────────────────────────

function LegendContent({ dragSymbol, setDragSymbol, ghostRef, filtersOpen, setFiltersOpen }) {
  const hiddenTypes       = useFacilityStore(s => s.hiddenOverlayTypes)
  const toggleOverlayFilter = useFacilityStore(s => s.toggleOverlayFilter)
  const handleDragStart = (e, item) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', item.key)
    e.dataTransfer.setData('application/gardenops-symbol', item.key)

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
    setDragSymbol(item.key)
  }

  const handleDragEnd = () => {
    setDragSymbol(null)
    if (ghostRef.current) {
      document.body.removeChild(ghostRef.current)
      ghostRef.current = null
    }
  }

  const toggleHidden = (key) => toggleOverlayFilter(key)

  return (
    <div className="tb-section-body">
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
            className={`lp-row lp-row--draggable ${dragSymbol === item.key ? 'lp-row--dragging' : ''}`}
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

      {/* Filters sub-accordion */}
      <div className="lp-accordion">
        <button
          className="lp-accordion-toggle"
          onClick={() => setFiltersOpen(o => !o)}
          aria-expanded={filtersOpen}
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

function BoardContent({ onOpen }) {
  const tasks       = useFacilityStore(s => s.tasks)
  const todoCount   = tasks.filter(t => t.status === 'todo').length
  const inProgCount = tasks.filter(t => t.status === 'in_progress').length
  const recentTasks = tasks.filter(t => t.status !== 'done').slice(0, 3)

  return (
    <div className="tb-section-body">
      <div className="toolbox-stats">
        <span className="toolbox-stat">
          <span className="toolbox-stat-dot" style={{ background: '#6b7280' }} />
          <span className="toolbox-stat-val">{todoCount}</span>
          <span className="toolbox-stat-lbl">TODO</span>
        </span>
        <span className="toolbox-stat">
          <span className="toolbox-stat-dot" style={{ background: '#f59e0b' }} />
          <span className="toolbox-stat-val">{inProgCount}</span>
          <span className="toolbox-stat-lbl">IN PROG</span>
        </span>
      </div>
      {recentTasks.length === 0 ? (
        <p className="toolbox-empty">No open tasks</p>
      ) : (
        <div className="toolbox-task-list">
          {recentTasks.map((t, i) => (
            <div key={t.id ?? i} className="toolbox-task-row">
              <span className="toolbox-task-dot" style={{ background: t.status === 'in_progress' ? '#f59e0b' : '#6b7280' }} />
              <span className="toolbox-task-title">{t.title}</span>
            </div>
          ))}
        </div>
      )}
      <button className="toolbox-open-btn" onClick={onOpen}>Open Board ↗</button>
    </div>
  )
}

function MessagesContent({ onOpen, unread }) {
  const allMessages = useChatStore(s => s.messages)
  const recentMsgs  = Object.values(allMessages)
    .flat()
    .filter(m => m?.content)
    .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
    .slice(0, 3)

  return (
    <div className="tb-section-body">
      {recentMsgs.length === 0 ? (
        <p className="toolbox-empty">No recent messages</p>
      ) : (
        <div className="toolbox-msg-list">
          {recentMsgs.map((msg, i) => (
            <div key={msg.id ?? i} className="toolbox-msg-row">
              <span className="toolbox-msg-sender">{msg.senderName ?? msg.authorName ?? 'User'}</span>
              <span className="toolbox-msg-content">
                {msg.content.length > 52 ? msg.content.slice(0, 52) + '…' : msg.content}
              </span>
            </div>
          ))}
        </div>
      )}
      <button className="toolbox-open-btn" onClick={onOpen}>
        Open Chat ↗{unread > 0 && <span className="tb-inline-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────

const SECTION_DEFS = [
  { id: 'legend',   title: 'LEGEND',   icon: '⬡' },
  { id: 'board',    title: 'BOARD',    icon: '📋' },
  { id: 'messages', title: 'MESSAGES', icon: '💬' },
]

export default function ToolboxPanel({ onOpenBoard, onOpenMessages, unread }) {
  const drawerOpen = useFacilityStore(s => s.drawerOpen)

  // Which sections are detached from the main panel
  const [detached, setDetached] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('mtl-toolbox-detached')) || []) } catch { return new Set() }
  })
  // Collapsed state per section + main panel
  const [collapsed, setCollapsed] = useState({ main: false, legend: false, board: false, messages: false })

  // Legend-specific state (persists across detach/reattach)
  const [dragSymbol,  setDragSymbol]  = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const ghostRef = useRef(null)

  // One ref per panel (main + each potentially-detached section)
  const mainRef     = useRef(null)
  const legendRef   = useRef(null)
  const boardRef    = useRef(null)
  const messagesRef = useRef(null)

  // All four are always registered — null refs are ignored by the hook
  const mainDrag     = useDraggable(mainRef,     { x: 20, y: 80 },                                        'mtl-panel-main',         [legendRef, boardRef, messagesRef])
  const legendDrag   = useDraggable(legendRef,   () => ({ x: 260, y: 80 }),                               'mtl-panel-det-legend',   [mainRef, boardRef, messagesRef])
  const boardDrag    = useDraggable(boardRef,    () => ({ x: Math.max(0, window.innerWidth - 230), y: 80  }), 'mtl-panel-det-board',    [mainRef, legendRef, messagesRef])
  const messagesDrag = useDraggable(messagesRef, () => ({ x: Math.max(0, window.innerWidth - 230), y: 280 }), 'mtl-panel-det-messages', [mainRef, legendRef, boardRef])

  const detach = (id) => setDetached(d => { const n = new Set(d); n.add(id);    save(n); return n })
  const attach = (id) => setDetached(d => { const n = new Set(d); n.delete(id); save(n); return n })
  const save   = (d)  => localStorage.setItem('mtl-toolbox-detached', JSON.stringify([...d]))
  const toggle = (id) => setCollapsed(c => ({ ...c, [id]: !c[id] }))

  const sectionDrags = { legend: legendDrag, board: boardDrag, messages: messagesDrag }
  const sectionRefs  = { legend: legendRef,  board: boardRef,  messages: messagesRef  }

  const renderContent = (id) => {
    if (id === 'legend')   return <LegendContent dragSymbol={dragSymbol} setDragSymbol={setDragSymbol} ghostRef={ghostRef} filtersOpen={filtersOpen} setFiltersOpen={setFiltersOpen} />
    if (id === 'board')    return <BoardContent onOpen={onOpenBoard} />
    if (id === 'messages') return <MessagesContent onOpen={onOpenMessages} unread={unread} />
    return null
  }

  if (drawerOpen) return null

  const attached = SECTION_DEFS.filter(s => !detached.has(s.id))
  const floating = SECTION_DEFS.filter(s =>  detached.has(s.id))

  return (
    <>
      {/* ── Main docked toolbox ──────────────────────────────── */}
      <div
        ref={mainRef}
        className={`tb-panel${collapsed.main ? ' tb-panel--collapsed' : ''}`}
        style={{ left: mainDrag.pos.x, top: mainDrag.pos.y }}
        role="complementary"
        aria-label="Toolbox"
      >
        <div className="tb-header" onMouseDown={mainDrag.onDragStart}>
          <span className="tb-drag-indicator" aria-hidden="true">⠿</span>
          <span className="tb-title">TOOLBOX</span>
          <button className="tb-icon-btn" onClick={() => toggle('main')} aria-label={collapsed.main ? 'Expand' : 'Collapse'}>
            {collapsed.main ? '+' : '−'}
          </button>
        </div>

        {!collapsed.main && (
          <div className="tb-body">
            {attached.length === 0 ? (
              <p className="tb-all-detached">All sections are floating ↗</p>
            ) : (
              attached.map((s, i) => (
                <div key={s.id} className={`tb-section${i > 0 ? ' tb-section--border' : ''}`}>
                  {/* Section sub-header */}
                  <div className="tb-section-header">
                    <span className="tb-section-icon">{s.icon}</span>
                    <span className="tb-section-title">{s.title}</span>
                    <button
                      className="tb-detach-btn"
                      onClick={() => detach(s.id)}
                      title="Detach to floating panel"
                      aria-label={`Detach ${s.title}`}
                    >↗</button>
                    <button
                      className="tb-icon-btn"
                      onClick={() => toggle(s.id)}
                      aria-label={collapsed[s.id] ? `Expand ${s.title}` : `Collapse ${s.title}`}
                    >
                      {collapsed[s.id] ? '+' : '−'}
                    </button>
                  </div>
                  {!collapsed[s.id] && renderContent(s.id)}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Detached floating panels ─────────────────────────── */}
      {floating.map(s => (
        <div
          key={s.id}
          ref={sectionRefs[s.id]}
          className={`tb-panel tb-panel--floating${collapsed[s.id] ? ' tb-panel--collapsed' : ''}`}
          style={{ left: sectionDrags[s.id].pos.x, top: sectionDrags[s.id].pos.y }}
          role="complementary"
          aria-label={s.title}
        >
          <div className="tb-header" onMouseDown={sectionDrags[s.id].onDragStart}>
            <span className="tb-drag-indicator" aria-hidden="true">⠿</span>
            <span className="tb-section-icon">{s.icon}</span>
            <span className="tb-title">{s.title}</span>
            <button
              className="tb-attach-btn"
              onClick={() => attach(s.id)}
              title="Dock back to toolbox"
              aria-label={`Reattach ${s.title} to toolbox`}
            >↙</button>
            <button className="tb-icon-btn" onClick={() => toggle(s.id)} aria-label={collapsed[s.id] ? 'Expand' : 'Collapse'}>
              {collapsed[s.id] ? '+' : '−'}
            </button>
          </div>
          {!collapsed[s.id] && renderContent(s.id)}
        </div>
      ))}
    </>
  )
}
