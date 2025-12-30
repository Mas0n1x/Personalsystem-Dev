import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { uprankRequestsApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import {
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Eye,
  Trash2,
  AlertTriangle,
  Lock,
  User,
  ChevronUp,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  rank: string;
  badgeNumber: string;
  user: {
    id: string;
    displayName: string;
    username: string;
  };
  hasActiveLock: boolean;
  lockUntil: string | null;
}

interface UprankRequest {
  id: string;
  employeeId: string;
  currentRank: string;
  targetRank: string;
  reason: string;
  achievements?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  createdAt: string;
  processedAt?: string;
  employee: {
    id: string;
    rank: string;
    badgeNumber: string;
    user: {
      displayName: string;
      username: string;
    };
  };
  requestedBy: {
    id: string;
    displayName: string;
    username: string;
  };
  processedBy?: {
    displayName: string;
    username: string;
  };
}

const RANKS = [
  'Cadet',
  'Officer I',
  'Officer II',
  'Officer III',
  'Senior Officer',
  'Corporal',
  'Sergeant I',
  'Sergeant II',
  'Lieutenant',
  'Captain',
  'Commander',
  'Deputy Chief',
  'Assistant Chief',
  'Chief of Police',
];

export default function Teamleitung() {
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<UprankRequest | null>(null);
  const [showProcessModal, setShowProcessModal] = useState(false);

  const canManage = permissions.hasAnyPermission('teamlead.manage', 'admin.full');
  const canProcess = permissions.hasAnyPermission('management.uprank', 'admin.full');

  // Queries
  const { data: stats } = useQuery({
    queryKey: ['uprank-stats'],
    queryFn: () => uprankRequestsApi.getStats().then((r) => r.data),
  });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['uprank-requests', statusFilter],
    queryFn: () =>
      uprankRequestsApi
        .getAll(statusFilter ? { status: statusFilter } : undefined)
        .then((r) => r.data),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['uprank-employees'],
    queryFn: () => uprankRequestsApi.getEmployees().then((r) => r.data),
    enabled: showCreateModal,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: uprankRequestsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uprank-requests'] });
      queryClient.invalidateQueries({ queryKey: ['uprank-stats'] });
      setShowCreateModal(false);
      toast.success('Uprank-Antrag erstellt');
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Fehler beim Erstellen');
    },
  });

  const processMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: 'APPROVED' | 'REJECTED'; rejectionReason?: string } }) =>
      uprankRequestsApi.process(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uprank-requests'] });
      queryClient.invalidateQueries({ queryKey: ['uprank-stats'] });
      setShowProcessModal(false);
      setSelectedRequest(null);
      toast.success('Antrag bearbeitet');
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Fehler bei der Bearbeitung');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: uprankRequestsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uprank-requests'] });
      queryClient.invalidateQueries({ queryKey: ['uprank-stats'] });
      toast.success('Antrag gelöscht');
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Fehler beim Löschen');
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
            <Clock className="h-3 w-3" />
            Ausstehend
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
            <CheckCircle className="h-3 w-3" />
            Genehmigt
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
            <XCircle className="h-3 w-3" />
            Abgelehnt
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Teamleitung</h1>
          <p className="text-slate-400">Uprank-Anträge verwalten</p>
        </div>
        {canManage && (
          <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Neuer Antrag
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <TrendingUp className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
              <p className="text-sm text-slate-400">Gesamt</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <Clock className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.pending || 0}</p>
              <p className="text-sm text-slate-400">Ausstehend</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.approved || 0}</p>
              <p className="text-sm text-slate-400">Genehmigt</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.rejected || 0}</p>
              <p className="text-sm text-slate-400">Abgelehnt</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm text-slate-400">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-48"
          >
            <option value="">Alle</option>
            <option value="PENDING">Ausstehend</option>
            <option value="APPROVED">Genehmigt</option>
            <option value="REJECTED">Abgelehnt</option>
          </select>
        </div>
      </div>

      {/* Request List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left p-4 text-slate-400 font-medium">Mitarbeiter</th>
                <th className="text-left p-4 text-slate-400 font-medium">Rang-Änderung</th>
                <th className="text-left p-4 text-slate-400 font-medium">Beantragt von</th>
                <th className="text-left p-4 text-slate-400 font-medium">Status</th>
                <th className="text-left p-4 text-slate-400 font-medium">Datum</th>
                <th className="text-right p-4 text-slate-400 font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Laden...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Keine Anträge gefunden
                  </td>
                </tr>
              ) : (
                requests.map((request: UprankRequest) => (
                  <tr key={request.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
                          <User className="h-5 w-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{request.employee.user.displayName}</p>
                          <p className="text-sm text-slate-400">#{request.employee.badgeNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{request.currentRank}</span>
                        <ChevronUp className="h-4 w-4 text-green-400" />
                        <span className="text-green-400 font-medium">{request.targetRank}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-300">{request.requestedBy.displayName}</td>
                    <td className="p-4">{getStatusBadge(request.status)}</td>
                    <td className="p-4 text-slate-400">
                      {new Date(request.createdAt).toLocaleDateString('de-DE')}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowDetailModal(true);
                          }}
                          className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                          title="Details"
                        >
                          <Eye className="h-4 w-4 text-slate-400" />
                        </button>
                        {canProcess && request.status === 'PENDING' && (
                          <button
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowProcessModal(true);
                            }}
                            className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                            title="Bearbeiten"
                          >
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          </button>
                        )}
                        {request.status === 'PENDING' && (
                          <button
                            onClick={() => {
                              if (confirm('Antrag wirklich löschen?')) {
                                deleteMutation.mutate(request.id);
                              }
                            }}
                            className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                            title="Löschen"
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && <CreateRequestModal employees={employees} onClose={() => setShowCreateModal(false)} onCreate={(data) => createMutation.mutate(data)} isLoading={createMutation.isPending} />}

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
        <DetailModal request={selectedRequest} onClose={() => { setShowDetailModal(false); setSelectedRequest(null); }} />
      )}

      {/* Process Modal */}
      {showProcessModal && selectedRequest && (
        <ProcessModal
          request={selectedRequest}
          onClose={() => { setShowProcessModal(false); setSelectedRequest(null); }}
          onProcess={(data) => processMutation.mutate({ id: selectedRequest.id, data })}
          isLoading={processMutation.isPending}
        />
      )}
    </div>
  );
}

