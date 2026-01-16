import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { uprankRequestsApi, uprankLockApi, employeesApi } from '../services/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';
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
  Unlock,
  User,
  ChevronUp,
  Users,
  X,
  RefreshCw,
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
    avatar?: string | null;
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

interface UprankLock {
  id: string;
  reason: string;
  team: string;
  lockedUntil: string;
  isActive: boolean;
  createdAt: string;
  employee: {
    id: string;
    rank: string;
    user: {
      displayName: string | null;
      username: string;
      avatar: string | null;
    };
  };
  createdBy: {
    displayName: string | null;
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
  'Lieutenant I',
  'Lieutenant II',
  'Captain',
  'Commander',
  'Deputy Chief',
  'Assistant Chief',
  'Chief of Police',
];

export default function Teamleitung() {
  const queryClient = useQueryClient();
  const permissions = usePermissions();

  // Tab State
  const [activeTab, setActiveTab] = useState<'requests' | 'locks'>('requests');

  // Request State
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<UprankRequest | null>(null);
  const [showProcessModal, setShowProcessModal] = useState(false);

  // Lock State
  const [showLockModal, setShowLockModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [lockReason, setLockReason] = useState('');
  const [lockedUntil, setLockedUntil] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    variant: 'danger' | 'warning' | 'info' | 'success';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Löschen',
    variant: 'danger',
    onConfirm: () => {},
  });

  const canManage = permissions.hasAnyPermission('teamlead.manage', 'admin.full');
  const canProcess = permissions.hasAnyPermission('management.uprank', 'admin.full');
  const canManageLocks = permissions.hasAnyPermission('uprank.manage', 'admin.full');

  // Request Queries
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

  // Lock Queries
  const { data: lockStats } = useQuery({
    queryKey: ['uprank-lock-stats'],
    queryFn: () => uprankLockApi.getStats().then((r) => r.data),
  });

  const { data: locks = [], isLoading: locksLoading } = useQuery({
    queryKey: ['uprank-locks'],
    queryFn: () => uprankLockApi.getAll().then((r) => r.data),
  });

  const { data: allEmployeesData } = useQuery({
    queryKey: ['employees-for-locks'],
    queryFn: () => employeesApi.getAll({ limit: '1000' }).then((r) => r.data),
    enabled: showLockModal,
  });

  const allEmployees = (allEmployeesData?.data || []) as Employee[];

  // Request Mutations
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

