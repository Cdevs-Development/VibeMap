import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'

const KNOWN_RESTRICTIVE_BRANDS = ['xiaomi', 'huawei', 'honor', 'oppo', 'vivo', 'samsung', 'tecno', 'infinix', 'itel']

export default function BackgroundProtectionModal() {
  const [visible, setVisible] = useState(false)
  const [manufacturer, setManufacturer] = useState('')
  const [checking, setChecking] = useState(false)
  const location = useLocation()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    if (!window.NativeVibeMap) return

    const alreadyShown = localStorage.getItem('vibemap_bg_protection_shown')
    if (alreadyShown) return

    // If not authenticated yet, wait until user is logged in
    const token = localStorage.getItem('vibemap_token')
    if (!token) return

    try {
      const brand = window.NativeVibeMap.getDeviceManufacturer?.() || ''
      const isExempt = window.NativeVibeMap.isIgnoringBatteryOptimizations?.() ?? true

      if (!isExempt && KNOWN_RESTRICTIVE_BRANDS.includes(brand)) {
        setManufacturer(brand)
        setVisible(true)
      }
    } catch (e) {
      console.warn('[BackgroundProtection] Detection failed:', e)
    }
  }, [location?.pathname])

  const handleOpenSettings = () => {
    setChecking(true)
    try {
      window.NativeVibeMap?.openOEMBatterySettings?.()
    } catch (e) {
      console.warn('[BackgroundProtection] Could not open settings:', e)
    }
  }

  const handleDismiss = (permanent = true) => {
    if (permanent) {
      localStorage.setItem('vibemap_bg_protection_shown', 'true')
    }
    setVisible(false)
  }

  // Re-check when user returns to the app after visiting settings
  useEffect(() => {
    if (!checking) return
    const handleVisibility = () => {
      if (!document.hidden) {
        const isExempt = window.NativeVibeMap?.isIgnoringBatteryOptimizations?.() ?? true
        if (isExempt) {
          handleDismiss(true)
        }
        setChecking(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [checking])

  if (!visible) return null

  const brandLabel = manufacturer ? (manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1)) : 'Your'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 150, padding: 24,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    }}>
      <div style={{
        background: 'rgba(18,18,26,0.98)',
        border: '1px solid rgba(139,92,246,0.4)',
        borderRadius: 20,
        padding: '32px 24px',
        width: '100%',
        maxWidth: 380,
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          width: 64, height: 64,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
          margin: '0 auto 16px',
          boxShadow: '0 0 24px rgba(139,92,246,0.4)',
        }}>
          🔋
        </div>

        <h3 style={{
          color: 'white', fontSize: 20, fontWeight: 700,
          margin: '0 0 12px',
          fontFamily: "'Syne', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
        }}>
          One Last Step for Your Safety
        </h3>

        <p style={{
          color: '#94a3b8', fontSize: 13, lineHeight: 1.6, marginBottom: 8,
          fontFamily: "'Inter', sans-serif",
        }}>
          {brandLabel} phones have an extra battery setting that can stop VibeMap from tracking your location when the app is closed.
        </p>

        <p style={{
          color: '#94a3b8', fontSize: 13, lineHeight: 1.6, marginBottom: 24,
          fontFamily: "'Inter', sans-serif",
        }}>
          Tap below, then turn <span style={{ color: '#06b6d4', fontWeight: 600 }}>ON</span> background activity or autostart for VibeMap.
        </p>

        <button
          onClick={handleOpenSettings}
          style={{
            width: '100%', padding: '14px',
            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            border: 'none', borderRadius: 12,
            color: 'white', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: "'Inter', sans-serif",
            marginBottom: 12, minHeight: 48,
            boxShadow: '0 0 20px rgba(139,92,246,0.3)',
          }}
        >
          Open Battery Settings
        </button>

        <button
          onClick={() => handleDismiss(true)}
          style={{
            width: '100%', padding: '14px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            color: '#64748b', fontSize: 14,
            cursor: 'pointer', minHeight: 48,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Maybe Later
        </button>
      </div>
    </div>
  )
}
