import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

async function fetchSprayLogs(roomId) {
  if (!API_BASE) return []
  const token = localStorage.getItem('stack-auth-token')
  const res = await fetch(`${API_BASE}/api/spray-logs?roomId=${roomId}`, {
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

export default function SprayLogList({ roomId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchSprayLogs(roomId)
      .then(setLogs)
      .finally(() => setLoading(false))
  }, [roomId])

  if (loading) return <p className="log-loading">Loading spray logs…</p>
  if (!logs.length) return <p className="log-empty">No spray logs recorded.</p>

  return (
    <div className="log-list">
      {logs.map((log) => {
        const expired = new Date(log.reEntryExpiresAt) <= new Date()
        return (
          <div key={log.id} className="log-entry">
            <div className="log-entry-header">
              <span className="log-product">{log.product}</span>
              <span className={`log-reentry-chip ${expired ? 'cleared' : 'active'}`}>
                {expired ? 'CLEARED' : `RE-ENTRY ${new Date(log.reEntryExpiresAt).toLocaleDateString('en-CA')}`}
              </span>
            </div>
            <div className="log-entry-meta">
              <span>{log.rate}</span>
              {log.method && <span>· {log.method}</span>}
              {log.pcpRegNumber && <span>· PCP #{log.pcpRegNumber}</span>}
            </div>
            <div className="log-entry-footer">
              <span>{log.operatorName}</span>
              <span>·</span>
              <span>{formatDate(log.appliedAt)}</span>
            </div>
            {log.photoUrl && (
              <a href={log.photoUrl} target="_blank" rel="noreferrer" className="log-photo-link">
                <img src={log.photoUrl} alt="spray photo" className="log-photo-thumb" />
              </a>
            )}
            {log.notes && <p className="log-notes">{log.notes}</p>}
          </div>
        )
      })}
    </div>
  )
}
