import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFacilityStore } from '../store/facilityStore'
import { apiFetch } from '../lib/apiFetch'

// ── Net graphic — top-down view of a lowered net ───────────────────────────
function NetGraphic({ active }) {
  const cols = [38, 68, 98, 128, 158]
  const rows = [32, 52, 72, 92]

  return (
    <svg viewBox="0 0 200 120" width="100%" style={{ display: 'block' }}>
      {/* Room outline */}
      <rect x={20} y={16} width={160} height={88} rx={3}
        fill={active ? '#061a0e' : '#0d0d14'}
        stroke={active ? '#2d5c42' : '#1e1e30'}
        strokeWidth={1.5}
      />

      {/* Horizontal net lines */}
      {rows.map((y, i) => (
        <line key={`h${i}`} x1={26} y1={y} x2={174} y2={y}
          stroke={active ? '#4ade8044' : '#1e1e30'}
          strokeWidth={active ? 1.5 : 1}
        />
      ))}

      {/* Vertical post lines */}
      {cols.map((x, i) => (
        <line key={`v${i}`} x1={x} y1={22} x2={x} y2={98}
          stroke={active ? '#2d5c4255' : '#18181e'}
          strokeWidth={1}
          strokeDasharray="3 4"
        />
      ))}

      {/* Net intersection dots */}
      {active && rows.map((y, ri) =>
        cols.map((x, ci) => (
          <circle key={`d${ri}-${ci}`} cx={x} cy={y} r={2.5}
            fill="#4ade8066"
          />
        ))
      )}

      {/* Status pill */}
      <rect x={60} y={103} width={80} height={13} rx={6}
        fill={active ? '#0e2d1a' : '#111118'}
        stroke={active ? '#2d5c42' : '#1e1e30'}
        strokeWidth={1}
      />
      <text x={100} y={113} textAnchor="middle" fontSize={7} fontWeight="700"
        fill={active ? '#4ade80' : '#2a2a3a'}
        fontFamily="'JetBrains Mono', monospace">
        {active ? '✓ LOWERED' : 'NOT SET'}
      </text>
    </svg>
  )
}

