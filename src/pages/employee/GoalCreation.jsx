import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, addDoc, query, where, getDocs,
  serverTimestamp, doc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Trash2, Plus, Send, Info } from 'lucide-react';

const THRUST_AREAS = [
  'Revenue & Growth',
  'Customer Experience',
  'Operational Efficiency',
  'People & Culture',
  'Innovation & Technology',
  'Quality & Compliance',
  'Cost Optimization',
  'Safety & Environment',
];

const UOM_TYPES = [
  { value: 'numeric_min', label: 'Numeric – Higher is better (e.g. Sales Revenue)' },
  { value: 'numeric_max', label: 'Numeric – Lower is better (e.g. TAT, Cost)' },
  { value: 'percent_min', label: '% – Higher is better (e.g. Utilization %)' },
  { value: 'percent_max', label: '% – Lower is better (e.g. Error rate %)' },
  { value: 'timeline', label: 'Timeline – Date-based completion' },
  { value: 'zero', label: 'Zero-based – Zero = Success (e.g. Safety incidents)' },
];

const empty = () => ({
  title: '',
  description: '',
  thrustArea: '',
  uom: '',
  target: '',
  weightage: '',
  _id: Math.random().toString(36).slice(2),
});

export default function GoalCreation() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [goals, setGoals] = useState([empty()]);
  const [existingIds, setExistingIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    getDocs(query(collection(db, 'goals'), where('employeeId', '==', currentUser.uid), where('status', '==', 'draft')))
      .then((snap) => {
        if (!snap.empty) {
          const loaded = snap.docs.map((d) => ({ ...d.data(), _id: d.id, _docId: d.id }));
          setGoals(loaded);
          setExistingIds(snap.docs.map((d) => d.id));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentUser]);

  const totalWeight = goals.reduce((s, g) => s + (Number(g.weightage) || 0), 0);

  function updateGoal(idx, field, value) {
    setGoals((prev) => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g));
  }

  function addGoal() {
    if (goals.length >= 8) {
      toast.error('Maximum 8 goals allowed per employee.');
      return;
    }
    setGoals((prev) => [...prev, empty()]);
  }

  function removeGoal(idx) {
    if (goals.length === 1) {
      toast.error('You need at least one goal.');
      return;
    }
    setGoals((prev) => prev.filter((_, i) => i !== idx));
  }

  function validate() {
    if (goals.length > 8) return 'Maximum 8 goals allowed.';
    for (let i = 0; i < goals.length; i++) {
      const g = goals[i];
      if (!g.title.trim()) return `Goal ${i + 1}: Title is required.`;
      if (!g.thrustArea) return `Goal ${i + 1}: Thrust Area is required.`;
      if (!g.uom) return `Goal ${i + 1}: Unit of Measurement is required.`;
      if (!g.target.trim()) return `Goal ${i + 1}: Target is required.`;
      const w = Number(g.weightage);
      if (!w || w < 10) return `Goal ${i + 1}: Weightage must be at least 10%.`;
    }
    if (totalWeight !== 100) return `Total weightage is ${totalWeight}% — it must equal exactly 100%.`;
    return null;
  }

  async function saveDraft() {
    setSubmitting(true);
    try {
      for (const g of goals) {
        const payload = {
          title: g.title,
          description: g.description,
          thrustArea: g.thrustArea,
          uom: g.uom,
          target: g.target,
          weightage: Number(g.weightage),
          status: 'draft',
          employeeId: currentUser.uid,
          employeeName: userProfile?.name,
          department: userProfile?.department,
          managerId: userProfile?.managerId || '',
          updatedAt: serverTimestamp(),
        };
        if (g._docId) {
          await updateDoc(doc(db, 'goals', g._docId), payload);
        } else {
          const ref = await addDoc(collection(db, 'goals'), { ...payload, createdAt: serverTimestamp() });
          g._docId = ref.id;
        }
      }
      toast.success('Draft saved.');
    } catch (e) {
      toast.error('Failed to save draft.');
    }
    setSubmitting(false);
  }

  async function handleSubmit() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      for (const g of goals) {
        const payload = {
          title: g.title,
          description: g.description,
          thrustArea: g.thrustArea,
          uom: g.uom,
          target: g.target,
          weightage: Number(g.weightage),
          status: 'pending',
          employeeId: currentUser.uid,
          employeeName: userProfile?.name,
          department: userProfile?.department,
          managerId: userProfile?.managerId || '',
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (g._docId) {
          await updateDoc(doc(db, 'goals', g._docId), payload);
        } else {
          await addDoc(collection(db, 'goals'), { ...payload, createdAt: serverTimestamp() });
        }
      }
      toast.success('Goals submitted for manager approval!');
      navigate('/employee/goals');
    } catch (e) {
      toast.error('Submission failed. Try again.');
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <Layout title="Create Goals">
        <div className="flex items-center justify-center h-60 text-slate-400">Loading your goals...</div>
      </Layout>
    );
  }

  return (
    <Layout title="Create Goals">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Info bar */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm">
          <span className="text-slate-600">Goals: <strong className={goals.length >= 8 ? 'text-red-500' : 'text-slate-900'}>{goals.length}/8</strong></span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600">Total Weightage: <strong className={totalWeight === 100 ? 'text-green-600' : totalWeight > 100 ? 'text-red-500' : 'text-amber-500'}>{totalWeight}%</strong></span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-400 text-xs flex items-center gap-1"><Info size={12} /> Each goal min 10% · Max 8 goals · Total must = 100%</span>
        </div>

        {/* Goal cards */}
        {goals.map((goal, idx) => (
          <div key={goal._id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
              <span className="text-sm font-semibold text-slate-700">Goal {idx + 1}</span>
              <button onClick={() => removeGoal(idx)} className="text-slate-400 hover:text-red-500 transition p-1 rounded">
                <Trash2 size={15} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Goal Title *</label>
                  <input
                    type="text"
                    value={goal.title}
                    onChange={(e) => updateGoal(idx, 'title', e.target.value)}
                    placeholder="e.g. Increase quarterly sales revenue"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Thrust Area *</label>
                  <select
                    value={goal.thrustArea}
                    onChange={(e) => updateGoal(idx, 'thrustArea', e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
                  >
                    <option value="">Select thrust area</option>
                    {THRUST_AREAS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Unit of Measurement *</label>
                  <select
                    value={goal.uom}
                    onChange={(e) => updateGoal(idx, 'uom', e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
                  >
                    <option value="">Select UoM</option>
                    {UOM_TYPES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Target *
                    {goal.uom === 'timeline' && <span className="text-slate-400 ml-1">(use a date)</span>}
                    {goal.uom === 'zero' && <span className="text-slate-400 ml-1">(enter 0)</span>}
                  </label>
                  <input
                    type={goal.uom === 'timeline' ? 'date' : 'text'}
                    value={goal.target}
                    onChange={(e) => updateGoal(idx, 'target', e.target.value)}
                    placeholder={goal.uom?.includes('percent') ? 'e.g. 90' : 'e.g. 5000000'}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Weightage (%) *</label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={goal.weightage}
                    onChange={(e) => updateGoal(idx, 'weightage', e.target.value)}
                    placeholder="Min 10%"
                    className={`w-full text-sm border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none ${
                      goal.weightage && Number(goal.weightage) < 10 ? 'border-red-300' : 'border-slate-300'
                    }`}
                  />
                  {goal.weightage && Number(goal.weightage) < 10 && (
                    <p className="text-xs text-red-500 mt-1">Minimum 10% required</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Description <span className="text-slate-400">(optional)</span></label>
                  <textarea
                    value={goal.description}
                    onChange={(e) => updateGoal(idx, 'description', e.target.value)}
                    rows={2}
                    placeholder="Briefly describe how this goal will be measured or achieved..."
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Add goal button */}
        {goals.length < 8 && (
          <button
            onClick={addGoal}
            className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl py-3.5 text-sm text-slate-500 hover:text-indigo-600 font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Add another goal
          </button>
        )}

        {/* Weightage summary */}
        {totalWeight > 0 && (
          <div className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium ${
            totalWeight === 100
              ? 'bg-green-50 border border-green-200 text-green-700'
              : totalWeight > 100
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-amber-50 border border-amber-200 text-amber-700'
          }`}>
            <span>Total weightage: {totalWeight}%</span>
            <span>
              {totalWeight === 100 ? '✓ Ready to submit' : totalWeight > 100 ? `Over by ${totalWeight - 100}%` : `${100 - totalWeight}% remaining`}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            onClick={saveDraft}
            disabled={submitting}
            className="px-4 py-2.5 text-sm font-medium border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
          >
            Save as draft
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
          >
            <Send size={15} />
            {submitting ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
