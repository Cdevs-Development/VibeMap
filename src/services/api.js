import axios from 'axios'

// Intelligently resolve the API base URL for local dev, Render, PWA, and Capacitor
export const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  const PROD_BACKEND_URL = 'https://vibemap-backend-9q3z.onrender.com';

  // Check if we are running in a true local development browser (http://localhost or http://127.0.0.1)
  const isLocalDevBrowser =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    window.location.protocol === 'http:';

  let url = PROD_BACKEND_URL;

  if (envUrl && envUrl.trim() !== '') {
    const isEnvLocal = envUrl.includes('localhost') || envUrl.includes('127.0.0.1');
    if (!isEnvLocal || isLocalDevBrowser) {
      url = envUrl;
    }
  } else if (isLocalDevBrowser) {
    url = 'http://127.0.0.1:8000';
  } else if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('vibemap-backend')) {
      url = `https://${host}`;
    }
  }

  // Strip trailing slashes and ensure baseURL ends with /api/
  url = url.replace(/\/+$/, '');
  if (!url.endsWith('/api')) {
    url = `${url}/api`;
  }
  return `${url}/`;
};

const API = axios.create({
  baseURL: getBaseURL(),
  timeout: 12000, // 12-second timeout to prevent indefinite hangs
  headers: { 'Content-Type': 'application/json' }
})

// Auto-attach JWT token to every request and strip leading slashes so Axios resolves relative to /api baseURL
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('vibemap_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  
  if (config.url && config.url.startsWith('/')) {
    config.url = config.url.substring(1);
  }
  
  return config
})

// Global Response interceptor (401 & 429 Handling)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || ''
      // If an authenticated endpoint returns 401, clear stale token
      if (!url.includes('auth/login') && !url.includes('auth/google') && !url.includes('auth/register')) {
        const token = localStorage.getItem('vibemap_token')
        if (token) {
          localStorage.removeItem('vibemap_token')
          localStorage.removeItem('vibemap_has_sos_pin')
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('vibemap-auth-expired'))
          }
        }
      }
    }
    if (error.response && error.response.status === 429) {
      const toast = document.createElement('div');
      toast.textContent = 'Please wait and try again';
      toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(239,68,68,0.9);color:white;padding:12px 24px;border-radius:8px;z-index:9999;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);animation:fadeIn 0.3s;';
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => toast.remove(), 500);
      }, 3000);
    }
    return Promise.reject(error);
  }
)

import { enqueueOfflinePing, fetchWithSWR, setCache, getCache, registerOfflineSyncSender } from './cacheService'

// Auth
export const registerUser = (data) => API.post('/auth/register', data)
export const loginUser = (data) => API.post('/auth/login', data)
export const getCurrentUser = () => API.get('/auth/me')
export const getCurrentUserSWR = (options = {}) => fetchWithSWR('current_user', () => API.get('/auth/me'), options)
export const updateProfile = async (data) => {
  const res = await API.put('/auth/me', data);
  if (res.data) {
    const cached = getCache('current_user')?.data;
    setCache('current_user', { ...(cached || {}), ...res.data });
  }
  return res;
}
export const uploadAvatar = async (data) => {
  let res;
  if (data instanceof FormData) {
    res = await API.post('/users/me/avatar', data, {
      headers: { 'Content-Type': undefined }
    });
  } else if (typeof data === 'string') {
    res = await API.post('/users/me/avatar', { avatar_url: data });
  } else {
    res = await API.post('/users/me/avatar', data);
  }
  if (res?.data?.avatar_url) {
    const cached = getCache('current_user')?.data;
    if (cached) {
      setCache('current_user', { ...cached, avatar_url: res.data.avatar_url });
    }
  }
  return res;
}
export const deactivateAccount = () => API.delete('/auth/me')
export const setSOSPin = async (data) => {
  const res = await API.put('/auth/sos-pin', data);
  setCache('sos_pin_status', { has_sos_pin: true }, 1000 * 60 * 60 * 24 * 30);
  try {
    localStorage.setItem('vibemap_has_sos_pin', 'true');
  } catch (_) {}
  return res;
}
export const getSOSPinStatus = async () => {
  try {
    const res = await API.get('/auth/sos-pin/status');
    if (res?.data && typeof res.data.has_sos_pin === 'boolean') {
      setCache('sos_pin_status', res.data, 1000 * 60 * 60 * 24 * 30);
      try {
        localStorage.setItem('vibemap_has_sos_pin', String(res.data.has_sos_pin));
      } catch (_) {}
    }
    return res;
  } catch (err) {
    // If backend is sleeping/offline/times out, fall back to cached local storage
    try {
      const local = localStorage.getItem('vibemap_has_sos_pin');
      if (local !== null) {
        return { data: { has_sos_pin: local === 'true' }, fromCache: true };
      }
      const cached = getCache('sos_pin_status');
      if (cached?.data?.has_sos_pin !== undefined) {
        return { data: { has_sos_pin: !!cached.data.has_sos_pin }, fromCache: true };
      }
    } catch (_) {}
    throw err;
  }
}
export const getSOSPinStatusSWR = (options = {}) => fetchWithSWR('sos_pin_status', () => getSOSPinStatus(), options)

