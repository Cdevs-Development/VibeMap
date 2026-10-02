import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { registerUser, loginUser } from '../services/api'
import { normalizePhoneNumber, validatePhoneNumber, isValidEmail, isValidFullName } from '../utils/phone'
import Logo from '../components/Logo'
import { GoogleLogin } from '@react-oauth/google'
import './auth.css'

export default function Register() {
  const navigate = useNavigate()
  const location = useLocation()
  const authProvider = location.state?.from_google ? 'google' : 'local'
  const googleId = location.state?.google_id || ''
  const googleEmail = location.state?.email || ''
  const googleName = location.state?.full_name || ''
  
  const [form, setForm] = useState({
    full_name: googleName,
    email: googleEmail,
    phone: '',
    password: '',
    confirmPassword: '',
    authProvider: authProvider,
    googleId: googleId,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [focusedInput, setFocusedInput] = useState(null)

  useEffect(() => {
    if (location.state?.from_google) {
      setForm(prev => ({
        ...prev,
        authProvider: 'google',
        full_name: location.state.full_name || prev.full_name,
        email: location.state.email || prev.email,
        googleId: location.state.google_id || ''
      }))
    }
  }, [location.state])

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'phone') {
      // Allow only numbers, plus sign, spaces and hyphens
      const cleaned = value.replace(/[^0-9+\s-]/g, '')
      setForm({ ...form, phone: cleaned })
    } else {
      setForm({ ...form, [name]: value })
    }
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate Full Name
    if (!isValidFullName(form.full_name)) {
      setError('Please enter your valid full name (at least 2 letters)')
      return
    }

    // Validate Email
    if (!isValidEmail(form.email)) {
      setError('Please enter a valid email address')
      return
    }

    // Validate Phone Number
    const phoneVal = validatePhoneNumber(form.phone)
    if (!phoneVal.valid) {
      setError(phoneVal.error || 'Please enter a valid mobile number (e.g. 08012345678)')
      return
    }

    if (form.authProvider === 'local') {
      if (!form.password) {
        setError('Password is required')
        return
      }
      if (form.password.length < 6) {
        setError('Password must be at least 6 characters')
        return
      }
      if (form.password !== form.confirmPassword) {
        setError('Passwords do not match')
        return
      }
    }

    if (!agreed) {
      setError('Please agree to the Terms of Service')
      return
    }

    setLoading(true)
    setError('')
    try {
      const normalizedPhone = normalizePhoneNumber(form.phone)
      let payload
      if (form.authProvider === 'google') {
        payload = {
          full_name: form.full_name.trim(),
          phone: normalizedPhone,
          email: form.email.trim().toLowerCase(),
          password: null,
          google_id: form.googleId,
          auth_provider: 'google',
          avatar_url: location.state?.avatar_url || null
        }
      } else {
        payload = {
          full_name: form.full_name.trim(),
          phone: normalizedPhone,
          email: form.email.trim().toLowerCase(),
          password: form.password,
          auth_provider: 'local',
          avatar_url: null
        }
      }
      
      const response = await registerUser(payload)
      
      if (response.data && response.data.access_token) {
        localStorage.setItem('vibemap_token', response.data.access_token)
      }
      
      navigate('/onboarding')
    } catch (err) {
      let msg = 'Registration failed. Please check your inputs.'
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

  return (
    <div style={styles.container}>
      {/* Background Glows */}
      <div className="auth-bg-glow-1" />
      <div className="auth-bg-glow-2" />

      <div style={styles.scrollWrapper}>
        {/* Unified Brand Logo */}
        <Logo size="lg" withTagline style={{ marginBottom: 24 }} />

        {/* Card */}
        <div className="auth-card" style={styles.card}>
          <h2 style={styles.heading}>Create Account ✨</h2>
          <p style={styles.subheading}>Join VibeMap today</p>

          {error && (
            <div className="auth-error">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Full Name */}
            <div className={`auth-input-wrapper ${focusedInput === 'full_name' ? 'focused' : ''}`} style={styles.inputWrapper}>
              <span className="auth-input-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </span>
              <input
                name="full_name"
                type="text"
                placeholder="Enter your full name"
                value={form.full_name}
                onChange={handleChange}
                onFocus={() => setFocusedInput('full_name')}
                onBlur={() => setFocusedInput(null)}
                style={{
                  ...styles.input,
                  color: form.authProvider === 'google' ? '#64748b' : (styles.input.color || '#e2e8f0'),
                }}
                readOnly={form.authProvider === 'google'}
                required
              />
            </div>

            {/* Email */}
            <div className={`auth-input-wrapper ${focusedInput === 'email' ? 'focused' : ''}`} style={styles.inputWrapper}>
              <span className="auth-input-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              </span>
              <input
                name="email"
                type="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={handleChange}
                onFocus={() => setFocusedInput('email')}
                onBlur={() => setFocusedInput(null)}
                style={{
                  ...styles.input,
                  color: form.authProvider === 'google' ? '#64748b' : (styles.input.color || '#e2e8f0'),
                }}
                readOnly={form.authProvider === 'google'}
                required
              />
              {form.authProvider === 'google' && (
                <span style={{ fontSize: 14, flexShrink: 0 }}>✅</span>
              )}
            </div>

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

            {form.authProvider === 'local' && (
              <>
                {/* Password */}
                <div className={`auth-input-wrapper ${focusedInput === 'password' ? 'focused' : ''}`} style={styles.inputWrapper}>
                  <span className="auth-input-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  </span>
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a password"
                    value={form.password}
                    onChange={handleChange}
                    onFocus={() => setFocusedInput('password')}
                    onBlur={() => setFocusedInput(null)}
                    style={styles.input}
                    required={form.authProvider === 'local'}
                  />
                  <span style={styles.eyeIcon} onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </span>
                </div>

                {/* Confirm Password */}
                <div className={`auth-input-wrapper ${focusedInput === 'confirmPassword' ? 'focused' : ''}`} style={styles.inputWrapper}>
                  <span className="auth-input-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  </span>
                  <input
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    onFocus={() => setFocusedInput('confirmPassword')}
                    onBlur={() => setFocusedInput(null)}
                    style={styles.input}
                    required={form.authProvider === 'local'}
                  />
                </div>
              </>
            )}

            <div style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={styles.checkbox}
              />
              <p style={styles.checkboxText}>
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ ...styles.linkText, textDecoration: 'none' }}>Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ ...styles.linkText, textDecoration: 'none' }}>Privacy Policy</a>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="auth-btn-secondary"
              style={loading ? { ...styles.btnPrimary, opacity: 0.7 } : styles.btnPrimary}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div style={styles.divider}>
            <div style={styles.dividerLine} />
            <span style={styles.dividerText}>or</span>
            <div style={styles.dividerLine} />
          </div>

          {form.authProvider === 'local' && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: 16,
            }}>
              <GoogleLogin
                onSuccess={(credentialResponse) => {
                  try {
                    const base64Url = credentialResponse.credential.split('.')[1]
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
                    const jsonPayload = JSON.parse(window.atob(base64))
                    setForm(prev => ({
                      ...prev,
                      full_name: jsonPayload.name || '',
                      email: jsonPayload.email || '',
                      authProvider: 'google',
                      googleId: jsonPayload.sub || '',
                    }))
                  } catch (err) {
                    console.error('Failed to parse Google token', err)
                  }
                }}
                onError={() => setError('Google sign up failed. Please try again.')}
                shape="pill"
                theme="filled_black"
                text="signup_with"
                size="large"
              />
            </div>
          )}

          <p style={styles.switchText}>
            Already have an account?{' '}
            <Link to="/login" className="auth-switch-link" style={styles.switchLink}>Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    height: '100dvh',
    background: '#080810',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  scrollWrapper: {
    width: '100%',
    maxWidth: 420,
    margin: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 'calc(24px + env(safe-area-inset-top, 0px)) 20px calc(24px + env(safe-area-inset-bottom, 0px))',
    zIndex: 1,
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
  checkboxRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 20,
  },
  checkbox: { marginTop: 4, accentColor: '#8b5cf6', flexShrink: 0 },
  checkboxText: { color: '#64748b', fontSize: 13, lineHeight: 1.4 },
  linkText: { color: '#06b6d4', cursor: 'pointer' },
  btnPrimary: {
    width: '100%',
    padding: '14px',
    border: 'none',
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
    background: 'rgba(255,255,255,0.08)',
  },
  dividerText: {
    color: '#64748b',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
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