/**
 * locationSharingState.ts
 *
 * Centralized, synchronized location sharing state across FamilyMap, ProfileScreen, and MapScreen.
 * Ensures toggling on any screen immediately syncs across all screens and persists across tab navigation.
 */

import { updateProfile, updateUserLocation } from './api'
import { getCache } from './cacheService'

const STORAGE_KEY = 'vibemap_location_sharing'
const EVENT_NAME = 'vibemap_location_sharing_changed'

/**
 * Get current location sharing boolean state
 */
export function getLocationSharing(userId?: string | null): boolean {
  if (typeof window === 'undefined') return true

  if (userId) {
    const userVal = localStorage.getItem(`vibemap_${userId}_location_sharing`)
    if (userVal !== null) return userVal === 'true'
  }

  const globalVal = localStorage.getItem(STORAGE_KEY)
  if (globalVal !== null) return globalVal === 'true'

  const cachedUser = getCache('current_user')?.data
  if (cachedUser && typeof cachedUser.location_sharing === 'boolean') {
    return cachedUser.location_sharing
  }

  return true
}

/**
 * Set location sharing state, broadcast to all listeners, and update backend
 */
export async function setLocationSharing(enabled: boolean, userId?: string | null): Promise<void> {
  if (typeof window === 'undefined') return

  const strVal = String(enabled)
  localStorage.setItem(STORAGE_KEY, strVal)
  if (userId) {
    localStorage.setItem(`vibemap_${userId}_location_sharing`, strVal)
  }

  // Broadcast to all mounted components
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { enabled: !!enabled } }))

  // Sync to Native Android Background & Foreground Service Bridge
  if (typeof (window as any).NativeVibeMap?.setLocationSharingEnabled === 'function') {
    try {
      (window as any).NativeVibeMap.setLocationSharingEnabled(!!enabled)
    } catch (err) {
      console.warn('[LocationSharing] Native bridge sync failed:', err)
    }
  }

  // Sync to backend
  try {
    await updateProfile({ location_sharing: !!enabled })
  } catch (err) {
    console.warn('[LocationSharing] Backend sync failed:', err)
  }

  // If enabled, immediately request GPS fix and send to backend
  if (enabled && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy || null,
        }).catch(() => {})
      },
      (err) => console.warn('[LocationSharing] Geolocation error:', err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    )
  }
}

/**
 * Subscribe to location sharing state changes
 */
export function onLocationSharingChange(callback: (enabled: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handler = (e: any) => {
    if (e?.detail && typeof e.detail.enabled === 'boolean') {
      callback(e.detail.enabled)
    }
  }

  window.addEventListener(EVENT_NAME, handler)
  return () => window.removeEventListener(EVENT_NAME, handler)
}
