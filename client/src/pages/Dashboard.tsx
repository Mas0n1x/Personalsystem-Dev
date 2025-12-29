import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  Users,
  UserCheck,
  UserMinus,
  FileText,
  GraduationCap,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Megaphone,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Announcement } from '../types';

export default function Dashboard() {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();

  const { data: statsData, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats(),
    refetchInterval: 30000, // Alle 30 Sekunden aktualisieren
  });

  const stats = statsData?.data?.stats;
  const announcements = statsData?.data?.recentAnnouncements as Announcement[] | undefined;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

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

        {/* Offene Bewerbungen */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Offene Bewerbungen</p>
              <p className="stat-value">{stats?.pendingApplications || 0}</p>
            </div>
            <div className="p-3 bg-purple-900/50 rounded-xl">
              <FileText className="h-6 w-6 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Zweite Reihe */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Anstehende Trainings */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Anstehende Trainings</p>
              <p className="stat-value">{stats?.upcomingTrainings || 0}</p>
            </div>
            <div className="p-3 bg-blue-900/50 rounded-xl">
              <GraduationCap className="h-6 w-6 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Monatliche Einnahmen */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Monatliche Einnahmen</p>
              <p className="stat-value text-green-400">
                {formatCurrency(stats?.monthlyIncome || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-900/50 rounded-xl">
              <TrendingUp className="h-6 w-6 text-green-400" />
            </div>
          </div>
        </div>

        {/* Monatliche Ausgaben */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Monatliche Ausgaben</p>
              <p className="stat-value text-red-400">
                {formatCurrency(stats?.monthlyExpenses || 0)}
              </p>
            </div>
            <div className="p-3 bg-red-900/50 rounded-xl">
              <TrendingDown className="h-6 w-6 text-red-400" />
            </div>
          </div>
        </div>

        {/* Bilanz */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Bilanz</p>
              <p
                className={`stat-value ${
                  (stats?.balance || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {formatCurrency(stats?.balance || 0)}
              </p>
            </div>
            <div className="p-3 bg-slate-700 rounded-xl">
              <DollarSign className="h-6 w-6 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Unterer Bereich */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ankündigungen */}
        <div className="lg:col-span-2 card">
          <div className="card-header flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-white">Neueste Ankündigungen</h2>
          </div>
          <div className="card-body">
            {!announcements || announcements.length === 0 ? (
              <p className="text-slate-400 text-center py-4">Keine Ankündigungen vorhanden</p>
            ) : (
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="p-4 bg-slate-700/50 rounded-lg border border-slate-600"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-white">{announcement.title}</h3>
                      <span className="text-xs text-slate-400">
                        {formatDistanceToNow(new Date(announcement.createdAt), {
                          addSuffix: true,
                          locale: de,
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 line-clamp-2">
                      {announcement.content}
                    </p>
                    <div className="mt-2 text-xs text-slate-400">
                      von {announcement.author?.displayName || announcement.author?.username}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

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
      </div>
    </div>
  );
}
