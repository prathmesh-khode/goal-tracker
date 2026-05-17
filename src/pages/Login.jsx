import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Target, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      // Navigation happens automatically via RoleRedirect in App.jsx
    } catch (error) {
      toast.error('Invalid email or password. Please try again.');
    }
    setLoading(false);
  }

  function fillDemo(role) {
    const creds = {
      employee: { email: 'employee@demo.com', password: 'Demo@123' },
      manager: { email: 'manager@demo.com', password: 'Demo@123' },
      admin: { email: 'admin@demo.com', password: 'Demo@123' },
    };
    setEmail(creds[role].email);
    setPassword(creds[role].password);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
              <Target className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white">GoalTrack</h1>
            <p className="text-blue-200 text-sm mt-1">Performance Management Portal</p>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Sign in to your account</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-gray-900 placeholder-gray-400"
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-gray-900 placeholder-gray-400"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Quick Login Buttons */}
            <div className="mt-6">
              <p className="text-xs text-center text-gray-400 uppercase font-semibold mb-3">
                Quick Demo Login
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { role: 'employee', label: '👤 Employee', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
                  { role: 'manager', label: '👔 Manager', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
                  { role: 'admin', label: '🔑 Admin', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
                ].map(({ role, label, color }) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => fillDemo(role)}
                    className={`text-xs py-2 px-1 rounded-lg font-medium transition ${color}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-center text-gray-400 mt-2">
                Click to fill credentials, then Sign In
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-blue-300 text-xs mt-4">
          First time? Go to{' '}
          <a href="/setup" className="text-white underline">
            /setup
          </a>{' '}
          to create demo accounts
        </p>
      </div>
    </div>
  );
}
