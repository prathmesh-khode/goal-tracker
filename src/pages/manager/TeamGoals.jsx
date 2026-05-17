import { useEffect, useState } from 'react';
import {
  collection, query, where, getDocs, doc,
  updateDoc, serverTimestamp, addDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronUp, Check, X, RotateCcw, Edit3, Save, Lock } from 'lucide-react';

const STATUS_STYLE = {
  draft: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  locked: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
};

const UOM_LABELS = {
  numeric_min: 'Numeric (↑ higher better)',
  numeric_max: 'Numeric (↓ lower better)',
  percent_min: '% (↑)',
  percent_max: '% (↓)',
  timeline: 'Timeline',
  zero: 'Zero-based',
};

export default function TeamGoals() {
  const { currentUser, userProfile } = useAuth();
  const [members, setMembers] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [editingGoal, setEditingGoal] = useState(null);
  const [editData, setEditData] = useState({});
  const [rejectComment, setRejectComment] = useState({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!currentUser) return;
    async function load() {
      try {
        const [mSnap, gSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('managerId', '==', currentUser.uid))),
          getDocs(query(collection(db, 'goals'), where('managerId', '==', currentUser.uid))),
        ]);
        setMembers(mSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setGoals(gSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        toast.error('Failed to load team data.');
      }
      setLoading(false);
    }
    load();
  }, [currentUser]);

  function toggleMember(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function memberGoals(memberId) {
    return goals.filter((g) => g.employeeId === memberId);
  }

  async function logAudit(action, goalId, details) {
    try {
      await addDoc(collection(db, 'auditLogs'), {
        action,
        goalId,
        details,
        managerId: currentUser.uid,
        managerName: userProfile?.name,
        timestamp: serverTimestamp(),
      });
    } catch (_) {}
  }

  async function approveGoal(goal) {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'goals', goal.id), {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: userProfile?.name,
        managerComment: '',
        updatedAt: serverTimestamp(),
      });
      await logAudit('GOAL_APPROVED', goal.id, `Approved goal: ${goal.title}`);
      setGoals((prev) => prev.map((g) => g.id === goal.id ? { ...g, status: 'approved', approvedBy: userProfile?.name } : g));
      toast.success('Goal approved.');
    } catch {
      toast.error('Failed to approve.');
    }
    setSaving(false);
  }

  async function rejectGoal(goal) {
    const comment = rejectComment[goal.id] || '';
    if (!comment.trim()) {
      toast.error('Please add a comment before returning the goal.');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'goals', goal.id), {
        status: 'rejected',
        managerComment: comment,
        updatedAt: serverTimestamp(),
      });
      await logAudit('GOAL_RETURNED', goal.id, `Returned: ${comment}`);
      setGoals((prev) => prev.map((g) => g.id === goal.id ? { ...g, status: 'rejected', managerComment: comment } : g));
      setRejectComment((prev) => ({ ...prev, [goal.id]: '' }));
      toast.success('Goal returned for rework.');
    } catch {
      toast.error('Failed to return goal.');
    }
    setSaving(false);
  }

  async function lockGoal(goal) {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'goals', goal.id), {
        status: 'locked',
        lockedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAudit('GOAL_LOCKED', goal.id, `Locked goal: ${goal.title}`);
      setGoals((prev) => prev.map((g) => g.id === goal.id ? { ...g, status: 'locked' } : g));
      toast.success('Goal locked.');
    } catch {
      toast.error('Failed to lock.');
    }
    setSaving(false);
  }

  function startEdit(goal) {
    setEditingGoal(goal.id);
    setEditData({ target: goal.target, weightage: goal.weightage });
  }

  async function saveEdit(goal) {
    if (!editData.target || !editData.weightage) {
      toast.error('Target and weightage are required.');
      return;
    }
    if (Number(editData.weightage) < 10) {
      toast.error('Weightage must be at least 10%.');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'goals', goal.id), {
        target: editData.target,
        weightage: Number(editData.weightage),
        editedByManager: userProfile?.name,
        updatedAt: serverTimestamp(),
      });
      await logAudit('GOAL_EDITED', goal.id, `Manager edited target to ${editData.target}, weightage to ${editData.weightage}%`);
      setGoals((prev) => prev.map((g) =>
        g.id === goal.id ? { ...g, target: editData.target, weightage: Number(editData.weightage) } : g
      ));
      setEditingGoal(null);
      toast.success('Goal updated.');
    } catch {
      toast.error('Failed to save edits.');
    }
    setSaving(false);
  }

  const filteredMembers = members.filter((m) => {
    if (filter === 'all') return true;
    const mg = memberGoals(m.id);
    if (filter === 'pending') return mg.some((g) => g.status === 'pending');
    if (filter === 'approved') return mg.every((g) => ['approved', 'locked'].includes(g.status)) && mg.length > 0;
    if (filter === 'none') return mg.length === 0;
    return true;
  });

  if (loading) {
    return (
      <Layout title="Team Goals">
        <div className="flex items-center justify-center h-60 text-slate-400">Loading team data...</div>
      </Layout>
    );
  }

  return (
    <Layout title="Team Goals">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { value: 'all', label: `All (${members.length})` },
            { value: 'pending', label: `Pending (${goals.filter(g => g.status === 'pending').length})` },
            { value: 'approved', label: 'Approved' },
            { value: 'none', label: 'No Goals' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${
                filter === f.value
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredMembers.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl py-14 text-center">
            <p className="text-slate-400 text-sm">No team members found for this filter.</p>
          </div>
        ) : (
          filteredMembers.map((member) => {
            const mg = memberGoals(member.id);
            const isOpen = expanded[member.id];
            const pendingCount = mg.filter((g) => g.status === 'pending').length;
            const totalWeight = mg.reduce((s, g) => s + (Number(g.weightage) || 0), 0);

            return (
              <div key={member.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Member header */}
                <button
                  onClick={() => toggleMember(member.id)}
                  className="w-full flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center shrink-0">
                    {member.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{member.name}</p>
                    <p className="text-xs text-slate-400">{member.designation} · {mg.length} goal{mg.length !== 1 ? 's' : ''} · {totalWeight}% total weight</p>
                  </div>
                  {pendingCount > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded-full">
                      {pendingCount} pending
                    </span>
                  )}
                  {pendingCount === 0 && mg.length > 0 && mg.every((g) => ['approved', 'locked'].includes(g.status)) && (
                    <span className="text-xs bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded-full">All approved</span>
                  )}
                  {isOpen ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                </button>

                {/* Goals list */}
                {isOpen && (
                  <div className="border-t border-slate-100">
                    {mg.length === 0 ? (
                      <p className="text-center text-slate-400 text-sm py-8">No goals submitted yet.</p>
                    ) : (
                      mg.map((goal) => {
                        const isEditing = editingGoal === goal.id;
                        const canEdit = goal.status === 'pending';
                        return (
                          <div key={goal.id} className="border-b border-slate-100 last:border-0 px-4 py-4">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-semibold text-slate-800">{goal.title}</p>
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[goal.status] || STATUS_STYLE.draft}`}>
                                    {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {goal.thrustArea} · {UOM_LABELS[goal.uom] || goal.uom}
                                </p>
                                {goal.description && (
                                  <p className="text-xs text-slate-500 mt-1">{goal.description}</p>
                                )}
                                {goal.managerComment && goal.status === 'rejected' && (
                                  <p className="text-xs text-red-600 mt-1.5 bg-red-50 px-2 py-1 rounded">
                                    Your comment: {goal.managerComment}
                                  </p>
                                )}
                                {goal.editedByManager && (
                                  <p className="text-xs text-blue-500 mt-1">Edited by manager</p>
                                )}
                              </div>

                              {/* Action buttons */}
                              {goal.status === 'pending' && !isEditing && (
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={() => startEdit(goal)}
                                    title="Edit target/weightage"
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                  >
                                    <Edit3 size={15} />
                                  </button>
                                  <button
                                    onClick={() => approveGoal(goal)}
                                    disabled={saving}
                                    className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                                  >
                                    <Check size={13} /> Approve
                                  </button>
                                </div>
                              )}
                              {goal.status === 'approved' && (
                                <button
                                  onClick={() => lockGoal(goal)}
                                  disabled={saving}
                                  className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50 shrink-0"
                                >
                                  <Lock size={13} /> Lock
                                </button>
                              )}
                            </div>

                            {/* Target / weightage row */}
                            {isEditing ? (
                              <div className="mt-3 flex items-end gap-3 flex-wrap">
                                <div>
                                  <label className="block text-xs text-slate-500 mb-1">Target</label>
                                  <input
                                    type="text"
                                    value={editData.target}
                                    onChange={(e) => setEditData((p) => ({ ...p, target: e.target.value }))}
                                    className="text-sm border border-slate-300 rounded-lg px-3 py-2 w-36 outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-500 mb-1">Weightage (%)</label>
                                  <input
                                    type="number"
                                    min="10"
                                    value={editData.weightage}
                                    onChange={(e) => setEditData((p) => ({ ...p, weightage: e.target.value }))}
                                    className="text-sm border border-slate-300 rounded-lg px-3 py-2 w-24 outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => saveEdit(goal)}
                                    disabled={saving}
                                    className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-2 rounded-lg transition"
                                  >
                                    <Save size={13} /> Save
                                  </button>
                                  <button
                                    onClick={() => setEditingGoal(null)}
                                    className="flex items-center gap-1 text-xs border border-slate-300 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-50 transition"
                                  >
                                    <X size={13} /> Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                <span>Target: <span className="font-semibold text-slate-700">{goal.target}</span></span>
                                <span>Weightage: <span className="font-semibold text-slate-700">{goal.weightage}%</span></span>
                              </div>
                            )}

                            {/* Reject section */}
                            {goal.status === 'pending' && !isEditing && (
                              <div className="mt-3">
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Add comment before returning for rework..."
                                    value={rejectComment[goal.id] || ''}
                                    onChange={(e) => setRejectComment((p) => ({ ...p, [goal.id]: e.target.value }))}
                                    className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-400"
                                  />
                                  <button
                                    onClick={() => rejectGoal(goal)}
                                    disabled={saving}
                                    className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 font-medium border border-red-200 px-3 py-2 rounded-lg transition disabled:opacity-50 shrink-0"
                                  >
                                    <RotateCcw size={13} /> Return
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}

                    {/* Weightage total */}
                    {mg.length > 0 && (
                      <div className={`px-4 py-3 flex justify-between text-xs font-semibold ${
                        mg.reduce((s, g) => s + Number(g.weightage), 0) === 100
                          ? 'bg-green-50 text-green-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        <span>Total Weightage</span>
                        <span>{mg.reduce((s, g) => s + Number(g.weightage), 0)}% {mg.reduce((s, g) => s + Number(g.weightage), 0) === 100 ? '✓' : '(must be 100%)'}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Layout>
  );
}
