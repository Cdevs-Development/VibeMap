const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

// In-Memory LRU Caches for 0ms responses
const reverseGeocodeMemCache = new Map();
const searchGeocodeMemCache = new Map();

/**
 * Searches for a query string in Nigeria using MapTiler, Photon, and Nominatim.
 * Biases results toward the user's current location, but does not filter too aggressively.
 * @param {string} query
 * @param {object} userLocation [lng, lat] or {longitude, latitude}
 * @returns {Promise<Array>} Normalized array of search results
 */
export async function searchGeocoding(query, userLocation = null) {
  if (!query || query.trim().length < 2) return []

  const cleanQuery = query.trim().toLowerCase();
  const userLat = Number(userLocation?.latitude || userLocation?.lat || 6.5244).toFixed(2);
  const userLng = Number(userLocation?.longitude || userLocation?.lng || 3.3792).toFixed(2);
  const cacheKey = `${cleanQuery}_${userLat}_${userLng}`;

  if (searchGeocodeMemCache.has(cacheKey)) {
    return searchGeocodeMemCache.get(cacheKey);
  }

  const lng = Number(userLocation?.longitude || userLocation?.lng || 3.3792);
  const lat = Number(userLocation?.latitude || userLocation?.lat || 6.5244);

  // Run all sources in parallel with independent timeouts
  const [nominatimResults, photonResults, maptilerResults] = await Promise.allSettled([
    fetchNominatim(query, lng, lat),
    fetchPhoton(query, lng, lat),
    fetchMapTiler(query, lng, lat),
  ])

  // Collect all results strictly inside Nigeria bounds (lat 4.2-13.9, lng 2.6-14.7)
  const combined = []
  const seenNames = new Set()

  const addResults = (results) => {
    if (!results || !Array.isArray(results)) return
    for (const r of results) {
      if (!r || !r.name || !r.coordinates) continue
      const [rLng, rLat] = r.coordinates
      if (isNaN(rLng) || isNaN(rLat)) continue
      // Strict Nigeria Geographical Box
      if (rLat < 4.2 || rLat > 13.9 || rLng < 2.6 || rLng > 14.7) continue
      if (r.fullAddress && /(niger(?!ia)|cameroon|benin|chad|ghana|togo)/i.test(r.fullAddress) && !/nigeria/i.test(r.fullAddress)) continue

      const key = r.name.toLowerCase().slice(0, 25).trim()
      if (!seenNames.has(key)) {
        seenNames.add(key)
        combined.push(r)
      }
    }
  }

  // Photon and Nominatim give great coverage in Nigeria
  if (photonResults.status === 'fulfilled') {
    addResults(photonResults.value)
  }
  if (nominatimResults.status === 'fulfilled') {
    addResults(nominatimResults.value)
  }
  if (maptilerResults.status === 'fulfilled') {
    addResults(maptilerResults.value)
  }

  // Sort results by proximity to user location
  combined.sort((a, b) => {
    const distA = Math.hypot(a.coordinates[0] - lng, a.coordinates[1] - lat)
    const distB = Math.hypot(b.coordinates[0] - lng, b.coordinates[1] - lat)
    return distA - distB
  })

  const finalResults = combined.slice(0, 10);
  if (finalResults.length > 0) {
    searchGeocodeMemCache.set(cacheKey, finalResults);
  }
  return finalResults;
}

// --- Source 1: Nominatim ---
async function fetchNominatim(query, lng, lat) {
  try {
    const params = new URLSearchParams({
      format: 'json',
      q: query.includes('Nigeria') ? query : `${query} Nigeria`,
      countrycodes: 'ng',
      limit: '6',
      addressdetails: '1',
      extratags: '1',
      namedetails: '1',
      'accept-language': 'en',
    })

    if (lng && lat) {
      params.append('viewbox', `${lng - 3},${lat + 3},${lng + 3},${lat - 3}`)
      params.append('bounded', '0')
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3500)

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VibeMap-Nigeria-App'
        },
        signal: controller.signal
      }
    )
    clearTimeout(timer)

    if (!response.ok) return []
    const data = await response.json()
    if (!Array.isArray(data)) return []

    return data.map(item => {
      const addr = item.address || {}
      const parts = [
        addr.house_number,
        addr.road || addr.pedestrian || addr.path,
        addr.suburb || addr.neighbourhood || addr.quarter,
        addr.city || addr.town || addr.village || addr.county,
        addr.state,
      ].filter(Boolean)

      const lon = parseFloat(item.lon)
      const lat = parseFloat(item.lat)

      return {
        id: `nom-${item.place_id || Math.random().toString(36).slice(2)}`,
        name: parts.length > 0 ? parts.join(', ') : item.display_name,
        fullAddress: item.display_name,
        coordinates: [lon, lat],
        longitude: lon,
        latitude: lat,
        lng: lon,
        lat: lat,
        bbox: item.boundingbox
          ? [
              parseFloat(item.boundingbox[2]),
              parseFloat(item.boundingbox[0]),
              parseFloat(item.boundingbox[3]),
              parseFloat(item.boundingbox[1]),
            ]
          : null,
        source: 'nominatim',
        type: item.type,
      }
    })
  } catch (err) {
    return []
  }
}

