import { useQuery } from '@tanstack/react-query';
import { dashboardApi, absencesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  Users,
  UserCheck,
  UserMinus,
  CalendarOff,
} from 'lucide-react';

interface ActiveAbsence {
  id: string;
  type: 'ABSENCE' | 'DAY_OFF';
  reason: string | null;
  startDate: string;
  endDate: string;
  employee: {
    id: string;
    badgeNumber: string | null;
    rank: string;
    user: {
      displayName: string | null;
      username: string;
      avatar: string | null;
    };
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();

  const { data: statsData, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats(),
    refetchInterval: 30000, // Alle 30 Sekunden aktualisieren
  });

  const { data: activeAbsencesData } = useQuery({
    queryKey: ['active-absences'],
    queryFn: () => absencesApi.getActive(),
    refetchInterval: 60000, // Jede Minute aktualisieren
  });

  const stats = statsData?.data?.stats;
  const activeAbsences = activeAbsencesData?.data as ActiveAbsence[] | undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Begrüßung */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Willkommen, {user?.displayName || user?.username}!
        </h1>
        <p className="text-slate-400 mt-1">
          Hier ist die Übersicht über das LSPD Personalsystem.
        </p>
      </div>

      {/* Statistik-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Mitarbeiter Gesamt */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Mitarbeiter Gesamt</p>
              <p className="stat-value">{stats?.totalEmployees || 0}</p>
            </div>
            <div className="p-3 bg-primary-900/50 rounded-xl">
              <Users className="h-6 w-6 text-primary-400" />
            </div>
          </div>
        </div>

        {/* Aktive Mitarbeiter */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Aktive Mitarbeiter</p>
              <p className="stat-value">{stats?.activeEmployees || 0}</p>
            </div>
            <div className="p-3 bg-green-900/50 rounded-xl">
              <UserCheck className="h-6 w-6 text-green-400" />
            </div>
          </div>
        </div>

        {/* Abwesend */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Abwesend</p>
              <p className="stat-value">{stats?.onLeaveEmployees || 0}</p>
            </div>
            <div className="p-3 bg-yellow-900/50 rounded-xl">
              <UserMinus className="h-6 w-6 text-yellow-400" />
            </div>
          </div>
        </div>

      </div>

      {/* Online Benutzer & Aktive Abmeldungen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Online Benutzer */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Online Benutzer</h2>
            <span className="badge-success">{onlineUsers.length} Online</span>
          </div>
          <div className="card-body">
            {onlineUsers.length === 0 ? (
              <p className="text-slate-400 text-center py-4">Keine Benutzer online</p>
            ) : (
              <div className="space-y-3">
                {onlineUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={
                          u.avatar ||
                          `https://ui-avatars.com/api/?name=${u.username}&background=random`
                        }
                        alt={u.username}
                        className="h-10 w-10 rounded-full"
                      />
                      <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-slate-800"></span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {u.displayName || u.username}
                      </p>
                      <p className="text-xs text-slate-400">@{u.username}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Aktive Abmeldungen & Dienstfrei */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5 text-orange-400" />
              <h2 className="text-lg font-semibold text-white">Abmeldungen & Dienstfrei</h2>
            </div>
            <span className="badge-warning">{activeAbsences?.length || 0} Aktiv</span>
          </div>
          <div className="card-body">
            {!activeAbsences?.length ? (
              <p className="text-slate-400 text-center py-4">Keine aktiven Abmeldungen</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {activeAbsences.map((absence) => (
                  <div key={absence.id} className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
                    <img
                      src={
                        absence.employee.user.avatar ||
                        `https://ui-avatars.com/api/?name=${absence.employee.user.username}&background=random`
                      }
                      alt={absence.employee.user.username}
                      className="h-10 w-10 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {absence.employee.user.displayName || absence.employee.user.username}
                      </p>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            absence.type === 'DAY_OFF'
                              ? 'bg-blue-600/20 text-blue-400'
                              : 'bg-orange-600/20 text-orange-400'
                          }`}
                        >
                          {absence.type === 'DAY_OFF' ? 'Dienstfrei' : 'Abmeldung'}
                        </span>
                        {absence.reason && (
                          <span className="text-xs text-slate-400 truncate">{absence.reason}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
