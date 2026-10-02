/**
 * cacheService.js
 *
 * Client-Side Caching, Stale-While-Revalidate (SWR), and Offline Outbox Engine.
 * Reduces network dependency, optimizes high-latency connections, and guarantees 0ms renders.
 */

const CACHE_PREFIX = 'vibemap_cache_';
const OFFLINE_PINGS_KEY = 'vibemap_offline_pings_queue';
const inFlightRequests = new Map();

/**
 * Save an item to localStorage cache with timestamp
 */
export function setCache(key, data, ttlMs = 1000 * 60 * 15) { // default 15 mins
  try {
    const record = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    };
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(record));
  } catch (err) {
    console.warn('[CacheService] Failed to write cache:', err);
  }
}

/**
 * Get an item from localStorage cache. Returns null if expired or missing.
 */
export function getCache(key, allowStale = true) {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;

    const record = JSON.parse(raw);
    const age = Date.now() - record.timestamp;

    if (!allowStale && record.ttl && age > record.ttl) {
      return null;
    }

    return {
      data: record.data,
      age,
      isStale: record.ttl ? age > record.ttl : false,
      timestamp: record.timestamp,
    };
  } catch (err) {
    console.warn('[CacheService] Failed to read cache:', err);
    return null;
  }
}

/**
 * Remove an item from cache
 */
export function removeCache(key) {
  try {
    localStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch (err) {
    console.warn('[CacheService] Failed to remove cache:', err);
  }
}

/**
 * Stale-While-Revalidate (SWR) Fetcher
 *
 * 1. Synchronously returns cached data if available (0ms render).
 * 2. Fetches fresh data in the background (deduplicating parallel in-flight requests).
 * 3. Updates cache and invokes onFreshData callback when new data arrives.
 *
 * @param {string} key - Unique cache key
 * @param {Function} fetcherFn - Async function that returns fresh data (e.g. () => API.get(...))
 * @param {Object} options
 * @param {number} [options.ttlMs=900000] - Time-to-live in ms (15m default)
 * @param {Function} [options.onCacheHit] - Invoked immediately with cached data
 * @param {Function} [options.onFreshData] - Invoked when background fetch completes
 * @param {Function} [options.onError] - Invoked if network fetch fails
 * @returns {Promise<any>} Resolves to fresh data or cached data fallback
 */
export async function fetchWithSWR(key, fetcherFn, options = {}) {
  const {
    ttlMs = 1000 * 60 * 15,
    onCacheHit,
    onFreshData,
    onError,
  } = options;

  // 1. Check local cache
  const cached = getCache(key, true);
  if (cached && cached.data) {
    if (typeof onCacheHit === 'function') {
      onCacheHit(cached.data, cached.isStale);
    }
  }

  // 2. Deduplicate in-flight requests
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetcherFn();
      const freshData = response?.data !== undefined ? response.data : response;

      // Update cache
      setCache(key, freshData, ttlMs);

      // Notify caller
      if (typeof onFreshData === 'function') {
        onFreshData(freshData);
      }

      return freshData;
    } catch (err) {
      console.warn(`[CacheService] Network fetch failed for ${key}, falling back to cache:`, err);
      if (typeof onError === 'function') {
        onError(err, cached?.data);
      }
      if (cached && cached.data) {
        return cached.data;
      }
      throw err;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, fetchPromise);
  return fetchPromise;
}

// ── Offline Location Pings Outbox Queue ─────────────────────────────────────

/**
 * Enqueue a location ping if network request fails or device is offline.
 * Keeps max 50 recent pings to prevent memory overflow.
 */
