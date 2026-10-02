import React, { useState } from 'react';
import { X, Shield, ShieldAlert, UserCheck, Calendar, Activity, Phone, Mail, Edit2, Check, Trash2 } from 'lucide-react';
import { updateUserStatus, overrideUserContact, deleteUserAccount } from '../../api/adminService';

const UserDetailDrawer = ({ user, isOpen, onClose, onUpdate }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editForm, setEditForm] = useState({ email: '', phone: '', is_verified: false });
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !user) return null;

  // Initialize form when editing starts
  const handleStartEdit = () => {
    setEditForm({ email: user.email, phone: user.phone, is_verified: user.verified });
    setIsEditingContact(true);
  };

  const handleSaveContact = async () => {
    setIsUpdating(true);
    try {
      const data = {};
      if (editForm.email !== user.email) data.email = editForm.email;
      if (editForm.phone !== user.phone) data.phone = editForm.phone;
      if (editForm.is_verified !== user.verified) data.is_verified = editForm.is_verified;

      if (Object.keys(data).length > 0) {
        await overrideUserContact(user.id, data);
        onUpdate({ ...user, ...editForm, verified: editForm.is_verified });
      }
      setIsEditingContact(false);
    } catch (err) {
      alert(`Error updating user: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusToggle = async (field, value) => {
    setIsUpdating(true);
    try {
      if (field === 'banned') {
        const is_active = !value;
        await updateUserStatus(user.id, { is_active, ban_reason: is_active ? null : 'Admin suspended' });
      } else {
        await updateUserStatus(user.id, { [field]: value });
      }
      onUpdate({ ...user, [field]: value });
    } catch (err) {
      alert(`Error updating status: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (deleteConfirmation !== 'DELETE') return;
    setIsDeleting(true);
    try {
      await deleteUserAccount(user.id);
      onUpdate({ ...user, _deleted: true }); // Parent should handle removal from list
      onClose();
    } catch (err) {
      alert(`Error deleting user: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return '?';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className={`fixed inset-y-0 right-0 w-full max-w-md bg-ops-900 border-l border-slate-800 shadow-2xl z-50 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">User Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 -mr-2">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {/* Header Profile */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xl font-bold text-slate-300">
              {getInitials(user.name)}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{user.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                {user.verified ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    <UserCheck size={12} /> Verified
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    <ShieldAlert size={12} /> Unverified
                  </span>
                )}
                {user.banned && (
                  <span className="flex items-center gap-1 text-xs font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                    <Shield size={12} /> Banned
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Contact Info / Override */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Contact Information</h4>
              {!isEditingContact ? (
                <button onClick={handleStartEdit} className="text-slate-400 hover:text-white text-xs flex items-center gap-1">
                  <Edit2 size={14} /> Edit
                </button>
              ) : (
                <button onClick={handleSaveContact} disabled={isUpdating} className="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1">
                  <Check size={14} /> {isUpdating ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
            
            <div className="bg-ops-950 border border-slate-800 rounded-lg p-4 space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-slate-500" />
                {isEditingContact ? (
                  <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="bg-ops-900 border border-slate-700 rounded px-2 py-1 text-slate-200 w-full" />
                ) : (
                  <span className="text-slate-300">{user.email}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-slate-500" />
                {isEditingContact ? (
                  <input type="text" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="bg-ops-900 border border-slate-700 rounded px-2 py-1 text-slate-200 w-full" />
                ) : (
                  <span className="text-slate-300">{user.phone}</span>
                )}
              </div>
              
              {isEditingContact && (
                <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
                  <ShieldAlert size={16} className="text-slate-500" />
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input type="checkbox" checked={editForm.is_verified} onChange={e => setEditForm({...editForm, is_verified: e.target.checked})} className="rounded bg-ops-900 border-slate-700 text-emerald-500 focus:ring-emerald-500" />
                    Manually Verify User
                  </label>
                </div>
              )}

              {!isEditingContact && (
                <div className="flex items-center gap-3 text-slate-300 pt-2 border-t border-slate-800">
                  <Calendar size={16} className="text-slate-500" /> Joined {user.registeredAt ? new Date(user.registeredAt).toLocaleDateString() : 'Unknown'}
                </div>
              )}
            </div>
          </div>

          {/* Activity Metrics */}
          <div className="space-y-4 mb-8">
            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">App Activity</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-ops-950 border border-slate-800 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-white">{user.trips || 0}</p>
                <p className="text-xs text-slate-400 mt-1">Total Trips</p>
              </div>
              <div className="bg-ops-950 border border-slate-800 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-white">{user.beneficiaries || 0}</p>
                <p className="text-xs text-slate-400 mt-1">Linked Beneficiaries</p>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-rose-500 uppercase tracking-wider">Danger Zone</h4>
            <div className="bg-rose-950/20 border border-rose-900/50 rounded-lg p-4 space-y-6">
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">Account Suspension</p>
                  <p className="text-xs text-slate-500 mt-1">Prevent user from logging in</p>
                </div>
                <button
                  disabled={isUpdating}
                  onClick={() => handleStatusToggle('banned', !user.banned)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    user.banned ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-rose-600/20 text-rose-400 border border-rose-600/30 hover:bg-rose-600/30'
                  }`}
                >
                  {isUpdating ? '...' : user.banned ? 'Unban User' : 'Ban User'}
                </button>
              </div>

              <div className="pt-4 border-t border-rose-900/30">
                <p className="text-sm font-medium text-rose-400 mb-1">GDPR Account Deletion</p>
                <p className="text-xs text-slate-400 mb-3">Permanently delete user and cascade destroy all related data (trips, SOS history). This cannot be undone.</p>
                
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Type DELETE to confirm" 
                    value={deleteConfirmation}
                    onChange={e => setDeleteConfirmation(e.target.value)}
                    className="flex-1 bg-ops-950 border border-rose-900/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
                  />
                  <button
                    disabled={deleteConfirmation !== 'DELETE' || isDeleting}
                    onClick={handleDeleteUser}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Trash2 size={16} />
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default UserDetailDrawer;
