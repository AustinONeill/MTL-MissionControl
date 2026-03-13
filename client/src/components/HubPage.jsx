import { useState, useEffect } from 'react'
import { useStackApp } from '@stackframe/stack'
import gardenopsLogo from '../assets/gardenops-logo.png'

const STATUS_OPTIONS = [
  { key: 'auto',   label: 'Auto',            dot: 'status-dot--auto',   desc: 'Follows system activity' },
  { key: 'online', label: 'Online',           dot: 'status-dot--online', desc: 'Always show as online' },
  { key: 'away',   label: 'Away',             dot: 'status-dot--away',   desc: 'Show as away' },
  { key: 'dnd',    label: 'Do Not Disturb',   dot: 'status-dot--dnd',    desc: 'Mute notifications' },
]

function useOnlineStatus() {
  const [status, setStatusState] = useState(
    () => localStorage.getItem('mtl-online-status') || 'auto'
  )
  const setStatus = (s) => {
    setStatusState(s)
    localStorage.setItem('mtl-online-status', s)
    // Broadcast to other tabs
    window.dispatchEvent(new StorageEvent('storage', { key: 'mtl-online-status', newValue: s }))
  }
  // Sync across tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'mtl-online-status' && e.newValue) setStatusState(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  return [status, setStatus]
}

function Avatar({ user, size = 64 }) {
  const [imgFailed, setImgFailed] = useState(false)
  const initials = (user.displayName || user.primaryEmail || '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  if (user.profileImageUrl && !imgFailed) {
    return (
      <img
        src={user.profileImageUrl}
        alt={`${user.displayName ?? 'User'} profile picture`}
        className="hub-avatar-img"
        style={{ width: size, height: size }}
        onError={() => setImgFailed(true)}
      />
    )
  }
  return (
    <div
      className="hub-avatar-initials"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
      aria-label={`${user.displayName ?? 'User'} avatar`}
    >
      {initials}
    </div>
  )
}

export default function HubPage({ user, onNavigate }) {
  const stackApp = useStackApp()
  const [onlineStatus, setOnlineStatus] = useOnlineStatus()
  const [statusOpen, setStatusOpen] = useState(false)
  const currentStatus = STATUS_OPTIONS.find(s => s.key === onlineStatus) ?? STATUS_OPTIONS[0]

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user.displayName?.split(' ')[0] ?? user.primaryEmail?.split('@')[0] ?? 'there'

  return (
    <div className="hub-shell" role="main">

      {/* ── Nav ─────────────────────────────────────────── */}
      <nav className="hub-nav" aria-label="Hub navigation">
        <div className="hub-nav-logo">
          <img src={gardenopsLogo} alt="" aria-hidden="true" className="hub-nav-logo-img" />
          <span className="hub-nav-wordmark">GARDENOPS</span>
          <span className="hub-nav-divider" aria-hidden="true" />
          <span className="hub-nav-sub">MISSION CONTROL</span>
        </div>
        <div className="hub-nav-right">
          <span className="hub-nav-user">{user.displayName ?? user.primaryEmail}</span>
          <button
            className="hub-nav-signout"
            onClick={() => stackApp.signOut()}
            aria-label="Sign out of Mission Control"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* ── Content ─────────────────────────────────────── */}
      <div className="hub-content">

        {/* Greeting */}
        <div className="hub-greeting">
          <span className="hub-greeting-eyebrow">MTL CANNABIS — FACILITY OPERATIONS</span>
          <h1 className="hub-greeting-headline">{greeting}, {firstName}.</h1>
          <p className="hub-greeting-sub">Where would you like to go?</p>
        </div>

        <div className="hub-grid">

          {/* ── Profile Card ──────────────────────────── */}
          <section className="hub-card hub-card--profile" aria-labelledby="profile-heading">
            <h2 id="profile-heading" className="hub-card-title">YOUR PROFILE</h2>

            <div className="hub-profile-body">
              <div className="hub-avatar-wrap">
                <Avatar user={user} size={72} />
                <div className={`hub-avatar-status-dot ${currentStatus.dot}`} aria-hidden="true" />
              </div>

              <div className="hub-profile-info">
                <div className="hub-profile-name">{user.displayName ?? '—'}</div>
              </div>
            </div>

            {/* Status selector */}
            <div className="hub-pref-row">
              <span className="hub-pref-label">ONLINE STATUS</span>
              <div className="hub-status-selector" style={{ position: 'relative' }}>
                <button
                  className="hub-status-btn"
                  onClick={() => setStatusOpen(o => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={statusOpen}
                  aria-label={`Current status: ${currentStatus.label}. Click to change.`}
                >
                  <span className={`hub-status-dot ${currentStatus.dot}`} aria-hidden="true" />
                  {currentStatus.label}
                  <span className="hub-status-chevron" aria-hidden="true">▾</span>
                </button>
                {statusOpen && (
                  <>
                    <div
                      className="hub-status-backdrop"
                      onClick={() => setStatusOpen(false)}
                      aria-hidden="true"
                    />
                    <ul
                      className="hub-status-menu"
                      role="listbox"
                      aria-label="Online status options"
                    >
                      {STATUS_OPTIONS.map(opt => (
                        <li
                          key={opt.key}
                          role="option"
                          aria-selected={opt.key === onlineStatus}
                          className={`hub-status-option${opt.key === onlineStatus ? ' hub-status-option--active' : ''}`}
                          onClick={() => { setOnlineStatus(opt.key); setStatusOpen(false) }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setOnlineStatus(opt.key); setStatusOpen(false) }}}
                          tabIndex={0}
                        >
                          <span className={`hub-status-dot ${opt.dot}`} aria-hidden="true" />
                          <div>
                            <div className="hub-status-option-label">{opt.label}</div>
                            <div className="hub-status-option-desc">{opt.desc}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>

            {/* Profile picture note */}
            <div className="hub-pref-note">
              Profile picture syncs from your Microsoft account.
            </div>
          </section>

          {/* ── Quick Launch ──────────────────────────── */}
          <section className="hub-card hub-card--launch" aria-labelledby="launch-heading">
            <h2 id="launch-heading" className="hub-card-title">QUICK LAUNCH</h2>

            <div className="hub-launch-grid">
              <button
                className="hub-launch-btn"
                onClick={() => onNavigate('map')}
                aria-label="Open the isometric facility map"
              >
                <span className="hub-launch-glyph" aria-hidden="true">⬡</span>
                <span className="hub-launch-label">Facility Map</span>
                <span className="hub-launch-desc">Isometric room overview & overlays</span>
              </button>

              <button
                className="hub-launch-btn"
                onClick={() => onNavigate('chat')}
                aria-label="Open team chat"
              >
                <span className="hub-launch-glyph" aria-hidden="true">💬</span>
                <span className="hub-launch-label">Team Chat</span>
                <span className="hub-launch-desc">Messaging & facility updates</span>
              </button>

              <button
                className="hub-launch-btn"
                onClick={() => onNavigate('tasks')}
                aria-label="Open the task board"
              >
                <span className="hub-launch-glyph" aria-hidden="true">📋</span>
                <span className="hub-launch-label">Task Board</span>
                <span className="hub-launch-desc">Active tasks & assignments</span>
              </button>
            </div>
          </section>

        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="hub-footer" role="contentinfo">
        <img src={gardenopsLogo} alt="" aria-hidden="true" className="hub-footer-logo-img" />
        GARDENOPS — MTL CANNABIS · Confidential
      </footer>

    </div>
  )
}
