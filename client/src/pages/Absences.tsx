import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { absencesApi } from '../services/api';
import { Calendar, Clock, Trash2, Plus, Coffee, CalendarOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface Absence {
  id: string;
  type: 'ABSENCE' | 'DAY_OFF';
  reason: string | null;
  startDate: string;
  endDate: string;
  createdAt: string;
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

interface AbsencesResponse {
  data: Absence[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function Absences() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [absenceType, setAbsenceType] = useState<'ABSENCE' | 'DAY_OFF'>('ABSENCE');
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['absences', page, filterType],
    queryFn: () =>
      absencesApi.getAll({
        page: String(page),
        limit: '20',
        ...(filterType && { type: filterType }),
      }),
  });

  const response = data?.data as AbsencesResponse | undefined;

  const createMutation = useMutation({
    mutationFn: absencesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absences'] });
      setShowCreateModal(false);
      resetForm();
      toast.success(absenceType === 'DAY_OFF' ? 'Dienstfrei eingetragen' : 'Abmeldung eingetragen');
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Fehler beim Erstellen');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: absencesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absences'] });
      toast.success('Abmeldung gelöscht');
    },
  });

  const resetForm = () => {
    setAbsenceType('ABSENCE');
    setReason('');
    setStartDate('');
    setEndDate('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate || !endDate) {
      toast.error('Bitte Start- und Enddatum angeben');
      return;
    }

    createMutation.mutate({
      type: absenceType,
      reason: reason || undefined,
      startDate,
      endDate,
    });
  };

  const handleDayOff = () => {
    // Dienstfrei = heute ganztägig
    const today = new Date().toISOString().split('T')[0];
    createMutation.mutate({
      type: 'DAY_OFF',
      reason: 'Dienstfrei',
      startDate: today,
      endDate: today,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const isActive = (absence: Absence) => {
    const now = new Date();
    const start = new Date(absence.startDate);
    const end = new Date(absence.endDate);
    return now >= start && now <= end;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Abmeldungen</h1>
          <p className="text-slate-400 mt-1">Abmeldungen und Dienstfrei verwalten</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDayOff}
            className="btn-secondary flex items-center gap-2"
          >
            <Coffee className="h-4 w-4" />
            Dienstfrei (heute)
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Abmeldung eintragen
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="card p-4">
        <div className="flex gap-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input w-auto"
          >
            <option value="">Alle Typen</option>
            <option value="ABSENCE">Abmeldungen</option>
            <option value="DAY_OFF">Dienstfrei</option>
          </select>
        </div>
      </div>

      {/* Abmeldungen Liste */}
      <div className="space-y-4">
        {response?.data.length === 0 ? (
          <div className="card p-8 text-center">
            <CalendarOff className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400">Keine Abmeldungen gefunden</p>
          </div>
        ) : (
          response?.data.map((absence) => (
            <div
              key={absence.id}
              className={`card p-4 ${isActive(absence) ? 'border-l-4 border-l-green-500' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <img
                    src={
                      absence.employee.user.avatar ||
                      `https://ui-avatars.com/api/?name=${absence.employee.user.displayName || absence.employee.user.username}&background=random`
                    }
                    alt={absence.employee.user.displayName || absence.employee.user.username}
                    className="h-12 w-12 rounded-full"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">
                        {absence.employee.user.displayName || absence.employee.user.username}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          absence.type === 'DAY_OFF'
                            ? 'bg-blue-600/20 text-blue-400'
                            : 'bg-orange-600/20 text-orange-400'
                        }`}
                      >
                        {absence.type === 'DAY_OFF' ? 'Dienstfrei' : 'Abmeldung'}
                      </span>
                      {isActive(absence) && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-600/20 text-green-400">
                          Aktiv
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400">
                      {absence.employee.rank} {absence.employee.badgeNumber && `- ${absence.employee.badgeNumber}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {formatDate(absence.startDate)}
                        {absence.startDate !== absence.endDate && ` - ${formatDate(absence.endDate)}`}
                      </span>
                    </div>
                    {absence.reason && (
                      <p className="text-sm text-slate-400 mt-1">{absence.reason}</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Abmeldung wirklich löschen?')) {
                        deleteMutation.mutate(absence.id);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {response && response.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="btn-secondary disabled:opacity-50"
          >
            Zurück
          </button>
          <span className="px-4 py-2 text-slate-400">
            Seite {page} von {response.totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === response.totalPages}
            className="btn-secondary disabled:opacity-50"
          >
            Weiter
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md mx-4 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-6">Abmeldung eintragen</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Typ</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAbsenceType('ABSENCE')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                      absenceType === 'ABSENCE'
                        ? 'bg-orange-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Abmeldung
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbsenceType('DAY_OFF')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                      absenceType === 'DAY_OFF'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Dienstfrei
                  </button>
                </div>
                {absenceType === 'DAY_OFF' && (
                  <p className="text-xs text-slate-400 mt-2">
                    <Clock className="h-3 w-3 inline mr-1" />
                    Dienstfrei kann nur 1x pro Woche genutzt werden (Reset: Sonntag 23:59)
                  </p>
                )}
              </div>

              <div>
                <label className="label">Grund (optional)</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input"
                  placeholder="z.B. Urlaub, Krankheit..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Von *</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Bis *</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="btn-ghost"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary"
                >
                  {createMutation.isPending ? 'Speichert...' : 'Eintragen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
