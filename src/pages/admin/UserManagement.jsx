import { useEffect, useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, updateDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Plus, X, UserCog, Search } from 'lucide-react';

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Finance', 'Human Resources', 'Operations', 'Product'];
const ROLES = ['employee', 'manager', 'admin'];

const ROLE_STYLE = {
  employee: 'bg-blue-100 text-blue-700',
  manager: 'bg-emerald-100 text-emerald-700',
  admin: 'bg-purple-100 text-purple-700',
};

const blankForm = {
  name: '', email: '', password: '', role: 'employee',
  department: 'Engineering', designation: '', managerId: '',
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [editingManager, setEditingManager] = useState(null);
  const [newManagerId, setNewManagerId] = useState('');

  async function loadUsers() {
    const snap = await getDocs(collection(db, 'users'));
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setUsers(all);
    setManagers(all.filter(u => u.role === 'manager' || u.role === 'admin'));
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  function setField(k, v) {
    setForm(p => ({ ...p, [k]: v }));
  }

  async function createUser() {
    if (!form.name || !form.email || !form.password || !form.designation) {
      toast.error('Name, email, password and designation are required.');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setCreating(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        name: form.name,
        email: form.email,
        role: form.role,
        department: form.department,
        designation: form.designation,
        managerId: form.managerId || '',
        createdAt: serverTimestamp(),
      });
      toast.success(`User ${form.name} created successfully.`);
      setForm(blankForm);
      setShowForm(false);
      await loadUsers();
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        toast.error('Email already in use.');
      } else {
        toast.error('Failed to create user: ' + e.message);
      }
    }
    setCreating(false);
  }

  async function updateManager(userId) {
    try {
      await updateDoc(doc(db, 'users', userId), {
        managerId: newManagerId,
        updatedAt: serverTimestamp(),
      });
      toast.success('Manager updated.');
      setEditingManager(null);
      await loadUsers();
    } catch {
      toast.error('Failed to update manager.');
    }
  }

  async function updateRole(userId, newRole) {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole, updatedAt: serverTimestamp() });
      toast.success('Role updated.');
      await loadUsers();
    } catch {
      toast.error('Failed to update role.');
    }
  }

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.department?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout title="User Management">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, department..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 w-72"
            />
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-sm"
          >
            <Plus size={15} /> Add User
          </button>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'Total', count: users.length, color: 'bg-slate-100 text-slate-700' },
            { label: 'Employees', count: users.filter(u => u.role === 'employee').length, color: 'bg-blue-100 text-blue-700' },
            { label: 'Managers', count: users.filter(u => u.role === 'manager').length, color: 'bg-emerald-100 text-emerald-700' },
            { label: 'Admins', count: users.filter(u => u.role === 'admin').length, color: 'bg-purple-100 text-purple-700' },
          ].map(s => (
            <span key={s.label} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${s.color}`}>
              {s.label}: {s.count}
            </span>
          ))}
        </div>

        {/* Create User Form */}
        {showForm && (
          <div className="bg-white border border-purple-200 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3.5 bg-purple-50 border-b border-purple-200">
              <h2 className="text-sm font-semibold text-purple-800">Create New User</h2>
              <button onClick={() => setShowForm(false)} className="text-purple-400 hover:text-purple-600 transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 grid md:grid-cols-2 gap-4">
              {[
                { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'e.g. Ravi Kumar' },
                { label: 'Email Address *', key: 'email', type: 'email', placeholder: 'ravi@company.com' },
                { label: 'Password *', key: 'password', type: 'password', placeholder: 'Min 6 characters' },
                { label: 'Designation *', key: 'designation', type: 'text', placeholder: 'e.g. Senior Engineer' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">{f.label}</label>
                  <input
                    type={f.type}
                    value={form[f.key]}
                    onChange={e => setField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Role *</label>
                <select
                  value={form.role}
                  onChange={e => setField('role', e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Department</label>
                <select
                  value={form.department}
                  onChange={e => setField('department', e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {form.role === 'employee' && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Assign Manager</label>
                  <select
                    value={form.managerId}
                    onChange={e => setField('managerId', e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    <option value="">— No manager assigned —</option>
                    {managers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}
                  </select>
                </div>
              )}

              <div className="md:col-span-2 flex justify-end gap-3">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 text-sm font-medium border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={createUser}
                  disabled={creating}
                  className="px-5 py-2.5 text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden lg:table-cell">Manager</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400 text-sm">Loading users...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400 text-sm">No users found.</td></tr>
              ) : (
                filtered.map(user => {
                  const managerName = managers.find(m => m.id === user.managerId)?.name || '—';
                  const isEditingThis = editingManager === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${ROLE_STYLE[user.role]}`}>
                            {user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{user.name}</p>
                            <p className="text-xs text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 hidden md:table-cell">
                        <p>{user.department}</p>
                        <p className="text-xs text-slate-400">{user.designation}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <select
                          value={user.role}
                          onChange={e => updateRole(user.id, e.target.value)}
                          className={`text-xs font-semibold px-2 py-1 rounded-full border-0 outline-none cursor-pointer ${ROLE_STYLE[user.role]}`}
                        >
                          {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        {user.role === 'employee' ? (
                          isEditingThis ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={newManagerId}
                                onChange={e => setNewManagerId(e.target.value)}
                                className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 outline-none"
                              >
                                <option value="">No manager</option>
                                {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </select>
                              <button onClick={() => updateManager(user.id)} className="text-xs text-green-600 font-semibold hover:underline">Save</button>
                              <button onClick={() => setEditingManager(null)} className="text-xs text-slate-400 hover:underline">Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingManager(user.id); setNewManagerId(user.managerId || ''); }}
                              className="text-xs text-slate-600 hover:text-purple-600 flex items-center gap-1 group"
                            >
                              {managerName}
                              <UserCog size={11} className="opacity-0 group-hover:opacity-100 transition" />
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-xs text-slate-400">
                          {user.uid ? user.uid.slice(0, 8) + '...' : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
