import { useState } from 'react'
import { useFacilityStore } from '../store/facilityStore'
import useDraggable from '../hooks/useDraggable'

export default function BoardToolbox({ onOpen, panelRef, siblingRefs }) {
  const [collapsed, setCollapsed] = useState(false)

  const tasks      = useFacilityStore(s => s.tasks)
  const drawerOpen = useFacilityStore(s => s.drawerOpen)

  const { pos, onDragStart } = useDraggable(
    panelRef,
    () => ({ x: Math.max(0, window.innerWidth - 224), y: 80 }),
    'mtl-panel-board',
    siblingRefs,
  )

  const todoCount   = tasks.filter(t => t.status === 'todo').length
  const inProgCount = tasks.filter(t => t.status === 'in_progress').length
  const recentTasks = tasks.filter(t => t.status !== 'done').slice(0, 3)

  if (drawerOpen) return null

  return (
    <div
      ref={panelRef}
      className={`toolbox-panel${collapsed ? ' toolbox-panel--collapsed' : ''}`}
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="toolbox-panel-header" onMouseDown={onDragStart}>
        <span className="toolbox-panel-drag">⠿</span>
        <span className="toolbox-panel-icon">📋</span>
        <span className="toolbox-panel-title">BOARD</span>
        <button
          className="toolbox-panel-toggle"
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand board' : 'Collapse board'}
        >
          {collapsed ? '+' : '−'}
        </button>
      </div>

      {!collapsed && (
        <div className="toolbox-panel-body">
          <div className="toolbox-stats">
            <span className="toolbox-stat">
              <span className="toolbox-stat-dot" style={{ background: '#6b7280' }} />
              <span className="toolbox-stat-val">{todoCount}</span>
              <span className="toolbox-stat-lbl">TODO</span>
            </span>
            <span className="toolbox-stat">
              <span className="toolbox-stat-dot" style={{ background: '#f59e0b' }} />
              <span className="toolbox-stat-val">{inProgCount}</span>
              <span className="toolbox-stat-lbl">IN PROG</span>
            </span>
          </div>

          {recentTasks.length === 0 ? (
            <p className="toolbox-empty">No open tasks</p>
          ) : (
            <div className="toolbox-task-list">
              {recentTasks.map((t, i) => (
                <div key={t.id ?? i} className="toolbox-task-row">
                  <span
                    className="toolbox-task-dot"
                    style={{ background: t.status === 'in_progress' ? '#f59e0b' : '#6b7280' }}
                  />
                  <span className="toolbox-task-title">{t.title}</span>
                </div>
              ))}
            </div>
          )}

          <button className="toolbox-open-btn" onClick={onOpen} aria-label="Open full task board">
            Open Board ↗
          </button>
        </div>
      )}
    </div>
  )
}
