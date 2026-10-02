/**
 * webgl.js
 *
 * Safely checks if WebGL hardware graphics acceleration is supported
 * and active in the current browser or WebView environment.
 */

export function isWebGLSupported() {
  if (typeof window === 'undefined') return true
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    return Boolean(window.WebGLRenderingContext && gl)
  } catch (e) {
    console.warn('[WebGL] Detection error:', e)
    return false
  }
}

export default isWebGLSupported
