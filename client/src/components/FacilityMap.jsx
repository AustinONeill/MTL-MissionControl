import { useFacilityStore, STATUS } from '../store/facilityStore'
import RoomTile from './RoomTile'

// ─── Layout constants ────────────────────────────────────────────────
const GRID_PAD  = 32   // outer padding
const GAP       = 10   // gap between tiles
const F_W       = 120  // flower room width
const F_H       = 110  // flower room height
const V_W       = 110  // veg room width
const V_H       = 100  // veg room height
const S_W       = 110  // support room width
const S_H       = 90   // support room height

// Flower block: 4 columns × 4 rows
// ┌─────────────────────────────────┐
// │  F1  F2  F3  F4                │
// │  F5  F6  F7  F8                │
// │  F9  F10 F11 F12               │
// │  F13 F14 F15 F16               │
// ├──────────┬──────────────────────┤
// │VEG 1..4  │ Support rooms        │
// └──────────┴──────────────────────┘

const FLOWER_IDS = ['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16']
const VEG_IDS    = ['V1','V2','V3','V4']
const SUPPORT_IDS = ['MR','CLN','DRY','PROC','STG','OFC']

function buildLayout() {
  const items = []
  const totalFlowerW = 4 * F_W + 3 * GAP
  const flowerStartX = GRID_PAD
  const flowerStartY = GRID_PAD

  // Flower rooms – 4×4 grid
  FLOWER_IDS.forEach((id, i) => {
    const col = i % 4
    const row = Math.floor(i / 4)
    items.push({
      id,
      x: flowerStartX + col * (F_W + GAP),
      y: flowerStartY + row * (F_H + GAP),
      w: F_W,
      h: F_H,
    })
  })

  const lowerY = flowerStartY + 4 * (F_H + GAP) + GAP * 2

  // Veg rooms – 1×4 column on the left
  VEG_IDS.forEach((id, i) => {
    items.push({
      id,
      x: flowerStartX + i * (V_W + GAP),
      y: lowerY,
      w: V_W,
      h: V_H,
    })
  })

  // Support rooms – right of veg, 2×3 grid
  const supportStartX = flowerStartX + 4 * (V_W + GAP) + GAP * 2
  SUPPORT_IDS.forEach((id, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    items.push({
      id,
      x: supportStartX + col * (S_W + GAP),
      y: lowerY + row * (S_H + GAP),
      w: S_W,
      h: S_H,
    })
  })

  // Compute total SVG dimensions
  const allX2 = items.map(it => it.x + it.w)
  const allY2 = items.map(it => it.y + it.h)
  const svgW = Math.max(...allX2) + GRID_PAD
  const svgH = Math.max(...allY2) + GRID_PAD

  return { items, svgW, svgH }
}

const { items: LAYOUT, svgW: SVG_W, svgH: SVG_H } = buildLayout()

// Status → fill color following strict color rules
export const statusColor = (status) => {
  switch (status) {
    case STATUS.NORMAL: return { fill: '#1a3326', stroke: '#2d5c42', label: '#4ade80' }
    case STATUS.WARN:   return { fill: '#322b10', stroke: '#8a6c00', label: '#facc15' }
    case STATUS.ALERT:  return { fill: '#3b1212', stroke: '#8b2020', label: '#f87171' }
    case STATUS.IDLE:   return { fill: '#1a1a1f', stroke: '#2e2e38', label: '#6b7280' }
    default:            return { fill: '#1a1a1f', stroke: '#2e2e38', label: '#6b7280' }
  }
}

export default function FacilityMap() {
  const rooms = useFacilityStore(s => s.rooms)
  const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]))

  return (
    <div className="map-container">
      {/* Section labels */}
      <div className="map-section-labels">
        <span className="section-label">FLOWER BLOCK</span>
        <span className="section-label right">SUPPORT</span>
      </div>

      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        style={{ display: 'block', maxWidth: SVG_W }}
        aria-label="GardenOps Facility Map"
      >
        {/* Background grid lines for depth */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e1e28" strokeWidth="0.5" />
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width={SVG_W} height={SVG_H} fill="url(#grid)" />

        {/* Hallway connectors */}
        <rect
          x={GRID_PAD - 4}
          y={GRID_PAD - 4}
          width={4 * (F_W + GAP) - GAP + 8}
          height={4 * (F_H + GAP) - GAP + 8}
          rx={6}
          fill="none"
          stroke="#252530"
          strokeWidth={2}
          strokeDasharray="6 4"
        />

        {/* Room tiles */}
        {LAYOUT.map(({ id, x, y, w, h }) => {
          const room = roomMap[id]
          if (!room) return null
          return <RoomTile key={id} room={room} x={x} y={y} w={w} h={h} />
        })}

        {/* Section divider label: VEG */}
        <text
          x={GRID_PAD}
          y={GRID_PAD + 4 * (F_H + GAP) + GAP}
          fill="#3a3a50"
          fontSize={9}
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="600"
          letterSpacing="3"
        >
          VEG ROOMS
        </text>
      </svg>
    </div>
  )
}
