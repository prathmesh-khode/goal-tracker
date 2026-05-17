import { useEffect, useState } from 'react';
import {
  collection, query, where, getDocs, doc,
  updateDoc, serverTimestamp, addDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { MessageSquare, Save, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const QUARTERS = [
  { value: 'q1', label: 'Q1 — July' },
  { value: 'q2', label: 'Q2 — October' },
  { value: 'q3', label: 'Q3 — January' },
  { value: 'q4', label: 'Q4 Annual — March/April' },
];

const UOM_LABELS = {
  numeric_min: 'Numeric (↑)',
  numeric_max: 'Numeric (↓)',
  percent_min: '% (↑)',
  percent_max: '% (↓)',
  timeline: 'Timeline',
  zero: 'Zero-based',
};

function ScorePill({ score }) {
  if (score === null || score === undefined) return <span className="text-xs text-slate-400">No data</span>;
  const color = score >= 100 ? 'text-green-600' : score >= 70 ? 'text-amber-500' : 'text-red-500';
  const Icon = score >= 100 ? TrendingUp : score >= 70 ? Minus : TrendingDown;
  return (
    <span className={`flex items-center gap-1 text-sm font-bold ${color}`}>
      <Icon size={13} /> {score}%
    </span>
  );
}

export default function ManagerCheckin() {
  const { currentUser, userProfile } = useAuth();
  const [members, setMembers] = useState([]);
  const [goals, setGoals] = useState([]);
  const [quarter, setQuarter] = useState('q1');
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedMember, setSelectedMember] = useState('all');

  useEffect(() => {
    if (!currentUser) return;
    async function load() {
      try {
        const [mSnap, gSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('managerId', '==', currentUser.uid))),
          getDocs(query(
            collection(db, 'goals'),
            where('managerId', '==', currentUser.uid),
            where('status', 'in', ['approved', 'locked'])
          )),
        ]);
        const m = mSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const g = gSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMembers(m);
        setGoals(g);

        const initComments = {};
        g.forEach((goal) => {
          initComments[goal.id] = goal.checkins?.[quarter]?.managerComment || '';
        });
        setComments(initComments);
      } catch (e) {
        toast.error('Failed to load data.');
      }
      setLoading(false);
    }
    load();
  }, [currentUser]);

  useEffect(() => {
    const init = {};
    goals.forEach((g) => {
      init[g.id] = g.checkins?.[quarter]?.managerComment || '';
    });
    setComments(init);
  }, [quarter, goals]);

  async function saveComment(goal) {
    const comment = comments[goal.id] || '';
    if (!comment.trim()) {
      toast.error('Please write a comment before saving.');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'goals', goal.id), {
        [`checkins.${quarter}.managerComment`]: comment,
        [`checkins.${quarter}.reviewedBy`]: userProfile?.name,
        [`checkins.${quarter}.reviewedAt`]: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'auditLogs'), {
        action: 'MANAGER_CHECKIN',
        quarter,
        goalId: goal.id,
        employeeId: goal.employeeId,
        managerId: currentUser.uid,
        managerName: userProfile?.name,
        comment,
        timestamp: serverTimestamp(),
      });
      setGoals((prev) => prev.map((g) =>
        g.id === goal.id
          ? { ...g, checkins: { ...(g.checkins || {}), [quarter]: { ...(g.checkins?.[quarter] || {}), managerComment: comment } } }
          : g
      ));
      toast.success('Check-in comment saved.');
    } catch {
      toast.error('Failed to save comment.');
    }
    setSaving(false);
  }

  const visibleMembers = members.filter((m) => selectedMember === 'all' || m.id === selectedMember);

  if (loading) {
    return (
      <Layout title="Team Check-ins">
        <div className="flex items-center justify-center h-60 text-slate-400">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout title="Team Check-ins">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Quarter:</label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {QUARTERS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Member:</label>
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="all">All members</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        {/* Completion summary */}
        {members.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {members.map((m) => {
              const mg = goals.filter((g) => g.employeeId === m.id);
              const completed = mg.filter((g) => g.checkins?.[quarter]?.achievement).length;
              const reviewed = mg.filter((g) => g.checkins?.[quarter]?.managerComment).length;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMember(m.id === selectedMember ? 'all' : m.id)}
                  className={`text-left bg-white border rounded-xl p-3 transition ${m.id === selectedMember ? 'border-emerald-400 ring-1 ring-emerald-300' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <p className="text-xs font-semibold text-slate-700 truncate">{m.name.split(' ')[0]}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{completed}/{mg.length} logged</p>
                  <p className={`text-xs mt-0.5 font-medium ${reviewed === mg.length && mg.length > 0 ? 'text-green-600' : 'text-amber-500'}`}>
                    {reviewed}/{mg.length} reviewed
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {/* Member sections */}
        {goals.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl py-14 text-center">
            <p className="text-slate-400 text-sm">No approved goals found. Approve team goals first.</p>
          </div>
        ) : (
          visibleMembers.map((member) => {
            const mg = goals.filter((g) => g.employeeId === member.id);
            if (mg.length === 0) return null;

            return (
              <div key={member.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Member header */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 bg-slate-50">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center shrink-0">
                    {member.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{member.name}</p>
                    <p className="text-xs text-slate-400">{member.designation}</p>
                  </div>
                </div>

                {/* Goals */}
                <div className="divide-y divide-slate-100">
                  {mg.map((goal) => {
                    const checkin = goal.checkins?.[quarter] || {};
                    const hasAchievement = !!checkin.achievement;
                    return (
                      <div key={goal.id} className="p-4">
                        {/* Goal title */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{goal.title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {goal.thrustArea} · {UOM_LABELS[goal.uom]} · {goal.weightage}% weight
                            </p>
                          </div>
                          {hasAchievement && <ScorePill score={checkin.score} />}
                        </div>

                        {/* Planned vs Actual table */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="bg-slate-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-slate-400 mb-1">Planned Target</p>
                            <p className="text-sm font-bold text-slate-800">{goal.target}</p>
                          </div>
                          <div className={`rounded-lg p-3 text-center ${hasAchievement ? 'bg-blue-50' : 'bg-slate-50'}`}>
                            <p className="text-xs text-slate-400 mb-1">Actual Achievement</p>
                            <p className={`text-sm font-bold ${hasAchievement ? 'text-blue-700' : 'text-slate-400'}`}>
                              {checkin.achievement || '—'}
                            </p>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-slate-400 mb-1">Status</p>
                            <p className={`text-xs font-semibold ${
                              checkin.status === 'Completed' ? 'text-green-600'
                              : checkin.status === 'On Track' ? 'text-blue-600'
                              : 'text-slate-400'
                            }`}>
                              {checkin.status || 'Not logged'}
                            </p>
                          </div>
                        </div>

                        {/* Manager comment */}
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                            <MessageSquare size={12} />
                            Manager Check-in Comment
                            {checkin.reviewedBy && (
                              <span className="text-slate-400 font-normal ml-1">· Last saved by {checkin.reviewedBy}</span>
                            )}
                          </label>
                          <div className="flex gap-2">
                            <textarea
                              rows={2}
                              placeholder="Document your discussion, feedback, or guidance for this goal..."
                              value={comments[goal.id] || ''}
                              onChange={(e) => setComments((p) => ({ ...p, [goal.id]: e.target.value }))}
                              className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                            />
                            <button
                              onClick={() => saveComment(goal)}
                              disabled={saving}
                              className="flex items-center gap-1 self-end shrink-0 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-2 rounded-lg transition disabled:opacity-50"
                            >
                              <Save size={13} /> Save
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Layout>
  );
}
