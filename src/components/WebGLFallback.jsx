import React from 'react'

export default function WebGLFallback({ onRetry }) {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconContainer}>
          <span style={{ fontSize: 32 }}>🗺️</span>
        </div>

        <h2 style={styles.title}>Hardware Acceleration Needed</h2>

        <p style={styles.description}>
          VibeMap’s interactive 3D map requires <strong>WebGL (Hardware Acceleration)</strong> to render vector tiles smoothly.
        </p>

        <div style={styles.tipsBox}>
          <div style={styles.tipItem}>
            <strong>📱 Chrome / Edge:</strong> Settings &gt; System &gt; Turn ON <em>"Use graphics acceleration when available"</em>.
          </div>
          <div style={styles.tipItem}>
            <strong>🍏 Safari:</strong> Settings &gt; Advanced &gt; Ensure WebGL is enabled.
          </div>
          <div style={styles.tipItem}>
            <strong>🔋 Mobile Devices:</strong> If your phone is in <em>Ultra Battery Saver</em> mode, WebGL may be temporarily disabled.
          </div>
        </div>

        <button
          onClick={onRetry || (() => window.location.reload())}
          style={styles.retryBtn}
        >
          🔄 Try Reloading Map
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    background: '#080810',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: 'Inter, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: 'rgba(15, 15, 26, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: '28px 22px',
    textAlign: 'center',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(16px)',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: '50%',
    background: 'rgba(139, 92, 246, 0.15)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px auto',
  },
  title: {
    color: '#f8fafc',
    fontSize: 19,
    fontWeight: 700,
    marginBottom: 8,
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
  },
  description: {
    color: '#94a3b8',
    fontSize: 13.5,
    lineHeight: 1.5,
    marginBottom: 18,
  },
  tipsBox: {
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    border: '1px solid rgba(255, 255, 255, 0.06)',
    padding: '14px',
    textAlign: 'left',
    marginBottom: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  tipItem: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 1.4,
  },
  retryBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    boxShadow: '0 4px 14px rgba(139, 92, 246, 0.3)',
  },
}
