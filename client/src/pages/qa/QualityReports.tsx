import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qaApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { Plus, Star } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';
import type { QualityReport, PaginatedResponse } from '../../types';

export default function QualityReports() {
  const queryClient = useQueryClient();
  const { canManageQA } = usePermissions();
  const [page, setPage] = useState(1);
  const [unit, setUnit] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<QualityReport | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['qa-reports', page, unit],
    queryFn: () =>
      qaApi.getReports({
        page: String(page),
        limit: '20',
        ...(unit && { unit }),
      }),
  });

  const response = data?.data as PaginatedResponse<QualityReport> | undefined;

  const createMutation = useMutation({
    mutationFn: qaApi.createReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qa-reports'] });
      setShowCreateModal(false);
      toast.success('Bericht erstellt');
    },
  });

  const columns = [
    {
      key: 'unit',
      header: 'Unit',
      render: (report: QualityReport) => (
        <span className="font-medium text-white">{report.unit}</span>
      ),
    },
    {
      key: 'rating',
      header: 'Bewertung',
      render: (report: QualityReport) => (
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`h-4 w-4 ${
                star <= report.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'
              }`}
            />
          ))}
        </div>
      ),
    },
    {
      key: 'report',
      header: 'Bericht',
      render: (report: QualityReport) => (
        <span className="text-slate-300 line-clamp-1">{report.report}</span>
      ),
    },
    {
      key: 'reviewer',
      header: 'Prüfer',
      render: (report: QualityReport) => (
        <span className="text-slate-400">
          {report.reviewer?.displayName || report.reviewer?.username}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Datum',
      render: (report: QualityReport) => (
        <span className="text-slate-400">
          {format(new Date(report.createdAt), 'dd.MM.yyyy', { locale: de })}
        </span>
      ),
    },
  ];

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      unit: formData.get('unit') as string,
      rating: Number(formData.get('rating')),
      report: formData.get('report') as string,
      suggestions: formData.get('suggestions') as string,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Qualitätsberichte</h1>
          <p className="text-slate-400 mt-1">Quality Assurance - Unit-Bewertungen</p>
        </div>
        {canManageQA && (
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Neuer Bericht
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="card p-4">
        <select value={unit} onChange={(e) => setUnit(e.target.value)} className="input w-auto">
          <option value="">Alle Units</option>
          <option value="Patrol">Patrol</option>
          <option value="Detective">Detective</option>
          <option value="SWAT">SWAT</option>
          <option value="Traffic">Traffic</option>
          <option value="Air Support">Air Support</option>
        </select>
      </div>

      {/* Tabelle */}
      <Table
        columns={columns}
        data={response?.data || []}
        keyExtractor={(r) => r.id}
        onRowClick={(r) => setSelectedReport(r)}
        isLoading={isLoading}
        emptyMessage="Keine Berichte gefunden"
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
        title="Neuer Qualitätsbericht"
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
            <label className="label">Unit *</label>
            <select name="unit" className="input" required>
              <option value="">Auswählen...</option>
              <option value="Patrol">Patrol</option>
              <option value="Detective">Detective</option>
              <option value="SWAT">SWAT</option>
              <option value="Traffic">Traffic</option>
              <option value="Air Support">Air Support</option>
            </select>
          </div>
          <div>
            <label className="label">Bewertung (1-5) *</label>
            <input
              name="rating"
              type="number"
              min="1"
              max="5"
              className="input"
              defaultValue="3"
              required
            />
          </div>
          <div>
            <label className="label">Bericht *</label>
            <textarea name="report" className="input" rows={4} required />
          </div>
          <div>
            <label className="label">Verbesserungsvorschläge</label>
            <textarea name="suggestions" className="input" rows={3} />
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title={`Qualitätsbericht: ${selectedReport?.unit}`}
        size="lg"
      >
        {selectedReport && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-slate-400">Bewertung:</span>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${
                      star <= selectedReport.rating
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-slate-600'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-white mb-2">Bericht</h4>
              <p className="text-slate-300 whitespace-pre-wrap">{selectedReport.report}</p>
            </div>

            {selectedReport.suggestions && (
              <div>
                <h4 className="font-medium text-white mb-2">Verbesserungsvorschläge</h4>
                <p className="text-slate-300 whitespace-pre-wrap">{selectedReport.suggestions}</p>
              </div>
            )}

            <div className="pt-4 border-t border-slate-700 text-sm text-slate-400">
              Erstellt von {selectedReport.reviewer?.displayName || selectedReport.reviewer?.username} am{' '}
              {format(new Date(selectedReport.createdAt), 'dd.MM.yyyy HH:mm', { locale: de })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
