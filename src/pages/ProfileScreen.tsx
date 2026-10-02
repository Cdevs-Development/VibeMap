import React, { useState, useRef, useEffect, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  MapPin,
  Users,
  KeyRound,
  Pencil,
  Trash2,
  UserPlus,
  BookOpen,
  Download,
  LogOut,
  ChevronRight,
  Heart,
  Camera,
  Check,
  Lock,
  Sparkles,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react'
import {
  getCurrentUser,
  getBeneficiaries,
  getVibePins,
  createBeneficiary,
  updateBeneficiary,
  deleteBeneficiary,
  updateProfile,
  uploadAvatar,
  deactivateAccount,
  getSOSPinStatus,
  setSOSPin
} from '../services/api'
import BottomNav from '../components/BottomNav'
import { getCache, setCache } from '../services/cacheService'
import { normalizePhoneNumber, validatePhoneNumber, isValidEmail, isValidFullName } from '../utils/phone'
import {
  getLocationSharing,
  setLocationSharing,
  onLocationSharingChange
} from '../services/locationSharingState'
import { isAppInstalled } from '../services/pwaService'
import { Capacitor, registerPlugin } from '@capacitor/core'

const FullScreenIntentPermission = registerPlugin<any>('FullScreenIntentPermission')

async function ensureFullScreenIntentPermission() {
  if (Capacitor.getPlatform() !== 'android') return
  try {
    const { granted } = await FullScreenIntentPermission.checkPermission()
    if (!granted) {
      await FullScreenIntentPermission.requestPermission()
    }
  } catch (err) {
    console.warn('Full screen intent permission check failed:', err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Profile {
  id: string                // uuid (auth.users.id)
  name: string              // profiles.name / users.full_name
  phone: string             // profiles.phone / users.phone
  email?: string            // users.email
  avatar_url: string | null // profiles.avatar_url (storage URL)
  location_sharing: boolean // profiles.location_sharing
  sos_pin_set: boolean      // profiles.sos_pin_hash IS NOT NULL
  created_at: string        // profiles.created_at
}

interface Beneficiary {
  id: string
  name: string
  phone: string
  is_confirmed: boolean
  confirmation_token?: string | null
  confirmed_at?: string | null
  created_at: string
  user_id: string
}

interface VibePin {
  id: string
  user_id: string
  category: string
  lat: number
  lng: number
  note: string | null
  confirmation_count: number
  expires_at: string
  is_active: boolean
  source: string
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Style tokens (kept inline to match MapScreen.tsx convention)
// ─────────────────────────────────────────────────────────────────────────────
const card: CSSProperties = {
  background: 'rgba(18,18,26,0.85)',
  border: '1px solid rgba(139,92,246,0.25)',
  borderRadius: 16,
  backdropFilter: 'blur(20px)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
}

const spinnerStyle: CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: '50%',
  border: '2px solid rgba(255, 255, 255, 0.2)',
  borderTopColor: '#fff',
  animation: 'spin 1s linear infinite',
  display: 'inline-block',
}

const rowBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px',
  cursor: 'pointer',
  borderRadius: 12,
  transition: 'background 0.15s',
  color: '#e2e8f0',
  fontFamily: 'Inter, sans-serif',
  fontSize: 14,
}

function parseISODate(iso: string | Date): Date {
  if (!iso) return new Date()
  if (iso instanceof Date) return iso
  if (typeof iso === 'string') {
    const hasTimezone = iso.endsWith('Z') || /[+-]\d{2}(:\d{2})?$/.test(iso)
    return new Date(hasTimezone ? iso : `${iso}Z`)
  }
  return new Date(iso)
}

function formatRelative(iso: string | Date): string {
  const date = parseISODate(iso)
  const diff = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const categoryColor: Record<string, string> = {
  party: '#8b5cf6',
  market: '#06b6d4',
  unsafe: '#ef4444',
  traffic: '#f59e0b',
  construction: '#f59e0b',
  wedding: '#ec4899',
}

const categoryIcon: Record<string, string> = {
  party: '🎉',
  market: '🛒',
  unsafe: '⚠️',
  traffic: '🚗',
  construction: '🚧',
  wedding: '💒',
}

const profileStyles = `
  .profile-container {
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    margin: 0 auto;
    padding-bottom: 120px;
  }

  .profile-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
  }

  /* Hide scrollbar cleanly */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  @media (min-width: 768px) {
    .profile-container {
      max-width: 1024px;
      padding: 24px;
      padding-bottom: 120px;
    }
    
    .profile-grid {
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 24px;
      align-items: start;
    }
    
    .profile-identity,
    .profile-settings,
    .profile-safety,
    .profile-beneficiaries,
    .profile-account,
    .profile-danger-zone {
      grid-column: 1;
    }
    
    .profile-history {
      grid-column: 2;
      grid-row: 1 / span 10;
    }
  }

  /* Standardized Action Buttons */
  .btn-base {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 600;
    border-radius: 10px;
    cursor: pointer;
    min-height: 48px;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    transition: all 0.15s ease-in-out;
    outline: none;
    box-sizing: border-box;
  }
  
  .btn-base:active {
    transform: scale(0.95);
  }
  
  .btn-base:disabled {
    opacity: 0.5 !important;
    cursor: not-allowed !important;
    transform: none !important;
  }

  .btn-primary {
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
    border: none;
    color: #fff;
    font-weight: 700;
    box-shadow: 0 0 12px rgba(139,92,246,0.4);
    padding: 8px 16px;
  }
  
  .btn-ghost {
    background: rgba(139,92,246,0.1);
    border: 1px solid rgba(139,92,246,0.3);
    color: #a78bfa;
    padding: 8px 14px;
  }
  
  .btn-danger {
    background: linear-gradient(135deg, #ef4444, #b91c1c);
    border: none;
    color: #fff;
    font-weight: 700;
    box-shadow: 0 0 12px rgba(239,68,68,0.4);
    padding: 10px 18px;
  }

  .btn-danger-outline {
    background: transparent;
    border: 1px solid #ef4444;
    color: #ef4444;
    padding: 12px 16px;
    font-size: 14px;
  }
  
  .btn-danger-outline:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  @keyframes pinShineGlow {
    0%, 100% {
      box-shadow: 0 0 16px rgba(139, 92, 246, 0.4), 0 0 30px rgba(6, 182, 212, 0.25);
      border-color: rgba(139, 92, 246, 0.7);
    }
    50% {
      box-shadow: 0 0 28px rgba(139, 92, 246, 0.8), 0 0 50px rgba(6, 182, 212, 0.6);
      border-color: rgba(6, 182, 212, 0.9);
    }
  }

  @keyframes pinUrgentBanner {
    0%, 100% {
      border-color: rgba(239, 68, 68, 0.6);
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.3);
    }
    50% {
      border-color: rgba(239, 68, 68, 0.9);
      box-shadow: 0 0 32px rgba(239, 68, 68, 0.55);
    }
  }

  @keyframes pinShimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  .pin-shine-card {
    position: relative;
    border: 2px solid rgba(139, 92, 246, 0.7) !important;
    animation: pinShineGlow 2.5s infinite ease-in-out;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(6, 182, 212, 0.1)) !important;
    overflow: hidden;
  }

  .pin-shine-card::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent);
    background-size: 200% 100%;
    animation: pinShimmer 3s infinite linear;
    pointer-events: none;
  }
`

export default function ProfileScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const pinRequiredParam = searchParams.get('pin_required') === 'true'
  const fileRef = useRef<HTMLInputElement>(null)

  // Live profile and list states
  const [profile, setProfile] = useState<Profile | null>(null)
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [userPins, setUserPins] = useState<VibePin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Editing state
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [draft, setDraft] = useState({ name: '', phone: '', email: '' })
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // Profile update status states
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileUpdateError, setProfileUpdateError] = useState<string | null>(null)
  const [profileUpdateSuccess, setProfileUpdateSuccess] = useState(false)
  const [isSavingPin, setIsSavingPin] = useState(false)
  const [pinSaveError, setPinSaveError] = useState<string | null>(null)
  const [showPinSuccessModal, setShowPinSuccessModal] = useState(false)

  // Account deactivation states
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('')
  const [isDeactivating, setIsDeactivating] = useState(false)

  // Modal / toggle UI states
  const [showLocationWarning, setShowLocationWarning] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [pin, setPin] = useState('')

  // Beneficiaries CRUD states
  const [showAddEditModal, setShowAddEditModal] = useState(false)
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add')
  const [editingBeneficiaryId, setEditingBeneficiaryId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSavingBeneficiary, setIsSavingBeneficiary] = useState(false)

  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [deletingBeneficiary, setDeletingBeneficiary] = useState<Beneficiary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Installed app status
  const [appInstalled, setAppInstalled] = useState(isAppInstalled())
  useEffect(() => {
    const handleInstalled = () => setAppInstalled(true)
    window.addEventListener('vibemap-app-installed', handleInstalled)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('vibemap-app-installed', handleInstalled)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  // Event listener to open PIN modal from anywhere (e.g. BottomNav)
  useEffect(() => {
    const handlePrompt = () => setShowPinModal(true)
    window.addEventListener('vibemap-prompt-sos-pin', handlePrompt)
    return () => window.removeEventListener('vibemap-prompt-sos-pin', handlePrompt)
  }, [])

  // Auto trigger PIN modal if pin_required param is present
  useEffect(() => {
    if (pinRequiredParam) {
      setShowPinModal(true)
    }
  }, [pinRequiredParam])



  // Fetch all profile data with SWR (0ms instant render from cache + background refresh)
  const fetchData = async () => {
    // 1. Synchronously try loading from local cache for instant 0ms UI
    const cachedUser = getCache('current_user')
    const cachedBeneficiaries = getCache('beneficiaries')
    const cachedVibePins = getCache('vibe_pins')
    const cachedPinStatus = getCache('sos_pin_status')

    if (cachedUser?.data) {
      const uData = cachedUser.data
      const locSharing = getLocationSharing(uData.id)
      const avUrl = uData.id ? localStorage.getItem(`vibemap_${uData.id}_avatar`) || uData.avatar_url || null : null

      const initialProfile: Profile = {
        id: uData.id || '',
        name: uData.full_name || '',
        phone: uData.phone || '',
        email: uData.email || '',
        avatar_url: avUrl,
        location_sharing: locSharing,
        sos_pin_set: cachedPinStatus?.data?.has_sos_pin ?? false,
        created_at: uData.created_at || new Date().toISOString()
      }

      setProfile(initialProfile)
      setDraft({ name: initialProfile.name, phone: initialProfile.phone, email: initialProfile.email || '' })
      setAvatarPreview(initialProfile.avatar_url)
      setIsLoading(false)
    }

    if (cachedBeneficiaries?.data && Array.isArray(cachedBeneficiaries.data)) {
      setBeneficiaries(cachedBeneficiaries.data)
    }

    if (cachedVibePins?.data && Array.isArray(cachedVibePins.data) && cachedUser?.data?.id) {
      setUserPins(cachedVibePins.data.filter((p: any) => p.user_id === cachedUser.data.id))
    }

    // 2. Fetch fresh data in background
    try {
      const [userRes, beneficiariesRes, vibePinsRes, pinStatusRes] = await Promise.all([
        getCurrentUser(),
        getBeneficiaries(),
        getVibePins(),
        getSOSPinStatus()
      ])

      const userData = userRes?.data || {}
      setCache('current_user', userData)

      const rawBeneficiariesData = beneficiariesRes?.data
      const beneficiariesData = Array.isArray(rawBeneficiariesData)
        ? rawBeneficiariesData
        : (rawBeneficiariesData && Array.isArray(rawBeneficiariesData.data) ? rawBeneficiariesData.data : [])
      setCache('beneficiaries', beneficiariesData)

      const rawVibePinsData = vibePinsRes?.data
      const vibePinsData = Array.isArray(rawVibePinsData)
        ? rawVibePinsData
        : (rawVibePinsData && Array.isArray(rawVibePinsData.data) ? rawVibePinsData.data : [])
      setCache('vibe_pins', vibePinsData)

      const hasSOSPin = pinStatusRes?.data?.has_sos_pin ?? false
      setCache('sos_pin_status', { has_sos_pin: hasSOSPin })
      localStorage.setItem('vibemap_has_sos_pin', hasSOSPin ? 'true' : 'false')

      if (!hasSOSPin || pinRequiredParam) {
        setShowPinModal(true)
      }

      // Load persistent local settings from localStorage / state manager
      const locationSharing = getLocationSharing(userData.id)
      const avatarUrl = userData.id ? localStorage.getItem(`vibemap_${userData.id}_avatar`) || userData.avatar_url || null : null

      const mappedProfile: Profile = {
        id: userData.id || '',
        name: userData.full_name || '',
        phone: userData.phone || '',
        email: userData.email || '',
        avatar_url: avatarUrl,
        location_sharing: locationSharing,
        sos_pin_set: hasSOSPin,
        created_at: userData.created_at || new Date().toISOString()
      }

      setProfile(mappedProfile)
      setDraft({ name: mappedProfile.name, phone: mappedProfile.phone, email: mappedProfile.email || '' })
      setAvatarPreview(mappedProfile.avatar_url)
      setBeneficiaries(beneficiariesData)

      // Filter vibe pins created by this user
      const filteredPins = userData.id
        ? vibePinsData.filter((pin: any) => pin.user_id === userData.id)
        : []
      setUserPins(filteredPins)
      setError(null)
    } catch (err: any) {
      console.warn('Background profile refresh failed:', err)
      // If we don't have any cached profile, show the error
      if (!cachedUser?.data) {
        setError(err.response?.data?.detail || err.message || 'Failed to load profile details')
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Sync location sharing changes across tabs / components
  useEffect(() => {
    if (!profile?.id) return
    return onLocationSharingChange((enabled: boolean) => {
      setProfile(prev => prev ? { ...prev, location_sharing: enabled } : prev)
    })
  }, [profile?.id])

function compressImage(file: File, maxDim = 600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        let width = img.width
        let height = img.height
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(e.target?.result as string)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingAvatar(true)
    setAvatarUploadError(null)

    try {
      // 1. Instant client-side compression to lightweight JPEG
      const compressedDataUrl = await compressImage(file, 600, 0.85)
      setAvatarPreview(compressedDataUrl)
      if (profile) {
        setProfile(prev => prev ? { ...prev, avatar_url: compressedDataUrl } : null)
        localStorage.setItem(`vibemap_${profile.id}_avatar`, compressedDataUrl)
      }

      // 2. Upload permanent URL to backend DB
      const res = await uploadAvatar(compressedDataUrl)
      const permanentUrl = res?.data?.avatar_url || compressedDataUrl
      if (profile) {
        setProfile(prev => prev ? { ...prev, avatar_url: permanentUrl } : null)
        setAvatarPreview(permanentUrl)
        localStorage.setItem(`vibemap_${profile.id}_avatar`, permanentUrl)
        localStorage.setItem('vibemap_user_avatar', permanentUrl)
        window.dispatchEvent(new CustomEvent('vibemap-user-avatar-updated', { detail: { avatar_url: permanentUrl } }))
      }
    } catch (err: any) {
      console.error('Avatar upload failed:', err)
      const msg = err?.response?.data?.detail || err?.message || 'Failed to upload photo. Please try again.'
      setAvatarUploadError(msg)
    } finally {
      setIsUploadingAvatar(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!profile) return

    if (!isValidFullName(draft.name)) {
      setProfileUpdateError('Please enter a valid full name (at least 2 letters)')
      return
    }

    if (draft.email && !isValidEmail(draft.email)) {
      setProfileUpdateError('Please enter a valid email address')
      return
    }

    setIsSavingProfile(true)
    setProfileUpdateError(null)

    try {
      const activeAvatar = avatarPreview || profile.avatar_url || undefined
      await updateProfile({
        full_name: draft.name.trim(),
        email: draft.email.trim().toLowerCase(),
        avatar_url: activeAvatar
      })
      const updated = {
        ...profile,
        name: draft.name.trim(),
        phone: draft.phone,
        email: draft.email.trim().toLowerCase(),
        avatar_url: activeAvatar || null
      }
      setProfile(updated)
      if (activeAvatar) {
        localStorage.setItem(`vibemap_${profile.id}_avatar`, activeAvatar)
        localStorage.setItem('vibemap_user_avatar', activeAvatar)
        window.dispatchEvent(new CustomEvent('vibemap-user-avatar-updated', { detail: { avatar_url: activeAvatar } }))
      }
      setShowSettingsModal(false)
      setProfileUpdateSuccess(true)
      setTimeout(() => setProfileUpdateSuccess(false), 3000)
    } catch (err: any) {
      console.error('Failed to update profile:', err)
      setProfileUpdateError(err.response?.data?.detail || err.message || 'Failed to update profile')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleCancel = () => {
    if (!profile) return
    setDraft({ name: profile.name, phone: profile.phone, email: profile.email || '' })
    setAvatarPreview(profile.avatar_url)
    setShowSettingsModal(false)
  }

  const handleLocationToggle = async () => {
    if (!profile) return
    if (profile.location_sharing) {
      setShowLocationWarning(true) // warn before turning OFF
    } else {
      setProfile({ ...profile, location_sharing: true })
      await setLocationSharing(true, profile.id)
    }
  }

  const confirmDisableLocation = async () => {
    if (!profile) return
    setProfile({ ...profile, location_sharing: false })
    setShowLocationWarning(false)
    await setLocationSharing(false, profile.id)
  }

  const handlePinSave = async () => {
    if (pin.length !== 4 || !profile) return
    setIsSavingPin(true)
    setPinSaveError(null)

    try {
      await setSOSPin({ pin })
      await ensureFullScreenIntentPermission()
      setProfile({ ...profile, sos_pin_set: true })
      setCache('sos_pin_status', { has_sos_pin: true })
      localStorage.setItem('vibemap_has_sos_pin', 'true')
      window.dispatchEvent(new CustomEvent('vibemap-sos-pin-created'))
      setPin('')
      setShowPinModal(false)
      setShowPinSuccessModal(true)
      setTimeout(() => {
        setShowPinSuccessModal(false)
        navigate('/map', { replace: true })
      }, 1300)
    } catch (err: any) {
      console.error('Failed to save SOS PIN:', err)
      setPinSaveError(err.response?.data?.detail || err.message || 'Failed to save SOS PIN')
    } finally {
      setIsSavingPin(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('vibemap_token')
    localStorage.removeItem('vibemap_has_sos_pin')
    setShowLogoutModal(false)
    navigate('/login')
  }

  const isDeleteConfirmed = deleteConfirmationText.trim().toUpperCase() === 'DELETE'

  const handleDeactivateConfirm = async () => {
    if (!isDeleteConfirmed) return
    setIsDeactivating(true)
    try {
      await deactivateAccount()
      
      // Clear token, caches and all user-specific local settings
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('vibemap_')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k))
      sessionStorage.clear()
      
      // Reset local state
      setProfile(null)
      setBeneficiaries([])
      setUserPins([])
      setDeleteConfirmationText('')
      setShowDeleteModal(false)
      
      // Hard redirect to login screen
      window.location.href = '/login'
    } catch (err: any) {
      console.error('Failed to delete account:', err)
      alert(err.response?.data?.detail || err.message || 'Failed to delete account')
    } finally {
      setIsDeactivating(false)
    }
  }

  const handleTabChange = (tab: string) => {
    if (tab === 'map') navigate('/map')
    if (tab === 'family') navigate('/family')
    if (tab === 'vibes') navigate('/vibes')
    if (tab === 'profile') navigate('/profile')
  }

  // ── Beneficiaries CRUD Handlers ────────────────────
  const handleAddClick = () => {
    setFormMode('add')
    setEditingBeneficiaryId(null)
    setFormName('')
    setFormPhone('')
    setFormError(null)
    setShowAddEditModal(true)
  }

  const handleEditClick = (b: Beneficiary) => {
    setFormMode('edit')
    setEditingBeneficiaryId(b.id)
    setFormName(b.name)
    setFormPhone(b.phone)
    setFormError(null)
    setShowAddEditModal(true)
  }

  const handleDeleteClick = (b: Beneficiary) => {
    setDeletingBeneficiary(b)
    setShowDeleteConfirmModal(true)
  }

  const confirmDelete = async () => {
    if (!deletingBeneficiary) return
    setIsDeleting(true)
    try {
      await deleteBeneficiary(deletingBeneficiary.id)
      // Optimistic update of local state upon success
      setBeneficiaries(prev => prev.filter(item => item.id !== deletingBeneficiary.id))
      setShowDeleteConfirmModal(false)
      setDeletingBeneficiary(null)
      window.dispatchEvent(new CustomEvent('vibemap-beneficiaries-updated'))
    } catch (err: any) {
      console.error('Failed to delete beneficiary:', err)
      alert(err.response?.data?.detail || err.message || 'Failed to delete contact')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isValidFullName(formName)) {
      setFormError('Please enter a valid contact name (at least 2 letters)')
      return
    }

    const phoneVal = validatePhoneNumber(formPhone)
    if (!phoneVal.valid) {
      setFormError(phoneVal.error || 'Please enter a valid mobile number (e.g. 08012345678)')
      return
    }

    const normalizedPhone = normalizePhoneNumber(formPhone)
    setIsSavingBeneficiary(true)
    setFormError(null)
    try {
      if (formMode === 'add') {
        await createBeneficiary({ name: formName.trim(), phone: normalizedPhone })
        // Pull updated list to get database records with IDs
        const beneficiariesRes = await getBeneficiaries()
        const rawData = beneficiariesRes ? beneficiariesRes.data : null
        const bArray = Array.isArray(rawData) ? rawData : (rawData && Array.isArray(rawData.data) ? rawData.data : [])
        setBeneficiaries(bArray)
      } else {
        await updateBeneficiary(editingBeneficiaryId!, { name: formName.trim(), phone: normalizedPhone })
        // Optimistic update of local state
        setBeneficiaries(prev =>
          (Array.isArray(prev) ? prev : []).map(item =>
            item.id === editingBeneficiaryId
              ? { ...item, name: formName.trim(), phone: normalizedPhone }
              : item
          )
        )
      }
      setShowAddEditModal(false)
      window.dispatchEvent(new CustomEvent('vibemap-beneficiaries-updated'))
    } catch (err: any) {
      console.error('Failed to save beneficiary:', err)
      setFormError(err.response?.data?.detail || err.message || 'Failed to save contact')
    } finally {
      setIsSavingBeneficiary(false)
    }
  }

  // Loading indicator
  if (isLoading || !profile) {
    return (
      <div style={{
        height: '100dvh',
        background: '#080810',
        backgroundImage: 'radial-gradient(circle at 20% 0%, rgba(139,92,246,0.12), transparent 50%), radial-gradient(circle at 80% 100%, rgba(6,182,212,0.08), transparent 50%)',
        color: '#e2e8f0',
        fontFamily: 'Inter, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}>
        <div style={{
          width: 50,
          height: 50,
          borderRadius: '50%',
          border: '3px solid rgba(139, 92, 246, 0.2)',
          borderTopColor: '#8b5cf6',
          animation: 'spin 1s linear infinite',
        }} />
        <div style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>Loading profile...</div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  // Error boundary indicator
  if (error) {
    return (
      <div style={{
        height: '100dvh',
        background: '#080810',
        backgroundImage: 'radial-gradient(circle at 20% 0%, rgba(139,92,246,0.12), transparent 50%), radial-gradient(circle at 80% 100%, rgba(6,182,212,0.08), transparent 50%)',
        color: '#e2e8f0',
        fontFamily: 'Inter, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
      }}>
        <div style={{ ...card, padding: 32, maxWidth: 360, textAlign: 'center' }}>
          <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>⚠️</span>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>Connection Error</h3>
          <p style={{ fontSize: 14, color: '#ef4444', lineHeight: 1.5, margin: '0 0 24px' }}>
            {error}
          </p>
          <button onClick={fetchData} className="btn-base btn-primary select-none [-webkit-tap-highlight-color:transparent] touch-manipulation inline-flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">Retry</button>
        </div>
      </div>
    )
  }

  const initials = profile.name
    ? profile.name.split(' ').filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase()
    : '👤'

  return (
    <div style={{
      height: '100dvh',
      overflowY: 'auto',
      background: '#080810',
      backgroundImage: 'radial-gradient(circle at 20% 0%, rgba(139,92,246,0.12), transparent 50%), radial-gradient(circle at 80% 100%, rgba(6,182,212,0.08), transparent 50%)',
      color: '#e2e8f0',
      fontFamily: 'Inter, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxSizing: 'border-box',
    }}>
      <style>{profileStyles}</style>
      <div className="profile-container">
        {/* Header */}
        <div style={{ padding: 'calc(24px + env(safe-area-inset-top)) 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: -0.5,
            background: 'linear-gradient(135deg, #fff 0%, #8b5cf6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
          }}>Profile</h1>
          <button 
            onClick={() => {
              setDraft({ name: profile.name, phone: profile.phone, email: profile.email || '' });
              setAvatarPreview(profile.avatar_url);
              setProfileUpdateError(null);
              setProfileUpdateSuccess(false);
              setShowSettingsModal(true);
            }} 
            className="btn-base btn-ghost select-none [-webkit-tap-highlight-color:transparent] touch-manipulation inline-flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ gap: 6 }}
          >
            <Pencil size={14} />
            <span>Edit</span>
          </button>
        </div>

        {/* Urgent SOS PIN Setup Banner if PIN is not configured */}
        {!profile.sos_pin_set && (
          <div style={{ padding: '0 16px 16px', width: '100%', boxSizing: 'border-box' }}>
            <div
              style={{
                padding: '16px 18px',
                borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(139, 92, 246, 0.22))',
                border: '1.5px solid rgba(239, 68, 68, 0.6)',
                boxShadow: '0 0 25px rgba(239, 68, 68, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                animation: 'pinUrgentBanner 2.5s infinite ease-in-out',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <KeyRound size={20} color="#ef4444" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>Create Your SOS PIN</span>
                    <span style={{ fontSize: 10, background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: 6, fontWeight: 800 }}>MANDATORY</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4, lineHeight: 1.45 }}>
                    You cannot use live radar, navigate to the map, or send distress signals until you create your 4-digit SOS PIN.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPinModal(true)}
                className="btn-base btn-primary select-none [-webkit-tap-highlight-color:transparent] touch-manipulation inline-flex items-center justify-center transition-all duration-150 active:scale-95"
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #ef4444, #7c3aed)',
                  boxShadow: '0 0 16px rgba(239, 68, 68, 0.4)',
                  fontSize: 14,
                  fontWeight: 700,
                  gap: 8,
                  minHeight: 44,
                }}
              >
                <Lock size={16} />
                <span>Set Up SOS PIN Now</span>
              </button>
            </div>
          </div>
        )}

        <div className="profile-grid">
          {/* Identity card */}
          <div className="profile-identity">
            <div style={{ padding: '12px 16px' }}>
              <div style={{ ...card, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  onClick={() => !isUploadingAvatar && fileRef.current?.click()}
                  style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: (avatarPreview || profile.avatar_url) ? `url(${avatarPreview || profile.avatar_url}) center/cover` : 'linear-gradient(135deg,#8b5cf6,#06b6d4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, fontWeight: 700, color: '#fff',
                    boxShadow: '0 0 24px rgba(139,92,246,0.4)',
                    border: '2px solid rgba(139,92,246,0.5)',
                    flexShrink: 0,
                    cursor: isUploadingAvatar ? 'not-allowed' : 'pointer',
                    position: 'relative',
                    transition: 'transform 0.15s ease',
                  }}
                  title="Tap to change profile picture"
                >
                  {!(avatarPreview || profile.avatar_url) && initials}
                  {isUploadingAvatar && (
                    <div style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      background: 'rgba(8,8,16,0.65)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={spinnerStyle} />
                    </div>
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: '#7c3aed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid #080810',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                    }}
                  >
                    <Camera size={12} color="#fff" />
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</div>
                  <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 2 }}>{profile.phone}</div>
                  {profile.email && <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.email}</div>}
                  <div
                    onClick={() => !isUploadingAvatar && fileRef.current?.click()}
                    style={{ fontSize: 11, color: '#a78bfa', marginTop: 4, cursor: 'pointer', fontWeight: 600 }}
                  >
                    {isUploadingAvatar ? 'Uploading photo...' : 'Change profile picture'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Safety section */}
          <div className="profile-safety">
            <SectionLabel>Safety</SectionLabel>
            <div style={{ padding: '0 16px' }}>
              <div style={{ ...card, padding: 6 }}>
                <Row
                  icon={<MapPin size={18} color="#8b5cf6" />}
                  label="Location sharing"
                  sub={profile.location_sharing ? 'Beneficiaries can see your location' : 'Off — beneficiaries can\'t see you'}
                  right={<Toggle on={profile.location_sharing} onClick={handleLocationToggle} />}
                />
                <Divider />
                <Row
                  icon={<Users size={18} color="#8b5cf6" />}
                  label="Manage beneficiaries"
                  sub={`${beneficiaries.length} added`}
                  right={<Chevron />}
                  onClick={() => navigate('/beneficiaries')}
                />
                <Divider />
                <div className={!profile.sos_pin_set ? 'pin-shine-card' : ''} style={{ borderRadius: 10 }}>
                  <Row
                    icon={<KeyRound size={18} color={!profile.sos_pin_set ? "#f59e0b" : "#8b5cf6"} />}
                    label={!profile.sos_pin_set ? "🔒 SOS PIN (Setup Required)" : "SOS PIN"}
                    sub={profile.sos_pin_set ? '4-digit PIN set' : '⚠️ Action Required: Create your 4-digit PIN'}
                    labelColor={!profile.sos_pin_set ? "#fde047" : "#e2e8f0"}
                    right={
                      !profile.sos_pin_set ? (
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: 0.5,
                          boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }} />
                          REQUIRED
                        </span>
                      ) : (
                        <Chevron />
                      )
                    }
                    onClick={() => setShowPinModal(true)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Connected Beneficiaries Section */}
          <div className="profile-beneficiaries">
            <SectionLabel>Manage Family & Contacts</SectionLabel>
            <div style={{ padding: '0 16px' }}>
              <div style={{ ...card, padding: 8 }}>
                {beneficiaries.length === 0 ? (
                  <div style={{
                    padding: '24px 20px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12
                  }}>
                    <Users size={32} color="#64748b" />
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>No beneficiaries connected yet.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(Array.isArray(beneficiaries) ? beneficiaries : []).map((b, idx) => {
                      const bInitials = b.name
                        ? b.name.split(' ').filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase()
                        : '👤'
                      const statusColor = b.is_confirmed ? '#10b981' : '#f59e0b'
                      const statusText = b.is_confirmed ? 'Active' : 'Pending'

                      return (
                        <div key={b.id}>
                          {idx > 0 && <Divider />}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            boxSizing: 'border-box',
                          }}>
                            {/* Left: Info */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                              <div style={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                background: '#7c3aed',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 14,
                                fontWeight: 700,
                                color: '#fff',
                                border: '1.5px solid rgba(139,92,246,0.3)',
                                flexShrink: 0,
                              }}>
                                {bInitials}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {b.name}
                                </div>
                                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {b.phone}
                                </div>
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '1px 6px',
                                  borderRadius: 10,
                                  background: `${statusColor}15`,
                                  border: `1px solid ${statusColor}33`,
                                  marginTop: 4,
                                }}>
                                  <span style={{
                                    width: 4,
                                    height: 4,
                                    borderRadius: '50%',
                                    background: statusColor,
                                  }} />
                                  <span style={{
                                    fontSize: 8,
                                    fontWeight: 600,
                                    color: statusColor,
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5,
                                  }}>
                                    {statusText}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Right: Actions (Minimum 48x48px tap targets) */}
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                              <button
                                onClick={() => handleEditClick(b)}
                                aria-label="Edit beneficiary"
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: '50%',
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#a78bfa',
                                  outline: 'none',
                                  transition: 'background 0.2s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(b)}
                                aria-label="Delete beneficiary"
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: '50%',
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#ef4444',
                                  outline: 'none',
                                  transition: 'background 0.2s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add button inside the card, full width */}
                <button
                  onClick={handleAddClick}
                  style={{
                    width: '100%',
                    marginTop: beneficiaries.length > 0 ? 8 : 0,
                    background: 'rgba(139,92,246,0.12)',
                    border: '1px dashed rgba(139,92,246,0.5)',
                    color: '#c084fc',
                    borderRadius: 12,
                    padding: '14px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    minHeight: 48,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(139,92,246,0.22)'
                    e.currentTarget.style.border = '1px solid rgba(139,92,246,0.8)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(139,92,246,0.12)'
                    e.currentTarget.style.border = '1px dashed rgba(139,92,246,0.5)'
                  }}
                >
                  <UserPlus size={16} />
                  <span>Add Beneficiary</span>
                </button>
              </div>
            </div>
          </div>

          {/* History / Activity section */}
          <div className="profile-history">
            <SectionLabel>Activity</SectionLabel>
            <div style={{ padding: '0 16px' }}>
              <div style={{ ...card, padding: 16 }}>
                <h3 style={{
                  fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#fff',
                  margin: '0 0 16px 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Heart size={16} color="#c084fc" />
                    <span>Reported Vibes</span>
                  </span>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>{userPins.length} reports</span>
                </h3>

                {userPins.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}>
                    <Heart size={32} color="#64748b" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 13, fontWeight: 500 }}>No vibes reported yet.</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 4, lineHeight: 1.4 }}>
                      Pin unsafe areas, traffic, or events on the map to help others.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(Array.isArray(userPins) ? userPins : []).map(r => (
                      <div key={r.id} style={historyRow}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: `${categoryColor[r.category] ?? '#8b5cf6'}22`,
                          border: `1px solid ${categoryColor[r.category] ?? '#8b5cf6'}55`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                          flexShrink: 0,
                        }}>
                          {categoryIcon[r.category] ?? '💜'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.note || (r.category.charAt(0).toUpperCase() + r.category.slice(1))}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            {`Lat: ${Number(r.lat).toFixed(4)}, Lng: ${Number(r.lng).toFixed(4)}`}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', flexShrink: 0, alignSelf: 'flex-start', paddingTop: 2 }}>
                          {formatRelative(r.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Help & App Tools section */}
          <div className="profile-help-tools">
            <SectionLabel>Help & App Tools</SectionLabel>
            <div style={{ padding: '0 16px' }}>
              <div style={{ ...card, padding: 6 }}>
                <Row
                  icon={<BookOpen size={18} color="#8b5cf6" />}
                  label="App Walkthrough & Guide"
                  sub="How to use Live Map, SOS, Family Radar & Trips"
                  right={<Chevron />}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-vibemap-tour'))
                  }}
                />
                {!(typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform && (window as any).Capacitor.isNativePlatform())) && (
                  <>
                    <Divider />
                    <Row
                      icon={<Download size={18} color="#8b5cf6" />}
                      label="Download VibeMap APK (Android)"
                      sub="Download native Android APK for background radar & alerts"
                      right={<Chevron />}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('open-pwa-install'))
                      }}
                    />
                  </>
                )}

              </div>
            </div>
          </div>

          {/* Account section */}
          <div className="profile-account">
            <SectionLabel>Account</SectionLabel>
            <div style={{ padding: '0 16px' }}>
              <div style={{ ...card, padding: 6 }}>
                <Row
                  icon={<LogOut size={18} color="#ef4444" />}
                  label="Log out"
                  labelColor="#e2e8f0"
                  right={<Chevron />}
                  onClick={() => setShowLogoutModal(true)}
                />
              </div>
            </div>
          </div>

          {/* Danger Zone section */}
          <div className="profile-danger-zone">
            <SectionLabel>Danger Zone</SectionLabel>
            <div style={{ padding: '0 16px' }}>
              <div style={{
                ...card,
                padding: 20,
                border: '1px solid rgba(239, 68, 68, 0.4)',
                background: 'rgba(28, 10, 10, 0.6)'
              }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', margin: '0 0 8px' }}>Deactivate Account</h4>
                <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, margin: '0 0 16px' }}>
                  Permanently deactivate your VibeMap account. This action cannot be undone and will delete your emergency network.
                </p>
                <button
                  onClick={() => {
                    setDeleteConfirmationText('');
                    setShowDeleteModal(true);
                  }}
                  className="btn-base btn-danger-outline select-none [-webkit-tap-highlight-color:transparent] touch-manipulation inline-flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ width: '100%', gap: 6 }}
                >
                  <Trash2 size={15} />
                  <span>Deactivate Account</span>
                </button>
              </div>
              <div style={{ textAlign: 'center', padding: '20px 0 0', fontSize: 11, color: '#475569' }}>
                VibeMap v1.0 · Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Standardized Flush Bottom Navigation Bar ──────────────────────── */}
      <BottomNav activeTab="profile" />

      {/* Hidden Global File Input for Avatar Photo Picker */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleAvatarPick}
        disabled={isUploadingAvatar}
      />

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showLocationWarning && (
        <Modal title="Turn off location sharing?" onClose={() => setShowLocationWarning(false)}>
          <p style={modalText}>
            Your beneficiaries won't be able to see your location or respond quickly if you trigger an SOS.
            Continue at your own risk.
          </p>
          <div style={modalActions}>
            <button onClick={() => setShowLocationWarning(false)} className="btn-base btn-ghost select-none [-webkit-tap-highlight-color:transparent] touch-manipulation inline-flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">Keep on</button>
            <button onClick={confirmDisableLocation} className="btn-base btn-danger select-none [-webkit-tap-highlight-color:transparent] touch-manipulation inline-flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">Turn off</button>
          </div>
        </Modal>
      )}

      {showPinModal && (
        <Modal
          title={profile?.sos_pin_set ? "Change SOS PIN" : "🔒 Create Your SOS PIN"}
          onClose={() => {
            if (!profile?.sos_pin_set) {
              setPinSaveError('Creating an SOS PIN is mandatory to unlock VibeMap.')
              return
            }
            setShowPinModal(false)
            setPin('')
            setPinSaveError(null)
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(6,182,212,0.2))',
              border: '2px solid rgba(139,92,246,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              boxShadow: '0 0 20px rgba(139,92,246,0.3)',
            }}>
              <KeyRound size={26} color="#c084fc" />
            </div>
            <p style={{ ...modalText, fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
              {!profile?.sos_pin_set
                ? "Enter a 4-digit security PIN. You will need this PIN to verify identity, cancel emergency distress signals, and unlock all app features."
                : "Enter a new 4-digit PIN to update your emergency security code."
              }
            </p>
          </div>

          <div style={{ position: 'relative', margin: '14px 0 8px' }}>
            <input
              value={pin}
              onChange={e => {
                setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                setPinSaveError(null)
              }}
              placeholder="• • • •"
              inputMode="numeric"
              autoFocus
              style={{
                ...editInput,
                fontSize: 28,
                textAlign: 'center',
                letterSpacing: 16,
                padding: '14px 16px',
                fontWeight: 700,
                color: '#fff',
                borderColor: pin.length === 4 ? '#10b981' : (pinSaveError ? '#ef4444' : 'rgba(139,92,246,0.4)'),
                boxShadow: pin.length === 4 ? '0 0 16px rgba(16,185,129,0.3)' : 'none',
              }}
            />
          </div>

          {/* 4 Digit Status Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: i < pin.length ? '#8b5cf6' : 'rgba(255,255,255,0.15)',
                  boxShadow: i < pin.length ? '0 0 8px #8b5cf6' : 'none',
                  transition: 'all 0.15s ease',
                }}
              />
            ))}
          </div>

          {pinSaveError && (
            <div style={{
              color: '#ef4444',
              fontSize: 12,
              textAlign: 'center',
              marginBottom: 10,
              padding: '6px 10px',
              borderRadius: 8,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)'
            }}>
              ⚠️ {pinSaveError}
            </div>
          )}

          <div style={modalActions}>
            {profile?.sos_pin_set ? (
              <button
                type="button"
                onClick={() => { setShowPinModal(false); setPin(''); setPinSaveError(null); }}
                className="btn-base btn-ghost select-none [-webkit-tap-highlight-color:transparent] touch-manipulation inline-flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              onClick={handlePinSave}
              disabled={pin.length !== 4 || isSavingPin}
              className="btn-base btn-primary select-none [-webkit-tap-highlight-color:transparent] touch-manipulation inline-flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                width: profile?.sos_pin_set ? 'auto' : '100%',
                flex: profile?.sos_pin_set ? 1 : undefined,
                background: pin.length === 4 ? 'linear-gradient(135deg, #10b981, #059669)' : undefined,
                boxShadow: pin.length === 4 ? '0 0 16px rgba(16,185,129,0.4)' : undefined,
              }}
            >
              {isSavingPin ? 'Saving PIN...' : (profile?.sos_pin_set ? 'Save PIN' : 'Save PIN & Unlock App →')}
            </button>
          </div>
        </Modal>
      )}

      {/* SOS PIN Creation Success Celebration Toast */}
      {showPinSuccessModal && (
        <Modal title="🎉 Safety Network Unlocked" onClose={() => {}}>
          <div style={{ textAlign: 'center', padding: '12px 8px' }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.2))',
              border: '2px solid rgba(16,185,129,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 0 24px rgba(16,185,129,0.4)',
            }}>
              <CheckCircle2 size={36} color="#10b981" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>SOS PIN Created!</h3>
            <p style={{ ...modalText, fontSize: 13, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
              Your emergency security PIN is configured. Taking you to the live map now...
            </p>
          </div>
        </Modal>
      )}

      {showLogoutModal && (
        <Modal title="Log out?" onClose={() => setShowLogoutModal(false)}>
          <p style={modalText}>You'll need to sign in again to receive SOS alerts.</p>
          <div style={modalActions}>
            <button onClick={() => setShowLogoutModal(false)} className="btn-base btn-ghost select-none [-webkit-tap-highlight-color:transparent] touch-manipulation inline-flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
            <button onClick={handleLogout} className="btn-base btn-danger select-none [-webkit-tap-highlight-color:transparent] touch-manipulation inline-flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">Log out</button>
          </div>
        </Modal>
      )}

      {showDeleteModal && (
        <Modal title="Deactivate Account?" onClose={() => { setShowDeleteModal(false); setDeleteConfirmationText(''); }}>
          <p style={modalText}>
            <strong>Warning:</strong> This action is permanent and will delete your emergency network. Your profile, beneficiaries, vibe history, and active trips will be completely deactivated.
          </p>
          <p style={{ ...modalText, color: '#e2e8f0', fontWeight: 500, marginBottom: 8 }}>
            Type <strong>DELETE</strong> in the box below to confirm:
          </p>
          <input
            type="text"
            value={deleteConfirmationText}
            onChange={e => setDeleteConfirmationText(e.target.value)}
            placeholder="DELETE"
            style={{
              ...editInput,
              borderColor: isDeleteConfirmed ? '#ef4444' : 'rgba(239, 68, 68, 0.3)',
              fontSize: 14,
              padding: 12,
              marginBottom: 16,
              textTransform: 'uppercase',
              textAlign: 'center',
              letterSpacing: 1.5,
            }}
            disabled={isDeactivating}
          />
          <div style={modalActions}>
            <button
              onClick={() => { setShowDeleteModal(false); setDeleteConfirmationText(''); }}
              className="btn-base btn-ghost select-none [-webkit-tap-highlight-color:transparent] touch-manipulation inline-flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isDeactivating}
            >
              Cancel
            </button>
            <button
              onClick={handleDeactivateConfirm}
              disabled={!isDeleteConfirmed || isDeactivating}
              className="btn-base btn-danger select-none [-webkit-tap-highlight-color:transparent] touch-manipulation inline-flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeactivating ? 'Deleting Account...' : 'Confirm Delete Account'}
            </button>
          </div>
        </Modal>
      )}

      {showSettingsModal && (
        <Modal title="Account Settings" onClose={() => { setShowSettingsModal(false); setProfileUpdateError(null); }}>
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              await handleSave();
            }} 
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            {/* Avatar edit in modal */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ position: 'relative' }}>
                <div
                  onClick={() => !isUploadingAvatar && fileRef.current?.click()}
                  style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: avatarPreview ? `url(${avatarPreview}) center/cover` : 'linear-gradient(135deg,#8b5cf6,#06b6d4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, fontWeight: 700, color: '#fff',
                    boxShadow: '0 0 24px rgba(139,92,246,0.4)',
                    cursor: isUploadingAvatar ? 'not-allowed' : 'pointer',
                    border: '2px solid rgba(139,92,246,0.5)',
                    opacity: isUploadingAvatar ? 0.7 : 1,
                  }}
                >
                  {!avatarPreview && initials}
                </div>
                {/* Upload spinner overlay */}
                {isUploadingAvatar && (
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: 'rgba(8,8,16,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={spinnerStyle} />
                  </div>
                )}
                <div style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid #080810', cursor: isUploadingAvatar ? 'not-allowed' : 'pointer',
                }} onClick={() => !isUploadingAvatar && fileRef.current?.click()}>
                  <Camera size={14} color="#fff" />
                </div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarPick} disabled={isUploadingAvatar} />
              </div>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                {isUploadingAvatar ? 'Uploading...' : 'Tap photo to change'}
              </span>
              {avatarUploadError && (
                <div style={{ fontSize: 11, color: '#f59e0b', textAlign: 'center', maxWidth: 260, lineHeight: 1.4 }}>
                  ⚠️ {avatarUploadError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Full Name
              </label>
              <input
                type="text"
                value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
                placeholder="Full Name"
                style={editInput}
                disabled={isSavingProfile}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Email Address
              </label>
              <input
                type="email"
                value={draft.email}
                onChange={e => setDraft({ ...draft, email: e.target.value })}
                placeholder="email@example.com"
                style={editInput}
                disabled={isSavingProfile}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Phone Number (Read-only)
              </label>
              <input
                type="text"
                value={draft.phone}
                style={{ ...editInput, background: 'rgba(0,0,0,0.25)', color: '#64748b', border: '1px solid rgba(100,116,139,0.2)' }}
                disabled={true}
              />
              <span style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                Phone number is linked to your login credentials and cannot be changed.
              </span>
            </div>

            {profileUpdateError && (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                ⚠️ {profileUpdateError}
              </div>
            )}

            {profileUpdateSuccess && (
              <div style={{ fontSize: 12, color: '#10b981', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={14} />
                <span>Profile updated successfully!</span>
              </div>
            )}

            <div style={{ ...modalActions, marginTop: 10 }}>
              <button 
                type="button" 
                onClick={() => setShowSettingsModal(false)} 
                className="btn-base btn-ghost select-none [-webkit-tap-highlight-color:transparent] touch-manipulation inline-flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSavingProfile}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-base btn-primary select-none [-webkit-tap-highlight-color:transparent] touch-manipulation inline-flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSavingProfile}
              >
                {isSavingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Beneficiary Custom Modal */}
      {showDeleteConfirmModal && deletingBeneficiary && (
        <Modal 
          title="Remove Contact?" 
          onClose={() => { setShowDeleteConfirmModal(false); setDeletingBeneficiary(null); }}
        >
          <p style={modalText}>
            Are you sure you want to remove <strong>{deletingBeneficiary.name}</strong> from your emergency contacts?
          </p>
          <div style={modalActions}>
            <button 
              onClick={() => { setShowDeleteConfirmModal(false); setDeletingBeneficiary(null); }} 
              className="btn-base btn-ghost select-none [-webkit-tap-highlight-color:transparent] touch-manipulation inline-flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button 
              onClick={confirmDelete} 
              className="btn-base btn-danger select-none [-webkit-tap-highlight-color:transparent] touch-manipulation inline-flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isDeleting}
            >
              {isDeleting ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </Modal>
      )}

      {/* Add / Edit Beneficiary Modal Form */}
      {showAddEditModal && (
        <Modal 
          title={formMode === 'add' ? 'Add Contact' : 'Edit Contact'} 
          onClose={() => setShowAddEditModal(false)}
        >
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Full Name"
                style={editInput}
                disabled={isSavingBeneficiary}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Phone Number
              </label>
              <input
                type="tel"
                value={formPhone}
                onChange={e => setFormPhone(e.target.value)}
                placeholder="e.g., 0803 123 4567"
                style={editInput}
                disabled={isSavingBeneficiary}
              />
            </div>

            {formError && (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                ⚠️ {formError}
              </div>
            )}

            <div style={{ ...modalActions, marginTop: 10 }}>
              <button 
                type="button"
                onClick={() => setShowAddEditModal(false)} 
                className="btn-base btn-ghost select-none [-webkit-tap-highlight-color:transparent] touch-manipulation inline-flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSavingBeneficiary}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-base btn-primary select-none [-webkit-tap-highlight-color:transparent] touch-manipulation inline-flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSavingBeneficiary}
              >
                {isSavingBeneficiary ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Small presentational helpers
// ─────────────────────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '20px 24px 8px', fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
      textTransform: 'uppercase', color: '#64748b',
    }}>{children}</div>
  )
}

function Row({ icon, label, sub, right, onClick, labelColor = '#e2e8f0' }: {
  icon: React.ReactNode; label: string; sub?: string; right?: React.ReactNode; onClick?: () => void; labelColor?: string
}) {
  return (
    <div
      onClick={onClick}
      style={{ ...rowBase, cursor: onClick ? 'pointer' : 'default' }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'rgba(139,92,246,0.06)' }}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
        }}>{icon}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: labelColor }}>{label}</div>
          {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(139,92,246,0.1)', margin: '0 16px' }} />
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className="select-none [-webkit-tap-highlight-color:transparent] touch-manipulation"
      style={{
        width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
        background: on ? '#7c3aed' : 'rgba(100,116,139,0.3)',
        boxShadow: on ? '0 0 12px rgba(124,58,237,0.5)' : 'none',
        position: 'relative', transition: 'all 0.2s',
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: on ? 21 : 3, transition: 'left 0.2s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

function Chevron({ color = '#64748b' }: { color?: string }) {
  return <ChevronRight size={16} color={color} />
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      animation: 'fadeIn 0.2s ease-out',
      padding: 16,
      boxSizing: 'border-box',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480,
        background: 'rgba(18,18,26,0.98)',
        border: '1px solid rgba(139,92,246,0.3)',
        borderRadius: 20,
        padding: 24, color: '#e2e8f0',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        boxSizing: 'border-box',
      }}>
        <h3 style={{
          fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif", fontSize: 20, fontWeight: 700, margin: '0 0 12px', color: '#fff',
        }}>{title}</h3>
        {children}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline style constants
// ─────────────────────────────────────────────────────────────────────────────
const ghostBtn: CSSProperties = {
  background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)',
  color: '#a78bfa', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'Inter, sans-serif', minHeight: 48,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
const primaryBtn: CSSProperties = {
  background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', border: 'none',
  color: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', boxShadow: '0 0 12px rgba(139,92,246,0.4)', fontFamily: 'Inter, sans-serif', minHeight: 48,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
const dangerBtn: CSSProperties = {
  background: 'linear-gradient(135deg, #ef4444, #b91c1c)', border: 'none',
  color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700,
  cursor: 'pointer', boxShadow: '0 0 12px rgba(239,68,68,0.4)', fontFamily: 'Inter, sans-serif', minHeight: 48,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
const editInput: CSSProperties = {
  width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(139,92,246,0.3)',
  borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 14,
  fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
}
const historyRow: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px',
}
const modalText: CSSProperties = {
  fontSize: 14, color: '#94a3b8', lineHeight: 1.5, margin: '0 0 20px',
}
const modalActions: CSSProperties = {
  display: 'flex', gap: 10, justifyContent: 'flex-end',
}
