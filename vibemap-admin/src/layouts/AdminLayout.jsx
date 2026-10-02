import React, { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import { Bell, Menu, User, LogOut } from 'lucide-react';
import { getLiveSos } from '../api/adminService';

const AdminLayout = () => {
  const { isAuthenticated, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSosCount, setActiveSosCount] = useState(0);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    // Clock tick
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Poll for SOS count
    const fetchSos = async () => {
      const sosList = await getLiveSos();
      setActiveSosCount(sosList.length);
    };
    fetchSos();
    const interval = setInterval(fetchSos, 10000); // Poll every 10s for header
    return () => clearInterval(interval);
  }, []);


  return (
    <div className="flex h-screen overflow-hidden bg-ops-950 text-slate-200">
      {/* Sidebar - Desktop & Mobile Drawer */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} activeSosCount={activeSosCount} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 bg-ops-900 border-b border-slate-800 h-16 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 text-slate-400 hover:text-slate-100"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full text-xs font-medium">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              System Operational
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:block text-sm text-slate-400 font-mono">
              {time.toLocaleTimeString('en-US', { timeZone: 'UTC', hour12: false })} UTC |{' '}
              {time.toLocaleTimeString('en-US', { timeZone: 'Africa/Lagos', hour12: false })} WAT
            </div>

            <div className="relative flex items-center">
              <Bell className="text-slate-400" size={20} />
              {activeSosCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 text-[10px] items-center justify-center text-white font-bold">
                    {activeSosCount}
                  </span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 border-l border-slate-700 pl-6">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                <User size={16} className="text-slate-300" />
              </div>
              <div className="hidden sm:block text-sm">
                <div className="font-medium">Ops Commander</div>
                <div className="text-slate-500 text-xs">Admin</div>
              </div>
              <button
                onClick={logout}
                className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors ml-2"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-ops-950 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
