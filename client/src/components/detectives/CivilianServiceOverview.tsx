import { useQuery } from '@tanstack/react-query';
import { civilianServiceApi } from '../../services/api';
import { Clock, TrendingUp, Users, Activity, User } from 'lucide-react';
import { useState } from 'react';

interface DetectiveStats {
  employee: {
    id: string;
    rank: string;
    badgeNumber: string;
    user: {
      displayName: string | null;
      username: string;
      avatar: string | null;
    };
  };
  stats: {
    today: {
      totalMinutes: number;
      totalHours: number;
      sessions: number;
    };
    week: {
      totalMinutes: number;
      totalHours: number;
      sessions: number;
    };
    month: {
      totalMinutes: number;
      totalHours: number;
      sessions: number;
    };
    total: {
      totalMinutes: number;
      totalHours: number;
      sessions: number;
    };
    isActive: boolean;
    currentSessionStart: string | null;
  };
}

interface OverviewStats {
  today: {
    totalMinutes: number;
    totalHours: number;
    sessions: number;
  };
  week: {
    totalMinutes: number;
    totalHours: number;
    sessions: number;
  };
  month: {
    totalMinutes: number;
    totalHours: number;
    sessions: number;
  };
  activeSessions: number;
  totalDetectives: number;
  detectives: DetectiveStats[];
}

