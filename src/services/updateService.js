/**
 * updateService.js
 * In-app update sequence disabled.
 */

export const APP_CURRENT_VERSION = '1.0.9'
export const APP_CURRENT_BUILD = 9

export function isNativePlatform() {
  if (typeof window === 'undefined') return false
  return !!(
    window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform()
  )
}

export async function checkForUpdate() {
  return {
    hasUpdate: false,
    currentVersion: APP_CURRENT_VERSION,
    currentBuild: APP_CURRENT_BUILD
  }
}

export async function downloadAndInstallApk() {
  return false
}

export async function applyWebUpdate() {
  return false
}
