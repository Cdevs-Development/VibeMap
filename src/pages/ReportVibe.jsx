import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  Search,
  MapPin,
  ArrowRight,
  Send
} from 'lucide-react'
import { createVibePin } from '../services/api'
import { getCache, setCache } from '../services/cacheService'
import Map, { Marker } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { searchGeocoding } from '../services/mapService'
import isWebGLSupported from '../utils/webgl'
import WebGLFallback from '../components/WebGLFallback'
import getDarkMapStyle, { FALLBACK_DARK_MAP_STYLE } from '../utils/mapStyle'

const categories = [
  { value: 'traffic', label: 'Traffic' },
  { value: 'construction', label: 'Construction' },
  { value: 'party', label: 'Party' },
  { value: 'unsafe', label: 'Unsafe' },
  { value: 'market', label: 'Market' },
  { value: 'wedding', label: 'Wedding' },
]

export default function ReportVibeWizard() {
  const navigate = useNavigate()
  const [webglAvailable] = useState(() => isWebGLSupported())
  const [mapStyleUrl, setMapStyleUrl] = useState(() => getDarkMapStyle())

  const handleMapError = (err) => {
    console.warn('[ReportVibe] Map style or tile loading warning:', err)
    if (mapStyleUrl !== FALLBACK_DARK_MAP_STYLE) {
      console.log('[ReportVibe] Falling back to CartoDB Dark Matter style')
      setMapStyleUrl(FALLBACK_DARK_MAP_STYLE)
    }
  }
  
  const [currentStep, setCurrentStep] = useState(1)
  const [category, setCategory] = useState('traffic')
  const [note, setNote] = useState('')
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [pinResult, setPinResult] = useState(null)
  
  const mapRef = useRef(null)
  const [viewState, setViewState] = useState({
    longitude: 3.3792,
    latitude: 6.5244,
    zoom: 13
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('vibemap_last_location')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.latitude && parsed.longitude) {
          setLat(parsed.latitude)
          setLng(parsed.longitude)
          setViewState(prev => ({ ...prev, longitude: parsed.longitude, latitude: parsed.latitude, zoom: 15 }))
        }
      } catch (err) {
        console.warn('Failed to parse last location', err)
      }
    }
  }, [])

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true)
      try {
        const proximity = { longitude: viewState.longitude, latitude: viewState.latitude }
        const results = await searchGeocoding(searchQuery, proximity)
        setSearchResults(results)
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setIsSearching(false)
      }
    }, 450)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery, viewState.longitude, viewState.latitude])

  const handleSelectResult = (result) => {
    if (!result) return
    const selLng = Number(result.longitude ?? (Array.isArray(result.coordinates) ? result.coordinates[0] : null) ?? result.lng)
    const selLat = Number(result.latitude ?? (Array.isArray(result.coordinates) ? result.coordinates[1] : null) ?? result.lat)

    if (isNaN(selLng) || isNaN(selLat) || selLng === 0 || selLat === 0) {
      console.warn('[ReportVibe] Invalid coordinates in search result:', result)
      return
    }

    setLat(selLat)
    setLng(selLng)
    setViewState(prev => ({
      ...prev,
      longitude: selLng,
      latitude: selLat,
      zoom: 16
    }))

    if (mapRef.current) {
      try {
        mapRef.current.flyTo({
          center: [selLng, selLat],
          zoom: 16,
          duration: 1200
        })
      } catch (flyErr) {
        console.warn('[ReportVibe] flyTo error:', flyErr)
      }
    }

    setSearchQuery(result.name || '')
    setSearchResults([])
    setSearchFocused(false)
  }

  const handleMapClick = (e) => {
    if (!e || !e.lngLat) return
    const { lng: clickLng, lat: clickLat } = e.lngLat
    const numLng = Number(clickLng)
    const numLat = Number(clickLat)
    if (!isNaN(numLng) && !isNaN(numLat)) {
      setLng(numLng)
      setLat(numLat)
    }
  }

  const handleSubmit = async () => {
    if (lat === null || lng === null) {
      setError('Please choose a location on the map')
      return
    }
    const numLat = Number(lat)
    const numLng = Number(lng)
    if (isNaN(numLat) || isNaN(numLng)) {
      setError('Invalid coordinates. Please tap a location on the map or search for an address.')
      return
    }

    setIsSending(true)
    setError('')
    setSuccessMessage('')
    try {
      const res = await createVibePin({
        category,
        note: note.trim() || undefined,
        lat: numLat,
        lng: numLng,
        source: 'user'
      })
      const newPin = res.data
      setPinResult(newPin)
      setSuccessMessage('Vibe reported successfully!')

      // Prepend to cached vibe pins immediately so it is instantly rendered on the map
      try {
        const cached = getCache('vibe_pins')
        const currentList = Array.isArray(cached) ? cached : (Array.isArray(cached?.data) ? cached.data : [])
        const updatedList = [newPin, ...currentList.filter(p => p.id !== newPin?.id)]
        setCache('vibe_pins', updatedList)
      } catch (_) {}

      setTimeout(() => navigate('/map', {
        state: {
          flyTo: { lat: numLat, lng: numLng },
          selectedVibeId: newPin?.id
        }
      }), 1000)
    } catch (err) {
      console.error('[ReportVibe] Submission error:', err)
      const detail = err?.response?.data?.detail
      const message = err?.response?.data?.message
      let errMsg = 'Failed to submit report. Please try again.'
      if (typeof detail === 'string') errMsg = detail
      else if (typeof message === 'string') errMsg = message
      else if (err?.code === 'ERR_NETWORK' || err?.message?.includes('Network Error')) {
        errMsg = 'Connection error: Could not reach the server. Please check your internet connection or try again in a few moments.'
      } else if (err?.message) {
        errMsg = err.message
      }
      setError(errMsg)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      width: '100%',
      maxWidth: '100vw',
      boxSizing: 'border-box',
      background: '#080810',
      color: '#fff',
      fontFamily: 'Inter, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Dynamic Header */}
      <div style={{
        padding: 'calc(16px + env(safe-area-inset-top, 0px)) 20px 16px',
        background: '#12121a',
        borderBottom: '1px solid rgba(148,163,184,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => {
              if (currentStep === 2) setCurrentStep(1)
              else navigate(-1)
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
            }}
            title="Back"
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </button>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
            }}>
              {currentStep === 1 ? 'Report a Vibe' : 'Select Location'}
            </h1>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Step {currentStep} of 2
            </div>
          </div>
        </div>

        {/* Step Indicator Badges */}
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{
            width: 24,
            height: 6,
            borderRadius: 3,
            background: currentStep >= 1 ? '#8b5cf6' : 'rgba(148,163,184,0.2)'
          }} />
          <div style={{
            width: 24,
            height: 6,
            borderRadius: 3,
            background: currentStep === 2 ? '#8b5cf6' : 'rgba(148,163,184,0.2)'
          }} />
        </div>
      </div>

      {currentStep === 1 ? (
        // --- STEP 1: CATEGORY & NOTE ---
        <div style={{
          flex: 1,
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          maxWidth: 520,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          overflowY: 'auto'
        }}>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
            What kind of vibe are you reporting? Share the details before selecting the exact location.
          </p>
          
          <div style={{ display: 'grid', gap: 20, flex: 1 }}>
            <label style={{ display: 'grid', gap: 8, fontSize: 13, fontWeight: 600 }}>
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: '1px solid rgba(148,163,184,0.25)',
                  background: '#12121a',
                  color: 'white',
                  fontSize: 15,
                  outline: 'none',
                }}
              >
                {categories.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 8, fontSize: 13, fontWeight: 600 }}>
              Note (optional)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={5}
                placeholder="Add some context for this vibe..."
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: '1px solid rgba(148,163,184,0.25)',
                  background: '#12121a',
                  color: 'white',
                  fontSize: 15,
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </label>
          </div>

          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => setCurrentStep(2)}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: 14,
                border: 'none',
                background: '#7c3aed',
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <span>Next: Choose Location</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        // --- STEP 2: MAP SELECTION ---
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: '400px' }}>
          
          {/* Search Bar Overlay */}
          <div style={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 10, maxWidth: 520, margin: '0 auto' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#12121a',
              border: '1px solid rgba(139,92,246,0.4)',
              borderRadius: '12px',
              padding: '12px 16px',
              gap: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <Search size={16} color="#8b5cf6" />
              <input
                placeholder="Search location to pin..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 220)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'white',
                  fontSize: 14,
                }}
              />
            </div>
            {searchFocused && (searchResults.length > 0 || isSearching) && (
              <div style={{
                marginTop: 8,
                background: '#12121a',
                border: '1px solid rgba(139,92,246,0.4)',
                borderRadius: 12,
                maxHeight: 200,
                overflowY: 'auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}>
                {isSearching ? (
                  <div style={{ padding: '12px', color: '#94a3b8', fontSize: 13 }}>Searching...</div>
                ) : (
                  searchResults.map(result => (
                    <div
                      key={result.id}
                      onClick={() => handleSelectResult(result)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        cursor: 'pointer',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <MapPin size={14} color="#8b5cf6" />
                      <span>{result.name}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div style={{ flex: 1, position: 'relative', minHeight: '400px' }}>
            {!webglAvailable ? (
              <WebGLFallback onRetry={() => window.location.reload()} />
            ) : (
            <Map
              ref={mapRef}
              mapLib={maplibregl}
              {...viewState}
              onMove={e => setViewState(e.viewState)}
              onClick={handleMapClick}
              onError={handleMapError}
              mapStyle={mapStyleUrl}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            >
              {lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && (
                <Marker longitude={Number(lng)} latitude={Number(lat)} anchor="bottom">
                  <div style={{
                    animation: 'fadeIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                  }}>
                    <MapPin size={34} color="#ec4899" fill="#ec4899" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))' }} />
                  </div>
                </Marker>
              )}
            </Map>
            )}
          </div>

          <div style={{
            padding: '20px 24px calc(20px + env(safe-area-inset-bottom, 0px))',
            background: '#080810',
            zIndex: 10
          }}>
            {error && <div style={{ color: '#f87171', fontSize: 13, paddingBottom: 16 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleSubmit}
                disabled={isSending || !lat || !lng}
                style={{
                  flex: 2,
                  padding: '16px',
                  borderRadius: 14,
                  border: 'none',
                  background: (isSending || !lat || !lng) ? 'rgba(124,58,237,0.5)' : '#7c3aed',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: (isSending || !lat || !lng) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Send size={15} />
                <span>{isSending ? 'Reporting...' : 'Report Vibe'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.8); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
