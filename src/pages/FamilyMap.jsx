import { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react'
import Map, { Marker, Popup, Source, Layer } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Crosshair,
  Compass,
  Navigation,
  Navigation2,
  ChevronLeft,
  X,
  Volume2,
  VolumeX,
  Radio,
  EyeOff,
  Phone,
  PhoneCall,
  RotateCw,
  Lock,
  FileText,
  Users,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react'
import { getOSRMRoute } from '../services/mapService'
import { GPSSmoother } from '../services/gpsSmoothing'
import locationService from '../services/locationService'
import API, { getSOSPinStatus, updateProfile, updateUserLocation } from '../services/api'
import { getCache, setCache } from '../services/cacheService'
import {
  getLocationSharing,
  setLocationSharing,
  onLocationSharingChange
} from '../services/locationSharingState'
import {
  processVoiceGuidance,
  resetVoiceNavigation,
  announceReroute,
  setVoiceMuted,
  isVoiceEnabled,
  speakInstruction
} from '../services/voiceNavigationService'
import { updateActiveJourney, stopActiveJourney } from '../services/journeyState'
import Notifications from '../components/Notifications'
import BottomNav from '../components/BottomNav'
import isWebGLSupported from '../utils/webgl'
import WebGLFallback from '../components/WebGLFallback'
import getDarkMapStyle, { FALLBACK_DARK_MAP_STYLE } from '../utils/mapStyle'
import { getPersonDisplayName } from '../utils/personDisplay'
export { getPersonDisplayName }

import { useSmoothPosition } from '../services/useSmoothPosition'

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY

// Memoized User Marker with smooth interpolation
const UserMarker = memo(({ longitude, latitude, avatarUrl }) => {
  const smooth = useSmoothPosition(longitude, latitude, 0, 1400);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

  if (smooth.longitude == null || smooth.latitude == null) return null;
  const showImg = Boolean(avatarUrl && !imgFailed);

  return (
    <Marker longitude={smooth.longitude} latitude={smooth.latitude} anchor="center">
      <div style={{ position: 'relative', cursor: 'pointer' }}>
        <div style={{
          position: 'absolute', inset: -6, borderRadius: '50%', border: '2px solid #06b6d4',
          animation: 'selfPulse 2s ease-out infinite', opacity: 0.6
        }} />
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: showImg ? '#0e1526' : 'rgba(6, 182, 212, 0.15)',
          border: '2.5px solid #06b6d4', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 20, boxShadow: '0 0 16px rgba(6, 182, 212, 0.65)',
          transition: 'transform 0.2s', position: 'relative', zIndex: 2,
          overflow: 'hidden'
        }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
          {showImg ? (
            <img
              src={avatarUrl}
              alt="You"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setImgFailed(true)}
            />
          ) : (
            '👤'
          )}
        </div>
        <div style={{
          position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
          marginTop: 4, background: 'rgba(8,8,16,0.9)', border: '1px solid rgba(6, 182, 212, 0.4)',
          borderRadius: 6, padding: '2px 8px', fontSize: 10, color: '#ffffff',
          whiteSpace: 'nowrap', fontWeight: 600, zIndex: 2
        }}>
          You
        </div>
      </div>
    </Marker>
  );
});

