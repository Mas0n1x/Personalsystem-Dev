import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useLiveUpdates } from './hooks/useLiveUpdates';
import Layout from './components/layout/Layout';

// Kritische Seiten - sofort laden
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';

// Lazy Loading für alle anderen Seiten
const Employees = lazy(() => import('./pages/Employees'));
const EmployeeDetail = lazy(() => import('./pages/EmployeeDetail'));
const Absences = lazy(() => import('./pages/Absences'));

// Admin - Lazy Loading
const Users = lazy(() => import('./pages/admin/Users'));
const Roles = lazy(() => import('./pages/admin/Roles'));
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs'));
const Settings = lazy(() => import('./pages/admin/Settings'));
const AcademyModules = lazy(() => import('./pages/admin/AcademyModules'));
const AcademySettings = lazy(() => import('./pages/admin/AcademySettings'));
const IASettings = lazy(() => import('./pages/admin/IASettings'));
const QASettings = lazy(() => import('./pages/admin/QASettings'));
const Backups = lazy(() => import('./pages/admin/Backups'));
const BonusSettings = lazy(() => import('./pages/admin/BonusSettings'));
const DiscordAnnouncements = lazy(() => import('./pages/admin/DiscordAnnouncements'));
const UnitsAdmin = lazy(() => import('./pages/admin/UnitsAdmin'));

// Leadership - Lazy Loading
const UnitsOverview = lazy(() => import('./pages/UnitsOverview'));
const Leadership = lazy(() => import('./pages/Leadership'));
const Evidence = lazy(() => import('./pages/Evidence'));
const Tuning = lazy(() => import('./pages/Tuning'));
const Robbery = lazy(() => import('./pages/Robbery'));
const HumanResources = lazy(() => import('./pages/HumanResources'));
const Detectives = lazy(() => import('./pages/Detectives'));
const Academy = lazy(() => import('./pages/Academy'));
const InternalAffairs = lazy(() => import('./pages/InternalAffairs'));
const QualityAssurance = lazy(() => import('./pages/QualityAssurance'));
const Teamleitung = lazy(() => import('./pages/Teamleitung'));
const Management = lazy(() => import('./pages/Management'));
const Calendar = lazy(() => import('./pages/Calendar'));

// Suspense Fallback Komponente
function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary-500 to-purple-500 blur-xl opacity-30 animate-pulse" />
        <div className="relative animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-primary-500" />
      </div>
    </div>
  );
}

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
  // Live-Updates aktivieren - invalidiert Caches wenn andere Benutzer Daten ändern
  useLiveUpdates();

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
        <Route path="employees" element={<Suspense fallback={<PageLoader />}><Employees /></Suspense>} />
        <Route path="employees/:id" element={<Suspense fallback={<PageLoader />}><EmployeeDetail /></Suspense>} />
        <Route path="absences" element={<Suspense fallback={<PageLoader />}><Absences /></Suspense>} />
        <Route path="evidence" element={<Suspense fallback={<PageLoader />}><Evidence /></Suspense>} />
        <Route path="tuning" element={<Suspense fallback={<PageLoader />}><Tuning /></Suspense>} />
        <Route path="robbery" element={<Suspense fallback={<PageLoader />}><Robbery /></Suspense>} />
        <Route path="hr" element={<Suspense fallback={<PageLoader />}><HumanResources /></Suspense>} />
        <Route path="detectives" element={<Suspense fallback={<PageLoader />}><Detectives /></Suspense>} />
        <Route path="academy" element={<Suspense fallback={<PageLoader />}><Academy /></Suspense>} />
        <Route path="internal-affairs" element={<Suspense fallback={<PageLoader />}><InternalAffairs /></Suspense>} />
        <Route path="quality-assurance" element={<Suspense fallback={<PageLoader />}><QualityAssurance /></Suspense>} />
        <Route path="teamleitung" element={<Suspense fallback={<PageLoader />}><Teamleitung /></Suspense>} />
        <Route path="management" element={<Suspense fallback={<PageLoader />}><Management /></Suspense>} />
        <Route path="calendar" element={<Suspense fallback={<PageLoader />}><Calendar /></Suspense>} />

        {/* Units */}
        <Route path="units" element={<Suspense fallback={<PageLoader />}><UnitsOverview /></Suspense>} />

        {/* Leadership */}
        <Route path="leadership" element={<Suspense fallback={<PageLoader />}><Leadership /></Suspense>} />

        {/* Admin */}
        <Route path="admin/users" element={<Suspense fallback={<PageLoader />}><Users /></Suspense>} />
        <Route path="admin/roles" element={<Suspense fallback={<PageLoader />}><Roles /></Suspense>} />
        <Route path="admin/audit-logs" element={<Suspense fallback={<PageLoader />}><AuditLogs /></Suspense>} />
        <Route path="admin/settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
        <Route path="admin/academy-modules" element={<Suspense fallback={<PageLoader />}><AcademyModules /></Suspense>} />
        <Route path="admin/academy-settings" element={<Suspense fallback={<PageLoader />}><AcademySettings /></Suspense>} />
        <Route path="admin/ia-settings" element={<Suspense fallback={<PageLoader />}><IASettings /></Suspense>} />
        <Route path="admin/qa-settings" element={<Suspense fallback={<PageLoader />}><QASettings /></Suspense>} />
        <Route path="admin/backups" element={<Suspense fallback={<PageLoader />}><Backups /></Suspense>} />
        <Route path="admin/bonus" element={<Suspense fallback={<PageLoader />}><BonusSettings /></Suspense>} />
        <Route path="admin/discord-announcements" element={<Suspense fallback={<PageLoader />}><DiscordAnnouncements /></Suspense>} />
        <Route path="admin/units" element={<Suspense fallback={<PageLoader />}><UnitsAdmin /></Suspense>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
