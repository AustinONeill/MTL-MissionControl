import { useState } from 'react'
import { useFacilityStore } from '../store/facilityStore'

// ── Static batch metadata ──────────────────────────────────────────────────
const BATCHES = [
  { id: 'B78', label: 'Batch 7–8', initZones: [7, 8], color: '#4ade80', border: '#1a4d2a', bg: '#030e06' },
  { id: 'B56', label: 'Batch 5–6', initZones: [5, 6], color: '#60a5fa', border: '#1a3566', bg: '#03091c' },
  { id: 'B4',  label: 'Zone 4',    initZones: [4],    color: '#a78bfa', border: '#3a2d6a', bg: '#0c0916' },
  { id: 'B3',  label: 'Zone 3',    initZones: [3],    color: '#f59e0b', border: '#5a3a00', bg: '#150c00' },
]

// The four selectable positions inside PreVeg (back → front)
const ZONE_GROUPS = [
  { id: 'back',   zones: [7, 8], label: '7–8', row: 0 },
  { id: 'mid',    zones: [5, 6], label: '5–6', row: 1 },
  { id: 'frontL', zones: [4],    label: '4',   row: 2 },
  { id: 'frontR', zones: [3],    label: '3',   row: 2 },
]

// Fixed physical zone positions in the SVG grid
const ZONE_CELLS = [
  { num: 7, col: 0, row: 0 },
  { num: 8, col: 1, row: 0 },
  { num: 5, col: 0, row: 1 },
  { num: 6, col: 1, row: 1 },
  { num: 4, col: 0, row: 2 },
  { num: 3, col: 1, row: 2 },
]

// ── SVG geometry ───────────────────────────────────────────────────────────
const CW = 88, CH = 52, GAPX = 6, GAPY = 8, PAD = 12
const SVG_W = 2 * CW + GAPX + PAD * 2
const SVG_H = 3 * CH + 2 * GAPY + PAD * 2 + 18

function cellPos(col, row) {
  return { x: PAD + col * (CW + GAPX), y: PAD + row * (CH + GAPY) }
}

// Centre point of a set of zone numbers
function zonesCenter(zones) {
  const cells = ZONE_CELLS.filter(z => zones.includes(z.num))
  if (!cells.length) return { x: SVG_W / 2, y: SVG_H / 2 }
  const sumX = cells.reduce((s, z) => s + cellPos(z.col, z.row).x + CW / 2, 0)
  const sumY = cells.reduce((s, z) => s + cellPos(z.col, z.row).y + CH / 2, 0)
  return { x: sumX / cells.length, y: sumY / cells.length }
}

