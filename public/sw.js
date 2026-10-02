/**
 * VibeMap Service Worker (sw.js)
 * Version: v6 — locationService race-condition fix (single source of truth)
 */

const SHELL_CACHE = 'vibemap-shell-v6';
const MAP_TILES_CACHE = 'vibemap-map-tiles-v6';
const FONTS_CACHE = 'vibemap-fonts-v6';
const NOMINATIM_CACHE = 'vibemap-nominatim-v6';

const ALL_CACHES = [SHELL_CACHE, MAP_TILES_CACHE, FONTS_CACHE, NOMINATIM_CACHE];

// Install Event — Force new service worker to activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate Event — Clean up all old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!ALL_CACHES.includes(key)) {
            console.log('[SW] Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Message Listener for In-App Update trigger
self.addEventListener('message', (event) => {
  if (event.data) {
    if (event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
    if (event.data.type === 'CLEAR_ALL_CACHES') {
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
    }
  }
});

// Fetch Event — Route to appropriate caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests, backend API requests, and APK downloads
  if (request.method !== 'GET' || url.pathname.includes('/api/') || url.pathname.includes('/downloads/')) {
    return;
  }


  // Strategy 1: MapTiler Vector Tiles, Styles & Sprites (Cache-First)
  if (url.hostname.includes('maptiler.com') || url.hostname.includes('tiles.openmaptiles.org')) {
    event.respondWith(
      caches.open(MAP_TILES_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch (err) {
          if (cached) return cached;
          throw err;
        }
      })
    );
    return;
  }

  // Strategy 2: Google Fonts (Cache-First)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(FONTS_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch (err) {
          if (cached) return cached;
          throw err;
        }
      })
    );
    return;
  }

  // Strategy 3: Nominatim Geocoding API (Network-First)
  if (url.hostname.includes('nominatim.openstreetmap.org')) {
    event.respondWith(
      caches.open(NOMINATIM_CACHE).then(async (cache) => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch (err) {
          const cached = await cache.match(request);
          if (cached) return cached;
          throw err;
        }
      })
    );
    return;
  }

  // Strategy 4: HTML Navigation & App Code (Network-First with Cache Fallback)
  // Ensures updates are delivered immediately without stale cache locks
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((fresh) => {
          if (fresh && fresh.ok && request.method === 'GET') {
            try {
              const copy = fresh.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            } catch (_) {}
          }
          return fresh;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const indexCached = await caches.match('/index.html');
          if (indexCached) return indexCached;
          return new Response(
            '<!DOCTYPE html><html><body style="background:#080810;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;padding:20px;"><div><h2>VibeMap Offline</h2><p style="color:#94a3b8">Please check your internet connection and reload.</p><button onclick="window.location.reload()" style="background:#8b5cf6;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600;margin-top:10px;">Reload</button></div></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // Default: Stale-while-revalidate for static hashed JS/CSS
  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const fetchPromise = fetch(request).then((fresh) => {
        if (fresh && fresh.ok && request.url.startsWith('http') && request.method === 'GET') {
          try {
            const copy = fresh.clone();
            cache.put(request, copy).catch(() => {});
          } catch (_) {}
        }
        return fresh;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// Notification Click Event — Focus existing tab or open /family
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/family';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

