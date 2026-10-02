import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import Logo from '../components/Logo'

const DEV_MODE = import.meta.env.DEV // true in local dev, false in production

export default function OTPVerify() {
  const navigate = useNavigate()
  const location = useLocation()
  const phone = location.state?.phone || '+234 800 000 0000'
  const devOtp = location.state?.otp || null // backend can pass OTP in dev mode

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [timer, setTimer] = useState(45)
  const [canResend, setCanResend] = useState(false)
  const [showDevOtp, setShowDevOtp] = useState(false)

  // Countdown timer
  useEffect(() => {
    if (timer <= 0) {
      setCanResend(true)
      return
    }
    const interval = setInterval(() => {
      setTimer(t => t - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [timer])

  const handleChange = (value, index) => {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError('')
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus()
    }
  }

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setOtp(pasted.split(''))
    }
  }

  const handleResend = async () => {
    setTimer(45)
    setCanResend(false)
    setError('')
    setOtp(['', '', '', '', '', ''])
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/otp/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone })
      })
    } catch (err) {
      console.warn('Resend failed:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < 6) {
      setError('Please enter the full 6-digit code')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/otp/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, otp: code })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.detail || 'Invalid or expired code. Please try again.')
        return
      }

      setSuccess(true)
      setTimeout(() => navigate('/onboarding'), 1000)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fontImport = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
  `

  return (
    <>
      <style>{fontImport}</style>
      <div style={styles.container}>
        <div style={styles.bgGlow} />

        {/* Unified Brand Logo */}
        <Logo size="lg" withTagline style={{ marginBottom: 24 }} />

        <div style={styles.card}>
          {/* Icon */}
          <div style={styles.phoneIcon}>
            {success ? '✅' : '📱'}
          </div>

          <h2 style={styles.heading}>
            {success ? 'Verified!' : 'Verify your number'}
          </h2>

          <p style={styles.subheading}>
            {success
              ? 'Your number has been verified successfully.'
              : <>We sent a 6-digit code to{' '}<span style={{ color: '#06b6d4' }}>{phone}</span></>
            }
          </p>

          {/* Dev mode OTP hint */}
          {DEV_MODE && devOtp && (
            <div
              onClick={() => setShowDevOtp(v => !v)}
              style={{
                background: 'rgba(132,204,22,0.1)',
                border: '1px solid rgba(132,204,22,0.3)',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 16,
                cursor: 'pointer',
                fontSize: 12,
                color: '#84cc16',
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              🛠 Dev Mode — {showDevOtp ? `OTP: ${devOtp}` : 'Tap to reveal OTP'}
            </div>
          )}

          {error && (
            <div style={styles.error}>{error}</div>
          )}

          {!success && (
            <form onSubmit={handleSubmit}>
              {/* OTP boxes */}
              <div style={styles.otpRow} onPaste={handlePaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(e.target.value, i)}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                    style={{
                      ...styles.otpBox,
                      borderColor: digit ? '#8b5cf6' : 'rgba(139,92,246,0.2)',
                      boxShadow: digit ? '0 0 10px rgba(139,92,246,0.4)' : 'none',
                    }}
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              {/* Timer / Resend */}
              <p style={styles.timerText}>
                {canResend ? (
                  <span
                    onClick={handleResend}
                    style={{ color: '#06b6d4', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Resend code
                  </span>
                ) : (
                  `Resend code in 0:${timer.toString().padStart(2, '0')}`
                )}
              </p>

              <button
                type="submit"
                disabled={loading || otp.join('').length < 6}
                style={{
                  ...styles.btnPrimary,
                  opacity: (loading || otp.join('').length < 6) ? 0.6 : 1,
                }}
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>
            </form>
          )}

          <p style={styles.switchText}>
            Wrong number?{' '}
            <Link to="/register" style={styles.switchLink}>Go back</Link>
          </p>
        </div>
      </div>
    </>
  )
}

const styles = {
  container: {
    minHeight: '100dvh',
    width: '100%',
    maxWidth: '100vw',
    boxSizing: 'border-box',
    background: '#080810',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'calc(24px + env(safe-area-inset-top, 0px)) 20px calc(24px + env(safe-area-inset-bottom, 0px)) 20px',
    position: 'relative',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  bgGlow: {
    position: 'absolute',
    top: '-20%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '600px',
    height: '400px',
    background: 'radial-gradient(ellipse, rgba(139,92,246,0.15) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginBottom: 32,
    zIndex: 1,
  },
  logoVibe: {
    fontSize: 32,
    fontWeight: 800,
    color: 'white',
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
  },
  logoMap: {
    fontSize: 32,
    fontWeight: 800,
    background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
  },
  card: {
    background: 'rgba(18, 18, 26, 0.9)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: 20,
    padding: '32px 20px',
    width: '100%',
    maxWidth: 420,
    boxSizing: 'border-box',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 0 40px rgba(139, 92, 246, 0.1)',
    zIndex: 1,
    textAlign: 'center',
  },
  phoneIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  heading: {
    color: 'white',
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 8,
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
  },
  subheading: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 1.5,
  },
  error: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 16,
  },
  otpRow: {
    display: 'flex',
    gap: 'clamp(6px, 2vw, 10px)',
    justifyContent: 'center',
    marginBottom: 20,
    width: '100%',
    boxSizing: 'border-box',
  },
  otpBox: {
    width: 'clamp(36px, 11vw, 48px)',
    height: 'clamp(46px, 13vw, 56px)',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(139,92,246,0.2)',
    borderRadius: 10,
    color: 'white',
    fontSize: 'clamp(18px, 5vw, 24px)',
    fontWeight: 700,
    textAlign: 'center',
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
    transition: 'all 0.2s',
    boxSizing: 'border-box',
  },
  timerText: {
    color: '#64748b',
    fontSize: 13,
    marginBottom: 20,
  },
  btnPrimary: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
    border: 'none',
    borderRadius: 10,
    color: 'white',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 0 20px rgba(139,92,246,0.4)',
    fontFamily: 'Inter, sans-serif',
    marginBottom: 16,
    transition: 'opacity 0.2s',
  },
  switchText: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 8,
  },
  switchLink: {
    color: '#8b5cf6',
    textDecoration: 'none',
    fontWeight: 600,
  },
}