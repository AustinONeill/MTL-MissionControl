import { useMemo, useState, useCallback, useEffect } from 'react'
import { useFacilityStore, STATUS } from '../store/facilityStore'
import { DefoliationInfoModal } from './DefoliationModal'
import NetModal from './NetModal'
import QuickLogModal from './QuickLogModal'
import RoomModeBadge from './RoomModeBadge'
import ReEntryBadge from './ReEntryBadge'
import TransferLine from './TransferLine'

// ─── Isometric projection constants ────────────────────────────────────────────
const TW = 88   // tile width  (screen px per grid unit)
const TH = 44   // tile height = TW / 2
const TD = 22   // wall depth  = TH / 2

// ─── Flat 2D mode constants ─────────────────────────────────────────────────
const FLAT_S   = 36   // pixels per grid unit in flat top-down mode
const FLAT_PAD = 32

// Convert grid (gx, gy) → screen (sx, sy) relative to origin
const iso = (gx, gy) => ({
  x: (gx - gy) * TW / 2,
  y: (gx + gy) * TH / 2,
})

// Build a polygon points string from an array of {x,y}
const pts = (arr) => arr.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

// ─── Theme-aware map color palettes ─────────────────────────────────────────
const MAP_PALETTES = {
  'night-mode': {
    bg: '#080810', grid: '#111120', sectionLabel: '#2d5c3a', corrLabel: '#1a1a30',
    veg: {
      normal: { top: '#163a28', left: '#0e2b1d', right: '#0b2217', stroke: '#235e40', label: '#4ade80' },
      warn:   { top: '#1f2e10', left: '#162209', right: '#101a06', stroke: '#3a5818', label: '#86cf36' },
      alert:  { top: '#2d1010', left: '#220d0d', right: '#1a0a0a', stroke: '#6b2020', label: '#f87171' },
    },
    flower: {
      normal: { top: '#0e2e1e', left: '#092318', right: '#071b12', stroke: '#154d32', label: '#4ade80' },
      warn:   { top: '#2a2800', left: '#1e1d00', right: '#161500', stroke: '#6b6200', label: '#facc15' },
      alert:  { top: '#330f0f', left: '#260b0b', right: '#1d0909', stroke: '#7a1a1a', label: '#f87171' },
      idle:   { top: '#14141f', left: '#0e0e17', right: '#0b0b12', stroke: '#202030', label: '#4a4a68' },
    },
    wing:     { top: '#131320', left: '#0d0d1a', right: '#0a0a14', stroke: '#1e1e30', label: '#3a3a55' },
    corridor: { top: '#0f0f1a', left: '#0a0a14', right: '#080810', stroke: '#1a1a28', label: '#2a2a3a' },
    utility:  { top: '#181828', left: '#101020', right: '#0d0d18', stroke: '#252535', label: '#4a4a6a' },
    support:  { top: '#1a1f35', left: '#121628', right: '#0e1220', stroke: '#252d50', label: '#5a6490' },
  },
  'gas-n-up': {
    bg: '#080d08', grid: '#111a11', sectionLabel: '#3a5818', corrLabel: '#1a2212',
    veg: {
      normal: { top: '#132e10', left: '#0b2208', right: '#091a06', stroke: '#204d18', label: '#f97316' },
      warn:   { top: '#1f2e10', left: '#162209', right: '#101a06', stroke: '#3a5818', label: '#f97316' },
      alert:  { top: '#2d1520', left: '#22100a', right: '#1a0c14', stroke: '#6b2048', label: '#7b2cbf' },
    },
    flower: {
      normal: { top: '#0c280e', left: '#081e0a', right: '#061608', stroke: '#124418', label: '#f97316' },
      warn:   { top: '#2a2200', left: '#1e1800', right: '#161200', stroke: '#6b5400', label: '#f97316' },
      alert:  { top: '#30102a', left: '#240c20', right: '#1c0918', stroke: '#6b1a58', label: '#7b2cbf' },
      idle:   { top: '#12120e', left: '#0e0e0a', right: '#0b0b08', stroke: '#1e1e18', label: '#4a4a38' },
    },
    wing:     { top: '#0f130a', left: '#0a0e07', right: '#080c05', stroke: '#1a2212', label: '#2a380a' },
    corridor: { top: '#0d1209', left: '#090e06', right: '#070c04', stroke: '#181e10', label: '#222a10' },
    utility:  { top: '#151c0c', left: '#0e1308', right: '#0b1006', stroke: '#222e12', label: '#3a4818' },
    support:  { top: '#1c1428', left: '#14101e', right: '#100c18', stroke: '#2a1e40', label: '#7b2cbf' },
  },
  'frostd-flakes': {
    bg: '#edf7f0', grid: '#cce4d2', sectionLabel: '#2e7d32', corrLabel: '#4a7056',
    veg: {
      normal: { top: '#c8e6c9', left: '#a5d6a7', right: '#81c784', stroke: '#4caf50', label: '#1b5e20' },
      warn:   { top: '#fff9c4', left: '#fff59d', right: '#fff176', stroke: '#f9a825', label: '#e65100' },
      alert:  { top: '#ffcdd2', left: '#ef9a9a', right: '#e57373', stroke: '#c62828', label: '#b71c1c' },
    },
    flower: {
      normal: { top: '#dcedc8', left: '#c5e1a5', right: '#aed581', stroke: '#7cb342', label: '#1b5e20' },
      warn:   { top: '#fff9c4', left: '#fff59d', right: '#fff176', stroke: '#f9a825', label: '#e65100' },
      alert:  { top: '#ffcdd2', left: '#ef9a9a', right: '#e57373', stroke: '#c62828', label: '#b71c1c' },
      idle:   { top: '#f5f5f5', left: '#e0e0e0', right: '#bdbdbd', stroke: '#9e9e9e', label: '#616161' },
    },
    wing:     { top: '#e8f5e9', left: '#dcedc8', right: '#c8e6c9', stroke: '#a5d6a7', label: '#4a7056' },
    corridor: { top: '#f1f8e9', left: '#e8f5e9', right: '#dcedc8', stroke: '#aed581', label: '#5a7a46' },
    utility:  { top: '#e3f2fd', left: '#bbdefb', right: '#90caf9', stroke: '#42a5f5', label: '#1565c0' },
    support:  { top: '#e8eaf6', left: '#c5cae9', right: '#9fa8da', stroke: '#3f51b5', label: '#283593' },
  },
  'bright-mode': {
    bg: '#f7faf7', grid: '#d0e8d4', sectionLabel: '#2e7d32', corrLabel: '#4a7056',
    veg: {
      normal: { top: '#c8e6c9', left: '#a5d6a7', right: '#81c784', stroke: '#43a047', label: '#1b5e20' },
      warn:   { top: '#fff9c4', left: '#fff59d', right: '#fff176', stroke: '#f9a825', label: '#e65100' },
      alert:  { top: '#ffcdd2', left: '#ef9a9a', right: '#e57373', stroke: '#c62828', label: '#b71c1c' },
    },
    flower: {
      normal: { top: '#b2dfdb', left: '#80cbc4', right: '#4db6ac', stroke: '#00897b', label: '#004d40' },
      warn:   { top: '#fff9c4', left: '#fff59d', right: '#fff176', stroke: '#f9a825', label: '#e65100' },
      alert:  { top: '#ffcdd2', left: '#ef9a9a', right: '#e57373', stroke: '#c62828', label: '#b71c1c' },
      idle:   { top: '#f5f5f5', left: '#eeeeee', right: '#e0e0e0', stroke: '#9e9e9e', label: '#757575' },
    },
    wing:     { top: '#f5f5f5', left: '#eeeeee', right: '#e0e0e0', stroke: '#bdbdbd', label: '#9e9e9e' },
    corridor: { top: '#fafafa', left: '#f5f5f5', right: '#eeeeee', stroke: '#e0e0e0', label: '#bdbdbd' },
    utility:  { top: '#e3f2fd', left: '#bbdefb', right: '#90caf9', stroke: '#64b5f6', label: '#1976d2' },
    support:  { top: '#f3e5f5', left: '#e1bee7', right: '#ce93d8', stroke: '#ab47bc', label: '#4a148c' },
  },
}

