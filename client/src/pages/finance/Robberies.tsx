import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/Badge';
import { Plus, AlertTriangle, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';
import type { RobberyReport, PaginatedResponse } from '../../types';

interface RobberyResponse extends PaginatedResponse<RobberyReport> {
  totalDamage: number;
}

export default function Robberies() {
  const queryClient = useQueryClient();
  const { canManageFinance } = usePermissions();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<RobberyReport | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['robberies', page, status],
    queryFn: () =>
      financeApi.getRobberies({
        page: String(page),
        limit: '20',
        ...(status && { status }),
      }),
  });

  const response = data?.data as RobberyResponse | undefined;

  const createMutation = useMutation({
    mutationFn: financeApi.createRobbery,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['robberies'] });
      setShowCreateModal(false);
      toast.success('Raubbericht erstellt');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      financeApi.updateRobbery(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['robberies'] });
      setSelectedReport(null);
      toast.success('Status aktualisiert');
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const columns = [
    {
      key: 'date',
      header: 'Datum',
      render: (report: RobberyReport) => (
        <span className="text-slate-300">
          {format(new Date(report.date), 'dd.MM.yyyy HH:mm', { locale: de })}
        </span>
      ),
    },
    {
      key: 'location',
      header: 'Ort',
      render: (report: RobberyReport) => (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-400" />
          <span className="text-white">{report.location}</span>
        </div>
      ),
    },
    {
      key: 'damage',
      header: 'Schaden',
      render: (report: RobberyReport) => (
        <span className="text-red-400 font-medium">{formatCurrency(report.damage)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (report: RobberyReport) => <StatusBadge status={report.status} />,
    },
    {
      key: 'reporter',
      header: 'Gemeldet von',
      render: (report: RobberyReport) => (
        <span className="text-slate-400">
          {report.reporter?.displayName || report.reporter?.username}
        </span>
      ),
    },
  ];

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      date: formData.get('date') as string,
      location: formData.get('location') as string,
      damage: Number(formData.get('damage')),
      description: formData.get('description') as string,
      suspects: formData.get('suspects') as string,
    });
  };

  const handleStatusChange = (newStatus: string) => {
    if (!selectedReport) return;
    updateMutation.mutate({
      id: selectedReport.id,
      data: { status: newStatus },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Raubberichte</h1>
          <p className="text-slate-400 mt-1">Dokumentation von Raubüberfällen</p>
        </div>
        {canManageFinance && (
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Neuer Bericht
          </button>
        )}
      </div>

      {/* Summary */}
      {response && (
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-900/50 rounded-xl">
                <AlertTriangle className="h-8 w-8 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Gesamtschaden</p>
                <p className="text-2xl font-bold text-red-400">
                  {formatCurrency(response.totalDamage)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-400">Anzahl Berichte</p>
              <p className="text-2xl font-bold text-white">{response.total}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="card p-4">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-auto">
          <option value="">Alle Status</option>
          <option value="OPEN">Offen</option>
          <option value="INVESTIGATING">In Ermittlung</option>
          <option value="SOLVED">Gelöst</option>
          <option value="CLOSED">Geschlossen</option>
        </select>
      </div>

      {/* Tabelle */}
      <Table
        columns={columns}
        data={response?.data || []}
        keyExtractor={(r) => r.id}
        onRowClick={(r) => setSelectedReport(r)}
        isLoading={isLoading}
        emptyMessage="Keine Raubberichte gefunden"
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
        title="Neuer Raubbericht"
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
            <label className="label">Datum & Uhrzeit</label>
            <input name="date" type="datetime-local" className="input" />
          </div>
          <div>
            <label className="label">Ort *</label>
            <input name="location" className="input" required placeholder="z.B. Fleeca Bank, Vinewood" />
          </div>
          <div>
            <label className="label">Schaden ($) *</label>
            <input name="damage" type="number" min="0" className="input" required />
          </div>
          <div>
            <label className="label">Beschreibung *</label>
            <textarea name="description" className="input" rows={4} required />
          </div>
          <div>
            <label className="label">Verdächtige</label>
            <textarea name="suspects" className="input" rows={2} placeholder="Beschreibung der Verdächtigen" />
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title="Raubbericht Details"
        size="lg"
      >
        {selectedReport && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <StatusBadge status={selectedReport.status} />
              <span className="text-red-400 font-bold text-xl">
                {formatCurrency(selectedReport.damage)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-400">Datum</p>
                <p className="text-white">
                  {format(new Date(selectedReport.date), 'dd.MM.yyyy HH:mm', { locale: de })}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Ort</p>
                <p className="text-white">{selectedReport.location}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-slate-400">Beschreibung</p>
              <p className="text-white whitespace-pre-wrap">{selectedReport.description}</p>
            </div>

            {selectedReport.suspects && (
              <div>
                <p className="text-sm text-slate-400">Verdächtige</p>
                <p className="text-white whitespace-pre-wrap">{selectedReport.suspects}</p>
              </div>
            )}

            {canManageFinance && (
              <div className="pt-4 border-t border-slate-700">
                <p className="text-sm text-slate-400 mb-2">Status ändern</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStatusChange('INVESTIGATING')}
                    className="btn-sm btn-primary"
                  >
                    In Ermittlung
                  </button>
                  <button
                    onClick={() => handleStatusChange('SOLVED')}
                    className="btn-sm btn-success"
                  >
                    Gelöst
                  </button>
                  <button
                    onClick={() => handleStatusChange('CLOSED')}
                    className="btn-sm btn-secondary"
                  >
                    Geschlossen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
