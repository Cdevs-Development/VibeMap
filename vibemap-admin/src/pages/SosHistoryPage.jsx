import React, { useState, useEffect, useMemo } from 'react';
import { getSosHistory } from '../api/adminService';
import DataTable from '../components/common/DataTable';
import { Search, Clock, CheckCircle } from 'lucide-react';
 
const SosHistoryPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('resolved');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await getSosHistory({ page, limit: 1000, status: statusFilter, search: globalFilter });
        setData(res.data || []);
        setTotal(res.total || 0);
      } catch (err) {
        console.error('Failed to fetch SOS history:', err);
        setData([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };
    
    // Debounce search
    const timer = setTimeout(() => {
      fetchHistory();
    }, 300);
    return () => clearTimeout(timer);
  }, [page, statusFilter, globalFilter]);

  const formatDuration = (seconds) => {
    if (seconds === null || seconds === undefined) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const columns = useMemo(() => [
    {
      header: 'Incident ID',
      accessorKey: 'id',
      cell: info => {
        const val = info.getValue();
        if (!val) return <span className="font-mono text-xs text-slate-400">N/A</span>;
        return <span className="font-mono text-xs text-slate-400">{String(val).substring(0, 8)}...</span>;
      },
    },
    {
      header: 'User',
      accessorFn: row => `${row.user} ${row.phone}`,
      cell: info => (
        <div>
          <div className="font-medium text-white">{info.row.original.user}</div>
          <div className="text-xs text-slate-400">{info.row.original.phone}</div>
        </div>
      ),
    },
    {
      header: 'Triggered At',
      accessorKey: 'triggered_at',
      cell: info => {
        const val = info.getValue();
        if (!val) return 'N/A';
        return <span className="text-slate-300 text-sm">{new Date(val).toLocaleString()}</span>;
      }
    },
    {
      header: 'Duration',
      accessorKey: 'duration_seconds',
      cell: info => (
        <span className="flex items-center gap-1.5 text-slate-300 text-sm">
          <Clock size={14} className="text-slate-500" />
          {formatDuration(info.getValue())}
        </span>
      )
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: info => {
        const status = info.getValue();
        if (status === 'resolved') {
          return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-xs font-medium border border-emerald-500/20"><CheckCircle size={12}/> Resolved</span>;
        }
        return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-500/10 text-rose-500 text-xs font-medium border border-rose-500/20">{status}</span>;
      }
    },
    {
      header: 'Resolution Notes',
      accessorKey: 'resolution_notes',
      cell: info => (
        <div className="text-sm text-slate-400 max-w-[250px] truncate" title={info.getValue()}>
          {info.getValue() || <span className="italic opacity-50">No notes provided</span>}
        </div>
      ),
    }
  ], []);

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SOS History</h1>
          <p className="text-slate-400 mt-1">Historical log of past emergencies and resolutions.</p>
        </div>
      </div>

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
              placeholder="Search history..."
              className="w-full pl-9 pr-4 py-2 bg-ops-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-ops-950 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-rose-500 focus:border-rose-500 block p-2"
            >
              <option value="all">All Statuses</option>
              <option value="resolved">Resolved</option>
              <option value="active">Active</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto bg-ops-900 p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
            </div>
          ) : (
            <DataTable 
              data={data} 
              columns={columns} 
              globalFilter={''} // Already filtered server side using globalFilter state
              setGlobalFilter={() => {}} 
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SosHistoryPage;
