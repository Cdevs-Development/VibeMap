import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import Login from './pages/Login'
import Register from './pages/Register'
import MapScreen from './pages/MapScreen'
import AddBeneficiary from './pages/AddBeneficiary'
import ManageBeneficiaries from './pages/ManageBeneficiaries'
import SOSActive from './pages/SOSActive'
import FamilyMap from './pages/FamilyMap'
import ProfileScreen from './pages/ProfileScreen'
import ReportVibe from './pages/ReportVibe'
import VibeFeed from './pages/VibeFeed'
import SignUp from './pages/SignUp'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import { getCurrentUser, getSOSPinStatus } from './services/api'
import { getCache, setCache } from './services/cacheService'
import Logo from './components/Logo'
import NetworkStatusBanner from './components/NetworkStatusBanner'
import ErrorBoundary from './components/ErrorBoundary'
import InteractiveGuide from './components/InteractiveGuide'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import GlobalSOSAlertManager from './components/GlobalSOSAlertManager'
import FloatingJourneyOverlay from './components/FloatingJourneyOverlay'

function PrivateRoute({ children }) {
  const [status, setStatus] = useState('checking') // 'checking' | 'auth' | 'unauth' | 'slow_server'
  const [errorMessage, setErrorMessage] = useState('')
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    const token = localStorage.getItem('vibemap_token')
    if (!token) {
      setStatus('unauth')
      return
    }

    // Also background check SOS PIN status
    getSOSPinStatus().catch(() => {})

    // Fast path: If we have a cached user profile from a previous session, authenticate immediately!
    const cachedUser = getCache('current_user')
    if (cachedUser) {
      setStatus('auth')
      // Background revalidation
      getCurrentUser()
        .then((res) => {
          if (res.data) setCache('current_user', res.data)
        })
        .catch((err) => {
          if (err.response && (err.response.status === 401 || err.response.status === 403)) {
            localStorage.removeItem('vibemap_token')
            localStorage.removeItem('vibemap_has_sos_pin')
            if (isMounted.current) setStatus('unauth')
          }
        })
      return
    }

    // Timer to alert the user if server is cold-starting (Render free tier wake-up)
    const slowTimer = setTimeout(() => {
      if (isMounted.current && status === 'checking') {
        setStatus('slow_server')
      }
    }, 2500)

    // Verify token with backend
    getCurrentUser()
      .then((res) => {
        clearTimeout(slowTimer)
        if (res.data) setCache('current_user', res.data)
        if (isMounted.current) setStatus('auth')
      })
      .catch((err) => {
        clearTimeout(slowTimer)
        console.warn('[Auth] Auth verification failed:', err)
        // If 401/403, the token is definitely invalid
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          localStorage.removeItem('vibemap_token')
          localStorage.removeItem('vibemap_has_sos_pin')
          if (isMounted.current) setStatus('unauth')
        } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
          // If offline, let the user proceed to cached map
          if (isMounted.current) setStatus('auth')
        } else {
          // Network issue or cold start timeout
          if (isMounted.current) {
            setErrorMessage(err.message || 'Connecting to server...')
            setStatus('slow_server')
          }
        }
      })

    return () => {
      isMounted.current = false
      clearTimeout(slowTimer)
    }
  }, [])

  if (status === 'checking') {
    return (
      <div style={loadingStyles.container}>
        <style>{`
          @keyframes pulseBar {
            0%, 100% { transform: scaleX(0.3); opacity: 0.5; }
            50% { transform: scaleX(1); opacity: 1; }
          }
        `}</style>
        <Logo size="lg" withTagline animated />
        <div style={loadingStyles.progressBarWrapper}>
          <div style={loadingStyles.progressBar} />
        </div>
      </div>
    )
  }

  if (status === 'slow_server') {
    return (
      <div style={loadingStyles.container}>
        <Logo size="lg" withTagline style={{ marginBottom: 20 }} />
        <div style={loadingStyles.slowCard}>
          <span style={{ fontSize: 28, marginBottom: 8, display: 'block' }}>⚡</span>
          <h3 style={loadingStyles.slowTitle}>Connecting to Server...</h3>
          <p style={loadingStyles.slowDesc}>
            The server may be waking up from sleep. This usually takes a few moments.
          </p>
          <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 14 }}>
            <button
              onClick={() => window.location.reload()}
              style={loadingStyles.retryBtn}
            >
              🔄 Retry
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('vibemap_token')
                localStorage.removeItem('vibemap_has_sos_pin')
                setStatus('unauth')
              }}
              style={loadingStyles.loginBtn}
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return status === 'auth' ? children : <Navigate to="/login" />
}

function RequireSOSPin({ children }) {
  const token = localStorage.getItem('vibemap_token')
  const hasPin = localStorage.getItem('vibemap_has_sos_pin')
  const location = useLocation()

  // If user is authenticated and explicitly does not have an SOS PIN set, lock navigation to /profile
  if (token && hasPin === 'false' && location.pathname !== '/profile') {
    return <Navigate to="/profile?pin_required=true" replace />
  }

  return children
}

function OnboardingRoute() {
  const navigate = useNavigate()
  const handleNext = () => {
    const hasPin = localStorage.getItem('vibemap_has_sos_pin')
    if (hasPin === 'false') {
      navigate('/profile?pin_required=true')
    } else {
      navigate('/map')
    }
  }
  return <AddBeneficiary onNext={handleNext} onBack={() => navigate('/login')} />
}

