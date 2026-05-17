import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Download, FileSpreadsheet, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';

const QUARTERS = [
  { value: 'q1', label: 'Q1 — July' },
  { value: 'q2', label: 'Q2 — October' },
  { value: 'q3', label: 'Q3 — January' },
  { value: 'q4', label: 'Q4 Annual' },
];

const UOM_LABELS = {
  numeric_min: 'Numeric (Higher better)',
  numeric_max: 'Numeric (Lower better)',
  percent_min: '% (Higher better)',
  percent_max: '% (Lower better)',
  timeline: 'Timeline',
  zero: 'Zero-based',
};

function computeScore(goal, achievement) {
  if (!achievement || !goal.target) return null;
  const uom = goal.uom;
  if (uom === 'zero') return Number(achievement) === 0 ? 100 : 0;
  if (uom === 'timeline') {
    const deadline = new Date(goal.target);
    const completed = new Date(achievement);
    return completed <= deadline ? 100 : Math.max(0, Math.round((1 - (completed - deadline) / (7 * 24 * 60 * 60 * 1000)) * 100));
  }
  const t = Number(goal.target), a = Number(achievement);
  if (!t || !a) return null;
  if (uom === 'numeric_min' || uom === 'percent_min') return Math.min(Math.round((a / t) * 100), 150);
  if (uom === 'numeric_max' || uom === 'percent_max') return Math.min(Math.round((t / a) * 100), 150);
  return null;
}

