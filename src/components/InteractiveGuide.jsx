import React, { useState, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  X,
  Check
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Styles defined FIRST to prevent TDZ ReferenceError on module load
// ─────────────────────────────────────────────────────────────────────────────
const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(4, 5, 10, 0.85)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  zIndex: 99999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  boxSizing: 'border-box',
}

const modalStyle = {
  width: '100%',
  maxWidth: 420,
  background: 'linear-gradient(165deg, #121422 0%, #0c0d17 100%)',
  borderRadius: 24,
  border: '1px solid rgba(255, 255, 255, 0.12)',
  padding: '24px 20px',
  boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6), 0 0 32px rgba(139, 92, 246, 0.15)',
  animation: 'tourFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
  boxSizing: 'border-box',
}

const previewBoxStyle = {
  background: 'rgba(255, 255, 255, 0.03)',
  borderRadius: 16,
  padding: 16,
  border: '1px solid rgba(255, 255, 255, 0.07)',
  minHeight: 110,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
}

const miniBadgeStyle = (color) => ({
  background: `${color}18`,
  border: `1px solid ${color}44`,
  color: '#fff',
  fontSize: 11,
  fontWeight: 600,
  padding: '4px 8px',
  borderRadius: 8,
})

const skipBtnStyle = {
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  color: '#94a3b8',
  borderRadius: 12,
  padding: '4px 10px',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
}

const backBtnStyle = {
  padding: '12px 18px',
  borderRadius: 14,
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  color: '#cbd5e1',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
}

const nextBtnStyle = {
  padding: '12px 20px',
  borderRadius: 14,
  border: 'none',
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
  boxShadow: '0 8px 24px rgba(139, 92, 246, 0.35)',
}

// ─────────────────────────────────────────────────────────────────────────────
// Tour Steps
// ─────────────────────────────────────────────────────────────────────────────
const TOUR_STEPS = [
  {
    id: 'welcome',
    badge: 'Welcome to VibeMap',
    title: 'Your City. Your Safety. Your Vibe.',
    description: 'VibeMap is Nigeria\'s real-time community road safety and family tracking platform. Here is a quick 1-minute visual guide on how everything works.',
    icon: '✨',
    color: '#8b5cf6',
    preview: (
      <div style={previewBoxStyle}>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <div style={miniBadgeStyle('#10b981')}>🟢 Safe Area</div>
          <div style={miniBadgeStyle('#f59e0b')}>🟠 Heavy Traffic</div>
          <div style={miniBadgeStyle('#3b82f6')}>🔵 Police Check</div>
          <div style={miniBadgeStyle('#ef4444')}>🔴 Danger Alert</div>
          <div style={miniBadgeStyle('#a855f7')}>🟣 Party / Lit</div>
        </div>
        <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 14, margin: '14px 0 0' }}>
          Live updates crowdsourced directly by verified commuters around you.
        </p>
      </div>
    ),
  },
  {
    id: 'map_pins',
    badge: '1. Live Map & Vibe Pins',
    title: 'Explore & Confirm Real-Time Reports',
    description: 'Browse your city\'s interactive map to see active pins. Tap any pin on the map to view reports, upvote/confirm accuracy, or calculate routes.',
    icon: '🗺️',
    color: '#06b6d4',
    preview: (
      <div style={previewBoxStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.06)', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
            🚨
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Road Block / Armed Alert</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Ozumba Mbadiwe Ave · 4 mins ago</div>
          </div>
          <div style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontWeight: 700 }}>
            ✓ 14 Confirms
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#38bdf8', marginTop: 10, textAlign: 'center' }}>
          💡 Tap <b>✓ Confirm</b> on pins you pass by to earn reputation points!
        </div>
      </div>
    ),
  },
  {
    id: 'report_vibe',
    badge: '2. Reporting Vibes',
    title: 'Drop a Pin in 5 Seconds',
    description: 'Encountered police checkpoint, accident, or flood? Tap the purple "+" button at the bottom center to alert your community instantly.',
    icon: '📢',
    color: '#ec4899',
    preview: (
      <div style={previewBoxStyle}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            color: '#fff',
            boxShadow: '0 0 24px rgba(236,72,153,0.5)',
            border: '2px solid rgba(255,255,255,0.4)',
            animation: 'tourPulse 2s infinite ease-in-out'
          }}>
            📢
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#cbd5e1', textAlign: 'center', lineHeight: 1.4 }}>
          Select category → Add a short note → Tap <b>Post Vibe</b>.<br />Your report appears live on everyone\'s map in milliseconds.
        </div>
      </div>
    ),
  },
  {
    id: 'emergency_sos',
    badge: '3. Emergency SOS & Siren',
    title: 'Lifesaving Beneficiary Broadcast',
    description: 'In an emergency, tapping the red SOS button sounds an urgent alarm siren on your beneficiaries\' phones and transmits your live GPS coordinates.',
    icon: '🚨',
    color: '#ef4444',
    preview: (
      <div style={previewBoxStyle}>
        <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 24, animation: 'tourSiren 0.8s infinite' }}>🚨</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#ef4444' }}>EMERGENCY BROADCAST ACTIVE</div>
              <div style={{ fontSize: 11, color: '#fca5a5' }}>Beneficiaries hearing siren alert...</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#cbd5e1', background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: 8 }}>
            🔐 <b>SOS PIN Protection:</b> Set your 4-digit PIN in Profile so an attacker cannot force-cancel your distress signal!
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'family_radar',
    badge: '4. Family & Beneficiary Radar',
    title: 'Watch & Protect Loved Ones',
    description: 'Add trusted friends and family under Profile or Family Map. When location sharing is ON, you can see their live movements and battery/trip status.',
    icon: '🛡️',
    color: '#10b981',
    preview: (
      <div style={previewBoxStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.06)', padding: '10px 12px', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff' }}>
                MO
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Mum</div>
                <div style={{ fontSize: 10, color: '#10b981' }}>🟢 Sharing Live Location</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Live on Map 📍</div>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 4 }}>
            💡 Toggle your own <b>Location Sharing</b> anytime in Profile or Family Map.
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'smart_trips',
    badge: '5. Safe Arrival Trips',
    title: 'Automatic Journey Monitoring',
    description: 'Heading out late or commuting through new areas? Search your destination on the map and tap "Start Journey" to track your ETA.',
    icon: '🚗',
    color: '#f59e0b',
    preview: (
      <div style={previewBoxStyle}>
        <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>🚗 Trip to Lekki Phase 1</span>
            <span style={{ fontSize: 11, color: '#fcd34d', fontWeight: 600 }}>ETA 24 mins</span>
          </div>
          <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.4 }}>
            Your designated beneficiaries receive updates if you deviate from your route or take unexpectedly long to arrive.
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'notifications_center',
    badge: '6. Notifications & Audio Alerts',
    title: 'Real-Time Alerts with Sound',
    description: 'Stay updated instantly with sound alerts when someone confirms your vibes, adds or removes you as a contact, or triggers emergency assistance.',
    icon: '🔔',
    color: '#38bdf8',
    preview: (
      <div style={previewBoxStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)', padding: '8px 10px', borderRadius: 10 }}>
            <span style={{ fontSize: 16 }}>🔔</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Vibe Confirmed (+5 Rep)</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>A commuter verified your traffic pin</div>
            </div>
            <span style={{ fontSize: 10, color: '#38bdf8' }}>🔊 Sound</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', padding: '8px 10px', borderRadius: 10 }}>
            <span style={{ fontSize: 16 }}>🚨</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>Beneficiary SOS Alert</div>
              <div style={{ fontSize: 10, color: '#fca5a5' }}>Live emergency alarm on your device</div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
          💡 Tap the <b>🔔 Bell icon</b> on your map to view, listen, or <b>Clear All</b> notifications.
        </div>
      </div>
    ),
  },
]

