import { useEffect, useState } from 'react'
import { useUser, useStackApp } from '@stackframe/stack'
import IsometricMap from './components/IsometricMap'
import RoomDrawer from './components/RoomDrawer'
import LegendPanel from './components/LegendPanel'
import { useFacilityStore } from './store/facilityStore'
import { stackInitError } from './stack'
import './App.css'

export default function App() {
  const user        = useUser({ or: 'return-null' })
  const setAuthUser = useFacilityStore(s => s.setAuthUser)
  const [greeting, setGreeting] = useState(null)

  useEffect(() => {
    if (stackInitError) {
      console.warn('[MTL] Stack Auth not available:', stackInitError)
    }
  }, [])

  useEffect(() => {
    if (user) {
      user.getAuthJson().then(({ accessToken }) => {
        if (accessToken) localStorage.setItem('stack-auth-token', accessToken)
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
      localStorage.removeItem('stack-auth-token')
      setAuthUser(null)
    }
  }, [user, setAuthUser])

  return (
    <div className="app-shell">
      <Header user={user} />
      {stackInitError && (
        <div className="auth-warning">Auth disabled: {stackInitError}</div>
      )}
      {greeting && <WelcomeBanner name={greeting} onDismiss={() => setGreeting(null)} />}
      <main className="map-view">
        <IsometricMap />
      </main>
      <LegendPanel />
      <RoomDrawer />
      <LiveClock />
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

function Header({ user }) {
  const stackApp = useStackApp()

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-logo">⬡</span>
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
        <span className="topbar-status-indicator online" />
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