// Quadratic bezier SVG path — curves through right margin so it avoids cells
// For same-row horizontal moves, arc via top instead of right
function historyPath(from, to) {
  const sameRow = Math.abs(from.y - to.y) < 20
  if (sameRow) {
    // Arc above via top margin
    const cy = Math.min(from.y, to.y) - 28
    return `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${cy} ${to.x} ${to.y}`
  }
  // Arc via right margin
  const cx = SVG_W + 12
  const cy = (from.y + to.y) / 2
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`
}

// Key to compare zone sets regardless of order
const zoneKey = (zones) => [...zones].sort().join()

// ── SVG Map ────────────────────────────────────────────────────────────────
function ZoneMapSvg({ batchStates, histories }) {
  // Build zone → batch from live state; last writer wins if collision (shouldn't happen)
  const zoneBatch = {}
  BATCHES.forEach(b => {
    const zones = batchStates[b.id]?.zones ?? b.initZones
    zones.forEach(z => { zoneBatch[z] = b })
  })

  return (
    // overflow visible so right-margin arcs can extend past the SVG edge
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%"
      style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        {BATCHES.map(b => (
          <marker key={b.id} id={`pvz-arr-${b.id}`}
            markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={b.color} />
          </marker>
        ))}
      </defs>

      {/* Background */}
      <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#060d08" rx={5} />

      {/* Room walls outline */}
      <rect x={PAD - 4} y={PAD - 4}
        width={SVG_W - PAD * 2 + 8} height={3 * CH + 2 * GAPY + 8}
        fill="none" stroke="#1a2a1a" strokeWidth={1} rx={3} />

      {/* History lines — drawn BEHIND zone cells, route outside via margins */}
      {histories.map((entry, i) => {
        const from = zonesCenter(entry.fromZones)
        const to   = zonesCenter(entry.toZones)
        const d    = historyPath(from, to)
        const opacity = entry.isLatest ? 0.9 : Math.max(0.15, 0.5 - entry.age * 0.12)
        return (
          <path key={`${entry.batchId}-${i}`}
            d={d}
            fill="none"
            stroke={entry.color}
            strokeWidth={entry.isLatest ? 2 : 1.5}
            strokeDasharray={entry.isLatest ? '7 4' : '4 4'}
            strokeLinecap="round"
            opacity={opacity}
            markerEnd={`url(#pvz-arr-${entry.batchId})`}
            className={entry.isLatest ? 'pvz-flow-line' : ''}
          />
        )
      })}

      {/* Zone cells */}
      {ZONE_CELLS.map(z => {
        const b = zoneBatch[z.num]
        const { x, y } = cellPos(z.col, z.row)

        if (!b) {
          return (
            <g key={z.num}>
              <rect x={x} y={y} width={CW} height={CH} rx={4}
                fill="#060d08" stroke="#111" strokeWidth={1} />
              <text x={x + CW / 2} y={y + CH / 2 - 2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={22} fontWeight="900" fill="#1a1a1a"
                fontFamily="'JetBrains Mono', monospace">{z.num}</text>
              <text x={x + CW / 2} y={y + CH - 7}
                textAnchor="middle" fontSize={6} fontWeight="700" fill="#1a1a1a"
                fontFamily="'JetBrains Mono', monospace">ZONE</text>
            </g>
          )
        }

        const hasDest    = !!batchStates[b.id]?.destination
        const curZones   = batchStates[b.id]?.zones ?? b.initZones
        const isPaired   = curZones.length > 1

        return (
          <g key={z.num}>
            {/* Full-width background for paired batches — drawn from left cell only */}
            {isPaired && z.col === 0 && (
              <rect x={PAD - 4} y={y - 3}
                width={SVG_W - PAD * 2 + 8} height={CH + 6}
                rx={4} fill={b.bg}
                stroke={hasDest ? b.color : b.border}
                strokeWidth={hasDest ? 1.5 : 1}
              />
            )}

            {/* Individual cell background for solo zones */}
            {!isPaired && (
              <rect x={x} y={y} width={CW} height={CH} rx={4}
                fill={b.bg}
                stroke={hasDest ? b.color : b.border}
                strokeWidth={hasDest ? 1.5 : 1}
              />
            )}

            {/* Left accent bar */}
            {z.col === 0 && (
              <rect x={x + 4} y={y + 8} width={2.5} height={CH - 16} rx={1}
                fill={b.color} opacity={hasDest ? 0.9 : 0.4} />
            )}

            <text x={x + CW / 2} y={y + CH / 2 - 2}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={22} fontWeight="900"
              fill={b.color} opacity={hasDest ? 0.85 : 0.3}
              fontFamily="'JetBrains Mono', monospace">{z.num}</text>

            <text x={x + CW / 2} y={y + CH - 7}
              textAnchor="middle" fontSize={6} fontWeight="700"
              fill={b.color} opacity={hasDest ? 0.55 : 0.2}
              fontFamily="'JetBrains Mono', monospace">ZONE</text>

            {hasDest && z.col === 1 && (
              <text x={x + CW - 6} y={y + 13} textAnchor="end" fontSize={9}
                fill={b.color} fontFamily="sans-serif">⇄</text>
            )}
          </g>
        )
      })}

      <text x={SVG_W / 2} y={SVG_H - 3} textAnchor="middle"
        fontSize={7} fill="#1a3a1a" fontFamily="'JetBrains Mono', monospace">▼ ENTRY</text>
      <text x={SVG_W / 2} y={8} textAnchor="middle"
        fontSize={6.5} fill="#1a2a1a" fontFamily="'JetBrains Mono', monospace">▲ BACK</text>
    </svg>
  )
}

