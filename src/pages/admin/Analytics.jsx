import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Layout from '../../components/Layout';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';

const QUARTERS = ['q1', 'q2', 'q3', 'q4'];
const Q_LABELS = { q1: 'Q1 Jul', q2: 'Q2 Oct', q3: 'Q3 Jan', q4: 'Q4 Annual' };
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

const UOM_LABELS = {
  numeric_min: 'Numeric (↑)',
  numeric_max: 'Numeric (↓)',
  percent_min: '% Higher',
  percent_max: '% Lower',
  timeline: 'Timeline',
  zero: 'Zero-based',
};

function computeScore(goal, achievement) {
  if (!achievement || !goal.target) return null;
  const uom = goal.uom;
  if (uom === 'zero') return Number(achievement) === 0 ? 100 : 0;
  if (uom === 'timeline') {
    const d = new Date(goal.target), c = new Date(achievement);
    return c <= d ? 100 : Math.max(0, Math.round((1 - (c - d) / (7 * 24 * 60 * 60 * 1000)) * 100));
  }
  const t = Number(goal.target), a = Number(achievement);
  if (!t || !a) return null;
  if (uom === 'numeric_min' || uom === 'percent_min') return Math.min(Math.round((a / t) * 100), 150);
  if (uom === 'numeric_max' || uom === 'percent_max') return Math.min(Math.round((t / a) * 100), 150);
  return null;
}

