/**
 * mapStyle.js
 *
 * Provides resilient, high-performance map styles with automatic fallbacks:
 * 1. Primary: MapTiler Streets v2 Dark (with built-in fallback API key).
 * 2. Fallback: CartoDB Dark Matter (Free, zero API key required, ultra-reliable).
 */

const FALLBACK_MAPTILER_KEY = 'auiVaEOcO5p2q9MCtQPQ'

export const getMapTilerKey = () => {
  const envKey = import.meta.env.VITE_MAPTILER_KEY
  if (envKey && envKey.trim() !== '' && envKey !== 'undefined' && envKey !== 'null') {
    return envKey
  }
  return FALLBACK_MAPTILER_KEY
}

export const PRIMARY_DARK_MAP_STYLE = `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${getMapTilerKey()}`
export const FALLBACK_DARK_MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
export const OSM_LIBERTY_STYLE = 'https://maplibre.org/maplibre-gl-js/resources/style.json'

export const getDarkMapStyle = () => {
  const key = getMapTilerKey()
  if (key && key.length > 5) {
    return `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${key}`
  }
  return FALLBACK_DARK_MAP_STYLE
}

export default getDarkMapStyle
