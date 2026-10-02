import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'

export default function Terms() {
  const navigate = useNavigate()

  const sections = [
    {
      icon: '📜',
      title: '1. Acceptance of Terms',
      body: 'By downloading, accessing, or using VibeMap (the "Application"), you enter into a legally binding agreement with VibeMap and cdev ("we", "us", or "our"). These Terms of Service govern your use of the Application, location-sharing tools, safety alarms, and related services in Nigeria and other operating territories. If you do not agree to these terms, you must discontinue using the Application immediately.'
    },
    {
      icon: '🗺️',
      title: '2. Description of the Safety & Navigation Service',
      body: 'VibeMap is a safety-first real-time navigation, social discovery, and emergency telemetry platform. Key services include turn-by-turn road navigation, community-sourced vibe & hazard reporting, real-time location sharing with designated beneficiaries, emergency SOS broadcast notifications, and safe-route guidance.'
    },
    {
      icon: '🛡️',
      title: '3. User Eligibility & Account Responsibilities',
      body: 'You must be at least 13 years of age to use VibeMap. You are solely responsible for maintaining the confidentiality of your credentials, 4-digit SOS PIN, and connected devices. You agree to provide accurate, up-to-date registration details and notify us immediately if you suspect unauthorized access to your account.'
    },
    {
      icon: '📍',
      title: '4. Location Sharing & Beneficiary Permissions',
      body: 'VibeMap collects and processes your GPS, Wi-Fi, and sensor telemetry to power live maps and safety features. Your real-time location is ONLY broadcast to contacts you have explicitly added as mutual beneficiaries. You can pause or revoke location sharing at any time via the Profile or Family Map settings. In an emergency SOS event, your live coordinates are automatically shared with all designated emergency contacts.'
    },
    {
      icon: '🚨',
      title: '5. Emergency SOS & Prohibited Misuse',
      body: 'The SOS emergency feature is intended strictly for genuine safety threats and emergencies. Submitting fraudulent, malicious, or false distress signals is strictly prohibited and constitutes a violation of these terms. Abuse of the emergency broadcast system may result in immediate account termination and legal reporting to law enforcement authorities.'
    },
    {
      icon: '🚓',
      title: '6. Supplementary Nature — Not a Replacement for 112',
      body: 'VibeMap is a supplementary digital safety aid that empowers your private support network. VibeMap is NOT an official government emergency dispatch service. In life-threatening emergencies, always contact official Nigerian emergency lines (such as 112 or 767 in Lagos) or local law enforcement directly whenever feasible.'
    },
    {
      icon: '⚠️',
      title: '7. Community Vibe Reporting Guidelines',
      body: 'Users may submit real-time pins regarding traffic, road construction, celebrations, or hazards. You agree not to post defamatory, harassing, or intentionally misleading information. We reserve the right to remove non-compliant vibe pins and ban bad actors from the community feed.'
    },
    {
      icon: '⚖️',
      title: '8. Limitation of Liability',
      body: 'To the maximum extent permitted under applicable law, VibeMap and its operators are not liable for direct, indirect, incidental, or consequential damages resulting from network latency, GPS satellite signal loss, cellular outages, third-party map inaccuracies, or delayed beneficiary response times.'
    },
    {
      icon: '🔄',
      title: '9. Revisions & Updates',
      body: 'We may modify these Terms from time to time. When changes are made, we will update the "Last Revised" date at the top of this page. Your continued use of the Application after updates constitutes your agreement to the revised terms.'
    },
    {
      icon: '✉️',
      title: '10. Contact & Legal Inquiries',
      body: 'For questions, feedback, or legal inquiries regarding these Terms of Service, contact our legal team at legal@vibemap.ng.'
    },
  ]

  return (
    <div
      style={{
        height: '100dvh',
        width: '100vw',
        background: '#080810',
        backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.15), transparent 60%)',
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
          borderBottom: '1px solid rgba(139,92,246,0.2)',
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
            border: '1px solid rgba(139,92,246,0.3)',
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
            Terms of Service
          </h1>
          <p style={{ color: '#64748b', fontSize: 13, margin: 0, fontWeight: 500 }}>
            Last revised: August 2026 • Nigeria & Global
          </p>
        </div>

        {/* Policy Section Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sections.map((section, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(18,18,26,0.8)',
                border: '1px solid rgba(139,92,246,0.2)',
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

        {/* Legal Footer Card */}
        <div
          style={{
            marginTop: 32,
            padding: '16px 20px',
            background: 'rgba(139,92,246,0.08)',
            border: '1px solid rgba(139,92,246,0.25)',
            borderRadius: 14,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, marginBottom: 4 }}>
            Questions or Concerns?
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Email: <span style={{ color: '#06b6d4' }}>legal@vibemap.ng</span>
          </div>
        </div>
      </div>
    </div>
  )
}