// --- Source 2: Photon (OSM-based, fast and tolerant) ---
async function fetchPhoton(query, lng, lat) {
  try {
    const params = new URLSearchParams({
      q: query,
      limit: '8',
      lang: 'en',
      bbox: '2.5,4.0,15.0,14.0', // Nigeria bounding box
    })

    if (lng && lat) {
      params.append('lon', lng.toString())
      params.append('lat', lat.toString())
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3500)

    const response = await fetch(
      `https://photon.komoot.io/api/?${params}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      }
    )
    clearTimeout(timer)

    if (!response.ok) return []
    const data = await response.json()

    if (!data.features) return []

    return data.features
      .filter(f => {
        const country = f.properties?.country || ''
        return !country || country.toLowerCase().includes('nigeria')
      })
      .map(f => {
        const p = f.properties || {}
        const parts = [
          p.housenumber,
          p.street,
          p.district || p.locality,
          p.city || p.town || p.village,
          p.state,
        ].filter(Boolean)

        const name = p.name
          ? `${p.name}${parts.length ? ', ' + parts.join(', ') : ''}`
          : parts.join(', ') || 'Location in Nigeria'

        const coords = f.geometry?.coordinates || [0, 0]
        const lon = coords[0]
        const lat = coords[1]

        return {
          id: `photon-${p.osm_id || Math.random().toString(36).slice(2)}`,
          name,
          fullAddress: name,
          coordinates: coords, // [lng, lat]
          longitude: lon,
          latitude: lat,
          lng: lon,
          lat: lat,
          bbox: null,
          source: 'photon',
          type: p.osm_value || p.type,
        }
      })
  } catch (err) {
    return []
  }
}

// --- Source 3: MapTiler ---
async function fetchMapTiler(query, lng, lat) {
  if (!MAPTILER_KEY) return []
  try {
    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_KEY}&country=ng&proximity=${lng},${lat}&limit=5&types=address,street,place,neighbourhood,locality,poi`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3500)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)

    if (!response.ok) return []
    const data = await response.json()
    if (!data.features) return []

    return data.features.map(feat => {
      const coords = feat.geometry?.coordinates || [0, 0]
      const lon = coords[0]
      const lat = coords[1]
      return {
        id: `mt-${feat.id || Math.random().toString(36).slice(2)}`,
        name: feat.place_name || feat.text || 'Location',
        fullAddress: feat.place_name,
        coordinates: coords,
        longitude: lon,
        latitude: lat,
        lng: lon,
        lat: lat,
        bbox: feat.bbox || null,
        source: 'maptiler',
        type: feat.place_type?.[0],
      }
    })
  } catch (err) {
    return []
  }
}

/**
 * Calculates a route between two coordinates using OSRM.
 * @param {Array<number>} start [lng, lat]
 * @param {Array<number>} end [lng, lat]
 * @param {string} profile 'driving' or 'foot' (walking)
 * @returns {Promise<object|null>} Route data including GeoJSON, distance (km), duration (mins)
 */
