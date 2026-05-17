import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

const DEMO_USERS = [
  {
    email: 'admin@demo.com',
    password: 'Demo@123',
    profile: {
      name: 'Admin User',
      role: 'admin',
      department: 'Human Resources',
      designation: 'HR Manager',
      email: 'admin@demo.com',
    },
  },
  {
    email: 'manager@demo.com',
    password: 'Demo@123',
    profile: {
      name: 'Sarah Williams',
      role: 'manager',
      department: 'Engineering',
      designation: 'Engineering Manager',
      email: 'manager@demo.com',
    },
  },
  {
    email: 'employee@demo.com',
    password: 'Demo@123',
    profile: {
      name: 'John Smith',
      role: 'employee',
      department: 'Engineering',
      designation: 'Software Engineer',
      email: 'employee@demo.com',
    },
  },
  {
    email: 'employee2@demo.com',
    password: 'Demo@123',
    profile: {
      name: 'Priya Patel',
      role: 'employee',
      department: 'Engineering',
      designation: 'Product Analyst',
      email: 'employee2@demo.com',
    },
  },
];

export default function Setup() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function addLog(msg, type = 'info') {
    setLogs((prev) => [...prev, { msg, type, id: Date.now() + Math.random() }]);
  }

  async function createDemoUsers() {
    setLoading(true);
    setLogs([]);

    const uids = {};

    for (const user of DEMO_USERS) {
      try {
        addLog(`Creating ${user.email}...`, 'info');
        const cred = await createUserWithEmailAndPassword(auth, user.email, user.password);
        uids[user.profile.role] = uids[user.profile.role] || cred.user.uid;

        await setDoc(doc(db, 'users', cred.user.uid), {
          ...user.profile,
          uid: cred.user.uid,
          managerId: '',
          createdAt: serverTimestamp(),
        });

        addLog(`✓ Created: ${user.email}`, 'success');
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
          addLog(`⚠ Already exists: ${user.email} (skip)`, 'warn');
        } else {
          addLog(`✗ Error for ${user.email}: ${err.message}`, 'error');
        }
      }
    }

    // Link employees to manager
    if (uids.manager && uids.employee) {
      try {
        await setDoc(doc(db, 'users', uids.employee), { managerId: uids.manager }, { merge: true });
        addLog('✓ Linked employee to manager', 'success');
      } catch {
        addLog('Could not auto-link employee to manager (do it manually in Firestore)', 'warn');
      }
    }

    addLog('🎉 Setup complete! Go to /login', 'success');
    setLoading(false);
    setDone(true);
  }

  const logColors = {
    info: 'text-gray-600',
    success: 'text-green-600',
    warn: 'text-yellow-600',
    error: 'text-red-600',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Setup Demo Users</h1>
        <p className="text-gray-500 text-sm mb-6">
          Run this once to create demo accounts in Firebase. After that, use{' '}
          <strong>/login</strong>.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm">
          <p className="font-semibold text-blue-800 mb-2">Will create 4 accounts:</p>
          <div className="space-y-1 text-blue-700">
            <p>🔑 admin@demo.com / Demo@123</p>
            <p>👔 manager@demo.com / Demo@123</p>
            <p>👤 employee@demo.com / Demo@123</p>
            <p>👤 employee2@demo.com / Demo@123</p>
          </div>
        </div>

        {!done ? (
          <button
            onClick={createDemoUsers}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Creating users...
              </>
            ) : (
              'Create Demo Users'
            )}
          </button>
        ) : (
          <a
            href="/login"
            className="block text-center w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition"
          >
            ✓ Go to Login →
          </a>
        )}

        {logs.length > 0 && (
          <div className="mt-5 bg-gray-900 rounded-xl p-4 font-mono text-xs max-h-48 overflow-y-auto">
            {logs.map((log) => (
              <p key={log.id} className={logColors[log.type] + ' mb-0.5'}>
                {log.msg}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
