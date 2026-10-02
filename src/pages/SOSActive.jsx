import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Radio,
  MapPin,
  Volume2,
  VolumeX,
  MessageSquare,
  PhoneCall,
  ShieldCheck,
  ChevronRight,
  Shield,
  AlertTriangle,
  X,
  Check
} from 'lucide-react'
import { triggerSOS, getBeneficiaries, resolveSOS, getSOSPinStatus, getMySOS, updateUserLocation } from '../services/api'
import { enqueueOfflineSOS, enqueueOfflinePing, getCache } from '../services/cacheService'
import { GPSSmoother } from '../services/gpsSmoothing'
import locationService from '../services/locationService'
import { playSOSSound, stopSOSSound } from '../utils/audio'

export default function SOSActive() {
  const navigate = useNavigate()
  const [coords, setCoords] = useState({ lat: null, lng: null, accuracy: null })
  const [address, setAddress] = useState('Locating address...')
  const [sosId, setSosId] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [pin, setPin] = useState(['', '', '', ''])
  const [pinError, setPinError] = useState('')
  const [sosSent, setSosSent] = useState(false)
  const [sosError, setSosError] = useState('')
  const [isSendingSOS, setIsSendingSOS] = useState(false)
  const [isOfflineSOS, setIsOfflineSOS] = useState(!navigator.onLine)
  const [notificationResults, setNotificationResults] = useState([])
  const [beneficiariesNotified, setBeneficiariesNotified] = useState(null)
  const [beneficiaries, setBeneficiaries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [hasSOSPin, setHasSOSPin] = useState(() => {
    try {
      const local = localStorage.getItem('vibemap_has_sos_pin')
      if (local !== null) return local === 'true'
    } catch (_) {}
    return true // Fail-open default so emergency is never blocked
  })
  const [isCheckingPinStatus, setIsCheckingPinStatus] = useState(() => {
    try {
      const local = localStorage.getItem('vibemap_has_sos_pin')
      return local === null
    } catch (_) {
      return false
    }
  })

  const gpsSmoother = useRef(new GPSSmoother())

  useEffect(() => {
    const fetchSOSPinStatus = async () => {
      try {
        const res = await getSOSPinStatus()
        if (res?.data && typeof res.data.has_sos_pin === 'boolean') {
          setHasSOSPin(res.data.has_sos_pin)
        }
      } catch (err) {
        console.warn('Failed to get SOS PIN status in SOSActive, retaining fail-open state:', err)
        const local = localStorage.getItem('vibemap_has_sos_pin')
        if (local === 'false') {
          setHasSOSPin(false)
        }
      } finally {
        setIsCheckingPinStatus(false)
      }
    }

    fetchSOSPinStatus()
  }, [])

  // Fetch Beneficiaries on Mount
  useEffect(() => {
    const fetchBeneficiaries = async () => {
      try {
        const res = await getBeneficiaries()
        setBeneficiaries(res.data || [])
      } catch (err) {
        console.error('Failed to fetch beneficiaries:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchBeneficiaries()
  }, [])

  // Guarantee the distressed sender NEVER hears any siren sound on their device
  useEffect(() => {
    stopSOSSound()
    return () => {
      stopSOSSound()
    }
  }, [])

  const fontImport = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
    @keyframes sosPulse {
      0% { transform: scale(1); opacity: 0.6; }
      100% { transform: scale(1.8); opacity: 0; }
    }
    @keyframes sosPulse2 {
      0% { transform: scale(1); opacity: 0.4; }
      100% { transform: scale(2.4); opacity: 0; }
    }
    @keyframes sosPulse3 {
      0% { transform: scale(1); opacity: 0.2; }
      100% { transform: scale(3); opacity: 0; }
    }
    @keyframes breathe {
      0%, 100% { box-shadow: 0 0 40px rgba(239,68,68,0.8), 0 0 80px rgba(239,68,68,0.4); }
      50% { box-shadow: 0 0 60px rgba(239,68,68,1), 0 0 120px rgba(239,68,68,0.6); }
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `

  // Get live location — uses native background service on Android, web API on browser
  useEffect(() => {
    let stopTracking = null

    const startLocation = async () => {
      stopTracking = await locationService.startTracking(
        (loc) => {
          const { latitude, longitude, accuracy } = loc

          // Bypass strict accuracy constraints during SOS to ensure coarse indoor pings are captured
          const result = gpsSmoother.current.process({ latitude, longitude, accuracy })

          if (result) {
            setCoords({
              lat: result.smoothed.latitude,
              lng: result.smoothed.longitude,
              accuracy: accuracy ?? null
            })
          } else {
            setCoords({
              lat: latitude,
              lng: longitude,
              accuracy: accuracy ?? null
            })
          }
        },
        (err) => console.warn('SOS location watch error:', err)
      )
    }

    startLocation()

    return () => {
      if (typeof stopTracking === 'function') stopTracking()
    }
  }, [])

  // Continuously sync live location with backend every 10s during active SOS
  useEffect(() => {
    if (!coords.lat || !coords.lng) return

    const intervalId = setInterval(() => {
      updateUserLocation({
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy ?? null,
      }).catch(err => console.warn('Live SOS location sync error:', err))
    }, 10000)

    return () => clearInterval(intervalId)
  }, [coords.lat, coords.lng, coords.accuracy])

  // Sync and resume existing active SOS session or trigger new SOS on mount
  useEffect(() => {
    if (sosSent || isCheckingPinStatus) return
    if (hasSOSPin === false) return

    let isMounted = true

    const initSOS = async () => {
      setIsSendingSOS(true)
      setSosError('')

      // 1. Check if user already has an active SOS event on the backend or in local cache
      try {
        const cachedSosId = localStorage.getItem('vibemap_active_sos_id')
        const cachedStartTime = localStorage.getItem('vibemap_active_sos_start')
        
        if (cachedStartTime) {
          const diff = Math.floor((Date.now() - Number(cachedStartTime)) / 1000)
          if (!isNaN(diff) && diff >= 0) setElapsed(diff)
        }

        const existing = await getMySOS()
        const existingData = existing?.data || []
        const activeSos = Array.isArray(existingData) ? existingData.find(s => s.status === 'active') : null

        if (activeSos?.id) {
          if (!isMounted) return
          setSosId(activeSos.id)
          localStorage.setItem('vibemap_active_sos_id', activeSos.id)
          if (activeSos.triggered_at) {
            const startMs = new Date(activeSos.triggered_at).getTime()
            localStorage.setItem('vibemap_active_sos_start', startMs.toString())
            setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)))
          }
          setSosSent(true)
          setIsSendingSOS(false)
          window.dispatchEvent(new CustomEvent('vibemap-active-sos-changed', { detail: { active: true, sosId: activeSos.id } }))
          return
        } else if (cachedSosId && cachedSosId === 'offline_sos') {
          if (!isMounted) return
          setIsOfflineSOS(true)
          setSosSent(true)
          setIsSendingSOS(false)
          setSosError('Device is currently offline. Satellite GPS is active. Offline SMS dispatch is ready below.')
          return
        }
      } catch (checkErr) {
        console.warn('[SOSActive] Could not verify existing SOS, proceeding with trigger:', checkErr)
      }

      // 2. No active SOS found — trigger fresh SOS
      const fireSOS = async (lat, lng) => {
        try {
          const response = await triggerSOS({
            trip_id: null,
            triggered_lat: lat || 0,
            triggered_lng: lng || 0
          })

          const data = response?.data || {}
          if (!isMounted) return

          const newSosId = data.sos_id || 'sos_' + Date.now()
          setSosId(newSosId)
          localStorage.setItem('vibemap_active_sos_id', newSosId)
          localStorage.setItem('vibemap_active_sos_start', Date.now().toString())
          window.dispatchEvent(new CustomEvent('vibemap-active-sos-changed', { detail: { active: true, sosId: newSosId } }))

          setNotificationResults(Array.isArray(data.notification_results) ? data.notification_results : [])
          setBeneficiariesNotified(data.beneficiaries_notified ?? null)
          setSosSent(true)
          setIsOfflineSOS(false)
        } catch (err) {
          if (!isMounted) return
          console.error('Failed to trigger SOS:', err)
          const isNetworkErr = !navigator.onLine || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error') || !err.response
          
          if (isNetworkErr) {
            setIsOfflineSOS(true)
            enqueueOfflineSOS({
              trip_id: null,
              triggered_lat: lat || coords.lat || 0,
              triggered_lng: lng || coords.lng || 0,
            })
            localStorage.setItem('vibemap_active_sos_id', 'offline_sos')
            localStorage.setItem('vibemap_active_sos_start', Date.now().toString())
            window.dispatchEvent(new CustomEvent('vibemap-active-sos-changed', { detail: { active: true, sosId: 'offline_sos' } }))
            setSosSent(true)
            setSosError('Device is currently offline. Satellite GPS is active. Offline SMS dispatch is ready below.')
          } else if (err.response?.status === 409) {
            // Conflict: SOS is already active on backend
            try {
              const existing = await getMySOS()
              const existingData = existing?.data || []
              const activeSos = Array.isArray(existingData) ? existingData.find(s => s.status === 'active') : null
              if (activeSos?.id) {
                setSosId(activeSos.id)
                localStorage.setItem('vibemap_active_sos_id', activeSos.id)
                if (activeSos.triggered_at) {
                  const startMs = new Date(activeSos.triggered_at).getTime()
                  localStorage.setItem('vibemap_active_sos_start', startMs.toString())
                  setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)))
                }
                window.dispatchEvent(new CustomEvent('vibemap-active-sos-changed', { detail: { active: true, sosId: activeSos.id } }))
                setSosSent(true)
              }
            } catch (innerErr) {
              console.error('Failed to load active SOS after conflict:', innerErr)
            }
          } else {
            const detail = err.response?.data?.detail || err.message || 'Failed to trigger SOS'
            setSosError(detail)
          }
        } finally {
          if (isMounted) setIsSendingSOS(false)
        }
      }

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords
            fireSOS(latitude, longitude)
            if (isMounted) setCoords(prev => prev.lat ? prev : { lat: latitude, lng: longitude, accuracy })
          },
          (err) => {
            console.warn('Initial geolocation failed/timed out:', err)
            fireSOS(null, null)
          },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
        )
      } else {
        fireSOS(null, null)
      }
    }

    initSOS()

    return () => {
      isMounted = false
    }
  }, [sosSent, isCheckingPinStatus, hasSOSPin])

  // Reverse Geocoding
  useEffect(() => {
    if (!coords.lat || !coords.lng) return

    const fetchAddress = async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`)
        const data = await res.json()
        if (data && data.display_name) {
          const segments = data.display_name.split(',').map(s => s.trim())
          const shortAddress = segments.slice(0, 3).join(', ')
          setAddress(shortAddress)
        } else {
          setAddress(`${coords.lat.toFixed(5)}° N, ${coords.lng.toFixed(5)}° E`)
        }
      } catch (err) {
        console.error('Failed to reverse geocode:', err)
        setAddress(`${coords.lat.toFixed(5)}° N, ${coords.lng.toFixed(5)}° E`)
      }
    }

    const timer = setTimeout(() => {
      fetchAddress()
    }, 2000)

    return () => clearTimeout(timer)
  }, [coords.lat, coords.lng])

  // Elapsed time counter synced with start timestamp
  useEffect(() => {
    const updateElapsed = () => {
      const start = localStorage.getItem('vibemap_active_sos_start')
      if (start) {
        const diff = Math.floor((Date.now() - Number(start)) / 1000)
        if (!isNaN(diff) && diff >= 0) {
          setElapsed(diff)
          return
        }
      }
      setElapsed(e => e + 1)
    }

    updateElapsed()
    const timer = setInterval(updateElapsed, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const handlePinChange = (value, index) => {
    if (!/^\d*$/.test(value)) return
    const newPin = [...pin]
    newPin[index] = value
    setPin(newPin)
    setPinError('')
    if (value && index < 3) {
      document.getElementById(`sos-pin-${index + 1}`)?.focus()
    }
  }

  const handleCancelSOS = async () => {
    const code = pin.join('')

    if (!hasSOSPin) {
      setPinError('No SOS PIN is set. Please create one in Profile first.')
      return
    }

    if (code.length < 4) {
      setPinError('Enter your 4-digit SOS PIN')
      return
    }

    let currentSosId = sosId || localStorage.getItem('vibemap_active_sos_id')
    
    // If offline SOS, resolve immediately locally
    if (currentSosId === 'offline_sos' || !navigator.onLine) {
      localStorage.removeItem('vibemap_active_sos_id')
      localStorage.removeItem('vibemap_active_sos_start')
      window.dispatchEvent(new CustomEvent('vibemap-active-sos-changed', { detail: { active: false } }))
      navigate('/map')
      return
    }

    // If ID is missing, attempt to retrieve it from getMySOS()
    if (!currentSosId) {
      try {
        const existing = await getMySOS()
        const existingData = existing?.data || []
        const activeSos = Array.isArray(existingData) ? existingData.find(s => s.status === 'active') : null
        if (activeSos?.id) {
          currentSosId = activeSos.id
        }
      } catch (_) {}
    }

    if (!currentSosId) {
      // If there really is no active SOS on server, clear local cache and return to map
      localStorage.removeItem('vibemap_active_sos_id')
      localStorage.removeItem('vibemap_active_sos_start')
      window.dispatchEvent(new CustomEvent('vibemap-active-sos-changed', { detail: { active: false } }))
      navigate('/map')
      return
    }

    try {
      await resolveSOS(currentSosId, { pin: code, resolution_note: 'Resolved by user via PIN confirmation' })
      localStorage.removeItem('vibemap_active_sos_id')
      localStorage.removeItem('vibemap_active_sos_start')
      window.dispatchEvent(new CustomEvent('vibemap-active-sos-changed', { detail: { active: false } }))
      navigate('/map')
    } catch (err) {
      console.error('Failed to resolve SOS:', err)
      if (err.response?.status === 404 || err.response?.status === 409) {
        // Event already resolved or missing
        localStorage.removeItem('vibemap_active_sos_id')
        localStorage.removeItem('vibemap_active_sos_start')
        window.dispatchEvent(new CustomEvent('vibemap-active-sos-changed', { detail: { active: false } }))
        navigate('/map')
        return
      }
      setPinError(err.response?.data?.detail || err.message || 'Failed to resolve SOS on server. Please try again.')
    }
  }

  return (
    <>
      <style>{fontImport}</style>
      <div style={{
        width: '100vw',
        height: '100dvh',
        background: '#0a0002',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '48px 24px 40px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif',
      }}>

        {/* Background red glow */}
        <div style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* TOP — Header */}
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 8,
          }}>
            <span style={{
              color: '#ef4444',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 3,
              animation: 'blink 1s ease-in-out infinite',
            }}>⚠️ SOS ACTIVE ⚠️</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginTop: 6,
          }}>
            <div style={{
              color: 'rgba(239,68,68,0.7)',
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
            }}>
              Active for {formatTime(elapsed)}
            </div>
            <button
              onClick={() => setIsMuted(m => !m)}
              style={{
                background: isMuted ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.4)',
                border: '1px solid rgba(239,68,68,0.6)',
                borderRadius: 20,
                padding: '5px 12px',
                color: 'white',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              <span>{isMuted ? 'Unmute Siren' : 'Siren Playing'}</span>
            </button>
          </div>
        </div>

        {/* MIDDLE — Pulsing SOS Circle */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}>
          {/* Pulse rings */}
          <div style={{
            position: 'absolute',
            width: 120, height: 120,
            borderRadius: '50%',
            border: '2px solid rgba(239,68,68,0.6)',
            animation: 'sosPulse 2s ease-out infinite',
          }} />
          <div style={{
            position: 'absolute',
            width: 120, height: 120,
            borderRadius: '50%',
            border: '2px solid rgba(239,68,68,0.4)',
            animation: 'sosPulse2 2s ease-out infinite 0.4s',
          }} />
          <div style={{
            position: 'absolute',
            width: 120, height: 120,
            borderRadius: '50%',
            border: '2px solid rgba(239,68,68,0.2)',
            animation: 'sosPulse3 2s ease-out infinite 0.8s',
          }} />

          {/* Main SOS button */}
          <div style={{
            width: 130,
            height: 130,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #ef4444, #b91c1c)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'breathe 2s ease-in-out infinite',
            border: '3px solid rgba(255,255,255,0.15)',
          }}>
            <span style={{
              fontSize: 28,
              fontWeight: 900,
              color: 'white',
              fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
              letterSpacing: 2,
            }}>SOS</span>
            <span style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.8)',
              fontWeight: 500,
              letterSpacing: 1,
            }}>ACTIVE</span>
          </div>
        </div>

        {/* INFO CARDS */}
        <div style={{ width: '100%', maxWidth: 420, zIndex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Alert sent card */}
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <Radio size={20} color="#ef4444" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ color: '#ef4444', fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 2 }}>
                ALERT SENT TO YOUR BENEFICIARIES
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                {isSendingSOS && 'Sending SOS alert...'}
                {!isSendingSOS && sosError && `SOS failed: ${sosError}`}
                {!isSendingSOS && !sosError && beneficiariesNotified !== null && `Notified ${beneficiariesNotified} beneficiary${beneficiariesNotified === 1 ? '' : 'ies'}.`}
                {!isSendingSOS && !sosError && beneficiariesNotified === null && 'They have been notified and your location is being shared.'}
              </div>
              {!isSendingSOS && notificationResults.length > 0 && (
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 6 }}>
                  {notificationResults.map((item, index) => (
                    <div key={index}>
                      • {item.beneficiary || item.name || item.related_entity_id}: {item.success ? 'Notified' : 'Failed'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Live location card */}
          <div style={{
            background: 'rgba(18,18,26,0.8)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <MapPin size={20} color="#ef4444" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ color: '#ef4444', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 3 }}>
                LIVE LOCATION
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'monospace' }}>
                {coords.lat && coords.lng
                  ? `${address}${coords.accuracy ? ` (±${Math.round(coords.accuracy)}m)` : ''}`
                  : 'Getting location...'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
                Last updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
            <div style={{
              width: 40, height: 40,
              borderRadius: 8,
              background: 'rgba(239,68,68,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <MapPin size={18} color="#ef4444" />
            </div>
          </div>

          {/* OFFLINE RESILIENCE & DIRECT CELLULAR SMS DISPATCH */}
          {(isOfflineSOS || !navigator.onLine) && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.15))',
              border: '1px solid rgba(245,158,11,0.5)',
              borderRadius: 14,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              animation: 'fadeIn 0.3s ease-out',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Radio size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ color: '#f59e0b', fontSize: 12, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    OFFLINE SMS BACKUP READY
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
                    No internet connection required. Send instant GPS text via cellular SMS:
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {beneficiaries && beneficiaries.length > 0 ? (
                  beneficiaries.map((b, idx) => (
                    <a
                      key={idx}
                      href={`sms:${b.phone || ''}?body=${encodeURIComponent(`🚨 EMERGENCY SOS! I need help! My live GPS location: https://maps.google.com/?q=${coords.lat || 0},${coords.lng || 0} (${coords.lat?.toFixed(5) || '0'}, ${coords.lng?.toFixed(5) || '0'})`)}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        borderRadius: 8,
                        padding: '8px 12px',
                        color: '#ffffff',
                        textDecoration: 'none',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MessageSquare size={14} />
                        <span>SMS {b.name || b.full_name || 'Beneficiary'} ({b.phone})</span>
                      </span>
                      <ChevronRight size={14} />
                    </a>
                  ))
                ) : (
                  <a
                    href={`sms:?body=${encodeURIComponent(`🚨 EMERGENCY SOS! I need urgent help! My live GPS coordinates: https://maps.google.com/?q=${coords.lat || 0},${coords.lng || 0}`)}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      background: 'rgba(255, 255, 255, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.5)',
                      borderRadius: 8,
                      padding: '10px',
                      color: '#ffffff',
                      textDecoration: 'none',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <MessageSquare size={15} />
                    <span>Send SOS SMS with Live GPS</span>
                  </a>
                )}

                <a
                  href="tel:112"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    background: '#dc2626',
                    borderRadius: 8,
                    padding: '10px',
                    color: '#ffffff',
                    textDecoration: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(220,38,38,0.4)',
                  }}
                >
                  <PhoneCall size={15} />
                  <span>Call 112 (National Emergency Helpline)</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM BUTTONS */}
        <div style={{ width: '100%', maxWidth: 420, zIndex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* I'm Safe button */}
          <button
            onClick={() => {
              if (!hasSOSPin) {
                setPinError('No SOS PIN is set. Please create one in Profile first.')
                return
              }
              setShowCancelConfirm(true)
            }}
            disabled={isCheckingPinStatus || !hasSOSPin}
            style={{
              width: '100%',
              padding: '16px',
              background: isCheckingPinStatus || !hasSOSPin ? 'rgba(16,185,129,0.35)' : '#10b981',
              border: 'none',
              borderRadius: 14,
              color: '#ffffff',
              fontSize: 16,
              fontWeight: 700,
              cursor: isCheckingPinStatus || !hasSOSPin ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              fontFamily: 'Inter, sans-serif',
              boxShadow: '0 0 20px rgba(16,185,129,0.3)',
              opacity: isCheckingPinStatus || !hasSOSPin ? 0.7 : 1,
            }}
          >
            <ShieldCheck size={20} />
            <span>I'M SAFE</span>
            <span style={{ fontSize: 12, opacity: 0.8 }}>(Cancel Alert)</span>
            <ChevronRight size={16} />
          </button>

          {/* Call Beneficiary */}
          <button
            onClick={() => {
              const phone = beneficiaries[0]?.phone
              if (phone) window.location.href = `tel:${phone}`
            }}
            disabled={isLoading || !beneficiaries || beneficiaries.length === 0}
            style={{
              width: '100%',
              padding: '16px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 14,
              color: 'white',
              fontSize: 16,
              fontWeight: 700,
              cursor: (isLoading || !beneficiaries || beneficiaries.length === 0) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              fontFamily: 'Inter, sans-serif',
              opacity: (isLoading || !beneficiaries || beneficiaries.length === 0) ? 0.5 : 1,
            }}
          >
            <PhoneCall size={18} />
            <span>CALL BENEFICIARY</span>
            <span style={{ fontSize: 12, opacity: 0.5 }}>
              {isLoading ? 'Loading...' : (beneficiaries[0] ? `Connect with ${beneficiaries[0].name.split(' ')[0]}` : 'No contact found')}
            </span>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* PIN CANCEL MODAL */}
        {showCancelConfirm && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 24,
          }}>
            <div style={{
              background: 'rgba(18,18,26,0.98)',
              border: '1px solid rgba(139,92,246,0.4)',
              borderRadius: 20,
              padding: '32px 24px',
              width: '100%',
              maxWidth: 380,
              textAlign: 'center',
            }}>
              <Shield size={40} color="#10b981" style={{ margin: '0 auto 8px' }} />
              <h3 style={{
                color: 'white',
                fontSize: 20,
                fontWeight: 700,
                margin: '12px 0 8px',
                fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
              }}>Cancel SOS?</h3>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
                Enter your 4-digit SOS PIN to confirm you are safe.
              </p>

              {/* PIN inputs */}
              <div style={{
                display: 'flex',
                gap: 12,
                justifyContent: 'center',
                marginBottom: 16,
              }}>
                {pin.map((digit, i) => (
                  <input
                    key={i}
                    id={`sos-pin-${i}`}
                    type="password"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(e.target.value, i)}
                    style={{
                      width: 56,
                      height: 64,
                      background: 'rgba(255,255,255,0.05)',
                      border: `2px solid ${digit ? '#8b5cf6' : 'rgba(139,92,246,0.2)'}`,
                      borderRadius: 12,
                      color: 'white',
                      fontSize: 24,
                      fontWeight: 700,
                      textAlign: 'center',
                      outline: 'none',
                      fontFamily: 'Inter, sans-serif',
                      boxShadow: digit ? '0 0 10px rgba(139,92,246,0.4)' : 'none',
                    }}
                  />
                ))}
              </div>

              {pinError && (
                <div style={{
                  color: '#ef4444',
                  fontSize: 12,
                  marginBottom: 12,
                }}>{pinError}</div>
              )}

              <button
                onClick={handleCancelSOS}
                disabled={pin.join('').length !== 4}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: pin.join('').length !== 4 ? 'rgba(16,185,129,0.35)' : '#10b981',
                  border: 'none',
                  borderRadius: 12,
                  color: '#ffffff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: pin.join('').length !== 4 ? 'not-allowed' : 'pointer',
                  marginBottom: 12,
                  fontFamily: 'Inter, sans-serif',
                  opacity: pin.join('').length !== 4 ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Check size={16} />
                <span>Confirm — I'm Safe</span>
              </button>

              <button
                onClick={() => {
                  setShowCancelConfirm(false)
                  setPin(['', '', '', ''])
                  setPinError('')
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 15,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Stay on SOS
              </button>
            </div>
          </div>
        )}

        {/* BLOCKING MODAL IF NO SOS PIN IS CONFIGURED */}
        {hasSOSPin === false && !isCheckingPinStatus && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(8,8,16,0.96)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            backdropFilter: 'blur(12px)',
          }}>
            <div style={{
              background: 'rgba(18,18,26,0.98)',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 24,
              padding: '32px 24px',
              maxWidth: 380,
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            }}>
              <Shield size={44} color="#f59e0b" style={{ margin: '0 auto 8px' }} />
              <h3 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: '14px 0 8px', fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>
                SOS PIN Required
              </h3>
              <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5, marginBottom: 24, fontFamily: 'Inter, sans-serif' }}>
                You must set a 4-digit SOS PIN before you can trigger emergency alerts. This ensures you can safely cancel false alarms.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={() => navigate('/profile')}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: '#7c3aed',
                    border: 'none',
                    borderRadius: 12,
                    color: 'white',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Set PIN in Profile
                </button>
                <button
                  onClick={() => navigate('/map')}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    color: '#94a3b8',
                    fontSize: 14,
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Return to Map
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}