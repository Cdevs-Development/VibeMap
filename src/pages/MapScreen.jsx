import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import Map, { Marker, Popup, Source, Layer } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Crosshair,
  Compass,
  Navigation,
  Navigation2,
  Search,
  X,
  Volume2,
  VolumeX,
  Plus,
  Car,
  Footprints,
  RotateCw,
  Trash2,
  Check,
  CheckCircle2,
  Shield,
  ShieldAlert,
  PhoneCall,
  Flame,
  Radio,
  Lock,
  Sparkles,
  Layers,
  SlidersHorizontal,
  MapPin,
  AlertTriangle,
  Share2
} from 'lucide-react'
import { searchGeocoding, getOSRMRoute, fetchOverpassPOIs, fetchCategoryPOIs, fetchCustomPOIs, POI_CATEGORIES, getUserStateName } from '../services/mapService'
import { startTrip, endTrip, createLocationPing, getVibePins, confirmVibePin, deleteVibePin, getSOSPinStatus, getCurrentUser } from '../services/api'
import { getCache, setCache } from '../services/cacheService'
import { updateActiveJourney, stopActiveJourney, getActiveJourney } from '../services/journeyState'
import { processVoiceGuidance, resetVoiceNavigation, announceReroute, setVoiceMuted, isVoiceEnabled, speakInstruction, getActiveManeuverDetails } from '../services/voiceNavigationService'
import { GPSSmoother } from '../services/gpsSmoothing'
import { useSmoothPosition } from '../services/useSmoothPosition'
import { closeNavigationPiP } from '../services/pipService'
import locationService from '../services/locationService'
import Notifications from '../components/Notifications'
import BottomNav from '../components/BottomNav'
import Logo from '../components/Logo'
import isWebGLSupported from '../utils/webgl'
import WebGLFallback from '../components/WebGLFallback'
import getDarkMapStyle, { FALLBACK_DARK_MAP_STYLE } from '../utils/mapStyle'

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY

const VIBE_CATEGORY_META = {
  traffic: { icon: '🚦', color: '#ea580c', title: 'Traffic' },
  construction: { icon: '🚧', color: '#f59e0b', title: 'Construction' },
  party: { icon: '🎉', color: '#8b5cf6', title: 'Party' },
  unsafe: { icon: '⚠️', color: '#ef4444', title: 'Unsafe' },
  market: { icon: '🛒', color: '#06b6d4', title: 'Market' },
  wedding: { icon: '💍', color: '#a855f7', title: 'Wedding' },
}

const getPinMeta = (pin) => VIBE_CATEGORY_META[pin.category] || { icon: '📍', color: '#8b5cf6', title: pin.category || 'Vibe' }

function calcArrivalTime(durationMinutes) {
  if (!durationMinutes) return ''
  const now = new Date()
  now.setMinutes(now.getMinutes() + Math.round(durationMinutes))
  let hours = now.getHours()
  let minutes = now.getMinutes()
  const ampm = hours >= 12 ? 'pm' : 'am'
  hours = hours % 12
  hours = hours ? hours : 12
  const minutesStr = minutes < 10 ? '0' + minutes : minutes
  return `${hours}:${minutesStr} ${ampm}`
}

function getManeuverIcon(modifier, type, size = 30) {
  const mod = (modifier || '').toLowerCase()
  const t = (type || '').toLowerCase()

  if (t === 'arrive') {
    return <span style={{ fontSize: size }}>🎯</span>
  }
  if (t === 'roundabout' || t === 'rotary') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        <polyline points="15 3 21 3 21 9" />
      </svg>
    )
  }
  if (mod.includes('uturn')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v5" />
      </svg>
    )
  }
  if (mod.includes('sharp left') || mod === 'left') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 7 4 12 9 17" />
        <path d="M4 12h11a5 5 0 0 1 5 5v3" />
      </svg>
    )
  }
  if (mod.includes('slight left')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="7 6 7 12 13 12" />
        <path d="M7 12 18 21" />
      </svg>
    )
  }
  if (mod.includes('sharp right') || mod === 'right') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 7 20 12 15 17" />
        <path d="M20 12H9a5 5 0 0 0-5 5v3" />
      </svg>
    )
  }
  if (mod.includes('slight right')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 6 17 12 11 12" />
        <path d="M17 12 6 21" />
      </svg>
    )
  }
  // Straight / default
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

// 3D Navigation Car SVG (Driving Mode)
const NavCarSvg = ({ heading }) => (
  <div style={{
    width: 38,
    height: 48,
    position: 'relative',
    transform: `rotate(${heading}deg)`,
    transformOrigin: 'center center',
    filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.75))',
    pointerEvents: 'none',
  }}>
    <svg viewBox="0 0 44 56" width="38" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="22" cy="30" rx="17" ry="22" fill="rgba(0,0,0,0.45)" filter="blur(3px)" />
      {/* Main Car Body */}
      <rect x="8" y="6" width="28" height="44" rx="8" fill="#f8fafc" stroke="#64748b" strokeWidth="1.5" />
      {/* Hood */}
      <path d="M10 16 C10 10, 34 10, 34 16 L34 20 L10 20 Z" fill="#e2e8f0" />
      {/* Windshield */}
      <path d="M11 20 C14 18, 30 18, 33 20 L31 27 L13 27 Z" fill="#0f172a" />
      {/* Roof */}
      <rect x="13" y="27" width="18" height="13" rx="3" fill="#0284c7" />
      {/* Rear Window */}
      <path d="M13 40 L31 40 L33 44 C30 45, 14 45, 11 44 Z" fill="#0f172a" />
      {/* Headlights */}
      <rect x="9" y="7" width="5" height="3" rx="1.5" fill="#fef08a" />
      <rect x="30" y="7" width="5" height="3" rx="1.5" fill="#fef08a" />
      {/* Taillights */}
      <rect x="9" y="47" width="6" height="2.5" rx="1" fill="#ef4444" />
      <rect x="29" y="47" width="6" height="2.5" rx="1" fill="#ef4444" />
      {/* Mirrors */}
      <rect x="5" y="19" width="3.5" height="4" rx="1.5" fill="#cbd5e1" />
      <rect x="35.5" y="19" width="3.5" height="4" rx="1.5" fill="#cbd5e1" />
    </svg>
  </div>
)

// Walking Navigation Avatar (Walking Mode)
const NavWalkingSvg = ({ heading }) => (
  <div style={{
    width: 36,
    height: 36,
    position: 'relative',
    transform: `rotate(${heading}deg)`,
    transformOrigin: 'center center',
    filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.65))',
    pointerEvents: 'none',
  }}>
    <svg viewBox="0 0 40 40" width="36" height="36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="17" fill="#0284c7" stroke="#ffffff" strokeWidth="2.5" />
      <path d="M20 9 L29 27 L20 22 L11 27 Z" fill="#ffffff" />
    </svg>
  </div>
)