// ── Zip tie graphic — grid of anchors, all confirmed when active ───────────
function ZipTieGraphic({ active }) {
  const ROWS    = ['A', 'B', 'C', 'D']
  const ANCHORS = 6
  const cols    = Array.from({ length: ANCHORS }, (_, i) => 38 + i * 26)
  const rows    = Array.from({ length: ROWS.length }, (_, i) => 32 + i * 20)

  return (
    <svg viewBox="0 0 200 120" width="100%" style={{ display: 'block' }}>
      {/* Room outline */}
      <rect x={20} y={16} width={160} height={88} rx={3}
        fill={active ? '#061a0e' : '#0d0d14'}
        stroke={active ? '#2d5c42' : '#1e1e30'}
        strokeWidth={1.5}
      />

      {/* Row labels */}
      {ROWS.map((row, ri) => (
        <text key={row} x={26} y={rows[ri] + 4} fontSize={8} fontWeight="700"
          fill={active ? '#4ade80' : '#2a2a3a'}
          fontFamily="'JetBrains Mono', monospace">
          {row}
        </text>
      ))}

      {/* Net line per row */}
      {rows.map((y, ri) => (
        <line key={`l${ri}`} x1={34} y1={y} x2={176} y2={y}
          stroke={active ? '#4ade8033' : '#18181e'}
          strokeWidth={active ? 1.2 : 0.8}
        />
      ))}

      {/* Anchor circles */}
      {ROWS.map((row, ri) =>
        cols.map((x, ai) => (
          <g key={`${row}-${ai}`}>
            <circle cx={x} cy={rows[ri]} r={7}
              fill={active ? '#0e2d1a' : '#14141f'}
              stroke={active ? '#4ade80' : '#2a2a3a'}
              strokeWidth={1.2}
            />
            {active
              ? <text x={x} y={rows[ri] + 3} textAnchor="middle" fontSize={8}
                  fill="#4ade80" fontFamily="sans-serif">✓</text>
              : <circle cx={x} cy={rows[ri]} r={2} fill="#2a2a3a" />
            }
          </g>
        ))
      )}

      {/* Status pill */}
      <rect x={40} y={103} width={120} height={13} rx={6}
        fill={active ? '#0e2d1a' : '#111118'}
        stroke={active ? '#2d5c42' : '#1e1e30'}
        strokeWidth={1}
      />
      <text x={100} y={113} textAnchor="middle" fontSize={7} fontWeight="700"
        fill={active ? '#4ade80' : '#2a2a3a'}
        fontFamily="'JetBrains Mono', monospace">
        {active ? '✓ ALL ZIP TIES SET' : 'TAP TO CONFIRM'}
      </text>
    </svg>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────
export default function NetModal({ roomId, onClose, onSaved }) {
  const getRoom = useFacilityStore(s => s.getRoom)
  const room    = getRoom(roomId)

  const [netNumber,   setNetNumber]   = useState(1)
  const [lowered,     setLowered]     = useState(false)
  const [zipConfirmed, setZipConfirmed] = useState(false)
  const [notes,       setNotes]       = useState('')
  const [photoFile,   setPhotoFile]   = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // Clicking net card toggles lowered; zip ties only unlocked after net lowered
  const handleNetCardClick = () => {
    const next = !lowered
    setLowered(next)
    if (!next) setZipConfirmed(false) // reset zip ties if un-lowering
  }

  const handleZipCardClick = () => {
    if (!lowered) return
    setZipConfirmed(v => !v)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      let photoUrl = null
      if (photoFile && API_BASE) {
        const p = await apiFetch('/api/photos/presign', {
          method: 'POST',
          body: JSON.stringify({ roomId, logType: 'net', contentType: photoFile.type }),
        })
        await fetch(p.uploadUrl, { method: 'PUT', headers: { 'Content-Type': photoFile.type }, body: photoFile })
        photoUrl = p.publicUrl
      }
      if (API_BASE) {
        const allTrue  = Array(6).fill(true)
        const allFalse = Array(6).fill(false)
        await apiFetch('/api/net-logs', {
          method: 'POST',
          body: JSON.stringify({
            roomId,
            netNumber,
            action:              'spread',
            status:              lowered ? 'lowered_checked' : 'lowering',
            zipTieChecks:        {
              rowA: zipConfirmed ? allTrue : allFalse,
              rowB: zipConfirmed ? allTrue : allFalse,
              rowC: zipConfirmed ? allTrue : allFalse,
              rowD: zipConfirmed ? allTrue : allFalse,
            },
            allZipTiesConfirmed: zipConfirmed,
            notes:               notes || undefined,
            photoUrl:            photoUrl || undefined,
          }),
        })
      }
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel"
        style={{ maxWidth: 460, width: '95vw', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="Net Log">

        <div className="modal-header">
          <span className="modal-glyph">🕸</span>
          <span className="modal-title">NET LOG</span>
          <span className="modal-room">{room?.name ?? roomId}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">

          {/* Net selector */}
          <div className="form-row" style={{ maxWidth: 180 }}>
            <label>Net</label>
            <select value={netNumber} onChange={e => setNetNumber(Number(e.target.value))}>
              <option value={1}>1st Net</option>
              <option value={2}>2nd Net</option>
            </select>
          </div>

          {/* Two-card confirmation flow */}
          <div className="net-cards-row">

            {/* Card 1 — Net lowered */}
            <button
              type="button"
              className={`net-card ${lowered ? 'net-card--active' : ''}`}
              onClick={handleNetCardClick}
              aria-pressed={lowered}
            >
              <span className="net-card-step">01</span>
              <span className="net-card-title">{lowered ? '✓ NET LOWERED' : 'NET LOWERING…'}</span>
              <NetGraphic active={lowered} />
            </button>

            {/* Card 2 — Zip ties */}
            <button
              type="button"
              className={`net-card ${zipConfirmed ? 'net-card--active' : ''} ${!lowered ? 'net-card--locked' : ''}`}
              onClick={handleZipCardClick}
              aria-pressed={zipConfirmed}
              disabled={!lowered}
            >
              <span className="net-card-step">02</span>
              <span className="net-card-title">{zipConfirmed ? '✓ ZIP TIES SET' : 'ZIP TIES'}</span>
              <ZipTieGraphic active={zipConfirmed} />
            </button>

          </div>

          {/* Notes */}
          <div className="form-row">
            <label>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional…" />
          </div>

          {/* Photo */}
          <div className="form-row">
            <label>Photo</label>
            <div className="photo-upload-row">
              <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
                {photoFile ? '📷 Change Photo' : '📷 Attach Photo'}
              </button>
              {photoPreview && <img src={photoPreview} alt="preview" className="photo-thumb" />}
              <input ref={fileRef} type="file" accept="image/*"
                onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return
                  setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f))
                }}
                style={{ display: 'none' }} />
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Net Log'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
