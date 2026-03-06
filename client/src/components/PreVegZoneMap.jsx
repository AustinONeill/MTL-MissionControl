import { useState } from 'react'
import { useFacilityStore } from '../store/facilityStore'

// ── Batch definitions (colours + initial metadata) ─────────────────────────
const BATCHES = [
  { id: 'B78', label: 'Batch 7 – 8', initZones: [7, 8], color: '#4ade80', border: '#1a4d2a', bg: '#030e06', paired: true },
  { id: 'B56', label: 'Batch 5 – 6', initZones: [5, 6], color: '#60a5fa', border: '#1a3566', bg: '#03091c', paired: true },
  { id: 'B4',  label: 'Zone 4',      initZones: [4],    color: '#a78bfa', border: '#3a2d6a', bg: '#0c0916', paired: false },
  { id: 'B3',  label: 'Zone 3',      initZones: [3],    color: '#f59e0b', border: '#5a3a00', bg: '#150c00', paired: false },
]
// The four selectable zone groups within the room
const ZONE_GROUPS = [
  { id: 'back',   zones: [7, 8], label: '7 – 8' },
  { id: 'mid',    zones: [5, 6], label: '5 – 6' },
  { id: 'frontL', zones: [4],    label: '4' },
  { id: 'frontR', zones: [3],    label: '3' },
]

// Fixed physical cell positions — zone number → grid location
const ZONE_CELLS = [
  { num: 7, col: 0, row: 0 },
  { num: 8, col: 1, row: 0 },
  { num: 5, col: 0, row: 1 },
  { num: 6, col: 1, row: 1 },
  { num: 4, col: 0, row: 2 },
  { num: 3, col: 1, row: 2 },
]

// ── SVG constants ──────────────────────────────────────────────────────────
const CW = 92, CH = 54, GAPX = 6, GAPY = 7, PAD = 14
const SVG_W = 2 * CW + GAPX + PAD * 2
const SVG_H = 3 * CH + 2 * GAPY + PAD * 2 + 16

function cellPos(col, row) {
  return { x: PAD + col * (CW + GAPX), y: PAD + row * (CH + GAPY) }
}

function zonesCenter(zones) {
  const cells = ZONE_CELLS.filter(z => zones.includes(z.num))
  if (!cells.length) return { x: SVG_W / 2, y: SVG_H / 2 }
  const sumX = cells.reduce((s, z) => s + cellPos(z.col, z.row).x + CW / 2, 0)
  const sumY = cells.reduce((s, z) => s + cellPos(z.col, z.row).y + CH / 2, 0)
  return { x: sumX / cells.length, y: sumY / cells.length }
}

