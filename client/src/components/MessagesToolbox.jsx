import { useState } from 'react'
import { useFacilityStore } from '../store/facilityStore'
import { useChatStore } from '../store/chatStore'
import useDraggable from '../hooks/useDraggable'

export default function MessagesToolbox({ onOpen, unread, panelRef, siblingRefs }) {
  const [collapsed, setCollapsed] = useState(false)

  const drawerOpen  = useFacilityStore(s => s.drawerOpen)
  const allMessages = useChatStore(s => s.messages)

  const { pos, onDragStart } = useDraggable(
    panelRef,
    () => ({ x: Math.max(0, window.innerWidth - 224), y: 260 }),
    'mtl-panel-messages',
    siblingRefs,
  )

  const recentMsgs = Object.values(allMessages)
    .flat()
    .filter(m => m?.content)
    .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
    .slice(0, 3)

  if (drawerOpen) return null

  return (
    <div
      ref={panelRef}
      className={`toolbox-panel${collapsed ? ' toolbox-panel--collapsed' : ''}`}
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="toolbox-panel-header" onMouseDown={onDragStart}>
        <span className="toolbox-panel-drag">⠿</span>
        <span className="toolbox-panel-icon">💬</span>
        <span className="toolbox-panel-title">MESSAGES</span>
        {unread > 0 && (
          <span className="toolbox-panel-badge">{unread > 9 ? '9+' : unread}</span>
        )}
        <button
          className="toolbox-panel-toggle"
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand messages' : 'Collapse messages'}
        >
          {collapsed ? '+' : '−'}
        </button>
      </div>

      {!collapsed && (
        <div className="toolbox-panel-body">
          {recentMsgs.length === 0 ? (
            <p className="toolbox-empty">No recent messages</p>
          ) : (
            <div className="toolbox-msg-list">
              {recentMsgs.map((msg, i) => (
                <div key={msg.id ?? i} className="toolbox-msg-row">
                  <span className="toolbox-msg-sender">
                    {msg.senderName ?? msg.authorName ?? 'User'}
                  </span>
                  <span className="toolbox-msg-content">
                    {msg.content.length > 52 ? msg.content.slice(0, 52) + '…' : msg.content}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button className="toolbox-open-btn" onClick={onOpen} aria-label="Open full chat">
            Open Chat ↗
          </button>
        </div>
      )}
    </div>
  )
}
