import React from 'react'
import Logo from './Logo'

/**
 * ErrorBoundary
 *
 * Catches JavaScript runtime errors anywhere in child component tree,
 * logs them, and displays a graceful, premium fallback UI instead of
 * leaving the user with a blank black screen.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught runtime error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleClearCacheAndReload = () => {
    try {
      localStorage.clear()
      sessionStorage.clear()
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name))
        })
      }
    } catch (e) {
      console.warn('Failed clearing cache:', e)
    }
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      const isWebGLError =
        this.state.error?.message?.toLowerCase().includes('webgl') ||
        this.state.error?.message?.toLowerCase().includes('canvas') ||
        this.state.error?.message?.toLowerCase().includes('gl context')

      return (
        <div style={styles.container}>
          <div className="error-bg-glow" style={styles.bgGlow} />
          <Logo size="lg" withTagline style={{ marginBottom: 24, zIndex: 1 }} />

          <div style={styles.card}>
            <div style={styles.iconCircle}>
              {isWebGLError ? '🗺️' : '⚠️'}
            </div>

            <h2 style={styles.heading}>
              {isWebGLError ? 'Graphics Acceleration Required' : 'Something went wrong'}
            </h2>

            <p style={styles.message}>
              {isWebGLError
                ? 'Your browser or device does not currently support WebGL graphics acceleration. Please ensure hardware acceleration is enabled in your browser settings.'
                : (this.state.error?.message || 'An unexpected application error occurred.')}
            </p>

            <div style={styles.actions}>
              <button
                onClick={this.handleReload}
                style={styles.primaryBtn}
              >
                🔄 Reload App
              </button>

              <button
                onClick={this.handleClearCacheAndReload}
                style={styles.secondaryBtn}
              >
                🧹 Clear Cache & Reset
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

const styles = {
  container: {
    minHeight: '100dvh',
    background: '#080810',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: 'Inter, sans-serif',
    color: '#e2e8f0',
  },
  bgGlow: {
    position: 'absolute',
    width: '350px',
    height: '350px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, rgba(8, 8, 16, 0) 70%)',
    top: '30%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  },
  card: {
    padding: '32px 24px',
    width: '100%',
    maxWidth: 440,
    background: 'rgba(15, 15, 25, 0.85)',
    borderRadius: 20,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(20px)',
    textAlign: 'center',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    fontSize: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  heading: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 10,
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
  },
  message: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 1.6,
    marginBottom: 24,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    width: '100%',
  },
  primaryBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    boxShadow: '0 4px 16px rgba(139, 92, 246, 0.35)',
    transition: 'opacity 0.2s',
  },
  secondaryBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: 12,
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    transition: 'background 0.2s',
  },
}
