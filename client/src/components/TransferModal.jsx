import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useFacilityStore } from '../store/facilityStore'

const TRANSFER_TYPES = [
  'Transplant',
  'Clone Run',
  'Trim / Process',
  'Harvest Move',
  'Mother Move',
  'Other',
]

export default function TransferModal({ originRoomId, onClose }) {
  const getRoom        = useFacilityStore(s => s.getRoom)
  const transfers      = useFacilityStore(s => s.transfers)
  const rooms          = useFacilityStore(s => s.rooms)
  const updateTransfer = useFacilityStore(s => s.updateTransfer)
  const removeTransfer = useFacilityStore(s => s.removeTransfer)

  const originRoom  = getRoom(originRoomId)
  const transfer    = transfers[originRoomId] ?? {}
  const destRoom    = getRoom(transfer.destinationId)

  const [form, setForm] = useState({
    destinationId: transfer.destinationId ?? '',
    transferType:  transfer.transferType ?? 'Transplant',
    transferDate:  transfer.transferDate
      ? new Date(transfer.transferDate).toISOString().slice(0, 16)
      : '',
    notes: transfer.notes ?? '',
  })

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSave = () => {
    updateTransfer(originRoomId, {
      destinationId: form.destinationId,
      transferType:  form.transferType,
      transferDate:  form.transferDate ? new Date(form.transferDate).toISOString() : null,
      notes:         form.notes,
    })
    onClose()
  }

  const handleRemove = () => {
    removeTransfer(originRoomId)
    onClose()
  }

  const setField = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  // Rooms available as destinations (not the origin itself)
  const eligibleRooms = rooms.filter(r => r.interactive !== false && r.id !== originRoomId)

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ maxWidth: 420, width: '95vw' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Transfer Details"
      >
        <div className="modal-header">
          <span className="modal-glyph">⇄</span>
          <span className="modal-title">TRANSFER</span>
          <span className="modal-room" style={{ color: '#f59e0b' }}>
            {originRoom?.name ?? originRoomId}
          </span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-form">
          {/* Origin (read-only) */}
          <div className="transfer-route-row">
            <div className="transfer-route-chip origin">
              <span className="transfer-route-label">FROM</span>
              <span className="transfer-route-name">{originRoom?.name ?? originRoomId}</span>
            </div>
            <span className="transfer-route-arrow">⇄</span>
            <div className={`transfer-route-chip dest ${form.destinationId ? 'set' : 'unset'}`}>
              <span className="transfer-route-label">TO</span>
              <span className="transfer-route-name">
                {form.destinationId ? (getRoom(form.destinationId)?.name ?? form.destinationId) : '—'}
              </span>
            </div>
          </div>

          {/* Destination selector */}
          <div className="form-row">
            <label>Destination Room</label>
            <select value={form.destinationId} onChange={setField('destinationId')}>
              <option value="">— Select room —</option>
              {eligibleRooms.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Transfer Type</label>
            <select value={form.transferType} onChange={setField('transferType')}>
              {TRANSFER_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Scheduled Date & Time</label>
            <input
              type="datetime-local"
              value={form.transferDate}
              onChange={setField('transferDate')}
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

          <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
            <button
              type="button"
              className="btn-remove"
              onClick={handleRemove}
            >
              Remove Transfer
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
