/**
 * voiceNavigationService.js
 *
 * Real-Time Spoken Turn-by-Turn Voice Navigation Assistant for VibeMap.
 * Speaks real-time maneuver instructions (e.g. "In 200 meters, turn right on Ahmadu Bello Way")
 * similar to Google Maps, with distance tracking, advance warnings, arrival alerts, and rerouting notifications.
 */

let voiceEnabled = true
let lastSpokenText = ''
let lastSpokenTime = 0
let lastStepIndex = -1
let announcedSteps = new Set()
let hasAnnouncedStart = false
let hasAnnouncedArrival = false

// Helper: Haversine distance in meters
function getDistanceMeters(coord1, coord2) {
  if (!coord1 || !coord2) return Infinity
  const [lon1, lat1] = coord1
  const [lon2, lat2] = coord2

  const R = 6371e3 // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

function formatMeters(meters) {
  if (meters >= 1000) {
    const km = (meters / 1000).toFixed(1)
    return `${km} kilometer${km === '1.0' ? '' : 's'}`
  }
  const rounded = Math.round(meters / 50) * 50
  return `${Math.max(50, rounded)} meters`
}

function getManeuverText(maneuver, streetName) {
  const type = maneuver?.type || 'turn'
  const modifier = maneuver?.modifier || ''
  const street = streetName ? `onto ${streetName}` : ''

  if (type === 'arrive') {
    return 'You have arrived at your destination.'
  }
  if (type === 'depart') {
    return `Head ${modifier || 'forward'} ${street}`
  }
  if (type === 'roundabout' || type === 'rotary') {
    const exit = maneuver.exit ? `take the ${maneuver.exit}${getOrdinal(maneuver.exit)} exit` : 'enter the roundabout'
    return `At the roundabout, ${exit} ${street}`
  }
  if (type === 'fork') {
    return `Take the ${modifier || 'right'} fork ${street}`
  }
  if (type === 'merge') {
    return `Merge ${modifier || 'ahead'} ${street}`
  }
  if (modifier === 'straight') {
    return `Continue straight ${street}`
  }
  if (modifier.includes('left')) {
    return `Turn ${modifier} ${street}`
  }
  if (modifier.includes('right')) {
    return `Turn ${modifier} ${street}`
  }
  if (modifier === 'uturn') {
    return 'Make a U-turn when possible'
  }
  return `Continue ${street}`
}

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

/**
 * Speak text using Native Android TextToSpeech or Web SpeechSynthesis
 */
export function speakInstruction(text, force = false) {
  if (!text || typeof text !== 'string') return
  if (!voiceEnabled && !force) return

  const now = Date.now()
  if (text === lastSpokenText && now - lastSpokenTime < 7000) {
    return // Prevent repetitive spam
  }

  // 1. Android Native TextToSpeech Engine Bridge (100% reliable on APK)
  if (typeof window !== 'undefined' && window.NativeVibeMap && typeof window.NativeVibeMap.speakText === 'function') {
    try {
      lastSpokenText = text
      lastSpokenTime = now
      window.NativeVibeMap.speakText(text)
      return
    } catch (e) {
      console.warn('[VoiceNav] Native TTS call failed, falling back to Web SpeechSynthesis:', e)
    }
  }

  // 2. Web SpeechSynthesis Fallback (for Browsers & PWA)
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

  try {
    window.speechSynthesis.cancel() // Cancel previous queue for instant response

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.05 // Slightly crisp, natural navigation cadence
    utterance.pitch = 1.0
    utterance.volume = 1.0

    // Pick English voice
    const voices = window.speechSynthesis.getVoices()
    const englishVoice = voices.find(v => v.lang && v.lang.startsWith('en') && !v.name.includes('Google')) || voices.find(v => v.lang && v.lang.startsWith('en'))
    if (englishVoice) {
      utterance.voice = englishVoice
    }

    lastSpokenText = text
    lastSpokenTime = now
    window.speechSynthesis.speak(utterance)
  } catch (err) {
    console.warn('[VoiceNav] Speech synthesis error:', err)
  }
}

/**
 * Reset voice session when starting new journey
 */
export function resetVoiceNavigation() {
  announcedSteps = new Set()
  hasAnnouncedStart = false
  hasAnnouncedArrival = false
  lastStepIndex = -1
  lastSpokenText = ''
  if (typeof window !== 'undefined' && window.NativeVibeMap && typeof window.NativeVibeMap.stopSpeaking === 'function') {
    try { window.NativeVibeMap.stopSpeaking() } catch (_) {}
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try { window.speechSynthesis.cancel() } catch (_) {}
  }
}

/**
 * Main Turn-by-Turn Voice Navigation Processor
 * Called continuously on GPS location update
 */
export function processVoiceGuidance({ userCoords, steps, destinationName, isNavigating }) {
  if (!isNavigating || !userCoords || !Array.isArray(steps) || steps.length === 0) return

  const [userLng, userLat] = userCoords

  // 1. Initial Journey Start Announcement
  if (!hasAnnouncedStart) {
    hasAnnouncedStart = true
    const firstStep = steps[0]
    const nextStep = steps[1]
    const dest = destinationName ? `to ${destinationName}` : ''
    let startMsg = `Starting route ${dest}.`

    if (nextStep && nextStep.location) {
      const dist = getDistanceMeters([userLng, userLat], nextStep.location)
      const action = getManeuverText(nextStep.maneuver, nextStep.name)
      startMsg += ` In ${formatMeters(dist)}, ${action.toLowerCase()}.`
    }
    speakInstruction(startMsg)
    return
  }

  // 2. Find closest upcoming maneuver step
  let closestStepIndex = -1
  let minStepDistance = Infinity

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (!step.location) continue
    const dist = getDistanceMeters([userLng, userLat], step.location)

    if (dist < minStepDistance) {
      minStepDistance = dist
      closestStepIndex = i
    }
  }

  // Check arrival at final destination (last step or within 25m)
  const lastStep = steps[steps.length - 1]
  if (lastStep?.location) {
    const distToDestination = getDistanceMeters([userLng, userLat], lastStep.location)
    if (distToDestination <= 28 && !hasAnnouncedArrival) {
      hasAnnouncedArrival = true
      speakInstruction(`You have arrived at your destination: ${destinationName || 'Destination'}.`)
      return
    }
  }

  if (closestStepIndex === -1) return
  const currentStep = steps[closestStepIndex]
  const dist = minStepDistance
  const action = getManeuverText(currentStep.maneuver, currentStep.name)

  // 3. Stage Announcements based on distance to turn point:
  // - 500m Advance notice
  const key500 = `${closestStepIndex}_500`
  if (dist <= 550 && dist > 350 && !announcedSteps.has(key500)) {
    announcedSteps.add(key500)
    speakInstruction(`In ${formatMeters(dist)}, ${action.toLowerCase()}.`)
    return
  }

  // - 200m Prep notice
  const key200 = `${closestStepIndex}_200`
  if (dist <= 220 && dist > 80 && !announcedSteps.has(key200)) {
    announcedSteps.add(key200)
    speakInstruction(`In ${formatMeters(dist)}, ${action.toLowerCase()}.`)
    return
  }

  // - 40m Immediate turn notice
  const keyImmediate = `${closestStepIndex}_immediate`
  if (dist <= 45 && dist > 10 && !announcedSteps.has(keyImmediate)) {
    announcedSteps.add(keyImmediate)
    speakInstruction(`${action}.`)
    return
  }
}

