import { useState, useEffect, useRef, useCallback } from 'react'
import { useChatStore } from '../store/chatStore'
import { useFacilityStore } from '../store/facilityStore'
import { apiFetch } from '../lib/apiFetch'

// ── Autocomplete data ──────────────────────────────────────────────────────
const TASK_TYPES = [
  { key: 'defoliation', label: 'Defoliation',   icon: '✂️',  subtasks: ['Centre clean', 'Bottom clean', 'Centre + Bottom', 'Full defoliation'] },
  { key: 'ipm',         label: 'IPM Spray',      icon: '🧪',  subtasks: ['Preventative', 'Treatment', 'Scouting only'] },
  { key: 'net',         label: 'Net Log',         icon: '🕸',  subtasks: ['1st net lowered', '2nd net lowered', 'Zip ties confirmed'] },
  { key: 'transfer',    label: 'Transfer',        icon: '🔄',  subtasks: ['Schedule transfer', 'Transfer complete'] },
  { key: 'harvest',     label: 'Harvest Ready',   icon: '🌾',  subtasks: ['Mark ready', 'Harvest started', 'Harvest complete'] },
  { key: 'issue',       label: 'Flag Issue',      icon: '🚨',  subtasks: ['Environmental', 'Pest/Disease', 'Equipment', 'Other'] },
  { key: 'mode',        label: 'Mode Change',     icon: '⚙️',  subtasks: ['→ CROP', '→ FILL', '→ AUTO', '→ OFF'] },
  { key: 'task',        label: 'Create Task',     icon: '📋',  subtasks: null },
]

function matchRooms(query, rooms) {
  const q = query.toLowerCase().trim()
  if (!q) return []
  return rooms
    .filter(r => r.interactive !== false && r.id && !r.id.startsWith('_'))
    .filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      (q === 'fl' && r.type === 'flower') ||
      (q === 'veg' && r.type === 'veg') ||
      (q === 'dry' && r.type === 'utility') ||
      (q === 'f' && r.type === 'flower')
    )
    .slice(0, 8)
}

// ── Message bubble ─────────────────────────────────────────────────────────
function MessageBubble({ msg, isOwn }) {
  const isAction = msg.contentType === 'action'
  const ts = new Date(msg.createdAt).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div className={`chat-bubble-wrap ${isOwn ? 'own' : ''}`}>
      {!isOwn && <span className="chat-sender">{msg.senderName}</span>}
      <div className={`chat-bubble ${isOwn ? 'chat-bubble--own' : ''} ${isAction ? 'chat-bubble--action' : ''}`}>
        {msg.photoUrl && (
          <img src={msg.photoUrl} alt="attachment" className="chat-photo" />
        )}
        <span className="chat-bubble-text">{msg.content}</span>
      </div>
      <span className="chat-ts">{ts}</span>
    </div>
  )
}