// ─── Status → 3 face colors using active theme palette ──────────────────────
const faceColors = (type, status, theme = 'night-mode') => {
  const p = MAP_PALETTES[theme] || MAP_PALETTES['night-mode']
  if (type === 'wing')     return p.wing
  if (type === 'corridor') return p.corridor
  if (type === 'utility')  return p.utility
  if (type === 'support')  return p.support
  if (type === 'veg') {
    if (status === STATUS.WARN)  return p.veg.warn
    if (status === STATUS.ALERT) return p.veg.alert
    return p.veg.normal
  }
  // flower
  if (status === STATUS.WARN)  return p.flower.warn
  if (status === STATUS.ALERT) return p.flower.alert
  if (status === STATUS.IDLE)  return p.flower.idle
  return p.flower.normal
}

// ─── Symbol overlay definitions ─────────────────────────────────────────────
const SYMBOL_GLYPHS = {
  ipm:           '🐛',
  net:           '🕸',
  pot_check:     '🪴',
  filter_change: '🌬',
  defoliation:   '✂',
  transfer:      '⇄',
  harvest_ready: '◷',
  mode_change:   '⚙',
  supply_ready:  '◈',
  issue:         '⚠',
}

// ─── Accurate room layout derived from floor plan analysis ───────────────────
//
// Grid origin (0,0) = top-left corner of cultivation area
// x-axis: west→east  (left→right in plan)
// y-axis: north→south (top→bottom in plan)
//
// Scale: 1 grid unit ≈ width of one VEG room
// Large flower rooms are 2 units wide × 3.8 units deep (matches ~3× VEG depth)
//
// Column layout:
//   Col A  = x: 0.0 → 2.0  (VEG1/2 + F5/6/7/8/9)
//   Col B  = x: 2.4 → 4.4  (VEG3/4 + F10-14)
//   Col C1 = x: 4.8 → 6.0  (F15 + F17)
//   Col C2 = x: 6.0 → 7.2  (F16 + F18)
//   Processing wing = x: -4.5 → -0.2
//
// Row layout (north→south):
//   VEG strip:        y: 0.0 → 2.4
//   Upper flowers:    y: 2.5 → 8.8   (2 large rooms × 3.1 deep)
//   Horizontal corr:  y: 8.9 → 9.4
//   Utility strip:    y: 9.5 → 10.5
//   Lower flowers:    y: 10.6 → 20.5 (3 large rooms × 3.3 deep)
//   Bottom admin:     y: 21.0 → 22.5

