import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Auth Pages
import Login from './pages/Login';
import Setup from './pages/Setup';

// Employee Pages
import EmployeeDashboard from './pages/employee/Dashboard';
import MyGoals from './pages/employee/MyGoals';
import GoalCreation from './pages/employee/GoalCreation';
import EmployeeCheckin from './pages/employee/Checkin';

// Manager Pages
import ManagerDashboard from './pages/manager/Dashboard';
import TeamGoals from './pages/manager/TeamGoals';
import ManagerCheckin from './pages/manager/Checkin';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import UserManagement from './pages/admin/UserManagement';
import Reports from './pages/admin/Reports';
import AuditLogs from './pages/admin/AuditLogs';

// Protected Route wrapper
function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, userRole } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(userRole)) return <Navigate to="/login" replace />;
  return children;
}

// Redirect user to their role dashboard after login
function RoleRedirect() {
  const { currentUser, userRole } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (userRole === 'employee') return <Navigate to="/employee/dashboard" replace />;
  if (userRole === 'manager') return <Navigate to="/manager/dashboard" replace />;
  if (userRole === 'admin') return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { currentUser } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={currentUser ? <RoleRedirect /> : <Login />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/" element={<RoleRedirect />} />

      {/* Employee Routes */}
      <Route path="/employee/dashboard" element={
        <ProtectedRoute allowedRoles={['employee']}>
          <EmployeeDashboard />
        </ProtectedRoute>
      } />
      <Route path="/employee/goals" element={
        <ProtectedRoute allowedRoles={['employee']}>
          <MyGoals />
        </ProtectedRoute>
      } />
      <Route path="/employee/goals/create" element={
        <ProtectedRoute allowedRoles={['employee']}>
          <GoalCreation />
        </ProtectedRoute>
      } />
      <Route path="/employee/checkin" element={
        <ProtectedRoute allowedRoles={['employee']}>
          <EmployeeCheckin />
        </ProtectedRoute>
      } />

      {/* Manager Routes */}
      <Route path="/manager/dashboard" element={
        <ProtectedRoute allowedRoles={['manager']}>
          <ManagerDashboard />
        </ProtectedRoute>
      } />
      <Route path="/manager/team" element={
        <ProtectedRoute allowedRoles={['manager']}>
          <TeamGoals />
        </ProtectedRoute>
      } />
      <Route path="/manager/checkin" element={
        <ProtectedRoute allowedRoles={['manager']}>
          <ManagerCheckin />
        </ProtectedRoute>
      } />

      {/* Admin Routes */}
      <Route path="/admin/dashboard" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <UserManagement />
        </ProtectedRoute>
      } />
      <Route path="/admin/reports" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Reports />
        </ProtectedRoute>
      } />
      <Route path="/admin/audit" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AuditLogs />
        </ProtectedRoute>
      } />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <AppRoutes />
        <Analytics />
      </AuthProvider>
    </Router>
  );
}
