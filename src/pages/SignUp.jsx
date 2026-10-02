import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import axios from 'axios'
import API, { getSOSPinStatus } from '../services/api'
import Logo from '../components/Logo'

export default function SignUp() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
        try {
          const pinRes = await getSOSPinStatus()
          if (pinRes?.data?.has_sos_pin === false) {
            navigate('/profile?pin_required=true')
            return
          }
        } catch (_) {}
        navigate('/map')
      }
    } catch (err) {
      console.error('Google sign-up error:', err)
      // If error or new user fallback
      navigate('/register', {
        state: {
          from_google: true,
          email: email,
          full_name: fullName,
          google_id: googleId,
          avatar_url: avatarUrl,
        }
      })
    } finally {
      setLoading(false)
    }
  }

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
      console.error('Failed to parse Google token', err)
      setError('Google sign up was cancelled or failed.')
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
      if (errMsg && !errMsg.includes('12501')) {
        setError(errMsg || 'Google sign up could not be completed. Please try again.')
      }
      setLoading(false)
    }

    return () => {
      delete window.__handleGoogleSignInSuccess
      delete window.__handleGoogleSignInError
    }
  }, [navigate])

  let triggerGoogleSignUp = null
  try {
    triggerGoogleSignUp = useGoogleLogin({
      onSuccess: handleGoogleSuccess,
      onError: (err) => {
        console.error('Google sign up failed', err)
        setError('Google sign up was cancelled.')
      }
    })
  } catch (_) {}

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

  const fontImport = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
  `

  return (
    <>
      <style>{fontImport}</style>
      <div style={{
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
        fontFamily: 'Inter, sans-serif',
      }}>

        <div style={{
          position: 'absolute',
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(139,92,246,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Unified Brand Logo */}
        <Logo size="lg" withTagline style={{ marginBottom: 32, zIndex: 1 }} />

        <div style={{
          background: 'rgba(18, 18, 26, 0.9)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: 20,
          padding: '40px 28px',
          width: '100%',
          maxWidth: 420,
          backdropFilter: 'blur(20px)',
          boxShadow: '0 0 40px rgba(139, 92, 246, 0.1)',
          zIndex: 1,
          textAlign: 'center',
        }}>

          <h2 style={{
            color: 'white',
            fontSize: 26,
            fontWeight: 700,
            marginBottom: 8,
            fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
          }}>Create your account</h2>

          <p style={{
            color: '#64748b',
            fontSize: 14,
            marginBottom: 24,
            lineHeight: 1.5,
          }}>
            Start with your Google account for instant and secure sign up.
          </p>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '10px 14px',
              color: '#ef4444',
              fontSize: '13px',
              marginBottom: '20px',
              textAlign: 'left',
            }}>
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              width: '100%',
              padding: '14px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 12,
              color: '#ffffff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              marginBottom: 28,
              boxSizing: 'border-box',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Sign up with Google</span>
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 24,
          }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ color: '#64748b', fontSize: 12 }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>

          <Link
            to="/register"
            style={{
              display: 'block',
              width: '100%',
              padding: '13px',
              background: 'transparent',
              border: '1px solid rgba(139,92,246,0.4)',
              borderRadius: 10,
              color: '#8b5cf6',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              textDecoration: 'none',
              marginBottom: 24,
              boxSizing: 'border-box',
            }}
          >
            ✉️ Continue with email instead
          </Link>

          <p style={{
            color: '#64748b',
            fontSize: 14,
          }}>
            Already have an account?{' '}
            <Link to="/login" style={{
              color: '#8b5cf6',
              textDecoration: 'none',
              fontWeight: 600,
            }}>Sign In</Link>
          </p>

        </div>
      </div>
    </>
  )
}
