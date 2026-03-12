import { useStackApp } from '@stackframe/stack'
import gardenopsLogo from '../assets/gardenops-logo.png'

function MicrosoftIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 21 21" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  )
}

const FEATURES = [
  {
    glyph: '⬡',
    label: 'Isometric Facility Map',
    desc: 'Real-time visual overview of every cultivation room — overlays, modes, and status at a glance.',
  },
  {
    glyph: '📋',
    label: 'Compliance Logging',
    desc: 'Spray logs, pot checks, filter changes, and net tracking with full timestamped audit trails.',
  },
  {
    glyph: '⚡',
    label: 'Live Sync',
    desc: 'WebSocket-powered updates across all team members — every change appears instantly facility-wide.',
  },
  {
    glyph: '🔒',
    label: 'Role-Based Access',
    desc: 'Grower, Master Grower, and Director permission tiers enforced end-to-end.',
  },
]

export default function LandingPage() {
  const stackApp = useStackApp()

  const handleSignIn = () => stackApp.signInWithOAuth('microsoft')

  return (
    <div className="lp-shell" role="main">

      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="lp-nav" aria-label="Main navigation">
        <div className="lp-nav-logo">
          <img src={gardenopsLogo} alt="" aria-hidden="true" className="lp-nav-logo-img" />
          <span className="lp-nav-wordmark">GARDENOPS</span>
          <span className="lp-nav-divider" aria-hidden="true" />
          <span className="lp-nav-sub">MISSION CONTROL</span>
        </div>
        <div className="lp-nav-actions">
          <button
            className="lp-btn lp-btn--ghost"
            onClick={handleSignIn}
            aria-label="Sign in to Mission Control"
          >
            Sign In
          </button>
          <button
            className="lp-btn lp-btn--primary"
            onClick={handleSignIn}
            aria-label="Launch Mission Control — sign in to get started"
          >
            <MicrosoftIcon />
            Launch Mission Control
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="lp-hero" aria-labelledby="hero-headline">
        <div className="lp-hero-eyebrow">MTL CANNABIS — CULTIVATION PLATFORM</div>
        <h1 id="hero-headline" className="lp-hero-headline">
          MISSION<br />CONTROL
        </h1>
        <p className="lp-hero-desc">
          A centralized command center for your cultivation facility.
          Monitor every room, log compliance events, and coordinate
          your team — all in real time.
        </p>
        <div className="lp-hero-actions">
          <button
            className="lp-btn lp-btn--cta"
            onClick={handleSignIn}
            aria-label="Launch Mission Control — sign in with Microsoft to enter the dashboard"
          >
            <MicrosoftIcon />
            Sign In with Microsoft
          </button>
          <span className="lp-hero-note">Access is managed by your organization administrator.</span>
        </div>
        <div className="lp-hero-live" aria-label="Platform status: live">
          <span className="lp-live-dot" aria-hidden="true" />
          SYSTEM LIVE
        </div>
      </section>

      {/* ── Platform Overview ───────────────────────────────── */}
      <section className="lp-overview" aria-labelledby="overview-heading">
        <div className="lp-overview-inner">
          <h2 id="overview-heading" className="lp-section-title">WHAT IS MISSION CONTROL?</h2>
          <p className="lp-overview-body">
            Mission Control is the operational backbone of the MTL Cannabis cultivation facility.
            From an isometric real-time map of all grow rooms to detailed compliance logs and
            instant team messaging — it gives growers and directors a unified view of the
            entire operation.
          </p>

          <ul className="lp-features" role="list">
            {FEATURES.map(f => (
              <li key={f.label} className="lp-feature-card">
                <span className="lp-feature-glyph" aria-hidden="true">{f.glyph}</span>
                <div>
                  <div className="lp-feature-label">{f.label}</div>
                  <div className="lp-feature-desc">{f.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Secondary CTA ───────────────────────────────────── */}
      <section className="lp-cta-section" aria-label="Enter the platform">
        <h2 className="lp-cta-heading">READY TO ENTER?</h2>
        <p className="lp-cta-sub">Sign in with your Microsoft work account to access the dashboard.</p>
        <button
          className="lp-btn lp-btn--cta"
          onClick={handleSignIn}
          aria-label="Enter Mission Control dashboard"
        >
          <MicrosoftIcon />
          Enter Mission Control
        </button>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="lp-footer" role="contentinfo">
        <img src={gardenopsLogo} alt="" aria-hidden="true" className="lp-footer-logo-img" />
        <span>GARDENOPS — MTL CANNABIS</span>
        <span className="lp-footer-sep" aria-hidden="true">·</span>
        <span>Confidential — Authorized Access Only</span>
      </footer>

    </div>
  )
}