// Memoized Family Member Marker with smooth interpolation
const FamilyMemberMarker = memo(({ person, onClick, getPinColor, getPinLabel }) => {
  const smooth = useSmoothPosition(person.last_lng, person.last_lat, person.heading || 0, 2000);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [person.avatar_url]);

  if (smooth.longitude == null || smooth.latitude == null) return null;
  const showImg = Boolean(person.avatar_url && !imgFailed);
  const pinColor = getPinColor(person);

  const rawDate = person.last_seen_at || person.lastSeen || person.last_location_updated_at;
  const isLive = person.sos_active || (person.is_sharing_location && (
    typeof person.is_online === 'boolean'
      ? person.is_online
      : (rawDate ? (Date.now() - new Date(rawDate).getTime() <= 600000) : false)
  ));

  return (
    <Marker longitude={smooth.longitude} latitude={smooth.latitude} anchor="center">
      <div onClick={() => onClick(person)} style={{ position: 'relative', cursor: 'pointer' }}>
        {isLive && (
          <div style={{
            position: 'absolute', inset: -6, borderRadius: '50%', border: `2px solid ${pinColor}`,
            animation: person.sos_active ? 'sosPulse 1s ease-out infinite' : 'onlinePulse 2s ease-out infinite', opacity: 0.6
          }} />
        )}
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: showImg ? '#0e1526' : `${pinColor}22`,
          border: `2.5px solid ${pinColor}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 20, boxShadow: `0 0 16px ${pinColor}88`,
          transition: 'transform 0.2s', position: 'relative', zIndex: 2,
          overflow: 'hidden',
        }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
          {person.sos_active ? (
            '🆘'
          ) : showImg ? (
            <img
              src={person.avatar_url}
              alt={getPersonDisplayName(person)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setImgFailed(true)}
            />
          ) : (
            getPinLabel(person)
          )}
        </div>
        <div style={{
          position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
          marginTop: 4, background: 'rgba(8,8,16,0.85)', border: `1px solid ${pinColor}44`,
          borderRadius: 6, padding: '2px 8px', fontSize: 10, color: '#e2e8f0',
          whiteSpace: 'nowrap', fontWeight: 600, zIndex: 2, maxWidth: 120,
          overflow: 'hidden', textOverflow: 'ellipsis'
        }}>
          {getPersonDisplayName(person)}
        </div>
      </div>
    </Marker>
  );
});

export default function FamilyMap({ isEmbedded = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [webglAvailable] = useState(() => isWebGLSupported())
  const [mapStyleUrl, setMapStyleUrl] = useState(() => getDarkMapStyle())

  const handleMapError = (err) => {
    console.warn('[FamilyMap] Map style or tile loading warning:', err)
    if (mapStyleUrl !== FALLBACK_DARK_MAP_STYLE) {
      console.log('[FamilyMap] Falling back to CartoDB Dark Matter style')
      setMapStyleUrl(FALLBACK_DARK_MAP_STYLE)
    }
  }

  // ── All useState hooks MUST be declared before any useEffect ──────────────
  const [watchedUsers, setWatchedUsers] = useState(() => {
    const cached = getCache('watched_users')
    return Array.isArray(cached?.data) ? cached.data : []
  })
  const [isLoadingWatched, setIsLoadingWatched] = useState(() => {
    const cached = getCache('watched_users')
    return !Array.isArray(cached?.data) || cached.data.length === 0
  })
  const [debugInfo, setDebugInfo] = useState(null)
  const [showDebug, setShowDebug] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState(null)         // BUG-03: moved above useEffect
  const [showStopWarning, setShowStopWarning] = useState(false)
  const [isSharingMyLocation, setIsSharingMyLocation] = useState(() => getLocationSharing())
  const [isSharingLoading, setIsSharingLoading] = useState(false)   // prevent double-toggle
  const [activeJourney, setActiveJourney] = useState(() => {
    const saved = sessionStorage.getItem('vibemap_active_journey')
    return saved ? JSON.parse(saved) : null
  })
  const [journeySteps, setJourneySteps] = useState([])
  const [journeyDistance, setJourneyDistance] = useState(null)
  const [journeyDuration, setJourneyDuration] = useState(null)
  const [journeyRoute, setJourneyRoute] = useState(null)
  const [isRerouting, setIsRerouting] = useState(false)
  const [isVoiceMuted, setIsVoiceMuted] = useState(false)
  const [arrivalToast, setArrivalToast] = useState(null)
  const [showPinRequiredModal, setShowPinRequiredModal] = useState(false)
  const [hasSosPin, setHasSosPin] = useState(() => {
    try {
      const local = localStorage.getItem('vibemap_has_sos_pin')
      if (local !== null) return local === 'true'
      const cached = getCache('sos_pin_status')
      if (cached?.data && typeof cached.data.has_sos_pin === 'boolean') return cached.data.has_sos_pin
    } catch (_) {}
    return null
  })
  const [journeyRouteError, setJourneyRouteError] = useState(null)
  const routeRequestRef = useRef(null)
  const isPollingRef = useRef(false)
  const watchedUsersRef = useRef([]) // tracks latest watchedUsers for scheduleNextPoll without causing re-mounts
  const lastSentLocationRef = useRef(null) // deduplicates 15s heartbeat — skip if coordinate unchanged

  // 10-Second Auto-Hide Bottom Nav Bar on Inactivity / Touch Restore
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(true)
  const hideNavTimerRef = useRef(null)

  const resetNavTimer = useCallback(() => {
    setIsBottomNavVisible(true)
    if (hideNavTimerRef.current) {
      clearTimeout(hideNavTimerRef.current)
    }
    hideNavTimerRef.current = setTimeout(() => {
      setIsBottomNavVisible(false)
    }, 10000)
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

  // Native Android Picture-in-Picture mode detection
  const [isInNativePip, setIsInNativePip] = useState(false)

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

  const startBeneficiaryJourney = (person) => {
    resetVoiceNavigation()
    const displayName = getPersonDisplayName(person)
    const journey = {
      targetId: person.id,
      targetName: displayName,
      longitude: person.last_lng,
      latitude: person.last_lat,
      isSos: Boolean(person.sos_active),
    }
    setActiveJourney(journey)
    updateActiveJourney(journey)
    speakInstruction(`Starting navigation to ${displayName}`)
  }

  useEffect(() => {
    const handleNavEvent = (e) => {
      const person = e?.detail
      if (person && person.last_lat !== undefined && person.last_lng !== undefined) {
        startBeneficiaryJourney(person)
      }
    }
    window.addEventListener('startBeneficiaryNav', handleNavEvent)

    if (location.state?.autoNavigateTo) {
      startBeneficiaryJourney(location.state.autoNavigateTo)
      window.history.replaceState({}, '')
    }

    return () => {
      window.removeEventListener('startBeneficiaryNav', handleNavEvent)
    }
  }, [location.state])

  const [userLocation, setUserLocation] = useState(null)
  const [viewState, setViewState] = useState({
    longitude: 3.3792,
    latitude: 6.5244,
    zoom: 13,
    pitch: 72,
    bearing: 0,
  })
  const [viewMode, setViewMode] = useState('street')
  const viewModeRef = useRef(viewMode)
  const mapRef = useRef(null)
  const [isMapLoaded, setIsMapLoaded] = useState(false)
  const hasFittedRef = useRef(false)
  const gpsSmoother = useRef(new GPSSmoother())
  const locationPingRef = useRef(null)
  const [isSirenMuted, setIsSirenMuted] = useState(false)
  const [showSmsInputModal, setShowSmsInputModal] = useState(false)
  const [smsRawInput, setSmsRawInput] = useState('')
  const [smsParseError, setSmsParseError] = useState('')

  const handleEndJourney = () => {
    setActiveJourney(null)
    setJourneyRoute(null)
    setJourneySteps([])
    setJourneyDistance(null)
    setJourneyDuration(null)
    resetVoiceNavigation()
    stopActiveJourney()
  }

  const handleReroute = async () => {
    if (!activeJourney || !userLocation || isRerouting) return
    setIsRerouting(true)
    announceReroute()
    try {
      const data = await getOSRMRoute(
        [userLocation.longitude, userLocation.latitude],
        [activeJourney.longitude, activeJourney.latitude],
        'driving'
      )
      if (data) {
        setJourneyRoute(data.geometry)
        setJourneySteps(data.steps || [])
        setJourneyDistance(data.distance)
        setJourneyDuration(data.duration)
        updateActiveJourney({
          ...activeJourney,
          distance: data.distance,
          duration: data.duration,
        })
      }
    } catch (err) {
      console.warn('Rerouting failed:', err)
    } finally {
      setIsRerouting(false)
    }
  }

  const handlePlotSmsCoordinates = () => {
    if (!smsRawInput.trim()) return
    setSmsParseError('')

    let lat = null
    let lng = null

    // Pattern 1: URL query ?q=lat,lng
    const qMatch = smsRawInput.match(/[?&]q=(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)/i)
    if (qMatch) {
      lat = parseFloat(qMatch[1])
      lng = parseFloat(qMatch[3])
    }

    // Pattern 2: comma-separated pairs "6.5244, 3.3792" or "6.5244 3.3792"
    if (lat === null) {
      const pairMatch = smsRawInput.match(/(-?\d+\.\d{3,})[,\s]+(-?\d+\.\d{3,})/)
      if (pairMatch) {
        lat = parseFloat(pairMatch[1])
        lng = parseFloat(pairMatch[2])
      }
    }

    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
      const smsEmergencyPerson = {
        id: `sms_sos_${Date.now()}`,
        full_name: 'SMS Emergency Beacon',
        last_lat: lat,
        last_lng: lng,
        sos_active: true,
        is_sms_source: true,
        last_seen_at: new Date().toISOString(),
      }

      setWatchedUsers(prev => [smsEmergencyPerson, ...(Array.isArray(prev) ? prev.filter(p => !p.is_sms_source) : [])])
      setSelectedPerson(smsEmergencyPerson)
      setShowSmsInputModal(false)
      setSmsRawInput('')

      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [lng, lat],
          zoom: 16,
          duration: 1200
        })
      }
    } else {
      setSmsParseError('Could not find GPS coordinates in the text. Please enter or paste coordinates (e.g. 6.5244, 3.3792).')
    }
  }

  const activeSosUsers = useMemo(() => {
    let currentUserId = null
    try {
      const token = localStorage.getItem('vibemap_token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        currentUserId = payload.sub || payload.id
      }
    } catch (_) {}

    return (Array.isArray(watchedUsers) ? watchedUsers : []).filter(
      u => u.sos_active && (!currentUserId || u.id !== currentUserId)
    )
  }, [watchedUsers])

  // SOS Siren audio is managed globally by GlobalSOSAlertManager across all pages

  // ── Fetch watched users (polls every 10 s with in-flight deduplication) ───
  useEffect(() => {
    const fetchWatchedUsers = async () => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      try {
        const response = await API.get('/users/my-watched')
        const newUsers = response.data
        if (Array.isArray(newUsers)) {
          setWatchedUsers(newUsers)
          watchedUsersRef.current = newUsers // keep ref in sync for scheduleNextPoll
          setCache('watched_users', newUsers)
        }
        setIsLoadingWatched(false)

        // Asynchronously update local beneficiaries cache for custom names
        API.get('/beneficiaries/').then(bRes => {
          if (Array.isArray(bRes?.data)) {
            setCache('beneficiaries', bRes.data)
          }
        }).catch(() => {})
        // Debug info — only in dev builds (UX-04)
        if (import.meta.env.DEV) {
          setDebugInfo({
            status: response.status,
            count: Array.isArray(newUsers) ? newUsers.length : 'not an array',
            raw: JSON.stringify(newUsers, null, 2),
            timestamp: new Date().toLocaleTimeString(),
          })
        }

        // BUG-12: update active journey destination as tracked person moves
        setActiveJourney(prevJourney => {
          if (!prevJourney) return null
          const tracked = Array.isArray(newUsers) ? newUsers.find(u => u.id === prevJourney.targetId) : null
          if (!tracked || tracked.last_lat === null || tracked.last_lng === null) return prevJourney
          const dlat = Math.abs((tracked.last_lat ?? 0) - prevJourney.latitude)
          const dlng = Math.abs((tracked.last_lng ?? 0) - prevJourney.longitude)
          if (dlat < 0.0002 && dlng < 0.0002) return prevJourney
          return { ...prevJourney, latitude: tracked.last_lat, longitude: tracked.last_lng }
        })

        // Keep popup in sync if open
        setSelectedPerson(prevSelected => {
          if (!prevSelected) return null
          const updatedPerson = Array.isArray(newUsers) ? newUsers.find(u => u.id === prevSelected.id) : null
          return updatedPerson || prevSelected
        })
      } catch (err) {
        console.warn('Failed to fetch watched users:', err)
        setIsLoadingWatched(false)
        const cached = getCache('watched_users')
        if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
          setWatchedUsers(cached.data)
          watchedUsersRef.current = cached.data
        }
        if (import.meta.env.DEV) {
          setDebugInfo({
            status: err?.response?.status || 'network error',
            count: 0,
            raw: err?.response?.data ? JSON.stringify(err.response.data, null, 2) : err.message,
            timestamp: new Date().toLocaleTimeString(),
          })
        }
      } finally {
        isPollingRef.current = false;
      }
    }

    fetchWatchedUsers()

    // Adaptive Polling Engine: 3s on active SOS, 4s in foreground, 20s in background.
    // Uses watchedUsersRef (not the watchedUsers state closure) so the dependency array
    // can safely be [] — avoiding the infinite re-mount loop that was causing the
    // "shuffling between two fixed points" symptom.
    let pollTimer = null
    const scheduleNextPoll = () => {
      const isVisible = typeof document !== 'undefined' ? !document.hidden : true
      const hasActiveSOS = Array.isArray(watchedUsersRef.current) && watchedUsersRef.current.some(u => u.sos_active)
      const delay = hasActiveSOS ? 3000 : (isVisible ? 4000 : 20000)

      pollTimer = setTimeout(async () => {
        await fetchWatchedUsers()
        scheduleNextPoll()
      }, delay)
    }

    scheduleNextPoll()

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        clearTimeout(pollTimer)
        fetchWatchedUsers()
        scheduleNextPoll()
      }
    }

    const handleBeneficiariesUpdated = () => {
      fetchWatchedUsers()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('vibemap-beneficiaries-updated', handleBeneficiariesUpdated)

    return () => {
      clearTimeout(pollTimer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('vibemap-beneficiaries-updated', handleBeneficiariesUpdated)
    }
  }, []) // ← empty: effect runs once. watchedUsersRef keeps SOS detection current without re-mounting.

  // UX-07: Cache SOS PIN status on mount so emergency button is instant
  useEffect(() => {
    getSOSPinStatus()
      .then(res => {
        if (res?.data && typeof res.data.has_sos_pin === 'boolean') {
          setHasSosPin(res.data.has_sos_pin)
        }
      })
      .catch(() => {})
  }, [])

  // BUG-04 + BUG-10: Load real sharing state from server profile on mount
  useEffect(() => {
    API.get('/auth/me')
      .then(res => {
        const sharing = res.data?.location_sharing ?? res.data?.is_sharing_location ?? true
        setIsSharingMyLocation(sharing)
        if (res.data) {
          setCache('current_user', res.data)
          const av = res.data.avatar_url || (res.data.id ? localStorage.getItem(`vibemap_${res.data.id}_avatar`) : null)
          if (av) setCurrentUserAvatar(av)
        }
      })
      .catch(() => {/* keep default true on error */})
  }, [])

  useEffect(() => {
    viewModeRef.current = viewMode
  }, [viewMode])

  // Persist activeJourney to sessionStorage
  useEffect(() => {
    if (activeJourney) {
      sessionStorage.setItem('vibemap_active_journey', JSON.stringify(activeJourney))
    } else {
      sessionStorage.removeItem('vibemap_active_journey')
    }
  }, [activeJourney])

  const fontImport = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
    @keyframes sosPulse {
      0% { transform: scale(1); opacity: 0.8; }
      100% { transform: scale(2.2); opacity: 0; }
    }
    @keyframes onlinePulse {
      0% { transform: scale(1); opacity: 0.6; }
      100% { transform: scale(1.8); opacity: 0; }
    }
    @keyframes selfPulse {
      0% { transform: scale(1); opacity: 0.8; }
      100% { transform: scale(2.2); opacity: 0; }
    }
    
    /* MapLibre Popup Overrides */
    .maplibregl-popup-content {
      background: transparent !important;
      padding: 0 !important;
      box-shadow: none !important;
    }
    .maplibregl-popup-close-button {
      display: none !important;
    }
    .maplibregl-popup-tip {
      border-top-color: rgba(12, 12, 20, 0.98) !important;
      border-bottom-color: rgba(12, 12, 20, 0.98) !important;
      border-left-color: rgba(12, 12, 20, 0.98) !important;
      border-right-color: rgba(12, 12, 20, 0.98) !important;
    }
    
    /* Hide scrollbar cleanly */
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .no-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `

  const formatRelativeTime = useCallback((dateInput) => {
    if (!dateInput) return 'Offline'
    const date = new Date(dateInput)
    if (isNaN(date.getTime())) return 'Offline'

    const diffMs = Date.now() - date.getTime()
    if (diffMs < 0) return 'Just now'

    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 2) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    const diffWeeks = Math.floor(diffDays / 7)
    if (diffWeeks < 52) return `${diffWeeks}w ago`
    return `${Math.floor(diffDays / 365)}y ago`
  }, [])

  const isUserLive = useCallback((person) => {
    if (!person) return false
    if (person.sos_active) return true
    if (!person.is_sharing_location) return false

    if (typeof person.is_online === 'boolean') {
      return person.is_online
    }

    const rawDate = person.last_seen_at || person.lastSeen || person.last_location_updated_at
    if (!rawDate) return false
    const date = new Date(rawDate)
    if (isNaN(date.getTime())) return false

    const diffMs = Date.now() - date.getTime()
    return diffMs <= 10 * 60 * 1000 // 10 minutes
  }, [])

  const getPinColor = (person) => {
    if (!person) return '#64748b'
    if (person.sos_active) return '#ef4444'
    if (!person.is_sharing_location) return '#64748b'
    if (isUserLive(person)) return '#10b981'
    return '#f59e0b'
  }

  const getPinLabel = (person) => {
    if (!person) return '👤'
    if (person.sos_active) return '🆘'
    if (!person.is_sharing_location) return '📵'
    if (isUserLive(person)) return '🟢'
    return '👤'
  }

  const getStatusText = (person) => {
    if (!person) return 'Offline'
    if (person.sos_active) return 'SOS ACTIVE'
    if (!person.is_sharing_location) return 'Stopped sharing'
    if (isUserLive(person)) return 'Live'
    const lastSeenStr = person.last_seen_at || person.lastSeen
    return lastSeenStr ? `Last seen ${formatRelativeTime(lastSeenStr)}` : 'Offline'
  }

  const getStatusColor = (person) => {
    if (!person) return '#64748b'
    if (person.sos_active) return '#ef4444'
    if (!person.is_sharing_location) return '#64748b'
    if (isUserLive(person)) return '#10b981'
    return '#f59e0b'
  }

  // BUG-04: Wire sharing toggle to the centralized state & backend
  useEffect(() => {
    const unsubscribe = onLocationSharingChange((enabled) => {
      setIsSharingMyLocation(enabled)
    })
    return () => unsubscribe()
  }, [])

  const handleStopSharing = async () => {
    setIsSharingLoading(true)
    setShowStopWarning(false)
    try {
      await setLocationSharing(false)
    } finally {
      setIsSharingLoading(false)
    }
  }

  const handleStartSharing = async () => {
    setIsSharingLoading(true)
    try {
      await setLocationSharing(true)
    } finally {
      setIsSharingLoading(false)
    }
  }

  // BUG-05: Continuously ping location to backend when sharing is on (outside of trips).
  // lastSentLocationRef deduplicates: if userLocation stalls (GPS jitter < 1.5m threshold)
  // we skip re-sending the same coordinate, which would refresh last_location_updated_at
  // with a stale position and cause it to win the timestamp race in watched_user_service.py.
  useEffect(() => {
    if (!isSharingMyLocation || !userLocation) return
    const interval = setInterval(() => {
      const coordKey = `${userLocation.latitude.toFixed(6)},${userLocation.longitude.toFixed(6)}`
      if (lastSentLocationRef.current === coordKey) return // skip — position unchanged
      lastSentLocationRef.current = coordKey
      updateUserLocation({
        lat: userLocation.latitude,
        lng: userLocation.longitude,
        accuracy: userLocation.accuracy ?? null,
      }).catch(err => console.warn('Location update failed (non-critical):', err))
    }, 15000) // every 15 s
    return () => clearInterval(interval)
  }, [isSharingMyLocation, userLocation])

  const handleTabChange = (tab) => {
    if (tab === 'map') navigate('/map')
    if (tab === 'family') navigate('/family')
    if (tab === 'vibes') navigate('/vibes')
    if (tab === 'profile') navigate('/profile')
  }

  // Get real user location — uses native background service on Android, web API on browser
  useEffect(() => {
    let stopTracking = null

    const startLocation = async () => {
      stopTracking = await locationService.startTracking(
        (loc) => {
          const { latitude, longitude, accuracy } = loc

          if (accuracy !== null && accuracy !== undefined && accuracy > gpsSmoother.current.maxAccuracyThreshold) {
            return
          }

          const result = gpsSmoother.current.process({ latitude, longitude, accuracy })
          if (result) {
            setUserLocation(prev => {
              if (!prev) return result.smoothed
              const distance = GPSSmoother.calculateDistance(prev.latitude, prev.longitude, result.smoothed.latitude, result.smoothed.longitude)
              return distance < 1.5 ? prev : result.smoothed
            })
          }
        },
        (err) => console.warn('Location error:', err)
      )
    }

    startLocation()

    return () => {
      if (typeof stopTracking === 'function') stopTracking()
    }
  }, [])

  // Adjust camera once user location and map are loaded
  useEffect(() => {
    if (!userLocation || !isMapLoaded || hasFittedRef.current || !mapRef.current) return

    hasFittedRef.current = true
    const activeSos = watchedUsers.find(p => p.sos_active)

    if (activeSos) {
      const minLng = Math.min(userLocation.longitude, activeSos.last_lng)
      const maxLng = Math.max(userLocation.longitude, activeSos.last_lng)
      const minLat = Math.min(userLocation.latitude, activeSos.last_lat)
      const maxLat = Math.max(userLocation.latitude, activeSos.last_lat)

      mapRef.current.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 100, duration: 800 })
    } else {
      const targetPitch = viewMode === 'street' ? 72 : 0
      mapRef.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: viewMode === 'street' ? 16 : 14,
        pitch: targetPitch,
        duration: 800,
        essential: true,
      })
    }
  }, [userLocation, isMapLoaded, watchedUsers, viewMode])

  // Fetch real road route when a journey is active, but only when the destination changes
  useEffect(() => {
    if (!activeJourney || !userLocation) {
      setJourneyRoute(null)
      routeRequestRef.current = null
      return
    }

    const routeKey = `${activeJourney.latitude?.toFixed(5)}:${activeJourney.longitude?.toFixed(5)}`
    if (routeRequestRef.current === routeKey) return

    routeRequestRef.current = routeKey

    const fallbackRoute = {
      type: 'LineString',
      coordinates: [
        [userLocation.longitude, userLocation.latitude],
        [activeJourney.longitude, activeJourney.latitude],
      ],
    }

    setJourneyRoute(fallbackRoute)
    setJourneyRouteError(null)

    let isCancelled = false
    const fetchJourneyRoute = async () => {
      try {
        const data = await getOSRMRoute(
          [userLocation.longitude, userLocation.latitude],
          [activeJourney.longitude, activeJourney.latitude],
          'driving'
        )
        if (!isCancelled && data) {
          setJourneyRoute(data.geometry || fallbackRoute)
          setJourneySteps(data.steps || [])
          setJourneyDistance(data.distance)
          setJourneyDuration(data.duration)
          setJourneyRouteError(null)
          updateActiveJourney({
            ...activeJourney,
            distance: data.distance,
            duration: data.duration,
          })
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Journey route calculation failed:', err)
          setJourneyRouteError('Could not calculate road route. Showing straight line.')
          setJourneyRoute(fallbackRoute)
        }
      }
    }

    fetchJourneyRoute()
    return () => {
      isCancelled = true
    }
  }, [activeJourney, userLocation])

  // Continuous real-time voice guidance & telemetry update
  useEffect(() => {
    if (!activeJourney || !userLocation) return

    const distToDest = GPSSmoother.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      activeJourney.latitude,
      activeJourney.longitude
    )

    // Auto-detect arrival within 28 meters
    if (distToDest <= 28) {
      const targetName = activeJourney.targetName || 'your destination'
      console.log(`[FamilyMap] Arrived at ${targetName} (${distToDest.toFixed(1)}m away). Completing journey automatically.`)
      speakInstruction(`You have arrived at ${targetName}. Journey complete.`)
      setArrivalToast(`🎉 You have arrived at ${targetName}!`)
      handleEndJourney()
      return
    }

    if (journeySteps && journeySteps.length > 0) {
      processVoiceGuidance(
        [userLocation.longitude, userLocation.latitude],
        journeySteps,
        distToDest
      )
    }

    updateActiveJourney({
      ...activeJourney,
      currentLocation: [userLocation.longitude, userLocation.latitude],
      distance: journeyDistance,
      duration: journeyDuration,
    })
  }, [userLocation, activeJourney, journeySteps, journeyDistance, journeyDuration])

  // Auto-dismiss arrival toast after 6s
  useEffect(() => {
    if (arrivalToast) {
      const t = setTimeout(() => setArrivalToast(null), 6000)
      return () => clearTimeout(t)
    }
  }, [arrivalToast])

  // Adjust camera to 3D street perspective when a journey starts
  useEffect(() => {
    if (!mapRef.current || !hasFittedRef.current || !activeJourney) return

    setViewMode('street')
    mapRef.current.flyTo({
      zoom: 18.5,
      pitch: 74,
      duration: 700,
      essential: true
    })
  }, [activeJourney?.targetId])


  const [currentUserAvatar, setCurrentUserAvatar] = useState(() => {
    if (typeof window === 'undefined') return null;
    const cachedUser = getCache('current_user')?.data;
    if (cachedUser?.avatar_url) return cachedUser.avatar_url;
    if (cachedUser?.id) {
      const stored = localStorage.getItem(`vibemap_${cachedUser.id}_avatar`);
      if (stored) return stored;
    }
    return localStorage.getItem('vibemap_user_avatar') || null;
  });

  // Keep avatar in sync across screens
  useEffect(() => {
    const handleAvatarUpdate = (e) => {
      const newAv = e?.detail?.avatar_url;
      if (newAv) {
        setCurrentUserAvatar(newAv);
      }
    };
    window.addEventListener('vibemap-user-avatar-updated', handleAvatarUpdate);
    return () => window.removeEventListener('vibemap-user-avatar-updated', handleAvatarUpdate);
  }, []);

  const userMarkerElement = useMemo(() => {
    if (!userLocation) return null;
    return (
      <UserMarker
        longitude={userLocation.longitude}
        latitude={userLocation.latitude}
        avatarUrl={currentUserAvatar}
      />
    );
  }, [userLocation, currentUserAvatar]);

  const familyMarkersElement = useMemo(() => {
    return watchedUsers.map(person => {
      if (!person.is_sharing_location || person.last_lat === null || person.last_lng === null) return null;
      return (
        <FamilyMemberMarker 
          key={person.id} 
          person={person} 
          onClick={setSelectedPerson} 
          getPinColor={getPinColor} 
          getPinLabel={getPinLabel} 
        />
      );
    });
  }, [watchedUsers]);

  return (
    <>
      <style>{fontImport}</style>
      <div style={{
        width: '100vw',
        height: '100dvh',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif',
        background: '#080810',
      }}>

        {/* REAL MAP */}
        {!webglAvailable ? (
          <WebGLFallback onRetry={() => window.location.reload()} />
        ) : (
        <Map
          ref={mapRef}
          mapLib={maplibregl}
          {...viewState}
          onMove={e => setViewState(e.viewState)}
          onLoad={(e) => {
            setIsMapLoaded(true)
            const map = e.target
            if (map) {
              map.on('styleimagemissing', (ev) => {
                const id = ev.id
                if (id && !map.hasImage(id)) {
                  try {
                    map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) })
                  } catch (_) {}
                }
              })
            }
          }}
          onError={handleMapError}
          style={{ position: 'absolute', inset: 0, zIndex: 0, width: '100%', height: '100%' }}
          mapStyle={mapStyleUrl}
        >
          {/* USER SELF MARKER */}
          {userMarkerElement}
          
          {/* FAMILY MEMBER PINS */}
          {familyMarkersElement}

          {/* ACTIVE JOURNEY ROUTE LINE — real road routing */}
          {journeyRoute && (
            <Source
              id="journey-route"
              type="geojson"
              data={{
                type: 'Feature',
                properties: {},
                geometry: journeyRoute,
              }}
            >
              <Layer
                id="journey-line"
                type="line"
                paint={{
                  'line-color': '#3b82f6',
                  'line-width': 5,
                  'line-opacity': 0.85,
                }}
                layout={{
                  'line-join': 'round',
                  'line-cap': 'round',
                }}
              />
            </Source>
          )}

          {/* PERSON DETAIL POPUP */}
          {selectedPerson && (
            <Popup
              longitude={selectedPerson.last_lng}
              latitude={selectedPerson.last_lat}
              anchor="bottom"
              onClose={() => setSelectedPerson(null)}
              closeOnClick={true}
              offset={60}
              closeButton={false}
              style={{ zIndex: 100 }}
            >
              <div style={{
                background: 'rgba(12, 12, 20, 0.98)',
                border: `1px solid ${getPinColor(selectedPerson)}55`,
                borderRadius: 16,
                padding: '16px',
                minWidth: 250,
                fontFamily: 'Inter, sans-serif',
                position: 'relative',
                zIndex: 100,
                pointerEvents: 'auto',
                boxShadow: '0 12px 36px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)',
              }}>
                <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedPerson(null)
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      setSelectedPerson(null)
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
                    title="Close Card"
                    aria-label="Close"
                  >
                    <X size={14} />
                  </button>
                  {/* Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 12,
                  }}>
                    {/* Avatar circle: real photo if available, else emoji fallback */}
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: selectedPerson.avatar_url
                        ? '#0e1526'
                        : `${getPinColor(selectedPerson)}22`,
                      border: `2px solid ${getPinColor(selectedPerson)}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                      flexShrink: 0,
                      overflow: 'hidden',
                    }}>
                      {selectedPerson.avatar_url ? (
                        <img
                          src={selectedPerson.avatar_url}
                          alt={getPersonDisplayName(selectedPerson)}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
                        />
                      ) : (
                        selectedPerson.avatar || '👤'
                      )}
                    </div>
                    <div>
                      <div style={{
                        color: 'white',
                        fontSize: 15,
                        fontWeight: 700,
                        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
                      }}>
                        {getPersonDisplayName(selectedPerson)}
                      </div>
                      <div style={{
                        color: getStatusColor(selectedPerson),
                        fontSize: 11,
                        fontWeight: 600,
                      }}>
                        {selectedPerson.sos_active && '🔴 '}
                        {getStatusText(selectedPerson)}
                      </div>
                    </div>
                  </div>

                  {/* Info rows */}
                  {selectedPerson.is_sharing_location && (
                    <div style={{
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      marginBottom: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        color: '#64748b',
                      }}>
                        <span>Accuracy</span>
                        <span style={{ color: '#e2e8f0' }}>±{selectedPerson.accuracy ?? '?'}m</span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        color: '#64748b',
                      }}>
                        <span>Last updated</span>
                        <span style={{ color: '#e2e8f0' }}>
                          {(selectedPerson.last_seen_at || selectedPerson.lastSeen)
                            ? formatRelativeTime(selectedPerson.last_seen_at || selectedPerson.lastSeen)
                            : 'Unknown'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* SOS warning */}
                  {selectedPerson.sos_active && (
                    <div style={{
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      marginBottom: 12,
                      color: '#ef4444',
                      fontSize: 12,
                      fontWeight: 600,
                      textAlign: 'center',
                    }}>
                      ⚠️ This person has triggered an SOS alert
                    </div>
                  )}

                  {/* Not sharing warning */}
                  {!selectedPerson.is_sharing_location && (
                    <div style={{
                      background: 'rgba(100,116,139,0.1)',
                      border: '1px solid rgba(100,116,139,0.3)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      marginBottom: 12,
                      color: '#94a3b8',
                      fontSize: 12,
                      textAlign: 'center',
                    }}>
                      Location sharing is off
                    </div>
                  )}

                  {/* Action buttons row */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => {
                        if (selectedPerson.phone) {
                          window.location.href = `tel:${selectedPerson.phone}`
                        }
                      }}
                      disabled={!selectedPerson.phone}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: selectedPerson.sos_active
                          ? '#ef4444'
                          : 'rgba(255,255,255,0.06)',
                        border: selectedPerson.sos_active ? 'none' : '1px solid rgba(139,92,246,0.3)',
                        borderRadius: 8,
                        color: 'white',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: !selectedPerson.phone ? 'not-allowed' : 'pointer',
                        fontFamily: 'Inter, sans-serif',
                        boxShadow: selectedPerson.sos_active
                          ? '0 0 16px rgba(239,68,68,0.4)'
                          : 'none',
                        opacity: !selectedPerson.phone ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <Phone size={14} />
                      <span>Call</span>
                    </button>

                    <button
                      onClick={() => {
                        if (selectedPerson.last_lat === null || selectedPerson.last_lng === null) return
                        startBeneficiaryJourney(selectedPerson)
                        setSelectedPerson(null)
                      }}
                      disabled={selectedPerson.last_lat === null || selectedPerson.last_lng === null}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: '#7c3aed',
                        border: 'none',
                        borderRadius: 8,
                        color: 'white',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: (selectedPerson.last_lat === null || selectedPerson.last_lng === null) ? 'not-allowed' : 'pointer',
                        fontFamily: 'Inter, sans-serif',
                        boxShadow: '0 0 12px rgba(124,58,237,0.3)',
                        opacity: (selectedPerson.last_lat === null || selectedPerson.last_lng === null) ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <Navigation2 size={14} />
                      <span>Navigate</span>
                    </button>
                  </div>
                </div>
              </Popup>
            )}
        </Map>
        )}

        {/* MASTER UI OVERLAY LAYER */}
        {!isInNativePip && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 10,
          pointerEvents: 'none',
          padding: isEmbedded
            ? '0 16px'
            : 'calc(16px + env(safe-area-inset-top)) 16px calc(12px + env(safe-area-inset-bottom)) 16px',
        }}>
          {/* TOP SECTION (Strict Flex-Column) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            paddingTop: isEmbedded ? '88px' : '0px',
            width: '100%',
            pointerEvents: 'none',
            position: 'relative',
            zIndex: 15,
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
            {/* Header row: back, title, sharing toggle */}
            <div style={{
              display: 'flex',
              justifyContent: isEmbedded ? 'flex-end' : 'space-between',
              alignItems: 'center',
              width: '100%',
              pointerEvents: 'none',
              gap: 12,
            }}>
              {/* Back + Title */}
              {!isEmbedded && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, pointerEvents: 'auto' }}>
                  <button
                    onClick={() => navigate(-1)}  /* UX-06: go back in history instead of hardcoded /map */
                    style={{
                      width: 38, height: 38,
                      borderRadius: '50%',
                      background: 'rgba(18,18,26,0.9)',
                      border: '1px solid rgba(139,92,246,0.3)',
                      color: '#e2e8f0',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Back"
                    aria-label="Back"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div>
                    <div style={{
                      color: 'white',
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
                    }}>Family Map</div>
                    <div style={{ color: '#64748b', fontSize: 10 }}>
                      {watchedUsers.filter(p => isUserLive(p)).length} of {watchedUsers.length} live
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', pointerEvents: 'auto', marginRight: 56 }}>
                <button
                  onClick={() => isSharingMyLocation
                    ? setShowStopWarning(true)
                    : handleStartSharing()
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: isSharingMyLocation
                      ? 'rgba(16,185,129,0.15)'
                      : 'rgba(100,116,139,0.15)',
                    border: `1px solid ${isSharingMyLocation ? '#10b981' : '#64748b'}`,
                    borderRadius: 50,
                    padding: '5px 12px',
                    color: isSharingMyLocation ? '#10b981' : '#94a3b8',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    pointerEvents: 'auto',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                  }}
                >
                  {isSharingMyLocation ? <Radio size={13} /> : <EyeOff size={13} />}
                  <span>{isSharingMyLocation ? 'Sharing' : 'Off'}</span>
                </button>
              </div>
            </div>

            {/* ACTIVE BENEFICIARY JOURNEY NAVIGATION CARD */}
            {activeJourney && (
              <div style={{
                background: 'rgba(18,18,26,0.95)',
                border: '1px solid rgba(139,92,246,0.4)',
                borderRadius: 16,
                padding: '12px 16px',
                color: '#e2e8f0',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                pointerEvents: 'auto',
                animation: 'fadeIn 0.3s ease-out'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {activeJourney.isSos ? 'Responding to Emergency' : 'Navigating to Beneficiary'}
                  </div>
                  <div style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'white',
                    marginTop: 2,
                    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {activeJourney.targetName}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, fontWeight: 700 }}>
                    <span style={{ color: '#38bdf8' }}>{journeyDistance ? `${journeyDistance.toFixed(1)} km` : '--'}</span>
                    <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
                    <span style={{ color: '#34d399' }}>{journeyDuration ? `~${journeyDuration} mins` : '--'}</span>
                  </div>
                </div>

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
                    flexShrink: 0,
                  }}
                  title={isVoiceMuted ? 'Unmute Spoken Directions' : 'Mute Spoken Directions'}
                  aria-label="Voice Navigation"
                >
                  {isVoiceMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  <span>{isVoiceMuted ? 'Muted' : 'Voice'}</span>
                </button>
              </div>
            )}

            {/* OFFLINE STATUS & SMS COORDINATES INPUT BAR */}
            {!navigator.onLine && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(239,68,68,0.22))',
                border: '1px solid rgba(245, 158, 11, 0.5)',
                borderRadius: 14,
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#f59e0b',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 8,
                pointerEvents: 'auto',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Radio size={14} />
                  <span>Offline Mode — Showing last saved GPS locations</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSmsInputModal(true)}
                  style={{
                    background: '#f59e0b',
                    border: 'none',
                    borderRadius: 8,
                    padding: '4px 10px',
                    color: '#080810',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <FileText size={12} />
                  <span>Plot SMS GPS</span>
                </button>
              </div>
            )}

            {/* Family Status Pills container: Horizontally Scrolling */}
            <div
              className="no-scrollbar"
              style={{
                display: 'flex',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                gap: '10px',
                paddingBottom: '2px',
                width: '100%',
                pointerEvents: 'auto',
              }}
            >
              {isLoadingWatched ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(18,18,26,0.9)',
                  border: '1px solid rgba(139,92,246,0.3)',
                  borderRadius: 50,
                  padding: '10px 18px',
                  color: '#94a3b8',
                  fontSize: 12,
                  fontFamily: 'Inter, sans-serif',
                }}>
                  <div style={{ width: 12, height: 12, border: '2px solid #8b5cf6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <span>Loading family members...</span>
                </div>
              ) : watchedUsers.length === 0 ? (
                <button
                  onClick={() => navigate('/profile')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(18,18,26,0.9)',
                    border: '1px dashed rgba(139,92,246,0.5)',
                    borderRadius: 50,
                    padding: '10px 18px',
                    color: '#c4b5fd',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    whiteSpace: 'normal',
                    textAlign: 'left',
                    flexShrink: 0,
                  }}
                >
                  <Users size={15} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>No family members watching you yet. Tap to manage</span>
                </button>
              ) : (
                watchedUsers.map(person => (
                  <button
                    key={person.id}
                    onClick={() => {
                      if (person.last_lat === null || person.last_lng === null) return
                      setSelectedPerson(person)
                      const targetPitch = viewMode === 'street' ? 72 : 0
                      setViewState(prev => ({
                        ...prev,
                        longitude: person.last_lng,
                        latitude: person.last_lat,
                        zoom: 16,
                        pitch: targetPitch,
                      }))
                      if (mapRef.current) {
                        mapRef.current.flyTo({
                          center: [person.last_lng, person.last_lat],
                          zoom: 16,
                          pitch: targetPitch,
                          duration: 800,
                          essential: true
                        })
                      }
                    }}
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(18,18,26,0.9)',
                      border: `1px solid ${getPinColor(person)}44`,
                      borderRadius: 50,
                      padding: '11px 16px 11px 11px',
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      minHeight: 48,
                    }}
                  >
                    <div style={{
                      width: 26, height: 26,
                      borderRadius: '50%',
                      background: person.avatar_url
                        ? '#0e1526'
                        : `${getPinColor(person)}22`,
                      border: `1.5px solid ${getPinColor(person)}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      overflow: 'hidden',
                    }}>
                      {person.sos_active ? (
                        '🆘'
                      ) : person.avatar_url ? (
                        <img
                          src={person.avatar_url}
                          alt={getPersonDisplayName(person)}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
                        />
                      ) : (
                        getPinLabel(person)
                      )}
                    </div>
                    <div style={{ textAlign: 'left', maxWidth: 100 }}>
                      <div style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getPersonDisplayName(person)}
                      </div>
                      <div style={{ color: getStatusColor(person), fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {person.sos_active
                          ? 'SOS!'
                          : isUserLive(person)
                            ? 'Live'
                            : person.is_sharing_location
                              ? (person.last_seen_at || person.lastSeen ? formatRelativeTime(person.last_seen_at || person.lastSeen) : 'Offline')
                              : 'Off'}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* ACTIVE JOURNEY BANNER */}
            {activeJourney && (
              <div style={{
                width: '100%',
                maxWidth: '512px',
                margin: '0 auto',
                background: '#7c3aed',
                borderRadius: 12,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                boxShadow: '0 0 20px rgba(124,58,237,0.4)',
                pointerEvents: 'auto',
                position: 'relative',
                zIndex: 16,
                marginTop: 4,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ color: 'white', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <Navigation2 size={14} style={{ flexShrink: 0 }} /> Navigating to {activeJourney.targetName || 'Beneficiary'}
                  </span>
                  {journeyRouteError && (
                    <span style={{ color: '#fef3c7', fontSize: 10, marginTop: 2 }}>
                      {journeyRouteError}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setActiveJourney(null)}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: 'none',
                    borderRadius: 8,
                    color: 'white',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '6px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <X size={12} />
                  <span>End</span>
                </button>
              </div>
            )}
          </div>

          {/* FLOATING LEFT-SIDE CONTROLS STACK (Center, View) */}
          <div style={{
            position: 'absolute',
            left: 16,
            bottom: isEmbedded ? 96 : (isBottomNavVisible ? 'calc(var(--bnav-height, 60px) + env(safe-area-inset-bottom, 0px) + 20px)' : 'calc(env(safe-area-inset-bottom, 0px) + 24px)'),
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
                      zoom: activeJourney ? 18.5 : (viewMode === 'street' ? 16 : 14),
                      pitch: viewMode === 'street' ? (activeJourney ? 74 : 72) : 0,
                      bearing: viewMode === 'street' ? (viewState.bearing || 0) : 0,
                      duration: 800,
                      essential: true
                    })
                  }

                  // Query fresh location from native Android bridge / GPS
                  const loc = await locationService.getCurrentLocation()
                  if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
                    setUserLocation({ latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy })
                    setViewState(prev => ({
                      ...prev,
                      longitude: loc.longitude,
                      latitude: loc.latitude,
                      zoom: activeJourney ? 18.5 : (viewMode === 'street' ? 16 : 14),
                    }))
                    if (mapRef.current) {
                      mapRef.current.flyTo({
                        center: [loc.longitude, loc.latitude],
                        zoom: activeJourney ? 18.5 : (viewMode === 'street' ? 16 : 14),
                        pitch: viewMode === 'street' ? (activeJourney ? 74 : 72) : 0,
                        bearing: viewMode === 'street' ? (loc.heading || 0) : 0,
                        duration: 900,
                        essential: true
                      })
                    }
                  }
                } catch (err) {
                  console.warn('[FamilyMap] Locate button error:', err)
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
                  const nextPitch = next === 'aerial' ? 0 : (activeJourney ? 74 : 72)
                  const nextBearing = next === 'aerial' ? 0 : (viewState.bearing || 0)
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

          {/* FLOATING SOS CONTROL ON RIGHT EDGE */}
          <div style={{
            position: 'absolute',
            right: 16,
            bottom: isBottomNavVisible
              ? 'calc(var(--bnav-height, 60px) + env(safe-area-inset-bottom, 0px) + 20px)'
              : 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            zIndex: 50,
            pointerEvents: 'none',
            transition: 'bottom 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            {!activeJourney && (
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
                  onClick={async () => {
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
                      navigate('/sos')
                    }
                  }}
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, #ef4444 0%, #991b1b 100%)',
                    border: '2.5px solid rgba(255,255,255,0.4)',
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
          </div>

          {/* BOTTOM SECTION - ATTACHED FLUSH TO SCREEN END WITH 10S AUTO-HIDE */}
          {!isEmbedded && (
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
              <div className="map-mobile-bottom-nav" style={{
                width: '100%',
                margin: 0,
                marginBottom: 0,
                pointerEvents: 'auto'
              }}>
                {activeJourney ? (
                  <div style={{
                    width: '100%',
                    height: 'calc(var(--bnav-height) + env(safe-area-inset-bottom))',
                    paddingBottom: 'calc(6px + env(safe-area-inset-bottom))',
                    background: 'rgba(8,8,16,0.98)',
                    borderTop: '1px solid rgba(139, 92, 246, 0.35)',
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderBottom: 'none',
                    borderRadius: '20px 20px 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(24px)',
                    boxShadow: '0 -4px 32px rgba(0,0,0,0.7)',
                    paddingLeft: '16px',
                    paddingRight: '16px',
                    gap: '8px',
                  }}>
                    {/* 1. Direct Emergency SOS in Navigation Dock */}
                    <button
                      type="button"
                      onClick={async () => {
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
                          navigate('/sos')
                        }
                      }}
                      style={{
                        flex: 0.85,
                        padding: '10px 8px',
                        background: 'radial-gradient(circle, #ef4444 0%, #b91c1c 100%)',
                        border: '1px solid rgba(255,255,255,0.3)',
                        borderRadius: 12,
                        color: 'white',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: '0 0 16px rgba(239, 68, 68, 0.6)',
                        fontFamily: 'Inter, sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        transition: 'transform 0.15s ease',
                        minHeight: 'var(--bnav-btn-size)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      title="Trigger Emergency SOS"
                    >
                      <PhoneCall size={16} />
                      <span>SOS</span>
                    </button>

                    {/* 2. Reroute / Better Path Button */}
                    <button
                      type="button"
                      onClick={handleReroute}
                      disabled={isRerouting}
                      style={{
                        flex: 1.1,
                        padding: '10px 10px',
                        background: '#0284c7',
                        border: 'none',
                        borderRadius: 12,
                        color: 'white',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: isRerouting ? 'wait' : 'pointer',
                        boxShadow: '0 0 16px rgba(2, 132, 199, 0.35)',
                        fontFamily: 'Inter, sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        transition: 'transform 0.15s ease',
                        minHeight: 'var(--bnav-btn-size)',
                        opacity: isRerouting ? 0.7 : 1,
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      title="Find Better Path / Avoid Issues on Road"
                    >
                      <RotateCw size={15} className={isRerouting ? 'spin' : ''} />
                      <span>{isRerouting ? '...' : 'Reroute'}</span>
                    </button>

                    {/* 3. End Journey Button */}
                    <button
                      type="button"
                      onClick={handleEndJourney}
                      style={{
                        flex: 0.9,
                        padding: '10px 10px',
                        background: '#475569',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 12,
                        color: 'white',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 0 12px rgba(0, 0, 0, 0.35)',
                        fontFamily: 'Inter, sans-serif',
                        letterSpacing: 0.3,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        transition: 'transform 0.15s ease',
                        minHeight: 'var(--bnav-btn-size)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <X size={15} />
                      <span>End</span>
                    </button>
                  </div>
                ) : (
                  <BottomNav activeTab="family" visible={isBottomNavVisible} onTabChange={handleTabChange} />
                )}
              </div>
            </div>
          )}
        </div>
        )}

        {/* STOP SHARING WARNING MODAL */}
        {showStopWarning && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 24,
          }}>
            <div style={{
              background: 'rgba(18,18,26,0.98)',
              border: '1px solid rgba(245,158,11,0.4)',
              borderRadius: 20,
              padding: '32px 24px',
              width: '100%',
              maxWidth: 380,
              textAlign: 'center',
            }}>
              <span style={{ fontSize: 48 }}>⚠️</span>
              <h3 style={{
                color: 'white',
                fontSize: 20,
                fontWeight: 700,
                margin: '16px 0 12px',
                fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
              }}>Stop sharing your location?</h3>
              <p style={{
                color: '#f59e0b',
                fontSize: 14,
                marginBottom: 8,
                fontWeight: 600,
              }}>
                ⚠️ This is at your own risk
              </p>
              <p style={{
                color: '#64748b',
                fontSize: 13,
                marginBottom: 28,
                lineHeight: 1.6,
              }}>
                Your beneficiaries will no longer be able to see your location. If something happens to you, they won't know where you are. This action reduces your safety.
              </p>

              <button
                onClick={handleStopSharing}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  borderRadius: 12,
                  color: '#ef4444',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginBottom: 12,
                  fontFamily: 'Inter, sans-serif',
                  minHeight: 48,
                }}
              >
                I understand — Stop sharing
              </button>

              <button
                onClick={() => setShowStopWarning(false)}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                  border: 'none',
                  borderRadius: 12,
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  boxShadow: '0 0 16px rgba(139,92,246,0.3)',
                  minHeight: 48,
                }}
              >
                🛡️ Keep sharing — Stay safe
              </button>
            </div>
          </div>
        )}

      </div>
      {!isInNativePip && <Notifications />}

      {/* ── DEBUG PANEL — tap "DBG" button to see raw /users/my-watched response (Dev only) ── */}
      {import.meta.env.DEV && (
        <>
          <button
            onClick={() => setShowDebug(d => !d)}
            style={{
              position: 'fixed', top: 60, right: 8, zIndex: 200,
              background: debugInfo?.count === 0 ? 'rgba(239,68,68,0.85)' : 'rgba(16,185,129,0.85)',
              border: 'none', borderRadius: 6, padding: '3px 7px',
              color: 'white', fontSize: 10, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'monospace', pointerEvents: 'auto',
            }}
          >
            DBG {debugInfo ? `[${debugInfo.count}]` : '…'}
          </button>
          {showDebug && debugInfo && (
            <div style={{
              position: 'fixed', top: 85, right: 8, zIndex: 200,
              background: 'rgba(8,8,16,0.97)', border: '1px solid rgba(139,92,246,0.4)',
              borderRadius: 10, padding: 12, maxWidth: 320, maxHeight: 320,
              overflowY: 'auto', fontFamily: 'monospace', fontSize: 11,
              color: '#e2e8f0', pointerEvents: 'auto',
            }}>
              <div style={{ color: '#8b5cf6', fontWeight: 700, marginBottom: 6 }}>
                /users/my-watched response
              </div>
              <div style={{ color: '#64748b', marginBottom: 4 }}>
                Status: <span style={{ color: '#06b6d4' }}>{debugInfo.status}</span>
                {'  '}Count: <span style={{ color: debugInfo.count === 0 ? '#ef4444' : '#10b981' }}>{debugInfo.count}</span>
                {'  '}{debugInfo.timestamp}
              </div>
              <pre style={{ color: '#94a3b8', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {debugInfo.raw}
              </pre>
            </div>
          )}
        </>
      )}

      {/* PIN REQUIRED MODAL */}
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

      {/* SMS GPS COORDINATES INPUT MODAL */}
      {showSmsInputModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 24,
        }}>
          <div style={{
            background: 'rgba(18,18,26,0.98)',
            border: '1px solid rgba(245,158,11,0.5)',
            borderRadius: 20,
            padding: '28px 20px',
            width: '100%',
            maxWidth: 400,
            textAlign: 'center',
            boxShadow: '0 12px 36px rgba(0,0,0,0.7)',
            fontFamily: 'Inter, sans-serif',
          }}>
            <FileText size={40} color="#f59e0b" style={{ margin: '0 auto 8px' }} />
            <h3 style={{
              color: 'white',
              fontSize: 18,
              fontWeight: 700,
              margin: '12px 0 8px',
              fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
            }}>
              Plot Offline SMS Location
            </h3>
            <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 18, lineHeight: 1.5 }}>
              Paste the distress SMS text or Google Maps link received from your family member:
            </p>

            <textarea
              value={smsRawInput}
              onChange={e => setSmsRawInput(e.target.value)}
              placeholder="e.g. 🚨 EMERGENCY SOS! GPS: https://maps.google.com/?q=6.5244,3.3792"
              rows={3}
              style={{
                width: '100%',
                background: 'rgba(8,8,16,0.9)',
                border: '1px solid rgba(139,92,246,0.4)',
                borderRadius: 10,
                padding: '10px',
                color: '#ffffff',
                fontSize: 12,
                fontFamily: 'monospace',
                resize: 'none',
                marginBottom: 12,
                boxSizing: 'border-box',
              }}
            />

            {smsParseError && (
              <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>
                {smsParseError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setShowSmsInputModal(false)
                  setSmsRawInput('')
                  setSmsParseError('')
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 10,
                  color: '#94a3b8',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handlePlotSmsCoordinates}
                style={{
                  flex: 1.4,
                  padding: '12px',
                  background: '#f59e0b',
                  border: 'none',
                  borderRadius: 10,
                  color: '#080810',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
                }}
              >
                Plot on Map
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NATIVE ANDROID / PIP NAVIGATION MINI-HUD (Google Maps Standard Transparent Glass HUD) */}
      {isInNativePip && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 9999,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '8px 10px',
          boxSizing: 'border-box',
          fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
        }}>
          {/* Top Pill: Family Member / Radar Status */}
          <div style={{
            background: 'rgba(10, 10, 20, 0.88)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            borderRadius: 10,
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            pointerEvents: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
              <Users size={16} color="#8b5cf6" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.2
                }}>
                  {activeJourney?.targetName ? `Navigating to ${activeJourney.targetName}` : 'Family Radar'}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginTop: 1 }}>
                  {activeJourney && journeyDistance ? `${journeyDistance} km · ~${journeyDuration || '--'} min` : `${watchedUsers?.length || 0} family members on map`}
                </div>
              </div>
            </div>
            {activeJourney && (
              <div style={{
                background: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: 6,
                padding: '2px 6px',
                fontSize: 10,
                fontWeight: 700,
                color: '#a78bfa',
                whiteSpace: 'nowrap'
              }}>
                Active
              </div>
            )}
          </div>

          {/* Bottom Quick Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            pointerEvents: 'auto',
          }}>
            {/* Emergency SOS Button */}
            <button
              type="button"
              onPointerDown={handleSOS}
              style={{
                padding: '6px 12px',
                background: 'radial-gradient(circle, #ef4444 0%, #b91c1c 100%)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 8,
                color: 'white',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: '0 0 12px rgba(239, 68, 68, 0.6)',
              }}
            >
              <PhoneCall size={12} />
              <span>SOS</span>
            </button>

            {activeJourney && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={handleReroute}
                  disabled={isRerouting}
                  style={{
                    padding: '6px 10px',
                    background: 'rgba(2, 132, 199, 0.85)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8,
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: isRerouting ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <RotateCw size={11} className={isRerouting ? 'spin' : ''} />
                  <span>{isRerouting ? '...' : 'Reroute'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleEndJourney}
                  style={{
                    padding: '6px 10px',
                    background: 'rgba(71, 85, 105, 0.85)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8,
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <X size={11} />
                  <span>End</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}