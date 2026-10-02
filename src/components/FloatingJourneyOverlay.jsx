import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Navigation2,
  PhoneCall,
  ArrowRight,
  Lock
} from 'lucide-react'
import { subscribeJourneyState, stopActiveJourney, getActiveJourney } from '../services/journeyState'
import { getSOSPinStatus } from '../services/api'

/**
 * FloatingJourneyOverlay
 *
 * Persistent floating navigation controller that stays active when:
 * 1. User navigates away to other in-app screens (/vibes, /family, /profile).
 * 2. User minimizes or backgrounds the app (triggers PiP Floating Window / Android PiP).
 * Keeps instant access to Live Navigation, Speed, End Journey, and Emergency SOS.
 */
export default function FloatingJourneyOverlay() {
  const location = useLocation()
  const navigate = useNavigate()
  const [journey, setJourney] = useState(getActiveJourney())
  const [showPinModal, setShowPinModal] = useState(false)

  // 1. Subscribe to Live Journey Telemetry
  useEffect(() => {
    return subscribeJourneyState((state) => {
      setJourney({ ...state })
    })
  }, [])

  const handleSOS = async () => {
    const localPin = localStorage.getItem('vibemap_has_sos_pin')
    if (localPin === 'true') {
      navigate('/sos')
      return
    }
    try {
      const res = await getSOSPinStatus()
      const hasPin = res?.data?.has_sos_pin ?? false
      if (!hasPin) {
        setShowPinModal(true)
        return
      }
      navigate('/sos')
    } catch (_) {
      if (localPin === 'false') {
        setShowPinModal(true)
        return
      }
      navigate('/sos')
    }
  }

  if (!journey.isNavigating) return null

  // If already on /map, only show the PiP Minimize button in the header
  const isOnMap = location.pathname === '/map'

  const durationMin = journey.durationSeconds
    ? Math.max(1, Math.round(journey.durationSeconds / 60))
    : null
  const distanceKm = journey.distanceMeters
    ? (journey.distanceMeters / 1000).toFixed(1)
    : null

  return (
    <>
      {/* IN-APP FLOATING JOURNEY BAR (When on /family, /vibes, /profile) */}
      {!isOnMap && (
        <div style={{
          position: 'fixed',
          top: 'calc(10px + env(safe-area-inset-top))',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 24px)',
          maxWidth: 460,
          zIndex: 9990,
          background: 'rgba(12, 12, 20, 0.95)',
          border: '1px solid rgba(6, 182, 212, 0.4)',
          borderRadius: 16,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 16px rgba(6,182,212,0.2)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          fontFamily: 'Inter, sans-serif',
          pointerEvents: 'auto',
          animation: 'fadeIn 0.3s ease-out',
        }}>
          {/* Destination & ETA Info */}
          <div
            onClick={() => navigate('/map')}
            style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
          >
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#ffffff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <Navigation2 size={14} color="#06b6d4" />
              <span>{journey.destination?.label || 'Active Journey'}</span>
            </div>
            <div style={{ fontSize: 11, color: '#06b6d4', fontWeight: 600, marginTop: 2 }}>
              {durationMin ? `${durationMin} min (${distanceKm} km)` : 'Navigating...'}
              {' · '}
              <span style={{ color: '#a78bfa' }}>{journey.speedKmh || 0} km/h</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Quick SOS Button */}
            <button
              type="button"
              onClick={handleSOS}
              style={{
                background: '#dc2626',
                border: 'none',
                borderRadius: 8,
                padding: '7px 11px',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 0 10px rgba(220,38,38,0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <PhoneCall size={12} />
              <span>SOS</span>
            </button>

            {/* Return to Map Button */}
            <button
              type="button"
              onClick={() => navigate('/map')}
              style={{
                background: '#7c3aed',
                border: 'none',
                borderRadius: 8,
                padding: '7px 12px',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>Map</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* PIN REQUIRED MODAL */}
      {showPinModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, padding: 24,
        }}>
          <div style={{
            background: 'rgba(18,18,26,0.98)', border: '1px solid rgba(245,158,11,0.4)',
            borderRadius: 20, padding: '32px 24px', width: '100%', maxWidth: 380, textAlign: 'center',
          }}>
            <Lock size={40} color="#f59e0b" style={{ margin: '0 auto 8px' }} />
            <h3 style={{ color: 'white', fontSize: 18, fontWeight: 700, margin: '14px 0 8px' }}>
              Set your SOS PIN first
            </h3>
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
              You need a 4-digit SOS PIN before using the emergency button. Set it up now in your profile.
            </p>
            <button
              onClick={() => { setShowPinModal(false); navigate('/profile') }}
              style={{
                width: '100%', padding: '12px', background: '#7c3aed',
                border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                marginBottom: 10,
              }}
            >
              Set PIN Now
            </button>
            <button
              onClick={() => setShowPinModal(false)}
              style={{
                width: '100%', padding: '12px', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#94a3b8', fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}
