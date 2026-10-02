import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'

import { markAppInstalled } from './services/pwaService'

// Capture beforeinstallprompt globally at startup
window.deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPrompt = e;
  window.dispatchEvent(new CustomEvent('vibemap-prompt-ready'));
});

// Capture app installation event
window.addEventListener('appinstalled', () => {
  console.log('[PWA] App successfully installed');
  markAppInstalled();
});

// Register high-performance Service Worker for offline map tiles & shell caching
if ('serviceWorker' in navigator && (import.meta.env.PROD || window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[SW] Service Worker registered successfully, scope:', reg.scope);
        // Force check for updates immediately
        reg.update().catch(() => {});
      })
      .catch((err) => {
        console.warn('[SW] Service Worker registration failed:', err);
      });
  });
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '843446951432-bjsnr3pn3v4keoatgo8m02i3ge9l97a4.apps.googleusercontent.com'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={googleClientId}>
        <App />
      </GoogleOAuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