export async function getOSRMRoute(start, end, profile = 'driving') {
  if (!start || !end) return null;

  // OSRM profiles: driving (car), foot (walk)
  const osrmProfile = profile === 'walking' ? 'foot' : 'driving';
  const coordinates = `${start[0]},${start[1]};${end[0]},${end[1]}`;
  const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${coordinates}?overview=full&geometries=geojson&steps=true`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OSRM error: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const distanceKm = route.distance / 1000;
      const baseMinutes = Math.round(route.duration / 60);
      const adjustedMinutes = applyNigerianTrafficFactor(baseMinutes, profile);
      const steps = route.legs?.[0]?.steps || [];

      return {
        geometry: route.geometry, // GeoJSON LineString
        distance: distanceKm, // meters to km
        duration: adjustedMinutes, // adjusted minutes
        isTrafficEstimate: true,
        steps: steps.map(s => ({
          name: s.name || '',
          distance: s.distance || 0,
          duration: s.duration || 0,
          maneuver: s.maneuver || {},
          location: s.maneuver?.location || null,
        }))
      };
    }
  } catch (error) {
    console.error('Error fetching OSRM route:', error);
    throw error;
  }

  return null;
}

/**
 * Applies a realistic traffic multiplier based on time of day
 * and Nigerian urban driving conditions.
 * OSRM assumes ideal speeds — Nigerian roads are rarely ideal.
 */
function applyNigerianTrafficFactor(baseMinutes, profile) {
  if (profile === 'walking') {
    // Walking estimates from OSRM are fairly accurate
    return Math.round(baseMinutes * 1.1);
  }

  const hour = new Date().getHours();

  // Morning rush: 6am - 10am
  if (hour >= 6 && hour < 10) {
    return Math.round(baseMinutes * 2.5);
  }

  // Afternoon rush: 4pm - 8pm
  if (hour >= 16 && hour < 20) {
    return Math.round(baseMinutes * 2.8);
  }

  // Midday: 10am - 4pm (moderate traffic)
  if (hour >= 10 && hour < 16) {
    return Math.round(baseMinutes * 1.6);
  }

  // Night: 8pm - 6am (light traffic)
  return Math.round(baseMinutes * 1.2);
}

/**
 * Queries the Overpass API for transit points and landmarks in the current bounding box.
 * @param {number} south Min Lat
 * @param {number} west Min Lng
 * @param {number} north Max Lat
 * @param {number} east Max Lng
 * @returns {Promise<Array>} Normalized POI list
 */
export async function fetchOverpassPOIs(south, west, north, east) {
  // Bounding box order for Overpass: (south, west, north, east)
  const bbox = `${south},${west},${north},${east}`;
  const query = `
    [out:json][timeout:20];
    (
      node["amenity"="bus_station"](${bbox});
      node["highway"="bus_stop"](${bbox});
      node["railway"="station"](${bbox});
      node["tourism"="landmark"](${bbox});
      node["tourism"="museum"](${bbox});
      node["historic"="monument"](${bbox});
      node["amenity"="place_of_worship"](${bbox});
    );
    out body 40; // cap at 40 results to preserve performance
  `;

  const url = `https://overpass-api.de/api/interpreter`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `data=${encodeURIComponent(query)}`
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.elements) return [];

    return data.elements.map(el => {
      const tags = el.tags || {};
      const name = tags.name || tags.official_name || tags.operator || 'Unnamed Location';
      
      // Determine category and sub-category
      let category = 'landmark';
      let icon;
      
      if (tags.amenity === 'bus_station' || tags.highway === 'bus_stop' || tags.railway === 'station') {
        category = 'transit';
        icon = tags.railway === 'station' ? '🚊' : '🚌';
      } else if (tags.tourism === 'museum') {
        icon = '🏛️';
      } else if (tags.historic === 'monument') {
        icon = '🗿';
      } else if (tags.amenity === 'place_of_worship') {
        icon = tags.religion === 'muslim' ? '🕌' : '⛪';
      } else {
        icon = '⭐';
      }

      return {
        id: `poi-${el.id}`,
        name: name,
        category: category,
        subCategory: tags.amenity || tags.highway || tags.tourism || tags.historic || 'other',
        coordinates: [el.lon, el.lat], // [lng, lat]
        icon
      };
    });
  } catch (error) {
    console.error('Error fetching Overpass POIs:', error);
    return [];
  }
}

export const POI_CATEGORIES = [
  { id: 'bus_stops', label: 'Bus Stops', icon: '🚏', color: '#3b82f6', queries: ['bus stop', 'motor park', 'brt station', 'transit station'] },
  { id: 'police', label: 'Police Stations', icon: '🚓', color: '#3b82f6', queries: ['police station', 'police post', 'area command', 'police'] },
  { id: 'hotels', label: 'Hotels', icon: '🏨', color: '#8b5cf6', queries: ['hotel', 'guest house', 'suites', 'motel', 'resort'] },
  { id: 'filling_stations', label: 'Filling Stations', icon: '⛽', color: '#f59e0b', queries: ['filling station', 'petrol station', 'fuel', 'nnpc', 'total', 'mobil'] },
  { id: 'supermarkets', label: 'Supermarkets', icon: '🛒', color: '#10b981', queries: ['supermarket', 'mart', 'grocery', 'shopping mall', 'market'] },
  { id: 'restaurants', label: 'Restaurants', icon: '🍽️', color: '#ec4899', queries: ['restaurant', 'eatery', 'fast food', 'buka', 'kitchen', 'food'] },
  { id: 'hospitals', label: 'Hospitals', icon: '🏥', color: '#ef4444', queries: ['hospital', 'clinic', 'medical centre', 'pharmacy', 'health centre'] },
];

