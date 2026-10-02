import React from 'react'

/**
 * Standardized VibeMap Logo Component
 *
 * @param {Object} props
 * @param {'xs' | 'sm' | 'md' | 'lg' | 'xl'} [props.size='md'] - Preset sizing
 * @param {boolean} [props.withTagline=false] - Whether to show the brand tagline
 * @param {string} [props.taglineText='Your city. Your safety. Your vibe.'] - Custom tagline
 * @param {Object} [props.style={}] - Additional container style
 * @param {boolean} [props.animated=true] - Subtle ambient pulse on the pin
 * @param {Function} [props.onClick] - Optional click handler
 */
export default function Logo({
  size = 'md',
  withTagline = false,
  taglineText = 'Your city. Your safety. Your vibe.',
  style = {},
  animated = true,
  onClick,
}) {
  const sizeMap = {
    xs: { text: 16, icon: 16, gap: 4, tagline: 10, margin: 2 },
    sm: { text: 19, icon: 19, gap: 5, tagline: 11, margin: 4 },
    md: { text: 28, icon: 26, gap: 6, tagline: 12, margin: 6 },
    lg: { text: 34, icon: 30, gap: 8, tagline: 13, margin: 8 },
    xl: { text: 40, icon: 36, gap: 8, tagline: 14, margin: 10 },
  }

  const currentSize = sizeMap[size] || sizeMap.md

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        ...style,
      }}
      onClick={onClick}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: currentSize.gap,
          lineHeight: 1,
        }}
      >
        <span
          style={{
            fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
            fontSize: currentSize.text,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <span style={{ color: '#ffffff' }}>Vibe</span>
          <span
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Map
          </span>
        </span>

        {/* Custom Glowing Gradient Map Pin */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: currentSize.icon,
            height: currentSize.icon,
            filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.65))',
            animation: animated ? 'vibePinFloat 3s ease-in-out infinite' : 'none',
            flexShrink: 0,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={currentSize.icon}
            height={currentSize.icon}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="vibePinGradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            <path
              d="M12 2C7.58 2 4 5.58 4 10C4 15.25 12 22 12 22C12 22 20 15.25 20 10C20 5.58 16.42 2 12 2Z"
              fill="url(#vibePinGradient)"
            />
            <circle cx="12" cy="10" r="3.2" fill="#080810" />
            <circle cx="12" cy="10" r="1.8" fill="#06b6d4" />
          </svg>
        </div>
      </div>

      {withTagline && (
        <p
          style={{
            color: '#64748b',
            fontSize: currentSize.tagline,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            marginTop: currentSize.margin,
            marginBottom: 0,
            letterSpacing: '0.2px',
            textAlign: 'center',
          }}
        >
          {taglineText}
        </p>
      )}

      <style>{`
        @keyframes vibePinFloat {
          0%, 100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-2px) scale(1.06);
          }
        }
      `}</style>
    </div>
  )
}
