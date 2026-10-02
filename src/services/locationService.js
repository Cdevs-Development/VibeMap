/**
 * locationService.js
 *
 * Hybrid Multi-Tier Location Engine for Web & Android APK.
 * 1. Native Android Fused Location Bridge (via NativeVibeMap).
 * 2. Capacitor Background Geolocation Plugin (Android Background Service).
 * 3. High-Accuracy Satellite GPS (Mobile / Tablet devices).
 * 4. Coarse Cellular Tower & Wi-Fi Triangulation (Indoor fallback).
 * 5. IP Geolocation Failover (Desktop fallback).
 * 6. Device Compass / Gyroscope Heading Fusion.
 */

import { Capacitor, registerPlugin } from '@capacitor/core'
import { updateUserLocation } from './api'
import { getLocationSharing } from './locationSharingState'

// BackgroundGeolocation plugin proxy - backed by native BackgroundGeolocation plugin
const BackgroundGeolocation = registerPlugin('BackgroundGeolocation')
let _nativeWatcherId = null

// Device compass heading state
let currentDeviceHeading = null

// Real-time backend sync throttling state
let lastUploadedLocation = null
let lastUploadedTime = 0

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Centrally push live location to backend when location sharing is enabled
 */
function syncLocationToBackend(coords) {
  if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') return
  if (!getLocationSharing()) return

  const now = Date.now()
  const timeSinceLastUpload = now - lastUploadedTime

  let shouldUpload = false
  if (!lastUploadedLocation) {
    shouldUpload = true
  } else {
    const distanceMoved = calculateHaversineDistance(
      lastUploadedLocation.latitude,
      lastUploadedLocation.longitude,
      coords.latitude,
      coords.longitude
    )
    const hasMovedSignificantly = distanceMoved >= 2.5 && timeSinceLastUpload >= 4000
    const isHeartbeatDue = timeSinceLastUpload >= 15000
    if (hasMovedSignificantly || isHeartbeatDue) {
      shouldUpload = true
    }
  }

  if (shouldUpload) {
    lastUploadedLocation = { latitude: coords.latitude, longitude: coords.longitude }
    lastUploadedTime = now
    updateUserLocation({
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy ?? null,
      speed: coords.speed ?? null,
      heading: coords.heading ?? null,
    }).catch((err) => {
      // Non-fatal, offline outbox handles network failovers
      console.warn('[LocationService] Live location backend sync:', err?.message || err)
    })
  }
}

if (typeof window !== 'undefined') {
  // Listen for device orientation (Compass / Gyroscope)
  window.addEventListener('deviceorientation', (e) => {
    if (e.webkitCompassHeading !== undefined) {
      // iOS / Safari
      currentDeviceHeading = Math.round(e.webkitCompassHeading);
    } else if (e.alpha !== null && e.alpha !== undefined) {
      // Android / Chrome
      currentDeviceHeading = Math.round(360 - e.alpha);
    }
  }, { passive: true });
}

function getNativePlugin() {
  if (!Capacitor.isNativePlatform()) return null
  return BackgroundGeolocation
}

/**
 * Check if native Android bridge has a last known location and ensure auth token is synced
 */
function primeNativeBridge() {
  if (typeof window !== 'undefined' && window.NativeVibeMap) {
    try {
      const token = localStorage.getItem('vibemap_token') || localStorage.getItem('token')
      if (token && typeof window.NativeVibeMap.saveAuthToken === 'function') {
        window.NativeVibeMap.saveAuthToken(token, 'https://vibemap-backend-9q3z.onrender.com')
      }
      if (typeof window.NativeVibeMap.setLocationSharingEnabled === 'function') {
        window.NativeVibeMap.setLocationSharingEnabled(getLocationSharing())
      }
    } catch (e) {
      console.warn('[LocationService] Native bridge prime error:', e)
    }
  }
}

/**
 * Check if native Android bridge has a last known location
 */
