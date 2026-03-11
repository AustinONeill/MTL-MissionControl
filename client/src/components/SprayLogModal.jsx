import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFacilityStore } from '../store/facilityStore'
import { apiFetch } from '../lib/apiFetch'

const today = () => new Date().toISOString().slice(0, 10)
const nowTime = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`
}

export default function SprayLogModal({ roomId, onClose, onSaved }) {
  const getRoom  = useFacilityStore(s => s.getRoom)
  const authUser = useFacilityStore(s => s.authUser)
  const room     = getRoom(roomId)

  const [form, setForm] = useState({
    batchIds:           '',
    pesticide:          '',
    appliedAt:          today(),
    startTime:          nowTime(),
    endTime:            '',
    reasonPreventative: false,
    reasonTreatment:    false,
    methodFoliarSpray:  false,
    methodDip:          false,
    equipmentNumber:    '',
    equipmentName:      '',
    ratio:              '',
    quantity:           '',
    supervisorName:     '',
    reEntryHours:       4,
    notes:              '',
  })
  const [photoFile, setPhotoFile]     = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  const toggle = (key) => () => setForm(f => ({ ...f, [key]: !f[key] }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const required = ['batchIds', 'pesticide', 'appliedAt', 'startTime', 'endTime',
      'equipmentNumber', 'equipmentName', 'ratio', 'quantity']
    const missing = required.filter(k => !form[k])
    if (missing.length) {
      setError(`Required: ${missing.join(', ')}`)
      return
    }
    if (!form.reasonPreventative && !form.reasonTreatment) {
      setError('Select at least one reason (Preventative or Treatment).')
      return
    }
    if (!form.methodFoliarSpray && !form.methodDip) {
      setError('Select at least one application method.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      let photoUrl = null
      if (photoFile && API_BASE) {
        const presign = await apiFetch('/api/photos/presign', {
          method: 'POST',
          body: JSON.stringify({ roomId, logType: 'spray', contentType: photoFile.type }),
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
            batchIds:           form.batchIds,
            pesticide:          form.pesticide,
            appliedAt:          new Date(form.appliedAt).toISOString(),
            startTime:          form.startTime,
            endTime:            form.endTime,
            reasonPreventative: form.reasonPreventative,
            reasonTreatment:    form.reasonTreatment,
            methodFoliarSpray:  form.methodFoliarSpray,
            methodDip:          form.methodDip,
            equipmentNumber:    form.equipmentNumber,
            equipmentName:      form.equipmentName,
            ratio:              form.ratio,
            quantity:           form.quantity,
            supervisorName:     form.supervisorName || undefined,
            reEntryHours:       Number(form.reEntryHours),
            notes:              form.notes || undefined,
            photoUrl:           photoUrl || undefined,
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
      <div
        className="modal-panel"
        style={{ maxWidth: 520, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Spray Log — F-005"
      >
        <div className="modal-header">
          <span className="modal-glyph">🧪</span>
          <span className="modal-title">SPRAY LOG — F-005</span>
          <span className="modal-room">{room?.name ?? roomId}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">

          {/* Batch IDs */}
          <div className="form-row">
            <label>Batch(es) *</label>
            <input
              type="text"
              value={form.batchIds}
              onChange={set('batchIds')}
              placeholder="e.g. 3UC260112PE, GP2260112PE"
              autoFocus
            />
          </div>

          {/* Pesticide */}
          <div className="form-row">
            <label>Pesticide (name + reg #) *</label>
            <input
              type="text"
              value={form.pesticide}
              onChange={set('pesticide')}
              placeholder="e.g. Sulfur 873 — PCP #28890"
            />
          </div>

          {/* Date + times */}
          <div className="form-row form-row-3col">
            <div>
              <label>Date *</label>
              <input type="date" value={form.appliedAt} onChange={set('appliedAt')} />
            </div>
            <div>
              <label>Start Time *</label>
              <input
                type="text"
                value={form.startTime}
                onChange={set('startTime')}
                placeholder="08h30"
              />
            </div>
            <div>
              <label>End Time *</label>
              <input
                type="text"
                value={form.endTime}
                onChange={set('endTime')}
                placeholder="10h30"
              />
            </div>
          </div>

          {/* Reason */}
          <div className="form-row">
            <label>Reason *</label>
            <div className="checkbox-row">
              <label className="checkbox-label">
                <input type="checkbox" checked={form.reasonPreventative} onChange={toggle('reasonPreventative')} />
                Preventative
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={form.reasonTreatment} onChange={toggle('reasonTreatment')} />
                Treatment
              </label>
            </div>
          </div>

          {/* Method */}
          <div className="form-row">
            <label>Method *</label>
            <div className="checkbox-row">
              <label className="checkbox-label">
                <input type="checkbox" checked={form.methodFoliarSpray} onChange={toggle('methodFoliarSpray')} />
                Foliar Spray
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={form.methodDip} onChange={toggle('methodDip')} />
                Dip
              </label>
            </div>
          </div>

          {/* Equipment */}
          <div className="form-row form-row-2col">
            <div>
              <label>Equipment # *</label>
              <input
                type="text"
                value={form.equipmentNumber}
                onChange={set('equipmentNumber')}
                placeholder="e.g. Pest-01"
              />
            </div>
            <div>
              <label>Equipment Name *</label>
              <input
                type="text"
                value={form.equipmentName}
                onChange={set('equipmentName')}
                placeholder="e.g. MSO Sprayer"
              />
            </div>
          </div>

          {/* Ratio + Quantity */}
          <div className="form-row form-row-2col">
            <div>
              <label>Ratio *</label>
              <input
                type="text"
                value={form.ratio}
                onChange={set('ratio')}
                placeholder="e.g. 22g/15L"
              />
            </div>
            <div>
              <label>Quantity *</label>
              <input
                type="text"
                value={form.quantity}
                onChange={set('quantity')}
                placeholder="e.g. 30L"
              />
            </div>
          </div>

          {/* Operator (auto-filled) + Supervisor */}
          <div className="form-row form-row-2col">
            <div>
              <label>Performed By</label>
              <input
                type="text"
                value={authUser?.name ?? '—'}
                readOnly
                style={{ opacity: 0.55, cursor: 'default' }}
              />
            </div>
            <div>
              <label>SUPV / APPV</label>
              <input
                type="text"
                value={form.supervisorName}
                onChange={set('supervisorName')}
                placeholder="Supervisor name"
              />
            </div>
          </div>

          {/* Re-entry override */}
          <div className="form-row" style={{ maxWidth: 160 }}>
            <label>Re-Entry Override (hrs)</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.reEntryHours}
              onChange={set('reEntryHours')}
            />
          </div>

          {/* Notes */}
          <div className="form-row">
            <label>Notes</label>
            <textarea
              value={form.notes}
              onChange={set('notes')}
              rows={2}
              placeholder="Optional…"
            />
          </div>

          {/* Photo */}
          <div className="form-row">
            <label>Photo</label>
            <div className="photo-upload-row">
              <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
                {photoFile ? '📷 Change Photo' : '📷 Attach Photo'}
              </button>
              {photoPreview && <img src={photoPreview} alt="preview" className="photo-thumb" />}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  setPhotoFile(f)
                  setPhotoPreview(URL.createObjectURL(f))
                }}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
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