export function enqueueOfflinePing(ping) {
  try {
    const raw = localStorage.getItem(OFFLINE_PINGS_KEY);
    let queue = raw ? JSON.parse(raw) : [];
    
    // Add timestamp
    const item = {
      ...ping,
      queued_at: new Date().toISOString(),
    };

    queue.push(item);
    // Keep last 50
    if (queue.length > 50) {
      queue = queue.slice(-50);
    }

    localStorage.setItem(OFFLINE_PINGS_KEY, JSON.stringify(queue));
    console.log(`[OfflineQueue] Enqueued location ping. Total queued: ${queue.length}`);
  } catch (err) {
    console.warn('[OfflineQueue] Failed to enqueue offline ping:', err);
  }
}

/**
 * Flush all pending offline pings to the server
 */
export async function flushOfflinePings(sendFn) {
  if (!navigator.onLine) return;

  try {
    const raw = localStorage.getItem(OFFLINE_PINGS_KEY);
    if (!raw) return;

    const queue = JSON.parse(raw);
    if (!Array.isArray(queue) || queue.length === 0) return;

    console.log(`[OfflineQueue] Flushing ${queue.length} pending offline pings...`);

    // Process pings sequentially
    const remaining = [];
    for (const ping of queue) {
      try {
        await sendFn(ping);
      } catch (err) {
        console.warn('[OfflineQueue] Failed to sync ping, will retry later:', err);
        remaining.push(ping);
      }
    }

    if (remaining.length > 0) {
      localStorage.setItem(OFFLINE_PINGS_KEY, JSON.stringify(remaining));
    } else {
      localStorage.removeItem(OFFLINE_PINGS_KEY);
      console.log('[OfflineQueue] All offline pings synchronized successfully.');
    }
  } catch (err) {
    console.warn('[OfflineQueue] Error while flushing pings:', err);
  }
}

// ── Offline SOS Queue ───────────────────────────────────────────────────────
const OFFLINE_SOS_KEY = 'vibemap_offline_sos_queue';

export function enqueueOfflineSOS(sosPayload) {
  try {
    const raw = localStorage.getItem(OFFLINE_SOS_KEY);
    let queue = raw ? JSON.parse(raw) : [];
    queue.push({
      ...sosPayload,
      queued_at: new Date().toISOString(),
      id: `offline_sos_${Date.now()}`
    });
    localStorage.setItem(OFFLINE_SOS_KEY, JSON.stringify(queue));
    console.log('[OfflineQueue] Enqueued offline SOS trigger.');
  } catch (err) {
    console.warn('[OfflineQueue] Failed to enqueue offline SOS:', err);
  }
}

export function getPendingOfflineSOS() {
  try {
    const raw = localStorage.getItem(OFFLINE_SOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export async function flushOfflineSOS(triggerFn) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  try {
    const raw = localStorage.getItem(OFFLINE_SOS_KEY);
    if (!raw) return;
    const queue = JSON.parse(raw);
    if (!Array.isArray(queue) || queue.length === 0) return;

    console.log(`[OfflineQueue] Flushing ${queue.length} pending SOS triggers...`);
    const remaining = [];
    for (const item of queue) {
      try {
        await triggerFn(item);
      } catch (err) {
        console.warn('[OfflineQueue] Failed to flush SOS, will retry:', err);
        remaining.push(item);
      }
    }
    if (remaining.length > 0) {
      localStorage.setItem(OFFLINE_SOS_KEY, JSON.stringify(remaining));
    } else {
      localStorage.removeItem(OFFLINE_SOS_KEY);
    }
  } catch (err) {
    console.warn('[OfflineQueue] Error flushing SOS queue:', err);
  }
}

let syncSenderFn = null;
let syncSosFn = null;

export function registerOfflineSyncSender(fn) {
  syncSenderFn = fn;
}

export function registerOfflineSOSSender(fn) {
  syncSosFn = fn;
}

// Auto-flush on network reconnection
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Network] Connection restored. Triggering offline sync...');
    if (typeof syncSenderFn === 'function') {
      flushOfflinePings(syncSenderFn);
    }
    if (typeof syncSosFn === 'function') {
      flushOfflineSOS(syncSosFn);
    }
  });
}

