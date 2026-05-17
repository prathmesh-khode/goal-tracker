import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Save, Info, TrendingUp } from 'lucide-react';

const QUARTERS = [
  { value: 'q1', label: 'Q1 (July)' },
  { value: 'q2', label: 'Q2 (October)' },
  { value: 'q3', label: 'Q3 (January)' },
  { value: 'q4', label: 'Q4 Annual (March–April)' },
];

const STATUS_OPTIONS = ['Not Started', 'On Track', 'Completed'];

function computeScore(goal, achievement) {
  if (!achievement || !goal.target) return null;
  const uom = goal.uom;
  if (uom === 'zero') {
    return Number(achievement) === 0 ? 100 : 0;
  }
  if (uom === 'timeline') {
    if (!achievement) return null;
    const deadline = new Date(goal.target);
    const completed = new Date(achievement);
    return completed <= deadline ? 100 : Math.max(0, Math.round((1 - (completed - deadline) / (7 * 24 * 60 * 60 * 1000)) * 100));
  }
  const t = Number(goal.target);
  const a = Number(achievement);
  if (!t || !a) return null;
  if (uom === 'numeric_min' || uom === 'percent_min') return Math.min(Math.round((a / t) * 100), 150);
  if (uom === 'numeric_max' || uom === 'percent_max') return Math.min(Math.round((t / a) * 100), 150);
  return null;
}

export default function EmployeeCheckin() {
  const { currentUser, userProfile } = useAuth();
  const [goals, setGoals] = useState([]);
  const [quarter, setQuarter] = useState('q1');
  const [updates, setUpdates] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    getDocs(query(
      collection(db, 'goals'),
      where('employeeId', '==', currentUser.uid),
      where('status', 'in', ['approved', 'locked'])
    ))
      .then((snap) => {
        const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setGoals(loaded);
        const init = {};
        loaded.forEach((g) => {
          const existing = g.checkins?.[quarter] || {};
          init[g.id] = {
            achievement: existing.achievement || '',
            status: existing.status || 'Not Started',
          };
        });
        setUpdates(init);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentUser]);

  useEffect(() => {
    const init = {};
    goals.forEach((g) => {
      const existing = g.checkins?.[quarter] || {};
      init[g.id] = {
        achievement: existing.achievement || '',
        status: existing.status || 'Not Started',
      };
    });
    setUpdates(init);
  }, [quarter, goals]);

  function setField(goalId, field, value) {
    setUpdates((prev) => ({ ...prev, [goalId]: { ...prev[goalId], [field]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const goal of goals) {
        const update = updates[goal.id];
        if (!update) continue;
        const score = computeScore(goal, update.achievement);
        await updateDoc(doc(db, 'goals', goal.id), {
          [`checkins.${quarter}`]: {
            achievement: update.achievement,
            status: update.status,
            score,
            savedAt: new Date().toISOString(),
          },
          updatedAt: serverTimestamp(),
        });
      }
      await addDoc(collection(db, 'auditLogs'), {
        action: 'CHECKIN_SAVED',
        quarter,
        employeeId: currentUser.uid,
        employeeName: userProfile?.name,
        timestamp: serverTimestamp(),
      });
      toast.success('Check-in saved successfully!');
    } catch (e) {
      toast.error('Failed to save. Try again.');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <Layout title="Quarterly Check-in">
        <div className="flex items-center justify-center h-60 text-slate-400">Loading goals...</div>
      </Layout>
    );
  }

  return (
    <Layout title="Quarterly Check-in">
      <div className="max-w-4xl mx-auto space-y-5">

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-slate-500 text-sm">Log your actual achievement against each planned target.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Quarter:</label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {QUARTERS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
            </select>
          </div>
        </div>

        {goals.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl py-16 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-slate-700 font-semibold">No approved goals found</p>
            <p className="text-slate-400 text-sm mt-1">Check-ins are only available once your manager approves your goals.</p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
              <Info size={14} className="mt-0.5 shrink-0" />
              Progress scores are auto-computed based on UoM type. They are for tracking only and are not final ratings.
            </div>

            <div className="space-y-4">
              {goals.map((goal, idx) => {
                const u = updates[goal.id] || {};
                const score = computeScore(goal, u.achievement);
                return (
                  <div key={goal.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{idx + 1}. {goal.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{goal.thrustArea} · {goal.weightage}% weightage · Target: <span className="font-medium text-slate-600">{goal.target}</span></p>
                      </div>
                      {score !== null && (
                        <div className={`text-right shrink-0`}>
                          <p className="text-xs text-slate-400">Progress</p>
                          <p className={`text-lg font-bold ${score >= 100 ? 'text-green-600' : score >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                            {score}%
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="p-4 grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">
                          Actual Achievement *
                          {goal.uom === 'timeline' && <span className="text-slate-400 ml-1">(completion date)</span>}
                        </label>
                        <input
                          type={goal.uom === 'timeline' ? 'date' : 'text'}
                          value={u.achievement || ''}
                          onChange={(e) => setField(goal.id, 'achievement', e.target.value)}
                          placeholder={goal.uom === 'zero' ? 'Enter 0 if achieved' : 'Enter actual value'}
                          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Status</label>
                        <div className="flex gap-2">
                          {STATUS_OPTIONS.map((s) => (
                            <button
                              key={s}
                              onClick={() => setField(goal.id, 'status', s)}
                              className={`flex-1 text-xs py-2.5 rounded-lg font-medium border transition ${
                                u.status === s
                                  ? s === 'Completed' ? 'bg-green-600 text-white border-green-600'
                                  : s === 'On Track' ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-slate-600 text-white border-slate-600'
                                  : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm transition disabled:opacity-50"
              >
                <Save size={15} />
                {saving ? 'Saving...' : 'Save Check-in'}
              </button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
