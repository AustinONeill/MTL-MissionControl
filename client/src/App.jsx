import { useEffect, useState, useRef } from 'react'
import { useUser, useStackApp } from '@stackframe/stack'
import gardenopsLogo from './assets/gardenops-logo.png'
import IsometricMap from './components/IsometricMap'
import RoomDrawer from './components/RoomDrawer'
import ToolboxPanel from './components/ToolboxPanel'
import { SYMBOL_ITEMS } from './data/overlaySymbols'
import WhiteboardPanel from './components/WhiteboardPanel'
import ChatPanel from './components/ChatPanel'
import ChatNotificationBanner from './components/ChatNotificationBanner'
import LandingPage from './components/LandingPage'
import HubPage from './components/HubPage'
import { useFacilityStore } from './store/facilityStore'
import { useChatStore } from './store/chatStore'
import useSwipeGestures from './hooks/useSwipeGestures'
import { stackInitError } from './stack'
import { setAuthToken } from './lib/apiFetch'
import './App.css'

export default function App() {
  const stackApp        = useStackApp()
  const user            = useUser({ or: 'return-null' })
  const setAuthUser     = useFacilityStore(s => s.setAuthUser)
  const loadRooms       = useFacilityStore(s => s.loadRooms)
  const drawerOpen      = useFacilityStore(s => s.drawerOpen)
  const selectedFlagId  = useFacilityStore(s => s.selectedFlagId)
  const selectFlag      = useFacilityStore(s => s.selectFlag)
  const clearSelectedFlag = useFacilityStore(s => s.clearSelectedFlag)
  const [greeting, setGreeting]               = useState(null)
  const [processingCallback, setProcessingCallback] = useState(false)
  const [toolboxOpen, setToolboxOpen]         = useState(false)
  const [whiteboardOpen, setWhiteboardOpen]   = useState(false)
  const [chatOpen, setChatOpen]               = useState(false)
  // Hub navigation — default to hub for fresh sign-ins, map for page refreshes
  const [currentSection, setCurrentSection]   = useState(
    () => sessionStorage.getItem('mtl-section') === 'map' ? 'map' : 'hub'
  )
  const totalUnread = useChatStore(s => Object.values(s.unread).reduce((a, b) => a + b, 0))

  useSwipeGestures({ chatOpen, setChatOpen, whiteboardOpen, setWhiteboardOpen })

  // ── Theme system ─────────────────────────────────────────────
  const [theme, setTheme] = useState(() => localStorage.getItem('mtl-theme') || 'night-mode')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('mtl-theme', theme)
  }, [theme])

  // ── Map view mode (lifted so mobile sheet can toggle it too) ──
  const [mapView, setMapView] = useState(() => localStorage.getItem('mapViewPreference') || '2D')
  const toggleMapView = () => {
    const next = mapView === '2D' ? '3D' : '2D'
    setMapView(next)
    localStorage.setItem('mapViewPreference', next)
    window.dispatchEvent(new CustomEvent('mapViewChange', { detail: { mode: next } }))
  }

  useEffect(() => {
    if (stackInitError) {
      console.warn('[MTL] Stack Auth not available:', stackInitError)
      return
    }
    const params = new URLSearchParams(window.location.search)
    if (params.has('code') && params.has('state')) {
      setProcessingCallback(true)
      console.log('[MTL] OAuth callback detected, processing...')
      stackApp.callOAuthCallback()
        .then((redirected) => {
          console.log('[MTL] OAuth callback result:', redirected)
          if (!redirected) {
            window.history.replaceState({}, '', '/')
            setProcessingCallback(false)
          }
        })
        .catch((err) => {
          console.error('[MTL] OAuth callback failed:', err)
          window.history.replaceState({}, '', '/')
          setProcessingCallback(false)
        })
    }
  }, [stackApp])

  useEffect(() => {
    console.log('[MTL] user effect fired, user:', user ? `id=${user.id} email=${user.primaryEmail}` : 'null')
    if (user) {
      user.getAuthJson().then((authJson) => {
        console.log('[MTL] getAuthJson result:', {
          hasAccessToken: !!authJson.accessToken,
          tokenLength: authJson.accessToken?.length,
          tokenPrefix: authJson.accessToken?.substring(0, 20),
          keys: Object.keys(authJson),
        })
        const { accessToken } = authJson
        if (accessToken) {
          setAuthToken(accessToken)
          localStorage.setItem('stack-auth-token', accessToken)
          // Load rooms only after token is primed — avoids race condition
          loadRooms()
        } else {
          console.error('[MTL] getAuthJson returned NO accessToken — auth will fail')
        }
      }).catch((e) => console.error('[MTL] getAuthJson failed:', e))

      const name = user.displayName ?? user.primaryEmail ?? 'there'
      setAuthUser({ name, email: user.primaryEmail ?? '' })

      const key = `greeted-${user.id}`
      if (!sessionStorage.getItem(key)) {
        setGreeting(name)
        sessionStorage.setItem(key, '1')
        setTimeout(() => setGreeting(null), 5000)
      }
    } else {
      setAuthToken(null)
      localStorage.removeItem('stack-auth-token')
      setAuthUser(null)
    }
  }, [user, setAuthUser])

  // Auto-close toolbox when room drawer opens
  useEffect(() => {
    if (drawerOpen) setToolboxOpen(false)
  }, [drawerOpen])

  // Reset hub state on sign-out
  useEffect(() => {
    if (!user && user !== undefined) {
      sessionStorage.removeItem('mtl-section')
      setCurrentSection('hub')
    }
  }, [user])

  const handleNavigate = (dest) => {
    sessionStorage.setItem('mtl-section', 'map')
    setCurrentSection('map')
    if (dest === 'chat')  setTimeout(() => setChatOpen(true), 50)
    if (dest === 'tasks') setTimeout(() => setWhiteboardOpen(true), 50)
  }

  const handleGoToHub = () => {
    sessionStorage.setItem('mtl-section', 'hub')
    setCurrentSection('hub')
    setChatOpen(false)
    setWhiteboardOpen(false)
  }

  if (processingCallback) {
    return (
      <div className="app-shell">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '2px' }}>
          SIGNING IN...
        </div>
      </div>
    )
  }

  // Auth state loading — avoid flash of landing page for returning users
  if (user === undefined) {
    return (
      <div className="app-shell">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '3px' }}>
          LOADING...
        </div>
      </div>
    )
  }

  // Not authenticated — show landing page
  if (!user) {
    return <LandingPage />
  }

  // Authenticated — hub launchpad
  if (currentSection === 'hub') {
    return <HubPage user={user} onNavigate={handleNavigate} />
  }

  return (
    <div className="app-shell">
      <Header user={user} onGoToHub={handleGoToHub} theme={theme} onThemeChange={setTheme} mapView={mapView} onToggleView={toggleMapView} />
      {stackInitError && (
        <div className="auth-warning">Auth disabled: {stackInitError}</div>
      )}
      {greeting && <WelcomeBanner name={greeting} onDismiss={() => setGreeting(null)} />}
      <main className="map-view">
        <IsometricMap />
      </main>
      <ToolboxPanel onOpenBoard={() => setWhiteboardOpen(true)} onOpenMessages={() => setChatOpen(true)} unread={totalUnread} />
      <RoomDrawer />
      <WhiteboardPanel open={whiteboardOpen} onClose={() => setWhiteboardOpen(false)} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      <ChatNotificationBanner onOpenChat={() => setChatOpen(true)} />
      <LiveClock />

      {/* Mobile swipe handles — safe touch targets on the right edge */}
      <button
        className={`swipe-handle swipe-handle--chat${chatOpen ? ' swipe-handle--open' : ''}`}
        onClick={() => setChatOpen(o => !o)}
        aria-label={chatOpen ? 'Close chat' : 'Open chat'}
      >
        <span className="swipe-handle-chevron">{chatOpen ? '›' : '‹'}</span>
        <span className="swipe-handle-label">CHAT</span>
      </button>
      <button
        className={`swipe-handle swipe-handle--tasks${whiteboardOpen ? ' swipe-handle--open' : ''}`}
        onClick={() => setWhiteboardOpen(o => !o)}
        aria-label={whiteboardOpen ? 'Close tasks' : 'Open tasks'}
      >
        <span className="swipe-handle-chevron">{whiteboardOpen ? '›' : '‹'}</span>
        <span className="swipe-handle-label">TASKS</span>
      </button>

      {/* Mobile FAB group */}
      {!chatOpen && (selectedFlagId ? (
        <button className="fab-toolbox fab-toolbox--cancel" onClick={clearSelectedFlag} aria-label="Cancel overlay">✕</button>
      ) : (
        <div className="fab-group">
          <button className="fab-action" onClick={() => setWhiteboardOpen(true)} aria-label="Open task board">
            📋
            <span className="fab-action-label">BOARD</span>
          </button>
          <button className="fab-action" onClick={() => setChatOpen(true)} aria-label="Open team chat">
            💬
            {totalUnread > 0 && <span className="fab-action-badge">{totalUnread > 9 ? '9+' : totalUnread}</span>}
            <span className="fab-action-label">MSGS</span>
          </button>
          <button className="fab-toolbox" onClick={() => setToolboxOpen(o => !o)} aria-label="Open overlay toolbox">+</button>
        </div>
      ))}

      {/* Mobile Toolbox Bottom Sheet */}
      {toolboxOpen && (
        <div
          className="mobile-toolbox-sheet-backdrop"
          onClick={() => setToolboxOpen(false)}
        />
      )}
      <div className={`mobile-toolbox-sheet${toolboxOpen ? ' open' : ''}`}>
        <div className="mobile-toolbox-sheet-handle" />
        <p className="mobile-toolbox-title">
          {selectedFlagId ? 'TAP A ROOM TO PLACE' : 'TOOLBOX'}
        </p>

        {/* ── Quick Access row (hidden while placing an overlay) ── */}
        {!selectedFlagId && (
          <>
            <p className="mobile-sheet-section-label">QUICK ACCESS</p>
            <div className="mobile-quick-row">
              <button
                className={`mobile-quick-btn${mapView === '3D' ? ' mobile-quick-btn--active' : ''}`}
                onClick={() => { toggleMapView(); setToolboxOpen(false) }}
                aria-label={`Switch to ${mapView === '2D' ? '3D' : '2D'} map view`}
              >
                <span className="mobile-quick-icon mobile-quick-view">{mapView}</span>
                <span className="mobile-quick-label">MAP VIEW</span>
              </button>
              <button
                className="mobile-quick-btn"
                onClick={() => {
                  const themes = ['night-mode', 'gas-n-up', 'frostd-flakes', 'bright-mode']
                  setTheme(themes[(themes.indexOf(theme) + 1) % themes.length])
                }}
                aria-label="Cycle to next theme"
              >
                <span className="mobile-quick-icon">◐</span>
                <span className="mobile-quick-label">THEME</span>
              </button>
            </div>
            <p className="mobile-sheet-section-label">OVERLAYS</p>
          </>
        )}

        <div className="mobile-toolbox-grid">
          {SYMBOL_ITEMS.map(item => (
            <button
              key={item.key}
              className={`mobile-toolbox-item${selectedFlagId === item.key ? ' mobile-toolbox-item--active' : ''}`}
              onClick={() => {
                selectFlag(item.key)
                setToolboxOpen(false)
              }}
            >
              <span className="mobile-toolbox-glyph">{item.glyph}</span>
              <span className="mobile-toolbox-label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function WelcomeBanner({ name, onDismiss }) {
  const hour = new Date().getHours()
  const timeOfDay = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="welcome-banner" role="status">
      <span className="welcome-icon">⬡</span>
      <span className="welcome-text">
        {timeOfDay}, <strong>{name}</strong> — MTL Mission Control is ready.
      </span>
      <button className="welcome-dismiss" onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  )
}

const THEMES = [
  { id: 'night-mode',    label: 'Night Mode',     dot: '#4ade80' },
  { id: 'gas-n-up',      label: 'Gas-N-Up',       dot: '#f97316' },
  { id: 'frostd-flakes', label: "Frost'd Flakes", dot: '#0ea5e9' },
  { id: 'bright-mode',   label: 'Bright Mode',    dot: '#16a34a' },
]

function Header({ user, onGoToHub, theme, onThemeChange, mapView, onToggleView }) {
  const stackApp   = useStackApp()
  const rooms      = useFacilityStore(s => s.rooms)
  const selectRoom = useFacilityStore(s => s.selectRoom)

  const onlineStatus = localStorage.getItem('mtl-online-status') || 'auto'
  const statusClass  = { auto: 'online', online: 'online', away: 'away', dnd: 'dnd' }[onlineStatus] ?? 'online'

  const [searchOpen,  setSearchOpen]  = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [themeOpen,   setThemeOpen]   = useState(false)
  const [avatarOpen,  setAvatarOpen]  = useState(false)

  const searchRef = useRef(null)

  const filteredRooms = searchQuery.trim().length > 1
    ? rooms.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 6)
    : []

  const userInitial = (user?.displayName ?? user?.primaryEmail ?? 'U').charAt(0).toUpperCase()

  // Close dropdowns when clicking outside their containers
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.topbar-theme-wrap'))  setThemeOpen(false)
      if (!e.target.closest('.topbar-avatar-wrap')) setAvatarOpen(false)
      if (!e.target.closest('.topbar-search-wrap')) { setSearchOpen(false); setSearchQuery('') }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="topbar">
      {/* ── Left: brand ───────────────────────────────────── */}
      <div className="topbar-left">
        <button
          className="topbar-home-btn"
          onClick={onGoToHub}
          aria-label="Return to Mission Control hub"
          title="Hub"
        >
          <img src={gardenopsLogo} alt="GardenOps" className="topbar-logo-img topbar-logo-ring" />
        </button>
        <span className="topbar-wordmark">GARDENOPS</span>
        <span className="topbar-divider" />
        <span className="topbar-facility">MTL CANNABIS</span>
        <span className="topbar-tagline">Cultivate with Confidence</span>
      </div>

      {/* ── Center: search + controls ─────────────────────── */}
      <div className="topbar-center">
        {/* Quick room search */}
        <div className={`topbar-search-wrap${searchOpen ? ' open' : ''}`}>
          {searchOpen ? (
            <input
              ref={searchRef}
              className="topbar-search-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Room name or area…"
              autoComplete="off"
              aria-label="Search rooms and areas"
            />
          ) : (
            <button
              className="topbar-search-trigger"
              onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 40) }}
              aria-label="Search rooms and areas"
            >
              <span className="topbar-search-icon">⌕</span>
              <span className="topbar-search-placeholder">Search rooms…</span>
            </button>
          )}
          {filteredRooms.length > 0 && (
            <div className="topbar-search-results" role="listbox">
              {filteredRooms.map(r => (
                <button
                  key={r.id}
                  className="topbar-search-result"
                  role="option"
                  onClick={() => { selectRoom(r.id); setSearchOpen(false); setSearchQuery('') }}
                >
                  <span className="tsr-type">{(r.type ?? 'ROOM').toUpperCase()}</span>
                  <span className="tsr-name">{r.name}</span>
                  <span className={`tsr-mode tsr-mode--${r.mode}`}>{r.mode}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2D / 3D map view toggle */}
        <button
          className={`topbar-view-toggle${mapView === '3D' ? ' active' : ''}`}
          onClick={onToggleView}
          aria-label={`Switch to ${mapView === '2D' ? '3D' : '2D'} view`}
          title={`Map view: ${mapView} — click to toggle`}
        >
          <span className="tvt-label" style={{ color: mapView === '2D' ? 'var(--accent)' : 'var(--text-dim)' }}>2D</span>
          <span className="tvt-sep">/</span>
          <span className="tvt-label" style={{ color: mapView === '3D' ? 'var(--accent)' : 'var(--text-dim)' }}>3D</span>
        </button>

        {/* Theme switcher */}
        <div className="topbar-theme-wrap">
          <button
            className={`topbar-icon-action${themeOpen ? ' active' : ''}`}
            onClick={() => setThemeOpen(o => !o)}
            aria-label="Change interface theme"
            title="Switch theme"
          >
            ◐
          </button>
          {themeOpen && (
            <div className="topbar-dropdown topbar-theme-menu" role="menu">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  className={`topbar-dropdown-item${theme === t.id ? ' selected' : ''}`}
                  role="menuitem"
                  onClick={() => { onThemeChange(t.id); setThemeOpen(false) }}
                >
                  <span className="theme-dot" style={{ background: t.dot }} />
                  {t.label}
                  {theme === t.id && <span className="theme-check">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: status + actions + avatar ─────────────── */}
      <div className="topbar-right">
        <span className={`topbar-status-indicator ${statusClass}`} title={`Status: ${onlineStatus}`} />
        <span className="topbar-status-text">LIVE</span>
        <span className="topbar-time" id="clock" />


        {user ? (
          <div className="topbar-avatar-wrap">
            <button
              className="topbar-avatar-btn"
              onClick={() => setAvatarOpen(o => !o)}
              aria-label="Open user menu"
              title={user.primaryEmail ?? ''}
            >
              <span className="topbar-avatar-initial">{userInitial}</span>
            </button>
            {avatarOpen && (
              <div className="topbar-dropdown topbar-avatar-menu" role="menu">
                <div className="topbar-dropdown-header">
                  <span className="tada-name">{user.displayName ?? 'User'}</span>
                  <span className="tada-email">{user.primaryEmail ?? ''}</span>
                </div>
                <div className="topbar-dropdown-divider" />
                <button className="topbar-dropdown-item" role="menuitem" onClick={() => setAvatarOpen(false)}>Profile</button>
                <button className="topbar-dropdown-item" role="menuitem" onClick={() => setAvatarOpen(false)}>Settings</button>
                <div className="topbar-dropdown-divider" />
                <button
                  className="topbar-dropdown-item topbar-dropdown-item--danger"
                  role="menuitem"
                  onClick={() => { setAvatarOpen(false); stackApp.signOut() }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            className="topbar-auth-btn topbar-auth-btn--signin"
            onClick={() => stackApp.signInWithOAuth('microsoft')}
          >
            <MicrosoftIcon />
            Sign in with Microsoft
          </button>
        )}
      </div>
    </header>
  )
}

function MicrosoftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 21 21" style={{ flexShrink: 0 }}>
      <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  )
}

function LiveClock() {
  useEffect(() => {
    const tick = () => {
      const el = document.getElementById('clock')
      if (el) el.textContent = new Date().toLocaleTimeString('en-CA', { hour12: false })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return null
}