export default function Reports() {
  const [goals, setGoals] = useState([]);
  const [users, setUsers] = useState([]);
  const [quarter, setQuarter] = useState('q1');
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState('all');

  useEffect(() => {
    async function load() {
      try {
        const [gSnap, uSnap] = await Promise.all([
          getDocs(query(collection(db, 'goals'), where('status', 'in', ['approved', 'locked']))),
          getDocs(collection(db, 'users')),
        ]);
        setGoals(gSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch { toast.error('Failed to load data.'); }
      setLoading(false);
    }
    load();
  }, []);

  const departments = [...new Set(goals.map(g => g.department).filter(Boolean))];

  const reportRows = goals
    .filter(g => filterDept === 'all' || g.department === filterDept)
    .map(g => {
      const checkin = g.checkins?.[quarter] || {};
      const score = computeScore(g, checkin.achievement);
      const manager = users.find(u => u.id === g.managerId);
      return {
        goal: g,
        checkin,
        score,
        managerName: manager?.name || '—',
      };
    });

  // Group by employee
  const byEmployee = {};
  reportRows.forEach(r => {
    const key = r.goal.employeeId;
    if (!byEmployee[key]) {
      byEmployee[key] = { name: r.goal.employeeName, dept: r.goal.department, manager: r.managerName, goals: [] };
    }
    byEmployee[key].goals.push(r);
  });

  // Completion stats
  const checkinCompleted = reportRows.filter(r => r.checkin.achievement).length;
  const checkinTotal = reportRows.length;
  const managerReviewed = reportRows.filter(r => r.checkin.managerComment).length;

  function exportCSV() {
    const rows = [
      ['Employee', 'Department', 'Manager', 'Goal Title', 'Thrust Area', 'UoM', 'Target', 'Weightage (%)',
       'Achievement', 'Status', 'Progress Score (%)', 'Manager Comment', 'Quarter'],
    ];
    reportRows.forEach(r => {
      rows.push([
        r.goal.employeeName,
        r.goal.department,
        r.managerName,
        r.goal.title,
        r.goal.thrustArea,
        UOM_LABELS[r.goal.uom] || r.goal.uom,
        r.goal.target,
        r.goal.weightage,
        r.checkin.achievement || '',
        r.checkin.status || 'Not logged',
        r.score !== null && r.score !== undefined ? r.score : '',
        r.checkin.managerComment || '',
        quarter.toUpperCase(),
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GoalTrack_Report_${quarter.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded.');
  }

  function exportExcel() {
    const data = reportRows.map(r => ({
      'Employee': r.goal.employeeName,
      'Department': r.goal.department,
      'Manager': r.managerName,
      'Goal Title': r.goal.title,
      'Thrust Area': r.goal.thrustArea,
      'UoM': UOM_LABELS[r.goal.uom] || r.goal.uom,
      'Target': r.goal.target,
      'Weightage (%)': r.goal.weightage,
      'Achievement': r.checkin.achievement || '',
      'Status': r.checkin.status || 'Not logged',
      'Progress Score (%)': r.score !== null && r.score !== undefined ? r.score : '',
      'Manager Comment': r.checkin.managerComment || '',
      'Quarter': quarter.toUpperCase(),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${quarter.toUpperCase()} Report`);
    // Auto column widths
    const cols = Object.keys(data[0] || {}).map(k => ({ wch: Math.max(k.length, 15) }));
    ws['!cols'] = cols;
    XLSX.writeFile(wb, `GoalTrack_Report_${quarter.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Excel file downloaded.');
  }

  return (
    <Layout title="Reports">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-slate-400" />
              <select
                value={quarter}
                onChange={e => setQuarter(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              >
                {QUARTERS.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
              </select>
            </div>
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="all">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              disabled={reportRows.length === 0}
              className="flex items-center gap-2 text-sm font-medium border border-slate-300 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 transition disabled:opacity-40"
            >
              <Download size={15} /> CSV
            </button>
            <button
              onClick={exportExcel}
              disabled={reportRows.length === 0}
              className="flex items-center gap-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl transition shadow-sm disabled:opacity-40"
            >
              <FileSpreadsheet size={15} /> Excel
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Goals in Report', value: checkinTotal },
            { label: 'Check-ins Logged', value: checkinCompleted },
            { label: 'Manager Reviewed', value: managerReviewed },
            { label: 'Employees', value: Object.keys(byEmployee).length },
          ].map(s => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{loading ? '—' : s.value}</p>
            </div>
          ))}
        </div>

        {/* Completion dashboard */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">
              Check-in Completion — {QUARTERS.find(q => q.value === quarter)?.label}
            </h2>
          </div>
          {loading ? (
            <p className="text-center text-slate-400 text-sm py-10">Loading...</p>
          ) : Object.keys(byEmployee).length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-10">No approved goals found for this filter.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {Object.entries(byEmployee).map(([empId, emp]) => {
                const done = emp.goals.filter(r => r.checkin.achievement).length;
                const reviewed = emp.goals.filter(r => r.checkin.managerComment).length;
                const total = emp.goals.length;
                const avgScore = emp.goals
                  .filter(r => r.score !== null && r.score !== undefined)
                  .reduce((s, r, _, a) => s + r.score / a.length, 0);

                return (
                  <div key={empId} className="px-4 py-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{emp.name}</p>
                        <p className="text-xs text-slate-400">{emp.dept} · Manager: {emp.manager}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
                        <span className={done === total ? 'text-green-600 font-semibold' : 'text-amber-500 font-semibold'}>
                          {done}/{total} logged
                        </span>
                        <span className={reviewed === total ? 'text-green-600' : 'text-slate-400'}>
                          {reviewed}/{total} reviewed
                        </span>
                        {avgScore > 0 && (
                          <span className={`font-bold ${avgScore >= 100 ? 'text-green-600' : avgScore >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                            {Math.round(avgScore)}% avg
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Per-goal rows */}
                    <div className="space-y-2">
                      {emp.goals.map((r, i) => (
                        <div key={r.goal.id} className="grid grid-cols-5 gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2">
                          <div className="col-span-2 font-medium text-slate-700 truncate" title={r.goal.title}>
                            {i + 1}. {r.goal.title}
                          </div>
                          <div className="text-slate-500">
                            Target: <span className="font-medium text-slate-700">{r.goal.target}</span>
                          </div>
                          <div className="text-slate-500">
                            Actual: <span className={`font-medium ${r.checkin.achievement ? 'text-blue-700' : 'text-slate-400'}`}>
                              {r.checkin.achievement || '—'}
                            </span>
                          </div>
                          <div className="text-right">
                            {r.score !== null && r.score !== undefined ? (
                              <span className={`font-bold ${r.score >= 100 ? 'text-green-600' : r.score >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                                {r.score}%
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
