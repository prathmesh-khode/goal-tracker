import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, limit, startAfter } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Layout from '../../components/Layout';
import { ShieldCheck, Search, RefreshCw, Download } from 'lucide-react';

const ACTION_CONFIG = {
  GOAL_APPROVED:    { label: 'Goal Approved',       color: 'bg-green-100 text-green-700' },
  GOAL_RETURNED:    { label: 'Goal Returned',        color: 'bg-red-100 text-red-700' },
  GOAL_LOCKED:      { label: 'Goal Locked',          color: 'bg-blue-100 text-blue-700' },
  GOAL_EDITED:      { label: 'Goal Edited',          color: 'bg-amber-100 text-amber-700' },
  CHECKIN_SAVED:    { label: 'Check-in Saved',       color: 'bg-indigo-100 text-indigo-700' },
  MANAGER_CHECKIN:  { label: 'Manager Reviewed',     color: 'bg-purple-100 text-purple-700' },
};

function formatTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  async function loadLogs(reset = true) {
    setLoading(true);
    try {
      let q = query(
        collection(db, 'auditLogs'),
        orderBy('timestamp', 'desc'),
        limit(PAGE_SIZE)
      );
      if (!reset && lastDoc) {
        q = query(
          collection(db, 'auditLogs'),
          orderBy('timestamp', 'desc'),
          startAfter(lastDoc),
          limit(PAGE_SIZE)
        );
      }
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setHasMore(snap.docs.length === PAGE_SIZE);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      if (reset) {
        setLogs(items);
      } else {
        setLogs(prev => [...prev, ...items]);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  useEffect(() => { loadLogs(true); }, []);

  function exportCSV() {
    const rows = [['Timestamp', 'Action', 'Manager / Actor', 'Employee', 'Goal ID', 'Details', 'Quarter', 'Comment']];
    filtered.forEach(l => {
      rows.push([
        formatTime(l.timestamp),
        ACTION_CONFIG[l.action]?.label || l.action,
        l.managerName || '—',
        l.employeeName || '—',
        l.goalId || '—',
        l.details || '—',
        l.quarter?.toUpperCase() || '—',
        l.comment || '—',
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AuditLog_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = logs.filter(l => {
    const matchAction = filterAction === 'all' || l.action === filterAction;
    const matchSearch = !search ||
      l.managerName?.toLowerCase().includes(search.toLowerCase()) ||
      l.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
      l.details?.toLowerCase().includes(search.toLowerCase()) ||
      l.comment?.toLowerCase().includes(search.toLowerCase());
    return matchAction && matchSearch;
  });

  return (
    <Layout title="Audit Logs">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, details..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 w-60"
              />
            </div>
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="text-sm border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="all">All Actions</option>
              {Object.entries(ACTION_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadLogs(true)}
              className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 px-3 py-2 rounded-xl hover:bg-slate-50 transition"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 text-sm font-medium border border-slate-300 text-slate-700 px-3 py-2 rounded-xl hover:bg-slate-50 transition disabled:opacity-40"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-center gap-2 flex-wrap">
          <ShieldCheck size={14} className="text-purple-500" />
          <p className="text-sm text-slate-500">
            Showing <span className="font-semibold text-slate-800">{filtered.length}</span> log entries
            {search && ` matching "${search}"`}
          </p>
        </div>

        {/* Logs table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loading && logs.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-12">Loading audit logs...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-12">No audit logs found.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Timestamp</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Actor</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(log => {
                    const ac = ACTION_CONFIG[log.action] || { label: log.action, color: 'bg-slate-100 text-slate-600' };
                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {formatTime(log.timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ac.color}`}>
                            {ac.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <p className="text-xs font-medium text-slate-700">{log.managerName || '—'}</p>
                          {log.quarter && (
                            <p className="text-xs text-slate-400">{log.quarter.toUpperCase()}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-slate-600 line-clamp-2">
                            {log.details || log.comment || '—'}
                          </p>
                          {log.employeeName && (
                            <p className="text-xs text-slate-400 mt-0.5">Employee: {log.employeeName}</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {hasMore && (
                <div className="px-4 py-3 border-t border-slate-100 text-center">
                  <button
                    onClick={() => loadLogs(false)}
                    disabled={loading}
                    className="text-sm text-purple-600 hover:underline font-medium disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
