import { useQuery } from '@tanstack/react-query';
import { Clock, Calendar, Activity, TrendingUp, AlertCircle } from 'lucide-react';
import { dutyTimeApi } from '../services/api';

interface DutyTimeCardProps {
  employeeId?: string; // Wenn nicht angegeben, zeigt eigene Dienstzeiten
  compact?: boolean;
}

interface DutyTimeData {
  discordId: string;
  displayName: string;
  total: string;
  totalMinutes: number;
  week: string;
  weekMinutes: number;
  month: string;
  monthMinutes: number;
  lastSession: {
    start: string | null;
    end: string | null;
    active: boolean;
    duration: string | null;
  };
  requestedRange?: {
    start: string;
    end: string;
    duration: string;
    totalMinutes: number;
  };
}

interface DutyTimeResponse {
  found: boolean;
  message?: string;
  data: DutyTimeData | null;
}

export function DutyTimeCard({ employeeId, compact = false }: DutyTimeCardProps) {
  // Prüfe ob API konfiguriert ist
  const { data: statusData } = useQuery({
    queryKey: ['dutyTimeStatus'],
    queryFn: async () => {
      const res = await dutyTimeApi.getStatus();
      return res.data as { configured: boolean };
    },
    staleTime: 5 * 60 * 1000, // 5 Minuten
  });

  // Hole Dienstzeiten
  const { data, isLoading, error } = useQuery({
    queryKey: ['dutyTime', employeeId || 'me'],
    queryFn: async () => {
      const res = employeeId
        ? await dutyTimeApi.getEmployeeDutyTime(employeeId)
        : await dutyTimeApi.getMyDutyTime();
      return res.data as DutyTimeResponse;
    },
    enabled: statusData?.configured === true,
    staleTime: 2 * 60 * 1000, // 2 Minuten
    refetchInterval: 5 * 60 * 1000, // Alle 5 Minuten aktualisieren
  });

  // API nicht konfiguriert
  if (statusData?.configured === false) {
    return null;
  }

  // Loading
  if (isLoading) {
    return (
      <div className={`bg-slate-800 rounded-lg border border-slate-700 ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="w-4 h-4 animate-pulse" />
          <span className="text-sm">Lade Dienstzeiten...</span>
        </div>
      </div>
    );
  }

  // Fehler
  if (error) {
    return (
      <div className={`bg-slate-800 rounded-lg border border-red-500/30 ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Fehler beim Laden der Dienstzeiten</span>
        </div>
      </div>
    );
  }

  // Keine Daten gefunden
  if (!data?.found || !data.data) {
    return (
      <div className={`bg-slate-800 rounded-lg border border-slate-700 ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex items-center gap-2 text-slate-500">
          <Clock className="w-4 h-4" />
          <span className="text-sm">Keine Dienstzeiten verfügbar</span>
        </div>
      </div>
    );
  }

  const dutyTime = data.data;

  // Kompakte Ansicht
  if (compact) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-white">Dienstzeit</span>
          </div>
          {dutyTime.lastSession.active && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <Activity className="w-3 h-3 animate-pulse" />
              Im Dienst
            </span>
          )}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-slate-500">Woche</div>
            <div className="text-sm font-semibold text-white">{dutyTime.week}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Monat</div>
            <div className="text-sm font-semibold text-white">{dutyTime.month}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Gesamt</div>
            <div className="text-sm font-semibold text-white">{dutyTime.total}</div>
          </div>
        </div>
      </div>
    );
  }

  // Vollständige Ansicht
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
          <Clock className="w-5 h-5 text-blue-400" />
          Dienstzeiten (Leitstelle)
        </h3>
        {dutyTime.lastSession.active && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
            <Activity className="w-4 h-4 animate-pulse" />
            Im Dienst
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-400 mb-1">Diese Woche</div>
          <div className="text-xl font-bold text-white">{dutyTime.week}</div>
          <div className="text-xs text-slate-500">{dutyTime.weekMinutes} Min.</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-400 mb-1">Dieser Monat</div>
          <div className="text-xl font-bold text-white">{dutyTime.month}</div>
          <div className="text-xs text-slate-500">{dutyTime.monthMinutes} Min.</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-400 mb-1">Gesamt</div>
          <div className="text-xl font-bold text-blue-400">{dutyTime.total}</div>
          <div className="text-xs text-slate-500">{dutyTime.totalMinutes} Min.</div>
        </div>
      </div>

      {/* Letzte Sitzung */}
      {dutyTime.lastSession.start && (
        <div className="border-t border-slate-700 pt-3 mt-3">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <Calendar className="w-4 h-4" />
            <span>Letzte Sitzung</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-300">
              {new Date(dutyTime.lastSession.start).toLocaleString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {dutyTime.lastSession.end && !dutyTime.lastSession.active && (
                <span className="text-slate-500">
                  {' - '}
                  {new Date(dutyTime.lastSession.end).toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
            {dutyTime.lastSession.duration && !dutyTime.lastSession.active && (
              <div className="flex items-center gap-1 text-slate-400">
                <TrendingUp className="w-3 h-3" />
                {dutyTime.lastSession.duration}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DutyTimeCard;