/**
 * Calculates great-circle distance between two points in km (Haversine formula)
 */
export function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 99999;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Validates that a POI's address/state matches the user's current Nigerian state
 * and is not leaking from a completely different state.
 */
function isStateMatch(itemStateOrAddress, targetStateName) {
  if (!itemStateOrAddress || !targetStateName) return true;
  const text = itemStateOrAddress.toLowerCase();
  const target = targetStateName.toLowerCase().trim();

  // Normalized state aliases in Nigeria
  const aliases = {
    'abuja': ['abuja', 'fct', 'federal capital territory'],
    'fct': ['abuja', 'fct', 'federal capital territory'],
    'federal capital territory': ['abuja', 'fct', 'federal capital territory'],
    'lagos': ['lagos'],
    'rivers': ['rivers', 'port harcourt'],
    'oyo': ['oyo', 'ibadan'],
    'ogun': ['ogun', 'abeokuta'],
    'kano': ['kano'],
    'kaduna': ['kaduna'],
    'enugu': ['enugu'],
    'delta': ['delta', 'asaba', 'warri'],
    'edo': ['edo', 'benin'],
    'anambra': ['anambra', 'awka', 'onitsha'],
    'plateau': ['plateau', 'jos'],
    'akwa ibom': ['akwa ibom', 'uyo'],
    'imo': ['imo', 'owerri'],
    'abia': ['abia', 'uba', 'umuahia'],
    'cross river': ['cross river', 'calabar'],
    'bayelsa': ['bayelsa', 'yenagoa'],
    'benue': ['benue', 'makurdi'],
    'kwara': ['kwara', 'ilorin'],
    'kogi': ['kogi', 'lokoja'],
    'nasarawa': ['nasarawa', 'lafia'],
    'niger': ['niger', 'minna'],
    'osun': ['osun', 'osogbo'],
    'ondo': ['ondo', 'akure'],
    'ekiti': ['ekiti', 'ado-ekiti'],
  };

  const targetKeywords = aliases[target] || [target];

  // If text mentions target keywords, match immediately
  for (const kw of targetKeywords) {
    if (text.includes(kw)) return true;
  }

  // Major Nigerian states to prevent cross-state leak
  const allKnownStates = [
    'lagos', 'abuja', 'fct', 'rivers', 'oyo', 'ogun', 'kano', 'kaduna',
    'enugu', 'delta', 'edo', 'anambra', 'imo', 'abia', 'akwa ibom',
    'cross river', 'bayelsa', 'plateau', 'benue', 'kwara', 'kogi',
    'nasarawa', 'niger', 'osun', 'ondo', 'ekiti', 'sokoto', 'kebbi',
    'zamfara', 'katsina', 'jigawa', 'bauchi', 'borno', 'yobe', 'adamawa',
    'taraba', 'gombe'
  ];

  // If text explicitly mentions another known Nigerian state, reject
  for (const st of allKnownStates) {
    if (!targetKeywords.includes(st) && text.includes(st)) {
      return false;
    }
  }

  return true;
}

/**
 * Resolves the Nigerian State name from coordinates (instant lookup + reverse geocode)
 */
