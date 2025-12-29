import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/Badge';
import { Plus, Check, X, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';
import type { Application, PaginatedResponse } from '../../types';

export default function Applications() {
  const queryClient = useQueryClient();
  const { canManageApplications, canManageHR } = usePermissions();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['applications', page, status],
    queryFn: () =>
      hrApi.getApplications({
        page: String(page),
        limit: '20',
        ...(status && { status }),
      }),
  });

  const response = data?.data as PaginatedResponse<Application> | undefined;

  const createMutation = useMutation({
    mutationFn: hrApi.createApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setShowCreateModal(false);
      toast.success('Bewerbung erstellt');
    },
  });

  const acceptMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      hrApi.acceptApplication(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setSelectedApp(null);
      toast.success('Bewerbung angenommen');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      hrApi.rejectApplication(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setSelectedApp(null);
      toast.success('Bewerbung abgelehnt');
    },
  });

  const columns = [
    {
      key: 'applicantName',
      header: 'Bewerber',
      render: (app: Application) => (
        <div>
          <p className="font-medium text-white">{app.applicantName}</p>
          {app.discordName && <p className="text-sm text-slate-400">@{app.discordName}</p>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (app: Application) => <StatusBadge status={app.status} />,
    },
    {
      key: 'interviewDate',
      header: 'Interview',
      render: (app: Application) =>
        app.interviewDate ? (
          <div className="flex items-center gap-2 text-slate-300">
            <Calendar className="h-4 w-4" />
            {format(new Date(app.interviewDate), 'dd.MM.yyyy HH:mm', { locale: de })}
          </div>
        ) : (
          <span className="text-slate-500">-</span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Eingereicht',
      render: (app: Application) => (
        <span className="text-slate-400">
          {format(new Date(app.createdAt), 'dd.MM.yyyy', { locale: de })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (app: Application) =>
        app.status === 'PENDING' && canManageHR ? (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedApp(app);
              }}
              className="btn-sm btn-success"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                rejectMutation.mutate({ id: app.id, reason: 'Abgelehnt' });
              }}
              className="btn-sm btn-danger"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null,
    },
  ];

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      applicantName: formData.get('applicantName') as string,
      discordId: formData.get('discordId') as string,
      discordName: formData.get('discordName') as string,
      notes: formData.get('notes') as string,
    });
  };

  const handleAccept = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedApp) return;
    const formData = new FormData(e.currentTarget);
    acceptMutation.mutate({
      id: selectedApp.id,
      data: {
        rank: formData.get('rank') as string,
        department: formData.get('department') as string,
        badgeNumber: formData.get('badgeNumber') as string,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bewerbungen</h1>
          <p className="text-slate-400 mt-1">Verwaltung von Bewerbungen</p>
        </div>
        {canManageApplications && (
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Neue Bewerbung
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
          <option value="PENDING">Ausstehend</option>
          <option value="INTERVIEW_SCHEDULED">Interview geplant</option>
          <option value="INTERVIEW_COMPLETED">Interview abgeschlossen</option>
          <option value="ACCEPTED">Angenommen</option>
          <option value="REJECTED">Abgelehnt</option>
        </select>
      </div>

      {/* Tabelle */}
      <Table
        columns={columns}
        data={response?.data || []}
        keyExtractor={(a) => a.id}
        isLoading={isLoading}
        emptyMessage="Keine Bewerbungen gefunden"
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
        title="Neue Bewerbung"
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
            <label className="label">Name des Bewerbers *</label>
            <input name="applicantName" className="input" required />
          </div>
          <div>
            <label className="label">Discord ID</label>
            <input name="discordId" className="input" />
          </div>
          <div>
            <label className="label">Discord Name</label>
            <input name="discordName" className="input" />
          </div>
          <div>
            <label className="label">Notizen</label>
            <textarea name="notes" className="input" rows={3} />
          </div>
        </form>
      </Modal>

      {/* Accept Modal */}
      <Modal
        isOpen={!!selectedApp}
        onClose={() => setSelectedApp(null)}
        title="Bewerbung annehmen"
        footer={
          <>
            <button onClick={() => setSelectedApp(null)} className="btn-secondary">
              Abbrechen
            </button>
            <button type="submit" form="accept-form" className="btn-success">
              Annehmen & Einstellen
            </button>
          </>
        }
      >
        <form id="accept-form" onSubmit={handleAccept} className="space-y-4">
          <p className="text-slate-300">
            Bewerber <strong>{selectedApp?.applicantName}</strong> wird als Mitarbeiter eingestellt.
          </p>
          <div>
            <label className="label">Rang</label>
            <select name="rank" className="input" defaultValue="Cadet">
              <option value="Cadet">Cadet</option>
              <option value="Officer">Officer</option>
              <option value="Senior Officer">Senior Officer</option>
            </select>
          </div>
          <div>
            <label className="label">Abteilung</label>
            <select name="department" className="input" defaultValue="Patrol">
              <option value="Patrol">Patrol</option>
              <option value="Detective">Detective</option>
              <option value="SWAT">SWAT</option>
              <option value="Traffic">Traffic</option>
            </select>
          </div>
          <div>
            <label className="label">Badge Nummer</label>
            <input name="badgeNumber" className="input" placeholder="z.B. 1234" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
