import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFacilityStore } from '../store/facilityStore'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

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

export default function SprayLogModal({ roomId, onClose, onSaved }) {
  const getRoom = useFacilityStore(s => s.getRoom)
  const room = getRoom(roomId)

  const [form, setForm] = useState({
    product: '',
    rate: '',
    method: '',
    pcpRegNumber: '',
    appliedAt: new Date().toISOString().slice(0, 16),
    reEntryHours: 4,
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
    if (!form.product || !form.rate) {
      setError('Product and rate are required.')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      let photoUrl = null

      // Upload photo to R2 if attached
      if (photoFile && API_BASE) {
        const presign = await apiFetch('/api/photos/presign', {
          method: 'POST',
          body: JSON.stringify({
            roomId,
            logType: 'spray',
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
        await apiFetch('/api/spray-logs', {
          method: 'POST',
          body: JSON.stringify({
            roomId,
            product: form.product,
            rate: form.rate,
            method: form.method || undefined,
            pcpRegNumber: form.pcpRegNumber || undefined,
            appliedAt: new Date(form.appliedAt).toISOString(),
            reEntryHours: Number(form.reEntryHours),
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

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ maxWidth: 460, width: '95vw' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Spray Log"
      >
        <div className="modal-header">
          <span className="modal-glyph">🧪</span>
          <span className="modal-title">SPRAY LOG</span>
          <span className="modal-room">{room?.name ?? roomId}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <label>Product *</label>
            <input
              type="text"
              value={form.product}
              onChange={set('product')}
              placeholder="e.g. Actinovate"
              autoFocus
              required
            />
          </div>

          <div className="form-row">
            <label>Rate *</label>
            <input
              type="text"
              value={form.rate}
              onChange={set('rate')}
              placeholder="e.g. 2g / 10L"
              required
            />
          </div>

          <div className="form-row">
            <label>Method</label>
            <input
              type="text"
              value={form.method}
              onChange={set('method')}
              placeholder="Foliar / Drench / Spray"
            />
          </div>

          <div className="form-row">
            <label>PCP Reg. #</label>
            <input
              type="text"
              value={form.pcpRegNumber}
              onChange={set('pcpRegNumber')}
              placeholder="Health Canada PCP number"
            />
          </div>

          <div className="form-row form-row-2col">
            <div>
              <label>Applied At *</label>
              <input type="datetime-local" value={form.appliedAt} onChange={set('appliedAt')} required />
            </div>
            <div>
              <label>Re-Entry (hours) *</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.reEntryHours}
                onChange={set('reEntryHours')}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <label>Notes</label>
            <textarea
              value={form.notes}
              onChange={set('notes')}
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
              {submitting ? 'Saving…' : 'Save Spray Log'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
