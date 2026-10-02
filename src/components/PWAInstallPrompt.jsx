import React, { useState, useEffect, useRef } from 'react'
import { isAppInstalled, markAppInstalled } from '../services/pwaService'

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(window.deferredPrompt || null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showHelperModal, setShowHelperModal] = useState(false)
  const [isInstalled, setIsInstalled] = useState(isAppInstalled())
  const [browserType, setBrowserType] = useState('browser')

  // Live APK Download Progress State
  const [downloadState, setDownloadState] = useState('idle') // 'idle' | 'downloading' | 'completed' | 'error'
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadBytes, setDownloadBytes] = useState({ loaded: '0.0', total: '4.6' })
  const xhrRef = useRef(null)

  const downloadApkWithProgress = () => {
    setDownloadState('downloading')
    setDownloadProgress(0)
    setDownloadBytes({ loaded: '0.0', total: '10.5' })
    setShowHelperModal(true)

    try {
      if (xhrRef.current) {
        xhrRef.current.abort()
      }

      const xhr = new XMLHttpRequest()
      xhrRef.current = xhr
      xhr.open('GET', '/downloads/vibemap.apk?t=' + Date.now(), true)
      xhr.responseType = 'blob'

      xhr.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          const pct = Math.min(100, Math.round((e.loaded / e.total) * 100))
          setDownloadProgress(pct)
          setDownloadBytes({
            loaded: (e.loaded / 1048576).toFixed(1),
            total: (e.total / 1048576).toFixed(1)
          })
        } else {
          // Fallback simulation if length not computable
          setDownloadProgress((prev) => Math.min(90, prev + 10))
        }
      }

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 206) {
          setDownloadProgress(100)
          setDownloadState('completed')

          try {
            const blob = new Blob([xhr.response], { type: 'application/vnd.android.package-archive' })
            const blobUrl = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.style.display = 'none'
            a.href = blobUrl
            a.download = 'VibeMap.apk'
            document.body.appendChild(a)
            a.click()
            setTimeout(() => {
              document.body.removeChild(a)
              window.URL.revokeObjectURL(blobUrl)
            }, 3000)
          } catch (e) {
            console.warn('Blob download trigger error, using direct navigation:', e)
            window.location.href = '/downloads/vibemap.apk'
          }

          markAppInstalled()
          setIsInstalled(true)
          setShowPrompt(false)
        } else {
          console.warn('APK download HTTP status:', xhr.status)
          setDownloadState('error')
          // Direct fallback
          window.location.href = '/downloads/vibemap.apk'
        }
      }

      xhr.onerror = () => {
        console.warn('XHR download error, falling back to direct link')
        setDownloadState('error')
        window.location.href = '/downloads/vibemap.apk'
      }

      xhr.send()
    } catch (err) {
      console.warn('Failed to initiate XHR download:', err)
      setDownloadState('error')
      window.location.href = '/downloads/vibemap.apk'
    }
  }

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(ua)
    setIsIOS(isIosDevice)

    if (isIosDevice) {
      setBrowserType('ios')
    } else if (/android/.test(ua)) {
      setBrowserType('android')
    } else if (/chrome|crios/.test(ua)) {
      setBrowserType('desktop-chrome')
    } else {
      setBrowserType('other')
    }

    const checkInstalled = () => {
      if (isAppInstalled()) {
        setIsInstalled(true)
      }
    }

    window.addEventListener('vibemap-app-installed', checkInstalled)
    window.addEventListener('appinstalled', checkInstalled)

    // Capture beforeinstallprompt event if supported by browser
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      window.deferredPrompt = e
      setDeferredPrompt(e)
    }

    const handlePromptReady = () => {
      if (window.deferredPrompt) {
        setDeferredPrompt(window.deferredPrompt)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('vibemap-prompt-ready', handlePromptReady)

    // Manual trigger from Profile page or elsewhere
    const handleManualInstallTrigger = () => {
      const currentUa = window.navigator.userAgent.toLowerCase()
      if (/android/.test(currentUa) || !/iphone|ipad|ipod/.test(currentUa)) {
        downloadApkWithProgress()
        return
      }

      const promptToUse = deferredPrompt || window.deferredPrompt
      if (promptToUse) {
        promptToUse.prompt()
        promptToUse.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            markAppInstalled()
            setIsInstalled(true)
            setShowPrompt(false)
            setDeferredPrompt(null)
            window.deferredPrompt = null
          }
        })
      } else {
        setShowHelperModal(true)
      }
    }

    window.addEventListener('open-pwa-install', handleManualInstallTrigger)

    // Show floating banner if user hasn't dismissed it in this session and not standalone
    const hasDismissed = sessionStorage.getItem('vibemap_pwa_dismissed')
    let timer = null
    if (!hasDismissed && !isAppInstalled()) {
      timer = setTimeout(() => {
        if (!isAppInstalled()) {
          setShowPrompt(true)
        }
      }, 2000)
    }

    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('vibemap-prompt-ready', handlePromptReady)
      window.removeEventListener('open-pwa-install', handleManualInstallTrigger)
      window.removeEventListener('vibemap-app-installed', checkInstalled)
      window.removeEventListener('appinstalled', checkInstalled)
      if (xhrRef.current) {
        xhrRef.current.abort()
      }
    }
  }, [deferredPrompt])

  const handleInstallClick = async () => {
    if (browserType === 'android' || (!isIOS && browserType !== 'desktop-chrome')) {
      downloadApkWithProgress()
      return
    }

    const promptToUse = deferredPrompt || window.deferredPrompt
    if (promptToUse) {
      promptToUse.prompt()
      const { outcome } = await promptToUse.userChoice
      if (outcome === 'accepted') {
        markAppInstalled()
        setIsInstalled(true)
        setShowPrompt(false)
        setDeferredPrompt(null)
        window.deferredPrompt = null
      }
    } else {
      setShowHelperModal(true)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    sessionStorage.setItem('vibemap_pwa_dismissed', 'true')
  }

  return (
    <>
      <style>{`
        @keyframes floatBanner {
          from { transform: translateY(80px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 16px rgba(139,92,246,0.3); }
          50% { box-shadow: 0 0 28px rgba(139,92,246,0.7); }
        }
        @keyframes progressShimmer {
          0% { background-position: -200px 0; }
          100% { background-position: 200px 0; }
        }
      `}</style>

      {/* Floating Install Prompt Banner (Only when not installed and not dismissed) */}
      {showPrompt && !isInstalled && (
        <div style={floatingCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={appIconStyle}>
              ⚡
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>
                {browserType === 'android' ? 'Download VibeMap Android APK' : 'Install VibeMap App'}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, lineHeight: 1.3 }}>
                {browserType === 'android'
                  ? 'Real native APK with 24/7 background location, siren alarms & radar.'
                  : 'Get full-screen speed, instant siren alarms & offline map access.'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={handleDismiss}
              style={dismissBtnStyle}
            >
              Later
            </button>
            <button
              onClick={handleInstallClick}
              style={installBtnStyle}
            >
              {browserType === 'android' ? '📲 Download APK' : '📲 Install App'}
            </button>
          </div>
        </div>
      )}

      {/* Browser Install & APK Download Progress Modal */}
      {showHelperModal && (
        <div style={overlayStyle} onClick={() => setShowHelperModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>
                {browserType === 'android' ? 'VibeMap Android APK' : 'How to Install VibeMap'}
              </div>
              <button
                onClick={() => setShowHelperModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer', padding: 4 }}
              >
                ✕
              </button>
            </div>

            {browserType === 'android' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13, color: '#cbd5e1' }}>
                {/* Download Status & Live Progress Bar */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(139, 92, 246, 0.35)',
                  borderRadius: 14,
                  padding: '14px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
                      {downloadState === 'downloading' ? '📥 Downloading VibeMap.apk...' : downloadState === 'completed' ? '✅ Download Complete!' : '📦 VibeMap.apk (8.6 MB)'}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa' }}>
                      {downloadState === 'downloading' ? `${downloadProgress}%` : downloadState === 'completed' ? '100%' : '8.6 MB'}
                    </span>
                  </div>

                  {/* Progress track */}
                  <div style={{
                    width: '100%',
                    height: 8,
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <div style={{
                      width: `${downloadState === 'completed' ? 100 : downloadProgress}%`,
                      height: '100%',
                      background: downloadState === 'completed'
                        ? 'linear-gradient(90deg, #10b981, #059669)'
                        : 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
                      borderRadius: 8,
                      transition: 'width 0.2s ease-out'
                    }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 11, color: '#94a3b8' }}>
                    <span>{downloadState === 'downloading' ? `${downloadBytes.loaded} MB of ${downloadBytes.total} MB` : 'Direct Android Package'}</span>
                    <span>{downloadState === 'downloading' ? 'Saving to device...' : downloadState === 'completed' ? 'Ready to Install' : 'Latest Build'}</span>
                  </div>
                </div>

                {/* 3 Step Installation Instructions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Installation Steps
                  </div>
                  <div style={stepRowStyle}>
                    <span style={{ fontSize: 18 }}>1️⃣</span>
                    <div>Tap <b>Open</b> on downloaded file (or swipe down notification bar).</div>
                  </div>
                  <div style={stepRowStyle}>
                    <span style={{ fontSize: 18 }}>2️⃣</span>
                    <div>If asked <b>'Allow install from unknown sources'</b>, toggle <b>Allow</b>.</div>
                  </div>
                  <div style={stepRowStyle}>
                    <span style={{ fontSize: 18 }}>3️⃣</span>
                    <div>Tap <b>Install</b> to enable 24/7 background location & live siren radar!</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  {downloadState !== 'downloading' && (
                    <button
                      type="button"
                      onClick={downloadApkWithProgress}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, #7c3aed, #0284c7)',
                        border: 'none',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(124, 58, 237, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <span>🔄 {downloadState === 'completed' ? 'Re-Download APK' : 'Download APK Now'}</span>
                    </button>
                  )}

                  <a
                    href="/downloads/vibemap.apk"
                    download="VibeMap.apk"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '10px',
                      borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#cbd5e1',
                      textDecoration: 'none',
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    <span>Direct Browser Download Link ➔</span>
                  </a>
                </div>
              </div>
            ) : isIOS ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: '#cbd5e1' }}>
                <div style={stepRowStyle}>
                  <span style={{ fontSize: 20 }}>1️⃣</span>
                  <div>Tap the <b>Share button (⎋)</b> in your Safari browser bottom bar.</div>
                </div>
                <div style={stepRowStyle}>
                  <span style={{ fontSize: 20 }}>2️⃣</span>
                  <div>Scroll down and select <b>'Add to Home Screen' (⊕)</b>.</div>
                </div>
                <div style={stepRowStyle}>
                  <span style={{ fontSize: 20 }}>3️⃣</span>
                  <div>Tap <b>Add</b> in the top right corner. Done!</div>
                </div>
              </div>
            ) : browserType === 'desktop-chrome' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: '#cbd5e1' }}>
                <div style={stepRowStyle}>
                  <span style={{ fontSize: 20 }}>1️⃣</span>
                  <div>Look at the right side of your browser <b>address bar</b>.</div>
                </div>
                <div style={stepRowStyle}>
                  <span style={{ fontSize: 20 }}>2️⃣</span>
                  <div>Click the <b>Install App icon (⊕ or 💻)</b>.</div>
                </div>
                <div style={stepRowStyle}>
                  <span style={{ fontSize: 20 }}>3️⃣</span>
                  <div>Or click browser menu <b>(⋮) ➔ Save and Share ➔ Install VibeMap</b>.</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: '#cbd5e1' }}>
                <div style={stepRowStyle}>
                  <span style={{ fontSize: 20 }}>1️⃣</span>
                  <div>Tap your browser menu button <b>(⋮)</b> in the top or bottom corner.</div>
                </div>
                <div style={stepRowStyle}>
                  <span style={{ fontSize: 20 }}>2️⃣</span>
                  <div>Select <b>'Install App'</b> or <b>'Add to Home Screen'</b>.</div>
                </div>
                <div style={stepRowStyle}>
                  <span style={{ fontSize: 20 }}>3️⃣</span>
                  <div>Confirm install to use VibeMap as a standalone app!</div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowHelperModal(false)}
              style={{
                width: '100%',
                marginTop: 14,
                padding: '11px',
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

const floatingCardStyle = {
  position: 'fixed',
  bottom: 84,
  left: 16,
  right: 16,
  maxWidth: 420,
  margin: '0 auto',
  background: 'linear-gradient(165deg, rgba(20, 22, 35, 0.96) 0%, rgba(10, 11, 20, 0.98) 100%)',
  border: '1px solid rgba(139, 92, 246, 0.45)',
  borderRadius: 18,
  padding: '14px 16px',
  boxShadow: '0 16px 36px rgba(0,0,0,0.7), 0 0 24px rgba(139,92,246,0.25)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  zIndex: 9999,
  animation: 'floatBanner 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
}

const appIconStyle = {
  width: 40,
  height: 40,
  borderRadius: 12,
  background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 20,
  color: '#fff',
  flexShrink: 0,
  boxShadow: '0 4px 12px rgba(139,92,246,0.35)',
}

const dismissBtnStyle = {
  flex: 1,
  padding: '8px 12px',
  borderRadius: 10,
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  color: '#94a3b8',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
}

const installBtnStyle = {
  flex: 2,
  padding: '8px 14px',
  borderRadius: 10,
  background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
  border: 'none',
  color: '#ffffff',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
  boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)',
}

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.85)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  zIndex: 100000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
}

const modalStyle = {
  width: '100%',
  maxWidth: 400,
  background: 'linear-gradient(165deg, #161828 0%, #0e101c 100%)',
  border: '1px solid rgba(139,92,246,0.35)',
  borderRadius: 20,
  padding: 20,
  boxShadow: '0 24px 48px rgba(0,0,0,0.85)',
}

const stepRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  padding: '10px 12px',
  borderRadius: 10,
}
