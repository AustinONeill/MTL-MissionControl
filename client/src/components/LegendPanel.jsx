import { useState, useRef } from 'react'
import useDraggable from '../hooks/useDraggable'

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

export default function LegendPanel({ panelRef, siblingRefs }) {
  const [collapsed,   setCollapsed]   = useState(false)
  const [dragSymbol,  setDragSymbol]  = useState(null)   // which overlay glyph is being dragged to a room
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [hiddenTypes, setHiddenTypes] = useState(new Set())
  const ghostRef = useRef(null)

  const { pos, onDragStart } = useDraggable(
    panelRef,
    { x: 20, y: 80 },
    'mtl-panel-legend',
    siblingRefs,
  )

  const toggleHidden = (key) => setHiddenTypes(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  // ── Overlay glyph drag-to-room (HTML5 dataTransfer — separate from panel drag) ──
  const handleSymbolDragStart = (e, item) => {
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

  const handleSymbolDragEnd = () => {
    setDragSymbol(null)
    if (ghostRef.current) {
      document.body.removeChild(ghostRef.current)
      ghostRef.current = null
    }
  }

  return (
    <div
      ref={panelRef}
      className={`legend-panel${collapsed ? ' collapsed' : ''}`}
      style={{ left: pos.x, top: pos.y }}
      role="complementary"
      aria-label="Map legend"
    >
      {/* ── Title bar (drag handle) ────────────────────────────── */}
      <div className="lp-header" onMouseDown={onDragStart}>
        <span className="lp-drag-indicator" aria-hidden="true">⠿</span>
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
              className={`lp-row lp-row--draggable ${dragSymbol === item.key ? 'lp-row--dragging' : ''}`}
              draggable
              onDragStart={(e) => handleSymbolDragStart(e, item)}
              onDragEnd={handleSymbolDragEnd}
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

      {/* ── Filters ───────────────────────────────────────────── */}
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
