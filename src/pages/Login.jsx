import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Loader2, Target } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      toast.error('Incorrect email or password.');
    }
    setLoading(false);
  }

  function fill(role) {
    const map = {
      employee: ['employee@demo.com', 'Demo@123'],
      manager:  ['manager@demo.com',  'Demo@123'],
      admin:    ['admin@demo.com',     'Demo@123'],
    };
    setEmail(map[role][0]);
    setPassword(map[role][1]);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-slate-900 to-indigo-950">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 w-9 h-9 rounded-xl flex items-center justify-center">
            <Target size={18} className="text-white" />
          </div>
          <span className="text-white font-bold text-lg">GoalTrack</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white leading-snug mb-4">
            Align goals.<br />Track progress.<br />Drive results.
          </h1>
          <p className="text-slate-400 text-base leading-relaxed">
            A structured performance management portal for goal setting, quarterly check-ins, and real-time visibility across your organisation.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { label: 'Goal Setting', desc: 'Structured creation with validation rules' },
              { label: 'Manager Approval', desc: 'Review, edit and approve team goals' },
              { label: 'Analytics', desc: 'Real-time dashboards and progress tracking' },
            ].map(f => (
              <div key={f.label} className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white text-sm font-semibold">{f.label}</p>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-xs">© 2025 GoalTrack. Performance Management Portal.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center">
              <Target size={16} className="text-white" />
            </div>
            <span className="font-bold text-slate-900">GoalTrack</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
          <p className="text-slate-500 text-sm mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-slate-900 placeholder-slate-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-11 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2 text-sm mt-2"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : 'Sign in'}
            </button>
          </form>

          <div className="mt-8">
            <p className="text-xs text-center text-slate-400 mb-3 font-medium uppercase tracking-wide">Demo accounts</p>
            <div className="space-y-2">
              {[
                { role: 'employee', label: 'Employee', email: 'employee@demo.com', color: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50' },
                { role: 'manager',  label: 'Manager',  email: 'manager@demo.com',  color: 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50' },
                { role: 'admin',    label: 'Admin',    email: 'admin@demo.com',    color: 'border-violet-200 hover:border-violet-400 hover:bg-violet-50' },
              ].map(d => (
                <button
                  key={d.role}
                  onClick={() => fill(d.role)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 border rounded-xl transition text-left ${d.color}`}
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{d.label}</p>
                    <p className="text-xs text-slate-400">{d.email}</p>
                  </div>
                  <span className="text-xs text-slate-400">Click to fill →</span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            First time?{' '}
            <a href="/setup" className="text-indigo-600 hover:underline font-medium">Run setup</a>
            {' '}to create demo accounts.
          </p>
        </div>
      </div>
    </div>
  );
}
