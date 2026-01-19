import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { investigationsApi, teamChangeReportsApi, employeesApi } from '../services/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { usePermissions } from '../hooks/usePermissions';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import {
  ShieldAlert,
  Plus,
  X,
  ChevronRight,
  AlertTriangle,
  FileText,
  Users,
  User,
  MessageSquare,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Lock,
  ArrowRightLeft,
  Eye,
  Archive,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  rank: string;
  user: { id: string; displayName: string | null; username: string };
}

interface InvestigationNote {
  id: string;
  content: string;
  isConfidential: boolean;
  createdAt: string;
  createdBy: { displayName: string | null; username: string };
}

interface InvestigationWitness {
  id: string;
  externalName: string | null;
  statement: string | null;
  interviewedAt: string | null;
  employee: Employee | null;
}

interface Investigation {
  id: string;
  caseNumber: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  complainant: string | null;
  findings: string | null;
  recommendation: string | null;
  closedAt: string | null;
  createdAt: string;
  accused: Employee | null;
  leadInvestigator: { id: string; displayName: string | null; username: string };
  notes?: InvestigationNote[];
  witnesses?: InvestigationWitness[];
  _count?: { notes: number; witnesses: number };
}

const statusLabels: Record<string, string> = {
  OPEN: 'Offen',
  IN_PROGRESS: 'In Bearbeitung',
  CLOSED: 'Abgeschlossen',
  ARCHIVED: 'Archiviert',
};

const statusColors: Record<string, string> = {
  OPEN: 'bg-blue-500/20 text-blue-400',
  IN_PROGRESS: 'bg-yellow-500/20 text-yellow-400',
  CLOSED: 'bg-green-500/20 text-green-400',
  ARCHIVED: 'bg-slate-500/20 text-slate-400',
};

const priorityLabels: Record<string, string> = {
  LOW: 'Niedrig',
  NORMAL: 'Normal',
  HIGH: 'Hoch',
  CRITICAL: 'Kritisch',
};

const priorityColors: Record<string, string> = {
  LOW: 'text-slate-400',
  NORMAL: 'text-blue-400',
  HIGH: 'text-orange-400',
  CRITICAL: 'text-red-400',
};

const categoryLabels: Record<string, string> = {
  BESCHWERDE: 'Beschwerde',
  DISZIPLINAR: 'Disziplinarverfahren',
  KORRUPTION: 'Korruption',
  SONSTIGES: 'Sonstiges',
};

// Teams für Dropdown
const AVAILABLE_TEAMS = [
  { value: 'White', label: 'Team White' },
  { value: 'Red', label: 'Team Red' },
  { value: 'Gold', label: 'Team Gold' },
  { value: 'Silver', label: 'Team Silver' },
  { value: 'Green', label: 'Team Green' },
  { value: 'Kein Team', label: 'Kein Team' },
];

interface TeamChangeReport {
  id: string;
  employeeId: string;
  previousTeam: string;
  newTeam: string;
  changeDate: string;
  uprankLockId: string | null;
  notes: string | null;
  status: 'PENDING' | 'REVIEWED' | 'ARCHIVED';
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  employee: {
    id: string;
    rank: string;
    badgeNumber: string | null;
    user: {
      displayName: string | null;
      username: string;
    };
  };
  reviewedBy: {
    displayName: string | null;
    username: string;
  } | null;
}