function getNativeBridgeLocation() {
  primeNativeBridge()
  if (typeof window !== 'undefined' && window.NativeVibeMap && typeof window.NativeVibeMap.getLastKnownLocation === 'function') {
    try {
      const raw = window.NativeVibeMap.getLastKnownLocation()
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.hasLocation && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
          return {
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            accuracy: parsed.accuracy || 15,
            speed: parsed.speed || null,
            heading: parsed.heading || currentDeviceHeading,
            source: 'native_bridge'
          }
        }
      }
    } catch (err) {
      console.warn('[LocationService] Native bridge location query error:', err)
    }
  }
  return null
}

/**
 * IP Geolocation Fallback for devices without GPS or Wi-Fi triangulation
 */
async function fetchIPGeolocation() {
  try {
    const response = await fetch('https://ipapi.co/json/', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4000)
    });
    if (!response.ok) throw new Error('IP API error');
    const data = await response.json();
    if (data && data.latitude && data.longitude) {
      return {
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        accuracy: 3000,
        speed: null,
        heading: currentDeviceHeading,
        source: 'ip_fallback'
      };
    }
  } catch (err) {
    try {
      const res2 = await fetch('https://freeipapi.com/api/json', { signal: AbortSignal.timeout(4000) });
      const data2 = await res2.json();
      if (data2 && data2.latitude && data2.longitude) {
        return {
          latitude: parseFloat(data2.latitude),
          longitude: parseFloat(data2.longitude),
          accuracy: 5000,
          speed: null,
          heading: currentDeviceHeading,
          source: 'ip_fallback'
        };
      }
    } catch (err2) {
      console.warn('[LocationService] IP Geolocation fallback failed:', err2);
    }
  }
  return null;
}

/**
 * Start Continuous Location Tracking with Multi-Tier Fallbacks and Live Backend Sync
 * @param {Function} onLocation Callback receiving { latitude, longitude, accuracy, speed, heading }
 * @param {Function} onError Error callback
 * @returns {Promise<Function>} Stop function
 */
async function startTracking(onLocation, onError = console.warn) {
  const isNative = Capacitor.isNativePlatform()
  primeNativeBridge()

  const handleLocation = (loc) => {
    syncLocationToBackend(loc)
    onLocation(loc)
  }

  // 1. Immediately emit native bridge location if available on APK
  if (isNative) {
    const bridgeLoc = getNativeBridgeLocation()
    if (bridgeLoc) {
      handleLocation(bridgeLoc)
    }
  }

  // 2. Try native BackgroundGeolocation watcher
  if (isNative) {
    const plugin = getNativePlugin()
    if (plugin) {
      try {
        const watcherId = await plugin.addWatcher(
          {
            backgroundMessage: 'VibeMap is tracking your location for safety.',
            backgroundTitle: 'VibeMap Safety Service',
            requestPermissions: true,
            stale: false,
            distanceFilter: 2, // 2m filter for high responsiveness
          },
          (location, error) => {
            if (error) {
              if (error.code === 'NOT_AUTHORIZED') {
                onError({ code: 'PERMISSION_DENIED', message: 'Background location permission denied.' })
              } else {
                onError(error)
              }
              return
            }
            if (location) {
              handleLocation({
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                speed: location.speed,
                heading: location.bearing || currentDeviceHeading,
                source: 'native_gps'
              })
            }
          }
        )
        _nativeWatcherId = watcherId

        return async () => {
          if (_nativeWatcherId && plugin) {
            try {
              await plugin.removeWatcher({ id: _nativeWatcherId })
            } catch (_) {}
            _nativeWatcherId = null
          }
        }
      } catch (e) {
        console.warn('[LocationService] Native plugin addWatcher failed, using hybrid tracking:', e)
        // Fall through to web hybrid tracking below
      }
    }
  }

  // 3. Web Hybrid Location Engine
  return startHybridWebTracking(handleLocation, onError)
}

/**
 * Two-Stage High-to-Coarse Web Geolocation with IP failover
 */
