/**
 * pipService.js
 *
 * Desktop Document PiP Support.
 * On Android, native OS Picture-in-Picture is handled directly by MainActivity.java.
 */

import { getActiveJourney, subscribeJourneyState } from './journeyState'

let activePipWindow = null

export function isPiPSupported() {
  if (typeof window === 'undefined') return false
  return Boolean('documentPictureInPicture' in window)
}

/**
 * Open Desktop Document PiP Window (if supported on desktop Chrome)
 */
export async function openNavigationPiP({ onEndJourney, onTriggerSOS, onFocusApp } = {}) {
  if (activePipWindow) {
    try { activePipWindow.focus() } catch (_) {}
    return activePipWindow
  }

  const journey = getActiveJourney()
  if (!journey.isNavigating) return null

  if ('documentPictureInPicture' in window) {
    try {
      const pipWin = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 200,
      })

      activePipWindow = pipWin

      const styleEl = pipWin.document.createElement('style')
      styleEl.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=Inter:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
        body {
          background: #080810;
          color: #ffffff;
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
          height: 100vh;
          width: 100vw;
          display: flex;
          flex-direction: column;
          justifyContent: space-between;
          padding: 12px;
          overflow: hidden;
        }
        .pip-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .pip-dest { font-size: 13px; font-weight: 800; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
        .pip-sub { font-size: 11px; color: #06b6d4; font-weight: 600; margin-top: 2px; }
        .pip-stats { display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(139,92,246,0.3); border-radius: 10px; padding: 8px 12px; font-size: 12px; }
        .pip-actions { display: flex; gap: 8px; }
        .pip-btn { flex: 1; padding: 9px; border-radius: 8px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; font-family: inherit; }
        .pip-btn-sos { background: radial-gradient(circle, #ef4444 0%, #b91c1c 100%); color: white; box-shadow: 0 0 12px rgba(239,68,68,0.5); }
        .pip-btn-end { background: rgba(255,255,255,0.12); color: #94a3b8; }
        .pip-btn-max { background: #7c3aed; color: white; }
      `
      pipWin.document.head.appendChild(styleEl)

      pipWin.document.body.innerHTML = `
        <div class="pip-header">
          <div>
            <div id="pip-dest" class="pip-dest">${journey.destination?.label || 'Navigating...'}</div>
            <div id="pip-eta" class="pip-sub">Calculating route...</div>
          </div>
          <button id="pip-btn-max" class="pip-btn pip-btn-max" style="flex:0; padding:6px 10px; font-size:11px;" title="Open Full App">🗖</button>
        </div>

        <div class="pip-stats">
          <div><span style="color:#06b6d4">SPD:</span> <span id="pip-speed">${journey.speedKmh || 0}</span> km/h</div>
          <div style="color:rgba(255,255,255,0.2)">|</div>
          <div><span style="color:#10b981">DIST:</span> <span id="pip-dist">--</span></div>
        </div>

        <div class="pip-actions">
          <button id="pip-btn-sos" class="pip-btn pip-btn-sos">🆘 SOS</button>
          <button id="pip-btn-end" class="pip-btn pip-btn-end">✕ End</button>
        </div>
      `

      pipWin.document.getElementById('pip-btn-sos')?.addEventListener('click', () => {
        if (typeof onTriggerSOS === 'function') onTriggerSOS()
        try { window.focus() } catch (_) {}
      })

      pipWin.document.getElementById('pip-btn-end')?.addEventListener('click', () => {
        if (typeof onEndJourney === 'function') onEndJourney()
        closeNavigationPiP()
      })

      pipWin.document.getElementById('pip-btn-max')?.addEventListener('click', () => {
        if (typeof onFocusApp === 'function') onFocusApp()
        try { window.focus() } catch (_) {}
        closeNavigationPiP()
      })

      const unsubscribe = subscribeJourneyState((state) => {
        if (!state.isNavigating) {
          closeNavigationPiP()
          return
        }

        const destEl = pipWin.document.getElementById('pip-dest')
        const etaEl = pipWin.document.getElementById('pip-eta')
        const speedEl = pipWin.document.getElementById('pip-speed')
        const distEl = pipWin.document.getElementById('pip-dist')

        if (destEl && state.destination?.label) destEl.textContent = state.destination.label
        if (speedEl) speedEl.textContent = state.speedKmh || 0

        if (distEl && state.distanceMeters) {
          const km = (state.distanceMeters / 1000).toFixed(1)
          distEl.textContent = `${km} km`
        }

        if (etaEl && state.durationSeconds) {
          const mins = Math.max(1, Math.round(state.durationSeconds / 60))
          etaEl.textContent = `🚀 ${mins} min${mins === 1 ? '' : 's'} remaining`
        }
      })

      pipWin.addEventListener('pagehide', () => {
        activePipWindow = null
        unsubscribe()
      })

      return pipWin
    } catch (err) {
      console.warn('[PiP] Document PiP request error:', err)
    }
  }

  return null
}

/**
 * Close any active Desktop Document PiP Window
 */
export function closeNavigationPiP() {
  if (activePipWindow) {
    try { activePipWindow.close() } catch (_) {}
    activePipWindow = null
  }
}
