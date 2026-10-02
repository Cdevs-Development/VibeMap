import React, { useState, useEffect, useMemo } from 'react';
import { getTrips, getTripMetrics, getTripDetails } from '../api/adminService';
import DataTable from '../components/common/DataTable';
import { 
  Navigation, Search, RefreshCw, ShieldAlert, Clock, CheckCircle2, 
  XCircle, AlertTriangle, Radio, MapPin, X, Eye, TrendingUp, Compass, Flag 
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';

const originIcon = L.divIcon({
  html: `
    <div style="background: #10b981; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(16,185,129,0.7);">
      <span style="color: white; font-size: 11px; font-weight: bold;">A</span>
    </div>
  `,
  className: 'custom-origin-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const destIcon = L.divIcon({
  html: `
    <div style="background: #f43f5e; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(244,63,94,0.7);">
      <span style="color: white; font-size: 11px; font-weight: bold;">B</span>
    </div>
  `,
  className: 'custom-dest-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const currentIcon = L.divIcon({
  html: `
    <div style="background: #38bdf8; border: 2px solid white; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(56,189,248,0.8);">
      <span style="color: white; font-size: 12px; font-weight: bold;">🚗</span>
    </div>
  `,
  className: 'custom-current-marker',
  iconSize: [26, 26],
  iconAnchor: [13, 13]
});

const TripsAnalyticsPage = () => {
  const [data, setData] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, completed, cancelled, abandoned, sos_active

  // Route map modal
  const [selectedTripDetails, setSelectedTripDetails] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tripsRes, metricsRes] = await Promise.all([
        getTrips(),
        getTripMetrics()
      ]);
      setData(tripsRes.data || []);
      setMetrics(metricsRes);
      setError(null);
    } catch (err) {
      console.error('Failed to load trips:', err);
      setError(err.message || 'Failed to load trip analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenRouteMap = async (trip) => {
    try {
      setRouteLoading(true);
      const details = await getTripDetails(trip.id);
      setSelectedTripDetails(details);
    } catch (err) {
      console.error('Failed to load trip route details:', err);
      // Fallback with base coordinates
      setSelectedTripDetails({
        ...trip,
        pings: []
      });
    } finally {
      setRouteLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(trip => {
      if (statusFilter !== 'all' && trip.status !== statusFilter) return false;
      return true;
    });
  }, [data, statusFilter]);

  const columns = useMemo(() => [
    {
      header: 'Destination',
      accessorKey: 'destination_name',
      cell: info => (
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
            <Compass size={16} className="text-sky-400" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm">{info.getValue() || 'Unknown Destination'}</p>
            <p className="text-[11px] text-slate-500 font-mono">ID: {info.row.original.id.slice(0, 8)}...</p>
          </div>
        </div>
      )
    },
    {
      header: 'User',
      accessorFn: row => `${row.user_name} ${row.user_phone}`,
      cell: info => (
        <div>
          <div className="text-sm font-medium text-slate-200">{info.row.original.user_name}</div>
          <div className="text-xs text-slate-400">{info.row.original.user_phone}</div>
        </div>
      )
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: info => {
        const status = info.getValue() || 'active';
        if (status === 'completed') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 size={12} /> Completed
            </span>
          );
        }
        if (status === 'abandoned') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle size={12} /> Abandoned
            </span>
          );
        }
        if (status === 'cancelled') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <XCircle size={12} /> Cancelled
            </span>
          );
        }
        if (status === 'sos_active') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-600 text-white animate-pulse">
              <Radio size={12} /> SOS Active
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Radio size={12} className="animate-pulse" /> Live Tracking
          </span>
        );
      }
    },
    {
      header: 'Duration',
      accessorKey: 'duration_minutes',
      cell: info => {
        const mins = info.getValue();
        if (mins == null) return <span className="text-slate-500">-</span>;
        if (mins < 60) return <span className="text-sm text-slate-300 font-medium">{mins} mins</span>;
        const hrs = Math.floor(mins / 60);
        const remMins = Math.round(mins % 60);
        return <span className="text-sm text-slate-300 font-medium">{hrs}h {remMins}m</span>;
      }
    },
    {
      header: 'GPS Pings',
      accessorKey: 'pings_count',
      cell: info => (
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800 text-xs font-mono text-slate-300">
          📍 {info.getValue()}
        </span>
      )
    },
    {
      header: 'Started At',
      accessorKey: 'started_at',
      cell: info => {
        const val = info.getValue();
        if (!val) return <span className="text-slate-500">-</span>;
        const d = new Date(val);
        return <span className="text-xs text-slate-400">{d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>;
      }
    },
    {
      id: 'actions',
      header: 'Route Map',
      cell: info => (
        <button
          onClick={() => handleOpenRouteMap(info.row.original)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
        >
          <Eye size={13} />
          View Route
        </button>
      )
    }
  ], []);

  // Compute polyline coordinates for map
  const routePolyline = useMemo(() => {
    if (!selectedTripDetails) return [];
    if (selectedTripDetails.pings && selectedTripDetails.pings.length > 0) {
      return selectedTripDetails.pings.map(p => [p.lat, p.lng]);
    }
    // Fallback straight line if origin and destination exist
    const points = [];
    if (selectedTripDetails.origin_lat && selectedTripDetails.origin_lng) {
      points.push([selectedTripDetails.origin_lat, selectedTripDetails.origin_lng]);
    }
    if (selectedTripDetails.current_lat && selectedTripDetails.current_lng) {
      points.push([selectedTripDetails.current_lat, selectedTripDetails.current_lng]);
    }
    if (selectedTripDetails.destination_lat && selectedTripDetails.destination_lng) {
      points.push([selectedTripDetails.destination_lat, selectedTripDetails.destination_lng]);
    }
    return points;
  }, [selectedTripDetails]);

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Navigation className="text-rose-500" size={26} />
            Trip & Navigation Analytics
          </h1>
          <p className="text-slate-400 mt-1">Audit active navigations, completed journeys, and diagnose abandoned trips.</p>
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

      {/* Metrics Top Section */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-ops-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-400">Total Trips Started</p>
            <p className="text-2xl font-bold text-white mt-1">{metrics.total_trips}</p>
          </div>
          <div className="bg-ops-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-medium text-sky-400">Active Live Trips</p>
            <p className="text-2xl font-bold text-sky-400 mt-1">{metrics.active_trips}</p>
          </div>
          <div className="bg-ops-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-medium text-emerald-400">Completed Trips</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{metrics.completed_trips}</p>
          </div>
          <div className="bg-ops-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-medium text-amber-400">Avg Trip Duration</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{metrics.avg_duration_minutes} min</p>
          </div>
          <div 
            onClick={() => setStatusFilter(statusFilter === 'abandoned' ? 'all' : 'abandoned')}
            className={`cursor-pointer border rounded-xl p-4 shadow-sm transition-all ${
              metrics.abandoned_trips > 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-ops-900 border-slate-800'
            }`}
          >
            <p className="text-xs font-medium text-rose-400">Abandoned / Unfinished</p>
            <p className="text-2xl font-bold text-rose-400 mt-1">{metrics.abandoned_trips}</p>
          </div>
        </div>
      )}

      {/* Popular Destinations Cards */}
      {metrics?.top_destinations && metrics.top_destinations.length > 0 && (
        <div className="bg-ops-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <TrendingUp size={14} className="text-rose-500" />
            Top Navigation Destinations
          </h3>
          <div className="flex flex-wrap gap-2">
            {metrics.top_destinations.map((dest, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-ops-950 border border-slate-800 rounded-lg text-xs">
                <span className="font-medium text-white">{dest.name}</span>
                <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold text-[10px]">
                  {dest.count} trips
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-ops-900 border border-slate-800 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-slate-500" />
            </div>
            <input
              type="text"
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
              placeholder="Search destination, user, phone..."
              className="w-full pl-9 pr-4 py-2 bg-ops-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-ops-950 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-rose-500 focus:border-rose-500 p-2"
            >
              <option value="all">All Trip Statuses</option>
              <option value="active">Active (Tracking)</option>
              <option value="completed">Completed</option>
              <option value="abandoned">Abandoned</option>
              <option value="cancelled">Cancelled</option>
              <option value="sos_active">SOS Triggered</option>
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
              <p className="text-base font-medium text-rose-400">Error Loading Trips</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-slate-500">
              <Navigation size={40} className="text-slate-600 mb-3" />
              <p className="text-base font-medium text-slate-300">No Trips Found</p>
              <p className="text-sm mt-1">Try changing your filters.</p>
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

      {/* Interactive Trip Route Map Modal */}
      {selectedTripDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-ops-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="text-rose-500" size={20} />
                <div>
                  <h3 className="font-semibold text-white">Route to {selectedTripDetails.destination_name}</h3>
                  <p className="text-xs text-slate-400">User: {selectedTripDetails.user_name} ({selectedTripDetails.user_phone})</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTripDetails(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="h-96 w-full relative">
              <MapContainer
                center={
                  selectedTripDetails.current_lat && selectedTripDetails.current_lng
                    ? [selectedTripDetails.current_lat, selectedTripDetails.current_lng]
                    : [selectedTripDetails.origin_lat || 6.5244, selectedTripDetails.origin_lng || 3.3792]
                }
                zoom={13}
                style={{ height: '100%', width: '100%', background: '#0f172a' }}
              >
                <TileLayer
                  url={`https://api.maptiler.com/maps/streets-v2-dark/256/{z}/{x}/{y}.png?key=${import.meta.env.VITE_MAPTILER_KEY}`}
                  attribution='&copy; MapTiler &copy; OpenStreetMap'
                />

                {/* Origin Marker */}
                {selectedTripDetails.origin_lat && selectedTripDetails.origin_lng && (
                  <Marker position={[selectedTripDetails.origin_lat, selectedTripDetails.origin_lng]} icon={originIcon}>
                    <Popup className="ops-popup">
                      <div className="text-slate-200">
                        <strong className="text-emerald-400">Origin Point</strong>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Destination Marker */}
                {selectedTripDetails.destination_lat && selectedTripDetails.destination_lng && (
                  <Marker position={[selectedTripDetails.destination_lat, selectedTripDetails.destination_lng]} icon={destIcon}>
                    <Popup className="ops-popup">
                      <div className="text-slate-200">
                        <strong className="text-rose-400">Destination: {selectedTripDetails.destination_name}</strong>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Current / Last Known Marker */}
                {selectedTripDetails.current_lat && selectedTripDetails.current_lng && (
                  <Marker position={[selectedTripDetails.current_lat, selectedTripDetails.current_lng]} icon={currentIcon}>
                    <Popup className="ops-popup">
                      <div className="text-slate-200">
                        <strong className="text-sky-400">Current / Last Position</strong>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* GPS Breadcrumb Polyline */}
                {routePolyline.length > 1 && (
                  <Polyline positions={routePolyline} color="#38bdf8" weight={4} opacity={0.8} />
                )}
              </MapContainer>
            </div>

            <div className="p-4 bg-ops-950 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
              <div className="flex items-center gap-4">
                <span>Status: <strong className="text-white uppercase">{selectedTripDetails.status}</strong></span>
                <span>Breadcrumb Pings: <strong className="text-white">{selectedTripDetails.pings?.length ?? 0}</strong></span>
              </div>
              <button
                onClick={() => setSelectedTripDetails(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripsAnalyticsPage;
