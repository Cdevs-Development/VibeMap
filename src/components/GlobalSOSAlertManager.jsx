import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  Volume2,
  VolumeX,
  Navigation2,
  Phone,
  Users,
  ShieldCheck,
  Radio
} from 'lucide-react'
import API, { getMySOS } from '../services/api'
import { playSOSSound, stopSOSSound } from '../utils/audio'
import { initializeSOSNotifications, dispatchEmergencyDistressNotification, setSOSNavigationHandler } from '../services/sosAlertService'
import { getPersonDisplayName } from '../utils/personDisplay'

/**
 * GlobalSOSAlertManager
 *
 * Runs across the entire application (Map, Family, Vibes, Profile, etc.)
 * 1. Continuously tracks sender's own active SOS status across app restarts / navigation.
 * 2. Continuously polls for SOS distress signals from family members/watched users.
 * 3. Sounds urgent siren alarm, triggers vibration, and fires system notifications
 *    for incoming family distress alerts.
 */
export default function GlobalSOSAlertManager() {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeSosUsers, setActiveSosUsers] = useState([])
  const [myActiveSos, setMyActiveSos] = useState(() => {
    try {
      const cached = localStorage.getItem('vibemap_active_sos_id')
      return cached ? { id: cached } : null
    } catch (_) {
      return null
    }
  })
  const [isMuted, setIsMuted] = useState(false)
  const isPollingRef = useRef(false)
  const lastNotifiedIds = useRef(new Set())
  const vibrationIntervalRef = useRef(null)

  // 1. Initialize Native & Web Push/Local Notification Channels
  useEffect(() => {
    initializeSOSNotifications()
    setSOSNavigationHandler((data) => {
      navigate('/family')
    })
  }, [navigate])

  // 2. Listen to custom event for immediate sender SOS updates
  useEffect(() => {
    const handleSosChange = (e) => {
      const { active, sosId } = e.detail || {}
      if (active) {
        setMyActiveSos({ id: sosId || localStorage.getItem('vibemap_active_sos_id') || 'active' })
      } else {
        setMyActiveSos(null)
      }
    }

    window.addEventListener('vibemap-active-sos-changed', handleSosChange)
    return () => window.removeEventListener('vibemap-active-sos-changed', handleSosChange)
  }, [])

  // 3. Continuous high-frequency SOS Polling Engine (2.5s for life-saving speed)
  useEffect(() => {
    const checkSosStatus = async () => {
      const token = localStorage.getItem('vibemap_token')
      if (!token || isPollingRef.current) return

      let currentUserId = null
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        currentUserId = payload.sub || payload.id
      } catch (_) {}

      isPollingRef.current = true
      try {
        // Check watched users for incoming distress signals
        const response = await API.get('/users/my-watched')
        const users = response.data
        if (Array.isArray(users)) {
          const sosList = users.filter(
            u => u.sos_active && (!currentUserId || u.id !== currentUserId)
          )
          setActiveSosUsers(sosList)

          // Trigger System & Native Push/Local Notifications for new SOS alerts
          sosList.forEach(person => {
            if (!lastNotifiedIds.current.has(person.id)) {
              lastNotifiedIds.current.add(person.id)
              dispatchEmergencyDistressNotification(person)
            }
          })

          // Clear notified IDs that are no longer active
          const activeIds = new Set(sosList.map(u => u.id))
          lastNotifiedIds.current.forEach(id => {
            if (!activeIds.has(id)) lastNotifiedIds.current.delete(id)
          })
        }

        // Also check sender's own active SOS status with backend
        try {
          const mySosRes = await getMySOS()
          const myEvents = mySosRes?.data || []
          const activeSelfSos = Array.isArray(myEvents) ? myEvents.find(s => s.status === 'active') : null
          
          if (activeSelfSos?.id) {
            setMyActiveSos(activeSelfSos)
            localStorage.setItem('vibemap_active_sos_id', activeSelfSos.id)
            if (activeSelfSos.triggered_at) {
              const startMs = new Date(activeSelfSos.triggered_at).getTime()
              localStorage.setItem('vibemap_active_sos_start', startMs.toString())
            }
          } else {
            const cachedId = localStorage.getItem('vibemap_active_sos_id')
            if (cachedId && cachedId !== 'offline_sos') {
              localStorage.removeItem('vibemap_active_sos_id')
              localStorage.removeItem('vibemap_active_sos_start')
              setMyActiveSos(null)
            }
          }
        } catch (mySosErr) {
          // If offline, check local storage
          const cachedId = localStorage.getItem('vibemap_active_sos_id')
          if (cachedId) {
            setMyActiveSos({ id: cachedId })
          }
        }
      } catch (err) {
        // Silently handle background poll error
      } finally {
        isPollingRef.current = false
      }
    }

    // Initial check
    checkSosStatus()

    // 2.5s rapid polling interval for maximum life-saving emergency responsiveness
    const interval = setInterval(checkSosStatus, 2500)

    // Immediate check on tab focus or visibility change
    const handleVisibility = () => {
      if (!document.hidden) {
        checkSosStatus()
      }
    }

    window.addEventListener('focus', checkSosStatus)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('vibemap-beneficiaries-updated', checkSosStatus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', checkSosStatus)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('vibemap-beneficiaries-updated', checkSosStatus)
    }
  }, [])

  // 4. Global Audio Siren & Haptic Vibration Management (Only for incoming alerts)
  useEffect(() => {
    if (activeSosUsers.length > 0 && !isMuted) {
      playSOSSound()

      // Start continuous repeating vibration alarm
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([800, 200, 800, 200, 1200]) } catch (_) {}
        if (!vibrationIntervalRef.current) {
          vibrationIntervalRef.current = setInterval(() => {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              try { navigator.vibrate([800, 200, 800, 200, 1200]) } catch (_) {}
            }
          }, 2400)
        }
      }

      // Flash tab title
      const victimName = getPersonDisplayName(activeSosUsers[0])
      document.title = `🚨 SOS ALERT! - ${victimName} needs help!`
    } else {
      stopSOSSound()
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current)
        vibrationIntervalRef.current = null
      }
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(0) } catch (_) {}
      }
      document.title = 'VibeMap — Real-Time Safety & Community Map'
    }

    return () => {
      stopSOSSound()
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current)
        vibrationIntervalRef.current = null
      }
    }
  }, [activeSosUsers.length, isMuted])

  const showSenderBanner = myActiveSos && location.pathname !== '/sos'
  const showBeneficiaryBanner = activeSosUsers.length > 0

  if (!showSenderBanner && !showBeneficiaryBanner) return null

  const firstUser = activeSosUsers[0]
  const count = activeSosUsers.length

  return (
    <>
      <style>{`
        @keyframes sosBannerPulse {
          0% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.7); }
          50% { box-shadow: 0 0 45px rgba(239, 68, 68, 1), 0 0 15px #ff0000; }
          100% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.7); }
        }
        @keyframes senderBannerPulse {
          0% { box-shadow: 0 0 15px rgba(220, 38, 38, 0.6); }
          50% { box-shadow: 0 0 35px rgba(239, 68, 68, 0.9), 0 0 10px #ff3333; }
          100% { box-shadow: 0 0 15px rgba(220, 38, 38, 0.6); }
        }
        @keyframes sirenIconSpin {
          0% { transform: scale(1) rotate(-10deg); }
          50% { transform: scale(1.25) rotate(10deg); }
          100% { transform: scale(1) rotate(-10deg); }
        }
      `}</style>

      {/* 1. SENDER'S OWN ACTIVE SOS BANNER (Shown when sender navigates outside /sos) */}
      {showSenderBanner && (
        <div style={{
          position: 'fixed',
          top: 'calc(10px + env(safe-area-inset-top, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 24px)',
          maxWidth: 480,
          zIndex: 99999,
          background: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)',
          borderRadius: 16,
          padding: '12px 14px',
          color: '#ffffff',
          fontFamily: 'Inter, sans-serif',
          animation: 'senderBannerPulse 1.5s ease-in-out infinite',
          border: '2px solid rgba(255, 255, 255, 0.35)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 24px rgba(239,68,68,0.6)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{ animation: 'sirenIconSpin 0.8s infinite ease-in-out', flexShrink: 0 }}>
                <Radio size={22} color="#ffffff" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
                }}>
                  🚨 YOUR EMERGENCY SOS IS ACTIVE
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                  Beneficiaries are tracking your live GPS location
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => navigate('/sos')}
              style={{
                flex: 1.4,
                padding: '9px 12px',
                background: '#ffffff',
                border: 'none',
                borderRadius: 10,
                color: '#dc2626',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              <Radio size={14} color="#dc2626" />
              <span>Open SOS Screen</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/sos')}
              style={{
                flex: 1,
                padding: '9px 10px',
                background: '#10b981',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 10,
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <ShieldCheck size={14} />
              <span>I'm Safe</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. BENEFICIARY INCOMING SOS ALARM BANNER */}
      {showBeneficiaryBanner && (
        <div style={{
          position: 'fixed',
          top: showSenderBanner ? 'calc(100px + env(safe-area-inset-top, 0px))' : 'calc(10px + env(safe-area-inset-top, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 24px)',
          maxWidth: 480,
          zIndex: 99998,
          background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.98) 0%, rgba(153, 27, 27, 0.98) 100%)',
          borderRadius: 16,
          padding: '12px 14px',
          color: '#ffffff',
          fontFamily: 'Inter, sans-serif',
          animation: 'sosBannerPulse 1.4s ease-in-out infinite',
          border: '2px solid rgba(255, 255, 255, 0.4)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 24px rgba(239,68,68,0.6)',
        }}>
          {/* Header: Victim Name & Distress Warning */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{ animation: 'sirenIconSpin 0.7s infinite ease-in-out', flexShrink: 0 }}>
                <AlertTriangle size={22} color="#ffffff" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
                }}>
                  SOS: {getPersonDisplayName(firstUser)}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                  {count > 1 ? `+ ${count - 1} other active alarm` : 'Active emergency distress signal'}
                </div>
              </div>
            </div>

            {/* Mute Alarm Button in Header */}
            <button
              type="button"
              onClick={() => setIsMuted(m => !m)}
              style={{
                background: isMuted ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: 20,
                padding: '5px 10px',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              <span>{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>
          </div>

          {/* Action Buttons Row: Navigate, Call, View on Family Map */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => {
                if (location.pathname === '/family') {
                  window.dispatchEvent(new CustomEvent('startBeneficiaryNav', { detail: firstUser }))
                } else {
                  navigate('/family', { state: { autoNavigateTo: firstUser } })
                }
              }}
              style={{
                flex: 1.2,
                padding: '9px 10px',
                background: '#ffffff',
                border: 'none',
                borderRadius: 10,
                color: '#dc2626',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              <Navigation2 size={14} color="#dc2626" />
              <span>Navigate</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (firstUser.phone) {
                  window.location.href = `tel:${firstUser.phone}`
                } else {
                  alert(`No phone number available for ${firstUser.full_name}`)
                }
              }}
              style={{
                flex: 1,
                padding: '9px 10px',
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: 10,
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <Phone size={14} />
              <span>Call</span>
            </button>

            {location.pathname !== '/family' && (
              <button
                type="button"
                onClick={() => navigate('/family')}
                style={{
                  flex: 1.1,
                  padding: '9px 10px',
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  borderRadius: 10,
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <Users size={14} />
                <span>Family Map</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
