/**
 * Centralized PWA & Native App installation state manager
 */

export function isAppInstalled() {
  if (typeof window === 'undefined') return false

  try {
    // 1. Explicitly recorded install in localStorage
    if (localStorage.getItem('vibemap_app_installed') === 'true') {
      return true
    }

    // 2. Display mode is standalone / fullscreen (PWA installed on Desktop or Mobile)
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      localStorage.setItem('vibemap_app_installed', 'true')
      return true
    }
    if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) {
      localStorage.setItem('vibemap_app_installed', 'true')
      return true
    }

    // 3. iOS standalone mode
    if (window.navigator && window.navigator.standalone === true) {
      localStorage.setItem('vibemap_app_installed', 'true')
      return true
    }

    // 4. Android TWA / app intent referrer
    if (typeof document !== 'undefined' && document.referrer && document.referrer.includes('android-app://')) {
      localStorage.setItem('vibemap_app_installed', 'true')
      return true
    }

    // 5. Native Capacitor / Cordova container
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
      localStorage.setItem('vibemap_app_installed', 'true')
      return true
    }

    // 6. Explicit URL param for testing
    if (window.location && window.location.search && window.location.search.includes('installed=true')) {
      localStorage.setItem('vibemap_app_installed', 'true')
      return true
    }
  } catch (e) {
    console.warn('[pwaService] Error checking install status:', e)
  }

  return false
}

export function markAppInstalled() {
  try {
    localStorage.setItem('vibemap_app_installed', 'true')
    window.dispatchEvent(new CustomEvent('vibemap-app-installed'))
  } catch (e) {
    console.warn('[pwaService] Error marking app installed:', e)
  }
}
