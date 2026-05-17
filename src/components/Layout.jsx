import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Target, Home, CheckSquare, Users, BarChart2,
  LogOut, Menu, X, FileText, Shield, PlusCircle,
  ClipboardList,
} from 'lucide-react';

const navConfig = {
  employee: [
    { icon: Home, label: 'Dashboard', path: '/employee/dashboard' },
    { icon: ClipboardList, label: 'My Goals', path: '/employee/goals' },
    { icon: CheckSquare, label: 'Quarterly Check-in', path: '/employee/checkin' },
  ],
  manager: [
    { icon: Home, label: 'Dashboard', path: '/manager/dashboard' },
    { icon: Users, label: 'Team Goals', path: '/manager/team' },
    { icon: CheckSquare, label: 'Check-ins', path: '/manager/checkin' },
  ],
  admin: [
    { icon: Home, label: 'Dashboard', path: '/admin/dashboard' },
    { icon: Users, label: 'User Management', path: '/admin/users' },
    { icon: BarChart2, label: 'Reports', path: '/admin/reports' },
    { icon: Shield, label: 'Audit Logs', path: '/admin/audit' },
  ],
};

const roleConfig = {
  employee: {
    color: 'bg-blue-600',
    light: 'bg-blue-50',
    text: 'text-blue-700',
    label: 'Employee',
    gradient: 'from-blue-600 to-blue-700',
  },
  manager: {
    color: 'bg-emerald-600',
    light: 'bg-emerald-50',
    text: 'text-emerald-700',
    label: 'Manager',
    gradient: 'from-emerald-600 to-emerald-700',
  },
  admin: {
    color: 'bg-purple-600',
    light: 'bg-purple-50',
    text: 'text-purple-700',
    label: 'Administrator',
    gradient: 'from-purple-600 to-purple-700',
  },
};

export default function Layout({ children, title }) {
  const { userRole, userProfile, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = navConfig[userRole] || [];
  const rc = roleConfig[userRole] || roleConfig.employee;

  async function handleLogout() {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch {
      toast.error('Logout failed');
    }
  }

  const initials = userProfile?.name
    ? userProfile.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-16'} transition-all duration-300 ease-in-out flex-shrink-0 bg-white border-r border-slate-200 flex flex-col shadow-sm`}
      >
        {/* Logo */}
        <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} px-4 py-4 border-b border-slate-200`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <div className={`bg-gradient-to-br ${rc.gradient} p-2 rounded-lg`}>
                <Target className="text-white" size={18} />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm leading-none">GoalTrack</p>
                <p className="text-xs text-slate-400 mt-0.5">{rc.label}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-500"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={!sidebarOpen ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                  isActive
                    ? `${rc.color} text-white shadow-sm`
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <item.icon size={18} className="flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="px-3 py-4 border-t border-slate-200">
          {sidebarOpen ? (
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className={`w-9 h-9 rounded-full ${rc.color} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {userProfile?.name || 'User'}
                </p>
                <p className="text-xs text-slate-400 truncate">{userProfile?.department}</p>
              </div>
            </div>
          ) : (
            <div className={`w-9 h-9 rounded-full ${rc.color} flex items-center justify-center text-white font-semibold text-sm mx-auto mb-3`}>
              {initials}
            </div>
          )}

          <button
            onClick={handleLogout}
            title={!sidebarOpen ? 'Logout' : undefined}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-red-500 hover:bg-red-50 transition text-sm font-medium"
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Bar */}
        {title && (
          <div className="bg-white border-b border-slate-200 px-6 py-4">
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          </div>
        )}
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
