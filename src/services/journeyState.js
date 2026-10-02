/**
 * journeyState.js
 *
 * Centralized Active Journey & Navigation State Store.
 * Keeps journey telemetry synced across MapScreen, background services,
 * Picture-in-Picture floating windows, and in-app overlay banners.
 */

const listeners = new Set()

let activeJourney = {
  isNavigating: false,
  destination: null,
  distanceMeters: null,
  durationSeconds: null,
  speedKmh: 0,
  heading: 0,
  accuracy: 10,
  userCoords: null,
  activeTripId: null,
  shareToken: null,
  routeData: null,
  routeSteps: [],
  routingProfile: 'driving',
}

// Restore saved journey from sessionStorage/localStorage if page was reloaded
try {
  const saved = localStorage.getItem('vibemap_active_journey')
  if (saved) {
    const parsed = JSON.parse(saved)
    if (parsed && parsed.isNavigating) {
      activeJourney = { ...activeJourney, ...parsed }
    }
  }
} catch (_) {}

function notifyListeners() {
  listeners.forEach(cb => {
    try { cb(activeJourney) } catch (e) { console.warn('[JourneyState] Listener error:', e) }
  })
}

export function getActiveJourney() {
  return activeJourney
}

export function updateActiveJourney(updates) {
  activeJourney = { ...activeJourney, ...updates }
  try {
    if (activeJourney.isNavigating) {
      localStorage.setItem('vibemap_active_journey', JSON.stringify(activeJourney))
    } else {
      localStorage.removeItem('vibemap_active_journey')
    }
  } catch (_) {}
  notifyListeners()
}

export function stopActiveJourney() {
  activeJourney = {
    isNavigating: false,
    destination: null,
    distanceMeters: null,
    durationSeconds: null,
    speedKmh: 0,
    heading: 0,
    accuracy: 10,
    userCoords: null,
    activeTripId: null,
    shareToken: null,
    routeData: null,
    routeSteps: [],
    routingProfile: 'driving',
  }
  try {
    localStorage.removeItem('vibemap_active_journey')
  } catch (_) {}
  notifyListeners()
}

export function subscribeJourneyState(callback) {
  listeners.add(callback)
  callback(activeJourney)
  return () => listeners.delete(callback)
}
