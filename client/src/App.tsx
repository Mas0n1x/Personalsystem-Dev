import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';
import Absences from './pages/Absences';

// Admin
import Users from './pages/admin/Users';
import Roles from './pages/admin/Roles';
import AuditLogs from './pages/admin/AuditLogs';
import Settings from './pages/admin/Settings';

// Leadership
import Leadership from './pages/Leadership';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="employees/:id" element={<EmployeeDetail />} />
        <Route path="absences" element={<Absences />} />

        {/* Leadership */}
        <Route path="leadership" element={<Leadership />} />

        {/* Admin */}
        <Route path="admin/users" element={<Users />} />
        <Route path="admin/roles" element={<Roles />} />
        <Route path="admin/audit-logs" element={<AuditLogs />} />
        <Route path="admin/settings" element={<Settings />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
