import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

async function fetchCalibrationLogs(roomId) {
  if (!API_BASE) return []
  const token = localStorage.getItem('stack-auth-token')
  const res = await fetch(`${API_BASE}/api/calibration-logs?roomId=${roomId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) return []
  return res.json()
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function CalibrationLogList({ roomId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchCalibrationLogs(roomId)
      .then(setLogs)
      .finally(() => setLoading(false))
  }, [roomId])

  if (loading) return <p className="log-loading">Loading calibration logs…</p>
  if (!logs.length) return <p className="log-empty">No calibration logs recorded.</p>

  return (
    <div className="log-list">
      {logs.map((log) => (
        <div key={log.id} className="log-entry">
          <div className="log-entry-header">
            <span className="log-product">{log.equipmentType}</span>
            <span className={`log-pass-chip ${log.passFail ? 'pass' : 'fail'}`}>
              {log.passFail ? 'PASS' : 'FAIL'}
            </span>
          </div>
          <div className="log-entry-meta">
            <span>Pre: {log.preReading}</span>
            <span>·</span>
            <span>Std: {log.standard}</span>
            <span>·</span>
            <span>Post: {log.postReading}</span>
          </div>
          <div className="log-entry-footer">
            <span>{log.operatorName}</span>
            <span>·</span>
            <span>{formatDate(log.calibratedAt)}</span>
          </div>
          {log.photoUrl && (
            <a href={log.photoUrl} target="_blank" rel="noreferrer" className="log-photo-link">
              <img src={log.photoUrl} alt="calibration photo" className="log-photo-thumb" />
            </a>
          )}
          {log.notes && <p className="log-notes">{log.notes}</p>}
        </div>
      ))}
    </div>
  )
}
