import React, { useState, useEffect, useMemo } from 'react';
import { 
  getBeneficiaries, getBeneficiaryMetrics, relinkBeneficiary, deleteBeneficiaryRelationship 
} from '../api/adminService';
import DataTable from '../components/common/DataTable';
import { 
  HeartHandshake, Search, Link2, Unlink, RefreshCw, ShieldAlert, 
  CheckCircle2, Clock, XCircle, Trash2, Check, X, AlertTriangle, 
  UserCheck, UserX, ArrowRight, Sparkles 
} from 'lucide-react';

const BeneficiariesPage = () => {
  const [data, setData] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, accepted, pending, declined
  const [healthFilter, setHealthFilter] = useState('all'); // all, orphaned, linked

  // Modals & Action states
  const [relinkTarget, setRelinkTarget] = useState(null);
  const [relinkTargetUserId, setRelinkTargetUserId] = useState('');
  const [forceConfirm, setForceConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [beneficiariesRes, metricsRes] = await Promise.all([
        getBeneficiaries(),
        getBeneficiaryMetrics()
      ]);
      setData(beneficiariesRes.data || []);
      setMetrics(metricsRes);
      setError(null);
    } catch (err) {
      console.error('Failed to load beneficiaries:', err);
      setError(err.message || 'Failed to load beneficiary relationships');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenRelinkModal = (beneficiary) => {
    setRelinkTarget(beneficiary);
    setRelinkTargetUserId(beneficiary.suggested_match ? beneficiary.suggested_match.id : '');
    setForceConfirm(beneficiary.status === 'pending');
  };

  const handleExecuteRelink = async () => {
    if (!relinkTarget) return;
    try {
      setActionLoading(true);
      const payload = {
        force_confirm: forceConfirm,
        ...(relinkTargetUserId.trim() ? { target_user_id: relinkTargetUserId.trim() } : {})
      };

      const result = await relinkBeneficiary(relinkTarget.id, payload);
      
      // Update local state
      setData(prev => prev.map(b => {
        if (b.id === relinkTarget.id) {
          return {
            ...b,
            registered_user_id: result.registered_user_id,
            registered_user_name: result.registered_user_name,
            is_orphaned: false,
            status: result.status,
            is_confirmed: result.is_confirmed
          };
        }
        return b;
      }));

      setActionMessage({ type: 'success', text: result.message || 'Beneficiary successfully re-linked' });
      setRelinkTarget(null);
      setTimeout(() => setActionMessage(null), 3500);
      getBeneficiaryMetrics().then(setMetrics).catch(() => {});
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to re-link beneficiary' });
      setTimeout(() => setActionMessage(null), 4000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRelationship = async () => {
    if (!deleteTarget) return;
    try {
      setActionLoading(true);
      await deleteBeneficiaryRelationship(deleteTarget.id);
      setData(prev => prev.filter(b => b.id !== deleteTarget.id));
      setActionMessage({ type: 'success', text: 'Beneficiary relationship deleted successfully' });
      setDeleteTarget(null);
      setTimeout(() => setActionMessage(null), 3000);
      getBeneficiaryMetrics().then(setMetrics).catch(() => {});
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete relationship' });
      setTimeout(() => setActionMessage(null), 4000);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (healthFilter === 'orphaned' && !item.is_orphaned) return false;
      if (healthFilter === 'linked' && item.is_orphaned) return false;
      return true;
    });
  }, [data, statusFilter, healthFilter]);

  const columns = useMemo(() => [
    {
      header: 'Requester (Owner)',
      accessorFn: row => `${row.sender_name} ${row.sender_phone || ''} ${row.sender_email || ''}`,
      cell: info => (
        <div>
          <div className="text-sm font-semibold text-white">{info.row.original.sender_name}</div>
          <div className="text-xs text-slate-400">{info.row.original.sender_phone || info.row.original.sender_email || 'No contact'}</div>
        </div>
      )
    },
    {
      header: 'Beneficiary Contact',
      accessorFn: row => `${row.recipient_name} ${row.recipient_phone}`,
      cell: info => (
        <div>
          <div className="text-sm font-medium text-slate-200">{info.row.original.recipient_name}</div>
          <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
            📞 {info.row.original.recipient_phone}
          </div>
        </div>
      )
    },
    {
      header: 'Account Link Status',
      accessorKey: 'is_orphaned',
      cell: info => {
        const item = info.row.original;
        if (item.is_orphaned) {
          return (
            <div className="flex flex-col gap-1 items-start">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Unlink size={12} /> Orphaned / Unlinked
              </span>
              {item.suggested_match && (
                <button
                  onClick={() => handleOpenRelinkModal(item)}
                  className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium underline"
                >
                  <Sparkles size={11} /> Match found: {item.suggested_match.name}
                </button>
              )}
            </div>
          );
        }
        return (
          <div className="flex flex-col">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Link2 size={12} /> Linked Account
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5">
              {item.registered_user_name || item.registered_user_email}
            </span>
          </div>
        );
      }
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: info => {
        const status = info.getValue() || 'pending';
        if (status === 'accepted') {
          return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 size={12} /> Accepted
            </span>
          );
        }
        if (status === 'declined') {
          return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <XCircle size={12} /> Declined
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock size={12} /> Pending
          </span>
        );
      }
    },
    {
      header: 'Created At',
      accessorKey: 'created_at',
      cell: info => {
        const val = info.getValue();
        if (!val) return <span className="text-slate-500">-</span>;
        const d = new Date(val);
        return <span className="text-xs text-slate-400">{d.toLocaleDateString()}</span>;
      }
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: info => {
        const item = info.row.original;
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleOpenRelinkModal(item)}
              title="Re-Link Account / Repair"
              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-md transition-colors"
            >
              <Link2 size={16} />
            </button>
            <button
              onClick={() => setDeleteTarget(item)}
              title="Delete Relationship"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      }
    }
  ], []);

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <HeartHandshake className="text-rose-500" size={26} />
            Beneficiary & Family Oversight
          </h1>
          <p className="text-slate-400 mt-1">Audit family relationships, resolve phone mismatches, and repair broken links.</p>
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
            <p className="text-xs font-medium text-slate-400">Total Relationships</p>
            <p className="text-2xl font-bold text-white mt-1">{metrics.total_beneficiaries}</p>
          </div>
          <div className="bg-ops-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-medium text-emerald-400">Accepted & Active</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{metrics.accepted}</p>
          </div>
          <div className="bg-ops-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-medium text-amber-400">Pending Approval</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{metrics.pending}</p>
          </div>
          <div 
            onClick={() => setHealthFilter(healthFilter === 'orphaned' ? 'all' : 'orphaned')}
            className={`cursor-pointer border rounded-xl p-4 shadow-sm transition-all ${
              metrics.orphaned_count > 0 
                ? 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/60' 
                : 'bg-ops-900 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-rose-400">Orphaned / Unlinked</p>
              {metrics.orphaned_count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold">Needs Fix</span>}
            </div>
            <p className="text-2xl font-bold text-rose-400 mt-1">{metrics.orphaned_count}</p>
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
              placeholder="Search sender, recipient, phone..."
              className="w-full pl-9 pr-4 py-2 bg-ops-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Health Filter */}
            <select
              value={healthFilter}
              onChange={e => setHealthFilter(e.target.value)}
              className="bg-ops-950 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-rose-500 focus:border-rose-500 p-2 font-medium"
            >
              <option value="all">All Health States</option>
              <option value="orphaned">⚠️ Orphaned / Unlinked Only</option>
              <option value="linked">✅ Fully Linked</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-ops-950 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-rose-500 focus:border-rose-500 p-2"
            >
              <option value="all">All Request Statuses</option>
              <option value="accepted">Accepted</option>
              <option value="pending">Pending</option>
              <option value="declined">Declined</option>
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
              <p className="text-base font-medium text-rose-400">Error Loading Beneficiaries</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-slate-500">
              <HeartHandshake size={40} className="text-slate-600 mb-3" />
              <p className="text-base font-medium text-slate-300">No Relationships Found</p>
              <p className="text-sm mt-1">Try adjusting your filters or search terms.</p>
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

      {/* Re-Link Account Modal */}
      {relinkTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-ops-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="text-amber-400" size={20} />
                <h3 className="font-semibold text-white">Re-Link Beneficiary Account</h3>
              </div>
              <button
                onClick={() => setRelinkTarget(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-ops-950 border border-slate-800 rounded-lg p-3 text-xs space-y-1.5 text-slate-300">
                <p><strong>Owner:</strong> {relinkTarget.sender_name} ({relinkTarget.sender_phone || relinkTarget.sender_email})</p>
                <p><strong>Beneficiary Name:</strong> {relinkTarget.recipient_name}</p>
                <p><strong>Beneficiary Phone:</strong> <span className="text-amber-400 font-mono font-bold">{relinkTarget.recipient_phone}</span></p>
              </div>

              {relinkTarget.suggested_match && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                    <Sparkles size={14} /> Auto-Matched Registered Account
                  </div>
                  <p className="text-slate-200">Name: <strong>{relinkTarget.suggested_match.name}</strong></p>
                  <p className="text-slate-300">Email: {relinkTarget.suggested_match.email}</p>
                  <p className="text-slate-400 font-mono text-[10px]">User ID: {relinkTarget.suggested_match.id}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Target Registered User ID (Optional override)
                </label>
                <input
                  type="text"
                  value={relinkTargetUserId}
                  onChange={e => setRelinkTargetUserId(e.target.value)}
                  placeholder="Leave empty for auto-match by phone number"
                  className="w-full px-3 py-2 bg-ops-950 border border-slate-700 rounded-lg text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  If left blank, the system automatically checks for an active user with matching phone variants (e.g. +234 / 080).
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="forceConfirm"
                  checked={forceConfirm}
                  onChange={e => setForceConfirm(e.target.checked)}
                  className="rounded border-slate-700 bg-ops-950 text-rose-500 focus:ring-rose-500 h-4 w-4"
                />
                <label htmlFor="forceConfirm" className="text-xs text-slate-300 select-none cursor-pointer">
                  Auto-mark relationship as <strong>Accepted & Confirmed</strong> (bypasses pending state)
                </label>
              </div>
            </div>

            <div className="p-4 bg-ops-950 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setRelinkTarget(null)}
                disabled={actionLoading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRelink}
                disabled={actionLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                {actionLoading && <RefreshCw size={14} className="animate-spin" />}
                Link Relationship
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Relationship Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-ops-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-500 mb-4">
              <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Beneficiary Link?</h3>
                <p className="text-xs text-slate-400">Permanently removes this family relationship.</p>
              </div>
            </div>

            <div className="bg-ops-950 border border-slate-800 rounded-lg p-3 my-4 text-xs text-slate-300">
              <p><strong>Owner:</strong> {deleteTarget.sender_name}</p>
              <p className="mt-1"><strong>Beneficiary:</strong> {deleteTarget.recipient_name} ({deleteTarget.recipient_phone})</p>
              <p className="mt-1"><strong>Status:</strong> <span className="capitalize">{deleteTarget.status}</span></p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={actionLoading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRelationship}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {actionLoading && <RefreshCw size={14} className="animate-spin" />}
                Delete Relationship
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BeneficiariesPage;