// ── Chat input with autocomplete ───────────────────────────────────────────
function ChatInput({ convId, authUser, onSent }) {
  const sendMessage  = useChatStore(s => s.sendMessage)
  const rooms        = useFacilityStore(s => s.rooms)
  const fileRef      = useRef(null)

  const [text,        setText]        = useState('')
  const [sending,     setSending]     = useState(false)
  const [photoFile,   setPhotoFile]   = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [error,       setError]       = useState(null)

  // Autocomplete state machine: idle | room | task | subtask | composed
  const [ac, setAc] = useState({
    mode:           'idle',
    selectedRoom:   null,
    selectedTask:   null,
    composedAction: null,
    query:          '',
  })

  const suggestions = (() => {
    if (ac.mode === 'room')    return matchRooms(ac.query, rooms)
    if (ac.mode === 'task')    return TASK_TYPES.filter(t => t.label.toLowerCase().includes(ac.query.toLowerCase()))
    if (ac.mode === 'subtask') return (ac.selectedTask?.subtasks ?? []).filter(s => s.toLowerCase().includes(ac.query.toLowerCase())).map(s => ({ key: s, label: s, icon: '' }))
    return []
  })()

  const resetAc = () => setAc({ mode: 'idle', selectedRoom: null, selectedTask: null, composedAction: null, query: '' })

  const handleTextChange = (e) => {
    const val = e.target.value
    if (ac.mode === 'composed') {
      // Any edit clears the composed state
      resetAc()
      setText(val)
      return
    }
    setText(val)

    if (ac.mode === 'idle') {
      // Trigger room search if input matches something useful
      const trimmed = val.trim()
      if (trimmed.length >= 1 && matchRooms(trimmed, rooms).length > 0) {
        setAc({ mode: 'room', selectedRoom: null, selectedTask: null, composedAction: null, query: trimmed })
      }
    } else {
      setAc(a => ({ ...a, query: val.trim() }))
    }
  }

  const pickRoom = (room) => {
    setAc({ mode: 'task', selectedRoom: room, selectedTask: null, composedAction: null, query: '' })
    setText('')
  }

  const pickTask = (task) => {
    if (!task.subtasks) {
      // No subtasks — compose immediately
      const content = `${task.icon} ${task.label} — ${ac.selectedRoom.name}`
      setAc(a => ({
        ...a,
        mode:           'composed',
        selectedTask:   task,
        composedAction: {
          actionType:    'create_task',
          actionPayload: { roomId: ac.selectedRoom.id, taskLabel: task.label, subtask: '' },
        },
        query: '',
      }))
      setText(content)
    } else {
      setAc(a => ({ ...a, mode: 'subtask', selectedTask: task, query: '' }))
      setText('')
    }
  }

  const pickSubtask = (subtask) => {
    const label   = subtask.label ?? subtask
    const content = `${ac.selectedTask.icon} ${ac.selectedTask.label} — ${ac.selectedRoom.name}: ${label}`
    setAc(a => ({
      ...a,
      mode:           'composed',
      composedAction: {
        actionType:    'create_task',
        actionPayload: { roomId: a.selectedRoom.id, taskLabel: a.selectedTask.label, subtask: label },
      },
      query: '',
    }))
    setText(content)
  }

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed && !photoFile) return
    setSending(true)
    setError(null)
    try {
      let photoUrl = null
      if (photoFile) {
        const presign = await apiFetch('/api/photos/presign', {
          method: 'POST',
          body:   JSON.stringify({ roomId: ac.composedAction?.actionPayload?.roomId ?? 'chat', logType: 'chat', contentType: photoFile.type }),
        })
        await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': photoFile.type }, body: photoFile })
        photoUrl = presign.publicUrl
      }

      const payload = ac.mode === 'composed' && ac.composedAction
        ? { content: trimmed, contentType: 'action', ...ac.composedAction, photoUrl }
        : { content: trimmed, contentType: photoUrl ? 'photo' : 'text', photoUrl }

      await sendMessage(convId, payload)
      setText('')
      setPhotoFile(null)
      setPhotoPreview(null)
      resetAc()
      onSent?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    if (e.key === 'Escape') resetAc()
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Could add keyboard nav for dropdown — skip for now
    }
  }

  const acOpen = ac.mode !== 'idle' && ac.mode !== 'composed' && suggestions.length > 0

  return (
    <div className="chat-input-area">
      {/* Autocomplete dropdown */}
      {acOpen && (
        <div className="chat-ac-popup">
          {ac.mode === 'room' && (
            <div className="chat-ac-header">Select room for task</div>
          )}
          {ac.mode === 'task' && (
            <div className="chat-ac-header">
              <span className="chat-ac-crumb">{ac.selectedRoom?.name}</span>
              {' → '}Select task type
            </div>
          )}
          {ac.mode === 'subtask' && (
            <div className="chat-ac-header">
              <span className="chat-ac-crumb">{ac.selectedRoom?.name}</span>
              {' → '}
              <span className="chat-ac-crumb">{ac.selectedTask?.label}</span>
              {' → '}Select subtask
            </div>
          )}
          <div className="chat-ac-list">
            {suggestions.map((s, i) => (
              <button
                key={s.key ?? s.id ?? i}
                className="chat-ac-item"
                onMouseDown={(e) => {
                  e.preventDefault()
                  if (ac.mode === 'room')    pickRoom(s)
                  if (ac.mode === 'task')    pickTask(s)
                  if (ac.mode === 'subtask') pickSubtask(s)
                }}
              >
                {s.icon && <span className="chat-ac-icon">{s.icon}</span>}
                <span className="chat-ac-label">{s.label ?? s.name}</span>
                {ac.mode === 'room' && s.stage && (
                  <span className="chat-ac-meta">{s.stage}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Composed action badge */}
      {ac.mode === 'composed' && ac.composedAction && (
        <div className="chat-composed-badge">
          <span>📋 Task will be created on whiteboard</span>
          <button className="chat-composed-clear" onClick={resetAc}>✕</button>
        </div>
      )}

      {/* Photo preview */}
      {photoPreview && (
        <div className="chat-photo-preview-row">
          <img src={photoPreview} alt="preview" className="chat-photo-preview" />
          <button className="chat-photo-remove" onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}>✕</button>
        </div>
      )}

      {error && <p className="form-error" style={{ margin: '0 12px 4px' }}>{error}</p>}

      <div className="chat-input-row">
        <button
          className="chat-attach-btn"
          type="button"
          title="Attach photo"
          onClick={() => fileRef.current?.click()}
        >📷</button>
        <input
          ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0]
            if (!f) return
            setPhotoFile(f)
            setPhotoPreview(URL.createObjectURL(f))
          }}
        />
        <textarea
          className="chat-input"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKey}
          rows={1}
          placeholder={
            ac.mode === 'room'    ? 'Filter rooms…' :
            ac.mode === 'task'    ? 'Filter tasks…' :
            ac.mode === 'subtask' ? 'Filter subtasks…' :
            'Message or type a room name to log a task…'
          }
          disabled={sending}
          autoComplete="off"
        />
        <button
          className={`chat-send-btn ${(text.trim() || photoFile) ? 'active' : ''}`}
          onClick={handleSend}
          disabled={sending || (!text.trim() && !photoFile)}
        >
          {sending ? '…' : '↑'}
        </button>
      </div>
    </div>
  )
}

