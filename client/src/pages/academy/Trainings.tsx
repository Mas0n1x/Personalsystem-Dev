import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { academyApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/Badge';
import { Plus, Users, Calendar, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';
import type { Training, PaginatedResponse } from '../../types';

export default function Trainings() {
  const queryClient = useQueryClient();
  const { canManageAcademy, canTeach } = usePermissions();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['trainings', page, status],
    queryFn: () =>
      academyApi.getTrainings({
        page: String(page),
        limit: '20',
        ...(status && { status }),
      }),
  });

  const response = data?.data as PaginatedResponse<Training> | undefined;

  const createMutation = useMutation({
    mutationFn: academyApi.createTraining,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      setShowCreateModal(false);
      toast.success('Training erstellt');
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => academyApi.completeTraining(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      toast.success('Training abgeschlossen');
    },
  });

  const columns = [
    {
      key: 'name',
      header: 'Training',
      render: (training: Training) => (
        <div>
          <p className="font-medium text-white">{training.name}</p>
          {training.description && (
            <p className="text-sm text-slate-400 line-clamp-1">{training.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Typ',
      render: (training: Training) => <StatusBadge status={training.type} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (training: Training) => <StatusBadge status={training.status} />,
    },
    {
      key: 'tutor',
      header: 'Ausbilder',
      render: (training: Training) => (
        <span className="text-slate-300">
          {training.tutor?.displayName || training.tutor?.username}
        </span>
      ),
    },
    {
      key: 'participants',
      header: 'Teilnehmer',
      render: (training: Training) => (
        <div className="flex items-center gap-2 text-slate-300">
          <Users className="h-4 w-4" />
          {training.participants?.length || 0}
          {training.maxParticipants && ` / ${training.maxParticipants}`}
        </div>
      ),
    },
    {
      key: 'scheduledAt',
      header: 'Termin',
      render: (training: Training) =>
        training.scheduledAt ? (
          <div className="flex items-center gap-2 text-slate-300">
            <Calendar className="h-4 w-4" />
            {format(new Date(training.scheduledAt), 'dd.MM.yyyy HH:mm', { locale: de })}
          </div>
        ) : (
          <span className="text-slate-500">-</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (training: Training) =>
        training.status === 'IN_PROGRESS' && canTeach ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              completeMutation.mutate(training.id);
            }}
            className="btn-sm btn-success"
          >
            <CheckCircle className="h-3 w-3" />
            Abschließen
          </button>
        ) : null,
    },
  ];

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      type: formData.get('type') as string,
      scheduledAt: formData.get('scheduledAt') as string,
      maxParticipants: formData.get('maxParticipants')
        ? Number(formData.get('maxParticipants'))
        : undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trainings</h1>
          <p className="text-slate-400 mt-1">Police Academy - Aus- und Fortbildung</p>
        </div>
        {canManageAcademy && (
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Neues Training
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="card p-4">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="input w-auto"
        >
          <option value="">Alle Status</option>
          <option value="SCHEDULED">Geplant</option>
          <option value="IN_PROGRESS">Läuft</option>
          <option value="COMPLETED">Abgeschlossen</option>
          <option value="CANCELLED">Abgebrochen</option>
        </select>
      </div>

      {/* Tabelle */}
      <Table
        columns={columns}
        data={response?.data || []}
        keyExtractor={(t) => t.id}
        onRowClick={(t) => setSelectedTraining(t)}
        isLoading={isLoading}
        emptyMessage="Keine Trainings gefunden"
      />

      {/* Pagination */}
      {response && response.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={response.totalPages}
          onPageChange={setPage}
          total={response.total}
          limit={response.limit}
        />
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Neues Training"
        footer={
          <>
            <button onClick={() => setShowCreateModal(false)} className="btn-secondary">
              Abbrechen
            </button>
            <button type="submit" form="create-form" className="btn-primary">
              Erstellen
            </button>
          </>
        }
      >
        <form id="create-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input name="name" className="input" required />
          </div>
          <div>
            <label className="label">Beschreibung</label>
            <textarea name="description" className="input" rows={3} />
          </div>
          <div>
            <label className="label">Typ</label>
            <select name="type" className="input" defaultValue="BASIC">
              <option value="BASIC">Grundausbildung</option>
              <option value="ADVANCED">Fortgeschritten</option>
              <option value="SPECIALIZATION">Spezialisierung</option>
              <option value="CERTIFICATION">Zertifizierung</option>
              <option value="REFRESHER">Auffrischung</option>
            </select>
          </div>
          <div>
            <label className="label">Termin</label>
            <input name="scheduledAt" type="datetime-local" className="input" />
          </div>
          <div>
            <label className="label">Max. Teilnehmer</label>
            <input name="maxParticipants" type="number" min="1" className="input" />
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedTraining}
        onClose={() => setSelectedTraining(null)}
        title={selectedTraining?.name || 'Training Details'}
        size="lg"
      >
        {selectedTraining && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <StatusBadge status={selectedTraining.type} />
              <StatusBadge status={selectedTraining.status} />
            </div>

            {selectedTraining.description && (
              <p className="text-slate-300">{selectedTraining.description}</p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-400">Ausbilder</p>
                <p className="text-white">
                  {selectedTraining.tutor?.displayName || selectedTraining.tutor?.username}
                </p>
              </div>
              {selectedTraining.scheduledAt && (
                <div>
                  <p className="text-sm text-slate-400">Termin</p>
                  <p className="text-white">
                    {format(new Date(selectedTraining.scheduledAt), 'dd.MM.yyyy HH:mm', {
                      locale: de,
                    })}
                  </p>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-medium text-white mb-2">
                Teilnehmer ({selectedTraining.participants?.length || 0})
              </h4>
              {selectedTraining.participants?.length ? (
                <div className="space-y-2">
                  {selectedTraining.participants.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg"
                    >
                      <span className="text-slate-300">
                        {p.user?.displayName || p.user?.username}
                      </span>
                      {p.passed !== null && (
                        <span
                          className={p.passed ? 'text-green-400' : 'text-red-400'}
                        >
                          {p.passed ? 'Bestanden' : 'Nicht bestanden'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400">Keine Teilnehmer</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
