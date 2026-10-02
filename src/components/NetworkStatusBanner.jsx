import React, { useState, useEffect } from 'react'

/**
 * NetworkStatusBanner
 *
 * Provides non-intrusive ambient network status indicators:
 * - Floating amber pill when connection is offline ("⚡ Offline — Serving from local cache").
 * - Brief green pill when connection restores ("🟢 Back Online — Syncing location...").
 */
export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowReconnected(true)
      const timer = setTimeout(() => {
        setShowReconnected(false)
      }, 3000)
      return () => clearTimeout(timer)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowReconnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline && !showReconnected) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(12px + env(safe-area-inset-top))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        pointerEvents: 'none',
        animation: 'bannerSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          background: !isOnline
            ? 'rgba(245, 158, 11, 0.95)'
            : 'rgba(16, 185, 129, 0.95)',
          color: '#080810',
          padding: '6px 14px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          boxShadow: !isOnline
            ? '0 4px 20px rgba(245, 158, 11, 0.4)'
            : '0 4px 20px rgba(16, 185, 129, 0.4)',
          backdropFilter: 'blur(10px)',
          letterSpacing: '0.2px',
        }}
      >
        <span>{!isOnline ? '⚡' : '🟢'}</span>
        <span>
          {!isOnline
            ? 'Offline Mode — Serving from local cache'
            : 'Back Online — Syncing pings...'}
        </span>
      </div>

      <style>{`
        @keyframes bannerSlideDown {
          from {
            opacity: 0;
            transform: translate(-50%, -12px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </div>
  )
}
