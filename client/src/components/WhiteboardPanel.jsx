import { useState, useEffect, useCallback } from 'react'
import { useFacilityStore } from '../store/facilityStore'
import { apiFetch } from '../lib/apiFetch'

const STATUSES = [
  { key: 'todo',        label: 'TO DO',       color: '#6b7280' },
  { key: 'in_progress', label: 'IN PROGRESS', color: '#f59e0b' },
  { key: 'done',        label: 'DONE',        color: '#4ade80' },
]

const NEXT_STATUS = { todo: 'in_progress', in_progress: 'done', done: 'todo' }

const PRIORITY_COLOR = { low: '#6b7280', normal: '#60a5fa', high: '#f87171' }

export default function WhiteboardPanel({ open, onClose }) {
  const rooms    = useFacilityStore(s => s.rooms)
  const authUser = useFacilityStore(s => s.authUser)

  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(false)
  const [addOpen, setAddOpen]   = useState(false)
  const [form, setForm]         = useState({ title: '', description: '', roomId: '', assignedTo: '', priority: 'normal' })
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/api/tasks')
      setTasks(data)
    } catch (e) {
      console.error('Failed to load tasks', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (open) load() }, [open, load])

  const cycleStatus = async (task) => {
    const next = NEXT_STATUS[task.status]
    setTasks(ts => ts.map(t => t.id === task.id ? { ...t, status: next } : t))
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) })
    } catch {
      setTasks(ts => ts.map(t => t.id === task.id ? { ...t, status: task.status } : t))
    }
  }

  const deleteTask = async (id) => {
    setTasks(ts => ts.filter(t => t.id !== id))
    try {
      await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' })
    } catch { load() }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true); setError(null)
    try {
      const task = await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title:       form.title.trim(),
          description: form.description.trim() || undefined,
          roomId:      form.roomId || undefined,
          assignedTo:  form.assignedTo.trim() || undefined,
          priority:    form.priority,
        }),
      })
      setTasks(ts => [task, ...ts])
      setForm({ title: '', description: '', roomId: '', assignedTo: '', priority: 'normal' })
      setAddOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const interactiveRooms = rooms.filter(r => r.interactive !== false && r.id && !r.id.startsWith('_'))

  const byStatus = (status) => tasks.filter(t => t.status === status)

  return (
    <>
      {/* Backdrop */}
      <div
        className={`wb-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden
      />

      <aside className={`wb-panel ${open ? 'open' : ''}`} aria-label="Task whiteboard">
        {/* Header */}
        <div className="wb-header">
          <span className="wb-title">WHITEBOARD</span>
          <button
            className="wb-add-btn"
            onClick={() => setAddOpen(o => !o)}
          >
            {addOpen ? '✕ Cancel' : '+ Task'}
          </button>
          <button className="wb-close" onClick={onClose}>✕</button>
        </div>

        {/* Add task form */}
        {addOpen && (
          <form className="wb-add-form" onSubmit={handleAdd}>
            <input
              className="wb-input"
              placeholder="Task title *"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              autoFocus
            />
            <textarea
              className="wb-input wb-textarea"
              placeholder="Description (optional)"
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
            <div className="wb-form-row">
              <select
                className="wb-input wb-select"
                value={form.roomId}
                onChange={e => setForm(f => ({ ...f, roomId: e.target.value }))}
              >
                <option value="">No room</option>
                {interactiveRooms.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <select
                className="wb-input wb-select"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
            <input
              className="wb-input"
              placeholder="Assign to (optional)"
              value={form.assignedTo}
              onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
            />
            {error && <p className="form-error">{error}</p>}
            <button className="btn-primary" type="submit" disabled={saving || !form.title.trim()}>
              {saving ? 'Adding…' : 'Add Task'}
            </button>
          </form>
        )}

        {/* Columns */}
        <div className="wb-board">
          {loading && <p className="wb-loading">Loading…</p>}
          {STATUSES.map(col => {
            const colTasks = byStatus(col.key)
            return (
              <div key={col.key} className="wb-col">
                <div className="wb-col-header">
                  <span className="wb-col-dot" style={{ background: col.color }} />
                  <span className="wb-col-label">{col.label}</span>
                  <span className="wb-col-count">{colTasks.length}</span>
                </div>
                <div className="wb-col-body">
                  {colTasks.length === 0 && (
                    <p className="wb-empty">—</p>
                  )}
                  {colTasks.map(task => {
                    const room = task.roomId ? rooms.find(r => r.id === task.roomId) : null
                    return (
                      <div key={task.id} className="wb-card">
                        <div className="wb-card-top">
                          <span
                            className="wb-priority-dot"
                            style={{ background: PRIORITY_COLOR[task.priority] ?? PRIORITY_COLOR.normal }}
                            title={task.priority}
                          />
                          <span className="wb-card-title">{task.title}</span>
                          <button
                            className="wb-card-delete"
                            onClick={() => deleteTask(task.id)}
                            aria-label="Delete task"
                          >✕</button>
                        </div>
                        {task.description && (
                          <p className="wb-card-desc">{task.description}</p>
                        )}
                        <div className="wb-card-footer">
                          {room && <span className="wb-card-room">{room.name}</span>}
                          {task.assignedTo && <span className="wb-card-assignee">→ {task.assignedTo}</span>}
                          <button
                            className="wb-status-btn"
                            style={{ borderColor: col.color, color: col.color }}
                            onClick={() => cycleStatus(task)}
                            title="Cycle status"
                          >
                            {col.label}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </aside>
    </>
  )
}