const LAYOUT = [
  // ── Processing wing (non-interactive background block) ──────────────────────
  { id: '_WING',     name: 'PROCESSING',      type: 'wing',     col: -4.5, row: 0.0,  w: 4.0, h: 22.0, interactive: false },

  // ── VEG ROOMS ───────────────────────────────────────────────────────────────
  { id: 'VEG2',      name: 'VEG 2',           type: 'veg',      col: 0.0,  row: 0.0,  w: 2.0, h: 1.2,  interactive: true },
  { id: 'VEG1',      name: 'VEG 1',           type: 'veg',      col: 0.0,  row: 1.2,  w: 2.0, h: 1.2,  interactive: true },
  { id: 'VEG4',      name: 'VEG 4',           type: 'veg',      col: 2.4,  row: 0.0,  w: 2.0, h: 1.2,  interactive: true },
  { id: 'VEG3',      name: 'VEG 3',           type: 'veg',      col: 2.4,  row: 1.2,  w: 2.0, h: 1.2,  interactive: true },

  // ── Utility (top of right section — no rooms at top due to angled corner) ───
  { id: 'DRY5',      name: 'DRY 5',           type: 'utility',  col: 4.8,  row: 0.0,  w: 1.2, h: 0.7,  interactive: true },
  { id: 'DRY4',      name: 'DRY 4',           type: 'utility',  col: 4.8,  row: 0.7,  w: 1.2, h: 0.7,  interactive: true },
  { id: 'ELEC4',     name: 'ELEC 4',          type: 'utility',  col: 6.0,  row: 0.0,  w: 0.9, h: 1.0,  interactive: false },

  // ── UPPER FLOWER ROOMS ───────────────────────────────────────────────────────
  // Col A
  { id: 'F9',        name: 'F9',              type: 'flower',   col: 0.0,  row: 2.5,  w: 2.0, h: 3.1,  interactive: true },
  { id: 'F8',        name: 'F8',              type: 'flower',   col: 0.0,  row: 5.7,  w: 2.0, h: 3.1,  interactive: true },
  // Col B
  { id: 'F14',       name: 'F14',             type: 'flower',   col: 2.4,  row: 2.5,  w: 2.0, h: 3.1,  interactive: true },
  { id: 'F13',       name: 'F13',             type: 'flower',   col: 2.4,  row: 5.7,  w: 2.0, h: 3.1,  interactive: true },
  // Col C – right section (starts lower because of top-right angled wall)
  { id: 'F17',       name: 'F17',             type: 'flower',   col: 4.8,  row: 4.7,  w: 1.2, h: 3.1,  interactive: true },
  { id: 'F18',       name: 'F18',             type: 'flower',   col: 6.0,  row: 4.7,  w: 1.2, h: 3.1,  interactive: true },

  // ── HORIZONTAL CORRIDOR ──────────────────────────────────────────────────────
  { id: '_CORR_H',   name: 'CORRIDOR',        type: 'corridor', col: -4.5, row: 8.9,  w: 11.7, h: 0.6, interactive: false },

  // ── UTILITY STRIP (just below corridor) ──────────────────────────────────────
  { id: 'DRY1',      name: 'DRY 1',           type: 'utility',  col: 0.0,  row: 9.6,  w: 1.0, h: 1.0,  interactive: true },
  { id: 'ELEC2',     name: 'ELEC 2',          type: 'utility',  col: 1.0,  row: 9.6,  w: 1.0, h: 1.0,  interactive: false },
  { id: 'DRY2',      name: 'DRY 2',           type: 'utility',  col: 2.4,  row: 9.6,  w: 1.2, h: 1.0,  interactive: true },
  { id: 'ELEC3',     name: 'ELEC 3',          type: 'utility',  col: 3.6,  row: 9.6,  w: 0.8, h: 1.0,  interactive: false },

  // ── LOWER FLOWER ROOMS ────────────────────────────────────────────────────────
  // Col A
  { id: 'F7',        name: 'F7',              type: 'flower',   col: 0.0,  row: 10.7, w: 2.0, h: 3.3,  interactive: true },
  { id: 'F6',        name: 'F6',              type: 'flower',   col: 0.0,  row: 14.1, w: 2.0, h: 3.3,  interactive: true },
  { id: 'F5',        name: 'F5',              type: 'flower',   col: 0.0,  row: 17.5, w: 2.0, h: 3.3,  interactive: true },
  // Col B
  { id: 'F12',       name: 'F12',             type: 'flower',   col: 2.4,  row: 10.7, w: 2.0, h: 3.3,  interactive: true },
  { id: 'F11',       name: 'F11',             type: 'flower',   col: 2.4,  row: 14.1, w: 2.0, h: 3.3,  interactive: true },
  { id: 'F10',       name: 'F10',             type: 'flower',   col: 2.4,  row: 17.5, w: 2.0, h: 3.3,  interactive: true },
  // Col C
  { id: 'F15',       name: 'F15',             type: 'flower',   col: 4.8,  row: 10.7, w: 1.2, h: 3.3,  interactive: true },
  { id: 'F16',       name: 'F16',             type: 'flower',   col: 6.0,  row: 10.7, w: 1.2, h: 3.3,  interactive: true },

  // ── RIGHT SECTION BOTTOM UTILITIES ────────────────────────────────────────────
  { id: 'DRY3',      name: 'DRY 3',           type: 'utility',  col: 4.8,  row: 14.1, w: 1.2, h: 1.0,  interactive: true },
  { id: '_DEST',     name: 'DEST/GARB',       type: 'utility',  col: 6.0,  row: 14.1, w: 1.2, h: 1.0,  interactive: false },
  { id: '_FERTIG_R', name: 'FERTIGATION',     type: 'utility',  col: 4.8,  row: 15.2, w: 1.2, h: 1.0,  interactive: false },
  { id: 'LIVCLONE',  name: 'LIVING & CLONING',type: 'support',  col: 4.8,  row: 16.3, w: 2.4, h: 1.8,  interactive: true },

  // ── BOTTOM SUPPORT STRIP ──────────────────────────────────────────────────────
  { id: 'PREVEG',    name: 'PRE-VEG',         type: 'support',  col: 0.0,  row: 21.0, w: 2.0, h: 1.4,  interactive: true },
  { id: 'PLANTING',  name: 'PLANTING',        type: 'support',  col: 2.4,  row: 21.0, w: 2.0, h: 1.4,  interactive: true },
  { id: '_SAS',      name: 'SAS',             type: 'support',  col: 4.8,  row: 21.0, w: 1.2, h: 1.4,  interactive: false },
  { id: '_ADMIN',    name: 'ADMIN / OFFICE',  type: 'wing',     col: 6.0,  row: 21.0, w: 1.2, h: 1.4,  interactive: false },
]

