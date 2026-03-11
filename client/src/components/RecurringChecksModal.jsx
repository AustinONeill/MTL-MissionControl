import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFacilityStore } from '../store/facilityStore'
import { apiFetch, uploadPhoto } from '../lib/apiFetch'

// ── Pot Check Tab ─────────────────────────────────────────────────────────
function PotCheckForm({ roomId, onClose, onSaved }) {
  const [form, setForm] = useState({
    standingWaterFound: false,
    waterRemoved: false,
    rootHealth: 'healthy',
    notes: '',
  })
  const [photoFile, setPhotoFile]     = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState(null)
  const fileRef = useRef(null)

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.rootHealth !== 'healthy' && !form.notes) {
      setError('Notes are required when root health is Concern or Critical.')
      return
    }
    if (form.rootHealth === 'critical' && !photoFile) {
      setError('A photo is required when root health is Critical.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      let photoUrl = null
      if (photoFile && API_BASE) photoUrl = await uploadPhoto(roomId, 'pot_check', photoFile)

      if (API_BASE) {
        await apiFetch('/api/pot-check-logs', {
          method: 'POST',
          body: JSON.stringify({
            roomId,
            standingWaterFound: form.standingWaterFound,
            waterRemoved: form.standingWaterFound ? form.waterRemoved : undefined,
            rootHealth: form.rootHealth,
            notes: form.notes || undefined,
            photoUrl: photoUrl || undefined,
          }),
        })
      }
      onSaved?.('pot_check')
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="modal-form">
      {/* Standing water */}
      <div className="form-row">
        <label>Standing Water Present? *</label>
        <div className="radio-group">
          {[{ val: false, label: 'No' }, { val: true, label: 'Yes' }].map(({ val, label }) => (
            <label key={label} className="radio-label">
              <input
                type="radio"
                name="standingWater"
                checked={form.standingWaterFound === val}
                onChange={() => setField('standingWaterFound', val)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Water removed — only if standing water found */}
      {form.standingWaterFound && (
        <div className="form-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.waterRemoved}
              onChange={e => setField('waterRemoved', e.target.checked)}
            />
            Water Removed
          </label>
        </div>
      )}

      {/* Root health */}
      <div className="form-row">
        <label>Root Health *</label>
        <div className="radio-group">
          {[
            { val: 'healthy',  label: '✅ Healthy' },
            { val: 'concern',  label: '⚠️ Concern' },
            { val: 'critical', label: '🔴 Critical' },
          ].map(({ val, label }) => (
            <label key={val} className="radio-label">
              <input
                type="radio"
                name="rootHealth"
                checked={form.rootHealth === val}
                onChange={() => setField('rootHealth', val)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="form-row">
        <label>
          Notes {form.rootHealth !== 'healthy' ? '*' : ''}
        </label>
        <textarea
          value={form.notes}
          onChange={e => setField('notes', e.target.value)}
          rows={2}
          placeholder={form.rootHealth !== 'healthy' ? 'Required for Concern / Critical…' : 'Optional…'}
        />
      </div>

      {/* Photo */}
      <div className="form-row">
        <label>Photo {form.rootHealth === 'critical' ? '*' : ''}</label>
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
          {submitting ? 'Saving…' : 'Save Pot Check'}
        </button>
      </div>
    </form>
  )
}

// ── Filter Change Tab ─────────────────────────────────────────────────────
function FilterChangeForm({ roomId, onClose, onSaved }) {
  const [form, setForm] = useState({
    filterType: 'carbon',
    filterSize: '',
    oldCondition: 'normal',
    newInstalled: false,
    equipmentNumber: '',
    notes: '',
  })
  const [photoFile, setPhotoFile]     = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState(null)
  const fileRef = useRef(null)

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.newInstalled) {
      setError('"New Filter Installed" must be checked to save.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      let photoUrl = null
      if (photoFile && API_BASE) photoUrl = await uploadPhoto(roomId, 'filter_change', photoFile)

      if (API_BASE) {
        await apiFetch('/api/filter-change-logs', {
          method: 'POST',
          body: JSON.stringify({
            roomId,
            filterType: form.filterType,
            filterSize: form.filterSize || undefined,
            oldCondition: form.oldCondition,
            newInstalled: form.newInstalled,
            equipmentNumber: form.equipmentNumber || undefined,
            notes: form.notes || undefined,
            photoUrl: photoUrl || undefined,
          }),
        })
      }
      onSaved?.('filter_change')
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="modal-form">
      {/* Filter type */}
      <div className="form-row">
        <label>Filter Type *</label>
        <select value={form.filterType} onChange={e => setField('filterType', e.target.value)}>
          <option value="carbon">Carbon Filter</option>
          <option value="pre">Pre-Filter</option>
          <option value="hepa">HEPA</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Filter size + equipment number */}
      <div className="form-row form-row-2col">
        <div>
          <label>Filter Size</label>
          <input
            type="text"
            value={form.filterSize}
            onChange={e => setField('filterSize', e.target.value)}
            placeholder='e.g. 6 inch'
          />
        </div>
        <div>
          <label>Equipment #</label>
          <input
            type="text"
            value={form.equipmentNumber}
            onChange={e => setField('equipmentNumber', e.target.value)}
            placeholder='e.g. HVAC-02'
          />
        </div>
      </div>

      {/* Old condition */}
      <div className="form-row">
        <label>Old Filter Condition *</label>
        <div className="radio-group">
          {[
            { val: 'normal',        label: 'Normal' },
            { val: 'heavily_loaded', label: 'Heavily Loaded' },
            { val: 'damaged',       label: 'Damaged' },
          ].map(({ val, label }) => (
            <label key={val} className="radio-label">
              <input
                type="radio"
                name="oldCondition"
                checked={form.oldCondition === val}
                onChange={() => setField('oldCondition', val)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* New installed checkbox */}
      <div className="form-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.newInstalled}
            onChange={e => setField('newInstalled', e.target.checked)}
          />
          New Filter Installed *
        </label>
      </div>

      {/* Notes */}
      <div className="form-row">
        <label>Notes</label>
        <textarea
          value={form.notes}
          onChange={e => setField('notes', e.target.value)}
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
          {submitting ? 'Saving…' : 'Save Filter Change'}
        </button>
      </div>
    </form>
  )
}

// ── Shell modal with tabs ─────────────────────────────────────────────────
const TABS = [
  { key: 'pot_check',     label: '🪴 Pot Check' },
  { key: 'filter_change', label: '🌬 Filter Change' },
]

export default function RecurringChecksModal({ roomId, initialTab = 'pot_check', onClose, onSaved }) {
  const getRoom = useFacilityStore(s => s.getRoom)
  const room = getRoom(roomId)
  const [activeTab, setActiveTab] = useState(initialTab)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ maxWidth: 480, width: '95vw' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Recurring Checks"
      >
        <div className="modal-header">
          <span className="modal-glyph">{activeTab === 'pot_check' ? '🪴' : '🌬'}</span>
          <span className="modal-title">CHECKS</span>
          <span className="modal-room">{room?.name ?? roomId}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`modal-tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'pot_check' && (
          <PotCheckForm roomId={roomId} onClose={onClose} onSaved={onSaved} />
        )}
        {activeTab === 'filter_change' && (
          <FilterChangeForm roomId={roomId} onClose={onClose} onSaved={onSaved} />
        )}
      </div>
    </div>,
    document.body
  )
}
