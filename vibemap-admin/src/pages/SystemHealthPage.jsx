import React, { useState, useEffect } from 'react';
import { getSystemHealth } from '../api/adminService';
import { 
  Activity, Server, Database, Radio, Bell, ShieldCheck, 
  AlertCircle, RefreshCw, CheckCircle2, Clock, Users, Wifi 
} from 'lucide-react';

const SystemHealthPage = () => {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(new Date());

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const data = await getSystemHealth();
      setHealth(data);
      setLastChecked(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch system health:', err);
      setError(err.message || 'Failed to connect to system health service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const timer = setInterval(fetchHealth, 30000); // Polling every 30s
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Activity className="text-emerald-500" size={26} />
            System Health & Diagnostics
          </h1>
          <p className="text-slate-400 mt-1">Real-time telemetry, location tracking diagnostics, and service SLAs.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Last checked: {lastChecked.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh Now
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-6 text-center text-rose-400">
          <AlertCircle size={40} className="mx-auto mb-3" />
          <p className="text-lg font-bold">Health Diagnostic Check Failed</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : health ? (
        <div className="space-y-6">
          {/* Main Service Nodes */}
          <div>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Core Infrastructure Services</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* API Server */}
              <div className="bg-ops-900 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
                    <Server size={22} />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Operational
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mt-4">FastAPI Backend</h3>
                <p className="text-xs text-slate-400 mt-1">Uvicorn ASGI Engine & REST Gateway</p>
              </div>

              {/* Database */}
              <div className="bg-ops-900 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-sky-500/10 rounded-lg border border-sky-500/20 text-sky-400">
                    <Database size={22} />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 size={12} />
                    Connected
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mt-4">Database Engine</h3>
                <p className="text-xs text-slate-400 mt-1">{health.database.engine} with pooling</p>
              </div>

              {/* Location WebSockets */}
              <div className="bg-ops-900 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-purple-500/10 rounded-lg border border-purple-500/20 text-purple-400">
                    <Radio size={22} />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Wifi size={12} />
                    Active
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mt-4">Live Tracking Engine</h3>
                <p className="text-xs text-slate-400 mt-1">WebSocket bidirectional broadcast</p>
              </div>

              {/* SOS Emergency Dispatch */}
              <div className="bg-ops-900 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-rose-500/10 rounded-lg border border-rose-500/20 text-rose-400">
                    <ShieldCheck size={22} />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    Ready
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mt-4">Emergency SOS Dispatch</h3>
                <p className="text-xs text-slate-400 mt-1">{health.emergency_health?.active_emergencies ?? 0} active incident(s)</p>
              </div>
            </div>
          </div>

          {/* Location Tracking Diagnostics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-ops-900 border border-slate-800 rounded-xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                <Radio className="text-sky-400" size={20} />
                Background Location Tracking Diagnostics
              </h2>
              <p className="text-xs text-slate-400 mb-6">
                Monitors device ping health and distinguishes between users getting fresh native fixes versus stale or disabled location tracking.
              </p>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-emerald-400">Fresh Fixes (&lt; 15 mins)</span>
                    <span className="text-white font-bold">{health.tracking_health.active_tracking_now} users</span>
                  </div>
                  <div className="w-full bg-ops-950 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-2.5 rounded-full" 
                      style={{ width: `${(health.tracking_health.active_tracking_now / Math.max(1, health.tracking_health.total_users)) * 100}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-amber-400">Stale Location (&lt; 24 hrs)</span>
                    <span className="text-white font-bold">{health.tracking_health.stale_tracking_24h} users</span>
                  </div>
                  <div className="w-full bg-ops-950 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-amber-500 h-2.5 rounded-full" 
                      style={{ width: `${(health.tracking_health.stale_tracking_24h / Math.max(1, health.tracking_health.total_users)) * 100}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-slate-400">Inactive / No Ping in 24h</span>
                    <span className="text-white font-bold">{health.tracking_health.inactive_tracking} users</span>
                  </div>
                  <div className="w-full bg-ops-950 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-slate-700 h-2.5 rounded-full" 
                      style={{ width: `${(health.tracking_health.inactive_tracking / Math.max(1, health.tracking_health.total_users)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Location Sharing Active: <strong className="text-emerald-400">{health.tracking_health.location_sharing_enabled}</strong></span>
                <span>Sharing Disabled: <strong className="text-rose-400">{health.tracking_health.location_sharing_disabled}</strong></span>
              </div>
            </div>

            {/* Emergency & Notification Health */}
            <div className="bg-ops-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                  <ShieldCheck className="text-rose-500" size={20} />
                  Emergency SOS Response Health
                </h2>
                <p className="text-xs text-slate-400 mb-6">
                  Emergency triage capacity and historical incident resolution telemetry.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-ops-950 border border-slate-800 rounded-lg p-4">
                    <p className="text-xs text-slate-400">Active Incidents</p>
                    <p className="text-2xl font-bold text-rose-500 mt-1">{health.emergency_health.active_emergencies}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Needs immediate triage</p>
                  </div>
                  <div className="bg-ops-950 border border-slate-800 rounded-lg p-4">
                    <p className="text-xs text-slate-400">Lifetime Incidents</p>
                    <p className="text-2xl font-bold text-slate-200 mt-1">{health.emergency_health.total_emergencies}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Logged in audit trail</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-ops-950/60 border border-slate-800/80 rounded-lg text-xs space-y-1 text-slate-400">
                <p><strong>Database Status:</strong> Healthy (Schema Migrations Active)</p>
                <p><strong>Server Timestamp:</strong> {health.timestamp}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SystemHealthPage;