export async function getUserStateName(lng, lat) {
  if (!lng || !lat) return 'Abuja';

  // Fast coordinate boundaries for instant state resolution
  if (lat >= 6.3 && lat <= 6.8 && lng >= 2.7 && lng <= 4.4) return 'Lagos';
  if (lat >= 8.3 && lat <= 9.4 && lng >= 6.7 && lng <= 7.9) return 'Abuja';
  if (lat >= 4.5 && lat <= 5.2 && lng >= 6.6 && lng <= 7.4) return 'Rivers';
  if (lat >= 7.0 && lat <= 8.5 && lng >= 2.8 && lng <= 4.5) return 'Oyo';
  if (lat >= 6.6 && lat <= 7.4 && lng >= 2.9 && lng <= 4.5) return 'Ogun';
  if (lat >= 5.8 && lat <= 6.8 && lng >= 5.0 && lng <= 6.8) return 'Delta';
  if (lat >= 6.0 && lat <= 7.2 && lng >= 5.1 && lng <= 6.7) return 'Edo';
  if (lat >= 5.9 && lat <= 6.9 && lng >= 6.8 && lng <= 7.8) return 'Anambra';
  if (lat >= 6.0 && lat <= 7.1 && lng >= 7.1 && lng <= 7.8) return 'Enugu';
  if (lat >= 11.5 && lat <= 12.5 && lng >= 8.2 && lng <= 9.2) return 'Kano';
  if (lat >= 10.0 && lat <= 11.0 && lng >= 7.1 && lng <= 7.9) return 'Kaduna';
  if (lat >= 9.5 && lat <= 10.5 && lng >= 8.5 && lng <= 9.5) return 'Plateau';
  if (lat >= 4.6 && lat <= 5.5 && lng >= 7.5 && lng <= 8.5) return 'Akwa Ibom';
  if (lat >= 5.0 && lat <= 6.0 && lng >= 7.0 && lng <= 7.8) return 'Imo';
  if (lat >= 5.1 && lat <= 6.0 && lng >= 7.2 && lng <= 7.9) return 'Abia';
  if (lat >= 4.7 && lat <= 7.0 && lng >= 7.8 && lng <= 9.5) return 'Cross River';
  if (lat >= 4.5 && lat <= 5.4 && lng >= 5.8 && lng <= 6.7) return 'Bayelsa';
  if (lat >= 7.0 && lat <= 8.2 && lng >= 7.6 && lng <= 9.8) return 'Benue';
  if (lat >= 8.0 && lat <= 9.3 && lng >= 4.3 && lng <= 5.8) return 'Kwara';
  if (lat >= 7.3 && lat <= 8.5 && lng >= 6.0 && lng <= 7.8) return 'Kogi';
  if (lat >= 8.0 && lat <= 9.3 && lng >= 7.0 && lng <= 9.5) return 'Nasarawa';
  if (lat >= 8.5 && lat <= 11.2 && lng >= 3.5 && lng <= 7.2) return 'Niger';
  if (lat >= 7.0 && lat <= 8.1 && lng >= 4.0 && lng <= 5.2) return 'Osun';
  if (lat >= 6.8 && lat <= 7.8 && lng >= 4.7 && lng <= 5.8) return 'Ondo';
  if (lat >= 7.4 && lat <= 8.1 && lng >= 5.0 && lng <= 5.7) return 'Ekiti';

  try {
    const raw = await reverseGeocode(lng, lat);
    if (raw && typeof raw === 'string') {
      const parts = raw.split(',').map(s => s.trim());
      for (const p of parts) {
        if (p.toLowerCase().includes('fct') || p.toLowerCase().includes('abuja') || p.toLowerCase().includes('federal capital territory')) {
          return 'Abuja';
        }
        if (p.toLowerCase().includes('state')) {
          return p.replace(/state/i, '').trim();
        }
      }
      if (parts.length >= 2) return parts[parts.length - 2].replace(/state/i, '').trim();
    }
  } catch (_) {}

  return 'Nigeria';
}

/**
 * Fetches specific category POIs strictly in the user's vicinity / state in Nigeria
 * Combines Photon + Nominatim + Overpass with local bounding box and 40km proximity filter
 */
