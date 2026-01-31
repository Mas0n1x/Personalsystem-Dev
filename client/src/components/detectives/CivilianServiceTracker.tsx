import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { civilianServiceApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Clock, Play, Square, Trash2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '../ui/ConfirmDialog';
import CivilianServiceOverview from './CivilianServiceOverview';

interface CivilianServiceSession {
  id: string;
  employeeId: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  notes: string | null;
  createdAt: string;
  employee: {
    id: string;
    rank: string;
    user: {
      displayName: string | null;
      username: string;
    };
  };
}

interface CivilianServiceStats {
  totalMinutes: number;
  totalHours: number;
  totalSessions: number;
  averageMinutes: number;
  averageHours: number;
  isActive: boolean;
  currentSessionStart: string | null;
}

export default function CivilianServiceTracker({ employeeId }: { employeeId: string }) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const canManage = hasPermission('detectives.manage');

  // Current session query
  const { data: currentSession, isLoading: loadingCurrent } = useQuery<CivilianServiceSession | null>({
    queryKey: ['civilian-service-current', employeeId],
    queryFn: async () => {
      const response = await civilianServiceApi.getCurrent(employeeId);
      return response.data;
    },
  });

  // Sessions query
  const { data: sessions = [], isLoading: loadingSessions, refetch: refetchSessions } = useQuery<CivilianServiceSession[]>({
    queryKey: ['civilian-service-sessions', employeeId],
    queryFn: async () => {
      const response = await civilianServiceApi.getSessions(employeeId);
      return response.data;
    },
  });

  // Stats query
  const { data: stats, isLoading: loadingStats } = useQuery<CivilianServiceStats>({
    queryKey: ['civilian-service-stats', employeeId],
    queryFn: async () => {
      const response = await civilianServiceApi.getStats(employeeId);
      return response.data;
    },
  });

  // Clock in mutation
  const clockInMutation = useMutation({
    mutationFn: () => civilianServiceApi.clockIn(employeeId, notes || undefined),
    onSuccess: () => {
      toast.success('Erfolgreich eingestempelt');
      queryClient.invalidateQueries({ queryKey: ['civilian-service-current', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['civilian-service-sessions', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['civilian-service-stats', employeeId] });
      setNotes('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Fehler beim Einstempeln');
    },
  });

  // Clock out mutation
  const clockOutMutation = useMutation({
    mutationFn: () => civilianServiceApi.clockOut(employeeId),
    onSuccess: () => {
      toast.success('Erfolgreich ausgestempelt');
      queryClient.invalidateQueries({ queryKey: ['civilian-service-current', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['civilian-service-sessions', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['civilian-service-stats', employeeId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Fehler beim Ausstempeln');
    },
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) => civilianServiceApi.deleteSession(sessionId),
    onSuccess: () => {
      toast.success('Session gelöscht');
      queryClient.invalidateQueries({ queryKey: ['civilian-service-sessions', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['civilian-service-stats', employeeId] });
      setSessionToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Fehler beim Löschen');
    },
  });

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getCurrentSessionDuration = () => {
    if (!currentSession) return 0;
    const start = new Date(currentSession.startTime);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / 1000 / 60);
  };

  const isLoading = loadingCurrent || loadingSessions || loadingStats;

  return (
    <div className="space-y-6">
      {/* Ein-/Ausstempeln */}
      {canManage && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Zivildienst-Tracking</h3>

          {currentSession ? (
            <div className="space-y-4">
              <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-4">
                <p className="text-sm text-slate-400 mb-2">Eingestempelt seit</p>
                <p className="text-lg font-semibold text-white">{formatDateTime(currentSession.startTime)}</p>
                <p className="text-sm text-green-500 mt-2">
                  Laufzeit: {formatDuration(getCurrentSessionDuration())}
                </p>
                {currentSession.notes && (
                  <div className="mt-3 pt-3 border-t border-green-700/30">
                    <p className="text-xs text-slate-400 mb-1">Notiz:</p>
                    <p className="text-sm text-white">{currentSession.notes}</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => clockOutMutation.mutate()}
                disabled={clockOutMutation.isPending}
                className="btn-danger w-full flex items-center justify-center gap-2"
              >
                <Square className="h-4 w-4" />
                Ausstempeln
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Notiz (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional: Notiz zur Session..."
                  rows={2}
                  className="input w-full"
                />
              </div>

              <button
                onClick={() => clockInMutation.mutate()}
                disabled={clockInMutation.isPending}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Play className="h-4 w-4" />
                Einstempeln
              </button>
            </div>
          )}
        </div>
      )}

      {/* Übersichts-Statistiken aller Detectives */}
      <CivilianServiceOverview />

      {/* Persönliche Statistiken */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Meine Statistiken</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-blue-400" />
            <p className="text-sm text-slate-400">Gesamt</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {stats ? `${stats.totalHours}h` : '-'}
          </p>
          <p className="text-xs text-slate-500 mt-1">{stats?.totalMinutes || 0} Minuten</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="h-5 w-5 text-green-400" />
            <p className="text-sm text-slate-400">Sessions</p>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.totalSessions || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Abgeschlossen</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-purple-400" />
            <p className="text-sm text-slate-400">Durchschnitt</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {stats ? formatDuration(stats.averageMinutes) : '-'}
          </p>
          <p className="text-xs text-slate-500 mt-1">Pro Session</p>
        </div>

        <div className={`bg-slate-800 rounded-lg p-4 border ${stats?.isActive ? 'border-green-500' : 'border-slate-700'}`}>
          <div className="flex items-center gap-2 mb-2">
            {stats?.isActive ? (
              <Play className="h-5 w-5 text-green-400 animate-pulse" />
            ) : (
              <Square className="h-5 w-5 text-slate-400" />
            )}
            <p className="text-sm text-slate-400">Status</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {stats?.isActive ? 'Aktiv' : 'Inaktiv'}
          </p>
          {stats?.isActive && currentSession && (
            <p className="text-xs text-green-500 mt-1">
              {formatDuration(getCurrentSessionDuration())} laufend
            </p>
          )}
        </div>
      </div>
      </div>

      {/* Session-Historie */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Session-Historie</h3>
          <button
            onClick={() => refetchSessions()}
            className="btn-ghost text-sm px-3 py-1"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">Lädt...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">Noch keine Sessions vorhanden</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-slate-700/30 rounded-lg p-4 border border-slate-600"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-blue-400" />
                        <span className="text-slate-300">Start:</span>
                        <span className="text-white">{formatDateTime(session.startTime)}</span>
                      </div>

                      {session.endTime && (
                        <>
                          <div className="flex items-center gap-2 text-sm">
                            <Square className="h-4 w-4 text-red-400" />
                            <span className="text-slate-300">Ende:</span>
                            <span className="text-white">{formatDateTime(session.endTime)}</span>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-green-400" />
                            <span className="text-slate-300">Dauer:</span>
                            <span className="text-white font-semibold">
                              {formatDuration(session.duration)}
                            </span>
                          </div>
                        </>
                      )}

                      {session.notes && (
                        <div className="mt-2 pt-2 border-t border-slate-600">
                          <p className="text-xs text-slate-400 mb-1">Notiz:</p>
                          <p className="text-sm text-white">{session.notes}</p>
                        </div>
                      )}
                    </div>

                    {canManage && session.endTime && (
                      <button
                        onClick={() => setSessionToDelete(session.id)}
                        className="text-red-400 hover:text-red-300 transition-colors p-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {sessionToDelete && (
        <ConfirmDialog
          title="Session löschen"
          message="Möchtest du diese Session wirklich löschen?"
          confirmText="Löschen"
          onConfirm={() => deleteSessionMutation.mutate(sessionToDelete)}
          onCancel={() => setSessionToDelete(null)}
        />
      )}
    </div>
  );
}