function BeneficiariesRoute() {
  const navigate = useNavigate()
  return <ManageBeneficiaries onSave={() => navigate('/map')} onBack={() => navigate(-1)} />
}

function PublicRoute({ children }) {
  const token = localStorage.getItem('vibemap_token')
  const activeSosId = localStorage.getItem('vibemap_active_sos_id')
  const hasPin = localStorage.getItem('vibemap_has_sos_pin')
  if (token) {
    if (activeSosId) return <Navigate to="/sos" replace />
    if (hasPin === 'false') return <Navigate to="/profile?pin_required=true" replace />
    return <Navigate to="/map" replace />
  }
  return children
}

function RootRoute() {
  const activeSosId = localStorage.getItem('vibemap_active_sos_id')
  if (activeSosId) {
    return <Navigate to="/sos" replace />
  }
  const hasPin = localStorage.getItem('vibemap_has_sos_pin')
  if (hasPin === 'false') {
    return <Navigate to="/profile?pin_required=true" replace />
  }
  return <Navigate to="/map" replace />
}

function SOSDeepLinkHandler() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleDeepLink = (e) => {
      const { path, lat, lng } = e.detail || {}
      if (path) {
        navigate(path, { state: { lat, lng } })
      } else if (lat && lng) {
        navigate('/family', { state: { lat, lng } })
      }
    }

    window.addEventListener('vibemap-sos-deeplink', handleDeepLink)
    return () => window.removeEventListener('vibemap-sos-deeplink', handleDeepLink)
  }, [navigate])

  return null
}

function ActiveSOSRedirectHandler() {
  const navigate = useNavigate()
  const location = useLocation()
  const hasCheckedOnLaunch = useRef(false)

  useEffect(() => {
    if (hasCheckedOnLaunch.current) return
    hasCheckedOnLaunch.current = true

    const activeSosId = localStorage.getItem('vibemap_active_sos_id')
    const token = localStorage.getItem('vibemap_token')
    if (token && activeSosId && (location.pathname === '/' || location.pathname === '/map')) {
      console.log('[App] Active SOS session detected on app launch, restoring /sos screen...')
      navigate('/sos', { replace: true })
    }
  }, [location.pathname, navigate])

  return null
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <SOSDeepLinkHandler />
        <ActiveSOSRedirectHandler />
        <NetworkStatusBanner />
        <InteractiveGuide />
        <PWAInstallPrompt />
        <GlobalSOSAlertManager />
        <FloatingJourneyOverlay />
        <Routes>
          {/* Default redirect to active sos, map or login */}
          <Route path="/" element={<RootRoute />} />

          {/* Public routes — redirect to map if already logged in */}
          <Route path="/login" element={
            <PublicRoute><Login /></PublicRoute>
          } />
          <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />
          <Route path="/register" element={
            <PublicRoute><Register /></PublicRoute>
          } />

          {/* Info pages — always accessible */}
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />

          {/* Private routes — redirect to login if not authenticated & require SOS PIN */}
          <Route path="/map" element={
            <PrivateRoute><RequireSOSPin><MapScreen /></RequireSOSPin></PrivateRoute>
          } />
          <Route path="/onboarding" element={
            <PrivateRoute><OnboardingRoute /></PrivateRoute>
          } />
          <Route path="/beneficiaries" element={
            <PrivateRoute><RequireSOSPin><BeneficiariesRoute /></RequireSOSPin></PrivateRoute>
          } />
          <Route path="/sos" element={
            <PrivateRoute><RequireSOSPin><SOSActive /></RequireSOSPin></PrivateRoute>
          } />
          <Route path="/sos/track/:id" element={
            <PrivateRoute><RequireSOSPin><FamilyMap /></RequireSOSPin></PrivateRoute>
          } />
          <Route path="/family" element={
            <PrivateRoute><RequireSOSPin><FamilyMap /></RequireSOSPin></PrivateRoute>
          } />
          <Route path="/report-vibe" element={
            <PrivateRoute><RequireSOSPin><ReportVibe /></RequireSOSPin></PrivateRoute>
          } />
          <Route path="/vibes" element={
            <PrivateRoute><RequireSOSPin><VibeFeed /></RequireSOSPin></PrivateRoute>
          } />
          <Route path="/profile" element={
            <PrivateRoute><ProfileScreen /></PrivateRoute>
          } />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

const loadingStyles = {
  container: {
    width: '100vw',
    height: '100dvh',
    background: '#080810',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 20,
    padding: 20,
    fontFamily: 'Inter, sans-serif',
  },
  progressBarWrapper: {
    width: 140,
    height: 3,
    borderRadius: 2,
    background: 'rgba(139,92,246,0.2)',
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
    animation: 'pulseBar 1.5s ease-in-out infinite',
  },
  slowCard: {
    padding: '24px 20px',
    maxWidth: 360,
    width: '100%',
    background: 'rgba(15, 15, 25, 0.9)',
    borderRadius: 16,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    textAlign: 'center',
    backdropFilter: 'blur(16px)',
  },
  slowTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 700,
    margin: '0 0 6px 0',
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
  },
  slowDesc: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 1.4,
    margin: 0,
  },
  retryBtn: {
    flex: 1,
    padding: '10px',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
  },
  loginBtn: {
    flex: 1,
    padding: '10px',
    borderRadius: 10,
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
  },
}

export default App