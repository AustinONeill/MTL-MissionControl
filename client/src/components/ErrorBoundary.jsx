import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null, info: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    console.error('[MTL ErrorBoundary]', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    const { error, info } = this.state
    return (
      <div style={styles.container}>
        <h1 style={styles.heading}>Something went wrong</h1>
        <div style={styles.section}>
          <h2 style={styles.subheading}>Error</h2>
          <pre style={styles.pre}>{error.toString()}</pre>
        </div>
        {error.stack && (
          <div style={styles.section}>
            <h2 style={styles.subheading}>Stack Trace</h2>
            <pre style={styles.pre}>{error.stack}</pre>
          </div>
        )}
        {info?.componentStack && (
          <div style={styles.section}>
            <h2 style={styles.subheading}>Component Stack</h2>
            <pre style={styles.pre}>{info.componentStack}</pre>
          </div>
        )}
        <button
          style={styles.button}
          onClick={() => {
            this.setState({ error: null, info: null })
          }}
        >
          Try Again
        </button>
        <button
          style={{ ...styles.button, marginLeft: 8, background: '#555' }}
          onClick={() => {
            sessionStorage.clear()
            localStorage.clear()
            document.cookie.split(';').forEach(c => {
              document.cookie = c.trim().split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'
            })
            window.location.reload()
          }}
        >
          Clear Auth & Reload
        </button>
      </div>
    )
  }
}

const styles = {
  container: {
    position: 'fixed', inset: 0, zIndex: 99999,
    background: '#0d0d14', color: '#e0e0e0',
    padding: 32, overflow: 'auto', fontFamily: 'monospace',
  },
  heading: {
    color: '#ff4d4d', margin: '0 0 16px', fontSize: 22,
  },
  subheading: {
    color: '#ffaa33', margin: '0 0 8px', fontSize: 14, textTransform: 'uppercase',
  },
  section: {
    margin: '0 0 20px', padding: 12,
    background: '#14141e', borderRadius: 6, border: '1px solid #2a2a3a',
  },
  pre: {
    margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    fontSize: 12, lineHeight: 1.6, color: '#ccc',
  },
  button: {
    padding: '10px 20px', fontSize: 14,
    background: '#ff4d4d', color: '#fff', border: 'none',
    borderRadius: 6, cursor: 'pointer', fontFamily: 'monospace',
  },
}
