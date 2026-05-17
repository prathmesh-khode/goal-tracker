import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { Users, Target, CheckSquare, ArrowRight, ShieldCheck, BarChart2 } from 'lucide-react';

const QUARTERS = ['q1', 'q2', 'q3', 'q4'];

export default function AdminDashboard() {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [usersSnap, goalsSnap, logsSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'goals')),
          getDocs(collection(db, 'auditLogs')),
        ]);

        const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const goals = goalsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const employees = users.filter(u => u.role === 'employee');
        const managers = users.filter(u => u.role === 'manager');

        const byStatus = {
          draft: goals.filter(g => g.status === 'draft').length,
          pending: goals.filter(g => g.status === 'pending').length,
          approved: goals.filter(g => g.status === 'approved').length,
          locked: goals.filter(g => g.status === 'locked').length,
          rejected: goals.filter(g => g.status === 'rejected').length,
        };

        // Check-in completion across all quarters
        const checkinDone = {};
        QUARTERS.forEach(q => {
          checkinDone[q] = goals.filter(g => g.checkins?.[q]?.achievement).length;
        });

        // Employees who submitted goals
        const submittedEmployees = new Set(
          goals.filter(g => g.status !== 'draft').map(g => g.employeeId)
        ).size;

        setStats({
          totalUsers: users.length,
          employees: employees.length,
          managers: managers.length,
          totalGoals: goals.length,
          byStatus,
          submittedEmployees,
          checkinDone,
          auditCount: logsSnap.size,
        });
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    load();
  }, []);

  const firstName = userProfile?.name?.split(' ')[0] || 'Admin';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{greeting},</p>
            <h1 className="text-2xl font-bold text-slate-900 mt-0.5">{firstName} 👋</h1>
            <p className="text-sm text-slate-500 mt-1">Administrator · {userProfile?.department}</p>
          </div>
          <span className="bg-purple-50 text-purple-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-purple-100">
            Performance Cycle 2025–26
          </span>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: stats?.totalUsers, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Employees', value: stats?.employees, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Managers', value: stats?.managers, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Total Goals', value: stats?.totalGoals, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
              <div className={`${s.bg} p-2 rounded-lg shrink-0`}>
                <s.icon size={16} className={s.color} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">{s.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">{loading ? '—' : (s.value ?? 0)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">

          {/* Goal status breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">Goal Status Breakdown</h2>
            </div>
            <div className="p-4 space-y-3">
              {loading ? (
                <p className="text-slate-400 text-sm text-center py-4">Loading...</p>
              ) : (
                [
                  { label: 'Locked', key: 'locked', color: 'bg-blue-500' },
                  { label: 'Approved', key: 'approved', color: 'bg-green-500' },
                  { label: 'Pending Approval', key: 'pending', color: 'bg-amber-400' },
                  { label: 'Draft', key: 'draft', color: 'bg-slate-300' },
                  { label: 'Returned', key: 'rejected', color: 'bg-red-400' },
                ].map((item) => {
                  const count = stats?.byStatus?.[item.key] || 0;
                  const total = stats?.totalGoals || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={item.key}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-600 font-medium">{item.label}</span>
                        <span className="text-slate-400">{count} goal{count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${item.color} rounded-full transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Check-in completion */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">Check-in Completion</h2>
              <Link to="/admin/reports" className="text-xs text-purple-600 hover:underline flex items-center gap-1">
                Full report <ArrowRight size={11} />
              </Link>
            </div>
            <div className="p-4 space-y-3">
              {QUARTERS.map((q) => {
                const done = stats?.checkinDone?.[q] || 0;
                const total = (stats?.byStatus?.approved || 0) + (stats?.byStatus?.locked || 0);
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <div key={q}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-600 font-medium">{q.toUpperCase()} Check-in</span>
                      <span className="text-slate-400">{done}/{total} logged</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Submission rate */}
        {stats && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs text-slate-500">Goal Submission Rate</p>
              <p className="text-3xl font-bold text-slate-900 mt-0.5">
                {stats.employees > 0 ? Math.round((stats.submittedEmployees / stats.employees) * 100) : 0}%
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {stats.submittedEmployees} of {stats.employees} employees submitted
              </p>
            </div>
            <div className="flex-1 min-w-48">
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all"
                  style={{ width: `${stats.employees > 0 ? (stats.submittedEmployees / stats.employees) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { icon: '👥', label: 'User Management', desc: 'Add users, assign managers', to: '/admin/users' },
            { icon: '📊', label: 'Reports & Export', desc: 'Download CSV / Excel reports', to: '/admin/reports' },
            { icon: '🔍', label: 'Audit Logs', desc: 'Track all system changes', to: '/admin/audit' },
          ].map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="flex items-center gap-3 bg-white border border-slate-200 hover:border-purple-300 hover:shadow-sm rounded-xl p-4 transition-all group"
            >
              <span className="text-xl">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 group-hover:text-purple-700 transition-colors">{a.label}</p>
                <p className="text-xs text-slate-400">{a.desc}</p>
              </div>
              <ArrowRight size={14} className="text-slate-300 group-hover:text-purple-400 shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