// ─── Single isometric box tile ───────────────────────────────────────────────
function IsoBox({ room, ox, oy, colors, onClick, isSelected, isHovered, onHover, onDefolClick, onNetClick,
                  isDragOver, onDragEnter, onDragLeave, onDrop, isPendingOrigin, isTransferDest, selectedFlagId, taskCount }) {
  const { col, row, w, h } = room
  const s = (gx, gy) => ({ x: ox + iso(gx, gy).x, y: oy + iso(gx, gy).y })

  // 4 corners of the top face
  const TL = s(col,     row)
  const TR = s(col + w, row)
  const BR = s(col + w, row + h)
  const BL = s(col,     row + h)

  // South-facing wall (front-left in iso view)
  const wallL = [BL, BR,
    { x: BR.x, y: BR.y + TD },
    { x: BL.x, y: BL.y + TD }]

  // East-facing wall (front-right in iso view)
  const wallR = [TR, BR,
    { x: BR.x, y: BR.y + TD },
    { x: TR.x, y: TR.y + TD }]

  const handleEnter = () => onHover && onHover(room.id)
  const handleLeave = () => onHover && onHover(null)

  const handleDragOver = (e) => {
    if (!room.interactive) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    onDragEnter?.(room.id)
  }
  const handleDragLeave = (e) => {
    // relatedTarget is the element being entered; if it's still inside the
    // same polygon (or is the polygon itself) do nothing to avoid flicker.
    const related = e.relatedTarget
    if (related && e.currentTarget === related) return
    onDragLeave?.()
  }
  const handleDrop = (e) => {
    if (!room.interactive) return
    e.preventDefault()
    e.stopPropagation()
    const key = e.dataTransfer.getData('application/gardenops-symbol')
              || e.dataTransfer.getData('text/plain')
    if (key) onDrop?.(room.id, key)
  }

  // Center of top face for label
  const cx = (TL.x + TR.x + BR.x + BL.x) / 4
  const cy = (TL.y + TR.y + BR.y + BL.y) / 4

  // Symbol strip — positioned near the south edge of the top face
  const symbols = (room.symbols || []).slice(0, 4)
  const symY = (BL.y + BR.y) / 2 - 6
  const symStartX = (BL.x + BR.x) / 2 - (symbols.length * 10) / 2

  return (
      <g
      role={room.interactive ? 'button' : undefined}
      tabIndex={room.interactive ? 0 : undefined}
      aria-label={room.interactive ? `${room.name} – click to open` : undefined}
      onClick={room.interactive ? onClick : undefined}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{ cursor: room.interactive ? 'pointer' : 'default', outline: 'none' }}
    >
      {/* Selection / hover glow */}
      {/* Selection / hover outline — traces the full tile silhouette (same
          shape as the drop hit-zone) with a stroke rather than a fill blob */}
      {(isSelected || isHovered) && (() => {
        // Expand slightly outward so the stroke sits just outside the tile
        const E = isSelected ? 2 : 1
        const outline = [
          { x: TL.x - E,       y: TL.y - E       },
          { x: TR.x + E,       y: TR.y - E       },
          { x: TR.x + E,       y: TR.y + TD + E  },
          { x: BR.x + E,       y: BR.y + TD + E  },
          { x: BL.x - E,       y: BL.y + TD + E  },
          { x: BL.x - E,       y: BL.y - E       },
        ]
        return (
          <>
            {/* Outer glow — wide soft halo (no filter: SVG filters clip to a
                rect bounding box and would render as a yellow rectangle) */}
            <polygon
              points={pts(outline)}
              fill="none"
              stroke={colors.label}
              strokeWidth={isSelected ? 8 : 4}
              strokeOpacity={isSelected ? 0.18 : 0.08}
              strokeLinejoin="round"
              style={{ pointerEvents: 'none' }}
            />
            {/* Inner crisp edge */}
            <polygon
              points={pts(outline)}
              fill={colors.label}
              fillOpacity={isSelected ? 0.06 : 0.02}
              stroke={colors.label}
              strokeWidth={isSelected ? 1.5 : 0.75}
              strokeOpacity={isSelected ? 0.85 : 0.35}
              style={{ pointerEvents: 'none' }}
            />
          </>
        )
      })()}

      {/* East wall (right face, darkest) */}
      <polygon points={pts(wallR)} fill={colors.right} stroke={colors.stroke} strokeWidth={0.5} />

      {/* South wall (left face, medium) */}
      <polygon points={pts(wallL)} fill={colors.left} stroke={colors.stroke} strokeWidth={0.5} />

      {/* Top face (lightest) */}
      <polygon points={pts([TL, TR, BR, BL])} fill={colors.top} stroke={colors.stroke} strokeWidth={0.8} />

      {/* Drag-over drop target highlight — full silhouette, blue dashed */}
      {isDragOver && room.interactive && (
        <polygon
          points={pts([
            TL,
            TR,
            { x: TR.x, y: TR.y + TD },
            { x: BR.x, y: BR.y + TD },
            { x: BL.x, y: BL.y + TD },
            BL,
          ])}
          fill="#60a5fa"
          fillOpacity={0.12}
          stroke="#60a5fa"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Alert pulse ring on top face */}
      {room.status === STATUS.ALERT && room.interactive && (
        <polygon points={pts([TL, TR, BR, BL])} fill="none" stroke={colors.label} strokeWidth={1.5} opacity={0.5}>
          <animate attributeName="opacity" values="0.15;0.7;0.15" dur="1.8s" repeatCount="indefinite" />
        </polygon>
      )}

      {/* Pending transfer origin — amber flash */}
      {isPendingOrigin && (
        <>
          <polygon points={pts([TL, TR, BR, BL])} fill="#f59e0b" fillOpacity={0.12}>
            <animate attributeName="fill-opacity" values="0.06;0.22;0.06" dur="0.9s" repeatCount="indefinite" />
          </polygon>
          <polygon points={pts([TL, TR, BR, BL])} fill="none" stroke="#f59e0b" strokeWidth={2}>
            <animate attributeName="stroke-opacity" values="0.4;1;0.4" dur="0.9s" repeatCount="indefinite" />
          </polygon>
        </>
      )}

      {/* Transfer destination highlight — when a pending origin exists */}
      {isTransferDest && room.interactive && (
        <polygon points={pts([TL, TR, BR, BL])} fill="#f59e0b" fillOpacity={0.06}
          stroke="#f59e0b" strokeWidth={1} strokeDasharray="5 3" strokeOpacity={0.5} />
      )}

      {/* Tap-to-assign ring — amber dashed ring when a flag is selected */}
      {selectedFlagId && selectedFlagId !== 'transfer' && room.interactive && (
        <polygon
          className="iso-flag-ready-ring"
          points={pts([TL, TR, BR, BL])}
        />
      )}

      {/* Room name label */}
      {room.interactive && (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={colors.label}
          fontSize={room.type === 'flower' ? 8.5 : 7.5}
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="700"
          letterSpacing="0.5"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {room.name}
        </text>
      )}

      {/* Mode badge — top-left of top face */}
      {room.interactive && room.mode && (
        <RoomModeBadge
          mode={room.mode}
          x={TL.x + (TR.x - TL.x) * 0.05}
          y={TL.y + (BL.y - TL.y) * 0.08 - 9}
        />
      )}

      {/* Re-entry countdown badge — below mode badge */}
      {room.interactive && room.reEntryExpiresAt && (
        <ReEntryBadge
          roomId={room.id}
          reEntryExpiresAt={room.reEntryExpiresAt}
          x={TL.x + (TR.x - TL.x) * 0.05}
          y={TL.y + (BL.y - TL.y) * 0.08 + 10}
        />
      )}

      {/* Non-interactive wing label */}
      {!room.interactive && room.id === '_WING' && (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#22223a"
          fontSize={7}
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="600"
          letterSpacing="2"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          PROCESSING WING
        </text>
      )}

      {/* Status indicator dot */}
      {room.interactive && (
        <circle
          cx={TL.x + (TR.x - TL.x) * 0.2}
          cy={TL.y + (TR.y - TL.y) * 0.2 + (BL.y - TL.y) * 0.2}
          r={3}
          fill={colors.label}
          opacity={0.9}
        >
          {room.status === STATUS.ALERT && (
            <animate attributeName="r" values="2;4;2" dur="1.5s" repeatCount="indefinite" />
          )}
        </circle>
      )}

      {/* Transparent hit-area polygon — covers the full tile silhouette so
          drag events fire anywhere over the tile, not just over visible pixels.
          Drag handlers live here rather than on the parent <g> because browsers
          don't reliably bubble drag events through SVG group elements. */}
      <polygon
        points={pts([
          TL,
          TR,
          { x: TR.x, y: TR.y + TD },
          { x: BR.x, y: BR.y + TD },
          { x: BL.x, y: BL.y + TD },
          BL,
        ])}
        fill="transparent"
        stroke="none"
        style={{ pointerEvents: room.interactive ? 'all' : 'none' }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />

      {/* Task count badge — top-right of top face */}
      {room.interactive && taskCount > 0 && (
        <g style={{ pointerEvents: 'none' }}>
          <text
            x={TR.x - (TR.x - TL.x) * 0.08}
            y={TR.y + (BR.y - TR.y) * 0.12}
            textAnchor="end"
            dominantBaseline="middle"
            fill="#fbbf24"
            fontSize={6.5}
            fontFamily="'JetBrains Mono', monospace"
            fontWeight="700"
            opacity={0.9}
            style={{ userSelect: 'none' }}
          >
            📋{taskCount}
          </text>
        </g>
      )}

      {/* Symbol overlay on top face */}
      {symbols.length > 0 && (
        <g>
          {symbols.map((sym, i) => {
            const isScissors = sym === 'defoliation'
            const isNet      = sym === 'net'
            const isClickable = isScissors || isNet
            return (
              <text
                key={sym}
                x={symStartX + i * 11}
                y={symY}
                fontSize={isScissors ? 9 : 8}
                fontFamily="'Segoe UI Emoji', 'Apple Color Emoji', sans-serif"
                opacity={0.9}
                style={{
                  pointerEvents: isClickable ? 'all' : 'none',
                  cursor: isClickable ? 'pointer' : 'default',
                  userSelect: 'none',
                }}
                onClick={
                  isScissors ? (e) => { e.stopPropagation(); onDefolClick?.() }
                  : isNet    ? (e) => { e.stopPropagation(); onNetClick?.() }
                  : undefined
                }
              >
                {SYMBOL_GLYPHS[sym] || '?'}
              </text>
            )
          })}
        </g>
      )}
    </g>
  )
}

// ─── Flat 2D tile renderer ───────────────────────────────────────────────────
function FlatBox({ room, flatOx, flatOy, colors, onClick, isSelected, isHovered, onHover,
                   isDragOver, onDragEnter, onDragLeave, onDrop, selectedFlagId, taskCount }) {
  const x  = flatOx + room.col * FLAT_S
  const y  = flatOy + room.row * FLAT_S
  const rw = room.w  * FLAT_S
  const rh = room.h  * FLAT_S
  const cx = x + rw / 2
  const cy = y + rh / 2
  const symbols = (room.symbols || []).slice(0, 4)

  const handleDragOver  = (e) => { if (!room.interactive) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; onDragEnter?.(room.id) }
  const handleDragLeave = ()  => onDragLeave?.()
  const handleDrop      = (e) => {
    if (!room.interactive) return
    e.preventDefault(); e.stopPropagation()
    const key = e.dataTransfer.getData('application/gardenops-symbol') || e.dataTransfer.getData('text/plain')
    if (key) onDrop?.(room.id, key)
  }

  return (
    <g
      role={room.interactive ? 'button' : undefined}
      tabIndex={room.interactive ? 0 : undefined}
      aria-label={room.interactive ? `${room.name} – click to open` : undefined}
      onClick={room.interactive ? onClick : undefined}
      onMouseEnter={() => onHover?.(room.id)}
      onMouseLeave={() => onHover?.(null)}
      style={{ cursor: room.interactive ? 'pointer' : 'default', outline: 'none' }}
    >
      <rect x={x} y={y} width={rw} height={rh} fill={colors.top} stroke={colors.stroke} strokeWidth={0.8} rx={1} />

      {(isSelected || isHovered) && (
        <rect x={x - 1} y={y - 1} width={rw + 2} height={rh + 2}
          fill={colors.label} fillOpacity={isSelected ? 0.08 : 0.03}
          stroke={colors.label} strokeWidth={isSelected ? 1.5 : 0.75}
          strokeOpacity={isSelected ? 0.9 : 0.4} rx={1}
          style={{ pointerEvents: 'none' }} />
      )}
      {isDragOver && room.interactive && (
        <rect x={x} y={y} width={rw} height={rh}
          fill="#60a5fa" fillOpacity={0.15} stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="5 3" rx={1}
          style={{ pointerEvents: 'none' }} />
      )}
      {selectedFlagId && selectedFlagId !== 'transfer' && room.interactive && (
        <rect x={x} y={y} width={rw} height={rh}
          fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" rx={1}
          style={{ pointerEvents: 'none' }} />
      )}

      {room.interactive && (
        <text x={cx} y={cy - (symbols.length > 0 ? 5 : 0)}
          textAnchor="middle" dominantBaseline="middle"
          fill={colors.label} fontSize={room.type === 'flower' ? 7.5 : 6.5}
          fontFamily="'JetBrains Mono', monospace" fontWeight="700" letterSpacing="0.5"
          style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {room.name}
        </text>
      )}
      {symbols.length > 0 && (
        <text x={cx} y={cy + (room.interactive ? 7 : 0)}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={7} fontFamily="'Segoe UI Emoji', 'Apple Color Emoji', sans-serif"
          style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {symbols.map(s => SYMBOL_GLYPHS[s] || '?').join(' ')}
        </text>
      )}
      {taskCount > 0 && (
        <text x={x + rw - 2} y={y + 7} textAnchor="end" dominantBaseline="middle"
          fill="#fbbf24" fontSize={6} fontFamily="'JetBrains Mono', monospace"
          fontWeight="700" opacity={0.9} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          📋{taskCount}
        </text>
      )}

      {/* Transparent drag hit area */}
      <rect x={x} y={y} width={rw} height={rh} fill="transparent" stroke="none"
        style={{ pointerEvents: room.interactive ? 'all' : 'none' }}
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} />
    </g>
  )
}