export default function InternalAffairs() {
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  useLiveUpdates(); // Live-Updates für Internal Affairs aktivieren
  const canManage = permissions.hasAnyPermission('ia.manage', 'admin.full');

  const [activeTab, setActiveTab] = useState<'investigations' | 'teamchanges'>('investigations');
  const [filter, setFilter] = useState<string>('all');
  const [teamChangeFilter, setTeamChangeFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateTeamChangeModal, setShowCreateTeamChangeModal] = useState(false);
  const [selectedInvestigation, setSelectedInvestigation] = useState<Investigation | null>(null);
  const [selectedTeamChange, setSelectedTeamChange] = useState<TeamChangeReport | null>(null);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showAddWitness, setShowAddWitness] = useState(false);
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

  // Queries
  const { data: stats } = useQuery({
    queryKey: ['investigations', 'stats'],
    queryFn: () => investigationsApi.getStats().then(res => res.data),
  });

  const { data: investigations = [], isLoading } = useQuery({
    queryKey: ['investigations', filter],
    queryFn: () => investigationsApi.getAll(filter !== 'all' ? { status: filter } : {}).then(res => res.data),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['investigation-employees'],
    queryFn: () => investigationsApi.getEmployees().then(res => res.data),
    enabled: showCreateModal || showAddWitness,
  });

  // Refetch single investigation when selected
  const { data: investigationDetail } = useQuery({
    queryKey: ['investigation', selectedInvestigation?.id],
    queryFn: () => investigationsApi.getById(selectedInvestigation!.id).then(res => res.data),
    enabled: !!selectedInvestigation,
  });

  // Team Change Reports Queries
  const { data: teamChangeStats } = useQuery({
    queryKey: ['team-change-reports', 'stats'],
    queryFn: () => teamChangeReportsApi.getStats().then(res => res.data),
  });

  const { data: teamChangeReports = [], isLoading: isLoadingTeamChanges } = useQuery({
    queryKey: ['team-change-reports', teamChangeFilter],
    queryFn: () => teamChangeReportsApi.getAll(teamChangeFilter !== 'all' ? { status: teamChangeFilter } : {}).then(res => res.data),
  });

  const { data: allEmployees = [], isLoading: isLoadingAllEmployees } = useQuery({
    queryKey: ['all-employees-for-teamchange'],
    queryFn: async () => {
      const res = await employeesApi.getAll();
      // API gibt { data: employees[], total, page, ... } zurück
      return res.data?.data || res.data || [];
    },
    enabled: showCreateTeamChangeModal,
  });

  // Mutations
  const createInvestigation = useMutation({
    mutationFn: investigationsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investigations'] });
      setShowCreateModal(false);
      toast.success('Ermittlung erstellt');
    },
  });

  const updateInvestigation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      investigationsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investigations'] });
      queryClient.invalidateQueries({ queryKey: ['investigation', selectedInvestigation?.id] });
      toast.success('Ermittlung aktualisiert');
    },
  });

  const deleteInvestigation = useMutation({
    mutationFn: investigationsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investigations'] });
      setSelectedInvestigation(null);
      toast.success('Ermittlung gelöscht');
    },
  });

  const addNote = useMutation({
    mutationFn: ({ investigationId, data }: { investigationId: string; data: { content: string; isConfidential?: boolean } }) =>
      investigationsApi.addNote(investigationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investigation', selectedInvestigation?.id] });
      setShowAddNote(false);
      toast.success('Notiz hinzugefügt');
    },
  });

  const deleteNote = useMutation({
    mutationFn: investigationsApi.deleteNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investigation', selectedInvestigation?.id] });
      toast.success('Notiz gelöscht');
    },
  });

  const addWitness = useMutation({
    mutationFn: ({ investigationId, data }: { investigationId: string; data: { employeeId?: string; externalName?: string; statement?: string } }) =>
      investigationsApi.addWitness(investigationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investigation', selectedInvestigation?.id] });
      setShowAddWitness(false);
      toast.success('Zeuge hinzugefügt');
    },
  });

  const deleteWitness = useMutation({
    mutationFn: investigationsApi.deleteWitness,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investigation', selectedInvestigation?.id] });
      toast.success('Zeuge entfernt');
    },
  });

  // Team Change Mutations
  const createTeamChangeReport = useMutation({
    mutationFn: teamChangeReportsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-change-reports'] });
      setShowCreateTeamChangeModal(false);
      toast.success('Teamwechsel-Bericht erstellt');
    },
  });

  const reviewTeamChangeReport = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: 'REVIEWED' | 'ARCHIVED'; reviewNotes?: string } }) =>
      teamChangeReportsApi.review(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-change-reports'] });
      setSelectedTeamChange(null);
      toast.success('Bericht aktualisiert');
    },
  });

  const deleteTeamChangeReport = useMutation({
    mutationFn: teamChangeReportsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-change-reports'] });
      setSelectedTeamChange(null);
      toast.success('Bericht gelöscht');
    },
  });

  const handleCreateInvestigation = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createInvestigation.mutate({
      title: formData.get('title') as string,
      description: formData.get('description') as string || undefined,
      priority: formData.get('priority') as string,
      category: formData.get('category') as string,
      accusedId: formData.get('accusedId') as string || undefined,
      complainant: formData.get('complainant') as string || undefined,
    });
  };

  const handleAddNote = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addNote.mutate({
      investigationId: selectedInvestigation!.id,
      data: {
        content: formData.get('content') as string,
        isConfidential: formData.get('isConfidential') === 'on',
      },
    });
  };

  const handleAddWitness = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const employeeId = formData.get('employeeId') as string;
    addWitness.mutate({
      investigationId: selectedInvestigation!.id,
      data: {
        employeeId: employeeId || undefined,
        externalName: !employeeId ? formData.get('externalName') as string : undefined,
        statement: formData.get('statement') as string || undefined,
      },
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const detail = investigationDetail || selectedInvestigation;

  return (
    <div className="space-y-6">
      {/* Header mit Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600/20 via-slate-800 to-orange-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/20 rounded-2xl backdrop-blur-sm border border-red-500/30 shadow-lg shadow-red-500/20">
              <ShieldAlert className="h-8 w-8 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Internal Affairs</h1>
              <p className="text-slate-400 mt-0.5">Interne Ermittlungen und Disziplinarverfahren</p>
            </div>
          </div>
          {canManage && (
            <button
              onClick={() => activeTab === 'investigations' ? setShowCreateModal(true) : setShowCreateTeamChangeModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {activeTab === 'investigations' ? 'Neue Ermittlung' : 'Neuer Teamwechsel'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('investigations')}
          className={clsx(
            'px-4 py-2 -mb-px transition-colors',
            activeTab === 'investigations'
              ? 'text-red-400 border-b-2 border-red-400'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Ermittlungen
          </div>
        </button>
        <button
          onClick={() => setActiveTab('teamchanges')}
          className={clsx(
            'px-4 py-2 -mb-px transition-colors',
            activeTab === 'teamchanges'
              ? 'text-red-400 border-b-2 border-red-400'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Teamwechsel-Berichte
            {teamChangeStats?.pending > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                {teamChangeStats.pending}
              </span>
            )}
          </div>
        </button>
      </div>

      {activeTab === 'investigations' && (
        <>
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4 bg-gradient-to-br from-slate-800/80 to-slate-900/80 hover:border-slate-600/50 transition-all group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-500/20 rounded-lg group-hover:scale-110 transition-transform">
                <FileText className="h-5 w-5 text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-sm text-slate-400">Gesamt</p>
              </div>
            </div>
          </div>
          <div className="card p-4 bg-gradient-to-br from-blue-900/30 to-slate-900/80 hover:border-blue-600/50 transition-all group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg group-hover:scale-110 transition-transform">
                <AlertTriangle className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400">{stats.open}</p>
                <p className="text-sm text-slate-400">Offen</p>
              </div>
            </div>
          </div>
          <div className="card p-4 bg-gradient-to-br from-yellow-900/30 to-slate-900/80 hover:border-yellow-600/50 transition-all group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg group-hover:scale-110 transition-transform">
                <Clock className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-400">{stats.inProgress}</p>
                <p className="text-sm text-slate-400">In Bearbeitung</p>
              </div>
            </div>
          </div>
          <div className="card p-4 bg-gradient-to-br from-green-900/30 to-slate-900/80 hover:border-green-600/50 transition-all group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg group-hover:scale-110 transition-transform">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">{stats.closed}</p>
                <p className="text-sm text-slate-400">Abgeschlossen</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'OPEN', 'IN_PROGRESS', 'CLOSED', 'ARCHIVED'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={clsx(
              'px-4 py-2 rounded-lg transition-colors',
              filter === status
                ? 'bg-red-500/20 text-red-400'
                : 'text-slate-400 hover:text-white'
            )}
          >
            {status === 'all' ? 'Alle' : statusLabels[status]}
          </button>
        ))}
      </div>

      {/* Investigations List */}
      <div className="card -mt-2">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : investigations.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            Keine Ermittlungen gefunden
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {investigations.map((inv: Investigation) => (
              <div
                key={inv.id}
                onClick={() => setSelectedInvestigation(inv)}
                className="p-4 hover:bg-slate-700/50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-500">{inv.caseNumber}</span>
                      <h3 className="font-medium text-white">{inv.title}</h3>
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs', statusColors[inv.status])}>
                        {statusLabels[inv.status]}
                      </span>
                      <span className={clsx('text-xs', priorityColors[inv.priority])}>
                        {priorityLabels[inv.priority]}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        {categoryLabels[inv.category]}
                      </span>
                      {inv.accused && (
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {inv.accused.user.displayName || inv.accused.user.username}
                        </span>
                      )}
                      <span>{formatDate(inv.createdAt)}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-500" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}

      {/* Team Changes Tab */}
      {activeTab === 'teamchanges' && (
        <>
          {/* Team Change Stats */}
          {teamChangeStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card p-4 bg-gradient-to-br from-slate-800/80 to-slate-900/80 hover:border-slate-600/50 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-500/20 rounded-lg group-hover:scale-110 transition-transform">
                    <ArrowRightLeft className="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{teamChangeStats.total}</p>
                    <p className="text-sm text-slate-400">Gesamt</p>
                  </div>
                </div>
              </div>
              <div className="card p-4 bg-gradient-to-br from-yellow-900/30 to-slate-900/80 hover:border-yellow-600/50 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg group-hover:scale-110 transition-transform">
                    <Clock className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-400">{teamChangeStats.pending}</p>
                    <p className="text-sm text-slate-400">Ausstehend</p>
                  </div>
                </div>
              </div>
              <div className="card p-4 bg-gradient-to-br from-green-900/30 to-slate-900/80 hover:border-green-600/50 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg group-hover:scale-110 transition-transform">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-400">{teamChangeStats.reviewed}</p>
                    <p className="text-sm text-slate-400">Geprüft</p>
                  </div>
                </div>
              </div>
              <div className="card p-4 bg-gradient-to-br from-blue-900/30 to-slate-900/80 hover:border-blue-600/50 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg group-hover:scale-110 transition-transform">
                    <Archive className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-400">{teamChangeStats.thisMonth}</p>
                    <p className="text-sm text-slate-400">Diesen Monat</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Team Change Filter */}
          <div className="flex gap-2">
            {['all', 'PENDING', 'REVIEWED', 'ARCHIVED'].map((status) => (
              <button
                key={status}
                onClick={() => setTeamChangeFilter(status)}
                className={clsx(
                  'px-4 py-2 rounded-lg transition-colors',
                  teamChangeFilter === status
                    ? 'bg-red-500/20 text-red-400'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                {status === 'all' ? 'Alle' : status === 'PENDING' ? 'Ausstehend' : status === 'REVIEWED' ? 'Geprüft' : 'Archiviert'}
              </button>
            ))}
          </div>

          {/* Team Change Reports List */}
          <div className="card">
            {isLoadingTeamChanges ? (
              <div className="p-8 text-center">
                <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : teamChangeReports.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                Keine Teamwechsel-Berichte gefunden
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {teamChangeReports.map((report: TeamChangeReport) => (
                  <div
                    key={report.id}
                    onClick={() => setSelectedTeamChange(report)}
                    className="p-4 hover:bg-slate-700/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-white">
                            {report.employee.user.displayName || report.employee.user.username}
                          </span>
                          <span className={clsx(
                            'px-2 py-0.5 rounded-full text-xs',
                            report.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                            report.status === 'REVIEWED' ? 'bg-green-500/20 text-green-400' :
                            'bg-slate-500/20 text-slate-400'
                          )}>
                            {report.status === 'PENDING' ? 'Ausstehend' : report.status === 'REVIEWED' ? 'Geprüft' : 'Archiviert'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          <span className="text-slate-400">{report.previousTeam}</span>
                          <ArrowRightLeft className="h-4 w-4 text-red-400" />
                          <span className="text-red-400 font-medium">{report.newTeam}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                          <span>{report.employee.rank}</span>
                          {report.employee.badgeNumber && <span>#{report.employee.badgeNumber}</span>}
                          <span>{formatDate(report.changeDate)}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Team Change Modal */}
      {showCreateTeamChangeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Neuer Teamwechsel-Bericht</h2>
              <button onClick={() => setShowCreateTeamChangeModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createTeamChangeReport.mutate({
                  employeeId: formData.get('employeeId') as string,
                  previousTeam: formData.get('previousTeam') as string,
                  newTeam: formData.get('newTeam') as string,
                  notes: formData.get('notes') as string || undefined,
                });
              }}
              className="p-4 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Mitarbeiter *</label>
                {isLoadingAllEmployees ? (
                  <div className="input w-full flex items-center justify-center">
                    <div className="animate-spin h-5 w-5 border-2 border-red-500 border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <select name="employeeId" required className="input w-full">
                    <option value="">Auswählen...</option>
                    {Array.isArray(allEmployees) && allEmployees.map((emp: Employee) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.user?.displayName || emp.user?.username || 'Unbekannt'} ({emp.rank || 'N/A'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Vorheriges Team *</label>
                  <select name="previousTeam" required className="input w-full">
                    <option value="">Auswählen...</option>
                    {AVAILABLE_TEAMS.map((team) => (
                      <option key={team.value} value={team.value}>{team.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Neues Team *</label>
                  <select name="newTeam" required className="input w-full">
                    <option value="">Auswählen...</option>
                    {AVAILABLE_TEAMS.map((team) => (
                      <option key={team.value} value={team.value}>{team.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notizen</label>
                <textarea name="notes" rows={3} className="input w-full" placeholder="Grund für den Wechsel, besondere Umstände..." />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateTeamChangeModal(false)} className="btn-secondary">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary" disabled={createTeamChangeReport.isPending}>
                  {createTeamChangeReport.isPending ? 'Erstelle...' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Change Detail Modal */}
      {selectedTeamChange && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Teamwechsel-Bericht</h2>
                <p className="text-sm text-slate-400">
                  {selectedTeamChange.employee.user.displayName || selectedTeamChange.employee.user.username}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx(
                  'px-2 py-1 rounded-full text-xs',
                  selectedTeamChange.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                  selectedTeamChange.status === 'REVIEWED' ? 'bg-green-500/20 text-green-400' :
                  'bg-slate-500/20 text-slate-400'
                )}>
                  {selectedTeamChange.status === 'PENDING' ? 'Ausstehend' : selectedTeamChange.status === 'REVIEWED' ? 'Geprüft' : 'Archiviert'}
                </span>
                <button onClick={() => setSelectedTeamChange(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {/* Employee Info */}
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center">
                    <User className="h-6 w-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {selectedTeamChange.employee.user.displayName || selectedTeamChange.employee.user.username}
                    </p>
                    <p className="text-sm text-slate-400">
                      {selectedTeamChange.employee.rank}
                      {selectedTeamChange.employee.badgeNumber && ` • #${selectedTeamChange.employee.badgeNumber}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Team Change */}
              <div className="p-4 bg-slate-700/30 rounded-lg">
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="text-sm text-slate-400">Vorher</p>
                    <p className="text-lg font-medium text-white">{selectedTeamChange.previousTeam}</p>
                  </div>
                  <ArrowRightLeft className="h-6 w-6 text-red-400" />
                  <div className="text-center">
                    <p className="text-sm text-slate-400">Nachher</p>
                    <p className="text-lg font-medium text-red-400">{selectedTeamChange.newTeam}</p>
                  </div>
                </div>
                <p className="text-center text-sm text-slate-500 mt-2">
                  Wechsel am {formatDate(selectedTeamChange.changeDate)}
                </p>
              </div>

              {/* Notes */}
              {selectedTeamChange.notes && (
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-1">Notizen zum Wechsel</h3>
                  <p className="text-slate-400 bg-slate-700/30 p-3 rounded-lg">{selectedTeamChange.notes}</p>
                </div>
              )}

              {/* Review Notes */}
              {selectedTeamChange.reviewNotes && (
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-1">IA-Bewertung</h3>
                  <p className="text-slate-400 bg-slate-700/30 p-3 rounded-lg">{selectedTeamChange.reviewNotes}</p>
                  {selectedTeamChange.reviewedBy && (
                    <p className="text-xs text-slate-500 mt-1">
                      Geprüft von {selectedTeamChange.reviewedBy.displayName || selectedTeamChange.reviewedBy.username} am {formatDate(selectedTeamChange.reviewedAt!)}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              {canManage && selectedTeamChange.status === 'PENDING' && (
                <div className="space-y-3 pt-4 border-t border-slate-700">
                  <h3 className="text-sm font-medium text-slate-300">Bericht prüfen</h3>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const status = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('data-status') as 'REVIEWED' | 'ARCHIVED';
                      reviewTeamChangeReport.mutate({
                        id: selectedTeamChange.id,
                        data: {
                          status,
                          reviewNotes: formData.get('reviewNotes') as string || undefined,
                        },
                      });
                    }}
                    className="space-y-3"
                  >
                    <textarea
                      name="reviewNotes"
                      rows={2}
                      className="input w-full"
                      placeholder="Bewertung/Anmerkungen (optional)"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        data-status="REVIEWED"
                        className="flex-1 btn-primary flex items-center justify-center gap-2"
                        disabled={reviewTeamChangeReport.isPending}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Als geprüft markieren
                      </button>
                      <button
                        type="submit"
                        data-status="ARCHIVED"
                        className="btn-secondary flex items-center gap-2"
                        disabled={reviewTeamChangeReport.isPending}
                      >
                        <Archive className="h-4 w-4" />
                        Archivieren
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Delete */}
              {canManage && (
                <div className="pt-4 border-t border-slate-700">
                  <button
                    onClick={() => setConfirmDialog({
                      isOpen: true,
                      title: 'Bericht löschen',
                      message: 'Möchtest du diesen Teamwechsel-Bericht wirklich löschen?',
                      confirmText: 'Löschen',
                      variant: 'danger',
                      onConfirm: () => deleteTeamChangeReport.mutate(selectedTeamChange.id),
                    })}
                    className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    Bericht löschen
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Neue Ermittlung</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateInvestigation} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Titel *</label>
                <input type="text" name="title" required className="input w-full" placeholder="Betreff der Ermittlung" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Beschreibung</label>
                <textarea name="description" rows={3} className="input w-full" placeholder="Details zur Ermittlung..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Kategorie</label>
                  <select name="category" className="input w-full">
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Priorität</label>
                  <select name="priority" className="input w-full">
                    {Object.entries(priorityLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Beschuldigter Mitarbeiter</label>
                <select name="accusedId" className="input w-full">
                  <option value="">Kein Mitarbeiter ausgewählt</option>
                  {employees.map((emp: Employee) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user.displayName || emp.user.username} ({emp.rank})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Beschwerdeführer (extern)</label>
                <input type="text" name="complainant" className="input w-full" placeholder="Name des Beschwerdeführers" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary" disabled={createInvestigation.isPending}>
                  {createInvestigation.isPending ? 'Erstelle...' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedInvestigation && detail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800/95 backdrop-blur-xl rounded-t-2xl">
              <div>
                <p className="text-xs font-mono text-slate-500">{detail.caseNumber}</p>
                <h2 className="text-lg font-semibold text-white">{detail.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx('px-3 py-1 rounded-full text-sm', statusColors[detail.status])}>
                  {statusLabels[detail.status]}
                </span>
                <button onClick={() => setSelectedInvestigation(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-6">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-400">Kategorie</p>
                  <p className="text-white">{categoryLabels[detail.category]}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Priorität</p>
                  <p className={priorityColors[detail.priority]}>{priorityLabels[detail.priority]}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Ermittlungsleiter</p>
                  <p className="text-white">{detail.leadInvestigator.displayName || detail.leadInvestigator.username}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Erstellt</p>
                  <p className="text-white">{formatDate(detail.createdAt)}</p>
                </div>
                {detail.accused && (
                  <div>
                    <p className="text-sm text-slate-400">Beschuldigter</p>
                    <p className="text-white">{detail.accused.user.displayName || detail.accused.user.username}</p>
                  </div>
                )}
                {detail.complainant && (
                  <div>
                    <p className="text-sm text-slate-400">Beschwerdeführer</p>
                    <p className="text-white">{detail.complainant}</p>
                  </div>
                )}
              </div>

              {detail.description && (
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-1">Beschreibung</h3>
                  <p className="text-slate-400">{detail.description}</p>
                </div>
              )}

              {/* Status Change */}
              {canManage && detail.status !== 'ARCHIVED' && (
                <div className="flex gap-2 flex-wrap">
                  {detail.status === 'OPEN' && (
                    <button
                      onClick={() => updateInvestigation.mutate({ id: detail.id, data: { status: 'IN_PROGRESS' } })}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Clock className="h-4 w-4" />
                      Ermittlung starten
                    </button>
                  )}
                  {detail.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => updateInvestigation.mutate({ id: detail.id, data: { status: 'CLOSED' } })}
                      className="btn-primary flex items-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Abschließen
                    </button>
                  )}
                  {/* Archivieren-Button für alle Status außer ARCHIVED */}
                  <button
                    onClick={() => updateInvestigation.mutate({ id: detail.id, data: { status: 'ARCHIVED' } })}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Archivieren
                  </button>
                </div>
              )}

              {/* Findings & Recommendation */}
              {(detail.status === 'IN_PROGRESS' || detail.status === 'CLOSED') && canManage && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Ermittlungsergebnisse</label>
                    <textarea
                      defaultValue={detail.findings || ''}
                      onBlur={(e) => {
                        if (e.target.value !== detail.findings) {
                          updateInvestigation.mutate({ id: detail.id, data: { findings: e.target.value } });
                        }
                      }}
                      rows={3}
                      className="input w-full"
                      placeholder="Zusammenfassung der Ermittlungsergebnisse..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Empfehlung</label>
                    <textarea
                      defaultValue={detail.recommendation || ''}
                      onBlur={(e) => {
                        if (e.target.value !== detail.recommendation) {
                          updateInvestigation.mutate({ id: detail.id, data: { recommendation: e.target.value } });
                        }
                      }}
                      rows={2}
                      className="input w-full"
                      placeholder="z.B. Keine Maßnahme, Verwarnung, Suspendierung..."
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Notizen ({detail.notes?.length || 0})
                  </h3>
                  {canManage && (
                    <button
                      onClick={() => setShowAddNote(true)}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      + Notiz
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {detail.notes?.map((note) => (
                    <div key={note.id} className="bg-slate-700/50 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white">
                              {note.createdBy.displayName || note.createdBy.username}
                            </span>
                            {note.isConfidential && (
                              <span className="flex items-center gap-1 text-xs text-red-400">
                                <Lock className="h-3 w-3" />
                                Vertraulich
                              </span>
                            )}
                            <span className="text-xs text-slate-500">{formatDate(note.createdAt)}</span>
                          </div>
                          <p className="text-slate-300">{note.content}</p>
                        </div>
                        {canManage && (
                          <button
                            onClick={() => deleteNote.mutate(note.id)}
                            className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!detail.notes || detail.notes.length === 0) && (
                    <p className="text-slate-500 text-center py-4">Keine Notizen</p>
                  )}
                </div>
              </div>

              {/* Witnesses */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Zeugen ({detail.witnesses?.length || 0})
                  </h3>
                  {canManage && (
                    <button
                      onClick={() => setShowAddWitness(true)}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      + Zeuge
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {detail.witnesses?.map((witness) => (
                    <div key={witness.id} className="bg-slate-700/50 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-white">
                              {witness.employee
                                ? witness.employee.user.displayName || witness.employee.user.username
                                : witness.externalName}
                            </span>
                            {witness.employee && (
                              <span className="text-xs text-slate-500">({witness.employee.rank})</span>
                            )}
                            {!witness.employee && (
                              <span className="text-xs text-slate-500">(Extern)</span>
                            )}
                            {witness.interviewedAt && (
                              <span className="text-xs text-green-400">Befragt</span>
                            )}
                          </div>
                          {witness.statement && (
                            <p className="text-slate-300 text-sm">{witness.statement}</p>
                          )}
                        </div>
                        {canManage && (
                          <button
                            onClick={() => deleteWitness.mutate(witness.id)}
                            className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!detail.witnesses || detail.witnesses.length === 0) && (
                    <p className="text-slate-500 text-center py-4">Keine Zeugen</p>
                  )}
                </div>
              </div>

              {/* Delete */}
              {canManage && (
                <div className="pt-4 border-t border-slate-700">
                  <button
                    onClick={() => setConfirmDialog({
                      isOpen: true,
                      title: 'Ermittlung löschen',
                      message: 'Möchtest du diese Ermittlung wirklich löschen? Dies kann nicht rückgängig gemacht werden.',
                      confirmText: 'Löschen',
                      variant: 'danger',
                      onConfirm: () => deleteInvestigation.mutate(detail.id),
                    })}
                    className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    Ermittlung löschen
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showAddNote && selectedInvestigation && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl max-w-md w-full border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Notiz hinzufügen</h2>
              <button onClick={() => setShowAddNote(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddNote} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Inhalt *</label>
                <textarea name="content" required rows={4} className="input w-full" placeholder="Notiz zur Ermittlung..." />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="isConfidential" id="isConfidential" className="rounded" />
                <label htmlFor="isConfidential" className="text-sm text-slate-300 flex items-center gap-1">
                  <Lock className="h-4 w-4" />
                  Vertraulich (nur für IA sichtbar)
                </label>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddNote(false)} className="btn-secondary">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary" disabled={addNote.isPending}>
                  {addNote.isPending ? 'Speichere...' : 'Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Witness Modal */}
      {showAddWitness && selectedInvestigation && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl max-w-md w-full border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Zeuge hinzufügen</h2>
              <button onClick={() => setShowAddWitness(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddWitness} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Mitarbeiter</label>
                <select name="employeeId" className="input w-full">
                  <option value="">Externer Zeuge</option>
                  {employees.map((emp: Employee) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user.displayName || emp.user.username} ({emp.rank})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Externer Name (falls kein Mitarbeiter)</label>
                <input type="text" name="externalName" className="input w-full" placeholder="Name des externen Zeugen" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Aussage</label>
                <textarea name="statement" rows={3} className="input w-full" placeholder="Zeugenaussage..." />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddWitness(false)} className="btn-secondary">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary" disabled={addWitness.isPending}>
                  {addWitness.isPending ? 'Speichere...' : 'Speichern'}
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