// ── Batch card ─────────────────────────────────────────────────────────────
function BatchCard({ batch, batchState, allBatchStates, rooms, onSet, onClear, onMove, onUndo }) {
  const [editing, setEditing] = useState(false)
  const [dest, setDest]       = useState(batchState.destination ?? '')
  const [date, setDate]       = useState(batchState.transferDate ?? '')
  const [notes, setNotes]     = useState(batchState.notes ?? '')

  const destRoom     = rooms.find(r => r.id === dest)
  const hasDest      = !!batchState.destination
  const currentZones = batchState.zones ?? batch.initZones
  const history      = batchState.zoneHistory ?? []
  const canUndo      = history.length > 0

  const handleSave = () => {
    if (!dest) return
    onSet({ destination: dest, transferDate: date || null, notes })
    setEditing(false)
  }

  const handleCancel = () => {
    setDest(batchState.destination ?? '')
    setDate(batchState.transferDate ?? '')
    setNotes(batchState.notes ?? '')
    setEditing(false)
  }

  // Returns the batch currently at a zone group (excluding self)
  const occupantOf = (zones) => {
    const key = zoneKey(zones)
    return BATCHES.find(b => {
      if (b.id === batch.id) return false
      return zoneKey(allBatchStates[b.id]?.zones ?? b.initZones) === key
    })
  }

  // History breadcrumb: "7–8 → 5–6 → 4"
  const breadcrumb = history.length > 0
    ? [zoneKey(history[0].fromZones), ...history.map(h => zoneKey(h.toZones))]
        .map(k => ZONE_GROUPS.find(g => zoneKey(g.zones) === k)?.label ?? k)
        .join(' → ')
    : null

  return (
    <div className="pvz-batch-card" style={{
      borderColor: hasDest ? batch.color : batch.border,
      background:  batch.bg,
    }}>
      {/* ── Header ── */}
      <div className="pvz-batch-header">
        <span className="pvz-batch-zones">
          {currentZones.map(z => (
            <span key={z} className="pvz-zone-pill"
              style={{ color: batch.color, borderColor: batch.border }}>{z}</span>
          ))}
        </span>
        <span className="pvz-batch-label" style={{ color: batch.color }}>{batch.label}</span>

        {!editing && (
          hasDest
            ? <button className="pvz-action-btn" onClick={() => setEditing(true)}>✏</button>
            : <button className="pvz-action-btn pvz-action-btn--plan"
                style={{ borderColor: batch.border, color: batch.color }}
                onClick={() => setEditing(true)}>
                Plan Exit
              </button>
        )}
      </div>

      {/* ── Zone position picker ── */}
      <div className="pvz-zone-picker">
        <span className="pvz-zone-picker-label">POSITION</span>
        <div className="pvz-zone-pick-row">
          {ZONE_GROUPS.map(g => {
            const isCurrent = zoneKey(g.zones) === zoneKey(currentZones)
            const occupant  = !isCurrent ? occupantOf(g.zones) : null
            return (
              <button key={g.id}
                className={[
                  'pvz-zone-pick-btn',
                  isCurrent ? 'pvz-zone-pick-btn--current'  : '',
                  occupant  ? 'pvz-zone-pick-btn--occupied'  : '',
                ].join(' ')}
                style={isCurrent
                  ? { borderColor: batch.color, color: batch.color, background: batch.bg }
                  : {}}
                disabled={isCurrent}
                title={occupant
                  ? `Swap with ${occupant.label}`
                  : isCurrent ? 'Current position' : `Move to zone ${g.label}`}
                onClick={() => onMove(g.zones)}
              >
                {g.label}
                {occupant && <span className="pvz-pick-occupant-dot"
                  style={{ background: occupant.color }} />}
              </button>
            )
          })}
        </div>

        {/* Undo + history trail */}
        <div className="pvz-zone-history-row">
          {breadcrumb && (
            <span className="pvz-zone-breadcrumb">{breadcrumb}</span>
          )}
          {canUndo && (
            <button className="pvz-undo-btn" onClick={onUndo} title="Undo last move">
              ↩ Undo
            </button>
          )}
        </div>
      </div>

      {/* ── Planned exit room summary ── */}
      {hasDest && !editing && (
        <div className="pvz-transfer-row">
          <span className="pvz-transfer-arrow" style={{ color: batch.color }}>⇄</span>
          <span className="pvz-transfer-dest" style={{ color: batch.color }}>
            {destRoom?.name ?? batchState.destination}
          </span>
          {batchState.transferDate && (
            <span className="pvz-transfer-date">
              {new Date(batchState.transferDate).toLocaleDateString('en-CA', {
                month: 'short', day: 'numeric',
              })}
            </span>
          )}
          <button className="pvz-clear-btn" onClick={onClear} title="Clear exit plan">✕</button>
        </div>
      )}

      {/* ── Exit room edit form ── */}
      {editing && (
        <div className="pvz-edit-form">
          <select value={dest} onChange={e => setDest(e.target.value)}
            className="pvz-select" autoFocus>
            <option value="">— Select exit room —</option>
            {rooms
              .filter(r => r.id !== 'PREVEG' && r.interactive !== false && r.type !== 'utility')
              .map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="pvz-date-input" />
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)" className="pvz-notes-input" />
          <div className="pvz-form-actions">
            <button className="pvz-btn-cancel" onClick={handleCancel}>Cancel</button>
            <button className="pvz-btn-save"
              style={{ background: dest ? batch.color : undefined }}
              disabled={!dest} onClick={handleSave}>
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────
export default function PreVegZoneMap() {
  const rooms               = useFacilityStore(s => s.rooms)
  const prevegBatches       = useFacilityStore(s => s.prevegBatches)
  const setPrevegBatch      = useFacilityStore(s => s.setPrevegBatch)
  const clearPrevegBatch    = useFacilityStore(s => s.clearPrevegBatch)
  const movePrevegBatch     = useFacilityStore(s => s.movePrevegBatch)
  const undoPrevegBatchMove = useFacilityStore(s => s.undoPrevegBatchMove)

  // Flat history for SVG line rendering
  const histories = BATCHES.flatMap(b => {
    const hist = prevegBatches[b.id]?.zoneHistory ?? []
    return hist.map((h, i) => ({
      batchId:   b.id,
      color:     b.color,
      fromZones: h.fromZones,
      toZones:   h.toZones,
      isLatest:  i === hist.length - 1,
      age:       hist.length - 1 - i,
    }))
  })

  return (
    <section className="drawer-section pvz-section">
      <h3 className="section-title">ZONES</h3>

      <div className="pvz-map-wrap">
        <ZoneMapSvg batchStates={prevegBatches} histories={histories} />
      </div>

      <div className="pvz-batch-list">
        {BATCHES.map(batch => (
          <BatchCard
            key={batch.id}
            batch={batch}
            batchState={prevegBatches[batch.id]}
            allBatchStates={prevegBatches}
            rooms={rooms}
            onSet={data    => setPrevegBatch(batch.id, data)}
            onClear={()    => clearPrevegBatch(batch.id)}
            onMove={zones  => movePrevegBatch(batch.id, zones)}
            onUndo={()     => undoPrevegBatchMove(batch.id)}
          />
        ))}
      </div>
    </section>
  )
}
