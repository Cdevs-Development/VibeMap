/**
 * audio.js
 *
 * Synthesized Web Audio API sound engine for VibeMap:
 * - Notification Chime: Modern, pleasant melodic two-tone chime.
 * - Emergency SOS Siren: Dual-tone oscillating urgent alarm sound.
 * 
 * Works without external audio files, works offline, zero network delay.
 */

let audioCtx = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (AudioContext) {
      audioCtx = new AudioContext()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

// Automatically unlock AudioContext on first user touch/click
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
  }
  window.addEventListener('click', unlockAudio, { passive: true, once: false })
  window.addEventListener('touchstart', unlockAudio, { passive: true, once: false })
  window.addEventListener('keydown', unlockAudio, { passive: true, once: false })
}

/**
 * Play a crisp, pleasant two-tone notification sound (D5 -> A5)
 */
export function playNotificationSound() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime

    // First tone (587.33 Hz - D5)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now)
    gain1.gain.setValueAtTime(0.001, now)
    gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.03)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18)

    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.2)

    // Second tone (880.00 Hz - A5)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880.0, now + 0.12)
    gain2.gain.setValueAtTime(0.001, now + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.4, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45)

    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.12)
    osc2.stop(now + 0.5)
  } catch (err) {
    console.warn('[Audio] Failed to play notification chime:', err)
  }
}

let sosAudioElement = null
let activeSosOscillator = null
let activeSosGain = null
let sosIntervalId = null

function playSynthesizedSOSFallback() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    stopSynthesizedSOSFallback()

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sawtooth'
    gain.gain.setValueAtTime(0.55, ctx.currentTime)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()

    let high = true
    osc.frequency.setValueAtTime(960, ctx.currentTime)

    sosIntervalId = setInterval(() => {
      if (!ctx || ctx.state === 'closed') return
      const now = ctx.currentTime
      if (high) {
        osc.frequency.setTargetAtTime(770, now, 0.05)
      } else {
        osc.frequency.setTargetAtTime(960, now, 0.05)
      }
      high = !high
    }, 280)

    activeSosOscillator = osc
    activeSosGain = gain
  } catch (err) {
    console.warn('[Audio] Fallback synthesized SOS error:', err)
  }
}

function stopSynthesizedSOSFallback() {
  try {
    if (sosIntervalId) {
      clearInterval(sosIntervalId)
      sosIntervalId = null
    }
    if (activeSosGain && audioCtx) {
      activeSosGain.gain.setValueAtTime(0.001, audioCtx.currentTime)
    }
    if (activeSosOscillator) {
      activeSosOscillator.stop()
      activeSosOscillator.disconnect()
      activeSosOscillator = null
    }
    activeSosGain = null
  } catch (err) {
    console.warn('[Audio] Error stopping synthesized fallback:', err)
  }
}

/**
 * Play urgent SOS emergency alarm.
 * Uses the exact same sos_alarm.wav sound that plays in background / Android notifications,
 * and ensures any native background alarm MediaPlayer is stopped so they don't double-play.
 */
export function playSOSSound() {
  try {
    // 1. Tell native Android layer to stop background alarm MediaPlayer if running
    if (typeof window !== 'undefined' && window.NativeVibeMap && typeof window.NativeVibeMap.stopNativeAlarm === 'function') {
      try {
        window.NativeVibeMap.stopNativeAlarm()
      } catch (_) {}
    }

    // Stop any current instance
    stopSOSSound()

    // 2. Play the official sos_alarm.wav file
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      if (!sosAudioElement) {
        sosAudioElement = new Audio('/sos_alarm.wav')
        sosAudioElement.loop = true
        sosAudioElement.volume = 1.0
      }
      sosAudioElement.currentTime = 0
      const playPromise = sosAudioElement.play()
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[Audio] HTML5 Audio play error, using Web Audio fallback:', err)
          playSynthesizedSOSFallback()
        })
      }
    } else {
      playSynthesizedSOSFallback()
    }
  } catch (err) {
    console.warn('[Audio] Failed to play SOS sound:', err)
    playSynthesizedSOSFallback()
  }
}

/**
 * Stop active SOS emergency alarm (both in-app audio and native background alarm)
 */
export function stopSOSSound() {
  try {
    // 1. Stop native background alarm if running on Android
    if (typeof window !== 'undefined' && window.NativeVibeMap && typeof window.NativeVibeMap.stopNativeAlarm === 'function') {
      try {
        window.NativeVibeMap.stopNativeAlarm()
      } catch (_) {}
    }

    // 2. Stop HTML5 audio element
    if (sosAudioElement) {
      sosAudioElement.pause()
      sosAudioElement.currentTime = 0
    }

    // 3. Stop synthesized fallback
    stopSynthesizedSOSFallback()
  } catch (err) {
    console.warn('[Audio] Error stopping SOS sound:', err)
  }
}
