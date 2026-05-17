import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { ArrowRight, Clock, CheckCircle2, AlertCircle, Users } from 'lucide-react';

export default function ManagerDashboard() {
  const { currentUser, userProfile } = useAuth();
  const [teamGoals, setTeamGoals] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    async function load() {
      try {
        const [membersSnap, goalsSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('managerId', '==', currentUser.uid))),
          getDocs(query(collection(db, 'goals'), where('managerId', '==', currentUser.uid))),
        ]);
        setTeamMembers(membersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setTeamGoals(goalsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }

    load();
  }, [currentUser]);

  const pending = teamGoals.filter((g) => g.status === 'pending');
  const approved = teamGoals.filter((g) => g.status === 'approved' || g.status === 'locked');
  const draft = teamGoals.filter((g) => g.status === 'draft');

  const firstName = userProfile?.name?.split(' ')[0] || 'Manager';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Per-member summary
  const memberSummary = teamMembers.map((m) => {
    const mg = teamGoals.filter((g) => g.employeeId === m.id);
    const hasPending = mg.some((g) => g.status === 'pending');
    const allApproved = mg.length > 0 && mg.every((g) => ['approved', 'locked'].includes(g.status));
    return { ...m, goalCount: mg.length, hasPending, allApproved };
  });

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{greeting},</p>
            <h1 className="text-2xl font-bold text-slate-900 mt-0.5">{firstName} 👋</h1>
            <p className="text-sm text-slate-500 mt-1">
              {userProfile?.designation} &middot; {userProfile?.department}
            </p>
          </div>
          <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-emerald-100">
            {teamMembers.length} direct report{teamMembers.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Pending alert */}
        {pending.length > 0 && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
            <AlertCircle size={17} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                {pending.length} goal{pending.length !== 1 ? 's' : ''} waiting for your approval
              </p>
              <p className="text-xs text-amber-600 mt-0.5">Review and approve your team's goals to unlock check-ins.</p>
            </div>
            <Link
              to="/manager/team"
              className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
            >
              Review now
            </Link>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Team Members', value: teamMembers.length, sub: 'direct reports' },
            { label: 'Pending Approval', value: pending.length, sub: 'need action', alert: pending.length > 0 },
            { label: 'Approved Goals', value: approved.length, sub: 'locked in' },
            { label: 'Draft Goals', value: draft.length, sub: 'not submitted' },
          ].map((s) => (
            <div key={s.label} className={`bg-white rounded-xl border p-4 ${s.alert ? 'border-amber-300' : 'border-slate-200'}`}>
              <p className="text-xs font-medium text-slate-500">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.alert ? 'text-amber-500' : 'text-slate-900'}`}>
                {loading ? '—' : s.value}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Team members list */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Users size={15} className="text-slate-400" /> Team Overview
            </h2>
            <Link to="/manager/team" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
              Manage goals <ArrowRight size={11} />
            </Link>
          </div>

          {loading ? (
            <p className="text-center text-slate-400 text-sm py-10">Loading team...</p>
          ) : teamMembers.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-slate-400 text-sm">No team members linked to your account yet.</p>
              <p className="text-xs text-slate-400 mt-1">Ask Admin to assign employees to you in User Management.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {memberSummary.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 font-semibold text-sm flex items-center justify-center shrink-0">
                    {m.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{m.name}</p>
                    <p className="text-xs text-slate-400">{m.designation} · {m.goalCount} goal{m.goalCount !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="shrink-0">
                    {m.hasPending && (
                      <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Clock size={10} /> Needs review
                      </span>
                    )}
                    {!m.hasPending && m.allApproved && (
                      <span className="text-xs bg-green-100 text-green-700 font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={10} /> Approved
                      </span>
                    )}
                    {!m.hasPending && !m.allApproved && m.goalCount === 0 && (
                      <span className="text-xs bg-slate-100 text-slate-500 font-medium px-2.5 py-1 rounded-full">
                        No goals yet
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { icon: '✅', label: 'Review & Approve Goals', desc: 'Approve, edit or return goals', to: '/manager/team' },
            { icon: '📊', label: 'Team Check-ins', desc: 'View progress & add comments', to: '/manager/checkin' },
            { icon: '📋', label: 'Pending Approvals', desc: `${pending.length} goal${pending.length !== 1 ? 's' : ''} waiting`, to: '/manager/team' },
          ].map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className="flex items-center gap-3 bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-sm rounded-xl p-4 transition-all group"
            >
              <span className="text-xl">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors">{a.label}</p>
                <p className="text-xs text-slate-400">{a.desc}</p>
              </div>
              <ArrowRight size={14} className="text-slate-300 group-hover:text-emerald-400 shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