// ─── Hook: reactive map theme (watches data-theme on <html>) ─────────────────
function useMapTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'night-mode')
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.dataset.theme || 'night-mode')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return theme
}

// ─── Hook: 2D/3D view mode (localStorage + custom event bus) ─────────────────
function useMapViewMode() {
  const [mode, setMode] = useState(() => localStorage.getItem('mapViewPreference') || '2D')
  useEffect(() => {
    const handler = (e) => setMode(e.detail?.mode || '2D')
    window.addEventListener('mapViewChange', handler)
    return () => window.removeEventListener('mapViewChange', handler)
  }, [])
  return mode
}

// ─── Main isometric map component ───────────────────────────────────────────
export default function IsometricMap() {
  const mapTheme   = useMapTheme()
  const viewMode   = useMapViewMode()
  const mapPalette = MAP_PALETTES[mapTheme] || MAP_PALETTES['night-mode']
  const isFlat     = viewMode === '2D'

  const rooms                = useFacilityStore(s => s.rooms)
  const tasks                = useFacilityStore(s => s.tasks)
  const selectRoom           = useFacilityStore(s => s.selectRoom)
  const selectedId           = useFacilityStore(s => s.selectedRoomId)
  const openDefolInfo        = useFacilityStore(s => s.openDefolInfo)
  const openNetLog           = useFacilityStore(s => s.openNetLog)
  const closeNetLog          = useFacilityStore(s => s.closeNetLog)
  const netLogRoomId         = useFacilityStore(s => s.netLogRoomId)
  const connectRoomWs        = useFacilityStore(s => s.connectRoomWs)
  const selectedFlagId       = useFacilityStore(s => s.selectedFlagId)
  const clearSelectedFlag    = useFacilityStore(s => s.clearSelectedFlag)
  const addSymbolToRoom      = useFacilityStore(s => s.addSymbolToRoom)
  const apiStatus            = useFacilityStore(s => s.apiStatus)
  const transfers            = useFacilityStore(s => s.transfers)
  const pendingTransferOrigin = useFacilityStore(s => s.pendingTransferOrigin)
  const startTransfer        = useFacilityStore(s => s.startTransfer)
  const completeTransfer     = useFacilityStore(s => s.completeTransfer)
  const cancelTransfer       = useFacilityStore(s => s.cancelTransfer)

  // Escape cancels a pending transfer
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') cancelTransfer() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancelTransfer])

  useEffect(() => {
    if (apiStatus === 'online') {
      rooms.filter(r => r.id && !r.id.startsWith('_')).forEach(r => connectRoomWs(r.id))
    }
  }, [apiStatus, rooms, connectRoomWs])

  // Hover state
  const [hoveredId, setHoveredId] = useState(null)

  // Drag-and-drop state
  const [dragOverId,  setDragOverId]  = useState(null)
  const [pendingDrop, setPendingDrop] = useState(null)  // { roomId, symbolKey }

  const handleDrop = useCallback((roomId, symbolKey) => {
    setDragOverId(null)
    if (symbolKey === 'transfer') {
      if (!pendingTransferOrigin) {
        startTransfer(roomId)
      } else if (pendingTransferOrigin !== roomId) {
        completeTransfer(roomId)
      }
      return
    }
    setPendingDrop({ roomId, symbolKey })
  }, [pendingTransferOrigin, startTransfer, completeTransfer])

  const handleDragEnter = useCallback((roomId) => setDragOverId(roomId), [])
  const handleDragLeave = useCallback(() => setDragOverId(null), [])

  // Merge layout geometry with live room state
  const tiles = useMemo(() => {
    const storeMap = Object.fromEntries(rooms.map(r => [r.id, r]))
    return LAYOUT.map(tile => ({
      ...tile,
      ...(storeMap[tile.id] || {}),
      // keep geometry from LAYOUT
      col: tile.col, row: tile.row, w: tile.w, h: tile.h,
      interactive: tile.interactive,
      type: tile.type,
    }))
  }, [rooms])

  // Compute bounding box for the svg viewBox
  const { minX, minY, maxX, maxY } = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    LAYOUT.forEach(({ col, row, w, h }) => {
      const corners = [
        iso(col,     row),
        iso(col + w, row),
        iso(col + w, row + h),
        iso(col,     row + h),
      ]
      corners.forEach(c => {
        if (c.x < minX) minX = c.x
        if (c.x > maxX) maxX = c.x
        if (c.y < minY) minY = c.y
        if (c.y > maxY) maxY = c.y
      })
    })
    return { minX, minY, maxX, maxY: maxY + TD }
  }, [])

  const PAD = 40
  const ox = -minX + PAD   // screen origin offset
  const oy = -minY + PAD
  const svgW = maxX - minX + PAD * 2
  const svgH = maxY - minY + TD + PAD * 2

  // Flat 2D mode bounds — derived from LAYOUT statically
  const { flatMinCol, flatMaxCol, flatMaxRow } = useMemo(() => {
    return LAYOUT.reduce((b, r) => ({
      flatMinCol: Math.min(b.flatMinCol, r.col),
      flatMaxCol: Math.max(b.flatMaxCol, r.col + r.w),
      flatMaxRow: Math.max(b.flatMaxRow, r.row + r.h),
    }), { flatMinCol: Infinity, flatMaxCol: -Infinity, flatMaxRow: -Infinity })
  }, [])
  const flatOx    = -flatMinCol * FLAT_S + FLAT_PAD
  const flatOy    = FLAT_PAD
  const flatSvgW  = (flatMaxCol - flatMinCol) * FLAT_S + FLAT_PAD * 2
  const flatSvgH  = flatMaxRow * FLAT_S + FLAT_PAD * 2

  const activeSvgW = isFlat ? flatSvgW : svgW
  const activeSvgH = isFlat ? flatSvgH : svgH

  // Sort tiles for painter's algorithm (back-to-front)
  const sortedTiles = useMemo(() =>
    [...tiles].sort((a, b) => (a.col + a.row) - (b.col + b.row)),
    [tiles]
  )

  return (
    <div className="iso-container">
      {apiStatus === 'offline' && (
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          background: '#3a1a00', color: '#ffb060', border: '1px solid #ff8c00',
          borderRadius: 4, padding: '4px 12px', fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace", zIndex: 10, whiteSpace: 'nowrap',
        }}>
          OFFLINE — changes will sync on reconnect
        </div>
      )}

      {pendingTransferOrigin && (
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          background: '#3a2800', color: '#f59e0b', border: '1px solid #f59e0b',
          borderRadius: 4, padding: '5px 14px', fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace", zIndex: 10, whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ animation: 'blink 0.9s step-end infinite' }}>⇄</span>
          SELECT DESTINATION ROOM — ESC to cancel
        </div>
      )}
      <svg
        viewBox={`0 0 ${activeSvgW} ${activeSvgH}`}
        width={activeSvgW}
        height={activeSvgH}
        style={{ display: 'block', maxWidth: '100%' }}
        aria-label="GardenOps Facility Map"
      >
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Fine grid pattern for iso floor */}
          <pattern id="isofloor" x="0" y="0" width={TW} height={TH} patternUnits="userSpaceOnUse">
            <path d={`M 0 ${TH/2} L ${TW/2} 0 L ${TW} ${TH/2} L ${TW/2} ${TH} Z`}
              fill="none" stroke={mapPalette.grid} strokeWidth="0.4" />
          </pattern>

          {/* Fine grid pattern for flat floor */}
          <pattern id="flatgrid" x="0" y="0" width={FLAT_S} height={FLAT_S} patternUnits="userSpaceOnUse">
            <rect width={FLAT_S} height={FLAT_S} fill="none" stroke={mapPalette.grid} strokeWidth="0.5" />
          </pattern>
        </defs>

        {/* Full map background */}
        <rect x={0} y={0} width={activeSvgW} height={activeSvgH} fill={mapPalette.bg} />

        {/* Background grid overlay */}
        {!isFlat && <rect x={0} y={0} width={activeSvgW} height={activeSvgH} fill="url(#isofloor)" opacity={0.3} />}
        {isFlat  && <rect x={0} y={0} width={activeSvgW} height={activeSvgH} fill="url(#flatgrid)" opacity={0.4} />}

        {/* Section labels (iso mode only) */}
        {!isFlat && <SectionLabels ox={ox} oy={oy} palette={mapPalette} />}

        {/* Render all tiles sorted back-to-front */}
        {sortedTiles.map(tile => {
          const fc = faceColors(tile.type, tile.status, mapTheme)
          const hasDefol = tile.symbols?.includes('defoliation')
          const hasNet   = tile.symbols?.includes('net')
          const isPendingOrigin = pendingTransferOrigin === tile.id
          const taskCount = tasks.filter(t => t.roomId === tile.id && t.status !== 'done').length
          const isTransferDest = !!pendingTransferOrigin
            && pendingTransferOrigin !== tile.id
            && tile.interactive
          const tileColors = { top: fc.top, left: fc.left, right: fc.right, stroke: fc.stroke, label: fc.label }
          const tileClick = !tile.interactive ? undefined : () => {
            if (pendingTransferOrigin && pendingTransferOrigin !== tile.id) { completeTransfer(tile.id); return }
            if (selectedFlagId === 'transfer') { startTransfer(tile.id); clearSelectedFlag(); return }
            if (selectedFlagId) { addSymbolToRoom(tile.id, selectedFlagId, selectedFlagId); clearSelectedFlag(); return }
            selectRoom(tile.id)
          }
          const sharedProps = {
            key: tile.id,
            room: tile,
            colors: tileColors,
            onClick: tileClick,
            isSelected: selectedId === tile.id,
            isHovered: hoveredId === tile.id,
            isDragOver: dragOverId === tile.id || (!!(selectedFlagId && selectedFlagId !== 'transfer') && hoveredId === tile.id),
            isPendingOrigin,
            isTransferDest,
            selectedFlagId,
            onHover: setHoveredId,
            onDragEnter: handleDragEnter,
            onDragLeave: handleDragLeave,
            onDrop: handleDrop,
            taskCount,
          }

          return isFlat
            ? <FlatBox {...sharedProps} flatOx={flatOx} flatOy={flatOy} />
            : <IsoBox  {...sharedProps} ox={ox} oy={oy}
                onDefolClick={hasDefol ? () => openDefolInfo(tile.id) : undefined}
                onNetClick={hasNet ? () => openNetLog(tile.id) : undefined} />
        })}

        {/* Transfer connecting lines — rendered above all tiles */}
        {Object.entries(transfers).map(([originId, t]) => {
          if (!t.destinationId) return null
          const originTile = LAYOUT.find(l => l.id === originId)
          const destTile   = LAYOUT.find(l => l.id === t.destinationId)
          if (!originTile || !destTile) return null

          const tileCenter = ({ col, row, w, h }) => ({
            x: ox + (iso(col, row).x + iso(col + w, row).x + iso(col + w, row + h).x + iso(col, row + h).x) / 4,
            y: oy + (iso(col, row).y + iso(col + w, row).y + iso(col + w, row + h).y + iso(col, row + h).y) / 4,
          })

          const from = tileCenter(originTile)
          const to   = tileCenter(destTile)

          return (
            <TransferLine
              key={originId}
              x1={from.x} y1={from.y}
              x2={to.x}   y2={to.y}
              label={t.transferType ?? 'Transfer'}
            />
          )
        })}

        {/* Corridor Production label (iso only) */}
        {!isFlat && <CorridorLabel ox={ox} oy={oy} palette={mapPalette} />}
      </svg>

      {/* Defoliation quick-view modal (scissors click) */}
      <DefoliationInfoModal />

      {/* Net log modal (net glyph click on map tile) */}
      {netLogRoomId && (
        <NetModal
          roomId={netLogRoomId}
          onClose={closeNetLog}
          onSaved={closeNetLog}
        />
      )}

      {/* Flag drop modal — fires when symbol dragged onto a room tile */}
      {pendingDrop && (
        <QuickLogModal
          roomId={pendingDrop.roomId}
          symbolKey={pendingDrop.symbolKey}
          onClose={() => setPendingDrop(null)}
        />
      )}
    </div>
  )
}

