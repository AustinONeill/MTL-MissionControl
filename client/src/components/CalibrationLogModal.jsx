import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFacilityStore } from '../store/facilityStore'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

const EQUIPMENT_TYPES = [
  'pH Meter',
  'EC Meter',
  'CO₂ Sensor',
  'Temp / Humidity Probe',
  'Light Meter',
  'DO Meter',
  'Other',
]

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('stack-auth-token')
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export default function CalibrationLogModal({ roomId, onClose, onSaved }) {
  const getRoom = useFacilityStore(s => s.getRoom)
  const room = getRoom(roomId)

  const [form, setForm] = useState({
    equipmentType: EQUIPMENT_TYPES[0],
    preReading: '',
    standard: '',
    postReading: '',
    passFail: true,
    calibratedAt: new Date().toISOString().slice(0, 16),
    notes: '',
  })
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.standard || form.preReading === '' || form.postReading === '') {
      setError('Standard, pre-reading, and post-reading are required.')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      let photoUrl = null

      if (photoFile && API_BASE) {
        const presign = await apiFetch('/api/photos/presign', {
          method: 'POST',
          body: JSON.stringify({
            roomId,
            logType: 'calibration',
            contentType: photoFile.type,
          }),
        })
        await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': photoFile.type },
          body: photoFile,
        })
        photoUrl = presign.publicUrl
      }

      if (API_BASE) {
        await apiFetch('/api/calibration-logs', {
          method: 'POST',
          body: JSON.stringify({
            roomId,
            equipmentType: form.equipmentType,
            preReading: Number(form.preReading),
            standard: form.standard,
            postReading: Number(form.postReading),
            passFail: form.passFail,
            calibratedAt: new Date(form.calibratedAt).toISOString(),
            photoUrl: photoUrl || undefined,
            notes: form.notes || undefined,
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

  const setField = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ maxWidth: 460, width: '95vw' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Calibration Log"
      >
        <div className="modal-header">
          <span className="modal-glyph">🔬</span>
          <span className="modal-title">CALIBRATION LOG</span>
          <span className="modal-room">{room?.name ?? roomId}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <label>Equipment Type *</label>
            <select value={form.equipmentType} onChange={setField('equipmentType')}>
              {EQUIPMENT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="form-row form-row-2col">
            <div>
              <label>Pre-Calibration Reading *</label>
              <input
                type="number"
                step="any"
                value={form.preReading}
                onChange={setField('preReading')}
                placeholder="e.g. 6.8"
                required
              />
            </div>
            <div>
              <label>Calibration Standard *</label>
              <input
                type="text"
                value={form.standard}
                onChange={setField('standard')}
                placeholder="e.g. pH 7.0 buffer"
                required
              />
            </div>
          </div>

          <div className="form-row form-row-2col">
            <div>
              <label>Post-Calibration Reading *</label>
              <input
                type="number"
                step="any"
                value={form.postReading}
                onChange={setField('postReading')}
                placeholder="e.g. 7.01"
                required
              />
            </div>
            <div>
              <label>Result *</label>
              <div className="pass-fail-toggle">
                <button
                  type="button"
                  className={form.passFail ? 'btn-pass active' : 'btn-pass'}
                  onClick={() => setForm(f => ({ ...f, passFail: true }))}
                >
                  PASS
                </button>
                <button
                  type="button"
                  className={!form.passFail ? 'btn-fail active' : 'btn-fail'}
                  onClick={() => setForm(f => ({ ...f, passFail: false }))}
                >
                  FAIL
                </button>
              </div>
            </div>
          </div>

          <div className="form-row">
            <label>Calibrated At *</label>
            <input
              type="datetime-local"
              value={form.calibratedAt}
              onChange={setField('calibratedAt')}
              required
            />
          </div>

          <div className="form-row">
            <label>Notes</label>
            <textarea
              value={form.notes}
              onChange={setField('notes')}
              rows={2}
              placeholder="Optional notes..."
            />
          </div>

          <div className="form-row">
            <label>Photo</label>
            <div className="photo-upload-row">
              <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
                {photoFile ? '📷 Change Photo' : '📷 Attach Photo'}
              </button>
              {photoPreview && (
                <img src={photoPreview} alt="preview" className="photo-thumb" />
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Calibration Log'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
