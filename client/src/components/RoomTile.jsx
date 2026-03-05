import { useFacilityStore } from '../store/facilityStore'
import { statusColor } from './FacilityMap'

const SYMBOL_MAP = {
  ipm:          { glyph: '🐛', label: 'IPM' },
  defoliation:  { glyph: '✂', label: 'Defoliation' },
  transfer:     { glyph: '⇄', label: 'Transfer' },
  mode_change:  { glyph: '⚙', label: 'Mode Change' },
  supply_ready: { glyph: '◈', label: 'Supply Ready' },
  calendar:     { glyph: '◷', label: 'Calendar Event' },
  issue:        { glyph: '⚠', label: 'Issue' },
}

const TYPE_BADGE = {
  flower:  { label: 'FLR', color: '#4ade8044' },
  veg:     { label: 'VEG', color: '#60a5fa44' },
  support: { label: 'SUP', color: '#a78bfa44' },
}

export default function RoomTile({ room, x, y, w, h }) {
  const selectRoom = useFacilityStore(s => s.selectRoom)
  const colors = statusColor(room.status)
  const badge = TYPE_BADGE[room.type] || TYPE_BADGE.support

  const RADIUS = 5
  const SYMBOL_SIZE = 13
  const maxSymbolsInRow = Math.floor((w - 16) / (SYMBOL_SIZE + 3))
  const visibleSymbols = room.symbols.slice(0, maxSymbolsInRow)

  const handleClick = () => selectRoom(room.id)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') selectRoom(room.id)
  }

  return (
    <g
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${room.name} – ${room.stage}`}
      style={{ cursor: 'pointer' }}
    >
      {/* Status glow ring (alert/warn only) */}
      {room.status === 'alert' && (
        <rect
          x={x - 2} y={y - 2} width={w + 4} height={h + 4}
          rx={RADIUS + 2}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={2}
          opacity={0.5}
        >
          <animate attributeName="opacity" values="0.2;0.7;0.2" dur="2s" repeatCount="indefinite" />
        </rect>
      )}

      {/* Room body */}
      <rect
        x={x} y={y} width={w} height={h}
        rx={RADIUS}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={1.5}
      />

      {/* Hover overlay (CSS handles this via .room-tile:hover rect) */}
      <rect
        x={x} y={y} width={w} height={h}
        rx={RADIUS}
        fill="white"
        opacity={0}
        className="room-hover-overlay"
      />

      {/* Type badge top-right */}
      <rect
        x={x + w - 36} y={y + 6}
        width={30} height={13}
        rx={3}
        fill={badge.color}
      />
      <text
        x={x + w - 21} y={y + 16}
        textAnchor="middle"
        fill={colors.label}
        fontSize={7}
        fontFamily="'JetBrains Mono', monospace"
        fontWeight="700"
        letterSpacing="1"
        opacity={0.9}
      >
        {badge.label}
      </text>

      {/* Room name */}
      <text
        x={x + 10} y={y + 28}
        fill={colors.label}
        fontSize={room.name.length > 6 ? 10 : 14}
        fontFamily="'JetBrains Mono', monospace"
        fontWeight="700"
        letterSpacing="0.5"
      >
        {room.name}
      </text>

      {/* Stage */}
      <text
        x={x + 10} y={y + 46}
        fill="#8888aa"
        fontSize={8.5}
        fontFamily="'JetBrains Mono', monospace"
        fontWeight="400"
      >
        {room.stage}
      </text>

      {/* Batch ID */}
      {room.batch && (
        <text
          x={x + 10} y={y + 58}
          fill="#4a4a6a"
          fontSize={7.5}
          fontFamily="'JetBrains Mono', monospace"
        >
          {room.batch}
        </text>
      )}

      {/* Symbol strip */}
      {visibleSymbols.length > 0 && (
        <g>
          {/* Strip background */}
          <rect
            x={x + 6} y={y + h - 26}
            width={w - 12} height={18}
            rx={3}
            fill="#0d0d14"
            opacity={0.6}
          />
          {visibleSymbols.map((sym, i) => {
            const s = SYMBOL_MAP[sym]
            if (!s) return null
            return (
              <text
                key={sym}
                x={x + 12 + i * (SYMBOL_SIZE + 4)}
                y={y + h - 12}
                fontSize={11}
                fontFamily="'Segoe UI Emoji', 'Apple Color Emoji', sans-serif"
                fill="#cccccc"
                aria-label={s.label}
              >
                {s.glyph}
              </text>
            )
          })}
          {room.symbols.length > maxSymbolsInRow && (
            <text
              x={x + w - 16} y={y + h - 12}
              fontSize={8}
              fontFamily="'JetBrains Mono', monospace"
              fill="#555577"
            >
              +{room.symbols.length - maxSymbolsInRow}
            </text>
          )}
        </g>
      )}

      {/* Status dot */}
      <circle
        cx={x + 10} cy={y + 10}
        r={4}
        fill={colors.label}
        opacity={0.85}
      >
        {room.status === 'alert' && (
          <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite" />
        )}
      </circle>
    </g>
  )
}