export default function InteractiveGuide() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    // Check if user has already seen the tour
    const hasSeenTour = localStorage.getItem('vibemap_has_seen_tour')
    const token = localStorage.getItem('vibemap_token')
    
    // Automatically open tour for first-time logged in users
    if (token && hasSeenTour !== 'true') {
      const timer = setTimeout(() => {
        setIsOpen(true)
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const handleOpenTour = () => {
      setCurrentStep(0)
      setIsOpen(true)
    }

    window.addEventListener('open-vibemap-tour', handleOpenTour)
    return () => window.removeEventListener('open-vibemap-tour', handleOpenTour)
  }, [])

  const handleClose = () => {
    localStorage.setItem('vibemap_has_seen_tour', 'true')
    setIsOpen(false)
  }

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      handleClose()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  if (!isOpen) return null

  const step = TOUR_STEPS[currentStep] || TOUR_STEPS[0]
  const isLast = currentStep === TOUR_STEPS.length - 1

  return (
    <div style={overlayStyle}>
      <style>{`
        @keyframes tourFadeIn {
          from { opacity: 0; transform: scale(0.92) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes tourPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 16px rgba(236,72,153,0.4); }
          50% { transform: scale(1.08); box-shadow: 0 0 28px rgba(236,72,153,0.8); }
        }
        @keyframes tourSiren {
          0%, 100% { transform: rotate(-8deg) scale(1.05); }
          50% { transform: rotate(8deg) scale(1.15); }
        }
      `}</style>

      <div style={modalStyle}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: `${step.color}22`,
            border: `1px solid ${step.color}66`,
            color: step.color,
            padding: '4px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.3px',
          }}>
            <span>{step.icon}</span>
            <span>{step.badge}</span>
          </div>

          <button
            onClick={handleClose}
            style={{ ...skipBtnStyle, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            title="Skip walkthrough"
          >
            <X size={12} />
            <span>Skip</span>
          </button>
        </div>

        {/* Title & Description */}
        <h2 style={{
          fontSize: 20,
          fontWeight: 800,
          color: '#ffffff',
          margin: '0 0 8px 0',
          fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
          lineHeight: 1.25,
        }}>
          {step.title}
        </h2>

        <p style={{
          fontSize: 13,
          color: '#94a3b8',
          margin: '0 0 18px 0',
          lineHeight: 1.5,
          fontFamily: 'Inter, sans-serif',
        }}>
          {step.description}
        </p>

        {/* Visual Animated Preview Card */}
        <div style={{ marginBottom: 20 }}>
          {step.preview}
        </div>

        {/* Step Indicator Pills */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
          {TOUR_STEPS.map((_, idx) => (
            <div
              key={idx}
              onClick={() => setCurrentStep(idx)}
              style={{
                width: idx === currentStep ? 24 : 8,
                height: 6,
                borderRadius: 4,
                background: idx === currentStep ? step.color : 'rgba(255,255,255,0.18)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {currentStep > 0 && (
            <button
              onClick={handlePrev}
              style={{ ...backBtnStyle, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ChevronLeft size={14} />
              <span>Back</span>
            </button>
          )}

          <button
            onClick={handleNext}
            style={{
              ...nextBtnStyle,
              background: isLast ? '#10b981' : '#7c3aed',
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {isLast ? (
              <>
                <Check size={16} />
                <span>Got It! Let's Go</span>
              </>
            ) : (
              <>
                <span>Next Step</span>
                <ChevronRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