// Beneficiaries
export const getBeneficiaries = () => API.get('/beneficiaries/')
export const getBeneficiariesSWR = (options = {}) => fetchWithSWR('beneficiaries', () => API.get('/beneficiaries/'), options)
export const createBeneficiary = (data) => API.post('/beneficiaries/', data)
export const addBeneficiary = createBeneficiary // Alias for backwards compatibility
export const updateBeneficiary = (id, data) => API.put(`/beneficiaries/${id}`, data)
export const deleteBeneficiary = (id) => API.delete(`/beneficiaries/${id}`)
export const respondToBeneficiaryRequest = (id, data) => API.patch(`/beneficiaries/${id}/respond`, data)

// Standalone location update with automatic offline outbox fallback
export const updateUserLocation = async (data) => {
  try {
    return await API.put('/users/me/location', data);
  } catch (err) {
    if (typeof navigator !== 'undefined' && (!navigator.onLine || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error'))) {
      enqueueOfflinePing({ type: 'user_location', ...data });
    }
    throw err;
  }
}
registerOfflineSyncSender(updateUserLocation);

// Trips
export const startTrip = (data) => API.post('/trips/start', data)
export const getTrips = () => API.get('/trips/')
export const getTrip = (id) => API.get(`/trips/${id}`)
export const endTrip = (id) => API.post(`/trips/${id}/end`)
export const getPublicTrip = (token) => API.get(`/trips/public/${token}`)

// Location Pings with automatic offline outbox fallback
export const createLocationPing = async (data) => {
  try {
    return await API.post('/location-pings/', data);
  } catch (err) {
    if (typeof navigator !== 'undefined' && (!navigator.onLine || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error'))) {
      enqueueOfflinePing({ type: 'trip_ping', ...data });
    }
    throw err;
  }
}
export const getLocationHistory = (tripId) => API.get(`/location-pings/${tripId}`)

// SOS
export const triggerSOS = (data) => API.post('/sos/', data)
export const resolveSOS = (id, data) => API.post(`/sos/${id}/resolve`, data)
export const getMySOS = () => API.get('/sos/')

// Vibe Pins
export const getVibePins = (params) => API.get('/vibe-pins/', { params })
export const getVibePinsSWR = (params, options = {}) => fetchWithSWR('vibe_pins', () => API.get('/vibe-pins/', { params }), options)
export const createVibePin = (data) => API.post('/vibe-pins/', data)
export const confirmVibePin = (id) => API.post(`/vibe-pins/${id}/confirm`)
export const deleteVibePin = (id) => API.delete(`/vibe-pins/${id}`)

// Notifications
export const getNotifications = () => API.get('/notifications/')
export const getUnreadNotificationCount = () => API.get('/notifications/unread-count')
export const markNotificationAsRead = (id) => API.patch(`/notifications/${id}/read`)
export const markAllNotificationsAsRead = () => API.patch('/notifications/read-all')
export const clearAllNotifications = () => API.delete('/notifications/clear-all')
export const deleteNotification = (id) => API.delete(`/notifications/${id}`)

export default API