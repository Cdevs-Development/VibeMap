import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  Trash2,
  X,
  Shield,
  Check,
  Sparkles,
  UserCheck,
  UserX,
  AlertTriangle
} from 'lucide-react';
import API, { clearAllNotifications, deleteNotification } from '../services/api';
import { playNotificationSound } from '../utils/audio';
import { dispatchBeneficiaryRequestNotification } from '../services/sosAlertService';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [processingIds, setProcessingIds] = useState([]);
  const [isClearing, setIsClearing] = useState(false);

  // Urgent popup state
  const [urgentRequest, setUrgentRequest] = useState(null);
  const seenRequestIdsRef = useRef(new Set());
  const prevUnreadCountRef = useRef(0);
  const isPollingRef = useRef(false);

  // Persistent tracking of responded request IDs to avoid re-prompting or duplicate submissions
  const getRespondedRequestIds = useCallback(() => {
    try {
      const saved = localStorage.getItem('vibemap_responded_requests');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (_) {
      return new Set();
    }
  }, []);

  const addRespondedRequestId = useCallback((id) => {
    if (!id) return;
    try {
      const current = getRespondedRequestIds();
      current.add(id);
      localStorage.setItem('vibemap_responded_requests', JSON.stringify([...current]));
    } catch (_) {}
  }, [getRespondedRequestIds]);

  const toast = {
    success: (msg) => {
      const el = document.createElement('div');
      el.textContent = `✅ ${msg}`;
      el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(16,185,129,0.95);color:white;padding:12px 24px;border-radius:8px;z-index:9999;font-family:Inter,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
      document.body.appendChild(el);
      setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.5s'; setTimeout(() => el.remove(), 500); }, 3000);
    },
    error: (msg) => {
      const el = document.createElement('div');
      el.textContent = `❌ ${msg}`;
      el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(239,68,68,0.95);color:white;padding:12px 24px;border-radius:8px;z-index:9999;font-family:Inter,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
      document.body.appendChild(el);
      setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.5s'; setTimeout(() => el.remove(), 500); }, 3000);
    }
  };

  const fetchNotificationsData = useCallback(async (isInitial = false) => {
    const token = localStorage.getItem('vibemap_token');
    if (!token || isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      if (isInitial) setLoading(true);
      const [feedRes, countRes] = await Promise.all([
        API.get('/notifications/'),
        API.get('/notifications/unread-count')
      ]);

      const data = Array.isArray(feedRes.data) ? feedRes.data : [];
      setNotifications(data);

      const newCount = countRes.data?.unread_count || 0;
      setUnreadCount(newCount);

      // Play sound if new unread notification arrived
      if (!isInitial && newCount > prevUnreadCountRef.current) {
        playNotificationSound();
      }
      prevUnreadCountRef.current = newCount;

      // Detect new unread beneficiary requests that have NOT been responded to yet
      const respondedSet = getRespondedRequestIds();
      const pendingRequests = data.filter(
        n => n.notification_type === 'beneficiary_request' &&
             !n.is_read &&
             !respondedSet.has(n.id) &&
             (!n.related_entity_id || !respondedSet.has(n.related_entity_id))
      );

      for (const req of pendingRequests) {
        if (!seenRequestIdsRef.current.has(req.id)) {
          seenRequestIdsRef.current.add(req.id);
          if (!isInitial) {
            playNotificationSound();
            setUrgentRequest(req);
            dispatchBeneficiaryRequestNotification(req.title || 'Someone', req.related_entity_id, req.id);
          }
        }
      }

      if (isInitial) {
        pendingRequests.forEach(req => seenRequestIdsRef.current.add(req.id));
      }
    } catch (error) {
      console.warn('Error fetching notifications (non-critical):', error);
    } finally {
      if (isInitial) setLoading(false);
      isPollingRef.current = false;
    }
  }, [getRespondedRequestIds]);

  // Adaptive rapid polling: 4s foreground, 15s background, with focus / visibility triggers
  useEffect(() => {
    fetchNotificationsData(true);

    let pollTimer = null;
    const scheduleNextPoll = () => {
      const isVisible = typeof document !== 'undefined' ? !document.hidden : true;
      const delay = isVisible ? 4000 : 15000;
      pollTimer = setTimeout(async () => {
        await fetchNotificationsData(false);
        scheduleNextPoll();
      }, delay);
    };

    scheduleNextPoll();

    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        clearTimeout(pollTimer);
        fetchNotificationsData(false);
        scheduleNextPoll();
      }
    };

    const handleCustomRefresh = () => {
      fetchNotificationsData(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('vibemap-refresh-notifications', handleCustomRefresh);

    return () => {
      clearTimeout(pollTimer);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('vibemap-refresh-notifications', handleCustomRefresh);
    };
  }, [fetchNotificationsData]);

  const markAsRead = async (id) => {
    try {
      await API.patch(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === id ? { ...notif, is_read: true } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      prevUnreadCountRef.current = Math.max(0, prevUnreadCountRef.current - 1);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    setIsClearing(true);
    try {
      await clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
      prevUnreadCountRef.current = 0;
      toast.success('All notifications cleared');
    } catch (err) {
      console.error('Error clearing notifications:', err);
      // Optimistic local clear
      setNotifications([]);
      setUnreadCount(0);
      prevUnreadCountRef.current = 0;
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteOne = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
      prevUnreadCountRef.current = Math.max(0, prevUnreadCountRef.current - 1);
    } catch (err) {
      console.error('Error deleting notification:', err);
      setNotifications(prev => prev.filter(n => n.id !== id));
    }
  };

  const handleBeneficiaryResponse = async (notificationId, beneficiaryId, action) => {
    setProcessingIds(prev => [...prev, notificationId]);
    addRespondedRequestId(notificationId);
    if (beneficiaryId) addRespondedRequestId(beneficiaryId);

    try {
      const res = await API.patch(`/beneficiaries/${beneficiaryId}/respond`, { action });
      await API.patch(`/notifications/${notificationId}/read`).catch(() => {});

      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      prevUnreadCountRef.current = Math.max(0, prevUnreadCountRef.current - 1);

      if (res?.data?.already_processed) {
        toast.success(action === 'accept' ? 'Beneficiary request accepted' : 'Beneficiary request declined');
      } else {
        toast.success(action === 'accept' ? 'Beneficiary request accepted' : 'Beneficiary request declined');
      }

      if (urgentRequest?.id === notificationId) {
        setUrgentRequest(null);
      }

      // Notify other views (like FamilyMap and ManageBeneficiaries) to re-sync
      window.dispatchEvent(new CustomEvent('vibemap-beneficiaries-updated'));
    } catch (error) {
      console.error(`Error ${action}ing beneficiary:`, error);
      if (error?.response?.status === 409 || error?.response?.data?.already_processed) {
        toast.success(action === 'accept' ? 'Beneficiary request accepted' : 'Beneficiary request processed');
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId ? { ...notif, is_read: true } : notif
          )
        );
        if (urgentRequest?.id === notificationId) setUrgentRequest(null);
      } else {
        toast.error(`Failed to ${action} request`);
      }
    } finally {
      setProcessingIds(prev => prev.filter(id => id !== notificationId));
    }
  };

  const handleDismissUrgent = async () => {
    if (urgentRequest) {
      addRespondedRequestId(urgentRequest.id);
      if (urgentRequest.related_entity_id) addRespondedRequestId(urgentRequest.related_entity_id);
      await markAsRead(urgentRequest.id);
    }
    setUrgentRequest(null);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'beneficiary_removed':
        return <UserX size={16} color="#ef4444" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />;
      case 'beneficiary_request_accepted':
        return <UserCheck size={16} color="#10b981" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />;
      case 'beneficiary_request_declined':
        return <X size={16} color="#ef4444" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />;
      case 'beneficiary_request':
        return <Shield size={16} color="#8b5cf6" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />;
      case 'sos_alert':
        return <AlertTriangle size={16} color="#ef4444" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />;
      default:
        return <Bell size={16} color="#8b5cf6" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />;
    }
  };

  return (
    <>
      <style>{`
        .notification-wrapper {
          position: fixed;
          top: calc(16px + env(safe-area-inset-top, 0px));
          right: 16px;
          z-index: 40;
          font-family: 'Inter', sans-serif;
        }

        .bell-button {
          position: relative;
          background: rgba(18, 18, 26, 0.9);
          border: 1px solid rgba(139,92,246,0.5);
          border-radius: 50%;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          transition: transform 0.2s, background 0.2s;
          outline: none;
        }

        .bell-button:hover {
          background: rgba(139,92,246,0.2);
          transform: scale(1.05);
        }

        .bell-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: #ef4444;
          color: white;
          font-size: 11px;
          font-weight: bold;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .notification-panel {
          position: absolute;
          background: rgba(8, 8, 16, 0.96);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          color: #fff;
          border: 1px solid rgba(139,92,246,0.3);
          border-radius: 16px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.6);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          opacity: 0;
          visibility: hidden;
          transform: translateY(-10px) scale(0.95);
          transform-origin: top right;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .notification-panel.open {
          opacity: 1;
          visibility: visible;
          transform: translateY(0) scale(1);
        }

        @media (max-width: 639px) {
          .notification-wrapper {
            top: calc(10px + env(safe-area-inset-top, 0px));
            right: 10px;
          }
          .notification-panel {
            position: fixed;
            top: 70px;
            left: 12px;
            right: 12px;
            bottom: auto;
            max-height: calc(100dvh - 150px);
            width: auto;
          }
        }

        @media (min-width: 640px) {
          .notification-panel {
            top: 54px;
            right: 0;
            width: 380px;
            max-height: 480px;
          }
        }

        .panel-header {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(139,92,246,0.2);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(18, 18, 26, 0.6);
        }

        .panel-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
          letter-spacing: -0.3px;
        }

        .clear-all-btn {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
          font-size: 12px;
          font-weight: 600;
          padding: 5px 10px;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s;
        }

        .clear-all-btn:hover {
          background: rgba(239, 68, 68, 0.3);
          color: #fff;
        }

        .panel-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .panel-body::-webkit-scrollbar {
          width: 6px;
        }
        .panel-body::-webkit-scrollbar-track {
          background: transparent;
        }
        .panel-body::-webkit-scrollbar-thumb {
          background: rgba(139,92,246,0.3);
          border-radius: 4px;
        }

        .notification-card {
          padding: 14px 16px;
          border-radius: 12px;
          cursor: pointer;
          position: relative;
          transition: background 0.2s, transform 0.1s;
          border: 1px solid rgba(139,92,246,0.15);
        }

        .notification-card:hover {
          transform: translateY(-1px);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .card-title {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .card-time {
          font-size: 11px;
          color: #64748b;
        }

        .card-delete-btn {
          background: transparent;
          border: none;
          color: #64748b;
          font-size: 14px;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: 6px;
          transition: color 0.15s, background 0.15s;
        }

        .card-delete-btn:hover {
          color: #ef4444;
          background: rgba(239,68,68,0.1);
        }

        .card-message {
          margin: 0;
          font-size: 13px;
          color: #94a3b8;
          line-height: 1.5;
        }

        .actions-row {
          display: flex;
          gap: 10px;
          margin-top: 12px;
        }

        .btn-accept {
          flex: 1;
          padding: 8px 0;
          background: #10b981;
          color: #fff;
          font-weight: 600;
          font-size: 13px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .btn-decline {
          flex: 1;
          padding: 8px 0;
          background: rgba(239,68,68,0.2);
          color: #ef4444;
          border: 1px solid rgba(239,68,68,0.4);
          font-weight: 600;
          font-size: 13px;
          border-radius: 8px;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .loading-state, .empty-state {
          text-align: center;
          color: #64748b;
          font-size: 14px;
          padding: 32px 16px;
        }

        @keyframes urgentPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes urgentFadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* ─── URGENT POPUP ─── */}
      {urgentRequest && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 20, fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{
            background: 'rgba(18,18,26,0.98)', border: '1px solid rgba(139,92,246,0.5)',
            borderRadius: 20, padding: '32px 24px', width: '100%', maxWidth: 380,
            textAlign: 'center', animation: 'urgentFadeIn 0.3s ease-out',
            boxShadow: '0 0 40px rgba(139,92,246,0.3)',
          }}>
            <Shield size={44} color="#8b5cf6" style={{ margin: '0 auto 8px', animation: 'urgentPulse 1.5s ease-in-out infinite' }} />
            <h3 style={{
              color: 'white', fontSize: 20, fontWeight: 700, margin: '12px 0 8px',
              fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
            }}>
              Someone wants you to be their beneficiary
            </h3>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 8px', lineHeight: 1.6 }}>
              {urgentRequest.message || 'A new beneficiary request needs your attention.'}
            </p>
            <p style={{ color: '#64748b', fontSize: 11, marginBottom: 24 }}>
              {new Date(urgentRequest.created_at).toLocaleString()}
            </p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <button
                disabled={processingIds.includes(urgentRequest.id)}
                onClick={() => handleBeneficiaryResponse(urgentRequest.id, urgentRequest.related_entity_id, 'accept')}
                style={{
                  flex: 1, padding: '14px', background: '#10b981',
                  border: 'none', borderRadius: 12, color: 'white',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', minHeight: 48,
                  opacity: processingIds.includes(urgentRequest.id) ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Check size={16} />
                <span>{processingIds.includes(urgentRequest.id) ? 'Processing...' : 'Accept'}</span>
              </button>
              <button
                disabled={processingIds.includes(urgentRequest.id)}
                onClick={() => handleBeneficiaryResponse(urgentRequest.id, urgentRequest.related_entity_id, 'decline')}
                style={{
                  flex: 1, padding: '14px',
                  background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)',
                  borderRadius: 12, color: '#ef4444', fontSize: 15, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif', minHeight: 48,
                  opacity: processingIds.includes(urgentRequest.id) ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <X size={16} />
                <span>{processingIds.includes(urgentRequest.id) ? 'Processing...' : 'Decline'}</span>
              </button>
            </div>

            <button
              onClick={handleDismissUrgent}
              style={{
                background: 'transparent', border: 'none', color: '#64748b',
                fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                padding: '8px', textDecoration: 'underline',
              }}
            >
              Decide later
            </button>
          </div>
        </div>
      )}

      {/* ─── BELL + DROPDOWN ─── */}
      <div className="notification-wrapper">
        <button
          className="bell-button"
          onClick={() => {
            if (!isOpen && unreadCount > 0) {
              playNotificationSound();
            }
            setIsOpen(!isOpen);
          }}
          aria-label="Notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 && <span className="bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>

        <div className={`notification-panel ${isOpen ? 'open' : ''}`}>
          <div className="panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 className="panel-title">Notifications</h2>
              {unreadCount > 0 && (
                <span style={{
                  background: '#7c3aed',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '600',
                }}>
                  {unreadCount} new
                </span>
              )}
            </div>

            {notifications.length > 0 && (
              <button
                className="clear-all-btn"
                onClick={handleClearAll}
                disabled={isClearing}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <Trash2 size={12} />
                <span>{isClearing ? 'Clearing...' : 'Clear All'}</span>
              </button>
            )}
          </div>

          <div className="panel-body">
            {loading ? (
              <div className="loading-state">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="empty-state">
                <Sparkles size={24} color="#8b5cf6" style={{ margin: '0 auto 8px' }} />
                No notifications right now.
              </div>
            ) : (
              notifications.map(notification => {
                const isUnread = !notification.is_read;
                const isBeneficiaryRequest = notification.notification_type === 'beneficiary_request';
                const isRemoved = notification.notification_type === 'beneficiary_removed';
                const icon = getNotificationIcon(notification.notification_type);
                const respondedSet = getRespondedRequestIds();
                const isAlreadyResponded = Boolean(
                  notification.is_read ||
                  respondedSet.has(notification.id) ||
                  (notification.related_entity_id && respondedSet.has(notification.related_entity_id))
                );

                return (
                  <div
                    key={notification.id}
                    className="notification-card"
                    style={{
                      borderLeft: isRemoved
                        ? '4px solid #ef4444'
                        : isUnread
                          ? '4px solid #7c3aed'
                          : '4px solid transparent',
                      background: isRemoved
                        ? 'rgba(239,68,68,0.08)'
                        : isUnread
                          ? 'rgba(124,58,237,0.08)'
                          : 'rgba(18,18,26,0.9)',
                    }}
                    onClick={() => isUnread && markAsRead(notification.id)}
                  >
                    <div className="card-header">
                      <h4 className="card-title" style={{ color: isRemoved ? '#f87171' : isUnread ? '#fff' : '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {icon} <span>{notification.title}</span>
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="card-time">
                          {new Date(notification.created_at).toLocaleDateString()}
                        </span>
                        <button
                          className="card-delete-btn"
                          title="Delete notification"
                          onClick={(e) => handleDeleteOne(e, notification.id)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>

                    <p className="card-message">{notification.message}</p>

                    {isBeneficiaryRequest && (
                      <div className="actions-row">
                        {isAlreadyResponded ? (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            color: '#34d399',
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '4px 0',
                          }}>
                            <Check size={14} color="#34d399" />
                            <span>Request Responded</span>
                          </div>
                        ) : (
                          <>
                            <button
                              className="btn-accept"
                              disabled={processingIds.includes(notification.id)}
                              style={{ opacity: processingIds.includes(notification.id) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBeneficiaryResponse(notification.id, notification.related_entity_id, 'accept');
                              }}
                            >
                              <Check size={13} />
                              <span>{processingIds.includes(notification.id) ? 'Processing...' : 'Accept'}</span>
                            </button>
                            <button
                              className="btn-decline"
                              disabled={processingIds.includes(notification.id)}
                              style={{ opacity: processingIds.includes(notification.id) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBeneficiaryResponse(notification.id, notification.related_entity_id, 'decline');
                              }}
                            >
                              <X size={13} />
                              <span>Decline</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