function startHybridWebTracking(onLocation, onError) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    fetchIPGeolocation().then((ipLoc) => {
      if (ipLoc) onLocation(ipLoc)
      else onError({ code: 'NOT_SUPPORTED', message: 'Geolocation is not supported.' })
    })
    return () => {}
  }

  let activeWatchId = null
  let isStopped = false

  const emitLocation = (coords, source) => {
    if (isStopped) return
    const { latitude, longitude, accuracy, speed, heading } = coords
    onLocation({
      latitude,
      longitude,
      accuracy: accuracy ?? 25,
      speed: speed ?? null,
      heading: heading ?? currentDeviceHeading,
      source
    })
  }

  // Fast fix with high accuracy (6s timeout)
  navigator.geolocation.getCurrentPosition(
    (pos) => emitLocation(pos.coords, 'gps_high'),
    (err) => {
      // Coarse fix fallback (Wi-Fi / Cell tower)
      navigator.geolocation.getCurrentPosition(
        (pos) => emitLocation(pos.coords, 'wifi_coarse'),
        async () => {
          const bridgeLoc = getNativeBridgeLocation()
          if (bridgeLoc) {
            emitLocation(bridgeLoc, 'native_bridge')
          } else {
            const ipLoc = await fetchIPGeolocation()
            if (ipLoc) emitLocation(ipLoc, 'ip_fallback')
            else onError(err)
          }
        },
        { enableHighAccuracy: false, maximumAge: 30000, timeout: 8000 }
      );
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 6000 }
  )

  // Continuous Watcher
  activeWatchId = navigator.geolocation.watchPosition(
    (pos) => emitLocation(pos.coords, 'gps_watch'),
    (err) => {
      if (activeWatchId !== null) {
        navigator.geolocation.clearWatch(activeWatchId);
        activeWatchId = navigator.geolocation.watchPosition(
          (coarsePos) => emitLocation(coarsePos.coords, 'coarse_watch'),
          onError,
          { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 }
        );
      }
    },
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
  )

  return () => {
    isStopped = true
    if (activeWatchId !== null) {
      navigator.geolocation.clearWatch(activeWatchId)
      activeWatchId = null
    }
  }
}

/**
 * One-shot current location fetch with multi-tier fallback
 */
async function getCurrentLocation() {
  // 1. Check native Android bridge first for instant real device location
  const bridgeLoc = getNativeBridgeLocation()
  if (bridgeLoc) {
    return bridgeLoc
  }

  // 2. If on Android and native bridge is present, request permission if needed
  if (typeof window !== 'undefined' && window.NativeVibeMap && typeof window.NativeVibeMap.requestLocationPermission === 'function') {
    window.NativeVibeMap.requestLocationPermission()
  }

  // 3. Web geolocation fallback with timeout
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      fetchIPGeolocation().then((loc) => resolve(loc || { latitude: 6.5244, longitude: 3.3792, accuracy: 5000 }))
      return
    }

    let resolved = false
    const finish = (res) => {
      if (!resolved) {
        resolved = true
        resolve(res)
      }
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        finish({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading || currentDeviceHeading,
          source: 'navigator_high'
        })
      },
      () => {
        // Coarse fallback
        navigator.geolocation.getCurrentPosition(
          (coarsePos) => {
            finish({
              latitude: coarsePos.coords.latitude,
              longitude: coarsePos.coords.longitude,
              accuracy: coarsePos.coords.accuracy,
              speed: coarsePos.coords.speed,
              heading: coarsePos.coords.heading || currentDeviceHeading,
              source: 'navigator_coarse'
            })
          },
          async () => {
            const bridgeLoc2 = getNativeBridgeLocation()
            if (bridgeLoc2) {
              finish(bridgeLoc2)
            } else {
              const ipLoc = await fetchIPGeolocation()
              finish(ipLoc || { latitude: 6.5244, longitude: 3.3792, accuracy: 5000, source: 'default_lagos' })
            }
          },
          { enableHighAccuracy: false, maximumAge: 30000, timeout: 6000 }
        )
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    )

    // Hard safeguard timeout
    setTimeout(() => {
      const bLoc = getNativeBridgeLocation()
      if (bLoc) finish(bLoc)
      else fetchIPGeolocation().then((loc) => finish(loc || { latitude: 6.5244, longitude: 3.3792, accuracy: 5000 }))
    }, 7000)
  })
}

const locationService = { startTracking, getCurrentLocation }
export default locationService
