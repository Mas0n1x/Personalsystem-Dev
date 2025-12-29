import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/Badge';
import { Plus, Package, Search } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';
import type { Evidence, PaginatedResponse } from '../../types';

export default function EvidencePage() {
  const queryClient = useQueryClient();
  const { canManageFinance } = usePermissions();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['evidence', page, status, search],
    queryFn: () =>
      financeApi.getEvidence({
        page: String(page),
        limit: '20',
        ...(status && { status }),
        ...(search && { search }),
      }),
  });

  const response = data?.data as PaginatedResponse<Evidence> | undefined;

  const createMutation = useMutation({
    mutationFn: financeApi.createEvidence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      setShowCreateModal(false);
      toast.success('Asservat erstellt');
    },
  });

  const logMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      financeApi.addEvidenceLog(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      setShowLogModal(false);
      setSelectedEvidence(null);
      toast.success('Aktion protokolliert');
    },
  });

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const columns = [
    {
      key: 'name',
      header: 'Asservat',
      render: (evidence: Evidence) => (
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-slate-400" />
          <div>
            <p className="font-medium text-white">{evidence.name}</p>
            {evidence.caseNumber && (
              <p className="text-sm text-slate-400">Fall: {evidence.caseNumber}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (evidence: Evidence) => <StatusBadge status={evidence.status} />,
    },
    {
      key: 'value',
      header: 'Wert',
      render: (evidence: Evidence) => (
        <span className="text-slate-300">{formatCurrency(evidence.value)}</span>
      ),
    },
    {
      key: 'location',
      header: 'Lagerort',
      render: (evidence: Evidence) => (
        <span className="text-slate-300">{evidence.location || '-'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Eingang',
      render: (evidence: Evidence) => (
        <span className="text-slate-400">
          {format(new Date(evidence.createdAt), 'dd.MM.yyyy', { locale: de })}
        </span>
      ),
    },
  ];

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      value: formData.get('value') ? Number(formData.get('value')) : undefined,
      location: formData.get('location') as string,
      caseNumber: formData.get('caseNumber') as string,
    });
  };

  const handleLog = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEvidence) return;
    const formData = new FormData(e.currentTarget);
    logMutation.mutate({
      id: selectedEvidence.id,
      data: {
        action: formData.get('action') as string,
        notes: formData.get('notes') as string,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Asservaten</h1>
          <p className="text-slate-400 mt-1">Beweismittel-Verwaltung</p>
        </div>
        {canManageFinance && (
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Neues Asservat
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="card p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-auto">
            <option value="">Alle Status</option>
            <option value="IN_STORAGE">Eingelagert</option>
            <option value="CHECKED_OUT">Ausgeliehen</option>
            <option value="RELEASED">Freigegeben</option>
            <option value="DESTROYED">Vernichtet</option>
          </select>
        </div>
      </div>

      {/* Tabelle */}
      <Table
        columns={columns}
        data={response?.data || []}
        keyExtractor={(e) => e.id}
        onRowClick={(e) => {
          setSelectedEvidence(e);
          setShowLogModal(true);
        }}
        isLoading={isLoading}
        emptyMessage="Keine Asservate gefunden"
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
        title="Neues Asservat"
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Wert</label>
              <input name="value" type="number" step="0.01" min="0" className="input" />
            </div>
            <div>
              <label className="label">Fallnummer</label>
              <input name="caseNumber" className="input" />
            </div>
          </div>
          <div>
            <label className="label">Lagerort</label>
            <input name="location" className="input" placeholder="z.B. Regal A-12" />
          </div>
        </form>
      </Modal>

      {/* Log Modal */}
      <Modal
        isOpen={showLogModal && !!selectedEvidence}
        onClose={() => {
          setShowLogModal(false);
          setSelectedEvidence(null);
        }}
        title={`Aktion: ${selectedEvidence?.name}`}
        footer={
          <>
            <button
              onClick={() => {
                setShowLogModal(false);
                setSelectedEvidence(null);
              }}
              className="btn-secondary"
            >
              Abbrechen
            </button>
            <button type="submit" form="log-form" className="btn-primary">
              Protokollieren
            </button>
          </>
        }
      >
        <form id="log-form" onSubmit={handleLog} className="space-y-4">
          <div className="p-4 bg-slate-700/50 rounded-lg mb-4">
            <p className="text-sm text-slate-400">Aktueller Status:</p>
            <StatusBadge status={selectedEvidence?.status || ''} />
          </div>
          <div>
            <label className="label">Aktion *</label>
            <select name="action" className="input" required>
              <option value="IN">Eingang</option>
              <option value="OUT">Ausgang</option>
              <option value="RELEASED">Freigabe</option>
              <option value="DESTROYED">Vernichtung</option>
            </select>
          </div>
          <div>
            <label className="label">Notizen</label>
            <textarea name="notes" className="input" rows={3} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