// ── SVG map ────────────────────────────────────────────────────────────────
function ZoneMapSvg({ batchStates, histories }) {
  // Build current zone → batch lookup from live state
  const zoneBatch = {}
  BATCHES.forEach(b => {
    const zones = batchStates[b.id]?.zones ?? b.initZones
    zones.forEach(z => { zoneBatch[z] = b })
  })

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: 'block' }}>
      <defs>
        {/* Arrow markers per batch colour */}
        {BATCHES.map(b => (
          <marker key={b.id} id={`pvz-arr-${b.id}`}
            markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <path d="M0,0 L5,2.5 L0,5 Z" fill={b.color} />
          </marker>
        ))}
      </defs>

      {/* Background */}
      <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#060d08" rx={5} />

      {/* Room walls */}
      <rect x={PAD - 4} y={PAD - 4}
        width={SVG_W - PAD * 2 + 8} height={3 * CH + 2 * GAPY + 8}
        fill="none" stroke="#1a2a1a" strokeWidth={1} rx={3} />

      {/* Transfer history lines — rendered below zone cells */}
      {histories.map((entry, i) => {
        const from = zonesCenter(entry.fromZones)
        const to   = zonesCenter(entry.toZones)
        const opacity = entry.isLatest ? 0.85 : Math.max(0.18, 0.55 - entry.age * 0.12)
        return (
          <line key={`${entry.batchId}-${i}`}
            x1={from.x} y1={from.y}
            x2={to.x}   y2={to.y}
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
          // Empty zone
          return (
            <g key={z.num}>
              <rect x={x} y={y} width={CW} height={CH} rx={4} fill="#060d08" stroke="#111" strokeWidth={1} />
              <text x={x + CW / 2} y={y + CH / 2 - 3} textAnchor="middle" dominantBaseline="middle"
                fontSize={24} fontWeight="900" fill="#1c1c1c" fontFamily="'JetBrains Mono', monospace">
                {z.num}
              </text>
              <text x={x + CW / 2} y={y + CH - 7} textAnchor="middle" fontSize={6.5} fontWeight="700"
                fill="#1c1c1c" fontFamily="'JetBrains Mono', monospace">
                ZONE
              </text>
            </g>
          )
        }

        const hasDest = !!batchStates[b.id]?.destination
        const currentZones = batchStates[b.id]?.zones ?? b.initZones
        const isPaired = b.paired && currentZones.length > 1

        return (
          <g key={z.num}>
            {/* Paired batch spanning background (only draw once from left cell) */}
            {isPaired && z.col === 0 && (
              <rect x={PAD - 4} y={y - 3}
                width={SVG_W - PAD * 2 + 8} height={CH + 6}
                rx={4} fill={b.bg}
                stroke={hasDest ? b.color : b.border}
                strokeWidth={hasDest ? 1.5 : 1}
              />
            )}

            {/* Solo zone background */}
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
                fill={b.color} opacity={hasDest ? 0.9 : 0.4}
              />
            )}

            {/* Zone number */}
            <text x={x + CW / 2} y={y + CH / 2 - 3}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={24} fontWeight="900"
              fill={b.color} opacity={hasDest ? 0.85 : 0.3}
              fontFamily="'JetBrains Mono', monospace">
              {z.num}
            </text>

            <text x={x + CW / 2} y={y + CH - 7}
              textAnchor="middle" fontSize={6.5} fontWeight="700"
              fill={b.color} opacity={hasDest ? 0.55 : 0.2}
              fontFamily="'JetBrains Mono', monospace">
              ZONE
            </text>

            {/* Exit arrow when external destination is set */}
            {hasDest && z.col === 1 && (
              <text x={x + CW - 7} y={y + 14}
                textAnchor="end" fontSize={9}
                fill={b.color} fontFamily="sans-serif">
                ⇄
              </text>
            )}
          </g>
        )
      })}

      <text x={SVG_W / 2} y={SVG_H - 3} textAnchor="middle"
        fontSize={7} fill="#1a3a1a" fontFamily="'JetBrains Mono', monospace">
        ▼ ENTRY
      </text>
      <text x={SVG_W / 2} y={8} textAnchor="middle"
        fontSize={6.5} fill="#1a2a1a" fontFamily="'JetBrains Mono', monospace">
        ▲ BACK
      </text>
    </svg>
  )
}

