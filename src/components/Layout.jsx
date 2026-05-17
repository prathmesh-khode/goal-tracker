import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, ClipboardList, CheckSquare, Users,
  BarChart3, LogOut, Menu, X, FileText, Shield,
  Share2, AlertTriangle, TrendingUp, Target,
} from 'lucide-react';

const nav = {
  employee: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/employee/dashboard' },
    { icon: ClipboardList, label: 'My Goals', path: '/employee/goals' },
    { icon: CheckSquare, label: 'Quarterly Check-in', path: '/employee/checkin' },
  ],
  manager: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/manager/dashboard' },
    { icon: Users, label: 'Team Goals', path: '/manager/team' },
    { icon: CheckSquare, label: 'Team Check-ins', path: '/manager/checkin' },
  ],
  admin: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
    { icon: Users, label: 'Users', path: '/admin/users' },
    { icon: Share2, label: 'Shared Goals', path: '/admin/shared-goals' },
    { icon: TrendingUp, label: 'Analytics', path: '/admin/analytics' },
    { icon: AlertTriangle, label: 'Escalations', path: '/admin/escalation' },
    { icon: BarChart3, label: 'Reports', path: '/admin/reports' },
    { icon: Shield, label: 'Audit Logs', path: '/admin/audit' },
  ],
};

const theme = {
  employee: { accent: 'bg-blue-600', ring: 'ring-blue-500', hover: 'hover:bg-blue-50 hover:text-blue-700', active: 'bg-blue-600 text-white', dot: 'bg-blue-500', avatar: 'bg-blue-100 text-blue-700', label: 'Employee' },
  manager:  { accent: 'bg-emerald-600', ring: 'ring-emerald-500', hover: 'hover:bg-slate-100 hover:text-slate-900', active: 'bg-emerald-600 text-white', dot: 'bg-emerald-500', avatar: 'bg-emerald-100 text-emerald-700', label: 'Manager' },
  admin:    { accent: 'bg-violet-600', ring: 'ring-violet-500', hover: 'hover:bg-slate-100 hover:text-slate-900', active: 'bg-violet-600 text-white', dot: 'bg-violet-500', avatar: 'bg-violet-100 text-violet-700', label: 'Admin' },
};

export default function Layout({ children }) {
  const { userRole, userProfile, logout } = useAuth();
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const items = nav[userRole] || [];
  const t = theme[userRole] || theme.employee;

  const initials = userProfile?.name
    ? userProfile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  async function handleLogout() {
    try { await logout(); navigate('/login'); }
    catch { toast.error('Logout failed.'); }
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* Sidebar */}
      <aside className={`${open ? 'w-60' : 'w-16'} transition-all duration-200 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col`}>

        {/* Logo bar */}
        <div className="flex items-center h-14 px-3 border-b border-slate-100 gap-2">
          {open && (
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className={`${t.accent} w-7 h-7 rounded-lg flex items-center justify-center shrink-0`}>
                <Target size={14} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 leading-none">GoalTrack</p>
                <p className="text-xs text-slate-400 mt-0.5">{t.label} Portal</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setOpen(o => !o)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {items.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={!open ? item.label : undefined}
                className={`flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  active ? `${t.active} shadow-sm` : `text-slate-600 ${t.hover}`
                }`}
              >
                <item.icon size={17} className="shrink-0" />
                {open && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-2 py-3 border-t border-slate-100 space-y-0.5">
          {open ? (
            <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
              <div className={`w-8 h-8 rounded-full ${t.avatar} font-bold text-xs flex items-center justify-center shrink-0`}>
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{userProfile?.name || 'User'}</p>
                <p className="text-xs text-slate-400 truncate">{userProfile?.designation}</p>
              </div>
            </div>
          ) : (
            <div className={`w-8 h-8 mx-auto rounded-full ${t.avatar} font-bold text-xs flex items-center justify-center mb-1`}>
              {initials}
            </div>
          )}
          <button
            onClick={handleLogout}
            title={!open ? 'Logout' : undefined}
            className="flex items-center gap-3 px-2.5 py-2 w-full rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition"
          >
            <LogOut size={17} className="shrink-0" />
            {open && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