// ── Corridor label overlaid on the corridor tile ────────────────────────────
function CorridorLabel({ ox, oy, palette }) {
  const corrTile = LAYOUT.find(t => t.id === '_CORR_H')
  if (!corrTile) return null
  const { col, row, w, h } = corrTile
  const cx = ox + (iso(col, row).x + iso(col + w, row).x + iso(col + w, row + h).x + iso(col, row + h).x) / 4
  const cy = oy + (iso(col, row).y + iso(col + w, row).y + iso(col + w, row + h).y + iso(col, row + h).y) / 4
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
      fill={palette?.corrLabel ?? '#1a1a30'} fontSize={7} fontFamily="'JetBrains Mono', monospace"
      fontWeight="600" letterSpacing="3" style={{ userSelect: 'none' }}>
      CORRIDOR PRODUCTION
    </text>
  )
}

// ── Section labels floating above the map ────────────────────────────────────
function SectionLabels({ ox, oy, palette }) {
  const vegCenter = useMemo(() => {
    const vegTiles = LAYOUT.filter(t => t.type === 'veg')
    let sx = 0, sy = 0
    vegTiles.forEach(({ col, row, w, h }) => {
      sx += ox + iso(col + w / 2, row + h / 2).x
      sy += oy + iso(col + w / 2, row + h / 2).y
    })
    return { x: sx / vegTiles.length, y: sy / vegTiles.length - 24 }
  }, [ox, oy])

  const flowerCenterX = useMemo(() => {
    const flower = LAYOUT.filter(t => t.type === 'flower' && t.id === 'F9')[0]
    return flower ? ox + iso(flower.col + flower.w / 2, flower.row).x : 0
  }, [ox])
  const flowerY = useMemo(() => {
    const flower = LAYOUT.filter(t => t.type === 'flower' && t.id === 'F9')[0]
    return flower ? oy + iso(flower.col + flower.w / 2, flower.row).y - 20 : 0
  }, [oy])

  const labelColor = palette?.sectionLabel ?? '#2d5c3a'

  return (
    <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <text x={vegCenter.x} y={vegCenter.y} textAnchor="middle"
        fill={labelColor} fontSize={7.5} fontFamily="'JetBrains Mono', monospace"
        fontWeight="600" letterSpacing="3">
        ▸ VEG ROOMS
      </text>
      <text x={flowerCenterX} y={flowerY} textAnchor="middle"
        fill={labelColor} fontSize={7.5} fontFamily="'JetBrains Mono', monospace"
        fontWeight="600" letterSpacing="3">
        ▸ FLOWER BLOCK
      </text>
    </g>
  )
}
