import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { PlusCircle, Lock, AlertCircle, CheckCircle2, Clock, FileText } from 'lucide-react';

const UOM_LABELS = {
  numeric_min: 'Numeric (↑)',
  numeric_max: 'Numeric (↓)',
  percent_min: '% (↑)',
  percent_max: '% (↓)',
  timeline: 'Timeline',
  zero: 'Zero-based',
};

const STATUS_CONFIG = {
  draft: { label: 'Draft', icon: FileText, cls: 'bg-slate-100 text-slate-600' },
  pending: { label: 'Pending Approval', icon: Clock, cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', icon: CheckCircle2, cls: 'bg-green-100 text-green-700' },
  locked: { label: 'Locked', icon: Lock, cls: 'bg-blue-100 text-blue-700' },
  rejected: { label: 'Returned for Rework', icon: AlertCircle, cls: 'bg-red-100 text-red-700' },
};

export default function MyGoals() {
  const { currentUser } = useAuth();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

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
  const allLocked = goals.length > 0 && goals.every((g) => g.status === 'locked' || g.status === 'approved');
  const hasDraft = goals.some((g) => g.status === 'draft' || g.status === 'rejected');

  if (loading) {
    return (
      <Layout title="My Goals">
        <div className="flex items-center justify-center h-60 text-slate-400">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout title="My Goals">
      <div className="max-w-4xl mx-auto space-y-5">

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span>{goals.length} goal{goals.length !== 1 ? 's' : ''}</span>
            <span className="text-slate-300">|</span>
            <span className={`font-medium ${totalWeight === 100 ? 'text-green-600' : 'text-amber-500'}`}>
              {totalWeight}% total weightage
            </span>
          </div>
          {(hasDraft || goals.length === 0) && (
            <Link
              to="/employee/goals/create"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shadow-sm"
            >
              <PlusCircle size={15} /> {goals.length === 0 ? 'Create Goals' : 'Edit Goals'}
            </Link>
          )}
        </div>

        {allLocked && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <Lock size={16} className="text-blue-500 shrink-0" />
            <p className="text-sm text-blue-800">
              Your goals are <strong>approved and locked</strong>. Contact your manager or HR to request changes.
            </p>
          </div>
        )}

        {goals.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl py-16 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-slate-700 font-semibold">No goals yet</p>
            <p className="text-slate-400 text-sm mt-1 mb-4">Create your goal sheet for this performance cycle.</p>
            <Link
              to="/employee/goals/create"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
            >
              <PlusCircle size={15} /> Create Goals
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Goal</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Thrust Area</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">UoM</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Target</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Weight</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {goals.map((goal, idx) => {
                  const sc = STATUS_CONFIG[goal.status] || STATUS_CONFIG.draft;
                  const Icon = sc.icon;
                  return (
                    <tr key={goal.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5 text-slate-400 font-medium">{idx + 1}</td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-800">{goal.title}</p>
                        {goal.description && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{goal.description}</p>
                        )}
                        {goal.managerComment && (
                          <p className="text-xs text-amber-600 mt-1 bg-amber-50 px-2 py-1 rounded">
                            Manager: {goal.managerComment}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 hidden md:table-cell">{goal.thrustArea}</td>
                      <td className="px-4 py-3.5 text-slate-500 hidden md:table-cell">{UOM_LABELS[goal.uom] || goal.uom}</td>
                      <td className="px-4 py-3.5 text-slate-700 font-medium">{goal.target}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-800">{goal.weightage}%</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${sc.cls}`}>
                          <Icon size={11} />
                          {sc.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Total</td>
                  <td className={`px-4 py-3 text-right font-bold ${totalWeight === 100 ? 'text-green-600' : 'text-red-500'}`}>
                    {totalWeight}%
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
