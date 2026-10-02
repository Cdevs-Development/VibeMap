/**
 * sosAlertService.js
 *
 * Emergency SOS Alert and Notification Dispatcher for VibeMap.
 * Delivers loud sirens, continuous repeating haptic vibrations, and high-priority
 * Android / Web push & local notifications that disturb the beneficiary immediately.
 */

import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { PushNotifications } from '@capacitor/push-notifications'
import { playSOSSound } from '../utils/audio'

let isInitialized = false
let navigationHandler = null

export function setSOSNavigationHandler(handler) {
  navigationHandler = handler
}

/**
 * Initialize SOS Notification Channels & Permission Listeners
 */
export async function initializeSOSNotifications() {
  // Sync auth token with native Android background service
  try {
    const token = localStorage.getItem('vibemap_token') || localStorage.getItem('token')
    if (typeof window !== 'undefined' && window.NativeVibeMap && window.NativeVibeMap.saveAuthToken && token) {
      window.NativeVibeMap.saveAuthToken(token, 'https://vibemap-backend-9q3z.onrender.com')
    }
  } catch (_) {}

  if (isInitialized) return
  isInitialized = true

  // 1. Request Web Notification permissions
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }

  // If on web / non-native, skip Capacitor-only native APIs
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) {
    return
  }

  // 2. Request Capacitor Local Notifications Permissions & Channel Setup
  try {
    const permStatus = await LocalNotifications.checkPermissions()
    if (permStatus.display !== 'granted') {
      await LocalNotifications.requestPermissions()
    }

    // Create / Register the emergency_sos channel on Android
    await LocalNotifications.createChannel({
      id: 'emergency_sos',
      name: 'Emergency SOS Distress Alerts',
      description: 'Urgent alarms for family SOS distress signals',
      importance: 5, // MAX importance (Heads-up notification + alarm)
      visibility: 1, // Public on lockscreen
      sound: 'res://raw/sos_alarm',
      vibration: true,
      lights: true,
      lightColor: '#EF4444',
    })

    // Listen for notification action / click
    LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
      console.log('[SOS Alert] Notification action performed:', notificationAction)
      const data = notificationAction.notification?.extra || {}
      if (typeof navigationHandler === 'function') {
        navigationHandler(data)
      }
    })
  } catch (err) {
    console.warn('[SOS Alert] LocalNotifications setup warning:', err)
  }

  // 3. Setup Push Notifications (FCM)
  try {
    const pushPerm = await PushNotifications.checkPermissions()
    if (pushPerm.receive !== 'granted') {
      await PushNotifications.requestPermissions()
    }
    await PushNotifications.register()

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[SOS Alert] Push notification received in background/foreground:', notification)
      playSOSSound()
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([800, 200, 800, 200, 1000]) } catch (_) {}
      }
    })

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[SOS Alert] Push notification clicked:', action)
      const data = action.notification?.data || {}
      if (typeof navigationHandler === 'function') {
        navigationHandler(data)
      }
    })
  } catch (err) {
    console.warn('[SOS Alert] PushNotifications setup warning:', err)
  }
}

/**
 * Dispatch high-priority emergency local notification to the device
 */
export async function dispatchEmergencyDistressNotification(person) {
  if (!person) return

  let displayName = person.custom_name || person.name || person.full_name || 'Family Member'
  try {
    const cachedB = localStorage.getItem('vibemap_cache_beneficiaries')
    if (cachedB) {
      const parsed = JSON.parse(cachedB)
      const list = parsed?.data || []
      const normPersonPhone = person.phone ? person.phone.replace(/\D/g, '').slice(-10) : ''
      const match = list.find(b => {
        if (b.registered_user_id && person.id && b.registered_user_id === person.id) return true
        if (b.id && person.id && b.id === person.id) return true
        if (b.phone && normPersonPhone) {
          const normBPhone = b.phone.replace(/\D/g, '').slice(-10)
          if (normBPhone && normBPhone === normPersonPhone) return true
        }
        return false
      })
      if (match?.name) displayName = match.name
    }
  } catch (_) {}

  const title = `🚨 EMERGENCY SOS: ${displayName}!`
  const body = `${displayName} activated an emergency SOS! Tap immediately to view their live GPS coordinates.`

  // 1. Trigger Native Capacitor Local Notification (Android / iOS only)
  if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
    try {
      const notificationId = (person.id || Date.now()) % 2147483647
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title,
            body,
            channelId: 'emergency_sos',
            sound: 'res://raw/sos_alarm',
            ongoing: true,
            autoCancel: false,
            extra: {
              personId: person.id,
              personName: displayName,
              lat: person.last_lat,
              lng: person.last_lng,
              isSos: true,
            },
            actionTypeId: 'OPEN_SOS_MAP',
          },
        ],
      })
    } catch (err) {
      console.warn('[SOS Alert] Failed to schedule local notification:', err)
    }
  }

  // 2. Trigger Web Notification API fallback
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body,
            icon: '/favicon.svg',
            badge: '/favicon.svg',
            tag: `sos-alert-${person.id}`,
            renotify: true,
            requireInteraction: true,
            vibrate: [800, 200, 800, 200, 1200],
            data: {
              url: `/family?sos_user=${person.id}`,
            },
          })
        })
      } else {
        new Notification(title, {
          body,
          icon: '/favicon.svg',
          tag: `sos-alert-${person.id}`,
          requireInteraction: true,
        })
      }
    } catch (_) {}
  }
}

/**
 * Dispatch high-priority interactive notification for incoming beneficiary requests
 */
export async function dispatchBeneficiaryRequestNotification(requesterName, beneficiaryId, notificationId) {
  const title = `👤 Beneficiary Request: ${requesterName || 'Someone'}`
  const body = `${requesterName || 'A contact'} wants to add you as an emergency beneficiary on VibeMap.`

  // 1. Native Capacitor Local Notification
  if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
    try {
      const notifId = (beneficiaryId ? Math.abs(beneficiaryId.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)) : Date.now()) % 2147483647
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title,
            body,
            channelId: 'beneficiary_requests_channel',
            ongoing: false,
            autoCancel: true,
            extra: {
              beneficiaryId,
              notificationId,
              requesterName,
              isBeneficiaryRequest: true,
            },
            actionTypeId: 'OPEN_BENEFICIARY_REQUEST',
          },
        ],
      })
    } catch (err) {
      console.warn('[Beneficiary Alert] Failed to schedule local notification:', err)
    }
  }

  // 2. Web Notification API
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body,
            icon: '/favicon.svg',
            badge: '/favicon.svg',
            tag: `beneficiary-req-${beneficiaryId}`,
            renotify: true,
            requireInteraction: false,
            vibrate: [400, 200, 400],
            data: {
              url: '/family',
            },
          })
        })
      } else {
        new Notification(title, {
          body,
          icon: '/favicon.svg',
          tag: `beneficiary-req-${beneficiaryId}`,
        })
      }
    } catch (_) {}
  }
}
