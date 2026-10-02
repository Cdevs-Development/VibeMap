import React, { useEffect, useState } from 'react';
import { getOverviewMetrics, getLiveSos } from '../api/adminService';
import StatCard from '../components/common/StatCard';
import { Users, Activity, CheckCircle, Navigation, ArrowRight, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const formatTime = (seconds) => {
  if (!seconds) return 'N/A';
  seconds = Math.round(seconds);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

const DashboardPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [recentSos, setRecentSos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsData, sosData] = await Promise.all([
          getOverviewMetrics(),
          getLiveSos(),
        ]);
        setMetrics(metricsData);
        setRecentSos(sosData.slice(0, 3)); // Only show top 3 on dashboard
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setMetrics({
          active_sos: 'Err',
          resolved_sos: 'Err',
          active_trips: 'Err',
          total_users: 'Err',
          signups_today: 0,
          growth_series: [],
          avg_response_time_seconds: 0
        });
        setRecentSos([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System Overview</h1>
        <p className="text-slate-400 mt-1">Real-time metrics and alerts for VibeMap operations.</p>
      </div>

      {/* Top Row: KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          title="Active Emergencies"
          value={metrics.active_sos}
          subtext="Requires immediate triage"
          icon={Activity}
          color="rose"
        />
        <StatCard
          title="Resolved Incidents"
          value={metrics.resolved_sos}
          subtext="+12% from last week"
          icon={CheckCircle}
          color="emerald"
        />
        <StatCard
          title="Avg Response Time"
          value={formatTime(metrics.avg_response_time_seconds)}
          subtext="Trigger to acknowledgment"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Active Live Trips"
          value={metrics.active_trips}
          subtext="Currently tracking"
          icon={Navigation}
          color="blue"
        />
        <StatCard
          title="Total Users"
          value={(metrics.total_users ?? 0).toLocaleString()}
          subtext={`+${metrics.signups_today ?? 0} today`}
          icon={Users}
          color="purple"
        />
      </div>

      {/* Middle Section: Chart & Quick Triage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart (60%) */}
        <div className="lg:col-span-2 bg-ops-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-lg font-medium text-white mb-4">7-Day Incident Trend</h3>
          <div className="h-[300px] w-full">
            {metrics.growth_series && metrics.growth_series.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.growth_series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Area type="monotone" dataKey="incidents" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorIncidents)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <Activity size={32} className="mb-2 opacity-50" />
                <p>No historical data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Triage (40%) */}
        <div className="bg-ops-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white">Live SOS Snapshot</h3>
            <Link to="/sos" className="text-sm text-rose-500 hover:text-rose-400 flex items-center gap-1 font-medium transition-colors">
              View All <ArrowRight size={16} />
            </Link>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3">
            {recentSos.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                <CheckCircle size={32} className="text-emerald-500/50" />
                <p>No active emergencies</p>
              </div>
            ) : (
              recentSos.map((sos) => (
                <div key={sos.id} className="bg-ops-950 border border-slate-800 p-3 rounded-lg hover:border-rose-500/50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-white">{sos?.user || 'Unknown'}</p>
                      <p className="text-xs text-slate-400 mt-1">{sos?.phone || 'No Phone'}</p>
                    </div>
                    <span className="flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-800 flex justify-end items-center text-xs">
                    <Link to="/sos" className="text-rose-500 hover:text-rose-400 font-medium">Triage Now</Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