/**
 * Announce Rerouting Event
 */
export function announceReroute() {
  resetVoiceNavigation()
  speakInstruction('Recalculating route... Finding the best path.')
}

/**
 * Toggle voice navigation mute
 */
export function setVoiceMuted(muted) {
  voiceEnabled = !muted
  if (muted) {
    if (typeof window !== 'undefined' && window.NativeVibeMap && typeof window.NativeVibeMap.stopSpeaking === 'function') {
      try { window.NativeVibeMap.stopSpeaking() } catch (_) {}
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel() } catch (_) {}
    }
  }
}

export function isVoiceEnabled() {
  return voiceEnabled
}

/**
 * Get structured active maneuver details for Turn-by-Turn UI & PiP HUD
 */
export function getActiveManeuverDetails({ userCoords, steps, destinationName }) {
  if (!userCoords || !Array.isArray(steps) || steps.length === 0) {
    return {
      distanceText: '',
      distanceMeters: 0,
      instruction: destinationName ? `Head to ${destinationName}` : 'Proceed to route',
      modifier: 'straight',
      type: 'depart',
      streetName: destinationName || '',
      nextStep: null,
      nextManeuverText: '',
    }
  }

  const [userLng, userLat] = userCoords
  let closestStepIndex = -1
  let minStepDistance = Infinity

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (!step.location) continue
    const dist = getDistanceMeters([userLng, userLat], step.location)
    if (dist < minStepDistance) {
      minStepDistance = dist
      closestStepIndex = i
    }
  }

  if (closestStepIndex === -1) {
    const firstStep = steps[0]
    return {
      distanceText: '',
      distanceMeters: 0,
      instruction: firstStep?.name ? `Head onto ${firstStep.name}` : (destinationName || 'Proceed forward'),
      modifier: firstStep?.maneuver?.modifier || 'straight',
      type: firstStep?.maneuver?.type || 'depart',
      streetName: firstStep?.name || '',
      nextStep: steps[1] || null,
      nextManeuverText: steps[1]?.maneuver ? getManeuverText(steps[1].maneuver, steps[1].name) : '',
    }
  }

  const currentStep = steps[closestStepIndex]
  const nextStep = steps[closestStepIndex + 1] || null

  let distanceText = ''
  if (minStepDistance < 1000) {
    distanceText = `${Math.max(10, Math.round(minStepDistance / 10) * 10)} m`
  } else {
    distanceText = `${(minStepDistance / 1000).toFixed(1)} km`
  }

  const modifier = currentStep?.maneuver?.modifier || 'straight'
  const type = currentStep?.maneuver?.type || 'turn'
  const streetName = currentStep?.name || destinationName || ''
  
  let instruction = getManeuverText(currentStep?.maneuver, streetName)
  if (type === 'arrive') {
    instruction = `Arrive at ${destinationName || 'destination'}`
  }

  const nextManeuverText = nextStep?.maneuver ? getManeuverText(nextStep.maneuver, nextStep.name) : ''

  return {
    distanceText,
    distanceMeters: minStepDistance,
    instruction,
    modifier,
    type,
    streetName,
    nextStep,
    nextManeuverText,
  }
}
