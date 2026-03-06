import { MODES } from '../store/facilityStore'
import './RoomModeBadge.css'

const MODE_CONFIG = {
  [MODES.OFF]:  { label: 'OFF',  className: 'mode-off' },
  [MODES.AUTO]: { label: 'AUTO', className: 'mode-auto' },
  [MODES.CROP]: { label: 'CROP', className: 'mode-crop' },
  [MODES.FILL]: { label: 'FILL', className: 'mode-fill' },
}

export default function RoomModeBadge({ mode, x, y }) {
  const config = MODE_CONFIG[mode] ?? MODE_CONFIG[MODES.OFF]
  return (
    <foreignObject x={x} y={y} width={52} height={18} style={{ overflow: 'visible' }}>
      <div className={`mode-badge ${config.className}`}>
        {config.label}
      </div>
    </foreignObject>
  )
}
