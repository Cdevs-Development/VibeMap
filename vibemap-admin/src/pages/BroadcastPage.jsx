import React, { useState, useEffect, useMemo } from 'react';
import { sendBroadcastNotification, sendTargetedNotification, getNotificationLogs } from '../api/adminService';
import DataTable from '../components/common/DataTable';
import { 
  Bell, Send, Search, RefreshCw, Radio, CheckCircle2, 
  AlertTriangle, Info, User, Users, Check, X, ShieldAlert, Sparkles 
} from 'lucide-react';

const NOTIF_TYPES = [
  { value: 'broadcast_announcement', label: '📢 General Announcement' },
  { value: 'system_update', label: '🚀 System Update' },
  { value: 'emergency_alert', label: '🚨 Safety Alert' },
  { value: 'beneficiary_request', label: '👥 Beneficiary Request' },
  { value: 'admin_message', label: '💬 Admin Direct Message' }
];

const BroadcastPage = () => {
  const [activeTab, setActiveTab] = useState('broadcast'); // 'broadcast' | 'targeted' | 'logs'
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Broadcast form state
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState('broadcast_announcement');
  const [onlyVerified, setOnlyVerified] = useState(false);

  // Targeted form state
  const [targetUserId, setTargetUserId] = useState('');
  const [targetedTitle, setTargetedTitle] = useState('');
  const [targetedMessage, setTargetedMessage] = useState('');
  const [targetedType, setTargetedType] = useState('admin_message');

  // Status message
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Log filter
  const [globalFilter, setGlobalFilter] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState('all');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await getNotificationLogs();
      setLogs(res.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load notification logs:', err);
      setError(err.message || 'Failed to load delivery logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab]);

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;

    try {
      setActionLoading(true);
      const res = await sendBroadcastNotification({
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        notification_type: broadcastType,
        only_verified: onlyVerified
      });

      setActionFeedback({ type: 'success', text: res.message || 'Broadcast delivered successfully!' });
      setBroadcastTitle('');
      setBroadcastMessage('');
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err) {
      setActionFeedback({ type: 'error', text: err.message || 'Failed to send broadcast' });
      setTimeout(() => setActionFeedback(null), 5000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendTargeted = async (e) => {
    e.preventDefault();
    if (!targetUserId.trim() || !targetedTitle.trim() || !targetedMessage.trim()) return;

    try {
      setActionLoading(true);
      const res = await sendTargetedNotification({
        user_ids: [targetUserId.trim()],
        title: targetedTitle.trim(),
        message: targetedMessage.trim(),
        notification_type: targetedType
      });

      setActionFeedback({ type: 'success', text: res.message || 'Message sent to user!' });
      setTargetedTitle('');
      setTargetedMessage('');
      setTargetUserId('');
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err) {
      setActionFeedback({ type: 'error', text: err.message || 'Failed to send notification' });
      setTimeout(() => setActionFeedback(null), 5000);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (logTypeFilter !== 'all' && log.notification_type !== logTypeFilter) return false;
      return true;
    });
  }, [logs, logTypeFilter]);

  const logColumns = useMemo(() => [
    {
      header: 'Recipient',
      accessorFn: row => `${row.recipient_name} ${row.recipient_phone || ''} ${row.recipient_email || ''}`,
      cell: info => (
        <div>
          <p className="text-sm font-semibold text-white">{info.row.original.recipient_name}</p>
          <p className="text-xs text-slate-400">{info.row.original.recipient_phone || info.row.original.recipient_email}</p>
        </div>
      )
    },
    {
      header: 'Notification Title & Message',
      accessorFn: row => `${row.title} ${row.message}`,
      cell: info => (
        <div className="max-w-md">
          <p className="text-sm font-medium text-slate-200">{info.row.original.title}</p>
          <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{info.row.original.message}</p>
        </div>
      )
    },
    {
      header: 'Type',
      accessorKey: 'notification_type',
      cell: info => {
        const type = info.getValue() || 'broadcast_announcement';
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
            {type}
          </span>
        );
      }
    },
    {
      header: 'Read Status',
      accessorKey: 'is_read',
      cell: info => info.getValue() ? (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
          <Check size={14} /> Read
        </span>
      ) : (
        <span className="text-xs text-slate-500">Unread</span>
      )
    },
    {
      header: 'Sent At',
      accessorKey: 'created_at',
      cell: info => {
        const val = info.getValue();
        if (!val) return <span className="text-slate-500">-</span>;
        const d = new Date(val);
        return <span className="text-xs text-slate-400">{d.toLocaleString()}</span>;
      }
    }
  ], []);

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Bell className="text-rose-500" size={26} />
            Notifications & Broadcast
          </h1>
          <p className="text-slate-400 mt-1">Send broadcast announcements, targeted alerts, and review delivery logs.</p>
        </div>
      </div>

      {/* Action Toast Feedback */}
      {actionFeedback && (
        <div className={`p-3 rounded-lg text-sm font-medium border flex items-center justify-between transition-all ${
          actionFeedback.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          <span>{actionFeedback.text}</span>
          <button onClick={() => setActionFeedback(null)} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('broadcast')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'broadcast'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio size={16} /> Broadcast to All Users
        </button>
        <button
          onClick={() => setActiveTab('targeted')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'targeted'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <User size={16} /> Direct User Message
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'logs'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Info size={16} /> Delivery Logs & History
        </button>
      </div>

      {/* Tab 1: Broadcast */}
      {activeTab === 'broadcast' && (
        <div className="bg-ops-900 border border-slate-800 rounded-xl p-6 shadow-sm max-w-3xl">
          <form onSubmit={handleSendBroadcast} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Announcement Title
              </label>
              <input
                type="text"
                required
                value={broadcastTitle}
                onChange={e => setBroadcastTitle(e.target.value)}
                placeholder="e.g. Scheduled Maintenance or New Feature Available!"
                className="w-full px-3.5 py-2.5 bg-ops-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Notification Category
              </label>
              <select
                value={broadcastType}
                onChange={e => setBroadcastType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-ops-950 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-rose-500 focus:border-rose-500"
              >
                {NOTIF_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Message Body
              </label>
              <textarea
                required
                rows={4}
                value={broadcastMessage}
                onChange={e => setBroadcastMessage(e.target.value)}
                placeholder="Type the message to be delivered to all active users on their in-app notification center..."
                className="w-full px-3.5 py-2.5 bg-ops-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
              ></textarea>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="onlyVerified"
                checked={onlyVerified}
                onChange={e => setOnlyVerified(e.target.checked)}
                className="rounded border-slate-700 bg-ops-950 text-rose-500 focus:ring-rose-500 h-4 w-4"
              />
              <label htmlFor="onlyVerified" className="text-xs text-slate-300 select-none cursor-pointer">
                Send only to verified phone/email accounts
              </label>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-rose-600/20"
              >
                {actionLoading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                Send Broadcast Announcement
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Direct User Push */}
      {activeTab === 'targeted' && (
        <div className="bg-ops-900 border border-slate-800 rounded-xl p-6 shadow-sm max-w-3xl">
          <form onSubmit={handleSendTargeted} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Target User ID
              </label>
              <input
                type="text"
                required
                value={targetUserId}
                onChange={e => setTargetUserId(e.target.value)}
                placeholder="Paste the User ID from the User Management page..."
                className="w-full px-3.5 py-2.5 bg-ops-950 border border-slate-700 rounded-lg text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Message Title
              </label>
              <input
                type="text"
                required
                value={targetedTitle}
                onChange={e => setTargetedTitle(e.target.value)}
                placeholder="e.g. Account Security Update or Support Follow-up"
                className="w-full px-3.5 py-2.5 bg-ops-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Message Content
              </label>
              <textarea
                required
                rows={4}
                value={targetedMessage}
                onChange={e => setTargetedMessage(e.target.value)}
                placeholder="Enter personal direct notification message..."
                className="w-full px-3.5 py-2.5 bg-ops-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
              ></textarea>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-rose-600/20"
              >
                {actionLoading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                Send Direct Message
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: Delivery Logs */}
      {activeTab === 'logs' && (
        <div className="bg-ops-900 border border-slate-800 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-slate-500" />
              </div>
              <input
                type="text"
                value={globalFilter ?? ''}
                onChange={e => setGlobalFilter(e.target.value)}
                placeholder="Search recipient, title..."
                className="w-full pl-9 pr-4 py-2 bg-ops-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>

            <button
              onClick={fetchLogs}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh Logs
            </button>
          </div>

          <div className="flex-1 overflow-auto bg-ops-900 p-4">
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
              </div>
            ) : error ? (
              <div className="flex h-64 flex-col items-center justify-center text-slate-500">
                <ShieldAlert size={40} className="text-rose-500/50 mb-3" />
                <p className="text-base font-medium text-rose-400">Error Loading Logs</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-slate-500">
                <Bell size={40} className="text-slate-600 mb-3" />
                <p className="text-base font-medium text-slate-300">No Notification Logs</p>
              </div>
            ) : (
              <DataTable 
                data={filteredLogs} 
                columns={logColumns} 
                globalFilter={globalFilter} 
                setGlobalFilter={setGlobalFilter} 
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BroadcastPage;
