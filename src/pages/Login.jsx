import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import axios from 'axios'
import API, { loginUser, getSOSPinStatus } from '../services/api'
import { normalizePhoneNumber, validatePhoneNumber } from '../utils/phone'
import Logo from '../components/Logo'
import './auth.css'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ phone: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusedInput, setFocusedInput] = useState(null)
  const [successMessage, setSuccessMessage] = useState(location.state?.message || '')

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'phone') {
      const cleaned = value.replace(/[^0-9+\s-]/g, '')
      setForm({ ...form, phone: cleaned })
    } else {
      setForm({ ...form, [name]: value })
    }
    setError('')
    setSuccessMessage('')
  }

  const handlePostAuthRedirect = async () => {
    try {
      const pinRes = await getSOSPinStatus()
      if (pinRes?.data?.has_sos_pin === false) {
        navigate('/profile?pin_required=true')
        return
      }
    } catch (_) {}
    navigate('/map')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const phoneVal = validatePhoneNumber(form.phone)
    if (!phoneVal.valid) {
      setError(phoneVal.error || 'Please enter a valid mobile number (e.g. 08012345678)')
      return
    }

    if (!form.password) {
      setError('Please enter your password')
      return
    }

    setLoading(true)
    setError('')
    try {
      const payload = {
        phone: normalizePhoneNumber(form.phone),
        password: form.password
      }
      const res = await loginUser(payload)
      localStorage.setItem('vibemap_token', res.data.access_token)
      await handlePostAuthRedirect()
    } catch (err) {
      let msg = 'Login failed. Check your credentials.'
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          msg = err.response.data.detail
        } else if (Array.isArray(err.response.data.detail)) {
          msg = err.response.data.detail.map(d => d.msg || d.message).filter(Boolean).join(', ') || msg
        }
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const processGoogleUser = async ({ idToken, email, fullName, avatarUrl, googleId }) => {
    setLoading(true)
    setError('')
    try {
      const res = await API.post('/auth/google', {
        id_token: idToken,
        access_token: idToken,
        google_id: googleId,
        email: email,
        full_name: fullName,
        avatar_url: avatarUrl,
      })
      const data = res.data

      if (data.is_new_user) {
        navigate('/register', {
          state: {
            from_google: true,
            email: data.email || email,
            full_name: data.full_name || fullName,
            google_id: data.google_id || googleId,
            avatar_url: data.avatar_url || avatarUrl,
          }
        })
      } else {
        if (data.access_token) {
          localStorage.setItem('vibemap_token', data.access_token)
        }
        await handlePostAuthRedirect()
      }
    } catch (err) {
      console.error('Google sign-in error:', err)
      setError(err.response?.data?.detail || 'Google sign-in could not be completed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Web GIS OAuth response
  const handleGoogleSuccess = async (tokenResponse) => {
    setLoading(true)
    setError('')
    try {
      const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
      })
      const userInfo = userInfoRes.data
      await processGoogleUser({
        idToken: tokenResponse.access_token,
        email: userInfo.email,
        fullName: userInfo.name,
        avatarUrl: userInfo.picture,
        googleId: userInfo.sub,
      })
    } catch (err) {
      console.error('Google sign-in userinfo error:', err)
      setError('Google sign-in was cancelled or failed. Please try again.')
      setLoading(false)
    }
  }

  // Register Native Android Bridge Callbacks
  useEffect(() => {
    window.__handleGoogleSignInSuccess = (idToken, email, name, picture, googleId) => {
      processGoogleUser({
        idToken,
        email,
        fullName: name,
        avatarUrl: picture,
        googleId
      })
    }

    window.__handleGoogleSignInError = (errMsg) => {
      setLoading(false)
      if (errMsg && !errMsg.includes('12501')) {
        setError('Google sign-in could not be completed. Please try again.')
      }
    }

    return () => {
      delete window.__handleGoogleSignInSuccess
      delete window.__handleGoogleSignInError
    }
  }, [])

  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: (err) => {
      console.error('Google OAuth error:', err)
      setError('Google sign-in was cancelled.')
      setLoading(false)
    }
  })

  const handleGoogleClick = () => {
    setError('')
    if (typeof window !== 'undefined' && window.NativeVibeMap && window.NativeVibeMap.launchGoogleSignIn) {
      setLoading(true)
      try {
        window.NativeVibeMap.launchGoogleSignIn()
      } catch (e) {
        console.warn('Native launchGoogleSignIn failed:', e)
        setLoading(false)
        setError('Could not open Google sign-in. Please try again.')
      }
    } else if (typeof triggerGoogleLogin === 'function') {
      try {
        setLoading(true)
        triggerGoogleLogin()
      } catch (e) {
        console.warn('triggerGoogleLogin failed:', e)
        setLoading(false)
        setError('Could not open Google sign-in. Please try again.')
      }
    } else {
      setError('Google sign-in is not ready. Please try again in a moment.')
    }
  }

  return (
    <div style={styles.container}>
      {/* Background Glows */}
      <div className="auth-bg-glow-1" />
      <div className="auth-bg-glow-2" />

      {/* Unified Brand Logo */}
      <Logo size="lg" withTagline style={{ marginBottom: 24, zIndex: 1 }} />

      {/* Card */}
      <div className="auth-card" style={styles.card}>
        <h2 style={styles.heading}>Welcome Back 👋</h2>
        <p style={styles.subheading}>Sign in to continue</p>

        {error && (
          <div className="auth-error">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="auth-success">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Phone */}
          <div className={`auth-input-wrapper ${focusedInput === 'phone' ? 'focused' : ''}`} style={styles.inputWrapper}>
            <span className="auth-input-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
            </span>
            <span style={styles.phonePrefix}>🇳🇬 +234</span>
            <input
              name="phone"
              type="tel"
              placeholder="0800 000 0000"
              maxLength={11}
              value={form.phone}
              onChange={handleChange}
              onFocus={() => setFocusedInput('phone')}
              onBlur={() => setFocusedInput(null)}
              style={{ ...styles.input, borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: 10 }}
              required
            />
          </div>

          {/* Password */}
          <div className={`auth-input-wrapper ${focusedInput === 'password' ? 'focused' : ''}`} style={styles.inputWrapper}>
            <span className="auth-input-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </span>
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
              style={styles.input}
              required
            />
            <span
              style={styles.eyeIcon}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="auth-btn-primary"
            style={loading ? { ...styles.btnPrimary, opacity: 0.7 } : styles.btnPrimary}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>or</span>
          <div style={styles.dividerLine} />
        </div>

        <button
          type="button"
          onClick={handleGoogleClick}
          disabled={loading}
          style={{
            width: '100%',
            padding: '13px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: 'rgba(255, 255, 255, 0.05)',
            color: '#ffffff',
            fontSize: '15px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            marginBottom: '16px',
            boxSizing: 'border-box',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Continue with Google</span>
        </button>

        <p style={styles.switchText}>
          Don't have an account?{' '}
          <Link to="/signup" className="auth-switch-link" style={styles.switchLink}>Sign Up</Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100dvh',
    width: '100%',
    background: '#080810',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'calc(24px + env(safe-area-inset-top, 0px)) 20px calc(24px + env(safe-area-inset-bottom, 0px))',
    position: 'relative',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    boxSizing: 'border-box',
  },
  logo: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  logoVibe: {
    color: '#e2e8f0',
  },
  logoMap: {
    background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  pinIcon: {
    color: '#8b5cf6',
    textShadow: '0 0 10px rgba(139, 92, 246, 0.8)',
    fontSize: '24px',
  },
  card: {
    padding: '32px 24px',
    width: '100%',
    maxWidth: 420,
    zIndex: 1,
  },
  heading: {
    color: 'white',
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 6,
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
  },
  subheading: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 24,
  },
  inputWrapper: {
    marginBottom: 14,
  },
  phonePrefix: {
    color: '#e2e8f0',
    fontSize: 14,
    flexShrink: 0,
    fontFamily: 'Inter, sans-serif',
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#e2e8f0',
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
  },
  eyeIcon: {
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    transition: 'color 0.2s',
  },
  forgotRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  forgotText: {
    color: '#06b6d4',
    fontSize: 13,
    cursor: 'pointer',
  },
  btnPrimary: {
    width: '100%',
    padding: '14px',
    border: 'none',
    color: 'white',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    marginBottom: 16,
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: 'rgba(255,255,255,0.06)',
  },
  dividerText: {
    color: '#64748b',
    fontSize: 12,
  },
  switchText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
  },
  switchLink: {
    color: '#8b5cf6',
    fontWeight: 600,
  },
}