import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Search,
  MapPin,
  Check,
  Flame,
  Trash2,
  Navigation2,
  Sparkles,
  X
} from 'lucide-react';
import { getVibePins, confirmVibePin, deleteVibePin, getCurrentUser } from '../services/api';
import { reverseGeocode } from '../services/mapService';
import { getCache, setCache } from '../services/cacheService';
import BottomNav from '../components/BottomNav';
import styles from './VibeFeed.module.css';

export default function VibeFeed() {
  const navigate = useNavigate();
  const [vibes, setVibes] = useState(() => {
    const cached = getCache('vibe_pins');
    return Array.isArray(cached?.data) ? cached.data : [];
  });
  const [filteredVibes, setFilteredVibes] = useState(() => {
    const cached = getCache('vibe_pins');
    return Array.isArray(cached?.data) ? cached.data : [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(() => {
    const cached = getCache('vibe_pins');
    return !Array.isArray(cached?.data) || cached.data.length === 0;
  });
  const [locationNames, setLocationNames] = useState({});

  const [currentUserId, setCurrentUserId] = useState(() => {
    const cached = getCache('current_user');
    const uid = cached?.data?.id || cached?.id;
    if (uid) return String(uid);
    try {
      const token = localStorage.getItem('vibemap_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.sub || payload.user_id) return String(payload.sub || payload.user_id);
      }
    } catch (e) {}
    return null;
  });

  useEffect(() => {
    if (!currentUserId) {
      getCurrentUser()
        .then(res => {
          if (res?.data?.id) {
            setCurrentUserId(String(res.data.id));
            setCache('current_user', res.data);
          }
        })
        .catch(() => {});
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchVibes();
  }, []);

  const resolveLocations = (vibeList) => {
    if (!Array.isArray(vibeList)) return;
    vibeList.forEach(async (vibe) => {
      if (vibe.lat && vibe.lng) {
        try {
          const name = await reverseGeocode(vibe.lng, vibe.lat);
          setLocationNames(prev => ({ ...prev, [vibe.id]: name }));
        } catch (e) {
          // ignore
        }
      }
    });
  };

  const fetchVibes = async () => {
    // Resolve cached vibes locations immediately
    const cached = getCache('vibe_pins');
    if (cached?.data) {
      resolveLocations(cached.data);
    }

    try {
      const response = await getVibePins();
      const fetchedVibes = response.data || [];
      if (Array.isArray(fetchedVibes)) {
        setVibes(fetchedVibes);
        setFilteredVibes(fetchedVibes);
        setCache('vibe_pins', fetchedVibes);
        resolveLocations(fetchedVibes);
      }
    } catch (err) {
      console.warn('Failed to fetch fresh vibes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmVibe = async (e, vibeId) => {
    e.stopPropagation();
    try {
      const res = await confirmVibePin(vibeId);
      const newCount = res?.data?.confirmation_count;
      const isConfirmed = res?.data?.confirmed !== false;

      const updateList = (prev) =>
        (Array.isArray(prev) ? prev : []).map(v =>
          v.id === vibeId
            ? { ...v, confirmation_count: newCount ?? (v.confirmation_count || 1) + 1, user_confirmed: isConfirmed }
            : v
        );

      setVibes(updateList);
      setFilteredVibes(updateList);
      const cached = getCache('vibe_pins')?.data;
      if (cached) setCache('vibe_pins', updateList(cached));
    } catch (err) {
      console.error('Failed to confirm vibe in feed:', err);
    }
  };

  const handleDeleteVibe = async (e, vibeId) => {
    e.stopPropagation();
    const filterList = (prev) => (Array.isArray(prev) ? prev : []).filter(v => v.id !== vibeId);
    setVibes(filterList);
    setFilteredVibes(filterList);
    const cached = getCache('vibe_pins')?.data;
    if (cached) setCache('vibe_pins', filterList(cached));

    try {
      await deleteVibePin(vibeId);
    } catch (err) {
      console.error('Failed to delete vibe in feed:', err);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      if (!searchQuery.trim()) {
        setFilteredVibes(vibes);
        return;
      }
      
      const lowerQuery = searchQuery.toLowerCase();
      const filtered = vibes.filter(v => 
        (v.category && v.category.toLowerCase().includes(lowerQuery)) ||
        (v.note && v.note.toLowerCase().includes(lowerQuery))
      );
      setFilteredVibes(filtered);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery, vibes]);

  const getTimeElapsed = (dateString) => {
    if (!dateString) return 'Just now';
    const hasTimezone = typeof dateString === 'string' && (dateString.endsWith('Z') || /[+-]\d{2}(:\d{2})?$/.test(dateString));
    const normalized = hasTimezone ? dateString : `${dateString}Z`;
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return 'Just now';
    
    const diffInSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const handleTabChange = (tab) => {
    if (tab === 'map') navigate('/map');
    if (tab === 'family') navigate('/family');
    if (tab === 'vibes') navigate('/vibes');
    if (tab === 'profile') navigate('/profile');
  };

  return (
    <div className={styles.container} style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <button className={styles.backButton} onClick={() => navigate(-1)} title="Back" aria-label="Back">
            <ChevronLeft size={20} />
          </button>
          <h1 className={styles.title}>Vibe Explorer</h1>
        </div>
        <div className={styles.searchWrapper}>
          <Search size={16} color="#8b5cf6" className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search vibes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      <div className={styles.feed}>
        {isLoading ? (
          <div className={styles.emptyState}>
            <div>Loading vibes...</div>
          </div>
        ) : filteredVibes.length > 0 ? (
          filteredVibes.map((vibe) => {
            const isCreator = Boolean(currentUserId && (String(vibe.user_id || vibe.creator_id || '') === String(currentUserId)));
            return (
              <div 
                key={vibe.id} 
                className={styles.card}
                onClick={() => navigate('/map', { state: { flyTo: { lat: vibe.lat, lng: vibe.lng }, selectedVibeId: vibe.id } })}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.categoryTag}>{vibe.category}</span>
                  <span className={styles.timeElapsed}>{getTimeElapsed(vibe.created_at)}</span>
                </div>
                
                <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} color="#8b5cf6" />
                  <span>{locationNames[vibe.id] || 'Loading location...'}</span>
                </div>

                {vibe.note ? (
                  <div className={styles.note}>{vibe.note}</div>
                ) : (
                  <div className={styles.note} style={{ fontStyle: 'italic', opacity: 0.6 }}>No additional details provided.</div>
                )}

                {/* Card Action Controls: Confirm, Delete, and View on Map */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '12px',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(255,255,255,0.06)'
                }}>
                  {/* Confirm Button */}
                  <button
                    type="button"
                    onClick={(e) => handleConfirmVibe(e, vibe.id)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      background: vibe.user_confirmed ? 'rgba(16,185,129,0.2)' : 'rgba(139,92,246,0.15)',
                      border: `1px solid ${vibe.user_confirmed ? '#10b981' : 'rgba(139,92,246,0.4)'}`,
                      borderRadius: '8px',
                      color: vibe.user_confirmed ? '#34d399' : '#c4b5fd',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {vibe.user_confirmed ? <Check size={14} /> : <Flame size={14} />}
                    <span>{vibe.user_confirmed ? 'Confirmed' : 'Confirm'} ({vibe.confirmation_count || 1})</span>
                  </button>

                  {/* Delete Button (if creator) */}
                  {isCreator && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteVibe(e, vibe.id)}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(239,68,68,0.15)',
                        border: '1px solid #ef4444',
                        borderRadius: '8px',
                        color: '#f87171',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                      title="Delete your vibe report"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  )}

                  {/* View on Map Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/map', { state: { flyTo: { lat: vibe.lat, lng: vibe.lng } } });
                    }}
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(6,182,212,0.15)',
                      border: '1px solid rgba(6,182,212,0.4)',
                      borderRadius: '8px',
                      color: '#22d3ee',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                    title="View on Map"
                  >
                    <Navigation2 size={13} />
                    <span>Map</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon} style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <Sparkles size={36} color="#64748b" />
            </div>
            <div>No vibes found for this search.</div>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(139,92,246,0.5)',
                  color: '#c4b5fd',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginTop: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <X size={14} />
                <span>Clear Search</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Standardized Flush Bottom Navigation Bar */}
      <BottomNav activeTab="vibes" />
    </div>
  );
}