// Create Request Modal
function CreateRequestModal({
  employees,
  onClose,
  onCreate,
  isLoading,
}: {
  employees: Employee[];
  onClose: () => void;
  onCreate: (data: { employeeId: string; targetRank: string; reason: string; achievements?: string }) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    employeeId: '',
    targetRank: '',
    reason: '',
    achievements: '',
  });

  const selectedEmployee = employees.find((e) => e.id === formData.employeeId);
  const currentRankIndex = selectedEmployee ? RANKS.indexOf(selectedEmployee.rank) : -1;
  const availableTargetRanks = currentRankIndex >= 0 ? RANKS.slice(currentRankIndex + 1) : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      employeeId: formData.employeeId,
      targetRank: formData.targetRank,
      reason: formData.reason,
      achievements: formData.achievements || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-4">Neuer Uprank-Antrag</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Mitarbeiter *</label>
            <select
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value, targetRank: '' })}
              className="input w-full"
              required
            >
              <option value="">Auswählen...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id} disabled={emp.hasActiveLock}>
                  {emp.user.displayName} - {emp.rank} {emp.hasActiveLock ? '(Gesperrt)' : ''}
                </option>
              ))}
            </select>
            {selectedEmployee?.hasActiveLock && (
              <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Gesperrt bis {new Date(selectedEmployee.lockUntil!).toLocaleDateString('de-DE')}
              </p>
            )}
          </div>

          {selectedEmployee && !selectedEmployee.hasActiveLock && (
            <>
              <div className="p-3 bg-slate-700/50 rounded-lg">
                <p className="text-sm text-slate-400">Aktueller Rang</p>
                <p className="text-white font-medium">{selectedEmployee.rank}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Ziel-Rang *</label>
                <select
                  value={formData.targetRank}
                  onChange={(e) => setFormData({ ...formData, targetRank: e.target.value })}
                  className="input w-full"
                  required
                >
                  <option value="">Auswählen...</option>
                  {availableTargetRanks.map((rank) => (
                    <option key={rank} value={rank}>
                      {rank}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Begründung *</label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="input w-full h-24"
              placeholder="Warum sollte dieser Mitarbeiter befördert werden?"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Besondere Leistungen</label>
            <textarea
              value={formData.achievements}
              onChange={(e) => setFormData({ ...formData, achievements: e.target.value })}
              className="input w-full h-24"
              placeholder="Auflistung besonderer Leistungen und Erfolge..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.employeeId || !formData.targetRank || selectedEmployee?.hasActiveLock}
              className="btn-primary"
            >
              {isLoading ? 'Erstelle...' : 'Antrag erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Detail Modal
function DetailModal({ request, onClose }: { request: UprankRequest; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Antrag-Details</h2>
          {request.status === 'PENDING' && (
            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-sm">Ausstehend</span>
          )}
          {request.status === 'APPROVED' && (
            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-sm">Genehmigt</span>
          )}
          {request.status === 'REJECTED' && (
            <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-sm">Abgelehnt</span>
          )}
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center">
                <User className="h-6 w-6 text-slate-400" />
              </div>
              <div>
                <p className="font-medium text-white">{request.employee.user.displayName}</p>
                <p className="text-sm text-slate-400">Badge #{request.employee.badgeNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400">{request.currentRank}</span>
              <ChevronUp className="h-4 w-4 text-green-400" />
              <span className="text-green-400 font-medium">{request.targetRank}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Begründung</label>
            <p className="text-white bg-slate-700/30 p-3 rounded-lg">{request.reason}</p>
          </div>

          {request.achievements && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Besondere Leistungen</label>
              <p className="text-white bg-slate-700/30 p-3 rounded-lg whitespace-pre-wrap">{request.achievements}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-slate-400">Beantragt von</label>
              <p className="text-white">{request.requestedBy.displayName}</p>
            </div>
            <div>
              <label className="block text-slate-400">Beantragt am</label>
              <p className="text-white">{new Date(request.createdAt).toLocaleDateString('de-DE')}</p>
            </div>
            {request.processedBy && (
              <>
                <div>
                  <label className="block text-slate-400">Bearbeitet von</label>
                  <p className="text-white">{request.processedBy.displayName}</p>
                </div>
                <div>
                  <label className="block text-slate-400">Bearbeitet am</label>
                  <p className="text-white">
                    {request.processedAt ? new Date(request.processedAt).toLocaleDateString('de-DE') : '-'}
                  </p>
                </div>
              </>
            )}
          </div>

          {request.rejectionReason && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-red-400 mb-1">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Ablehnungsgrund</span>
              </div>
              <p className="text-slate-300">{request.rejectionReason}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="btn-secondary">
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

// Process Modal
function ProcessModal({
  request,
  onClose,
  onProcess,
  isLoading,
}: {
  request: UprankRequest;
  onClose: () => void;
  onProcess: (data: { status: 'APPROVED' | 'REJECTED'; rejectionReason?: string }) => void;
  isLoading: boolean;
}) {
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | ''>('');
  const [rejectionReason, setRejectionReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision) return;
    onProcess({
      status: decision,
      rejectionReason: decision === 'REJECTED' ? rejectionReason : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg">
        <h2 className="text-xl font-bold text-white mb-4">Antrag bearbeiten</h2>

        <div className="p-4 bg-slate-700/50 rounded-lg mb-4">
          <p className="font-medium text-white">{request.employee.user.displayName}</p>
          <div className="flex items-center gap-2 text-sm mt-1">
            <span className="text-slate-400">{request.currentRank}</span>
            <ChevronUp className="h-4 w-4 text-green-400" />
            <span className="text-green-400">{request.targetRank}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Entscheidung</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setDecision('APPROVED')}
                className={clsx(
                  'flex-1 p-4 rounded-lg border-2 transition-colors',
                  decision === 'APPROVED'
                    ? 'border-green-500 bg-green-500/20'
                    : 'border-slate-600 hover:border-slate-500'
                )}
              >
                <CheckCircle className={clsx('h-6 w-6 mx-auto mb-2', decision === 'APPROVED' ? 'text-green-400' : 'text-slate-400')} />
                <p className={clsx('font-medium', decision === 'APPROVED' ? 'text-green-400' : 'text-slate-300')}>Genehmigen</p>
              </button>
              <button
                type="button"
                onClick={() => setDecision('REJECTED')}
                className={clsx(
                  'flex-1 p-4 rounded-lg border-2 transition-colors',
                  decision === 'REJECTED'
                    ? 'border-red-500 bg-red-500/20'
                    : 'border-slate-600 hover:border-slate-500'
                )}
              >
                <XCircle className={clsx('h-6 w-6 mx-auto mb-2', decision === 'REJECTED' ? 'text-red-400' : 'text-slate-400')} />
                <p className={clsx('font-medium', decision === 'REJECTED' ? 'text-red-400' : 'text-slate-300')}>Ablehnen</p>
              </button>
            </div>
          </div>

          {decision === 'REJECTED' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Ablehnungsgrund *</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="input w-full h-24"
                placeholder="Begründung für die Ablehnung..."
                required
              />
            </div>
          )}

          {decision === 'APPROVED' && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-sm text-green-400">
                Bei Genehmigung wird der Rang des Mitarbeiters automatisch auf "{request.targetRank}" aktualisiert.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isLoading || !decision || (decision === 'REJECTED' && !rejectionReason)}
              className={clsx(
                'px-4 py-2 rounded-lg font-medium transition-colors',
                decision === 'APPROVED' ? 'bg-green-600 hover:bg-green-700 text-white' : '',
                decision === 'REJECTED' ? 'bg-red-600 hover:bg-red-700 text-white' : '',
                !decision ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : ''
              )}
            >
              {isLoading ? 'Verarbeite...' : decision === 'APPROVED' ? 'Genehmigen' : decision === 'REJECTED' ? 'Ablehnen' : 'Entscheidung wählen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
