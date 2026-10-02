import React, { useState, useEffect, useMemo } from 'react';
import { getPins, getPinMetrics, updatePinStatus, deletePin } from '../api/adminService';
import DataTable from '../components/common/DataTable';
import { 
  MapPin, Search, Eye, EyeOff, Trash2, ShieldAlert, Sparkles, 
  AlertTriangle, Flame, PartyPopper, Heart, HardHat, ShoppingBag, 
  Car, Radio, RefreshCw, X, Check, Map as MapIcon, ExternalLink 
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const CATEGORY_CONFIG = {
  party: { label: 'Party', icon: PartyPopper, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30 ring-purple-500/20' },
  wedding: { label: 'Wedding', icon: Heart, color: 'text-pink-400 bg-pink-500/10 border-pink-500/30 ring-pink-500/20' },
  construction: { label: 'Construction', icon: HardHat, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30 ring-amber-500/20' },
  unsafe: { label: 'Unsafe Zone', icon: AlertTriangle, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30 ring-rose-500/20' },
  market: { label: 'Market', icon: ShoppingBag, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 ring-emerald-500/20' },
  traffic: { label: 'Traffic', icon: Car, color: 'text-sky-400 bg-sky-500/10 border-sky-500/30 ring-sky-500/20' },
};

const createPinIcon = (category) => {
  const cfg = CATEGORY_CONFIG[category] || { color: 'text-rose-400', label: 'Pin' };
  const html = `
    <div style="background: #0f172a; border: 2px solid #f43f5e; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(244,63,94,0.6);">
      <span style="color: white; font-size: 14px; font-weight: bold;">📍</span>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-pin-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

const PinsModerationPage = () => {
  const [data, setData] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [globalFilter, setGlobalFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, inactive, expired
  const [sourceFilter, setSourceFilter] = useState('all');

  // Modals
  const [mapPreviewPin, setMapPreviewPin] = useState(null);
  const [deleteTargetPin, setDeleteTargetPin] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pinsRes, metricsRes] = await Promise.all([
        getPins(),
        getPinMetrics()
      ]);
      setData(pinsRes.data || []);
      setMetrics(metricsRes);
      setError(null);
    } catch (err) {
      console.error('Failed to load vibe pins:', err);
      setError(err.message || 'Failed to load vibe pins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleStatus = async (pin) => {
    try {
      setActionLoading(true);
      const nextStatus = !pin.is_active;
      await updatePinStatus(pin.id, { is_active: nextStatus });
      setData(prev => prev.map(p => p.id === pin.id ? { ...p, is_active: nextStatus } : p));
      setActionMessage({ type: 'success', text: `Pin marked as ${nextStatus ? 'Active' : 'Hidden / Inactive'}` });
      setTimeout(() => setActionMessage(null), 3000);
      // Refresh metrics in background
      getPinMetrics().then(setMetrics).catch(() => {});
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to update pin status' });
      setTimeout(() => setActionMessage(null), 4000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePin = async () => {
    if (!deleteTargetPin) return;
    try {
      setActionLoading(true);
      await deletePin(deleteTargetPin.id);
      setData(prev => prev.filter(p => p.id !== deleteTargetPin.id));
      setActionMessage({ type: 'success', text: 'Pin deleted successfully' });
      setDeleteTargetPin(null);
      setTimeout(() => setActionMessage(null), 3000);
      getPinMetrics().then(setMetrics).catch(() => {});
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete pin' });
      setTimeout(() => setActionMessage(null), 4000);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(pin => {
      if (categoryFilter !== 'all' && pin.category !== categoryFilter) return false;
      if (sourceFilter !== 'all' && pin.source !== sourceFilter) return false;
      if (statusFilter === 'active' && (!pin.is_active || pin.is_expired)) return false;
      if (statusFilter === 'inactive' && pin.is_active) return false;
      if (statusFilter === 'expired' && (!pin.is_expired || !pin.is_active)) return false;
      return true;
    });
  }, [data, categoryFilter, statusFilter, sourceFilter]);

  const columns = useMemo(() => [
    {
      header: 'Category',
      accessorKey: 'category',
      cell: info => {
        const catKey = info.getValue() || 'party';
        const cfg = CATEGORY_CONFIG[catKey] || { label: catKey, icon: MapPin, color: 'text-slate-400 bg-slate-800 border-slate-700' };
        const Icon = cfg.icon;
        return (
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${cfg.color}`}>
              <Icon size={13} />
              {cfg.label}
            </span>
          </div>
        );
      }
    },
    {
      header: 'Report Note / Description',
      accessorKey: 'note',
      cell: info => (
        <div className="max-w-xs md:max-w-md">
          <p className="text-sm text-slate-200 line-clamp-2">{info.getValue() || <span className="text-slate-500 italic">No notes provided</span>}</p>
        </div>
      )
    },
    {
      header: 'Author / Reporter',
      accessorFn: row => `${row.author_name} ${row.author_phone || ''} ${row.author_email || ''}`,
      cell: info => (
        <div>
          <div className="text-sm font-medium text-white">{info.row.original.author_name}</div>
          <div className="text-xs text-slate-400">{info.row.original.author_phone || info.row.original.author_email || 'Anonymous'}</div>
        </div>
      )
    },
    {
      header: 'Confirmations',
      accessorKey: 'confirmation_count',
      cell: info => (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-700">
            👥 {info.getValue()}
          </span>
        </div>
      )
    },
    {
      header: 'Status',
      accessorFn: row => row.is_active ? (row.is_expired ? 'Expired' : 'Active') : 'Hidden',
      cell: info => {
        const { is_active, is_expired } = info.row.original;
        if (!is_active) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <EyeOff size={12} /> Hidden
            </span>
          );
        }
        if (is_expired) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Expired
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Check size={12} /> Live
          </span>
        );
      }
    },
    {
      header: 'Source',
      accessorKey: 'source',
      cell: info => (
        <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
          {info.getValue() || 'user'}
        </span>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: info => {
        const pin = info.row.original;
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMapPreviewPin(pin)}
              title="Preview on Map"
              className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-md transition-colors"
            >
              <MapIcon size={16} />
            </button>
            <button
              onClick={() => handleToggleStatus(pin)}
              disabled={actionLoading}
              title={pin.is_active ? 'Hide Pin (Moderate)' : 'Unhide Pin (Activate)'}
              className={`p-1.5 rounded-md transition-colors ${
                pin.is_active 
                  ? 'text-slate-400 hover:text-amber-400 hover:bg-slate-800' 
                  : 'text-amber-400 hover:text-emerald-400 hover:bg-slate-800'
              }`}
            >
              {pin.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button
              onClick={() => setDeleteTargetPin(pin)}
              title="Delete Pin"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      }
    }
  ], [actionLoading]);

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <MapPin className="text-rose-500" size={26} />
            Vibe Pins Moderation
          </h1>
          <p className="text-slate-400 mt-1">Review, moderate, and inspect community and organizer vibe reports.</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition-colors self-start sm:self-auto"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Action Notification Toast */}
      {actionMessage && (
        <div className={`p-3 rounded-lg text-sm font-medium border flex items-center justify-between transition-all ${
          actionMessage.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Metric Cards Banner */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-ops-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-400">Total Submitted</p>
            <p className="text-2xl font-bold text-white mt-1">{metrics.total_pins}</p>
          </div>
          <div className="bg-ops-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-medium text-emerald-400">Live Active Pins</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{metrics.active_pins}</p>
          </div>
          <div className="bg-ops-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-medium text-amber-400">Expired Pins</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{metrics.expired_pins}</p>
          </div>
          <div className="bg-ops-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-medium text-rose-400">Moderated / Hidden</p>
            <p className="text-2xl font-bold text-rose-400 mt-1">{metrics.inactive_pins}</p>
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-ops-900 border border-slate-800 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative w-full lg:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-slate-500" />
            </div>
            <input
              type="text"
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
              placeholder="Search note, author, phone..."
              className="w-full pl-9 pr-4 py-2 bg-ops-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category */}
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="bg-ops-950 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-rose-500 focus:border-rose-500 p-2"
            >
              <option value="all">All Categories</option>
              <option value="party">🎉 Party</option>
              <option value="wedding">💍 Wedding</option>
              <option value="traffic">🚗 Traffic</option>
              <option value="unsafe">⚠️ Unsafe Zone</option>
              <option value="market">🛍️ Market</option>
              <option value="construction">🚧 Construction</option>
            </select>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-ops-950 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-rose-500 focus:border-rose-500 p-2"
            >
              <option value="all">All Statuses</option>
              <option value="active">Live & Active</option>
              <option value="expired">Expired</option>
              <option value="inactive">Hidden / Moderated</option>
            </select>

            {/* Source */}
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="bg-ops-950 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-rose-500 focus:border-rose-500 p-2"
            >
              <option value="all">All Sources</option>
              <option value="user">User Submissions</option>
              <option value="organiser">Organisers</option>
              <option value="instagram">Instagram</option>
              <option value="twitter">Twitter / X</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto bg-ops-900 p-4">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
            </div>
          ) : error ? (
            <div className="flex h-64 flex-col items-center justify-center text-slate-500">
              <ShieldAlert size={40} className="text-rose-500/50 mb-3" />
              <p className="text-base font-medium text-rose-400">Error Loading Vibe Pins</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-slate-500">
              <MapPin size={40} className="text-slate-600 mb-3" />
              <p className="text-base font-medium text-slate-300">No Vibe Pins Found</p>
              <p className="text-sm mt-1">Try adjusting your category or status filters.</p>
            </div>
          ) : (
            <DataTable 
              data={filteredData} 
              columns={columns} 
              globalFilter={globalFilter} 
              setGlobalFilter={setGlobalFilter} 
            />
          )}
        </div>
      </div>

      {/* Map Preview Modal */}
      {mapPreviewPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-ops-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="text-rose-500" size={20} />
                <h3 className="font-semibold text-white">Pin Coordinate Preview</h3>
                <span className="text-xs text-slate-400">({mapPreviewPin.lat.toFixed(4)}, {mapPreviewPin.lng.toFixed(4)})</span>
              </div>
              <button
                onClick={() => setMapPreviewPin(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="h-80 w-full relative">
              <MapContainer
                center={[mapPreviewPin.lat, mapPreviewPin.lng]}
                zoom={14}
                style={{ height: '100%', width: '100%', background: '#0f172a' }}
              >
                <TileLayer
                  url={`https://api.maptiler.com/maps/streets-v2-dark/256/{z}/{x}/{y}.png?key=${import.meta.env.VITE_MAPTILER_KEY}`}
                  attribution='&copy; MapTiler &copy; OpenStreetMap'
                />
                <Marker position={[mapPreviewPin.lat, mapPreviewPin.lng]} icon={createPinIcon(mapPreviewPin.category)}>
                  <Popup className="ops-popup">
                    <div className="text-slate-200">
                      <p className="font-bold text-white capitalize">{mapPreviewPin.category}</p>
                      <p className="text-xs mt-1">{mapPreviewPin.note || 'No note'}</p>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>

            <div className="p-4 bg-ops-950 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
              <div>
                <span>Reporter: <strong className="text-slate-200">{mapPreviewPin.author_name}</strong></span>
                <span className="mx-2">•</span>
                <span>Confirmations: <strong className="text-slate-200">{mapPreviewPin.confirmation_count}</strong></span>
              </div>
              <button
                onClick={() => setMapPreviewPin(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Pin Confirmation Modal */}
      {deleteTargetPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-ops-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-500 mb-4">
              <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Permanently Delete Pin?</h3>
                <p className="text-xs text-slate-400">This action will remove the pin and its confirmations.</p>
              </div>
            </div>

            <div className="bg-ops-950 border border-slate-800 rounded-lg p-3 my-4 text-xs text-slate-300">
              <p><strong>Category:</strong> <span className="capitalize">{deleteTargetPin.category}</span></p>
              <p className="mt-1"><strong>Author:</strong> {deleteTargetPin.author_name}</p>
              <p className="mt-1"><strong>Note:</strong> {deleteTargetPin.note || 'None'}</p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteTargetPin(null)}
                disabled={actionLoading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePin}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {actionLoading && <RefreshCw size={14} className="animate-spin" />}
                Delete Pin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PinsModerationPage;
