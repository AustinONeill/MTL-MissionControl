import { useEffect, useState } from 'react'
import { useUser, useStackApp } from '@stackframe/stack'
import IsometricMap from './components/IsometricMap'
import RoomDrawer from './components/RoomDrawer'
import LegendPanel, { SYMBOL_ITEMS } from './components/LegendPanel'
import WhiteboardPanel from './components/WhiteboardPanel'
import ChatPanel from './components/ChatPanel'
import ChatNotificationBanner from './components/ChatNotificationBanner'
import LandingPage from './components/LandingPage'
import HubPage from './components/HubPage'
import { useFacilityStore } from './store/facilityStore'
import { useChatStore } from './store/chatStore'
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
      <Header user={user} onWhiteboardOpen={() => setWhiteboardOpen(true)} onChatOpen={() => setChatOpen(true)} chatUnread={totalUnread} onGoToHub={handleGoToHub} />
      {stackInitError && (
        <div className="auth-warning">Auth disabled: {stackInitError}</div>
      )}
      {greeting && <WelcomeBanner name={greeting} onDismiss={() => setGreeting(null)} />}
      <main className="map-view">
        <IsometricMap />
      </main>
      <LegendPanel />
      <RoomDrawer />
      <WhiteboardPanel open={whiteboardOpen} onClose={() => setWhiteboardOpen(false)} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      <ChatNotificationBanner onOpenChat={() => setChatOpen(true)} />
      <LiveClock />

      {/* Mobile FAB */}
      <button
        className={`fab-toolbox${selectedFlagId ? ' fab-toolbox--cancel' : ''}`}
        onClick={() => {
          if (selectedFlagId) { clearSelectedFlag(); return }
          setToolboxOpen(o => !o)
        }}
        aria-label={selectedFlagId ? 'Cancel overlay' : 'Open toolbox'}
      >
        {selectedFlagId ? '✕' : '+'}
      </button>

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
          {selectedFlagId ? 'TAP A ROOM TO PLACE' : 'SELECT OVERLAY'}
        </p>
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

function Header({ user, onWhiteboardOpen, onChatOpen, chatUnread, onGoToHub }) {
  const stackApp = useStackApp()
  const onlineStatus = localStorage.getItem('mtl-online-status') || 'auto'
  const statusClass = {
    auto:   'online',
    online: 'online',
    away:   'away',
    dnd:    'dnd',
  }[onlineStatus] ?? 'online'

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="topbar-home-btn"
          onClick={onGoToHub}
          aria-label="Return to Mission Control hub"
          title="Hub"
        >
          ⬡
        </button>
        <span className="topbar-wordmark">GARDENOPS</span>
        <span className="topbar-divider" />
        <span className="topbar-facility">MTL CANNABIS</span>
      </div>
      <div className="topbar-center">
        <span className="topbar-breadcrumb">ISOMETRIC FACILITY MAP</span>
      </div>
      <div className="topbar-right">
        {user ? (
          <>
            <span className="topbar-user" title={user.primaryEmail ?? ''}>
              {user.displayName ?? user.primaryEmail ?? 'Signed in'}
            </span>
            <button
              className="topbar-auth-btn"
              onClick={() => stackApp.signOut()}
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            className="topbar-auth-btn topbar-auth-btn--signin"
            onClick={() => stackApp.signInWithOAuth('microsoft')}
          >
            <MicrosoftIcon />
            Sign in with Microsoft
          </button>
        )}
        <button className="topbar-wb-btn" onClick={onWhiteboardOpen} aria-label="Open whiteboard">
          BOARD
        </button>
        <button className="topbar-chat-btn" onClick={onChatOpen} aria-label="Open chat">
          💬{chatUnread > 0 && <span className="topbar-chat-badge">{chatUnread > 99 ? '99+' : chatUnread}</span>}
        </button>
        <span className={`topbar-status-indicator ${statusClass}`} title={`Status: ${onlineStatus}`} />
        <span className="topbar-status-text">LIVE</span>
        <span className="topbar-time" id="clock" />
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
