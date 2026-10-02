import React, { useState, useEffect, useMemo } from 'react';
import { getAdmins, promoteAdmin, demoteAdmin, getUsers, getAuditLogs } from '../api/adminService';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/common/DataTable';
import { 
  ShieldCheck, UserPlus, Trash2, Search, RefreshCw, 
  ShieldAlert, UserX, Check, X, Shield, AlertTriangle, 
  History, User, Activity, FileText, MapPin, HeartHandshake, Radio 
} from 'lucide-react';

const AdminAccessPage = () => {
  const { user: currentAuthUser } = useAuth();
  const [activeTab, setActiveTab] = useState('admins'); // 'admins' | 'audit'

  // Admin list state
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');

  // Promote Modal state
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUserToPromote, setSelectedUserToPromote] = useState(null);

  // Demote Modal state
  const [demoteTarget, setDemoteTarget] = useState(null);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const data = await getAdmins();
      setAdmins(data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load admins:', err);
      setError(err.message || 'Failed to load administrator accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setAuditLoading(true);
      const res = await getAuditLogs();
      setAuditLogs(res.data || []);
      setAuditError(null);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      setAuditError(err.message || 'Failed to load audit trail');
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const handleOpenPromoteModal = async () => {
    setIsPromoteOpen(true);
    setSelectedUserToPromote(null);
    setUserSearchQuery('');
    try {
      const users = await getUsers();
      setAllUsers(users || []);
    } catch (err) {
      console.error('Failed to fetch user directory:', err);
    }
  };

  const handleExecutePromote = async () => {
    if (!selectedUserToPromote) return;
    try {
      setActionLoading(true);
      const res = await promoteAdmin(selectedUserToPromote.id);
      setFeedback({ type: 'success', text: res.message || 'User promoted to Admin successfully!' });
      setIsPromoteOpen(false);
      setTimeout(() => setFeedback(null), 4000);
      fetchAdmins();
      if (activeTab === 'audit') fetchAuditLogs();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to promote user' });
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteDemote = async () => {
    if (!demoteTarget) return;
    try {
      setActionLoading(true);
      const res = await demoteAdmin(demoteTarget.id);
      setFeedback({ type: 'success', text: res.message || 'Admin privileges revoked' });
      setDemoteTarget(null);
      setTimeout(() => setFeedback(null), 4000);
      fetchAdmins();
      if (activeTab === 'audit') fetchAuditLogs();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to revoke admin role' });
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredCandidateUsers = allUsers.filter(u => {
    if (admins.some(a => a.id === u.id)) return false; // Already admin
    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q))
    );
  }).slice(0, 8);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (auditActionFilter !== 'all' && log.action !== auditActionFilter) return false;
      return true;
    });
  }, [auditLogs, auditActionFilter]);

  const auditColumns = useMemo(() => [
    {
      header: 'Admin Operator',
      accessorFn: row => `${row.admin_name} ${row.admin_email}`,
      cell: info => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-rose-500/20 text-rose-400 font-bold flex items-center justify-center text-xs">
            {info.row.original.admin_name?.charAt(0) || 'A'}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{info.row.original.admin_name}</p>
            <p className="text-xs text-slate-400 font-mono">{info.row.original.admin_email}</p>
          </div>
        </div>
      )
    },
    {
      header: 'Action Taken',
      accessorKey: 'action',
      cell: info => {
        const action = info.getValue() || '';
        let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
        if (action.includes('USER_SUSPENDED') || action.includes('DELETED') || action.includes('DEMOTED')) {
          badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
        } else if (action.includes('ACTIVATED') || action.includes('PROMOTED') || action.includes('RELINKED')) {
          badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        } else if (action.includes('BROADCAST') || action.includes('TARGETED')) {
          badgeColor = 'bg-sky-500/10 text-sky-400 border-sky-500/20';
        } else if (action.includes('LEGAL')) {
          badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        }

        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border ${badgeColor}`}>
            {action}
          </span>
        );
      }
    },
    {
      header: 'Target / Entity',
      accessorKey: 'target_type',
      cell: info => (
        <span className="text-xs text-slate-400 capitalize">
          {info.getValue() || 'System'}
        </span>
      )
    },
    {
      header: 'Details & Impact',
      accessorKey: 'details',
      cell: info => (
        <div className="max-w-md text-xs text-slate-300">
          {info.getValue() || '-'}
        </div>
      )
    },
    {
      header: 'Timestamp',
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
            <ShieldCheck className="text-rose-500" size={26} />
            Admin Team & Activity Audit
          </h1>
          <p className="text-slate-400 mt-1">Manage team privileges and review the chronological audit trail of all operator actions.</p>
        </div>
        {activeTab === 'admins' && (
          <button
            onClick={handleOpenPromoteModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-rose-600/20 self-start sm:self-auto"
          >
            <UserPlus size={16} />
            Grant New Admin Role
          </button>
        )}
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div className={`p-3 rounded-lg text-sm font-medium border flex items-center justify-between transition-all ${
          feedback.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('admins')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'admins'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield size={16} /> Administrator Team ({admins.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'audit'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History size={16} /> Activity Audit Trail Logs
        </button>
      </div>

      {/* Tab 1: Admins Table */}
      {activeTab === 'admins' && (
        <div className="bg-ops-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              Active Administrators
            </h2>
            <button
              onClick={fetchAdmins}
              disabled={loading}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 font-medium"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
              </div>
            ) : error ? (
              <div className="p-8 text-center text-rose-400">
                <ShieldAlert size={36} className="mx-auto mb-2" />
                <p>{error}</p>
              </div>
            ) : admins.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p>No administrator accounts found.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-ops-950 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3">Administrator</th>
                    <th className="px-6 py-3">Contact</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Account Status</th>
                    <th className="px-6 py-3">Date Added</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {admins.map(admin => {
                    const isSelf = currentAuthUser?.email === admin.email;
                    return (
                      <tr key={admin.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold flex items-center justify-center text-xs">
                            {admin.name?.charAt(0) || 'A'}
                          </div>
                          <div>
                            <span>{admin.name}</span>
                            {isSelf && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold">You</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          <p className="text-slate-300">{admin.email}</p>
                          <p>{admin.phone || 'No phone'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <Shield size={12} /> Super Admin
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {admin.is_active ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                              <Check size={14} /> Active
                            </span>
                          ) : (
                            <span className="text-xs text-rose-400">Suspended</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {admin.created_at ? new Date(admin.created_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {!isSelf && (
                            <button
                              onClick={() => setDemoteTarget(admin)}
                              title="Revoke Admin Access"
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Audit Logs Table */}
      {activeTab === 'audit' && (
        <div className="bg-ops-900 border border-slate-800 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-slate-500" />
              </div>
              <input
                type="text"
                value={auditSearchQuery}
                onChange={e => setAuditSearchQuery(e.target.value)}
                placeholder="Search audit trail..."
                className="w-full pl-9 pr-4 py-2 bg-ops-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={auditActionFilter}
                onChange={e => setAuditActionFilter(e.target.value)}
                className="bg-ops-950 border border-slate-700 text-slate-300 text-xs rounded-lg focus:ring-rose-500 focus:border-rose-500 p-2"
              >
                <option value="all">All Action Types</option>
                <option value="USER_SUSPENDED">User Suspended</option>
                <option value="USER_ACTIVATED">User Activated</option>
                <option value="USER_OVERRIDE">User Details Override</option>
                <option value="USER_DELETED">User Deleted</option>
                <option value="SOS_RESOLVED">SOS Resolved</option>
                <option value="PIN_ACTIVATED">Pin Activated</option>
                <option value="PIN_HIDDEN">Pin Hidden</option>
                <option value="PIN_DELETED">Pin Deleted</option>
                <option value="BENEFICIARY_RELINKED">Beneficiary Re-linked</option>
                <option value="BENEFICIARY_DELETED">Beneficiary Deleted</option>
                <option value="BROADCAST_SENT">Broadcast Sent</option>
                <option value="TARGETED_NOTIFICATION_SENT">Direct Message Sent</option>
                <option value="ADMIN_PROMOTED">Admin Promoted</option>
                <option value="ADMIN_DEMOTED">Admin Demoted</option>
                <option value="LEGAL_DOC_UPDATED">Legal Content Updated</option>
              </select>

              <button
                onClick={fetchAuditLogs}
                disabled={auditLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700"
              >
                <RefreshCw size={13} className={auditLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-ops-900 p-4">
            {auditLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
              </div>
            ) : auditError ? (
              <div className="flex h-64 flex-col items-center justify-center text-slate-500">
                <ShieldAlert size={40} className="text-rose-500/50 mb-3" />
                <p className="text-base font-medium text-rose-400">Error Loading Audit Trail</p>
                <p className="text-sm mt-1">{auditError}</p>
              </div>
            ) : filteredAuditLogs.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-slate-500">
                <History size={40} className="text-slate-600 mb-3" />
                <p className="text-base font-medium text-slate-300">No Audit Logs Found</p>
                <p className="text-sm mt-1">Actions performed by administrators will appear here in real-time.</p>
              </div>
            ) : (
              <DataTable 
                data={filteredAuditLogs} 
                columns={auditColumns} 
                globalFilter={auditSearchQuery} 
                setGlobalFilter={setAuditSearchQuery} 
              />
            )}
          </div>
        </div>
      )}

      {/* Grant Admin Role Modal */}
      {isPromoteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-ops-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-rose-500" size={20} />
                <h3 className="font-semibold text-white">Grant Admin Privileges</h3>
              </div>
              <button
                onClick={() => setIsPromoteOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Search Registered Users
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-slate-500" />
                  </div>
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={e => setUserSearchQuery(e.target.value)}
                    placeholder="Search by name, email, or phone..."
                    className="w-full pl-9 pr-4 py-2.5 bg-ops-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Candidate user list */}
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {filteredCandidateUsers.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No matching eligible users found.</p>
                ) : (
                  filteredCandidateUsers.map(u => {
                    const isSelected = selectedUserToPromote?.id === u.id;
                    return (
                      <div
                        key={u.id}
                        onClick={() => setSelectedUserToPromote(u)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-rose-500/10 border-rose-500 text-white ring-1 ring-rose-500'
                            : 'bg-ops-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <p className="font-medium text-sm text-white">{u.name}</p>
                          <p className="text-xs text-slate-400">{u.email} • {u.phone}</p>
                        </div>
                        {isSelected && <Check size={16} className="text-rose-500 font-bold" />}
                      </div>
                    );
                  })
                )}
              </div>

              {selectedUserToPromote && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300 space-y-1">
                  <p className="font-bold">⚠️ Elevating Access</p>
                  <p>Granting admin privileges gives <strong>{selectedUserToPromote.name}</strong> full operational oversight over SOS incidents, user management, and broadcast controls.</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-ops-950 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setIsPromoteOpen(false)}
                disabled={actionLoading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExecutePromote}
                disabled={actionLoading || !selectedUserToPromote}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {actionLoading && <RefreshCw size={14} className="animate-spin" />}
                Confirm Admin Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Admin Modal */}
      {demoteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-ops-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-500 mb-4">
              <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Revoke Admin Privileges?</h3>
                <p className="text-xs text-slate-400">Remove administrator access for this account.</p>
              </div>
            </div>

            <div className="bg-ops-950 border border-slate-800 rounded-lg p-3 my-4 text-xs text-slate-300">
              <p><strong>Name:</strong> {demoteTarget.name}</p>
              <p className="mt-1"><strong>Email:</strong> {demoteTarget.email}</p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDemoteTarget(null)}
                disabled={actionLoading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDemote}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {actionLoading && <RefreshCw size={14} className="animate-spin" />}
                Revoke Privileges
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAccessPage;
