import { useEffect, useState } from 'react'
import { useFacilityStore } from '../store/facilityStore'

function getCountdown(expiresAt) {
  if (!expiresAt) return null
  const diffMs = new Date(expiresAt).getTime() - Date.now()
  const diffMin = Math.floor(diffMs / 60000)
  return diffMin
}

export default function ReEntryBadge({ roomId, reEntryExpiresAt, x, y }) {
  const clearReEntry = useFacilityStore((s) => s.clearReEntry)
  const [minutes, setMinutes] = useState(() => getCountdown(reEntryExpiresAt))

  useEffect(() => {
    if (!reEntryExpiresAt) return
    const tick = () => {
      const m = getCountdown(reEntryExpiresAt)
      setMinutes(m)
      if (m !== null && m <= 0) {
        clearReEntry(roomId)
      }
    }
    tick()
    const id = setInterval(tick, 60000)
    return () => clearInterval(id)
  }, [reEntryExpiresAt, roomId, clearReEntry])

  if (!reEntryExpiresAt) return null

  let label, bg, color
  if (minutes === null || minutes <= 0) {
    label = 'CLEARED'
    bg = '#1a6b3a'
    color = '#b8ffd2'
  } else if (minutes > 60) {
    const hrs = Math.ceil(minutes / 60)
    label = `RE-ENTRY ${hrs}h`
    bg = '#1a4a1a'
    color = '#6dff9a'
  } else {
    label = `RE-ENTRY ${minutes}m`
    bg = '#6b4a00'
    color = '#ffcf60'
  }

  return (
    <foreignObject x={x} y={y} width={72} height={16} style={{ overflow: 'visible' }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '7px',
        fontWeight: 700,
        letterSpacing: '0.05em',
        padding: '2px 4px',
        borderRadius: '3px',
        whiteSpace: 'nowrap',
        background: bg,
        color,
        border: '1px solid rgba(0,0,0,0.3)',
        lineHeight: 1,
      }}>
        {label}
      </div>
    </foreignObject>
  )
}
