import { useState, useEffect, useRef } from 'react'

/**
 * useSmoothPosition Hook
 * 
 * Smoothly interpolates coordinates (longitude, latitude) and heading angle (0-360)
 * using requestAnimationFrame and shortest-arc spherical/linear lerp.
 * 
 * This eliminates marker jumpiness and jitter during real-time GPS tracking
 * and socket/polling updates, matching Google Maps buttery-smooth motion.
 * 
 * @param {number|null} targetLng 
 * @param {number|null} targetLat 
 * @param {number|null} targetHeading 
 * @param {number} [durationMs=1500] 
 * @returns {{ longitude: number|null, latitude: number|null, heading: number }}
 */
export function useSmoothPosition(targetLng, targetLat, targetHeading = 0, durationMs = 1400) {
  const [pos, setPos] = useState(() => ({
    longitude: targetLng != null ? Number(targetLng) : null,
    latitude: targetLat != null ? Number(targetLat) : null,
    heading: Number(targetHeading) || 0,
  }))

  const animRef = useRef(null)
  const currentPosRef = useRef({
    lng: targetLng != null ? Number(targetLng) : null,
    lat: targetLat != null ? Number(targetLat) : null,
    heading: Number(targetHeading) || 0,
  })

  const targetRef = useRef({
    lng: targetLng,
    lat: targetLat,
    heading: targetHeading,
  })

  useEffect(() => {
    if (targetLng == null || targetLat == null) return

    const nLng = Number(targetLng)
    const nLat = Number(targetLat)
    const nHeading = Number(targetHeading) || 0

    if (isNaN(nLng) || isNaN(nLat)) return

    // If this is the very first fix, initialize instantly without animation
    if (currentPosRef.current.lng == null || currentPosRef.current.lat == null) {
      currentPosRef.current = { lng: nLng, lat: nLat, heading: nHeading }
      setPos({ longitude: nLng, latitude: nLat, heading: nHeading })
      targetRef.current = { lng: nLng, lat: nLat, heading: nHeading }
      return
    }

    // Check if position actually changed
    const dLng = Math.abs(nLng - currentPosRef.current.lng)
    const dLat = Math.abs(nLat - currentPosRef.current.lat)
    const dHeading = Math.abs(nHeading - currentPosRef.current.heading)

    // If teleporting huge distance (> 5km, e.g. state change or new session), jump instantly
    if (dLng > 0.05 || dLat > 0.05) {
      currentPosRef.current = { lng: nLng, lat: nLat, heading: nHeading }
      setPos({ longitude: nLng, latitude: nLat, heading: nHeading })
      targetRef.current = { lng: nLng, lat: nLat, heading: nHeading }
      return
    }

    if (dLng < 0.000001 && dLat < 0.000001 && dHeading < 0.5) {
      return
    }

    // Setup animation
    const startLng = currentPosRef.current.lng
    const startLat = currentPosRef.current.lat
    const startHeading = currentPosRef.current.heading

    // Shortest angular path (-180 to +180)
    const headingDelta = ((nHeading - startHeading + 540) % 360) - 180

    const startTime = performance.now()
    const animDuration = Math.max(400, Math.min(durationMs, 2500))

    if (animRef.current) {
      cancelAnimationFrame(animRef.current)
    }

    const step = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / animDuration, 1.0)

      // Cubic ease-out curve for natural deceleration feel
      const ease = 1 - Math.pow(1 - progress, 3)

      const curLng = startLng + (nLng - startLng) * ease
      const curLat = startLat + (nLat - startLat) * ease
      const curHeading = (startHeading + headingDelta * ease + 360) % 360

      currentPosRef.current = { lng: curLng, lat: curLat, heading: curHeading }
      setPos({ longitude: curLng, latitude: curLat, heading: Math.round(curHeading * 10) / 10 })

      if (progress < 1.0) {
        animRef.current = requestAnimationFrame(step)
      } else {
        currentPosRef.current = { lng: nLng, lat: nLat, heading: nHeading }
        setPos({ longitude: nLng, latitude: nLat, heading: nHeading })
      }
    }

    animRef.current = requestAnimationFrame(step)

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current)
      }
    }
  }, [targetLng, targetLat, targetHeading, durationMs])

  return pos
}
