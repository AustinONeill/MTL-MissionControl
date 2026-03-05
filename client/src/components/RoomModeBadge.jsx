import { MODES } from '../store/facilityStore'
import './RoomModeBadge.css'

const MODE_CONFIG = {
  [MODES.VEG]:         { label: 'VEG',    className: 'mode-veg' },
  [MODES.FLOWER]:      { label: 'FLOWER', className: 'mode-flower' },
  [MODES.FLUSH]:       { label: 'FLUSH',  className: 'mode-flush' },
  [MODES.DRY]:         { label: 'DRY',    className: 'mode-dry' },
  [MODES.IDLE]:        { label: 'IDLE',   className: 'mode-idle' },
  [MODES.MAINTENANCE]: { label: 'MAINT',  className: 'mode-maintenance' },
}

export default function RoomModeBadge({ mode, x, y }) {
  const config = MODE_CONFIG[mode] ?? MODE_CONFIG[MODES.IDLE]
  return (
    <foreignObject x={x} y={y} width={52} height={18} style={{ overflow: 'visible' }}>
      <div className={`mode-badge ${config.className}`}>
        {config.label}
      </div>
    </foreignObject>
  )
}
