import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, RadioReceiver, Users, X, History, 
  MapPin, HeartHandshake, Navigation, Activity, Bell, ShieldCheck, FileText 
} from 'lucide-react';

const Sidebar = ({ isOpen, setIsOpen, activeSosCount }) => {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Live SOS Triage', path: '/sos', icon: RadioReceiver, badge: activeSosCount },
    { name: 'SOS History', path: '/sos/history', icon: History },
    { name: 'User Management', path: '/users', icon: Users },
    { name: 'Vibe Pins Moderation', path: '/pins', icon: MapPin },
    { name: 'Beneficiary Oversight', path: '/beneficiaries', icon: HeartHandshake },
    { name: 'Trips & Navigation', path: '/trips', icon: Navigation },
    { name: 'System Diagnostics', path: '/system', icon: Activity },
    { name: 'Broadcast & Push', path: '/broadcast', icon: Bell },
    { name: 'Admin Team Access', path: '/access', icon: ShieldCheck },
    { name: 'Legal Policy CMS', path: '/legal', icon: FileText },
  ];

  const sidebarClass = `fixed inset-y-0 left-0 z-50 w-64 bg-ops-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col ${
    isOpen ? 'translate-x-0' : '-translate-x-full'
  }`;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={sidebarClass}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-rose-600 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">VibeMap Ops</span>
          </div>
          <button
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setIsOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon size={20} />
                  <span className="font-medium">{item.name}</span>
                </div>
                {item.badge > 0 && (
                  <span className="bg-rose-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <p className="text-xs text-slate-400 font-medium mb-1">System Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-sm text-emerald-400">All services online</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