export async function fetchCategoryPOIs(categoryId, south, west, north, east, centerLng, centerLat) {
  const cat = POI_CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return [];

  const lat = Number(centerLat) || 6.5244;
  const lng = Number(centerLng) || 3.3792;
  const stateName = await getUserStateName(lng, lat);
  const queries = cat.queries || [cat.label];

  const combined = [];
  const seenKeys = new Set();

  // Local bounding box (~38km box around center)
  const deltaDeg = 0.35;
  const minLng = (lng - deltaDeg).toFixed(4);
  const minLat = (lat - deltaDeg).toFixed(4);
  const maxLng = (lng + deltaDeg).toFixed(4);
  const maxLat = (lat + deltaDeg).toFixed(4);
  const localBbox = `${minLng},${minLat},${maxLng},${maxLat}`;

  const addPoi = (poi) => {
    if (!poi || !poi.coordinates || poi.coordinates.length < 2) return;
    const [pLng, pLat] = poi.coordinates;
    if (isNaN(pLng) || isNaN(pLat)) return;
    // Strict Nigeria Geographic Bounds check
    if (pLat < 4.2 || pLat > 13.9 || pLng < 2.6 || pLng > 14.7) return;
    if (poi.address && /(niger(?!ia)|cameroon|benin|chad|ghana|togo)/i.test(poi.address) && !/nigeria/i.test(poi.address)) return;

    // Strict local proximity check: within 40 km of the user / map center
    const distKm = getDistanceKm(lat, lng, pLat, pLng);
    if (distKm > 40) return;

    // Strict state validation: reject if item explicitly mentions a different state
    if (poi.state && !isStateMatch(poi.state, stateName)) return;
    if (poi.address && !isStateMatch(poi.address, stateName)) return;

    poi.longitude = pLng;
    poi.latitude = pLat;
    poi.lng = pLng;
    poi.lat = pLat;
    poi.distanceKm = Number(distKm.toFixed(1));

    const key = `${(poi.name || '').toLowerCase().slice(0, 16)}_${Number(pLng).toFixed(3)}_${Number(pLat).toFixed(3)}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      combined.push(poi);
    }
  };

  // 1. Primary: Photon localized query strictly bounded to local bbox
  try {
    const photonPromises = queries.map(q =>
      fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q + ' ' + stateName)}&lat=${lat}&lon=${lng}&limit=35&bbox=${localBbox}`, {
        headers: { 'Accept': 'application/json' }
      }).then(r => r.ok ? r.json() : null).catch(() => null)
    );

    const photonResults = await Promise.all(photonPromises);
    for (const data of photonResults) {
      if (data && Array.isArray(data.features)) {
        for (const feat of data.features) {
          const coords = feat.geometry?.coordinates;
          if (!coords || coords.length < 2) continue;
          const props = feat.properties || {};
          const name = props.name || (props.street ? `${props.street} ${cat.label}` : cat.label);
          const addressParts = [props.street, props.district, props.city, props.state].filter(Boolean);

          addPoi({
            id: `poi-photon-${props.osm_id || Math.random().toString(36).slice(2)}`,
            name,
            category: categoryId,
            categoryLabel: cat.label,
            icon: cat.icon,
            color: cat.color,
            coordinates: coords,
            address: addressParts.length > 0 ? addressParts.join(', ') : (props.state || props.country || stateName),
            state: props.state || stateName,
          });
        }
      }
    }
  } catch (err) {
    console.warn('Photon POI search error:', err);
  }

  // 2. Secondary: Nominatim strictly bounded local search
  try {
    const nominatimPromises = queries.slice(0, 3).map(q => {
      const params = new URLSearchParams({
        format: 'json',
        q: `${q}, ${stateName}, Nigeria`,
        countrycodes: 'ng',
        limit: '25',
        addressdetails: '1',
        extratags: '1',
        viewbox: `${minLng},${maxLat},${maxLng},${minLat}`,
        bounded: '1', // STRICTLY BOUNDED to the local viewbox!
      });
      return fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VibeMap-Nigeria-App'
        }
      }).then(r => r.ok ? r.json() : null).catch(() => null);
    });

    const nomResults = await Promise.all(nominatimPromises);
    for (const items of nomResults) {
      if (Array.isArray(items)) {
        for (const item of items) {
          const pLat = parseFloat(item.lat);
          const pLng = parseFloat(item.lon);
          if (isNaN(pLat) || isNaN(pLng)) continue;
          const addr = item.address || {};
          const parts = [
            addr.house_number,
            addr.road || addr.pedestrian || addr.path,
            addr.suburb || addr.neighbourhood,
            addr.city || addr.town || addr.village,
            addr.state,
          ].filter(Boolean);

          addPoi({
            id: `poi-nom-${item.place_id || Math.random().toString(36).slice(2)}`,
            name: item.name || parts[0] || cat.label,
            category: categoryId,
            categoryLabel: cat.label,
            icon: cat.icon,
            color: cat.color,
            coordinates: [pLng, pLat],
            address: parts.length > 0 ? parts.join(', ') : (item.display_name || stateName),
            state: addr.state || stateName,
          });
        }
      }
    }
  } catch (nomErr) {
    console.warn('Nominatim POI search error:', nomErr);
  }

  // 3. Tertiary: Overpass search bounded to 35 km radius
  if (combined.length < 8) {
    try {
      const aroundClause = `(around:35000, ${lat}, ${lng})`;
      let overpassQuery = '';
      if (categoryId === 'bus_stops') {
        overpassQuery = `node["highway"="bus_stop"]${aroundClause}; node["amenity"="bus_station"]${aroundClause};`;
      } else if (categoryId === 'police') {
        overpassQuery = `node["amenity"="police"]${aroundClause};`;
      } else if (categoryId === 'hotels') {
        overpassQuery = `node["tourism"="hotel"]${aroundClause};`;
      } else if (categoryId === 'filling_stations') {
        overpassQuery = `node["amenity"="fuel"]${aroundClause};`;
      } else if (categoryId === 'supermarkets') {
        overpassQuery = `node["shop"="supermarket"]${aroundClause};`;
      } else if (categoryId === 'restaurants') {
        overpassQuery = `node["amenity"="restaurant"]${aroundClause};`;
      } else if (categoryId === 'hospitals') {
        overpassQuery = `node["amenity"="hospital"]${aroundClause};`;
      }

      if (overpassQuery) {
        const q = `[out:json][timeout:8];(${overpassQuery});out body center 35;`;
        const res = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(q)}`
        });
        if (res.ok) {
          const data = await res.json();
          if (data.elements && data.elements.length > 0) {
            for (const el of data.elements) {
              const tags = el.tags || {};
              const name = tags.name || tags.operator || `${cat.label.slice(0, -1)}`;
              const elLon = el.lon !== undefined ? el.lon : (el.center ? el.center.lon : null);
              const elLat = el.lat !== undefined ? el.lat : (el.center ? el.center.lat : null);
              if (elLon !== null && elLat !== null) {
                addPoi({
                  id: `poi-op-${el.id}`,
                  name,
                  category: categoryId,
                  categoryLabel: cat.label,
                  icon: cat.icon,
                  color: cat.color,
                  coordinates: [elLon, elLat],
                  address: tags['addr:street'] || tags['addr:city'] || stateName,
                  state: tags['addr:state'] || stateName,
                });
              }
            }
          }
        }
      }
    } catch (opErr) {
      console.warn('Overpass fallback error:', opErr);
    }
  }

  // Sort by distance from center coordinates (closest first)
  combined.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

  return combined.slice(0, 45);
}

/**
 * Searches for custom user-typed POIs in the user's vicinity / state in Nigeria
 */
export async function fetchCustomPOIs(query, centerLng, centerLat) {
  if (!query || !query.trim()) return [];
  const cleanQuery = query.trim();
  const lat = Number(centerLat) || 6.5244;
  const lng = Number(centerLng) || 3.3792;
  const stateName = await getUserStateName(lng, lat);

  const combined = [];
  const seenKeys = new Set();

  const deltaDeg = 0.35;
  const minLng = (lng - deltaDeg).toFixed(4);
  const minLat = (lat - deltaDeg).toFixed(4);
  const maxLng = (lng + deltaDeg).toFixed(4);
  const maxLat = (lat + deltaDeg).toFixed(4);
  const localBbox = `${minLng},${minLat},${maxLng},${maxLat}`;

  const addPoi = (poi) => {
    if (!poi || !poi.coordinates || poi.coordinates.length < 2) return;
    const [pLng, pLat] = poi.coordinates;
    if (isNaN(pLng) || isNaN(pLat)) return;
    // Strict Nigeria Geographic Bounds check
    if (pLat < 4.2 || pLat > 13.9 || pLng < 2.6 || pLng > 14.7) return;
    if (poi.address && /(niger(?!ia)|cameroon|benin|chad|ghana|togo)/i.test(poi.address) && !/nigeria/i.test(poi.address)) return;

    // Strict local proximity check: within 40 km of user
    const distKm = getDistanceKm(lat, lng, pLat, pLng);
    if (distKm > 40) return;

    // Strict state validation: reject if item explicitly mentions a different state
    if (poi.state && !isStateMatch(poi.state, stateName)) return;
    if (poi.address && !isStateMatch(poi.address, stateName)) return;

    poi.longitude = pLng;
    poi.latitude = pLat;
    poi.lng = pLng;
    poi.lat = pLat;
    poi.distanceKm = Number(distKm.toFixed(1));

    const key = `${(poi.name || '').toLowerCase().slice(0, 16)}_${Number(pLng).toFixed(3)}_${Number(pLat).toFixed(3)}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      combined.push(poi);
    }
  };

  // 1. Photon with local bounding box & state awareness
  try {
    const photonPromises = [
      fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery + ' ' + stateName)}&lat=${lat}&lon=${lng}&limit=35&bbox=${localBbox}`, {
        headers: { 'Accept': 'application/json' }
      }).then(r => r.ok ? r.json() : null).catch(() => null),
    ];

    const photonResults = await Promise.all(photonPromises);
    for (const data of photonResults) {
      if (data && Array.isArray(data.features)) {
        for (const feat of data.features) {
          const coords = feat.geometry?.coordinates;
          if (!coords || coords.length < 2) continue;
          const props = feat.properties || {};
          const name = props.name || props.street || cleanQuery;
          const addressParts = [props.street, props.district, props.city, props.state].filter(Boolean);

          addPoi({
            id: `poi-custom-${props.osm_id || Math.random().toString(36).slice(2)}`,
            name,
            category: 'custom',
            categoryLabel: cleanQuery.charAt(0).toUpperCase() + cleanQuery.slice(1),
            icon: '📍',
            color: '#06b6d4',
            coordinates: coords,
            address: addressParts.length > 0 ? addressParts.join(', ') : (props.state || props.country || stateName),
            state: props.state || stateName,
          });
        }
      }
    }
  } catch (err) {
    console.warn('Custom Photon POI search error:', err);
  }

  // 2. Nominatim Local Bounded Search
  try {
    const params = new URLSearchParams({
      format: 'json',
      q: `${cleanQuery}, ${stateName}, Nigeria`,
      countrycodes: 'ng',
      limit: '25',
      addressdetails: '1',
      viewbox: `${minLng},${maxLat},${maxLng},${minLat}`,
      bounded: '1',
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VibeMap-Nigeria-App'
      }
    });
    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items)) {
        for (const item of items) {
          const pLat = parseFloat(item.lat);
          const pLng = parseFloat(item.lon);
          if (isNaN(pLat) || isNaN(pLng)) continue;
          const addr = item.address || {};
          const parts = [
            addr.house_number,
            addr.road || addr.pedestrian || addr.path,
            addr.suburb || addr.neighbourhood,
            addr.city || addr.town || addr.village,
            addr.state,
          ].filter(Boolean);

          addPoi({
            id: `poi-nom-${item.place_id || Math.random().toString(36).slice(2)}`,
            name: item.name || parts[0] || cleanQuery,
            category: 'custom',
            categoryLabel: cleanQuery.charAt(0).toUpperCase() + cleanQuery.slice(1),
            icon: '📍',
            color: '#06b6d4',
            coordinates: [pLng, pLat],
            address: parts.length > 0 ? parts.join(', ') : (item.display_name || stateName),
            state: addr.state || stateName,
          });
        }
      }
    }
  } catch (nomErr) {
    console.warn('Nominatim Custom POI search error:', nomErr);
  }

  // Sort by distance from center coordinates (closest first)
  combined.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

  return combined.slice(0, 45);
}

/**
 * Reverse geocodes a coordinate using Nominatim with multi-tier memory + localStorage cache.
 * Resolves repeated queries in 0ms without hitting external networks.
 * @param {number} lng 
 * @param {number} lat 
 * @returns {Promise<string>} The display name of the location
 */
export async function reverseGeocode(lng, lat) {
  if (!lng || !lat) return 'Unknown location';
  
  // Round to ~11m precision to deduplicate micro GPS drifts
  const cacheKey = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
  
  // Tier 1: In-memory cache (0ms)
  if (reverseGeocodeMemCache.has(cacheKey)) {
    return reverseGeocodeMemCache.get(cacheKey);
  }

  // Tier 2: LocalStorage cache (0ms)
  try {
    const cached = localStorage.getItem(`vibemap_rg_${cacheKey}`);
    if (cached) {
      reverseGeocodeMemCache.set(cacheKey, cached);
      return cached;
    }
  } catch (e) {
    // Ignore storage quota errors
  }

  try {
    const params = new URLSearchParams({
      format: 'json',
      lat: lat.toString(),
      lon: lng.toString(),
      zoom: '18',
      addressdetails: '1',
    });
    
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VibeMap-Nigeria-App'
      }
    });

    if (!response.ok) return 'Unknown location';
    const data = await response.json();
    
    let resolvedName = 'Unknown location';
    if (data && data.address) {
      const addr = data.address;
      const parts = [
        addr.road || addr.pedestrian || addr.path,
        addr.suburb || addr.neighbourhood || addr.quarter,
        addr.city || addr.town || addr.village,
        addr.state
      ].filter(Boolean);
      resolvedName = parts.length > 0 ? parts.join(', ') : data.display_name;
    } else if (data?.display_name) {
      resolvedName = data.display_name;
    }

    // Save to Tier 1 & Tier 2 caches
    reverseGeocodeMemCache.set(cacheKey, resolvedName);
    try {
      localStorage.setItem(`vibemap_rg_${cacheKey}`, resolvedName);
    } catch (e) {
      // LocalStorage full, ignore
    }

    return resolvedName;
  } catch (err) {
    console.warn('Reverse geocoding failed:', err);
    return 'Unknown location';
  }
}

