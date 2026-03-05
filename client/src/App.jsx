import IsometricMap from './components/IsometricMap'
import RoomDrawer from './components/RoomDrawer'
import LegendPanel from './components/LegendPanel'
import './App.css'

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <main className="map-view">
        <IsometricMap />
      </main>
      <LegendPanel />
      <RoomDrawer />
      <LiveClock />
    </div>
  )
}

function Header() {
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
        <span className="topbar-status-indicator online" />
        <span className="topbar-status-text">LIVE</span>
        <span className="topbar-time" id="clock" />
      </div>
    </header>
  )
}

function LiveClock() {
  const tick = () => {
    const el = document.getElementById('clock')
    if (el) el.textContent = new Date().toLocaleTimeString('en-CA', { hour12: false })
  }
  tick()
  setInterval(tick, 1000)
  return null
}
