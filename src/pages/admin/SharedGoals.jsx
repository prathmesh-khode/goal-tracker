import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Send, Users, Lock, ChevronDown, ChevronUp } from 'lucide-react';

const THRUST_AREAS = [
  'Revenue & Growth', 'Customer Experience', 'Operational Efficiency',
  'People & Culture', 'Innovation & Technology', 'Quality & Compliance',
  'Cost Optimization', 'Safety & Environment',
];

const UOM_TYPES = [
  { value: 'numeric_min', label: 'Numeric – Higher is better' },
  { value: 'numeric_max', label: 'Numeric – Lower is better' },
  { value: 'percent_min', label: '% – Higher is better' },
  { value: 'percent_max', label: '% – Lower is better' },
  { value: 'timeline', label: 'Timeline – Date-based' },
  { value: 'zero', label: 'Zero-based – Zero = Success' },
];

export default function SharedGoals() {
  const { currentUser, userProfile } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [managers, setManagers] = useState([]);
  const [sharedGoals, setSharedGoals] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [expandedGoal, setExpandedGoal] = useState(null);
  const [filterDept, setFilterDept] = useState('all');

  const [form, setForm] = useState({
    title: '', description: '', thrustArea: '', uom: '', target: '', defaultWeightage: '10',
  });

  useEffect(() => {
    async function load() {
      const [uSnap, gSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'goals'), where('isShared', '==', true))),
      ]);
      const all = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEmployees(all.filter(u => u.role === 'employee'));
      setManagers(all.filter(u => u.role === 'manager'));
      setSharedGoals(gSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, []);

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

  const filteredEmployees = filterDept === 'all'
    ? employees
    : employees.filter(e => e.department === filterDept);

  function toggleEmployee(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleAll() {
    const visibleIds = filteredEmployees.map(e => e.id);
    const allSelected = visibleIds.every(id => selected.includes(id));
    if (allSelected) {
      setSelected(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelected(prev => [...new Set([...prev, ...visibleIds])]);
    }
  }

  function setField(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function pushGoal() {
    if (!form.title || !form.thrustArea || !form.uom || !form.target) {
      toast.error('Please fill all required fields.'); return;
    }
    if (selected.length === 0) {
      toast.error('Select at least one employee.'); return;
    }
    const w = Number(form.defaultWeightage);
    if (!w || w < 10) { toast.error('Default weightage must be at least 10%.'); return; }

    setPushing(true);
    try {
      const sharedGroupId = `shared_${Date.now()}`;
      const results = [];

      for (const empId of selected) {
        const emp = employees.find(e => e.id === empId);
        const ref = await addDoc(collection(db, 'goals'), {
          title: form.title,
          description: form.description,
          thrustArea: form.thrustArea,
          uom: form.uom,
          target: form.target,
          weightage: w,
          isShared: true,
          sharedGroupId,
          sharedBy: userProfile?.name,
          titleLocked: true,
          targetLocked: true,
          status: 'pending',
          employeeId: empId,
          employeeName: emp?.name,
          department: emp?.department,
          managerId: emp?.managerId || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        results.push(ref.id);
      }

      await addDoc(collection(db, 'auditLogs'), {
        action: 'SHARED_GOAL_PUSHED',
        details: `"${form.title}" pushed to ${selected.length} employees`,
        sharedGroupId,
        pushedBy: userProfile?.name,
        recipientCount: selected.length,
        timestamp: serverTimestamp(),
      });

      toast.success(`Goal pushed to ${selected.length} employee${selected.length !== 1 ? 's' : ''} successfully!`);
      setForm({ title: '', description: '', thrustArea: '', uom: '', target: '', defaultWeightage: '10' });
      setSelected([]);

      // Refresh
      const gSnap = await getDocs(query(collection(db, 'goals'), where('isShared', '==', true)));
      setSharedGoals(gSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Failed to push goal: ' + e.message);
    }
    setPushing(false);
  }

  // Group shared goals by sharedGroupId
  const groupedShared = sharedGoals.reduce((acc, g) => {
    const key = g.sharedGroupId || g.id;
    if (!acc[key]) acc[key] = { title: g.title, target: g.target, thrustArea: g.thrustArea, pushedBy: g.sharedBy, goals: [] };
    acc[key].goals.push(g);
    return acc;
  }, {});

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Shared Goals</h1>
          <p className="text-slate-500 text-sm mt-0.5">Push a departmental KPI to multiple employees at once. Title and target are read-only for recipients.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">

          {/* Form */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">Create Shared Goal</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Goal Title * <Lock size={10} className="inline text-slate-400 ml-1" /> read-only for employees</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setField('title', e.target.value)}
                  placeholder="e.g. Reduce operational costs by 15%"
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Thrust Area *</label>
                  <select value={form.thrustArea} onChange={e => setField('thrustArea', e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                    <option value="">Select</option>
                    {THRUST_AREAS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">UoM *</label>
                  <select value={form.uom} onChange={e => setField('uom', e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                    <option value="">Select</option>
                    {UOM_TYPES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Target * <Lock size={10} className="inline text-slate-400 ml-1" /></label>
                  <input
                    type={form.uom === 'timeline' ? 'date' : 'text'}
                    value={form.target}
                    onChange={e => setField('target', e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Default Weightage (%)</label>
                  <input
                    type="number" min="10" max="100"
                    value={form.defaultWeightage}
                    onChange={e => setField('defaultWeightage', e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
                <textarea rows={2} value={form.description} onChange={e => setField('description', e.target.value)}
                  placeholder="Optional description..."
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              </div>

              <button
                onClick={pushGoal}
                disabled={pushing || selected.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50 shadow-sm"
              >
                <Send size={15} />
                {pushing ? 'Pushing...' : `Push to ${selected.length} employee${selected.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

          {/* Employee selector */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Users size={15} className="text-slate-400" /> Select Recipients
              </h2>
              <div className="flex items-center gap-2">
                <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 outline-none bg-white">
                  <option value="all">All depts</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <button onClick={toggleAll} className="text-xs font-medium text-violet-600 hover:underline whitespace-nowrap">
                  {filteredEmployees.every(e => selected.includes(e.id)) ? 'Deselect all' : 'Select all'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-80">
              {loading ? (
                <p className="text-center text-slate-400 text-sm py-10">Loading...</p>
              ) : filteredEmployees.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-10">No employees found.</p>
              ) : (
                filteredEmployees.map(emp => {
                  const isSelected = selected.includes(emp.id);
                  const manager = managers.find(m => m.id === emp.managerId);
                  return (
                    <button
                      key={emp.id}
                      onClick={() => toggleEmployee(emp.id)}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-left transition ${isSelected ? 'bg-violet-50' : 'hover:bg-slate-50'}`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${isSelected ? 'bg-violet-600 border-violet-600' : 'border-slate-300'}`}>
                        {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{emp.name}</p>
                        <p className="text-xs text-slate-400">{emp.designation} · {emp.department}{manager ? ` · ${manager.name}` : ''}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-violet-600">{selected.length}</span> of {employees.length} employees selected
              </p>
            </div>
          </div>
        </div>

        {/* Previously pushed shared goals */}
        {Object.keys(groupedShared).length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">Previously Pushed Goals</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {Object.entries(groupedShared).map(([groupId, group]) => (
                <div key={groupId}>
                  <button
                    onClick={() => setExpandedGoal(expandedGoal === groupId ? null : groupId)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{group.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{group.thrustArea} · Target: {group.target} · Pushed by {group.pushedBy} · {group.goals.length} recipients</p>
                    </div>
                    {expandedGoal === groupId ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                  </button>

                  {expandedGoal === groupId && (
                    <div className="px-5 pb-4">
                      <div className="flex flex-wrap gap-2">
                        {group.goals.map(g => (
                          <span key={g.id} className="text-xs bg-violet-50 text-violet-700 border border-violet-100 px-2.5 py-1 rounded-full">
                            {g.employeeName} · {g.weightage}%
                            {g.status === 'approved' && ' ✓'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