// ── Main ChatPanel ─────────────────────────────────────────────────────────
export default function ChatPanel({ open, onClose }) {
  const {
    conversations, messages, activeConvId, unread, loading, error,
    loadConversations, setActiveConv, loadMessages,
  } = useChatStore()
  const authUser = useFacilityStore(s => s.authUser)

  const bottomRef    = useRef(null)
  const [mobileChanOpen, setMobileChanOpen] = useState(false)

  useEffect(() => {
    if (open && conversations.length === 0) loadConversations()
  }, [open])

  useEffect(() => {
    // Scroll to bottom when new messages arrive or conv changes
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeConvId])

  const activeConv  = conversations.find(c => c.id === activeConvId)
  const activeMessages = messages[activeConvId] ?? []
  const globals     = conversations.filter(c => c.type === 'global')
  const roomChans   = conversations.filter(c => c.type === 'room_channel')

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0)

  return (
    <>
      <div className={`chat-backdrop ${open ? 'open' : ''}`} onClick={onClose} aria-hidden />

      <aside className={`chat-panel ${open ? 'open' : ''}`} aria-label="Team chat">
        {/* Header */}
        <div className="chat-header">
          <button className="chat-chan-toggle" onClick={() => setMobileChanOpen(o => !o)} aria-label="Channels">
            ☰
          </button>
          <span className="chat-header-title">
            {activeConv?.name ?? 'CHAT'}
          </span>
          {activeConv?.description && (
            <span className="chat-header-desc">{activeConv.description}</span>
          )}
          <button className="chat-close" onClick={onClose}>✕</button>
        </div>

        <div className="chat-body">
          {/* Channel sidebar (desktop always visible, mobile toggle) */}
          <div className={`chat-sidebar ${mobileChanOpen ? 'open' : ''}`}>
            <nav className="chat-chan-list">
              <div className="chat-chan-section-label">GLOBAL</div>
              {globals.map(conv => (
                <button
                  key={conv.id}
                  className={`chat-chan-item ${conv.id === activeConvId ? 'active' : ''}`}
                  onClick={() => { setActiveConv(conv.id); setMobileChanOpen(false) }}
                >
                  <span className="chat-chan-name">{conv.name}</span>
                  {(unread[conv.id] ?? 0) > 0 && (
                    <span className="chat-chan-badge">{unread[conv.id]}</span>
                  )}
                </button>
              ))}
              <div className="chat-chan-section-label">ROOMS</div>
              {roomChans.map(conv => (
                <button
                  key={conv.id}
                  className={`chat-chan-item ${conv.id === activeConvId ? 'active' : ''}`}
                  onClick={() => { setActiveConv(conv.id); setMobileChanOpen(false) }}
                >
                  <span className="chat-chan-name">{conv.name}</span>
                  {(unread[conv.id] ?? 0) > 0 && (
                    <span className="chat-chan-badge">{unread[conv.id]}</span>
                  )}
                </button>
              ))}
              {conversations.length === 0 && !loading && (
                <p className="chat-empty" style={{ padding: '12px', fontSize: '10px', color: error ? '#f87171' : undefined }}>
                  {error ? `Error: ${error}` : 'No channels loaded'}
                </p>
              )}
              {conversations.length === 0 && !loading && (
                <button
                  style={{ margin: '8px 12px', padding: '6px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 9, cursor: 'pointer', letterSpacing: 1 }}
                  onClick={loadConversations}
                >
                  RETRY
                </button>
              )}
            </nav>
          </div>

          {/* Message pane */}
          <div className="chat-main">
            <div className="chat-messages">
              {loading && activeMessages.length === 0 && (
                <p className="chat-empty">Loading…</p>
              )}
              {!loading && activeMessages.length === 0 && (
                <p className="chat-empty">No messages yet. Say hello!</p>
              )}
              {activeMessages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isOwn={msg.senderId === authUser?.id}
                />
              ))}
              <div ref={bottomRef} />
            </div>

            {activeConvId && (
              <ChatInput
                convId={activeConvId}
                authUser={authUser}
                onSent={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
              />
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