export default function CivilianServiceOverview() {
  const [sortBy, setSortBy] = useState<'rank' | 'today' | 'week' | 'month' | 'total'>('rank');

  const { data: stats, isLoading } = useQuery<OverviewStats>({
    queryKey: ['civilian-service-overview-stats'],
    queryFn: async () => {
      const response = await civilianServiceApi.getOverviewStats();
      return response.data;
    },
    refetchInterval: 60000, // Alle 60 Sekunden aktualisieren
  });

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="text-center text-slate-500">Lädt Statistiken...</div>
      </div>
    );
  }

  if (!stats) return null;

  // Sortierte Detective-Liste
  const sortedDetectives = [...(stats.detectives || [])].sort((a, b) => {
    switch (sortBy) {
      case 'today':
        return b.stats.today.totalMinutes - a.stats.today.totalMinutes;
      case 'week':
        return b.stats.week.totalMinutes - a.stats.week.totalMinutes;
      case 'month':
        return b.stats.month.totalMinutes - a.stats.month.totalMinutes;
      case 'total':
        return b.stats.total.totalMinutes - a.stats.total.totalMinutes;
      case 'rank':
      default:
        return 0; // Bereits nach Rang sortiert vom Backend
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="h-6 w-6 text-blue-400" />
          <h2 className="text-xl font-bold text-white">Zivildienst-Übersicht</h2>
        </div>
        <p className="text-sm text-slate-400">
          Statistiken aller aktiven Detectives ({stats.totalDetectives} Detectives)
        </p>
      </div>

      {/* Aktive Sessions */}
      <div className="bg-gradient-to-br from-green-900/20 to-slate-800 rounded-lg p-6 border border-green-700/30">
        <div className="flex items-center gap-3 mb-3">
          <Activity className="h-6 w-6 text-green-400 animate-pulse" />
          <h3 className="text-lg font-semibold text-white">Aktuell Aktiv</h3>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-4xl font-bold text-green-400">{stats.activeSessions}</p>
          <p className="text-slate-400">
            {stats.activeSessions === 1 ? 'Detective im Zivildienst' : 'Detectives im Zivildienst'}
          </p>
        </div>
      </div>

      {/* Zeitraum-Statistiken */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Heute */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-blue-400" />
            <h3 className="font-semibold text-white">Heute</h3>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400 mb-1">Gesamtzeit</p>
              <p className="text-2xl font-bold text-white">
                {stats.today.totalHours}
                <span className="text-lg text-slate-400">h</span>
              </p>
              <p className="text-xs text-slate-500">{formatDuration(stats.today.totalMinutes)}</p>
            </div>

            <div className="pt-3 border-t border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Sessions</p>
              <p className="text-xl font-semibold text-blue-400">{stats.today.sessions}</p>
            </div>
          </div>
        </div>

        {/* Diese Woche */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-purple-400" />
            <h3 className="font-semibold text-white">Diese Woche</h3>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400 mb-1">Gesamtzeit</p>
              <p className="text-2xl font-bold text-white">
                {stats.week.totalHours}
                <span className="text-lg text-slate-400">h</span>
              </p>
              <p className="text-xs text-slate-500">{formatDuration(stats.week.totalMinutes)}</p>
            </div>

            <div className="pt-3 border-t border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Sessions</p>
              <p className="text-xl font-semibold text-purple-400">{stats.week.sessions}</p>
            </div>
          </div>
        </div>

        {/* Dieser Monat */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-amber-400" />
            <h3 className="font-semibold text-white">Dieser Monat</h3>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400 mb-1">Gesamtzeit</p>
              <p className="text-2xl font-bold text-white">
                {stats.month.totalHours}
                <span className="text-lg text-slate-400">h</span>
              </p>
              <p className="text-xs text-slate-500">{formatDuration(stats.month.totalMinutes)}</p>
            </div>

            <div className="pt-3 border-t border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Sessions</p>
              <p className="text-xl font-semibold text-amber-400">{stats.month.sessions}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Durchschnitte */}
      {stats.totalDetectives > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-indigo-400" />
            <h3 className="font-semibold text-white">Durchschnitt pro Detective</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-400 mb-1">Heute</p>
              <p className="text-lg font-semibold text-white">
                {formatDuration(Math.floor(stats.today.totalMinutes / stats.totalDetectives))}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-1">Diese Woche</p>
              <p className="text-lg font-semibold text-white">
                {formatDuration(Math.floor(stats.week.totalMinutes / stats.totalDetectives))}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-1">Dieser Monat</p>
              <p className="text-lg font-semibold text-white">
                {formatDuration(Math.floor(stats.month.totalMinutes / stats.totalDetectives))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Detective-Liste */}
      {sortedDetectives.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-400" />
                <h3 className="font-semibold text-white">Alle Detectives</h3>
              </div>
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="input text-sm px-3 py-1"
                >
                  <option value="rank">Nach Rang</option>
                  <option value="today">Nach Heute</option>
                  <option value="week">Nach Woche</option>
                  <option value="month">Nach Monat</option>
                  <option value="total">Nach Gesamt</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-3">
              {sortedDetectives.map((detective) => (
                <div
                  key={detective.employee.id}
                  className={`bg-slate-700/30 rounded-lg p-4 border ${
                    detective.stats.isActive ? 'border-green-500/30' : 'border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      {detective.employee.user.avatar ? (
                        <img
                          src={detective.employee.user.avatar}
                          alt={detective.employee.user.displayName || detective.employee.user.username}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
                          <User className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-white">
                          {detective.employee.user.displayName || detective.employee.user.username}
                        </p>
                        <p className="text-xs text-slate-400">
                          {detective.employee.rank} • Badge #{detective.employee.badgeNumber}
                        </p>
                      </div>
                    </div>
                    {detective.stats.isActive && (
                      <div className="flex items-center gap-2 bg-green-900/20 px-3 py-1 rounded-full border border-green-700/30">
                        <Activity className="h-4 w-4 text-green-400 animate-pulse" />
                        <span className="text-xs text-green-400 font-medium">Aktiv</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Heute</p>
                      <p className="text-sm font-semibold text-white">
                        {detective.stats.today.totalHours}h {detective.stats.today.totalMinutes % 60}m
                      </p>
                      <p className="text-xs text-slate-500">{detective.stats.today.sessions} Sessions</p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 mb-1">Woche</p>
                      <p className="text-sm font-semibold text-white">
                        {detective.stats.week.totalHours}h {detective.stats.week.totalMinutes % 60}m
                      </p>
                      <p className="text-xs text-slate-500">{detective.stats.week.sessions} Sessions</p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 mb-1">Monat</p>
                      <p className="text-sm font-semibold text-white">
                        {detective.stats.month.totalHours}h {detective.stats.month.totalMinutes % 60}m
                      </p>
                      <p className="text-xs text-slate-500">{detective.stats.month.sessions} Sessions</p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 mb-1">Gesamt</p>
                      <p className="text-sm font-semibold text-blue-400">
                        {detective.stats.total.totalHours}h {detective.stats.total.totalMinutes % 60}m
                      </p>
                      <p className="text-xs text-slate-500">{detective.stats.total.sessions} Sessions</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