  // Lock Mutations
  const createLockMutation = useMutation({
    mutationFn: uprankLockApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uprank-locks'] });
      queryClient.invalidateQueries({ queryKey: ['uprank-lock-stats'] });
      closeLockModal();
      toast.success('Uprank-Sperre erstellt');
    },
  });

  const createAutoLockMutation = useMutation({
    mutationFn: uprankLockApi.createAuto,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['uprank-locks'] });
      queryClient.invalidateQueries({ queryKey: ['uprank-lock-stats'] });
      closeLockModal();
      if (response.data.created) {
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
    },
  });

  const revokeLockMutation = useMutation({
    mutationFn: uprankLockApi.revoke,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uprank-locks'] });
      queryClient.invalidateQueries({ queryKey: ['uprank-lock-stats'] });
      toast.success('Uprank-Sperre aufgehoben');
    },
  });

  const deleteLockMutation = useMutation({
    mutationFn: uprankLockApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uprank-locks'] });
      queryClient.invalidateQueries({ queryKey: ['uprank-lock-stats'] });
      toast.success('Uprank-Sperre gelöscht');
    },
  });

  // Lock Modal Functions
  const openLockModal = () => {
    setSelectedEmployeeId('');
    setLockReason('');
    setLockedUntil('');
    setSelectedTeam('');
    setShowLockModal(true);
  };

  const closeLockModal = () => {
    setShowLockModal(false);
    setSelectedEmployeeId('');
    setLockReason('');
    setLockedUntil('');
    setSelectedTeam('');
  };

  const handleLockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTeam) {
      createAutoLockMutation.mutate({
        employeeId: selectedEmployeeId,
        team: selectedTeam,
      });
    } else {
      createLockMutation.mutate({
        employeeId: selectedEmployeeId,
        reason: lockReason,
        lockedUntil,
      });
    }
  };

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

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const getEmployeeName = (emp: { user: { displayName: string | null; username: string } }) =>
    emp.user.displayName || emp.user.username;

  return (
    <div className="space-y-6">
      {/* Header mit Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600/20 via-slate-800 to-amber-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-2xl backdrop-blur-sm border border-blue-500/30 shadow-lg shadow-blue-500/20">
              <TrendingUp className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Teamleitung</h1>
              <p className="text-slate-400 mt-0.5">Uprank-Anträge und Sperren verwalten</p>
            </div>
          </div>
          {activeTab === 'requests' && canManage && (
            <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Neuer Antrag
            </button>
          )}
          {activeTab === 'locks' && canManageLocks && (
            <button onClick={openLockModal} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Sperre erstellen
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === 'requests'
              ? 'text-blue-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Uprank-Anträge
            {stats && stats.pending > 0 && (
              <span className="px-2 py-0.5 text-xs bg-yellow-600/20 text-yellow-400 rounded-full">
                {stats.pending}
              </span>
            )}
          </div>
          {activeTab === 'requests' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('locks')}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === 'locks'
              ? 'text-amber-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Uprank-Sperren
            {lockStats && lockStats.active > 0 && (
              <span className="px-2 py-0.5 text-xs bg-amber-600/20 text-amber-400 rounded-full">
                {lockStats.active}
              </span>
            )}
          </div>
          {activeTab === 'locks' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
          )}
        </button>
      </div>

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4 bg-gradient-to-br from-blue-900/30 to-slate-900/80 hover:border-blue-600/50 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20 group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-400">{stats?.total || 0}</p>
                  <p className="text-sm text-slate-400">Gesamt</p>
                </div>
              </div>
            </div>
            <div className="card p-4 bg-gradient-to-br from-yellow-900/30 to-slate-900/80 hover:border-yellow-600/50 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/20 group-hover:scale-110 transition-transform">
                  <Clock className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-400">{stats?.pending || 0}</p>
                  <p className="text-sm text-slate-400">Ausstehend</p>
                </div>
              </div>
            </div>
            <div className="card p-4 bg-gradient-to-br from-green-900/30 to-slate-900/80 hover:border-green-600/50 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20 group-hover:scale-110 transition-transform">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-400">{stats?.approved || 0}</p>
                  <p className="text-sm text-slate-400">Genehmigt</p>
                </div>
              </div>
            </div>
            <div className="card p-4 bg-gradient-to-br from-red-900/30 to-slate-900/80 hover:border-red-600/50 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20 group-hover:scale-110 transition-transform">
                  <XCircle className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-400">{stats?.rejected || 0}</p>
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
                                onClick={() => setConfirmDialog({
                                  isOpen: true,
                                  title: 'Antrag löschen',
                                  message: 'Möchtest du diesen Uprank-Antrag wirklich löschen?',
                                  confirmText: 'Löschen',
                                  variant: 'danger',
                                  onConfirm: () => deleteMutation.mutate(request.id),
                                })}
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
        </>
      )}

      {/* Locks Tab */}
      {activeTab === 'locks' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 bg-gradient-to-br from-amber-900/20 to-slate-800/50 border-amber-700/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-600/20 rounded-xl">
                  <Lock className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-400">{lockStats?.active || 0}</p>
                  <p className="text-sm text-slate-400">Aktive Sperren</p>
                </div>
              </div>
            </div>
            <div className="card p-5 bg-gradient-to-br from-slate-800/50 to-slate-800/50 border-slate-700/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-600/20 rounded-xl">
                  <Clock className="h-6 w-6 text-slate-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{lockStats?.expired || 0}</p>
                  <p className="text-sm text-slate-400">Abgelaufen</p>
                </div>
              </div>
            </div>
            <div className="card p-5 bg-gradient-to-br from-blue-900/20 to-slate-800/50 border-blue-700/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600/20 rounded-xl">
                  <Users className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-400">{lockStats?.total || 0}</p>
                  <p className="text-sm text-slate-400">Gesamt</p>
                </div>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="card p-4 bg-amber-900/10 border-amber-700/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
              <div className="text-sm">
                <p className="text-amber-400 font-medium mb-1">Automatische Uprank-Sperren</p>
                <ul className="text-slate-400 space-y-1">
                  <li>Team Green: 1 Woche Sperre</li>
                  <li>Team Silver: 2 Wochen Sperre</li>
                  <li>Team Gold: 4 Wochen Sperre</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Locks Card */}
          <div className="card">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-white">Aktive Uprank-Sperren</h2>
            </div>
            <div className="divide-y divide-slate-700">
              {locksLoading ? (
                <div className="p-12 text-center">
                  <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto" />
                </div>
              ) : locks.length === 0 ? (
                <div className="p-12 text-center">
                  <Lock className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Keine aktiven Uprank-Sperren</p>
                </div>
              ) : (
                locks.map((lock: UprankLock) => {
                  const expired = new Date(lock.lockedUntil) < new Date();
                  return (
                    <div key={lock.id} className="p-4 hover:bg-slate-750 transition-colors">
                      <div className="flex items-center gap-4">
                        <img
                          src={
                            lock.employee.user.avatar ||
                            `https://ui-avatars.com/api/?name=${getEmployeeName(lock.employee)}&size=40&background=334155&color=fff`
                          }
                          className="h-10 w-10 rounded-full"
                          alt=""
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-white">
                              {getEmployeeName(lock.employee)}
                            </span>
                            <span className="text-xs text-slate-500">({lock.employee.rank})</span>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              lock.team === 'Team Green' ? 'bg-green-600/20 text-green-400' :
                              lock.team === 'Team Silver' ? 'bg-slate-600/20 text-slate-300' :
                              lock.team === 'Team Gold' ? 'bg-amber-600/20 text-amber-400' :
                              'bg-blue-600/20 text-blue-400'
                            }`}>
                              {lock.team}
                            </span>
                            {expired && (
                              <span className="px-2 py-0.5 text-xs bg-green-600/20 text-green-400 rounded-full">
                                Abgelaufen
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-400">{lock.reason}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            Gesperrt bis {formatDate(lock.lockedUntil)} | Erstellt von {lock.createdBy.displayName || lock.createdBy.username}
                          </p>
                        </div>
                        {canManageLocks && (
                          <div className="flex items-center gap-2">
                            {!expired && lock.isActive && (
                              <button
                                onClick={() => setConfirmDialog({
                                  isOpen: true,
                                  title: 'Sperre aufheben',
                                  message: 'Möchtest du diese Uprank-Sperre wirklich aufheben?',
                                  confirmText: 'Aufheben',
                                  variant: 'warning',
                                  onConfirm: () => revokeLockMutation.mutate(lock.id),
                                })}
                                className="p-2 text-green-400 hover:bg-green-600/20 rounded-lg transition-colors"
                                title="Sperre aufheben"
                              >
                                <Unlock className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => setConfirmDialog({
                                isOpen: true,
                                title: 'Sperre löschen',
                                message: 'Möchtest du diese Uprank-Sperre wirklich löschen?',
                                confirmText: 'Löschen',
                                variant: 'danger',
                                onConfirm: () => deleteLockMutation.mutate(lock.id),
                              })}
                              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Request Modal */}
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

      {/* Lock Modal */}
      {showLockModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl w-full max-w-md border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Uprank-Sperre erstellen</h2>
              <button onClick={closeLockModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleLockSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Mitarbeiter *</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="input w-full"
                  required
                >
                  <option value="">Mitarbeiter auswählen...</option>
                  {allEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.rank} - {emp.user.displayName || emp.user.username}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Team (für automatische Sperre)</label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="input w-full"
                >
                  <option value="">Manuell festlegen...</option>
                  <option value="Team Green">Team Green (1 Woche)</option>
                  <option value="Team Silver">Team Silver (2 Wochen)</option>
                  <option value="Team Gold">Team Gold (4 Wochen)</option>
                </select>
              </div>

              {!selectedTeam && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Grund *</label>
                    <textarea
                      value={lockReason}
                      onChange={(e) => setLockReason(e.target.value)}
                      className="input w-full min-h-[80px]"
                      placeholder="Grund für die Sperre"
                      required={!selectedTeam}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Gesperrt bis *</label>
                    <input
                      type="date"
                      value={lockedUntil}
                      onChange={(e) => setLockedUntil(e.target.value)}
                      className="input w-full"
                      min={new Date().toISOString().split('T')[0]}
                      required={!selectedTeam}
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeLockModal} className="btn-secondary">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary">
                  Sperre erstellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
      />
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-lg border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
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
