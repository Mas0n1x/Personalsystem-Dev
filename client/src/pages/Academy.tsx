import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingsApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import {
  GraduationCap,
  Plus,
  Calendar,
  Clock,
  MapPin,
  Users,
  X,
  ChevronRight,
  BookOpen,
  CheckCircle,
  XCircle,
  AlertCircle,
  UserPlus,
  Trash2,
  Settings,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface TrainingType {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  isActive: boolean;
  _count?: { trainings: number };
}

interface Employee {
  id: string;
  rank: string;
  user: { id: string; displayName: string | null; username: string };
}

interface TrainingParticipant {
  id: string;
  status: string;
  grade: string | null;
  feedback: string | null;
  registeredAt: string;
  attendedAt: string | null;
  employee: Employee;
}

interface Training {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  location: string | null;
  maxParticipants: number | null;
  status: string;
  notes: string | null;
  type: TrainingType;
  instructor: { id: string; displayName: string | null; username: string };
  participants: TrainingParticipant[];
  _count?: { participants: number };
}

const statusLabels: Record<string, string> = {
  SCHEDULED: 'Geplant',
  IN_PROGRESS: 'Läuft',
  COMPLETED: 'Abgeschlossen',
  CANCELLED: 'Abgesagt',
};

const statusColors: Record<string, string> = {
  SCHEDULED: 'bg-blue-500/20 text-blue-400',
  IN_PROGRESS: 'bg-yellow-500/20 text-yellow-400',
  COMPLETED: 'bg-green-500/20 text-green-400',
  CANCELLED: 'bg-red-500/20 text-red-400',
};

const participantStatusLabels: Record<string, string> = {
  REGISTERED: 'Angemeldet',
  ATTENDED: 'Teilgenommen',
  NO_SHOW: 'Nicht erschienen',
  EXCUSED: 'Entschuldigt',
};

const gradeLabels: Record<string, string> = {
  EXCELLENT: 'Ausgezeichnet',
  GOOD: 'Gut',
  SATISFACTORY: 'Befriedigend',
  FAILED: 'Nicht bestanden',
};

export default function Academy() {
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const canManage = permissions.hasAnyPermission('academy.manage', 'admin.full');

  const [activeTab, setActiveTab] = useState<'upcoming' | 'all' | 'types'>('upcoming');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [showAddParticipant, setShowAddParticipant] = useState(false);

  // Queries
  const { data: stats } = useQuery({
    queryKey: ['trainings', 'stats'],
    queryFn: () => trainingsApi.getStats().then(res => res.data),
  });

  const { data: trainings = [], isLoading } = useQuery({
    queryKey: ['trainings', activeTab],
    queryFn: () => trainingsApi.getAll(activeTab === 'upcoming' ? { upcoming: 'true' } : {}).then(res => res.data),
  });

  const { data: types = [] } = useQuery({
    queryKey: ['training-types'],
    queryFn: () => trainingsApi.getTypes().then(res => res.data),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['training-employees'],
    queryFn: () => trainingsApi.getEmployees().then(res => res.data),
    enabled: showAddParticipant || showCreateModal,
  });

  // Mutations
  const createTraining = useMutation({
    mutationFn: trainingsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      setShowCreateModal(false);
      toast.success('Schulung erstellt');
    },
  });

  const updateTraining = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      trainingsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      toast.success('Schulung aktualisiert');
    },
  });

  const deleteTraining = useMutation({
    mutationFn: trainingsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      setSelectedTraining(null);
      toast.success('Schulung gelöscht');
    },
  });

  const createType = useMutation({
    mutationFn: trainingsApi.createType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-types'] });
      setShowTypeModal(false);
      toast.success('Schulungstyp erstellt');
    },
  });

  const deleteType = useMutation({
    mutationFn: trainingsApi.deleteType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-types'] });
      toast.success('Schulungstyp gelöscht');
    },
  });

  const addParticipant = useMutation({
    mutationFn: ({ trainingId, employeeId }: { trainingId: string; employeeId: string }) =>
      trainingsApi.addParticipant(trainingId, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      setShowAddParticipant(false);
      toast.success('Teilnehmer hinzugefügt');
    },
  });

  const updateParticipant = useMutation({
    mutationFn: ({ trainingId, participantId, data }: { trainingId: string; participantId: string; data: Record<string, string> }) =>
      trainingsApi.updateParticipant(trainingId, participantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      toast.success('Teilnehmer aktualisiert');
    },
  });

  const removeParticipant = useMutation({
    mutationFn: ({ trainingId, participantId }: { trainingId: string; participantId: string }) =>
      trainingsApi.removeParticipant(trainingId, participantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      toast.success('Teilnehmer entfernt');
    },
  });

  const handleCreateTraining = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createTraining.mutate({
      typeId: formData.get('typeId') as string,
      title: formData.get('title') as string,
      description: formData.get('description') as string || undefined,
      scheduledAt: formData.get('scheduledAt') as string,
      location: formData.get('location') as string || undefined,
      maxParticipants: formData.get('maxParticipants') ? parseInt(formData.get('maxParticipants') as string) : undefined,
      notes: formData.get('notes') as string || undefined,
    });
  };

  const handleCreateType = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createType.mutate({
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      duration: formData.get('duration') ? parseInt(formData.get('duration') as string) : undefined,
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-blue-400" />
            Police Academy
          </h1>
          <p className="text-slate-400 mt-1">Schulungen und Trainings verwalten</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowTypeModal(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Typen
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Neue Schulung
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <BookOpen className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-sm text-slate-400">Gesamt</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Calendar className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.scheduled}</p>
                <p className="text-sm text-slate-400">Geplant</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.completed}</p>
                <p className="text-sm text-slate-400">Abgeschlossen</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Clock className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.thisMonth}</p>
                <p className="text-sm text-slate-400">Diesen Monat</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={clsx(
            'px-4 py-2 rounded-lg transition-colors',
            activeTab === 'upcoming'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-slate-400 hover:text-white'
          )}
        >
          Kommende Schulungen
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={clsx(
            'px-4 py-2 rounded-lg transition-colors',
            activeTab === 'all'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-slate-400 hover:text-white'
          )}
        >
          Alle Schulungen
        </button>
        {canManage && (
          <button
            onClick={() => setActiveTab('types')}
            className={clsx(
              'px-4 py-2 rounded-lg transition-colors',
              activeTab === 'types'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Schulungstypen
          </button>
        )}
      </div>

      {/* Content */}
      {activeTab === 'types' ? (
        // Types List
        <div className="card">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Schulungstypen</h2>
          </div>
          <div className="divide-y divide-slate-700">
            {types.map((type: TrainingType) => (
              <div key={type.id} className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-white">{type.name}</h3>
                  {type.description && (
                    <p className="text-sm text-slate-400 mt-1">{type.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {type.duration} Min.
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      {type._count?.trainings || 0} Schulungen
                    </span>
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={() => {
                      if (confirm('Schulungstyp wirklich löschen?')) {
                        deleteType.mutate(type.id);
                      }
                    }}
                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {types.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                Keine Schulungstypen vorhanden
              </div>
            )}
          </div>
        </div>
      ) : (
        // Trainings List
        <div className="card">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : trainings.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              {activeTab === 'upcoming' ? 'Keine kommenden Schulungen' : 'Keine Schulungen vorhanden'}
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {trainings.map((training: Training) => (
                <div
                  key={training.id}
                  onClick={() => setSelectedTraining(training)}
                  className="p-4 hover:bg-slate-700/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-white">{training.title}</h3>
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs', statusColors[training.status])}>
                          {statusLabels[training.status]}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">{training.type.name}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(training.scheduledAt)}
                        </span>
                        {training.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {training.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {training._count?.participants || training.participants.length}
                          {training.maxParticipants && ` / ${training.maxParticipants}`}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-500" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Training Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Neue Schulung</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTraining} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Typ *</label>
                <select name="typeId" required className="input w-full">
                  <option value="">Typ auswählen...</option>
                  {types.filter((t: TrainingType) => t.isActive).map((type: TrainingType) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Titel *</label>
                <input type="text" name="title" required className="input w-full" placeholder="z.B. Schießtraining für Cadets" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Beschreibung</label>
                <textarea name="description" rows={3} className="input w-full" placeholder="Zusätzliche Details..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Datum & Zeit *</label>
                  <input type="datetime-local" name="scheduledAt" required className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Ort</label>
                  <input type="text" name="location" className="input w-full" placeholder="z.B. Schießstand" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Max. Teilnehmer</label>
                <input type="number" name="maxParticipants" min="1" className="input w-full" placeholder="Leer = unbegrenzt" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Interne Notizen</label>
                <textarea name="notes" rows={2} className="input w-full" placeholder="Nur für Ausbilder sichtbar..." />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary" disabled={createTraining.isPending}>
                  {createTraining.isPending ? 'Erstelle...' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Type Modal */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-md w-full">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Neuer Schulungstyp</h2>
              <button onClick={() => setShowTypeModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateType} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
                <input type="text" name="name" required className="input w-full" placeholder="z.B. Schießtraining" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Beschreibung</label>
                <textarea name="description" rows={2} className="input w-full" placeholder="Kurze Beschreibung..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Dauer (Minuten)</label>
                <input type="number" name="duration" min="15" defaultValue={60} className="input w-full" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowTypeModal(false)} className="btn-secondary">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary" disabled={createType.isPending}>
                  {createType.isPending ? 'Erstelle...' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Training Detail Modal */}
      {selectedTraining && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{selectedTraining.title}</h2>
                <p className="text-sm text-slate-400">{selectedTraining.type.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx('px-3 py-1 rounded-full text-sm', statusColors[selectedTraining.status])}>
                  {statusLabels[selectedTraining.status]}
                </span>
                <button onClick={() => setSelectedTraining(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-6">
              {/* Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(selectedTraining.scheduledAt)}</span>
                </div>
                {selectedTraining.location && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <MapPin className="h-4 w-4" />
                    <span>{selectedTraining.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="h-4 w-4" />
                  <span>{selectedTraining.type.duration} Minuten</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Users className="h-4 w-4" />
                  <span>
                    {selectedTraining.participants.length}
                    {selectedTraining.maxParticipants && ` / ${selectedTraining.maxParticipants}`} Teilnehmer
                  </span>
                </div>
              </div>

              {selectedTraining.description && (
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-1">Beschreibung</h3>
                  <p className="text-slate-400">{selectedTraining.description}</p>
                </div>
              )}

              {/* Status Change */}
              {canManage && selectedTraining.status !== 'COMPLETED' && selectedTraining.status !== 'CANCELLED' && (
                <div className="flex gap-2">
                  {selectedTraining.status === 'SCHEDULED' && (
                    <button
                      onClick={() => {
                        updateTraining.mutate({ id: selectedTraining.id, data: { status: 'IN_PROGRESS' } });
                        setSelectedTraining({ ...selectedTraining, status: 'IN_PROGRESS' });
                      }}
                      className="btn-primary flex items-center gap-2"
                    >
                      <AlertCircle className="h-4 w-4" />
                      Starten
                    </button>
                  )}
                  {selectedTraining.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => {
                        updateTraining.mutate({ id: selectedTraining.id, data: { status: 'COMPLETED' } });
                        setSelectedTraining({ ...selectedTraining, status: 'COMPLETED' });
                      }}
                      className="btn-primary flex items-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Abschließen
                    </button>
                  )}
                  <button
                    onClick={() => {
                      updateTraining.mutate({ id: selectedTraining.id, data: { status: 'CANCELLED' } });
                      setSelectedTraining({ ...selectedTraining, status: 'CANCELLED' });
                    }}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Absagen
                  </button>
                </div>
              )}

              {/* Participants */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-slate-300">Teilnehmer</h3>
                  {canManage && selectedTraining.status === 'SCHEDULED' && (
                    <button
                      onClick={() => setShowAddParticipant(true)}
                      className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <UserPlus className="h-4 w-4" />
                      Hinzufügen
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {selectedTraining.participants.map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
                      <div>
                        <p className="font-medium text-white">
                          {p.employee.user.displayName || p.employee.user.username}
                        </p>
                        <p className="text-sm text-slate-400">{p.employee.rank}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {canManage && selectedTraining.status === 'IN_PROGRESS' && (
                          <select
                            value={p.status}
                            onChange={(e) => {
                              updateParticipant.mutate({
                                trainingId: selectedTraining.id,
                                participantId: p.id,
                                data: { status: e.target.value }
                              });
                            }}
                            className="input text-sm py-1"
                          >
                            {Object.entries(participantStatusLabels).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        )}
                        {canManage && selectedTraining.status === 'COMPLETED' && (
                          <select
                            value={p.grade || ''}
                            onChange={(e) => {
                              updateParticipant.mutate({
                                trainingId: selectedTraining.id,
                                participantId: p.id,
                                data: { grade: e.target.value }
                              });
                            }}
                            className="input text-sm py-1"
                          >
                            <option value="">Bewertung...</option>
                            {Object.entries(gradeLabels).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        )}
                        {!canManage && (
                          <span className="text-sm text-slate-400">
                            {participantStatusLabels[p.status]}
                            {p.grade && ` - ${gradeLabels[p.grade]}`}
                          </span>
                        )}
                        {canManage && selectedTraining.status === 'SCHEDULED' && (
                          <button
                            onClick={() => {
                              removeParticipant.mutate({
                                trainingId: selectedTraining.id,
                                participantId: p.id
                              });
                            }}
                            className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {selectedTraining.participants.length === 0 && (
                    <p className="text-slate-500 text-center py-4">Keine Teilnehmer</p>
                  )}
                </div>
              </div>

              {/* Delete */}
              {canManage && (
                <div className="pt-4 border-t border-slate-700">
                  <button
                    onClick={() => {
                      if (confirm('Schulung wirklich löschen?')) {
                        deleteTraining.mutate(selectedTraining.id);
                      }
                    }}
                    className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    Schulung löschen
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Participant Modal */}
      {showAddParticipant && selectedTraining && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Teilnehmer hinzufügen</h2>
              <button onClick={() => setShowAddParticipant(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                {employees
                  .filter((e: Employee) => !selectedTraining.participants.some(p => p.employee.id === e.id))
                  .map((employee: Employee) => (
                    <button
                      key={employee.id}
                      onClick={() => {
                        addParticipant.mutate({
                          trainingId: selectedTraining.id,
                          employeeId: employee.id
                        });
                      }}
                      className="w-full text-left p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      <p className="font-medium text-white">
                        {employee.user.displayName || employee.user.username}
                      </p>
                      <p className="text-sm text-slate-400">{employee.rank}</p>
                    </button>
                  ))}
                {employees.filter((e: Employee) => !selectedTraining.participants.some(p => p.employee.id === e.id)).length === 0 && (
                  <p className="text-slate-500 text-center py-4">Keine weiteren Mitarbeiter verfügbar</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