// Normal User Location Marker (Browsing Mode)
const UserNormalMarker = ({ heading }) => (
  <div style={{ position: 'relative', width: 26, height: 26, pointerEvents: 'none' }}>
    <div style={{
      position: 'absolute', inset: -8,
      borderRadius: '50%',
      border: '2px solid #06b6d4',
      opacity: 0.4,
      animation: 'pulse 2s ease-out infinite',
    }} />
    <div style={{
      position: 'absolute', inset: -4,
      borderRadius: '50%',
      border: '2px solid #06b6d4',
      opacity: 0.6,
      animation: 'pulse 2s ease-out infinite 0.5s',
    }} />
    <div style={{
      width: 26, height: 26,
      borderRadius: '50%',
      background: '#06b6d4',
      border: '3px solid white',
      boxShadow: '0 0 14px #06b6d4',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {heading > 0 && (
        <div style={{
          position: 'absolute',
          top: -10,
          width: 0,
          height: 0,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderBottom: '8px solid #06b6d4',
          transform: `rotate(${heading}deg)`,
          transformOrigin: '4px 23px',
        }} />
      )}
    </div>
  </div>
)

// Memoized Smooth Vehicle Navigation Marker
const VehicleNavigationMarker = memo(({ longitude, latitude, heading, isNavigating, routingProfile }) => {
  const smooth = useSmoothPosition(longitude, latitude, heading, 1200);

  if (smooth.longitude == null || smooth.latitude == null) return null;

  return (
    <Marker longitude={smooth.longitude} latitude={smooth.latitude} anchor="center">
      {isNavigating ? (
        routingProfile === 'walking' ? (
          <NavWalkingSvg heading={smooth.heading} />
        ) : (
          <NavCarSvg heading={smooth.heading} />
        )
      ) : (
        <UserNormalMarker heading={smooth.heading} />
      )}
    </Marker>
  );
});

export default function MapScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const mapRef = useRef(null)

  useEffect(() => {
    if (location.state?.flyTo) {
      const { lng, lat } = location.state.flyTo
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.flyTo({
            center: [lng, lat],
            zoom: 15,
            essential: true
          })
        }
      }, 500)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const [activeTab, setActiveTab] = useState('map')
  const [webglAvailable] = useState(() => isWebGLSupported())
  const [mapStyleUrl, setMapStyleUrl] = useState(() => getDarkMapStyle())
  const [userLocation, setUserLocation] = useState(null)
  const [viewState, setViewState] = useState({
    longitude: 3.3792,
    latitude: 6.5244,
    zoom: 13,
    pitch: 72,
    bearing: 0
  })
  const [viewMode, setViewMode] = useState('street')
  const [currentUserId, setCurrentUserId] = useState(() => {
    const cached = getCache('current_user')
    const uid = cached?.data?.id || cached?.id
    if (uid) return String(uid)
    try {
      const token = localStorage.getItem('vibemap_token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.sub || payload.user_id) return String(payload.sub || payload.user_id)
      }
    } catch (e) {}
    return null
  })
  const [selectedPin, setSelectedPin] = useState(null)
  const [vibePins, setVibePins] = useState([])
  const [isVibePinsLoading, setIsVibePinsLoading] = useState(false)
  const [vibePinsError, setVibePinsError] = useState(null)

  const handleMapError = (err) => {
    console.warn('[MapScreen] Map style or tile loading warning:', err)
    if (mapStyleUrl !== FALLBACK_DARK_MAP_STYLE) {
      console.log('[MapScreen] Falling back to CartoDB Dark Matter style')
      setMapStyleUrl(FALLBACK_DARK_MAP_STYLE)
    }
  }

  const handleMapLoad = useCallback((e) => {
    const map = e.target
    if (!map) return
    map.on('styleimagemissing', (ev) => {
      const id = ev.id
      if (id && !map.hasImage(id)) {
        try {
          map.addImage(id, {
            width: 1,
            height: 1,
            data: new Uint8Array(4)
          })
        } catch (_) {}
      }
    })
  }, [])

  // Search state
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)

  // Telemetry state
  const [telemetry, setTelemetry] = useState({ speed: '0.0', heading: 0, accuracy: 0 })

  // Navigation state
  const [isNavigating, setIsNavigating] = useState(false)
  const [showPinRequiredModal, setShowPinRequiredModal] = useState(false)
  const [hasRoute, setHasRoute] = useState(false)
  const [activeTripId, setActiveTripId] = useState(null)
  const [shareToken, setShareToken] = useState(null)
  const lastPingTime = useRef(0)
  const gpsSmoother = useRef(new GPSSmoother())
  const lastRawLocation = useRef(null)
  const isStartingJourneyRef = useRef(false)
  const lastCameraPosRef = useRef({ lat: 0, lng: 0, heading: 0, time: 0 })

  // Cache SOS PIN status on mount — UX-07: avoid per-tap network call on emergency button
  const [hasSosPin, setHasSosPin] = useState(() => {
    try {
      const local = localStorage.getItem('vibemap_has_sos_pin')
      if (local !== null) return local === 'true'
      const cached = getCache('sos_pin_status')
      if (cached?.data && typeof cached.data.has_sos_pin === 'boolean') return cached.data.has_sos_pin
    } catch (_) {}
    return null // null=loading, true/false=known
  })

  // Routing state
  const [destinationPin, setDestinationPin] = useState(null)
  const [routingProfile, setRoutingProfile] = useState('driving') // 'driving' | 'walking'
  const [routeData, setRouteData] = useState(null)
  const [routeDistance, setRouteDistance] = useState(null)
  const [routeDuration, setRouteDuration] = useState(null)
  const [routeSteps, setRouteSteps] = useState([])
  const [routeError, setRouteError] = useState(null)
  const [isRoutingLoading, setIsRoutingLoading] = useState(false)
  const [isRerouting, setIsRerouting] = useState(false)
  const [isVoiceMuted, setIsVoiceMuted] = useState(false)

  // Active turn-by-turn maneuver calculation for top card & PiP
  const activeManeuver = useMemo(() => {
    if (!isNavigating) {
      return {
        distanceText: '',
        distanceMeters: 0,
        instruction: '',
        modifier: 'straight',
        type: 'depart',
        streetName: '',
        nextStep: null,
        nextManeuverText: '',
      }
    }
    const coords = userLocation ? [userLocation.longitude, userLocation.latitude] : [viewState.longitude, viewState.latitude]
    return getActiveManeuverDetails({
      userCoords: coords,
      steps: routeSteps,
      destinationName: destinationPin?.label || 'Destination',
    })
  }, [isNavigating, userLocation, viewState.longitude, viewState.latitude, routeSteps, destinationPin])

  // Category POI state (Horizontal category scrollbar)
  const [activeCategory, setActiveCategory] = useState(null)
  const [categoryPOIs, setCategoryPOIs] = useState([])
  const [isCategoryLoading, setIsCategoryLoading] = useState(false)
  const [selectedPoi, setSelectedPoi] = useState(null)

  // Expandable Custom POI search ("More..." chip)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [customPoiQuery, setCustomPoiQuery] = useState('')
  const [activeCustomQuery, setActiveCustomQuery] = useState(null)
  const [poiFeedbackMsg, setPoiFeedbackMsg] = useState(null)
  const [arrivalToast, setArrivalToast] = useState(null)

  // 10-Second Auto-Hide Bottom Nav Bar on Inactivity / Touch Restore
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(true)
  const hideNavTimerRef = useRef(null)

  // Native Android Picture-in-Picture mode detection
  const [isInNativePip, setIsInNativePip] = useState(false)

  // Restore active journey when returning to MapScreen from other tabs/pages
  useEffect(() => {
    const saved = getActiveJourney()
    if (saved && saved.isNavigating && saved.destination) {
      console.log('[MapScreen] Restoring active journey:', saved)
      setIsNavigating(true)
      setDestinationPin(saved.destination)
      if (saved.distanceMeters) setRouteDistance(saved.distanceMeters / 1000)
      if (saved.durationSeconds) setRouteDuration(Math.round(saved.durationSeconds / 60))
      if (saved.activeTripId) setActiveTripId(saved.activeTripId)
      if (saved.shareToken) setShareToken(saved.shareToken)
      if (saved.routeData) setRouteData(saved.routeData)
      if (saved.routeSteps) setRouteSteps(saved.routeSteps)
      if (saved.routingProfile) setRoutingProfile(saved.routingProfile)
      setHasRoute(true)
      setViewMode('street')

      // Re-query route geometry if not cached
      if (!saved.routeData && saved.destination) {
        const startPoint = userLocation
          ? [userLocation.longitude, userLocation.latitude]
          : [viewState.longitude, viewState.latitude]
        getOSRMRoute(startPoint, [saved.destination.longitude, saved.destination.latitude], saved.routingProfile || 'driving')
          .then(data => {
            if (data) {
              setRouteData(data.geometry)
              setRouteDistance(data.distance)
              setRouteDuration(data.duration)
              setRouteSteps(data.steps || [])
              updateActiveJourney({
                routeData: data.geometry,
                routeSteps: data.steps || [],
                distanceMeters: data.distance * 1000,
                durationSeconds: data.duration * 60,
              })
            }
          })
          .catch(err => console.warn('[MapScreen] Failed to re-fetch route on resume:', err))
      }
    }
  }, [])

  useEffect(() => {
    const handlePipChange = (e) => {
      const isPip = Boolean(e?.detail?.isInPip)
      setIsInNativePip(isPip)
    }

    const checkSizePip = () => {
      if (typeof window !== 'undefined' && (window.innerHeight < 380 && window.innerWidth < 450)) {
        setIsInNativePip(true)
      } else {
        setIsInNativePip(false)
      }
    }

    window.addEventListener('androidPipChange', handlePipChange)
    window.addEventListener('resize', checkSizePip)
    checkSizePip()

    return () => {
      window.removeEventListener('androidPipChange', handlePipChange)
      window.removeEventListener('resize', checkSizePip)
    }
  }, [])

  // Probe for geolocation permission on mount so Android shows the permission dialog
  // immediately rather than waiting for the first locate-me button tap.
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {}, // success — location tracking handles this
        (err) => console.warn('[MapScreen] Initial permission probe:', err.message),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      )
    }
  }, [])

  const resetNavTimer = useCallback(() => {
    setIsBottomNavVisible(true)
    if (hideNavTimerRef.current) {
      clearTimeout(hideNavTimerRef.current)
    }
    hideNavTimerRef.current = setTimeout(() => {
      setIsBottomNavVisible(false)
    }, 10000) // 10 seconds auto-hide
  }, [])

  useEffect(() => {
    resetNavTimer()

    const handleInteraction = () => {
      resetNavTimer()
    }

    window.addEventListener('touchstart', handleInteraction, { passive: true })
    window.addEventListener('touchend', handleInteraction, { passive: true })
    window.addEventListener('pointerdown', handleInteraction, { passive: true })
    window.addEventListener('mousedown', handleInteraction, { passive: true })
    window.addEventListener('mousemove', handleInteraction, { passive: true })
    window.addEventListener('wheel', handleInteraction, { passive: true })
    window.addEventListener('keydown', handleInteraction, { passive: true })

    return () => {
      if (hideNavTimerRef.current) clearTimeout(hideNavTimerRef.current)
      window.removeEventListener('touchstart', handleInteraction)
      window.removeEventListener('touchend', handleInteraction)
      window.removeEventListener('pointerdown', handleInteraction)
      window.removeEventListener('mousedown', handleInteraction)
      window.removeEventListener('mousemove', handleInteraction)
      window.removeEventListener('wheel', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
    }
  }, [resetNavTimer])

  useEffect(() => {
    if (poiFeedbackMsg) {
      const t = setTimeout(() => setPoiFeedbackMsg(null), 3500)
      return () => clearTimeout(t)
    }
  }, [poiFeedbackMsg])

  useEffect(() => {
    const loadVibePins = async () => {
      setIsVibePinsLoading(true)
      setVibePinsError(null)
      try {
        const response = await getVibePins()
        const rawData = response?.data
        const data = Array.isArray(rawData)
          ? rawData
          : (rawData && Array.isArray(rawData.data) ? rawData.data : [])
        setVibePins(data)
      } catch (err) {
        console.error('Failed to load vibe pins:', err)
        setVibePinsError(err.response?.data?.detail || err.message || 'Failed to load vibe pins')
      } finally {
        setIsVibePinsLoading(false)
      }
    }

    loadVibePins()
  }, [])

  // Fetch SOS PIN status once on mount — background sync with server
  useEffect(() => {
    getSOSPinStatus()
      .then(res => {
        if (res?.data && typeof res.data.has_sos_pin === 'boolean') {
          setHasSosPin(res.data.has_sos_pin)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!currentUserId) {
      getCurrentUser()
        .then(res => {
          if (res?.data?.id) {
            setCurrentUserId(String(res.data.id))
            setCache('current_user', res.data)
          }
        })
        .catch(() => {})
    }
  }, [currentUserId])

  const fontImport = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(2.5); opacity: 0; }
    }
    @keyframes sosPulse {
      0% { transform: scale(1); opacity: 0.8; }
      100% { transform: scale(1.5); opacity: 0; }
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .top-overlay-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      width: 100%;
      pointer-events: none;
    }
    .top-logo-col {
      grid-column: 1;
      justify-self: start;
      pointer-events: auto;
    }
    .telemetry-col {
      grid-column: 2;
      justify-self: end;
      pointer-events: none;
    }
    .search-container {
      grid-column: 1 / span 2;
      width: 90%;
      justify-self: center;
      pointer-events: auto;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
    }
    .telemetry-panel {
      pointer-events: auto;
      background: rgba(0,0,0,0.7);
      border-radius: 8px;
      padding: 10px 14px;
      color: white;
      font-family: monospace;
      font-size: 11px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.4);
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 110px;
      padding-top: calc(10px + env(safe-area-inset-top));
    }
    
    @media (min-width: 768px) {
      .top-overlay-row {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0;
      }
      .top-logo-col {
        flex: 1;
      }
      .search-container {
        flex: 2;
        width: 100%;
        max-width: 400px;
      }
      .telemetry-col {
        flex: 1;
        display: flex;
        justify-content: flex-end;
      }
      .telemetry-panel {
        font-size: 12px;
        padding-top: 10px;
      }
    }

    @media (max-width: 768px) {
      .map-mobile-shell {
        padding: 8px 10px calc(10px + env(safe-area-inset-bottom)) 10px;
      }
      .map-mobile-top-stack {
        gap: 8px;
        padding-top: 4px;
      }
      .map-mobile-search {
        max-width: 100%;
      }
      .map-mobile-journey {
        padding: 12px;
        border-radius: 14px;
      }
      .map-mobile-bottom-nav {
        border-radius: 14px;
        padding: 6px 8px;
      }
      .map-mobile-bottom-nav button {
        min-width: 44px;
        min-height: 44px;
        padding: 4px;
        font-size: 10px;
      }
      .map-mobile-view-toggle {
        padding: 8px 10px;
        font-size: 11px;
      }
      .map-mobile-poi-card {
        top: 104px;
        right: 10px;
        padding: 10px;
        gap: 8px;
      }
      .map-mobile-poi-card label {
        font-size: 11px;
      }
      .map-mobile-action-row {
        margin-bottom: 10px;
      }
    }
  `

  // Location tracking — uses native background service on Android APK, web API on browser
  useEffect(() => {
    // Restore last known location instantly for fast initial render
    const savedLocation = localStorage.getItem('vibemap_last_location')
    if (savedLocation) {
      try {
        const parsed = JSON.parse(savedLocation)
        setUserLocation(parsed)
        setViewState(prev => ({
          ...prev,
          longitude: parsed.longitude,
          latitude: parsed.latitude,
          zoom: 15
        }))
      } catch (e) {
        console.error('Failed to parse saved location', e)
      }
    }

    let stopTracking = null

    const startLocation = async () => {
      stopTracking = await locationService.startTracking(
        (loc) => {
          const { latitude, longitude, accuracy, speed, heading } = loc
          console.log('Location accuracy:', accuracy, 'metres')

          if (accuracy !== null && accuracy !== undefined && accuracy > gpsSmoother.current.maxAccuracyThreshold) {
            console.warn(`GPS Ping rejected: accuracy ${accuracy}m exceeds threshold of ${gpsSmoother.current.maxAccuracyThreshold}m`)
            return
          }

          const speedKmh = speed !== null && speed !== undefined && speed > 0
            ? ((speed || 0) * 3.6).toFixed(1)
            : '0.0'

          setTelemetry({
            speed: speedKmh,
            heading: heading !== null && heading !== undefined ? Math.round(heading) : 0,
            accuracy: accuracy !== null && accuracy !== undefined ? Math.round(accuracy) : 0
          })

          const result = gpsSmoother.current.process({ latitude, longitude, accuracy })
          if (result) {
            const { smoothed, raw } = result
            lastRawLocation.current = raw
            setUserLocation(smoothed)
            localStorage.setItem('vibemap_last_location', JSON.stringify({
              longitude: smoothed.longitude,
              latitude: smoothed.latitude
            }))
          }
        },
        (err) => console.warn('Watch error:', err)
      )
    }

    startLocation()

    return () => {
      if (typeof stopTracking === 'function') stopTracking()
    }
  }, [])

  // Geocoding search effect (debounced)
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      setSearchError(null)
      return
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true)
      try {
        const proximity = userLocation
          ? { longitude: userLocation.longitude, latitude: userLocation.latitude }
          : { longitude: viewState.longitude, latitude: viewState.latitude }

        const results = await searchGeocoding(searchQuery, proximity)
        if (results.length === 0) {
          setSearchError("Location not found in Nigeria. Please try a different search.")
        } else {
          setSearchError(null)
        }
        setSearchResults(results)
      } catch (err) {
        console.error('Search error:', err)
        setSearchError("An error occurred during search. Please try again.")
      } finally {
        setIsSearching(false)
      }
    }, 450)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  // Auto-dismiss searchError toast after 3.5s
  useEffect(() => {
    if (searchError) {
      const timer = setTimeout(() => setSearchError(null), 3500)
      return () => clearTimeout(timer)
    }
  }, [searchError])

  // Routing calculation effect
  useEffect(() => {
    if (!destinationPin) {
      setRouteData(null)
      setRouteDistance(null)
      setRouteDuration(null)
      setHasRoute(false)
      return
    }

    const startPoint = userLocation
      ? [userLocation.longitude, userLocation.latitude]
      : [viewState.longitude, viewState.latitude] // uses last known center from viewState if live GPS is loading

    const fetchRoute = async () => {
      setIsRoutingLoading(true)
      try {
        const data = await getOSRMRoute(
          startPoint,
          [destinationPin.longitude, destinationPin.latitude],
          routingProfile
        )
        if (data) {
          setRouteData(data.geometry)
          setRouteDistance(data.distance)
          setRouteDuration(data.duration)
          setRouteSteps(data.steps || [])
          setRouteError(null)
          setHasRoute(true)
        }
      } catch (err) {
        console.error('OSRM route calculation failed:', err)
        setRouteError('Could not calculate route. Using straight line fallback.')
        setRouteData({
          type: 'LineString',
          coordinates: [startPoint, [destinationPin.longitude, destinationPin.latitude]]
        })
        setRouteSteps([])
        setHasRoute(true)
      } finally {
        setIsRoutingLoading(false)
      }
    }

    fetchRoute()
  }, [destinationPin, routingProfile]) // Intentionally excludes userLocation: recalculating on every GPS tick hammers OSRM unnecessarily

  const handleCategoryToggle = async (catId) => {
    if (activeCategory === catId) {
      setActiveCategory(null)
      setCategoryPOIs([])
      setSelectedPoi(null)
      return
    }

    setActiveCategory(catId)
    setSelectedPoi(null)
    setIsCategoryLoading(true)

    const cat = POI_CATEGORIES.find(c => c.id === catId)
    setActiveCategory(catId)
    setActiveCustomQuery(null)
    setSelectedPoi(null)
    setIsCategoryLoading(true)
    setPoiFeedbackMsg({ icon: cat?.icon || '🔍', text: `Searching for ${cat?.label || 'places'}...` })

    const mapCenter = mapRef.current ? mapRef.current.getCenter() : null
    const centerLng = userLocation?.longitude || mapCenter?.lng || viewState.longitude || 3.3792
    const centerLat = userLocation?.latitude || mapCenter?.lat || viewState.latitude || 6.5244
    const userState = await getUserStateName(centerLng, centerLat)

    let south, west, north, east
    if (mapRef.current) {
      try {
        const bounds = mapRef.current.getBounds()
        if (bounds) {
          south = bounds.getSouth()
          west = bounds.getWest()
          north = bounds.getNorth()
          east = bounds.getEast()
        }
      } catch (e) {
        console.warn('Could not read map bounds:', e)
      }
    }

    try {
      const data = await fetchCategoryPOIs(
        catId,
        south,
        west,
        north,
        east,
        centerLng,
        centerLat
      )
      const validPOIs = Array.isArray(data) ? data : []
      setCategoryPOIs(validPOIs)

      if (validPOIs.length > 0) {
        setPoiFeedbackMsg({ icon: cat?.icon || '📍', text: `Found ${validPOIs.length} ${cat?.label || 'places'} in ${userState}` })
        if (mapRef.current) {
          const lngs = validPOIs.map(p => p.coordinates[0]).concat(centerLng)
          const lats = validPOIs.map(p => p.coordinates[1]).concat(centerLat)
          const minLng = Math.min(...lngs)
          const maxLng = Math.max(...lngs)
          const minLat = Math.min(...lats)
          const maxLat = Math.max(...lats)

          if (maxLng - minLng > 0.002 || maxLat - minLat > 0.002) {
            mapRef.current.fitBounds(
              [[minLng, minLat], [maxLng, maxLat]],
              { padding: 80, maxZoom: 15, duration: 1200 }
            )
          } else {
            mapRef.current.flyTo({
              center: [validPOIs[0].coordinates[0], validPOIs[0].coordinates[1]],
              zoom: 14,
              duration: 1000
            })
          }
        }
      } else {
        setPoiFeedbackMsg({ icon: 'ℹ️', text: `No ${cat?.label || 'places'} found in ${userState}` })
      }
    } catch (err) {
      console.error('Failed to fetch category POIs:', err)
      setPoiFeedbackMsg({ icon: '⚠️', text: `Search failed. Please check network connection.` })
    } finally {
      setIsCategoryLoading(false)
    }
  }

  const handleCustomPoiSubmit = async (e) => {
    if (e) e.preventDefault()
    const query = customPoiQuery.trim()
    if (!query) return

    setActiveCategory(null)
    setActiveCustomQuery(query)
    setIsMoreOpen(false)
    setSelectedPoi(null)
    setIsCategoryLoading(true)
    setPoiFeedbackMsg({ icon: '🔍', text: `Searching for "${query}"...` })

    const mapCenter = mapRef.current ? mapRef.current.getCenter() : null
    const centerLng = userLocation?.longitude || mapCenter?.lng || viewState.longitude || 3.3792
    const centerLat = userLocation?.latitude || mapCenter?.lat || viewState.latitude || 6.5244
    const userState = await getUserStateName(centerLng, centerLat)

    try {
      const data = await fetchCustomPOIs(query, centerLng, centerLat)
      const validPOIs = Array.isArray(data) ? data : []
      setCategoryPOIs(validPOIs)

      if (validPOIs.length > 0) {
        setPoiFeedbackMsg({ icon: '✨', text: `Found ${validPOIs.length} results for "${query}" in ${userState}` })
        if (mapRef.current) {
          const lngs = validPOIs.map(p => p.coordinates[0]).concat(centerLng)
          const lats = validPOIs.map(p => p.coordinates[1]).concat(centerLat)
          const minLng = Math.min(...lngs)
          const maxLng = Math.max(...lngs)
          const minLat = Math.min(...lats)
          const maxLat = Math.max(...lats)

          if (maxLng - minLng > 0.002 || maxLat - minLat > 0.002) {
            mapRef.current.fitBounds(
              [[minLng, minLat], [maxLng, maxLat]],
              { padding: 80, maxZoom: 15, duration: 1200 }
            )
          } else {
            mapRef.current.flyTo({
              center: [validPOIs[0].coordinates[0], validPOIs[0].coordinates[1]],
              zoom: 14,
              duration: 1000
            })
          }
        }
      } else {
        setPoiFeedbackMsg({ icon: 'ℹ️', text: `No places matching "${query}" found in ${userState}` })
      }
    } catch (err) {
      console.error('Failed to search custom POIs:', err)
      setPoiFeedbackMsg({ icon: '⚠️', text: `Search failed. Please try again.` })
    } finally {
      setIsCategoryLoading(false)
    }
  }

  const handleClearCustomQuery = () => {
    setActiveCustomQuery(null)
    setCustomPoiQuery('')
    setCategoryPOIs([])
    setSelectedPoi(null)
    setPoiFeedbackMsg(null)
  }

  const handleMapMoveEnd = () => {
    if (!mapRef.current) return
    const bounds = mapRef.current.getBounds()
    const south = bounds.getSouth()
    const west = bounds.getWest()
    const north = bounds.getNorth()
    const east = bounds.getEast()
    const center = mapRef.current.getCenter()
    const curLng = center?.lng || viewState.longitude
    const curLat = center?.lat || viewState.latitude

    if (activeCategory) {
      fetchCategoryPOIs(activeCategory, south, west, north, east, curLng, curLat)
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setCategoryPOIs(data)
          }
        })
        .catch(err => console.error('Failed to refresh category POIs on map pan:', err))
    } else if (activeCustomQuery) {
      fetchCustomPOIs(activeCustomQuery, curLng, curLat)
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setCategoryPOIs(data)
          }
        })
        .catch(err => console.error('Failed to refresh custom POIs on map pan:', err))
    }
  }

  const getPoiIcon = (category = '') => {
    const cat = category.toLowerCase()
    if (cat.includes('food') || cat.includes('restaurant') || cat.includes('cafe') || cat.includes('bar') || cat.includes('pizza') || cat.includes('grill')) return '🍽️'
    if (cat.includes('park') || cat.includes('garden') || cat.includes('leisure') || cat.includes('fountain') || cat.includes('golf')) return '🌳'
    if (cat.includes('hospital') || cat.includes('health') || cat.includes('clinic') || cat.includes('pharmacy') || cat.includes('medical') || cat.includes('doctor')) return '🏥'
    if (cat.includes('hotel') || cat.includes('motel') || cat.includes('lodge') || cat.includes('resort') || cat.includes('guest')) return '🏨'
    if (cat.includes('fuel') || cat.includes('gas') || cat.includes('petrol') || cat.includes('station') || cat.includes('oil')) return '⛽'
    if (cat.includes('police') || cat.includes('security') || cat.includes('patrol') || cat.includes('military') || cat.includes('station')) return '🚓'
    if (cat.includes('shop') || cat.includes('supermarket') || cat.includes('mall') || cat.includes('market') || cat.includes('store') || cat.includes('plaza')) return '🛒'
    if (cat.includes('cinema') || cat.includes('theatre') || cat.includes('entertainment') || cat.includes('club') || cat.includes('lounge')) return '🍿'
    if (cat.includes('school') || cat.includes('university') || cat.includes('college') || cat.includes('education')) return '🎓'
    if (cat.includes('bus') || cat.includes('transit') || cat.includes('stop') || cat.includes('terminal')) return '🚌'
    if (cat.includes('bank') || cat.includes('atm')) return '🏦'
    if (cat.includes('church') || cat.includes('mosque') || cat.includes('worship')) return '⛪'
    return '📍'
  }

  const handleMapClick = (e) => {
    if (!mapRef.current) return
    try {
      const bbox = [
        [e.point.x - 14, e.point.y - 14],
        [e.point.x + 14, e.point.y + 14]
      ]
      const features = mapRef.current.queryRenderedFeatures(bbox)

      const poiFeature = features?.find(f => {
        const p = f.properties || {}
        return Boolean(p.name || p.name_en || p.name_int || p['name:en'] || p.title || p.label)
      })

      if (poiFeature) {
        const p = poiFeature.properties || {}
        const name = p.name || p.name_en || p.name_int || p['name:en'] || p.title || p.label || 'Selected Place'
        const category = p.class || p.subclass || p.type || p.category || 'Place'
        const lng = e.lngLat.lng
        const lat = e.lngLat.lat

        setSelectedPin(null)
        setSelectedPoi({
          id: `map_feature_${Date.now()}`,
          name: name,
          category: category,
          categoryLabel: category.charAt(0).toUpperCase() + category.slice(1),
          coordinates: [lng, lat],
          address: p.address || p.street || p.city || 'Nigeria',
          icon: getPoiIcon(`${category} ${name}`),
          color: '#06b6d4'
        })
      } else {
        setSelectedPoi(null)
        setSelectedPin(null)
      }
    } catch (err) {
      console.warn('Map feature query error:', err)
    }
  }

  const handleNavigateToPoi = (poi) => {
    if (!poi || !poi.coordinates) return
    const [lng, lat] = poi.coordinates
    setDestinationPin({
      longitude: lng,
      latitude: lat,
      label: poi.name
    })
    setSelectedPoi(null)
    setSearchQuery(poi.name)

    const centerLng = userLocation?.longitude || viewState.longitude || 3.3792
    const centerLat = userLocation?.latitude || viewState.latitude || 6.5244

    if (mapRef.current) {
      const minLng = Math.min(lng, centerLng)
      const maxLng = Math.max(lng, centerLng)
      const minLat = Math.min(lat, centerLat)
      const maxLat = Math.max(lat, centerLat)

      if (maxLng - minLng > 0.002 || maxLat - minLat > 0.002) {
        mapRef.current.fitBounds(
          [[minLng, minLat], [maxLng, maxLat]],
          { padding: 90, maxZoom: 16, duration: 1200 }
        )
      } else {
        mapRef.current.flyTo({
          center: [lng, lat],
          zoom: 16,
          duration: 1000
        })
      }
    }
  }

  const handleSelectResult = (result) => {
    if (!result) return
    const selLng = Number(result.longitude ?? (Array.isArray(result.coordinates) ? result.coordinates[0] : null) ?? result.lng)
    const selLat = Number(result.latitude ?? (Array.isArray(result.coordinates) ? result.coordinates[1] : null) ?? result.lat)

    if (isNaN(selLng) || isNaN(selLat) || selLng === 0 || selLat === 0) {
      console.warn('[MapScreen] Invalid coordinates in search result:', result)
      return
    }

    setDestinationPin({
      longitude: selLng,
      latitude: selLat,
      label: result.name || 'Selected Location'
    })
    setSearchQuery(result.name || '')
    setSearchResults([])
    setSearchFocused(false)

    if (mapRef.current) {
      try {
        if (result.bbox && Array.isArray(result.bbox) && result.bbox.length === 4) {
          mapRef.current.fitBounds(result.bbox, { padding: 80, duration: 2000 })
        } else {
          mapRef.current.flyTo({
            center: [selLng, selLat],
            zoom: 15,
            duration: 2000
          })
        }
      } catch (err) {
        console.warn('[MapScreen] Error centering map on search result:', err)
      }
    }
  }

  const handleSearchSubmit = async (e) => {
    if (e) {
      e.preventDefault?.()
      e.stopPropagation?.()
    }
    const trimmedQuery = searchQuery.trim()
    if (!trimmedQuery) return

    setIsSearching(true)
    setSearchFocused(true)
    setSearchError(null)

    try {
      const proximity = userLocation
        ? { longitude: userLocation.longitude, latitude: userLocation.latitude }
        : { longitude: viewState.longitude, latitude: viewState.latitude }

      const results = await searchGeocoding(trimmedQuery, proximity)
      if (!results || results.length === 0) {
        setSearchError(`"${trimmedQuery}" not found in Nigeria. Please try a nearby landmark or road.`)
        setSearchResults([])
      } else {
        setSearchError(null)
        setSearchResults(results)
        handleSelectResult(results[0])
      }
    } catch (err) {
      console.warn('Search error:', err)
      setSearchError('Search failed. Please check network connection.')
    } finally {
      setIsSearching(false)
    }
  }

  // Camera tracking lock effect with motion dampening to eliminate jitter/shake on mobile
  useEffect(() => {
    if (!isNavigating || !userLocation || !mapRef.current || isStartingJourneyRef.current) return

    const now = Date.now()
    const last = lastCameraPosRef.current
    const dLat = Math.abs(userLocation.latitude - last.lat)
    const dLng = Math.abs(userLocation.longitude - last.lng)
    const currentHeading = Number(telemetry.heading) || 0
    const dHeading = Math.abs(currentHeading - last.heading)
    const speedNum = parseFloat(telemetry.speed) || 0

    // Only update camera if moved > ~1.5m or heading changed by > 4 deg while moving, or after 1.5s
    const hasMoved = (dLat > 0.000015 || dLng > 0.000015)
    const hasTurned = (speedNum > 1.5 && dHeading > 4)
    const isOverdue = (now - last.time > 1500)

    if (hasMoved || hasTurned || isOverdue) {
      lastCameraPosRef.current = {
        lat: userLocation.latitude,
        lng: userLocation.longitude,
        heading: currentHeading,
        time: now
      }

      mapRef.current.easeTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 19,
        pitch: 74,
        bearing: currentHeading,
        duration: 900,
        easing: (t) => t,
        essential: true
      })
    }
  }, [userLocation?.latitude, userLocation?.longitude, isNavigating, telemetry.heading, telemetry.speed])

  // Live location telemetry ping effect
  useEffect(() => {
    if (!isNavigating || !activeTripId || !userLocation) return

    const now = Date.now()
    if (now - lastPingTime.current >= 7000) {
      lastPingTime.current = now

      const acc = userLocation.accuracy ? Math.round(userLocation.accuracy) : 10
      const speedMs = telemetry.speed ? parseFloat(telemetry.speed) / 3.6 : 0.0

      const rawLat = lastRawLocation.current ? lastRawLocation.current.latitude : userLocation.latitude;
      const rawLng = lastRawLocation.current ? lastRawLocation.current.longitude : userLocation.longitude;

      createLocationPing({
        trip_id: activeTripId,
        raw_lat: rawLat,
        raw_lng: rawLng,
        smoothed_lat: userLocation.latitude,
        smoothed_lng: userLocation.longitude,
        accuracy_meters: acc,
        signal_source: 'gps',
        speed_ms: speedMs,
        heading: telemetry.heading || 0.0
      })
        .then(() => {
          console.log('Location ping successfully synced to database.')
        })
        .catch(err => {
          console.error('Failed to sync location ping to backend:', err)
        })
    }
  }, [userLocation, isNavigating, activeTripId, telemetry])

  const handleStartJourney = async () => {
    // Notify native Android layer that navigation is active.
    // This enables PiP entry when the user presses the home button.
    try {
      if (window.NativeVibeMap && typeof window.NativeVibeMap.setNavigationActive === 'function') {
        window.NativeVibeMap.setNavigationActive(true)
      }
    } catch (_) {}
    setIsNavigating(true)
    setViewMode('street')
    isStartingJourneyRef.current = true
    const targetCenter = userLocation
      ? [userLocation.longitude, userLocation.latitude]
      : [viewState.longitude, viewState.latitude]

    if (mapRef.current) {
      mapRef.current.flyTo({
        center: targetCenter,
        zoom: 19,
        pitch: 74,
        bearing: telemetry.heading || 0,
        duration: 1200,
        essential: true
      })
    }

    setTimeout(() => {
      isStartingJourneyRef.current = false
    }, 1300)

    resetVoiceNavigation()

    updateActiveJourney({
      isNavigating: true,
      destination: destinationPin,
      distanceMeters: routeDistance ? routeDistance * 1000 : null,
      durationSeconds: routeDuration ? routeDuration * 60 : null,
      speedKmh: telemetry.speed || 0,
      heading: telemetry.heading || 0,
      userCoords: targetCenter,
      routeData,
      routeSteps,
      routingProfile,
    })

    try {
      const response = await startTrip({
        origin_lat: targetCenter[1],
        origin_lng: targetCenter[0],
        destination_lat: destinationPin.latitude,
        destination_lng: destinationPin.longitude,
        destination_name: destinationPin.label || 'Unnamed Destination'
      })
      if (response.data && response.data.trip_id) {
        setActiveTripId(response.data.trip_id)
        setShareToken(response.data.share_token)
        updateActiveJourney({
          activeTripId: response.data.trip_id,
          shareToken: response.data.share_token,
          destination: destinationPin,
          routeData,
          routeSteps,
          routingProfile,
        })
        console.log('Trip successfully registered in DB. ID:', response.data.trip_id)
      }
    } catch (error) {
      console.error('Failed to sync start trip to backend:', error)
    }
  }

  // Continuously sync journey telemetry with global journeyState
  useEffect(() => {
    if (isNavigating) {
      updateActiveJourney({
        speedKmh: telemetry.speed || 0,
        heading: telemetry.heading || 0,
        accuracy: telemetry.accuracy || 10,
        distanceMeters: routeDistance ? routeDistance * 1000 : null,
        durationSeconds: routeDuration ? routeDuration * 60 : null,
        destination: destinationPin,
      })
    }
  }, [isNavigating, telemetry, routeDistance, routeDuration, destinationPin])

  // Turn-by-Turn Voice Navigation Engine
  useEffect(() => {
    if (!isNavigating || !userLocation || !routeSteps || routeSteps.length === 0) return
    processVoiceGuidance({
      userCoords: [userLocation.longitude, userLocation.latitude],
      steps: routeSteps,
      destinationName: destinationPin?.label || 'your destination',
      isNavigating,
    })
  }, [userLocation, isNavigating, routeSteps, destinationPin])

  // Automatic Arrival Detection: ends journey automatically when arriving within 28 meters
  useEffect(() => {
    if (!isNavigating || !userLocation || !destinationPin) return

    const distToDest = GPSSmoother.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      destinationPin.latitude,
      destinationPin.longitude
    )

    if (distToDest <= 28) {
      const destName = destinationPin.label || 'your destination'
      console.log(`[MapScreen] Arrived at ${destName} (${distToDest.toFixed(1)}m away). Completing journey.`)
      speakInstruction(`You have arrived at ${destName}. Journey complete.`)
      setArrivalToast(`🎉 You have arrived at ${destName}!`)
      handleEndJourney()
    }
  }, [userLocation, isNavigating, destinationPin])

  // Auto-dismiss arrival toast after 6s
  useEffect(() => {
    if (arrivalToast) {
      const t = setTimeout(() => setArrivalToast(null), 6000)
      return () => clearTimeout(t)
    }
  }, [arrivalToast])

  const handleReroute = async () => {
    if (!destinationPin) return
    setIsRerouting(true)
    announceReroute()

    const startPoint = userLocation
      ? [userLocation.longitude, userLocation.latitude]
      : [viewState.longitude, viewState.latitude]

    try {
      const data = await getOSRMRoute(startPoint, [destinationPin.longitude, destinationPin.latitude], routingProfile)
      if (data) {
        setRouteData(data.geometry)
        setRouteDistance(data.distance)
        setRouteDuration(data.duration)
        setRouteSteps(data.steps || [])
        setHasRoute(true)

        updateActiveJourney({
          distanceMeters: data.distance ? data.distance * 1000 : null,
          durationSeconds: data.duration ? data.duration * 60 : null,
        })

        if (mapRef.current) {
          mapRef.current.easeTo({
            center: startPoint,
            zoom: 18.5,
            pitch: 74,
            bearing: telemetry.heading || viewState.bearing || 0,
            duration: 1000,
            essential: true,
          })
        }
      }
    } catch (err) {
      console.error('Rerouting calculation failed:', err)
    } finally {
      setIsRerouting(false)
    }
  }

  const handleShareTrip = async (e) => {
    if (e) e.stopPropagation()
    if (!shareToken) return
    const shareUrl = `${window.location.origin}/trips/public/${shareToken}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Track my live journey on VibeMap',
          text: `I'm on my way to ${destinationPin?.label || 'my destination'}. Track my live location on VibeMap:`,
          url: shareUrl,
        })
        return
      } catch (_) {}
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl)
      alert('Live journey tracking link copied to clipboard!')
    }
  }

  const handleEndJourney = async () => {
    // Notify native Android layer that navigation has ended.
    // This disables automatic PiP entry on home button press.
    try {
      if (window.NativeVibeMap && typeof window.NativeVibeMap.setNavigationActive === 'function') {
        window.NativeVibeMap.setNavigationActive(false)
      }
    } catch (_) {}
    setIsNavigating(false)
    resetVoiceNavigation()
    stopActiveJourney()
    try {
      if (typeof closeNavigationPiP === 'function') {
        closeNavigationPiP()
      }
    } catch (_) {}

    if (activeTripId) {
      try {
        await endTrip(activeTripId)
        console.log('Trip successfully completed in DB. ID:', activeTripId)
      } catch (error) {
        console.error('Failed to sync end trip to backend:', error)
      }
    }

    setActiveTripId(null)
    setShareToken(null)
    setDestinationPin(null)
    setRouteData(null)
    setRouteDistance(null)
    setRouteDuration(null)
    setRouteSteps([])
    setHasRoute(false)
    setSearchQuery('')

    if (mapRef.current) {
      mapRef.current.flyTo({
        pitch: 0,
        bearing: 0,
        zoom: 14,
        duration: 1200
      })
    }
  }

  const handleTabChange = (tab) => {
    if (tab === 'map') setActiveTab('map')
    if (tab === 'family') navigate('/family')
    if (tab === 'vibes') setActiveTab('vibes')
    if (tab === 'profile') navigate('/profile')
  }

  const handleSOS = async () => {
    // 1. Instant check: If we already know the user has a PIN from localStorage/state, navigate immediately
    const localPin = localStorage.getItem('vibemap_has_sos_pin')
    if (hasSosPin === true || localPin === 'true') {
      navigate('/sos')
      return
    }

    try {
      const res = await getSOSPinStatus()
      const hasPin = res?.data?.has_sos_pin ?? false
      setHasSosPin(hasPin)
      if (!hasPin) {
        setShowPinRequiredModal(true)
        return
      }
      navigate('/sos')
    } catch (err) {
      // If network fails (e.g. backend asleep/offline):
      // Only show modal if explicitly known that PIN is NOT set
      if (localPin === 'false' || hasSosPin === false) {
        setShowPinRequiredModal(true)
        return
      }
      // Otherwise fail-open to /sos so emergency assistance is never blocked
      navigate('/sos')
    }
  }

  const handleDeletePin = async (pin_id) => {
    try {
      await deleteVibePin(pin_id)
      setVibePins(prev => prev.filter(pin => pin.id !== pin_id))
      setSelectedPin(null)
    } catch (err) {
      console.error('Failed to delete vibe pin:', err)
    }
  }

  const handleNavigate = (pin) => {
    setSelectedPin(null)
    setDestinationPin({
      longitude: pin.lng,
      latitude: pin.lat,
      label: pin.category ? pin.category.toUpperCase() : 'Vibe Pin'
    })
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [pin.lng, pin.lat],
        zoom: 15,
        duration: 1500
      })
    }
  }

  return (
    <>
      <style>{fontImport}</style>
      <div className="map-mobile-shell" style={{
        width: '100vw',
        height: '100dvh',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif',
        background: '#080810',
      }}>

        {/* REAL MAP */}
        {(activeTab === 'map' || activeTab === 'vibes') && (
          !webglAvailable ? (
            <WebGLFallback onRetry={() => window.location.reload()} />
          ) : (
          <Map
            ref={mapRef}
            mapLib={maplibregl}
            {...viewState}
            onMove={e => setViewState(e.viewState)}
            onMoveEnd={handleMapMoveEnd}
            onClick={handleMapClick}
            onError={handleMapError}
            onLoad={handleMapLoad}
            style={{ position: 'absolute', inset: 0, zIndex: 0, width: '100%', height: '100%' }}
            mapStyle={mapStyleUrl}
          >
            {/* ROUTE LINE WITH CASING FOR 3D DEPTH */}
            {routeData && (
              <Source id="route-source" type="geojson" data={{
                type: 'Feature',
                properties: {},
                geometry: routeData
              }}>
                {/* Route Casing (Dark outline for high road contrast) */}
                <Layer
                  id="route-casing"
                  type="line"
                  paint={{
                    'line-color': '#1e293b',
                    'line-width': routingProfile === 'walking' ? 7 : 9,
                    'line-opacity': 0.7,
                  }}
                  layout={{
                    'line-join': 'round',
                    'line-cap': 'round'
                  }}
                />
                {/* Route Core (Google Maps Vibrant Navigation Blue) */}
                <Layer
                  id="route-layer"
                  type="line"
                  paint={{
                    'line-color': routingProfile === 'walking' ? '#38bdf8' : '#3871E0',
                    'line-width': routingProfile === 'walking' ? 4.5 : 6.5,
                    'line-opacity': 0.95,
                    'line-dasharray': routingProfile === 'walking' ? [2, 2] : [1]
                  }}
                  layout={{
                    'line-join': 'round',
                    'line-cap': 'round'
                  }}
                />
              </Source>
            )}

            {/* REAL USER / VEHICLE LOCATION WITH SMOOTH INTERPOLATION */}
            {userLocation && (
              <VehicleNavigationMarker
                longitude={userLocation.longitude}
                latitude={userLocation.latitude}
                heading={Number(telemetry.heading) || 0}
                isNavigating={isNavigating}
                routingProfile={routingProfile}
              />
            )}

            {/* DESTINATION PIN */}
            {destinationPin && (
              <Marker
                longitude={destinationPin.longitude}
                latitude={destinationPin.latitude}
                anchor="bottom"
              >
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  animation: 'fadeIn 0.3s ease-out'
                }}>
                  <div style={{
                    background: '#12121a',
                    border: '2px solid #00FF00',
                    borderRadius: 8,
                    padding: '4px 8px',
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 600,
                    marginBottom: 4,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                  }}>
                    🎯 Destination
                  </div>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'rgba(0, 255, 0, 0.2)',
                    border: '3px solid #00FF00',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 16px rgba(0, 255, 0, 0.8)',
                  }}>
                    📍
                  </div>
                </div>
              </Marker>
            )}

            {/* VIBE PIN MARKERS */}
            {Array.isArray(vibePins) && vibePins.map(pin => {
              const meta = getPinMeta(pin)
              return (
                <Marker
                  key={pin.id}
                  longitude={pin.lng}
                  latitude={pin.lat}
                  anchor="center"
                >
                  <div
                    onClick={() => setSelectedPin({
                      ...pin,
                      icon: meta.icon,
                      color: meta.color,
                      label: pin.note || meta.title
                    })}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: `${meta.color}22`,
                      border: `2px solid ${meta.color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      boxShadow: `0 0 14px ${meta.color}88`,
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {meta.icon}
                  </div>
                </Marker>
              )
            })}

            {/* CATEGORY POI MARKERS */}
            {categoryPOIs.map((poi) => {
              const isSelected = selectedPoi && selectedPoi.id === poi.id
              return (
                <Marker
                  key={poi.id}
                  longitude={poi.coordinates[0]}
                  latitude={poi.coordinates[1]}
                  anchor="center"
                  style={{ zIndex: isSelected ? 40 : 25 }}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedPoi(poi)
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'pointer',
                      zIndex: isSelected ? 40 : 25,
                      transform: isSelected ? 'scale(1.2)' : 'scale(1)',
                      transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                  >
                    {/* Badge Pin Icon */}
                    <div
                      style={{
                        width: isSelected ? 42 : 32,
                        height: isSelected ? 42 : 32,
                        borderRadius: '50%',
                        background: isSelected ? poi.color : 'rgba(12,12,20,0.95)',
                        border: `2.5px solid ${poi.color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isSelected ? 20 : 15,
                        boxShadow: `0 0 16px ${poi.color}`,
                      }}
                      title={poi.name}
                    >
                      {poi.icon}
                    </div>

                    {/* Name Pill on Map */}
                    <div style={{
                      background: 'rgba(12,12,20,0.9)',
                      border: `1px solid ${poi.color}88`,
                      borderRadius: '8px',
                      padding: '2px 6px',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      marginTop: '3px',
                      maxWidth: '130px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.7)',
                      pointerEvents: 'none',
                      fontFamily: 'Inter, sans-serif',
                    }}>
                      {poi.name}
                    </div>
                  </div>
                </Marker>
              )
            })}
            {/* PIN POPUP */}
            {selectedPin && (
              <Popup
                longitude={selectedPin.lng}
                latitude={selectedPin.lat}
                anchor="bottom"
                onClose={() => setSelectedPin(null)}
                closeOnClick={false}
                closeButton={false}
                style={{ zIndex: 100 }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    background: 'rgba(12,12,20,0.98)',
                    border: `1px solid ${selectedPin.color || 'rgba(139,92,246,0.5)'}`,
                    borderRadius: 16,
                    padding: '16px',
                    minWidth: 240,
                    maxWidth: 290,
                    fontFamily: 'Inter, sans-serif',
                    position: 'relative',
                    boxShadow: '0 12px 36px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)',
                    pointerEvents: 'auto',
                  }}
                >
                  {/* Custom Close Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedPin(null)
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      setSelectedPin(null)
                    }}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '50%',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                      zIndex: 110,
                      pointerEvents: 'auto',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = '#ffffff'
                      e.currentTarget.style.background = 'rgba(239,68,68,0.8)'
                      e.currentTarget.style.borderColor = '#ef4444'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = '#94a3b8'
                      e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                    }}
                    title="Close"
                    aria-label="Close"
                  >
                    <X size={14} />
                  </button>

                  {/* Vibe Category Tag */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: `${selectedPin.color || '#8b5cf6'}22`,
                    border: `1px solid ${selectedPin.color || '#8b5cf6'}66`,
                    borderRadius: 50,
                    padding: '3px 12px',
                    fontSize: 11,
                    color: selectedPin.color || '#8b5cf6',
                    fontWeight: 700,
                    marginBottom: 10,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>
                    <span>{selectedPin.icon || '📍'}</span>
                    <span>{selectedPin.category || 'Vibe'}</span>
                  </div>

                  {/* Note / Details */}
                  {selectedPin.note ? (
                    <div style={{
                      color: 'white',
                      fontSize: 14,
                      fontWeight: 600,
                      marginBottom: 10,
                      fontFamily: 'Inter, sans-serif',
                      lineHeight: 1.4,
                      paddingRight: 20,
                    }}>
                      {selectedPin.note}
                    </div>
                  ) : (
                    <div style={{
                      color: '#94a3b8',
                      fontSize: 13,
                      fontStyle: 'italic',
                      marginBottom: 10,
                      paddingRight: 20,
                    }}>
                      No additional notes provided.
                    </div>
                  )}

                  {/* Confirmation & Delete Row */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation()
                        const pinId = selectedPin.id
                        try {
                          const res = await confirmVibePin(pinId)
                          const newCount = res?.data?.confirmation_count
                          const isConfirmed = res?.data?.confirmed !== false
                          setVibePins(prev => {
                            const updated = (Array.isArray(prev) ? prev : []).map(p => p.id === pinId ? { ...p, confirmation_count: newCount ?? (p.confirmation_count || 1) + 1, user_confirmed: isConfirmed } : p)
                            setCache('vibe_pins', updated)
                            return updated
                          })
                          setSelectedPin(prev => prev && prev.id === pinId ? { ...prev, confirmation_count: newCount ?? (prev.confirmation_count || 1) + 1, user_confirmed: isConfirmed } : null)
                        } catch (err) {
                          console.error('Failed to confirm vibe pin:', err)
                        }
                      }}
                      style={{
                        flex: 1.2,
                        padding: '9px 12px',
                        background: selectedPin.user_confirmed ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.12)',
                        border: '1px solid #10b981',
                        borderRadius: 10,
                        color: '#34d399',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        transition: 'all 0.15s ease',
                      }}
                      title={selectedPin.user_confirmed ? 'You confirmed this vibe' : 'Confirm this vibe report'}
                    >
                      {selectedPin.user_confirmed ? <Check size={14} /> : <Flame size={14} />}
                      <span>{selectedPin.user_confirmed ? 'Confirmed' : 'Confirm'} ({selectedPin.confirmation_count || 1})</span>
                    </button>

                    {Boolean(currentUserId && (String(selectedPin.user_id || selectedPin.creator_id || '') === String(currentUserId))) && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation()
                          const pinId = selectedPin.id
                          setVibePins(prev => {
                            const next = (Array.isArray(prev) ? prev : []).filter(p => p.id !== pinId)
                            setCache('vibe_pins', next)
                            return next
                          })
                          setSelectedPin(null)
                          try {
                            await deleteVibePin(pinId)
                          } catch (err) {
                            console.error('Failed to delete pin:', err)
                          }
                        }}
                        style={{
                          flex: 0.8,
                          padding: '9px 10px',
                          background: 'rgba(239,68,68,0.15)',
                          border: '1px solid #ef4444',
                          borderRadius: 10,
                          color: '#f87171',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          transition: 'all 0.15s ease',
                        }}
                        title="Delete your vibe report"
                      >
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>

                  {/* Navigation Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleNavigate(selectedPin)
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#7c3aed',
                      border: 'none',
                      borderRadius: 10,
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      transition: 'transform 0.15s ease, background 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'scale(1.02)'
                      e.currentTarget.style.background = '#6d28d9'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'scale(1)'
                      e.currentTarget.style.background = '#7c3aed'
                    }}
                  >
                    <Navigation2 size={14} />
                    <span>Get Directions</span>
                  </button>
                </div>
              </Popup>
            )}

            {/* POI POPUP */}
            {selectedPoi && (
              <Popup
                longitude={selectedPoi.coordinates[0]}
                latitude={selectedPoi.coordinates[1]}
                anchor="bottom"
                onClose={() => setSelectedPoi(null)}
                closeOnClick={false}
                closeButton={false}
                style={{ zIndex: 100 }}
              >
                <div style={{
                  background: 'rgba(12,12,20,0.98)',
                  border: `1px solid ${selectedPoi.color || 'rgba(139, 92, 246, 0.4)'}`,
                  borderRadius: 16,
                  padding: '14px',
                  minWidth: 220,
                  maxWidth: 280,
                  fontFamily: 'Inter, sans-serif',
                  position: 'relative',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)',
                  pointerEvents: 'auto',
                }}>
                  {/* Custom Close Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedPoi(null)
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      setSelectedPoi(null)
                    }}
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '50%',
                      color: '#94a3b8',
                      fontSize: 14,
                      cursor: 'pointer',
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                      zIndex: 110,
                      pointerEvents: 'auto',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = '#ffffff'
                      e.currentTarget.style.background = 'rgba(239,68,68,0.8)'
                      e.currentTarget.style.borderColor = '#ef4444'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = '#94a3b8'
                      e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                    }}
                    title="Close"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: `${selectedPoi.color || '#8b5cf6'}22`,
                    border: `1px solid ${selectedPoi.color || '#8b5cf6'}55`,
                    borderRadius: 50,
                    padding: '2px 10px',
                    fontSize: 10,
                    color: selectedPoi.color || '#8b5cf6',
                    fontWeight: 700,
                    marginBottom: 8,
                  }}>
                    <span>{selectedPoi.icon}</span>
                    <span>{(selectedPoi.categoryLabel || selectedPoi.category || 'POI').toUpperCase()}</span>
                  </div>
                  <div style={{
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 700,
                    marginBottom: 6,
                    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
                    lineHeight: '1.3',
                    paddingRight: 24,
                  }}>
                    {selectedPoi.name}
                  </div>
                  {selectedPoi.address && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, lineHeight: 1.3 }}>
                      📍 {selectedPoi.address}
                      {selectedPoi.distanceKm != null ? (
                        <span style={{ color: '#38bdf8', fontWeight: 600, marginLeft: 6 }}>
                          ({selectedPoi.distanceKm} km away)
                        </span>
                      ) : null}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleNavigateToPoi(selectedPoi)
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                      border: 'none',
                      borderRadius: 10,
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      boxShadow: '0 4px 14px rgba(6,182,212,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      transition: 'transform 0.15s ease',
                      pointerEvents: 'auto',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <span>🧭</span>
                    <span>Navigate / Get Directions</span>
                  </button>
                </div>
              </Popup>
            )}
          </Map>
          )
        )}

        {activeTab === 'family' && (
          <FamilyMap isEmbedded={true} />
        )}

        {/* DIM OVERLAY when pin selected */}
        {selectedPin && (
          <div
            onClick={() => setSelectedPin(null)}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 9,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* MASTER UI OVERLAY LAYER */}
        {!isInNativePip && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          pointerEvents: 'none',
          padding: 'calc(12px + env(safe-area-inset-top)) 16px calc(12px + env(safe-area-inset-bottom)) 16px',
          maxWidth: '100vw',
          boxSizing: 'border-box',
          overflow: 'hidden',
          zIndex: 10
        }}>
          {/* TOP SECTION (Strict Flex-Column) */}
          <div className="map-mobile-top-stack" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            paddingTop: '16px',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            pointerEvents: 'none'
          }}>
            {/* Arrival Celebration Toast */}
            {arrivalToast && (
              <div style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                padding: '12px 18px',
                borderRadius: 14,
                boxShadow: '0 8px 24px rgba(16,185,129,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'Inter, sans-serif',
                pointerEvents: 'auto',
                animation: 'fadeIn 0.3s ease-out',
                border: '1px solid rgba(255,255,255,0.3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={18} color="#ffffff" />
                  <span>{arrivalToast}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setArrivalToast(null)}
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    color: 'white',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* GOOGLE MAPS STYLE TOP TURN-BY-TURN MANEUVER CARD */}
            {isNavigating && (
              <div style={{
                width: '100%',
                maxWidth: '480px',
                margin: '0 auto',
                background: 'linear-gradient(180deg, #00594C 0%, #004d40 100%)',
                borderRadius: '18px',
                padding: '14px 18px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.65), 0 2px 8px rgba(0, 89, 76, 0.4)',
                color: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxSizing: 'border-box',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                animation: 'fadeIn 0.25s ease-out',
                pointerEvents: 'auto',
              }}>
                {/* Main Maneuver Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                    {/* Large Turn Arrow Icon */}
                    <div style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      flexShrink: 0,
                    }}>
                      {getManeuverIcon(activeManeuver.modifier, activeManeuver.type, 28)}
                    </div>

                    {/* Distance & Street Name */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 800,
                        lineHeight: 1.1,
                        letterSpacing: '-0.5px',
                        fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
                        color: '#ffffff',
                      }}>
                        {activeManeuver.distanceText || (routeDistance ? `${routeDistance.toFixed(1)} km` : 'Proceed')}
                      </div>
                      <div style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: '#e0f2fe',
                        marginTop: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.25,
                      }}>
                        {activeManeuver.streetName || activeManeuver.instruction || destinationPin?.label || 'Continue along route'}
                      </div>
                    </div>
                  </div>

                  {/* Voice speaker button */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isVoiceMuted
                      setIsVoiceMuted(next)
                      setVoiceMuted(next)
                    }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: isVoiceMuted ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.16)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    title={isVoiceMuted ? 'Unmute Voice Guidance' : 'Mute Voice Guidance'}
                  >
                    {isVoiceMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                </div>

                {/* Secondary Maneuver Sub-pill ("Then ↱ 200m") if available */}
                {activeManeuver.nextStep && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(0, 0, 0, 0.28)',
                    borderRadius: '20px',
                    padding: '3px 10px',
                    width: 'fit-content',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#c7d2fe',
                  }}>
                    <span style={{ color: '#94a3b8' }}>Then</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      {getManeuverIcon(activeManeuver.nextStep?.maneuver?.modifier, activeManeuver.nextStep?.maneuver?.type, 14)}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                      {activeManeuver.nextStep?.name || activeManeuver.nextManeuverText || 'next turn'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Logo row (Tap to refresh map) */}
            {!isNavigating && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100%', maxWidth: '448px', margin: '0 auto', pointerEvents: 'auto', padding: '0 8px', boxSizing: 'border-box' }}>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.15s ease, opacity 0.15s ease',
                  }}
                  onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95)' }}
                  onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
                  onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.95)' }}
                  onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)' }}
                  title="Tap logo to refresh map"
                  aria-label="Refresh Map"
                >
                  <Logo size="sm" />
                </button>
              </div>
            )}

            {/* Search container: centered & max-width 448px */}
            <div className="search-container map-mobile-search" style={{
              width: '100%',
              maxWidth: '448px',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              pointerEvents: 'auto',
              boxSizing: 'border-box'
            }}>
              {/* Search Bar */}
              {!isNavigating && (
                <form onSubmit={handleSearchSubmit} style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.98)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  gap: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                  transition: 'all 0.3s',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  <Search size={18} color="#64748b" style={{ flexShrink: 0 }} />
                  <input
                    placeholder="Search estate, road, landmark..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => {
                      setTimeout(() => setSearchFocused(false), 220)
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#0f172a',
                      fontSize: 14,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      background: '#7c3aed',
                      border: 'none',
                      color: 'white',
                      borderRadius: 8,
                      padding: '7px 14px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#6d28d9'}
                    onMouseLeave={e => e.currentTarget.style.background = '#7c3aed'}
                  >
                    Search
                  </button>
                </form>
              )}

              {/* Category Chips Bar (Google Maps Style Horizontal Scroll) */}
              {!isNavigating && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  overflowX: 'auto',
                  padding: '6px 2px 2px',
                  marginTop: '4px',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box'
                }}>
                  {POI_CATEGORIES.map(cat => {
                    const isActive = activeCategory === cat.id && !activeCustomQuery
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setActiveCustomQuery(null)
                          setIsMoreOpen(false)
                          handleCategoryToggle(cat.id)
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          background: isActive
                            ? '#7c3aed'
                            : 'rgba(18,18,26,0.92)',
                          border: isActive
                            ? '1px solid #a78bfa'
                            : '1px solid rgba(255,255,255,0.12)',
                          color: isActive ? '#ffffff' : '#cbd5e1',
                          fontSize: '12px',
                          fontWeight: isActive ? 700 : 500,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          backdropFilter: 'blur(12px)',
                          boxShadow: isActive
                            ? '0 0 14px rgba(124,58,237,0.4)'
                            : '0 2px 8px rgba(0,0,0,0.3)',
                          transition: 'all 0.2s ease',
                          userSelect: 'none',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        <span style={{ fontSize: '14px' }}>{cat.icon}</span>
                        <span>{cat.label}</span>
                        {isActive && isCategoryLoading && (
                          <div style={{
                            width: 10,
                            height: 10,
                            border: '2px solid white',
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }} />
                        )}
                      </button>
                    )
                  })}

                  {/* "MORE" EXPANDABLE CUSTOM SEARCH CHIP */}
                  {isMoreOpen ? (
                    <form
                      onSubmit={handleCustomPoiSubmit}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '3px 8px 3px 12px',
                        borderRadius: '20px',
                        background: 'rgba(18,18,26,0.98)',
                        border: '1px solid #7c3aed',
                        boxShadow: '0 0 14px rgba(124,58,237,0.4)',
                        flexShrink: 0,
                      }}
                    >
                      <Search size={13} color="#a78bfa" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Type e.g. gym, school, fun..."
                        value={customPoiQuery}
                        onChange={e => setCustomPoiQuery(e.target.value)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontFamily: 'Inter, sans-serif',
                          width: '150px',
                        }}
                      />
                      <button
                        type="submit"
                        style={{
                          background: '#7c3aed',
                          border: 'none',
                          color: 'white',
                          borderRadius: '12px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Find
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreOpen(false)
                          setCustomPoiQuery('')
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <X size={13} />
                      </button>
                    </form>
                  ) : activeCustomQuery ? (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        background: '#7c3aed',
                        border: '1px solid #a78bfa',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        boxShadow: '0 0 14px rgba(124,58,237,0.4)',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      <Sparkles size={13} color="#ffffff" />
                      <span>{activeCustomQuery}</span>
                      {isCategoryLoading ? (
                        <div style={{
                          width: 10,
                          height: 10,
                          border: '2px solid white',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                      ) : (
                        <button
                          type="button"
                          onClick={handleClearCustomQuery}
                          style={{
                            background: 'rgba(0,0,0,0.25)',
                            border: 'none',
                            borderRadius: '50%',
                            color: '#ffffff',
                            cursor: 'pointer',
                            width: '16px',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginLeft: '2px',
                            padding: 0,
                          }}
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsMoreOpen(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        background: 'rgba(18,18,26,0.92)',
                        border: '1px solid rgba(139,92,246,0.4)',
                        color: '#a78bfa',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        transition: 'all 0.2s ease',
                        userSelect: 'none',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      <Plus size={13} />
                      <span>More...</span>
                    </button>
                  )}
                </div>
              )}

              {/* Live POI Search / Results Feedback Pill */}
              {poiFeedbackMsg && (
                <div style={{
                  display: 'inline-flex',
                  alignSelf: 'center',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '8px',
                  background: 'rgba(12,12,20,0.95)',
                  border: '1px solid #7c3aed',
                  boxShadow: '0 0 16px rgba(124,58,237,0.3)',
                  borderRadius: '20px',
                  padding: '5px 14px',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  pointerEvents: 'none',
                  animation: 'fadeIn 0.2s ease-out',
                }}>
                  <MapPin size={13} color="#a78bfa" />
                  <span>{poiFeedbackMsg.text}</span>
                </div>
              )}

              {/* Search suggestions */}
              {!isNavigating && searchFocused && (searchResults.length > 0 || isSearching) && (
                <div style={{
                  marginTop: 6,
                  background: 'rgba(18,18,26,0.98)',
                  border: '1px solid rgba(139,92,246,0.4)',
                  borderRadius: 14,
                  maxHeight: 220,
                  overflowY: 'auto',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(16px)',
                }}>
                  {isSearching ? (
                    <div style={{ padding: '14px 16px', color: '#94a3b8', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 14, height: 14, border: '2px solid #8b5cf6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      Searching Nigeria...
                    </div>
                  ) : (
                    (Array.isArray(searchResults) ? searchResults : []).map(result => (
                      <div
                        key={result.id}
                        onMouseDown={() => handleSelectResult(result)}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          cursor: 'pointer',
                          fontSize: 13,
                          color: '#e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(139,92,246,0.15)'
                          e.currentTarget.style.color = 'white'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = '#e2e8f0'
                        }}
                      >
                        <MapPin size={14} color="#8b5cf6" style={{ flexShrink: 0 }} />
                        <span>{result.name}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Error toast alert */}
              {!isNavigating && searchError && (
                <div style={{
                  marginTop: 8,
                  background: 'rgba(239, 68, 68, 0.95)',
                  border: '1px solid #ef4444',
                  borderRadius: 12,
                  padding: '10px 16px',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
                  animation: 'fadeIn 0.2s ease-out'
                }}>
                  <AlertTriangle size={16} />
                  <span style={{ flex: 1 }}>{searchError}</span>
                  <button
                    onClick={() => setSearchError(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: 0.8,
                      padding: 0
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              {/* Journey Info Card (Route Preview before starting navigation) */}
              {!isNavigating && destinationPin && (
                <div className="map-mobile-journey" style={{
                  marginTop: 12,
                  background: 'rgba(18,18,26,0.95)',
                  border: '1px solid rgba(139,92,246,0.4)',
                  borderRadius: 16,
                  padding: '14px 16px',
                  color: '#e2e8f0',
                  backdropFilter: 'blur(16px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  animation: 'fadeIn 0.3s ease-out'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, marginRight: 8 }}>
                      <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Your Destination
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginTop: 2, fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }} title={destinationPin.label}>
                        {destinationPin.label}
                      </div>
                      {isNavigating && shareToken && (
                        <button
                          type="button"
                          onClick={handleShareTrip}
                          style={{
                            marginTop: 6,
                            padding: '4px 10px',
                            background: 'rgba(6, 182, 212, 0.15)',
                            border: '1px solid rgba(6, 182, 212, 0.4)',
                            borderRadius: 8,
                            color: '#38bdf8',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            width: 'fit-content',
                            transition: 'all 0.15s ease',
                          }}
                          title="Share live tracking link with family or friends"
                        >
                          <Share2 size={12} />
                          <span>Share Live Trip</span>
                        </button>
                      )}
                    </div>
                    {!isNavigating && (
                      <button
                        onClick={() => {
                          setDestinationPin(null)
                          setRouteData(null)
                          setRouteDistance(null)
                          setRouteDuration(null)
                          setSearchQuery('')
                        }}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#f87171',
                          borderRadius: 8,
                          padding: '8px 14px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          justifyContent: 'center',
                          minHeight: 40,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)' }}
                      >
                        <X size={14} />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>

                  {isRoutingLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#94a3b8' }}>
                      <div style={{ width: 14, height: 14, border: '2px solid #8b5cf6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      Calculating optimal path...
                    </div>
                  ) : routeError ? (
                    <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={14} /> {routeError}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 500 }}>DISTANCE</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8', fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>
                            {routeDistance ? `${routeDistance.toFixed(2)} km` : '--'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 500 }}>EST. TIME</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#34d399', fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>
                            {routeDuration ? `~${routeDuration} mins` : '--'}
                          </div>
                          <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>
                            est. with traffic
                          </div>
                        </div>
                      </div>

                      {isNavigating && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {/* Voice Navigation Speaker Toggle */}
                          <button
                            type="button"
                            onClick={() => {
                              const next = !isVoiceMuted
                              setIsVoiceMuted(next)
                              setVoiceMuted(next)
                            }}
                            style={{
                              padding: '8px 12px',
                              background: isVoiceMuted ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                              border: `1px solid ${isVoiceMuted ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
                              borderRadius: 8,
                              color: isVoiceMuted ? '#fca5a5' : '#6ee7b7',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              transition: 'all 0.15s ease',
                            }}
                            title={isVoiceMuted ? 'Unmute Spoken Directions' : 'Mute Spoken Directions'}
                            aria-label="Voice Navigation"
                          >
                            {isVoiceMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                            <span>{isVoiceMuted ? 'Muted' : 'Voice'}</span>
                          </button>
                        </div>
                      )}

                      {!isNavigating && (
                        <div style={{
                          display: 'flex',
                          background: 'rgba(0,0,0,0.3)',
                          borderRadius: 8,
                          padding: 2,
                          border: '1px solid rgba(255,255,255,0.08)'
                        }}>
                          <button
                            onClick={() => setRoutingProfile('driving')}
                            style={{
                              padding: '10px 14px',
                              background: routingProfile === 'driving' ? '#7c3aed' : 'transparent',
                              border: 'none',
                              color: routingProfile === 'driving' ? 'white' : '#94a3b8',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              minHeight: 40,
                            }}
                          >
                            <Car size={15} />
                            <span>Drive</span>
                          </button>
                          <button
                            onClick={() => setRoutingProfile('walking')}
                            style={{
                              padding: '10px 14px',
                              background: routingProfile === 'walking' ? '#7c3aed' : 'transparent',
                              border: 'none',
                              color: routingProfile === 'walking' ? 'white' : '#94a3b8',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              minHeight: 40,
                            }}
                          >
                            <Footprints size={15} />
                            <span>Walk</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Start Journey Button */}
                  {hasRoute && !isNavigating && (
                    <button
                      onClick={handleStartJourney}
                      style={{
                        width: '100%',
                        padding: '14px',
                        background: '#10b981',
                        border: 'none',
                        borderRadius: 10,
                        color: 'white',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                        fontFamily: 'Inter, sans-serif',
                        transition: 'all 0.2s',
                        marginTop: 4,
                        minHeight: 48,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#059669'}
                      onMouseLeave={e => e.currentTarget.style.background = '#10b981'}
                    >
                      <Navigation2 size={16} />
                      <span>Start Journey</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* FLOATING LEFT-SIDE ACTION CONTROLS STACK (Center, View) */}
          <div style={{
            position: 'absolute',
            left: 16,
            bottom: isBottomNavVisible
              ? 'calc(var(--bnav-height, 60px) + env(safe-area-inset-bottom, 0px) + 20px)'
              : 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            zIndex: 30,
            pointerEvents: 'none',
            transition: 'bottom 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            {/* 1. LOCATE ME / RECENTER BUTTON */}
            <button
              type="button"
              onClick={async () => {
                try {
                  const targetLng = userLocation?.longitude
                  const targetLat = userLocation?.latitude

                  if (mapRef.current && targetLng && targetLat) {
                    mapRef.current.flyTo({
                      center: [targetLng, targetLat],
                      zoom: isNavigating ? 18.5 : 16,
                      pitch: isNavigating ? (viewMode === 'street' ? 74 : 0) : 0,
                      bearing: isNavigating ? (Number(telemetry.heading) || 0) : 0,
                      duration: 800,
                      essential: true
                    })
                  }

                  // Always query fresh location from native Android bridge / GPS
                  const loc = await locationService.getCurrentLocation()
                  if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
                    setUserLocation({ latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy })
                    setViewState(prev => ({
                      ...prev,
                      longitude: loc.longitude,
                      latitude: loc.latitude,
                      zoom: isNavigating ? 18.5 : 16,
                    }))
                    if (mapRef.current) {
                      mapRef.current.flyTo({
                        center: [loc.longitude, loc.latitude],
                        zoom: isNavigating ? 18.5 : 16,
                        pitch: isNavigating ? (viewMode === 'street' ? 74 : 0) : 0,
                        bearing: isNavigating ? (Number(telemetry.heading) || 0) : 0,
                        duration: 900,
                        essential: true
                      })
                    }
                  }
                } catch (err) {
                  console.warn('[MapScreen] Locate button error:', err)
                }
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(12,12,20,0.92)',
                border: '1px solid rgba(139,92,246,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                pointerEvents: 'auto',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              title="Go to my location"
              aria-label="Go to my location"
            >
              <Crosshair size={20} color="#38bdf8" />
            </button>

            {/* 2. AERIAL / STREET VIEW TOGGLE */}
            <button
              type="button"
              className="map-mobile-view-toggle"
              onClick={() => {
                const next = viewMode === 'street' ? 'aerial' : 'street'
                setViewMode(next)
                if (mapRef.current) {
                  const nextPitch = next === 'aerial' ? 0 : (isNavigating ? 74 : 72)
                  const nextBearing = next === 'aerial' ? 0 : (telemetry.heading || viewState.bearing || 0)
                  setViewState(prev => ({ ...prev, pitch: nextPitch, bearing: nextBearing }))
                  mapRef.current.flyTo({
                    zoom: next === 'aerial' ? 14 : 19,
                    pitch: nextPitch,
                    bearing: nextBearing,
                    duration: 900,
                  })
                }
              }}
              style={{
                height: 38,
                padding: '0 12px',
                borderRadius: 20,
                background: 'rgba(12,12,20,0.92)',
                border: `1px solid ${viewMode === 'aerial' ? '#06b6d4' : 'rgba(139,92,246,0.4)'}`,
                color: viewMode === 'aerial' ? '#06b6d4' : '#a78bfa',
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                transition: 'transform 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              title="Toggle Map Perspective"
              aria-label="Toggle View"
            >
              {viewMode === 'aerial' ? <Compass size={15} /> : <Navigation size={15} />}
              <span>{viewMode === 'aerial' ? 'Aerial' : 'Street'}</span>
            </button>
          </div>

          {/* FLOATING ACTION CONTROLS ON RIGHT EDGE (SOS on top, Report Vibe below with matching baseline) */}
          <div style={{
            position: 'absolute',
            right: 16,
            bottom: isBottomNavVisible
              ? 'calc(var(--bnav-height, 60px) + env(safe-area-inset-bottom, 0px) + 20px)'
              : 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 12,
            zIndex: 50,
            pointerEvents: 'none',
            transition: 'bottom 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            {/* 1. EMERGENCY SOS BUTTON (Hidden during active journey navigation because bottom dock already has SOS) */}
            {!isNavigating && (
              <div style={{ position: 'relative', pointerEvents: 'auto' }}>
                <div style={{
                  position: 'absolute',
                  inset: -6,
                  borderRadius: '50%',
                  border: '2px solid rgba(239,68,68,0.5)',
                  animation: 'sosPulse 1.5s ease-out infinite',
                  pointerEvents: 'none',
                }} />
                <button
                  type="button"
                  onPointerDown={handleSOS}
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, #ef4444 0%, #b91c1c 100%)',
                    border: '3px solid rgba(255,255,255,0.3)',
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 0 26px rgba(239,68,68,0.75), 0 4px 16px rgba(0,0,0,0.6)',
                    position: 'relative',
                    zIndex: 3,
                    gap: 2,
                    fontFamily: 'Inter, sans-serif',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  title="Emergency SOS"
                  aria-label="Trigger SOS"
                >
                  <PhoneCall size={18} />
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>SOS</span>
                </button>
              </div>
            )}

            {/* 2. REPORT VIBE BUTTON (Hidden during navigation or when on family tab) */}
            {!isNavigating && activeTab !== 'family' && (
              <button
                onClick={() => navigate('/report-vibe')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(18,18,26,0.92)',
                  border: '1px solid rgba(139,92,246,0.5)',
                  borderRadius: 50,
                  padding: '10px 18px',
                  color: '#c4b5fd',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 0 12px rgba(139,92,246,0.2)',
                  fontFamily: 'Inter, sans-serif',
                  minHeight: 40,
                  pointerEvents: 'auto',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(18,18,26,0.92)'}
              >
                <Plus size={15} color="#a78bfa" />
                <span>Report Vibe</span>
              </button>
            )}
          </div>

          {/* BOTTOM SECTION - ATTACHED FLUSH TO SCREEN END WITH 10S AUTO-HIDE */}
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            maxWidth: '500px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 40,
            pointerEvents: isBottomNavVisible ? 'auto' : 'none',
            transform: isBottomNavVisible ? 'translateY(0)' : 'translateY(100%)',
            opacity: isBottomNavVisible ? 1 : 0,
            transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease',
          }}>
            {/* TELEMETRY SPEED & ACCURACY METER (Directly above Bottom Nav Bar) */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              marginBottom: '6px',
              pointerEvents: 'none'
            }}>
              <div style={{
                pointerEvents: 'auto',
                background: 'rgba(12,12,20,0.92)',
                border: '1px solid rgba(139,92,246,0.3)',
                borderRadius: '20px',
                padding: '4px 14px',
                color: '#e2e8f0',
                fontFamily: 'monospace',
                fontSize: '11px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                backdropFilter: 'blur(12px)',
              }}>
                <div><span style={{ color: '#06b6d4', fontWeight: 700 }}>SPD:</span> {telemetry.speed} km/h</div>
                <div style={{ color: 'rgba(255,255,255,0.2)' }}>|</div>
                <div><span style={{ color: '#8b5cf6', fontWeight: 700 }}>HDG:</span> {telemetry.heading}°</div>
                <div style={{ color: 'rgba(255,255,255,0.2)' }}>|</div>
                <div><span style={{ color: '#10b981', fontWeight: 700 }}>ACC:</span> ±{telemetry.accuracy}m</div>
              </div>
            </div>

            {/* Bottom Nav / End Journey Container (Attached Flush to End of Screen) */}
            <div className="map-mobile-bottom-nav" style={{
              width: '100%',
              margin: 0,
              marginBottom: 0,
              pointerEvents: 'auto'
            }}>
              {isNavigating ? (
                <div style={{
                  width: '100%',
                  background: 'rgba(10, 10, 18, 0.96)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '24px 24px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '14px 18px calc(10px + env(safe-area-inset-bottom))',
                  boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(24px)',
                  boxSizing: 'border-box',
                  gap: '12px',
                }}>
                  {/* ETA & Distance Summary Row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                  }}>
                    {/* Left: Green ETA + Distance + Arrival */}
                    <div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '6px',
                      }}>
                        <span style={{
                          fontSize: '22px',
                          fontWeight: 800,
                          color: '#10b981',
                          fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
                          letterSpacing: '-0.5px',
                        }}>
                          {routeDuration ? `${routeDuration} min` : '--'}
                        </span>
                        <span style={{ fontSize: '13px', color: '#10b981' }}>🍃</span>
                      </div>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#94a3b8',
                        marginTop: '1px',
                      }}>
                        {routeDistance ? `${routeDistance.toFixed(1)} km` : '--'} • {calcArrivalTime(routeDuration)}
                      </div>
                    </div>

                    {/* Right: Quick Share / Trip ID */}
                    {shareToken && (
                      <button
                        type="button"
                        onClick={handleShareTrip}
                        style={{
                          padding: '6px 12px',
                          background: 'rgba(6, 182, 212, 0.15)',
                          border: '1px solid rgba(6, 182, 212, 0.4)',
                          borderRadius: 10,
                          color: '#38bdf8',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                        title="Share live trip link"
                      >
                        <Share2 size={13} />
                        <span>Share</span>
                      </button>
                    )}
                  </div>

                  {/* Actions Row: Exit (✕), SOS (Emergency), Reroute */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                  }}>
                    {/* 1. Exit Navigation Circle Button (Google Maps "✕") */}
                    <button
                      type="button"
                      onClick={handleEndJourney}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'transform 0.15s ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      title="Exit Navigation"
                    >
                      <X size={20} />
                    </button>

                    {/* 2. Reroute / Alternate Route Button */}
                    <button
                      type="button"
                      onClick={handleReroute}
                      disabled={isRerouting}
                      style={{
                        flex: 1,
                        height: 44,
                        padding: '0 14px',
                        background: '#0284c7',
                        border: 'none',
                        borderRadius: 12,
                        color: 'white',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: isRerouting ? 'wait' : 'pointer',
                        boxShadow: '0 0 16px rgba(2, 132, 199, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        opacity: isRerouting ? 0.7 : 1,
                        transition: 'transform 0.15s ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <RotateCw size={15} className={isRerouting ? 'spin' : ''} />
                      <span>{isRerouting ? 'Rerouting...' : 'Reroute / Better Path'}</span>
                    </button>

                    {/* 3. Emergency SOS */}
                    <button
                      type="button"
                      onPointerDown={handleSOS}
                      style={{
                        height: 44,
                        padding: '0 16px',
                        background: 'radial-gradient(circle, #ef4444 0%, #b91c1c 100%)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: 12,
                        color: 'white',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: '0 0 16px rgba(239, 68, 68, 0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        flexShrink: 0,
                        transition: 'transform 0.15s ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      title="Emergency SOS"
                    >
                      <PhoneCall size={15} />
                      <span>SOS</span>
                    </button>
                  </div>
                </div>
              ) : (
                <BottomNav activeTab={activeTab} visible={isBottomNavVisible} onTabChange={handleTabChange} />
              )}
            </div>
          </div>
        </div>
        )}

        {/* NATIVE ANDROID / PIP NAVIGATION MINI-HUD (Google Maps Standard Compact Bottom HUD) */}
        {isInNativePip && (
          <div style={{
            position: 'absolute',
            left: 8,
            right: 8,
            bottom: 8,
            zIndex: 9999,
            background: 'linear-gradient(180deg, #00594C 0%, #004d40 100%)',
            borderRadius: 12,
            padding: '8px 12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            boxSizing: 'border-box',
            pointerEvents: 'auto',
            fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
          }}>
            {/* Maneuver Arrow & Instruction */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {getManeuverIcon(activeManeuver.modifier, activeManeuver.type, 18)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.2,
                }}>
                  {activeManeuver.streetName || activeManeuver.instruction || (destinationPin?.label || 'Navigating')}
                </div>
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#a7f3d0',
                  marginTop: 1,
                }}>
                  {activeManeuver.distanceText || (routeDistance ? `${routeDistance.toFixed(1)} km` : '')} • {calcArrivalTime(routeDuration)}
                </div>
              </div>
            </div>

            {/* Quick SOS button */}
            <button
              type="button"
              onPointerDown={handleSOS}
              style={{
                background: '#ef4444',
                border: 'none',
                borderRadius: 6,
                padding: '4px 8px',
                color: '#ffffff',
                fontSize: 10,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                flexShrink: 0,
              }}
            >
              <PhoneCall size={10} />
              <span>SOS</span>
            </button>
          </div>
        )}

      </div>

      {showPinRequiredModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 24,
        }}>
          <div style={{
            background: 'rgba(18,18,26,0.98)', border: '1px solid rgba(245,158,11,0.4)',
            borderRadius: 20, padding: '32px 24px', width: '100%', maxWidth: 380, textAlign: 'center',
          }}>
            <Lock size={44} color="#f59e0b" style={{ margin: '0 auto 8px' }} />
            <h3 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: '16px 0 12px', fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>
              Set your SOS PIN first
            </h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 28, lineHeight: 1.6 }}>
              You need a 4-digit SOS PIN before you can use the emergency button. This lets you safely cancel a false alarm. Set it up now in your profile.
            </p>
            <button
              onClick={() => { setShowPinRequiredModal(false); navigate('/profile') }}
              style={{
                width: '100%', padding: '14px', background: '#7c3aed',
                border: 'none', borderRadius: 12, color: 'white', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginBottom: 12, minHeight: 48,
              }}
            >
              Set PIN Now
            </button>
            <button
              onClick={() => setShowPinRequiredModal(false)}
              style={{
                width: '100%', padding: '14px', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                color: '#64748b', fontSize: 14, cursor: 'pointer', minHeight: 48,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!isInNativePip && <Notifications />}
    </>
  )
}