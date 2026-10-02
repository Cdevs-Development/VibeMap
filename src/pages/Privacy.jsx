import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'

export default function Privacy() {
  const navigate = useNavigate()

  const sections = [
    {
      icon: '🔒',
      title: '1. Information We Collect',
      body: 'We collect personal information necessary to deliver safety navigation and emergency services: (a) Account data: full name, phone number, email address, and encrypted credentials; (b) Telemetry data: real-time GPS coordinates, Wi-Fi/Cellular signals, accuracy radiuses, speeds, and device heading; (c) Emergency contacts: names and phone numbers of your designated beneficiaries.'
    },
    {
      icon: '⚙️',
      title: '2. How We Use Your Data',
      body: 'Your data is utilized strictly to: (a) Provide turn-by-turn navigation and road routing; (b) Broadcast live location to your confirmed beneficiaries; (c) Transmit immediate distress packets during an SOS trigger; (d) Calculate road conditions and verify community vibe pins; (e) Safeguard your account against fraud and unauthorized access.'
    },
    {
      icon: '🛰️',
      title: '3. Real-Time Location Privacy & Controls',
      body: 'You maintain granular control over your location visibility. You can toggle location sharing on or off at any moment in the Profile or Family Map settings. When location sharing is disabled, your coordinates are not broadcast to any contacts. When an SOS alert is activated, emergency coordinates are transmitted to your emergency network until safely cancelled with your 4-digit PIN.'
    },
    {
      icon: '🛡️',
      title: '4. Data Sharing & Third Parties',
      body: 'We DO NOT sell, monetize, or rent your personal or location data to advertisers or third-party data brokers. Data is shared exclusively with: (a) Contacts you explicitly authorize as beneficiaries; (b) Infrastructure service providers (e.g., MapTiler for map rendering, SMS gateways for urgent alerts); (c) Emergency services when life safety is at risk.'
    },
    {
      icon: '🇳🇬',
      title: '5. Compliance with NDPR & NDPA 2023',
      body: 'VibeMap complies with the Nigeria Data Protection Act (NDPA 2023) and the Nigeria Data Protection Regulation (NDPR). You have the right to request access to your data, correct inaccuracies, object to automated processing, and request complete account deletion.'
    },
    {
      icon: '🗄️',
      title: '6. Data Retention & Erasure',
      body: 'Live trip location pings are automatically purged after 90 days. Emergency SOS records are securely archived for up to 12 months for legal and safety auditing. You can initiate complete account deactivation and data erasure at any time directly within your Profile settings.'
    },
    {
      icon: '🔐',
      title: '7. Cryptographic Security & PIN Protection',
      body: 'All communications between your device and our servers are encrypted using TLS 1.3 encryption. SOS cancellation PINs are irreversibly hashed using secure cryptographic algorithms (bcrypt/Argon2) and cannot be viewed or decrypted by VibeMap staff.'
    },
    {
      icon: '👶',
      title: '8. Children’s Privacy',
      body: 'VibeMap is not directed at individuals under 13 years of age. We do not knowingly collect personal data from children under 13. If you believe a minor has registered without parental authorization, contact our privacy team for swift removal.'
    },
    {
      icon: '📬',
      title: '9. Privacy Inquiries & Data Protection Officer',
      body: 'To exercise your privacy rights, request data exports, or contact our Data Protection Officer, email privacy@vibemap.ng.'
    },
  ]

  return (
    <div
      style={{
        height: '100dvh',
        width: '100vw',
        background: '#080810',
        backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(6,182,212,0.12), transparent 60%)',
        color: '#e2e8f0',
        fontFamily: 'Inter, sans-serif',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Sticky Top Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          width: '100%',
          maxWidth: 600,
          background: 'rgba(8,8,16,0.92)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(6,182,212,0.2)',
          padding: 'calc(16px + env(safe-area-inset-top)) 20px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 50,
          boxSizing: 'border-box',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            background: 'rgba(18,18,26,0.9)',
            border: '1px solid rgba(6,182,212,0.3)',
            color: '#e2e8f0',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 40,
            transition: 'all 0.15s ease',
          }}
        >
          ← Back
        </button>

        <Logo size="sm" />
      </div>

      {/* Main Content Container */}
      <div
        style={{
          width: '100%',
          maxWidth: 600,
          padding: '24px 20px calc(48px + env(safe-area-inset-bottom))',
          boxSizing: 'border-box',
        }}
      >
        {/* Title Hero */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: '#ffffff',
              fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
              margin: '0 0 6px 0',
              letterSpacing: '-0.5px',
            }}
          >
            Privacy Policy
          </h1>
          <p style={{ color: '#64748b', fontSize: 13, margin: 0, fontWeight: 500 }}>
            Last revised: August 2026 • NDPR & NDPA 2023 Compliant
          </p>
        </div>

        {/* Policy Section Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sections.map((section, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(18,18,26,0.8)',
                border: '1px solid rgba(6,182,212,0.2)',
                borderRadius: 14,
                padding: '18px 20px',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 18 }}>{section.icon}</span>
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#ffffff',
                    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
                    margin: 0,
                  }}
                >
                  {section.title}
                </h3>
              </div>
              <p
                style={{
                  color: '#94a3b8',
                  fontSize: 13,
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {section.body}
              </p>
            </div>
          ))}
        </div>

        {/* Security Summary Footer Card */}
        <div
          style={{
            marginTop: 32,
            padding: '16px 20px',
            background: 'rgba(6,182,212,0.08)',
            border: '1px solid rgba(6,182,212,0.25)',
            borderRadius: 14,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, marginBottom: 4 }}>
            Data Protection Officer
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Email: <span style={{ color: '#06b6d4' }}>privacy@vibemap.ng</span>
          </div>
        </div>
      </div>
    </div>
  )
}
