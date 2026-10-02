import React, { useState, useEffect, useMemo } from 'react';
import { getUsers } from '../api/adminService';
import DataTable from '../components/common/DataTable';
import { Search, ChevronDown, ChevronUp, ChevronsUpDown, Shield, UserCheck, ShieldAlert, MoreHorizontal } from 'lucide-react';
import UserDetailDrawer from '../components/users/UserDetailDrawer';

const UsersPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, suspended, unverified
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await getUsers();
        setData(users);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch users:', err);
        setError(err.message || 'Failed to load users');
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(user => {
      if (statusFilter === 'active') return user.verified && !user.banned;
      if (statusFilter === 'suspended') return user.banned;
      if (statusFilter === 'unverified') return !user.verified;
      return true;
    });
  }, [data, statusFilter]);

  const columns = useMemo(() => [
    {
      header: 'Name',
      accessorKey: 'name',
      cell: info => <span className="font-medium text-white">{info.getValue()}</span>,
    },
    {
      header: 'Email / Phone',
      accessorFn: row => `${row.email} ${row.phone}`,
      cell: info => (
        <div>
          <div className="text-sm text-slate-300">{info.row.original.email}</div>
          <div className="text-xs text-slate-500">{info.row.original.phone}</div>
        </div>
      ),
    },
    {
      header: 'Status',
      accessorFn: row => row.banned ? 'Banned' : (row.verified ? 'Verified' : 'Unverified'),
      cell: info => {
        const { banned, verified } = info.row.original;
        if (banned) return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-500/10 text-rose-500 text-xs font-medium border border-rose-500/20"><Shield size={12}/> Banned</span>;
        if (verified) return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-xs font-medium border border-emerald-500/20"><UserCheck size={12}/> Verified</span>;
        return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 text-amber-500 text-xs font-medium border border-amber-500/20"><ShieldAlert size={12}/> Unverified</span>;
      }
    },
    {
      header: 'Trips',
      accessorKey: 'trips',
      cell: info => <span className="text-slate-400">{info.getValue()}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: info => (
        <button 
          onClick={() => {
            setSelectedUser(info.row.original);
            setIsDrawerOpen(true);
          }}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <MoreHorizontal size={18} />
        </button>
      ),
    }
  ], []);

  const handleUserUpdate = (updatedUser) => {
    if (updatedUser._deleted) {
      setData(prev => prev.filter(u => u.id !== updatedUser.id));
      setSelectedUser(null);
    } else {
      setData(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      setSelectedUser(updatedUser);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">User Management</h1>
          <p className="text-slate-400 mt-1">Directory of all registered VibeMap users.</p>
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
              placeholder="Search users..."
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
              <option value="active">Active & Verified</option>
              <option value="unverified">Unverified</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto bg-ops-900 p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center text-slate-500">
              <ShieldAlert size={48} className="text-rose-500/50 mb-4" />
              <p className="text-lg font-medium text-rose-400">Error Loading Users</p>
              <p className="text-sm mt-1">{error}</p>
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

      <UserDetailDrawer 
        user={selectedUser} 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        onUpdate={handleUserUpdate}
      />
    </div>
  );
};

export default UsersPage;
