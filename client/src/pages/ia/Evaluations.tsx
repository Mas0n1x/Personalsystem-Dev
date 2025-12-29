import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { iaApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/Badge';
import { Plus, Star, AlertTriangle, Award } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';
import type { Evaluation, PaginatedResponse } from '../../types';

export default function Evaluations() {
  const queryClient = useQueryClient();
  const { canManageIA } = usePermissions();
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'evaluation' | 'warning' | 'commendation'>('evaluation');

  const { data, isLoading } = useQuery({
    queryKey: ['evaluations', page, type],
    queryFn: () =>
      iaApi.getEvaluations({
        page: String(page),
        limit: '20',
        ...(type && { type }),
      }),
  });

  const response = data?.data as PaginatedResponse<Evaluation> | undefined;

  const createEvaluationMutation = useMutation({
    mutationFn: iaApi.createEvaluation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      setShowCreateModal(false);
      toast.success('Bewertung erstellt');
    },
  });

  const createWarningMutation = useMutation({
    mutationFn: iaApi.createWarning,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      setShowCreateModal(false);
      toast.success('Verwarnung erstellt');
    },
  });

  const createCommendationMutation = useMutation({
    mutationFn: iaApi.createCommendation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      setShowCreateModal(false);
      toast.success('Belobigung erstellt');
    },
  });

  const columns = [
    {
      key: 'employee',
      header: 'Mitarbeiter',
      render: (eval_: Evaluation) => (
        <div className="flex items-center gap-3">
          <img
            src={
              eval_.employee?.avatar ||
              `https://ui-avatars.com/api/?name=${eval_.employee?.username}&background=random`
            }
            alt={eval_.employee?.username}
            className="h-8 w-8 rounded-full"
          />
          <span className="text-white">{eval_.employee?.displayName || eval_.employee?.username}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Typ',
      render: (eval_: Evaluation) => <StatusBadge status={eval_.type} />,
    },
    {
      key: 'rating',
      header: 'Bewertung',
      render: (eval_: Evaluation) => (
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`h-4 w-4 ${
                star <= eval_.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'
              }`}
            />
          ))}
        </div>
      ),
    },
    {
      key: 'comment',
      header: 'Kommentar',
      render: (eval_: Evaluation) => (
        <span className="text-slate-300 line-clamp-1">{eval_.comment || '-'}</span>
      ),
    },
    {
      key: 'evaluator',
      header: 'Von',
      render: (eval_: Evaluation) => (
        <span className="text-slate-400">
          {eval_.evaluator?.displayName || eval_.evaluator?.username}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Datum',
      render: (eval_: Evaluation) => (
        <span className="text-slate-400">
          {format(new Date(eval_.createdAt), 'dd.MM.yyyy', { locale: de })}
        </span>
      ),
    },
  ];

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const baseData = {
      employeeId: formData.get('employeeId') as string,
      comment: formData.get('comment') as string,
    };

    if (createType === 'warning') {
      createWarningMutation.mutate({
        ...baseData,
        severity: Number(formData.get('severity')),
      });
    } else if (createType === 'commendation') {
      createCommendationMutation.mutate(baseData);
    } else {
      createEvaluationMutation.mutate({
        ...baseData,
        rating: Number(formData.get('rating')),
        type: formData.get('evalType') as string,
        isPositive: formData.get('isPositive') === 'true',
      });
    }
  };

  const openCreateModal = (modalType: 'evaluation' | 'warning' | 'commendation') => {
    setCreateType(modalType);
    setShowCreateModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bewertungen</h1>
          <p className="text-slate-400 mt-1">Internal Affairs - Mitarbeiterbewertungen</p>
        </div>
        {canManageIA && (
          <div className="flex gap-2">
            <button onClick={() => openCreateModal('commendation')} className="btn-success">
              <Award className="h-4 w-4" />
              Belobigung
            </button>
            <button onClick={() => openCreateModal('warning')} className="btn-danger">
              <AlertTriangle className="h-4 w-4" />
              Verwarnung
            </button>
            <button onClick={() => openCreateModal('evaluation')} className="btn-primary">
              <Plus className="h-4 w-4" />
              Bewertung
            </button>
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="card p-4">
        <select value={type} onChange={(e) => setType(e.target.value)} className="input w-auto">
          <option value="">Alle Typen</option>
          <option value="PERFORMANCE">Performance</option>
          <option value="WARNING">Verwarnung</option>
          <option value="COMMENDATION">Belobigung</option>
          <option value="INVESTIGATION">Ermittlung</option>
          <option value="NOTE">Notiz</option>
        </select>
      </div>

      {/* Tabelle */}
      <Table
        columns={columns}
        data={response?.data || []}
        keyExtractor={(e) => e.id}
        isLoading={isLoading}
        emptyMessage="Keine Bewertungen gefunden"
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
        title={
          createType === 'warning'
            ? 'Neue Verwarnung'
            : createType === 'commendation'
            ? 'Neue Belobigung'
            : 'Neue Bewertung'
        }
        footer={
          <>
            <button onClick={() => setShowCreateModal(false)} className="btn-secondary">
              Abbrechen
            </button>
            <button
              type="submit"
              form="create-form"
              className={
                createType === 'warning'
                  ? 'btn-danger'
                  : createType === 'commendation'
                  ? 'btn-success'
                  : 'btn-primary'
              }
            >
              Erstellen
            </button>
          </>
        }
      >
        <form id="create-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Mitarbeiter (User ID) *</label>
            <input name="employeeId" className="input" required placeholder="User ID eingeben" />
          </div>

          {createType === 'evaluation' && (
            <>
              <div>
                <label className="label">Typ</label>
                <select name="evalType" className="input" defaultValue="PERFORMANCE">
                  <option value="PERFORMANCE">Performance</option>
                  <option value="NOTE">Notiz</option>
                </select>
              </div>
              <div>
                <label className="label">Bewertung (1-5)</label>
                <input
                  name="rating"
                  type="number"
                  min="1"
                  max="5"
                  className="input"
                  defaultValue="3"
                />
              </div>
              <div>
                <label className="label">Positiv?</label>
                <select name="isPositive" className="input">
                  <option value="true">Ja</option>
                  <option value="false">Nein</option>
                </select>
              </div>
            </>
          )}

          {createType === 'warning' && (
            <div>
              <label className="label">Schweregrad (1-5)</label>
              <input
                name="severity"
                type="number"
                min="1"
                max="5"
                className="input"
                defaultValue="1"
              />
            </div>
          )}

          <div>
            <label className="label">Kommentar</label>
            <textarea name="comment" className="input" rows={4} required />
          </div>
        </form>
      </Modal>
    </div>
  );
}
