import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/Badge';
import { Plus, Calendar, Check } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';
import type { Absence, PaginatedResponse } from '../../types';

export default function Absences() {
  const queryClient = useQueryClient();
  const { canApproveFinance } = usePermissions();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['absences', page, status, type],
    queryFn: () =>
      financeApi.getAbsences({
        page: String(page),
        limit: '20',
        ...(status && { status }),
        ...(type && { type }),
      }),
  });

  const response = data?.data as PaginatedResponse<Absence> | undefined;

  const createMutation = useMutation({
    mutationFn: financeApi.createAbsence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absences'] });
      setShowCreateModal(false);
      toast.success('Abmeldung eingereicht');
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => financeApi.approveAbsence(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absences'] });
      toast.success('Abmeldung genehmigt');
    },
  });

  const typeLabels: Record<string, string> = {
    VACATION: 'Urlaub',
    SICK: 'Krank',
    PERSONAL: 'Persönlich',
    TRAINING: 'Fortbildung',
    OTHER: 'Sonstiges',
  };

  const columns = [
    {
      key: 'user',
      header: 'Mitarbeiter',
      render: (absence: Absence) => (
        <div className="flex items-center gap-3">
          <img
            src={
              absence.user?.avatar ||
              `https://ui-avatars.com/api/?name=${absence.user?.username}&background=random`
            }
            alt={absence.user?.username}
            className="h-8 w-8 rounded-full"
          />
          <span className="text-white">
            {absence.user?.displayName || absence.user?.username}
          </span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Typ',
      render: (absence: Absence) => (
        <span className="text-slate-300">{typeLabels[absence.type] || absence.type}</span>
      ),
    },
    {
      key: 'dates',
      header: 'Zeitraum',
      render: (absence: Absence) => (
        <div className="flex items-center gap-2 text-slate-300">
          <Calendar className="h-4 w-4" />
          {format(new Date(absence.startDate), 'dd.MM.', { locale: de })} -{' '}
          {format(new Date(absence.endDate), 'dd.MM.yyyy', { locale: de })}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (absence: Absence) => <StatusBadge status={absence.status} />,
    },
    {
      key: 'actions',
      header: '',
      render: (absence: Absence) =>
        absence.status === 'PENDING' && canApproveFinance ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              approveMutation.mutate(absence.id);
            }}
            className="btn-sm btn-success"
          >
            <Check className="h-3 w-3" />
            Genehmigen
          </button>
        ) : null,
    },
  ];

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      type: formData.get('type') as string,
      startDate: formData.get('startDate') as string,
      endDate: formData.get('endDate') as string,
      reason: formData.get('reason') as string,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Abmeldungen</h1>
          <p className="text-slate-400 mt-1">Urlaub, Krankmeldungen und Abwesenheiten</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          Neue Abmeldung
        </button>
      </div>

      {/* Filter */}
      <div className="card p-4">
        <div className="flex gap-4">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-auto">
            <option value="">Alle Status</option>
            <option value="PENDING">Ausstehend</option>
            <option value="APPROVED">Genehmigt</option>
            <option value="REJECTED">Abgelehnt</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input w-auto">
            <option value="">Alle Typen</option>
            <option value="VACATION">Urlaub</option>
            <option value="SICK">Krank</option>
            <option value="PERSONAL">Persönlich</option>
            <option value="TRAINING">Fortbildung</option>
            <option value="OTHER">Sonstiges</option>
          </select>
        </div>
      </div>

      {/* Tabelle */}
      <Table
        columns={columns}
        data={response?.data || []}
        keyExtractor={(a) => a.id}
        isLoading={isLoading}
        emptyMessage="Keine Abmeldungen gefunden"
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
        title="Neue Abmeldung"
        footer={
          <>
            <button onClick={() => setShowCreateModal(false)} className="btn-secondary">
              Abbrechen
            </button>
            <button type="submit" form="create-form" className="btn-primary">
              Einreichen
            </button>
          </>
        }
      >
        <form id="create-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Typ *</label>
            <select name="type" className="input" required>
              <option value="VACATION">Urlaub</option>
              <option value="SICK">Krank</option>
              <option value="PERSONAL">Persönlich</option>
              <option value="TRAINING">Fortbildung</option>
              <option value="OTHER">Sonstiges</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Von *</label>
              <input name="startDate" type="date" className="input" required />
            </div>
            <div>
              <label className="label">Bis *</label>
              <input name="endDate" type="date" className="input" required />
            </div>
          </div>
          <div>
            <label className="label">Grund</label>
            <textarea name="reason" className="input" rows={3} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
