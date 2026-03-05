// Animated SVG line connecting a transfer origin to its destination room.
// Receives screen-space coordinates (already transformed by ox/oy).

export default function TransferLine({ x1, y1, x2, y2, label }) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return null

  const markerId = `arrow-${Math.abs(Math.round(x1 + y1 + x2 + y2))}`

  // Midpoint for label
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2 - 10

  return (
    <g style={{ pointerEvents: 'none' }}>
      <defs>
        <marker
          id={markerId}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="#f59e0b" opacity="0.85" />
        </marker>
      </defs>

      {/* Glow underlay */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="#f59e0b"
        strokeWidth={6}
        strokeOpacity={0.12}
        strokeLinecap="round"
      />

      {/* Animated dashed line */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="#f59e0b"
        strokeWidth={1.5}
        strokeOpacity={0.85}
        strokeDasharray="6 4"
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to="-20"
          dur="0.8s"
          repeatCount="indefinite"
        />
      </line>

      {/* Origin dot */}
      <circle cx={x1} cy={y1} r={3.5} fill="#f59e0b" opacity={0.9} />

      {/* Transfer type label */}
      {label && (
        <text
          x={mx}
          y={my}
          textAnchor="middle"
          fill="#f59e0b"
          fontSize={8}
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="700"
          letterSpacing="0.5"
          opacity={0.8}
        >
          {label.toUpperCase()}
        </text>
      )}
    </g>
  )
}