function StatCard({ label, value, sub, color = 'text-slate-900' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Analytics() {
  const [goals, setGoals] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [gSnap, uSnap] = await Promise.all([
        getDocs(collection(db, 'goals')),
        getDocs(collection(db, 'users')),
      ]);
      setGoals(gSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 text-slate-400">Loading analytics...</div>
      </Layout>
    );
  }

  const approvedGoals = goals.filter(g => ['approved', 'locked'].includes(g.status));
  const employees = users.filter(u => u.role === 'employee');
  const managers = users.filter(u => u.role === 'manager');

  // --- Thrust area distribution ---
  const thrustCount = {};
  goals.forEach(g => {
    if (g.thrustArea) thrustCount[g.thrustArea] = (thrustCount[g.thrustArea] || 0) + 1;
  });
  const thrustData = Object.entries(thrustCount)
    .map(([name, count]) => ({ name: name.length > 18 ? name.slice(0, 16) + '…' : name, count }))
    .sort((a, b) => b.count - a.count);

  // --- Status breakdown pie ---
  const statusCount = { Draft: 0, Pending: 0, Approved: 0, Locked: 0, Returned: 0 };
  goals.forEach(g => {
    if (g.status === 'draft') statusCount.Draft++;
    else if (g.status === 'pending') statusCount.Pending++;
    else if (g.status === 'approved') statusCount.Approved++;
    else if (g.status === 'locked') statusCount.Locked++;
    else if (g.status === 'rejected') statusCount.Returned++;
  });
  const pieData = Object.entries(statusCount).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  // --- QoQ achievement trend ---
  const qoqData = QUARTERS.map(q => {
    const scores = approvedGoals
      .map(g => computeScore(g, g.checkins?.[q]?.achievement))
      .filter(s => s !== null);
    const logged = approvedGoals.filter(g => g.checkins?.[q]?.achievement).length;
    return {
      quarter: Q_LABELS[q],
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      logged,
      total: approvedGoals.length,
    };
  });

  // --- UoM distribution ---
  const uomCount = {};
  goals.forEach(g => { if (g.uom) uomCount[g.uom] = (uomCount[g.uom] || 0) + 1; });
  const uomData = Object.entries(uomCount).map(([k, v]) => ({ name: UOM_LABELS[k] || k, value: v }));

  // --- Manager effectiveness ---
  const managerStats = managers.map(m => {
    const teamGoals = approvedGoals.filter(g => g.managerId === m.id);
    const reviewed = QUARTERS.reduce((total, q) => {
      return total + teamGoals.filter(g => g.checkins?.[q]?.managerComment).length;
    }, 0);
    const possible = teamGoals.length * QUARTERS.length;
    const rate = possible > 0 ? Math.round((reviewed / possible) * 100) : 0;

    const scores = [];
    QUARTERS.forEach(q => {
      teamGoals.forEach(g => {
        const s = computeScore(g, g.checkins?.[q]?.achievement);
        if (s !== null) scores.push(s);
      });
    });
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    return { name: m.name, teamSize: teamGoals.length, reviewRate: rate, avgScore };
  }).filter(m => m.teamSize > 0);

  // --- Department completion heatmap data ---
  const depts = [...new Set(approvedGoals.map(g => g.department).filter(Boolean))];
  const heatData = depts.map(dept => {
    const dg = approvedGoals.filter(g => g.department === dept);
    const row = { dept };
    QUARTERS.forEach(q => {
      const done = dg.filter(g => g.checkins?.[q]?.achievement).length;
      row[q] = dg.length > 0 ? Math.round((done / dg.length) * 100) : 0;
    });
    return row;
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5">Organisation-wide goal performance and trends</p>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Goals" value={goals.length} sub="across all employees" />
          <StatCard label="Approved / Locked" value={approvedGoals.length} sub="ready for check-ins" color="text-emerald-600" />
          <StatCard label="Employees" value={employees.length} sub="in the system" />
          <StatCard
            label="Org Submission Rate"
            value={`${employees.length > 0 ? Math.round((new Set(goals.filter(g => g.status !== 'draft').map(g => g.employeeId)).size / employees.length) * 100) : 0}%`}
            sub="employees submitted goals"
            color="text-indigo-600"
          />
        </div>

        {/* QoQ trend + Status pie */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Quarter-on-Quarter Achievement Trend</h2>
            {approvedGoals.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-12">No approved goals yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={qoqData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, 120]} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={(v, name) => [name === 'avgScore' ? `${v}%` : `${v} goals`, name === 'avgScore' ? 'Avg Score' : 'Logged']}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="avgScore" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} name="Avg Score %" />
                  <Line type="monotone" dataKey="logged" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" name="Check-ins Logged" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Goal Status Breakdown</h2>
            {pieData.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-12">No goals found</p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {pieData.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-slate-600 flex-1">{item.name}</span>
                      <span className="text-xs font-semibold text-slate-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Thrust area + UoM distribution */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Goals by Thrust Area</h2>
            {thrustData.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={thrustData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} width={110} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} name="Goals" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">UoM Type Distribution</h2>
            {uomData.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={uomData} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} name="Goals" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Department heatmap */}
        {heatData.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Check-in Completion by Department (%)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-500 pb-3 pr-4">Department</th>
                    {QUARTERS.map(q => (
                      <th key={q} className="text-center text-xs font-semibold text-slate-500 pb-3 px-2">{Q_LABELS[q]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {heatData.map(row => (
                    <tr key={row.dept}>
                      <td className="text-xs text-slate-700 font-medium py-2.5 pr-4">{row.dept}</td>
                      {QUARTERS.map(q => {
                        const val = row[q];
                        const bg = val >= 80 ? 'bg-green-100 text-green-700'
                          : val >= 50 ? 'bg-amber-100 text-amber-700'
                          : val > 0 ? 'bg-red-100 text-red-600'
                          : 'bg-slate-100 text-slate-400';
                        return (
                          <td key={q} className="text-center py-2.5 px-2">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-md ${bg}`}>
                              {val}%
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Manager effectiveness */}
        {managerStats.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">Manager Effectiveness</h2>
              <p className="text-xs text-slate-400 mt-0.5">Check-in review rate and team average achievement score</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Manager</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Team Goals</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Review Rate</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Avg Score</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {managerStats.sort((a, b) => b.reviewRate - a.reviewRate).map(m => (
                  <tr key={m.name} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-slate-800">{m.name}</p>
                    </td>
                    <td className="px-4 py-3.5 text-center text-sm text-slate-600">{m.teamSize}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${m.reviewRate >= 80 ? 'bg-green-100 text-green-700' : m.reviewRate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                        {m.reviewRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`text-sm font-bold ${m.avgScore >= 100 ? 'text-green-600' : m.avgScore >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                        {m.avgScore > 0 ? `${m.avgScore}%` : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${m.reviewRate >= 80 ? 'bg-green-500' : m.reviewRate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${m.reviewRate}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
