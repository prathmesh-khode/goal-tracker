import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { ArrowRight, AlertCircle, Clock } from 'lucide-react';

function getCurrentPhase() {
  const m = new Date().getMonth() + 1;
  if (m === 5 || m === 6) return 'setting';
  if (m === 7) return 'q1';
  if (m === 10) return 'q2';
  if (m === 1) return 'q3';
  if (m === 3 || m === 4) return 'q4';
  return 'q1';
}

const phaseLabels = {
  setting: 'Goal Setting',
  q1: 'Q1 Check-in',
  q2: 'Q2 Check-in',
  q3: 'Q3 Check-in',
  q4: 'Q4 / Annual Review',
};

const statusStyle = {
  draft: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  locked: 'bg-blue-100 text-blue-700',
};

const statusLabel = {
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Returned',
  locked: 'Locked',
};

export default function EmployeeDashboard() {
  const { currentUser, userProfile } = useAuth();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const phase = getCurrentPhase();
  const firstName = userProfile?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    if (!currentUser) return;
    getDocs(query(collection(db, 'goals'), where('employeeId', '==', currentUser.uid)))
      .then((snap) => {
        setGoals(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentUser]);

  const totalWeight = goals.reduce((s, g) => s + (Number(g.weightage) || 0), 0);
  const approved = goals.filter((g) => g.status === 'approved').length;
  const pending = goals.filter((g) => g.status === 'pending').length;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{greeting},</p>
            <h1 className="text-2xl font-bold text-slate-900 mt-0.5">{firstName} 👋</h1>
            <p className="text-sm text-slate-500 mt-1">
              {userProfile?.designation} &middot; {userProfile?.department}
            </p>
          </div>
          <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-indigo-100">
            Active phase: {phaseLabels[phase]}
          </span>
        </div>

        {!loading && goals.length === 0 && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
            <AlertCircle size={17} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">You haven't created any goals yet</p>
              <p className="text-xs text-amber-600 mt-0.5">Goal setting is open — submit before the deadline.</p>
            </div>
            <Link to="/employee/goals/create" className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
              Create now
            </Link>
          </div>
        )}

        {pending > 0 && (
          <div className="flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
            <Clock size={17} className="text-sky-500 shrink-0" />
            <p className="text-sm text-sky-800">
              <span className="font-semibold">{pending} goal{pending !== 1 ? 's' : ''}</span> waiting for manager approval.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Goals Created', value: goals.length, note: '/ 8 maximum' },
            { label: 'Approved', value: approved, note: 'by manager' },
            { label: 'Pending Review', value: pending, note: 'awaiting action' },
            {
              label: 'Total Weightage',
              value: `${totalWeight}%`,
              note: totalWeight === 100 ? '✓ correctly balanced' : 'must equal 100%',
              highlight: totalWeight > 0 && totalWeight !== 100,
            },
          ].map((stat) => (
            <div key={stat.label} className={`bg-white rounded-xl border p-4 ${stat.highlight ? 'border-red-200' : 'border-slate-200'}`}>
              <p className="text-xs font-medium text-slate-500">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.highlight ? 'text-red-500' : 'text-slate-900'}`}>
                {loading ? '—' : stat.value}
              </p>
              <p className={`text-xs mt-0.5 ${stat.highlight ? 'text-red-400' : 'text-slate-400'}`}>{stat.note}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">My Goals</h2>
              <Link to="/employee/goals" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                View all <ArrowRight size={11} />
              </Link>
            </div>
            {loading ? (
              <p className="text-center text-slate-400 text-sm py-10">Loading...</p>
            ) : goals.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-slate-400 text-sm">No goals added yet</p>
                <Link to="/employee/goals/create" className="text-indigo-600 text-sm font-medium hover:underline mt-1 inline-block">
                  + Create goals
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {goals.slice(0, 5).map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{g.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{g.thrustArea} · {g.weightage}% weightage</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${statusStyle[g.status] || statusStyle.draft}`}>
                      {statusLabel[g.status] || 'Draft'}
                    </span>
                  </li>
                ))}
                {goals.length > 5 && (
                  <li className="px-4 py-2 text-center text-xs text-slate-400">
                    and {goals.length - 5} more
                  </li>
                )}
              </ul>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">2025–26 Performance Cycle</h2>
            </div>
            <div className="p-4 space-y-2">
              {[
                { phase: 'setting', label: 'Goal Setting', window: 'May 1 onwards' },
                { phase: 'q1', label: 'Q1 Check-in', window: 'July' },
                { phase: 'q2', label: 'Q2 Check-in', window: 'October' },
                { phase: 'q3', label: 'Q3 Check-in', window: 'January' },
                { phase: 'q4', label: 'Q4 / Annual', window: 'March – April' },
              ].map((item) => {
                const active = item.phase === phase;
                return (
                  <div key={item.phase} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${active ? 'bg-indigo-50' : ''}`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                    <p className={`text-sm flex-1 ${active ? 'font-semibold text-indigo-800' : 'text-slate-600'}`}>
                      {item.label}
                      {active && <span className="ml-2 text-xs bg-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded">Active</span>}
                    </p>
                    <p className={`text-xs ${active ? 'text-indigo-500' : 'text-slate-400'}`}>{item.window}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {[
            { icon: '📝', label: 'Create Goals', desc: 'Add or edit your goal sheet', to: '/employee/goals/create' },
            { icon: '📋', label: 'View Goals', desc: 'Review submitted goals', to: '/employee/goals' },
            { icon: '✅', label: 'Log Achievement', desc: 'Update quarterly progress', to: '/employee/checkin' },
          ].map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="flex items-center gap-3 bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm rounded-xl p-4 transition-all group"
            >
              <span className="text-xl">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">{a.label}</p>
                <p className="text-xs text-slate-400">{a.desc}</p>
              </div>
              <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
