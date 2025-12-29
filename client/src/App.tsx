import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';

// HR
import Applications from './pages/hr/Applications';

// IA
import Evaluations from './pages/ia/Evaluations';

// Academy
import Trainings from './pages/academy/Trainings';

// QA
import QualityReports from './pages/qa/QualityReports';

// Finance
import Transactions from './pages/finance/Transactions';
import Evidence from './pages/finance/Evidence';
import Robberies from './pages/finance/Robberies';
import Absences from './pages/finance/Absences';

// Admin
import Users from './pages/admin/Users';
import Roles from './pages/admin/Roles';
import Announcements from './pages/admin/Announcements';
import AuditLogs from './pages/admin/AuditLogs';
import Settings from './pages/admin/Settings';

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

        {/* HR */}
        <Route path="hr/applications" element={<Applications />} />

        {/* IA */}
        <Route path="ia/evaluations" element={<Evaluations />} />

        {/* Academy */}
        <Route path="academy/trainings" element={<Trainings />} />

        {/* QA */}
        <Route path="qa/reports" element={<QualityReports />} />

        {/* Finance */}
        <Route path="finance/transactions" element={<Transactions />} />
        <Route path="finance/evidence" element={<Evidence />} />
        <Route path="finance/robberies" element={<Robberies />} />
        <Route path="finance/absences" element={<Absences />} />

        {/* Admin */}
        <Route path="admin/users" element={<Users />} />
        <Route path="admin/roles" element={<Roles />} />
        <Route path="admin/announcements" element={<Announcements />} />
        <Route path="admin/audit-logs" element={<AuditLogs />} />
        <Route path="admin/settings" element={<Settings />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
