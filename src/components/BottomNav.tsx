import React from 'react'
import { useNavigate } from 'react-router-dom'

export interface BottomNavProps {
  activeTab?: 'map' | 'family' | 'vibes' | 'profile' | string
  visible?: boolean
  onTabChange?: (tabId: string) => void
}

/**
 * Standardized Unified Bottom Navigation Bar for VibeMap (Web & Mobile APK)
 */
export default function BottomNav({
  activeTab = 'map',
  visible = true,
  onTabChange,
}: BottomNavProps) {
  const navigate = useNavigate()

  if (!visible) return null

  const isPinMissing = typeof window !== 'undefined' && localStorage.getItem('vibemap_has_sos_pin') === 'false'

  const tabs = [
    { id: 'map', icon: '🗺️', label: 'Map', path: '/map' },
    { id: 'family', icon: '👨‍👩‍👧', label: 'Family', path: '/family' },
    { id: 'vibes', icon: '💜', label: 'Vibes', path: '/vibes' },
    { id: 'profile', icon: '👤', label: 'Profile', path: '/profile', alert: isPinMissing },
  ]

  const handleTabClick = (tab: { id: string; path: string; alert?: boolean }) => {
    if (isPinMissing && tab.id !== 'profile') {
      // Force navigation to profile with prompt
      navigate('/profile?pin_required=true')
      window.dispatchEvent(new CustomEvent('vibemap-prompt-sos-pin'))
      return
    }

    if (typeof onTabChange === 'function') {
      onTabChange(tab.id)
    } else {
      navigate(tab.path)
    }
  }

  return (
    <nav
      aria-label="Bottom Navigation"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        maxWidth: '500px',
        margin: '0 auto',
        pointerEvents: 'none',
        zIndex: 40,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          height: 'calc(var(--bnav-height, 60px) + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
          background: 'rgba(8, 8, 16, 0.98)',
          borderTop: isPinMissing ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(139, 92, 246, 0.3)',
          borderLeft: 'none',
          borderRight: 'none',
          borderBottom: 'none',
          borderRadius: '20px 20px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: isPinMissing ? '0 -4px 32px rgba(239, 68, 68, 0.25)' : '0 -4px 32px rgba(0, 0, 0, 0.6)',
          pointerEvents: 'auto',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab)}
              style={{
                background: 'transparent',
                border: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--bnav-gap, 2px)',
                cursor: 'pointer',
                color: isActive ? '#8b5cf6' : (tab.alert ? '#ef4444' : '#64748b'),
                fontFamily: 'Inter, sans-serif',
                fontSize: 'var(--bnav-label-size, 9.5px)',
                fontWeight: isActive ? 600 : 400,
                position: 'relative',
                padding: 'var(--bnav-padding, 6px 10px)',
                minWidth: 'var(--bnav-btn-size, 40px)',
                minHeight: 'var(--bnav-btn-size, 40px)',
                transition: 'color 0.2s ease, transform 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 'var(--bnav-icon-size, 16px)' }}>{tab.icon}</span>
                {tab.alert && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -4,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#ef4444',
                      boxShadow: '0 0 8px #ef4444',
                    }}
                  />
                )}
              </div>
              <span>{tab.label}</span>
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 'calc(4px + env(safe-area-inset-bottom, 0px))',
                    width: 'var(--bnav-line-width, 16px)',
                    height: 'var(--bnav-line-height, 2px)',
                    borderRadius: 2,
                    background: '#8b5cf6',
                    boxShadow: '0 0 8px #8b5cf6',
                  }}
                />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