// ── Batch card ─────────────────────────────────────────────────────────────
function BatchCard({ batch, batchState, allBatchStates, rooms, onSet, onClear, onMove }) {
  const [editing, setEditing] = useState(false)
  const [dest, setDest]       = useState(batchState.destination ?? '')
  const [date, setDate]       = useState(batchState.transferDate ?? '')
  const [notes, setNotes]     = useState(batchState.notes ?? '')

  const destRoom  = rooms.find(r => r.id === dest)
  const hasDest   = !!batchState.destination
  const currentZones = batchState.zones ?? batch.initZones

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

  // Which batch (if any) currently occupies a zone group
  const occupantOf = (zones) => {
    const key = [...zones].sort().join()
    return BATCHES.find(b => {
      const bz = allBatchStates[b.id]?.zones ?? b.initZones
      return [...bz].sort().join() === key && b.id !== batch.id
    })
  }

  return (
    <div className="pvz-batch-card" style={{
      borderColor: hasDest ? batch.color : batch.border,
      background:  batch.bg,
    }}>
      {/* Header */}
      <div className="pvz-batch-header">
        <span className="pvz-batch-zones">
          {currentZones.map(z => (
            <span key={z} className="pvz-zone-pill" style={{ color: batch.color, borderColor: batch.border }}>
              {z}
            </span>
          ))}
        </span>
        <span className="pvz-batch-label" style={{ color: batch.color }}>{batch.label}</span>

        {!editing && (
          hasDest
            ? <button className="pvz-action-btn" onClick={() => setEditing(true)}>✏</button>
            : <button className="pvz-action-btn pvz-action-btn--plan" onClick={() => setEditing(true)}
                style={{ borderColor: batch.border, color: batch.color }}>
                Plan Exit
              </button>
        )}
      </div>

      {/* Zone picker — move within PreVeg */}
      <div className="pvz-zone-picker">
        <span className="pvz-zone-picker-label">POSITION</span>
        <div className="pvz-zone-pick-row">
          {ZONE_GROUPS.map(g => {
            const isCurrent = [...g.zones].sort().join() === [...currentZones].sort().join()
            const occupant  = !isCurrent ? occupantOf(g.zones) : null
            return (
              <button
                key={g.id}
                className={`pvz-zone-pick-btn ${isCurrent ? 'pvz-zone-pick-btn--current' : ''} ${occupant ? 'pvz-zone-pick-btn--occupied' : ''}`}
                style={isCurrent ? { borderColor: batch.color, color: batch.color, background: batch.bg } : {}}
                onClick={() => !isCurrent && onMove(g.zones)}
                disabled={isCurrent}
                title={occupant ? `Occupied by ${occupant.label}` : g.label}
              >
                {g.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Planned exit room */}
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
          <button className="pvz-clear-btn" onClick={onClear} title="Clear transfer">✕</button>
        </div>
      )}

      {/* Exit room editing form */}
      {editing && (
        <div className="pvz-edit-form">
          <select value={dest} onChange={e => setDest(e.target.value)} className="pvz-select" autoFocus>
            <option value="">— Select exit room —</option>
            {rooms
              .filter(r => r.id !== 'PREVEG' && r.interactive !== false && r.type !== 'utility')
              .map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="pvz-date-input" />
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" className="pvz-notes-input" />
          <div className="pvz-form-actions">
            <button className="pvz-btn-cancel" onClick={handleCancel}>Cancel</button>
            <button className="pvz-btn-save" style={{ background: dest ? batch.color : undefined }}
              onClick={handleSave} disabled={!dest}>
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main export ─────────────────────────────────────────────────────────────
export default function PreVegZoneMap() {
  const rooms            = useFacilityStore(s => s.rooms)
  const prevegBatches    = useFacilityStore(s => s.prevegBatches)
  const setPrevegBatch   = useFacilityStore(s => s.setPrevegBatch)
  const clearPrevegBatch = useFacilityStore(s => s.clearPrevegBatch)
  const movePrevegBatch  = useFacilityStore(s => s.movePrevegBatch)

  // Build flat history list for SVG line rendering
  const histories = BATCHES.flatMap(b => {
    const history = prevegBatches[b.id]?.zoneHistory ?? []
    return history.map((h, i) => ({
      batchId:   b.id,
      color:     b.color,
      fromZones: h.fromZones,
      toZones:   h.toZones,
      isLatest:  i === history.length - 1,
      age:       history.length - 1 - i,  // 0 = most recent
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
            onSet={data  => setPrevegBatch(batch.id, data)}
            onClear={()  => clearPrevegBatch(batch.id)}
            onMove={toZones => movePrevegBatch(batch.id, toZones)}
          />
        ))}
      </div>
    </section>
  )
}
