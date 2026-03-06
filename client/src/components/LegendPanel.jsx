import { useState, useRef } from 'react'

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

export default function LegendPanel() {
  const [side,      setSide]      = useState('left')
  const [collapsed, setCollapsed] = useState(false)
  const [dragging,  setDragging]  = useState(null)
  const ghostRef = useRef(null)

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
    </div>
  )
}
