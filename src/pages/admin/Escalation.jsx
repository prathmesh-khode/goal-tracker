import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { AlertTriangle, Clock, CheckCircle2, Settings, RefreshCw } from 'lucide-react';

const CYCLE_OPEN = new Date('2026-05-01');
const CURRENT_QUARTER = 'q1';

function daysSince(date) {
  return Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
}

const defaultRules = {
  goalSubmissionDays: 14,
  approvalDays: 7,
  checkinDays: 21,
};

export default function Escalation() {
  const [goals, setGoals] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState(defaultRules);
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState('submission');

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

  const employees = users.filter(u => u.role === 'employee');
  const managers = users.filter(u => u.role === 'manager');
  const daysSinceCycleOpen = daysSince(CYCLE_OPEN);

  // --- Escalation 1: employees who haven't submitted goals ---
  const notSubmitted = employees.filter(emp => {
    const empGoals = goals.filter(g => g.employeeId === emp.id);
    return empGoals.length === 0 || empGoals.every(g => g.status === 'draft');
  }).map(emp => ({
    ...emp,
    daysSince: daysSinceCycleOpen,
    level: daysSinceCycleOpen > rules.goalSubmissionDays * 2 ? 'critical'
         : daysSinceCycleOpen > rules.goalSubmissionDays ? 'warning' : 'info',
    managerName: managers.find(m => m.id === emp.managerId)?.name || '—',
  }));

  // --- Escalation 2: managers haven't approved pending goals ---
  const pendingApprovals = goals.filter(g => g.status === 'pending').map(goal => {
    const submittedAt = goal.submittedAt?.toDate ? goal.submittedAt.toDate() : new Date();
    const days = daysSince(submittedAt);
    const manager = managers.find(m => m.id === goal.managerId);
    return {
      ...goal,
      days,
      managerName: manager?.name || '—',
      level: days > rules.approvalDays * 2 ? 'critical' : days > rules.approvalDays ? 'warning' : 'info',
    };
  });

  // --- Escalation 3: check-ins not completed ---
  const checkinPending = goals
    .filter(g => ['approved', 'locked'].includes(g.status))
    .filter(g => !g.checkins?.[CURRENT_QUARTER]?.achievement)
    .map(goal => {
      const emp = users.find(u => u.id === goal.employeeId);
      return {
        ...goal,
        employeeDesignation: emp?.designation || '',
        level: daysSinceCycleOpen > rules.checkinDays * 2 ? 'critical'
             : daysSinceCycleOpen > rules.checkinDays ? 'warning' : 'info',
      };
    });

  async function logEscalation(type, target) {
    try {
      await addDoc(collection(db, 'auditLogs'), {
        action: 'ESCALATION_FLAGGED',
        details: `${type}: ${target}`,
        timestamp: serverTimestamp(),
      });
      toast.success('Escalation flagged in audit log.');
    } catch {
      toast.error('Failed to log escalation.');
    }
  }

  const levelConfig = {
    info:     { color: 'bg-blue-50 border-blue-200',   badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400',   label: 'Monitoring' },
    warning:  { color: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400',  label: 'Overdue' },
    critical: { color: 'bg-red-50 border-red-200',     badge: 'bg-red-100 text-red-600',     dot: 'bg-red-500',    label: 'Critical' },
  };

  const tabs = [
    { id: 'submission', label: 'Goal Submission', count: notSubmitted.length, icon: AlertTriangle },
    { id: 'approval',   label: 'Pending Approval', count: pendingApprovals.length, icon: Clock },
    { id: 'checkin',    label: 'Check-in Missing', count: checkinPending.length, icon: CheckCircle2 },
  ];

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Escalation Monitor</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Cycle open for <span className="font-semibold text-slate-700">{daysSinceCycleOpen} days</span> · Q1 check-in window active
            </p>
          </div>
          <button
            onClick={() => setShowSettings(s => !s)}
            className="flex items-center gap-2 text-sm font-medium border border-slate-300 text-slate-600 px-3 py-2 rounded-xl hover:bg-slate-50 transition"
          >
            <Settings size={15} /> Configure Rules
          </button>
        </div>

        {/* Rule config */}
        {showSettings && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Escalation Thresholds (days)</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { key: 'goalSubmissionDays', label: 'Goal not submitted after N days', desc: 'Since cycle opened' },
                { key: 'approvalDays', label: 'Goals not approved after N days', desc: 'Since submission' },
                { key: 'checkinDays', label: 'Check-in not done after N days', desc: 'Since quarter window opened' },
              ].map(r => (
                <div key={r.key} className="bg-slate-50 rounded-xl p-4">
                  <label className="block text-xs font-medium text-slate-600 mb-1">{r.label}</label>
                  <p className="text-xs text-slate-400 mb-2">{r.desc}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={rules[r.key]}
                      onChange={e => setRules(p => ({ ...p, [r.key]: Number(e.target.value) }))}
                      className="w-20 text-sm border border-slate-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <span className="text-xs text-slate-400">days → warning</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3">Critical threshold = 2× the warning threshold. Changes apply immediately.</p>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-left p-4 rounded-xl border transition ${tab === t.id ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <t.icon size={16} className={t.count > 0 ? 'text-amber-500' : 'text-slate-400'} />
                <span className={`text-lg font-bold ${t.count > 0 ? 'text-red-500' : 'text-green-600'}`}>{t.count}</span>
              </div>
              <p className="text-xs font-semibold text-slate-700">{t.label}</p>
              <p className="text-xs text-slate-400">{t.count === 0 ? 'All clear' : 'need attention'}</p>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl py-12 text-center text-slate-400 text-sm">Loading...</div>
        ) : (
          <>
            {tab === 'submission' && (
              <EscalationList
                title="Employees who haven't submitted goals"
                items={notSubmitted}
                empty="All employees have submitted their goals."
                renderRow={emp => (
                  <EscRow
                    key={emp.id}
                    level={emp.level}
                    title={emp.name}
                    sub={`${emp.designation} · Manager: ${emp.managerName}`}
                    tag={`${emp.daysSince}d since cycle opened`}
                    onFlag={() => logEscalation('Goal Submission', emp.name)}
                    levelConfig={levelConfig}
                  />
                )}
              />
            )}

            {tab === 'approval' && (
              <EscalationList
                title="Goals pending manager approval"
                items={pendingApprovals}
                empty="No goals are pending approval."
                renderRow={goal => (
                  <EscRow
                    key={goal.id}
                    level={goal.level}
                    title={goal.title}
                    sub={`Employee: ${goal.employeeName} · Manager: ${goal.managerName}`}
                    tag={`${goal.days}d since submission`}
                    onFlag={() => logEscalation('Pending Approval', goal.title)}
                    levelConfig={levelConfig}
                  />
                )}
              />
            )}

            {tab === 'checkin' && (
              <EscalationList
                title={`Goals with missing Q1 check-in`}
                items={checkinPending}
                empty="All employees have logged their Q1 check-in."
                renderRow={goal => (
                  <EscRow
                    key={goal.id}
                    level={goal.level}
                    title={goal.employeeName}
                    sub={`Goal: ${goal.title} · ${goal.department}`}
                    tag={`${daysSinceCycleOpen}d since window opened`}
                    onFlag={() => logEscalation('Missing Check-in', goal.employeeName)}
                    levelConfig={levelConfig}
                  />
                )}
              />
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

function EscalationList({ title, items, empty, renderRow }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${items.length > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="py-12 text-center">
          <CheckCircle2 size={32} className="text-green-400 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">{empty}</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">{items.map(renderRow)}</div>
      )}
    </div>
  );
}

function EscRow({ level, title, sub, tag, onFlag, levelConfig }) {
  const lc = levelConfig[level];
  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 border-l-4 ${level === 'critical' ? 'border-l-red-500' : level === 'warning' ? 'border-l-amber-400' : 'border-l-blue-400'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-slate-400">{tag}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${lc.badge}`}>{lc.label}</span>
        <button
          onClick={onFlag}
          className="text-xs text-slate-500 border border-slate-200 hover:border-red-300 hover:text-red-600 px-2.5 py-1 rounded-lg transition"
        >
          Flag
        </button>
      </div>
    </div>
  );
}
