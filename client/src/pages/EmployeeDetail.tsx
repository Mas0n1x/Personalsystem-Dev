import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '../services/api';
import { StatusBadge } from '../components/ui/Badge';
import { ArrowLeft, Edit, Calendar, Clock, X, Save, CalendarOff } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface AbsenceData {
  id: string;
  type: 'ABSENCE' | 'DAY_OFF';
  reason: string | null;
  startDate: string;
  endDate: string;
  createdAt: string;
}

interface EmployeeDetailData {
  id: string;
  userId: string;
  badgeNumber: string | null;
  rank: string;
  rankLevel: number;
  department: string;
  status: string;
  hireDate: string;
  notes: string | null;
  absences: AbsenceData[];
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    role: { id: string; name: string; displayName: string; color: string } | null;
  };
}

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    badgeNumber: '',
    displayName: '',
    status: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesApi.getById(id!),
    enabled: !!id,
  });

  const employee = data?.data as EmployeeDetailData | undefined;

  const updateMutation = useMutation({
    mutationFn: (data: typeof editForm) => employeesApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsEditModalOpen(false);
    },
  });

  // Namen ohne Badge-Prefix extrahieren
  const cleanDisplayName = (name: string | null | undefined) => {
    if (!name) return '';
    return name.replace(/^\[[A-Z]+-\d+\]\s*/, '').trim();
  };

  const openEditModal = () => {
    if (employee) {
      setEditForm({
        badgeNumber: employee.badgeNumber || '',
        displayName: cleanDisplayName(employee.user?.displayName),
        status: employee.status || 'ACTIVE',
      });
      setIsEditModalOpen(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate(editForm);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Mitarbeiter nicht gefunden</p>
        <button onClick={() => navigate('/employees')} className="btn-primary mt-4">
          Zurück zur Übersicht
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/employees')}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Mitarbeiter Details</h1>
        </div>
        <button onClick={openEditModal} className="btn-secondary">
          <Edit className="h-4 w-4" />
          Bearbeiten
        </button>
      </div>

      {/* Profil-Karte */}
      <div className="card p-6">
        <div className="flex items-start gap-6">
          <img
            src={
              employee.user?.avatar ||
              `https://ui-avatars.com/api/?name=${employee.user?.username}&background=random&size=128`
            }
            alt={employee.user?.username}
            className="h-32 w-32 rounded-xl"
          />
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2">
              <h2 className="text-2xl font-bold text-white">
                {employee.user?.displayName || employee.user?.username}
              </h2>
              <StatusBadge status={employee.status} />
            </div>
            <p className="text-slate-400 mb-4">@{employee.user?.username}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-slate-400">Badge</p>
                <p className="text-white font-medium">{employee.badgeNumber || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Rang</p>
                <p className="text-white font-medium">{employee.rank}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Abteilung</p>
                <p className="text-white font-medium">{employee.department}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Eingestellt am</p>
                <p className="text-white font-medium">
                  {format(new Date(employee.hireDate), 'dd.MM.yyyy', { locale: de })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {employee.notes && (
          <div className="mt-6 pt-6 border-t border-slate-700">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Notizen</h3>
            <p className="text-slate-300">{employee.notes}</p>
          </div>
        )}
      </div>

      {/* Abmeldungen */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <CalendarOff className="h-5 w-5 text-blue-400" />
          <h3 className="font-semibold text-white">Letzte Abmeldungen</h3>
        </div>
        <div className="card-body">
          {!employee.absences?.length ? (
            <p className="text-slate-400 text-center py-4">Keine Abmeldungen vorhanden</p>
          ) : (
            <div className="space-y-4">
              {employee.absences.map((absence) => {
                const isActive = () => {
                  const now = new Date();
                  const start = new Date(absence.startDate);
                  const end = new Date(absence.endDate);
                  return now >= start && now <= end;
                };

                return (
                  <div
                    key={absence.id}
                    className={`p-4 bg-slate-700/50 rounded-lg border border-slate-600 ${
                      isActive() ? 'border-l-4 border-l-green-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            absence.type === 'DAY_OFF'
                              ? 'bg-blue-600/20 text-blue-400'
                              : 'bg-orange-600/20 text-orange-400'
                          }`}
                        >
                          {absence.type === 'DAY_OFF' ? 'Dienstfrei' : 'Abmeldung'}
                        </span>
                        {isActive() && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-600/20 text-green-400">
                            Aktiv
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Clock className="h-4 w-4" />
                      {format(new Date(absence.startDate), 'dd.MM.yyyy', { locale: de })}
                      {absence.startDate !== absence.endDate && (
                        <> - {format(new Date(absence.endDate), 'dd.MM.yyyy', { locale: de })}</>
                      )}
                    </div>
                    {absence.reason && (
                      <p className="text-sm text-slate-400 mt-2">{absence.reason}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg mx-4 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Mitarbeiter bearbeiten</h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                  className="input w-full"
                  placeholder="z.B. Jack Ripper"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Badge-Nummer
                </label>
                <input
                  type="text"
                  value={editForm.badgeNumber}
                  onChange={(e) => setEditForm({ ...editForm, badgeNumber: e.target.value })}
                  className="input w-full"
                  placeholder="z.B. PD-104"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="input w-full"
                >
                  <option value="ACTIVE">Aktiv</option>
                  <option value="INACTIVE">Inaktiv</option>
                  <option value="ON_LEAVE">Abwesend</option>
                  <option value="SUSPENDED">Suspendiert</option>
                  <option value="TERMINATED">Entlassen</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="btn-ghost"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="btn-primary"
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
