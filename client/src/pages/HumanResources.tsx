import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blacklistApi, uprankLockApi, employeesApi, applicationApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  X,
  Ban,
  Lock,
  Unlock,
  RefreshCw,
  Trash2,
  Clock,
  AlertTriangle,
  Users,
  Search,
  Calendar,
  Edit2,
  UserPlus,
  CheckCircle,
  XCircle,
  MessageSquare,
  FileText,
  Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface BlacklistEntry {
  id: string;
  discordId: string;
  username: string;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
  addedBy: {
    displayName: string | null;
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

interface Employee {
  id: string;
  rank: string;
  user: {
    displayName: string | null;
    username: string;
    avatar: string | null;
  };
}

interface Application {
  id: string;
  discordId: string;
  discordUsername: string;
  status: 'PENDING' | 'INTERVIEW' | 'ACCEPTED' | 'REJECTED';
  notes: string | null;
  interviewDate: string | null;
  interviewNotes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  processedAt: string | null;
  createdBy: {
    displayName: string | null;
    username: string;
  };
  processedBy: {
    displayName: string | null;
    username: string;
  } | null;
}

type Tab = 'applications' | 'blacklist' | 'uprank';

export default function HumanResources() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('applications');

  // Blacklist State
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [editingBlacklist, setEditingBlacklist] = useState<BlacklistEntry | null>(null);
  const [discordId, setDiscordId] = useState('');
  const [username, setUsername] = useState('');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  // Uprank Lock State
  const [showUprankModal, setShowUprankModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [uprankReason, setUprankReason] = useState('');
  const [lockedUntil, setLockedUntil] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');

  // Application State
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<string>('ALL');
  const [appDiscordId, setAppDiscordId] = useState('');
  const [appUsername, setAppUsername] = useState('');
  const [appNotes, setAppNotes] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewNotes, setInterviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [addToBlacklist, setAddToBlacklist] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [blacklistExpires, setBlacklistExpires] = useState('');

  // Queries
  const { data: blacklistData, isLoading: blacklistLoading } = useQuery({
    queryKey: ['blacklist'],
    queryFn: () => blacklistApi.getAll(),
  });

  const { data: blacklistStatsData } = useQuery({
    queryKey: ['blacklist-stats'],
    queryFn: () => blacklistApi.getStats(),
  });

  const { data: uprankLocksData, isLoading: uprankLoading } = useQuery({
    queryKey: ['uprank-locks'],
    queryFn: () => uprankLockApi.getAll(),
  });

  const { data: uprankStatsData } = useQuery({
    queryKey: ['uprank-stats'],
    queryFn: () => uprankLockApi.getStats(),
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => employeesApi.getAll().then(res => res.data),
  });

  const { data: applicationsData, isLoading: applicationsLoading } = useQuery({
    queryKey: ['applications', applicationStatus],
    queryFn: () => applicationApi.getAll(applicationStatus !== 'ALL' ? { status: applicationStatus } : undefined),
  });

  const { data: applicationStatsData } = useQuery({
    queryKey: ['application-stats'],
    queryFn: () => applicationApi.getStats(),
  });

  const blacklist = (blacklistData?.data || []) as BlacklistEntry[];
  const blacklistStats = blacklistStatsData?.data as { total: number; permanent: number; temporary: number } | undefined;
  const uprankLocks = (uprankLocksData?.data || []) as UprankLock[];
  const uprankStats = uprankStatsData?.data as { total: number; active: number; expired: number } | undefined;
  const employees = (employeesData?.data || []) as Employee[];
  const applications = (applicationsData?.data || []) as Application[];
  const applicationStats = applicationStatsData?.data as { pending: number; interview: number; accepted: number; rejected: number; total: number } | undefined;

  // Blacklist Mutations
  const createBlacklistMutation = useMutation({
    mutationFn: blacklistApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blacklist'] });
      queryClient.invalidateQueries({ queryKey: ['blacklist-stats'] });
      closeBlacklistModal();
      toast.success('Blacklist-Eintrag erstellt');
    },
  });

  const updateBlacklistMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { reason?: string; expiresAt?: string } }) =>
      blacklistApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blacklist'] });
      closeBlacklistModal();
      toast.success('Blacklist-Eintrag aktualisiert');
    },
  });

  const deleteBlacklistMutation = useMutation({
    mutationFn: blacklistApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blacklist'] });
      queryClient.invalidateQueries({ queryKey: ['blacklist-stats'] });
      toast.success('Blacklist-Eintrag entfernt');
    },
  });

  // Uprank Lock Mutations
  const createUprankLockMutation = useMutation({
    mutationFn: uprankLockApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uprank-locks'] });
      queryClient.invalidateQueries({ queryKey: ['uprank-stats'] });
      closeUprankModal();
      toast.success('Uprank-Sperre erstellt');
    },
  });

  const createAutoUprankLockMutation = useMutation({
    mutationFn: uprankLockApi.createAuto,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['uprank-locks'] });
      queryClient.invalidateQueries({ queryKey: ['uprank-stats'] });
      closeUprankModal();
      if (response.data.created) {
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
    },
  });

  const revokeUprankLockMutation = useMutation({
    mutationFn: uprankLockApi.revoke,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uprank-locks'] });
      queryClient.invalidateQueries({ queryKey: ['uprank-stats'] });
      toast.success('Uprank-Sperre aufgehoben');
    },
  });

  const deleteUprankLockMutation = useMutation({
    mutationFn: uprankLockApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uprank-locks'] });
      queryClient.invalidateQueries({ queryKey: ['uprank-stats'] });
      toast.success('Uprank-Sperre gelöscht');
    },
  });

  // Application Mutations
  const createApplicationMutation = useMutation({
    mutationFn: applicationApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-stats'] });
      closeApplicationModal();
      toast.success('Bewerbung erstellt');
    },
    onError: (error: { response?: { data?: { error?: string; message?: string } } }) => {
      if (error.response?.data?.error === 'BLACKLISTED') {
        toast.error(error.response.data.message || 'Bewerber ist auf der Blacklist');
      }
    },
  });

  const scheduleInterviewMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      applicationApi.scheduleInterview(id, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-stats'] });
      closeInterviewModal();
      toast.success('Gespräch geplant');
    },
  });

  const acceptApplicationMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      applicationApi.accept(id, notes),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-stats'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      closeAcceptModal();
      toast.success(response.data.message || 'Bewerbung angenommen');
    },
    onError: (error: { response?: { data?: { error?: string; message?: string } } }) => {
      if (error.response?.data?.error === 'BLACKLISTED') {
        toast.error(error.response.data.message || 'Bewerber ist auf der Blacklist');
      }
    },
  });

  const rejectApplicationMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { rejectionReason: string; addToBlacklist?: boolean; blacklistReason?: string; blacklistExpires?: string } }) =>
      applicationApi.reject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-stats'] });
      if (addToBlacklist) {
        queryClient.invalidateQueries({ queryKey: ['blacklist'] });
        queryClient.invalidateQueries({ queryKey: ['blacklist-stats'] });
      }
      closeRejectModal();
      toast.success('Bewerbung abgelehnt');
    },
  });

  const deleteApplicationMutation = useMutation({
    mutationFn: applicationApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-stats'] });
      toast.success('Bewerbung gelöscht');
    },
  });

  // Blacklist Modal
  const openBlacklistModal = (entry?: BlacklistEntry) => {
    if (entry) {
      setEditingBlacklist(entry);
      setDiscordId(entry.discordId);
      setUsername(entry.username);
      setReason(entry.reason);
      setExpiresAt(entry.expiresAt ? entry.expiresAt.split('T')[0] : '');
    } else {
      setEditingBlacklist(null);
      setDiscordId('');
      setUsername('');
      setReason('');
      setExpiresAt('');
    }
    setShowBlacklistModal(true);
  };

  const closeBlacklistModal = () => {
    setShowBlacklistModal(false);
    setEditingBlacklist(null);
    setDiscordId('');
    setUsername('');
    setReason('');
    setExpiresAt('');
  };

  const handleBlacklistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBlacklist) {
      updateBlacklistMutation.mutate({
        id: editingBlacklist.id,
        data: { reason, expiresAt: expiresAt || undefined },
      });
    } else {
      createBlacklistMutation.mutate({
        discordId,
        username,
        reason,
        expiresAt: expiresAt || undefined,
      });
    }
  };

  // Uprank Modal
  const openUprankModal = () => {
    setSelectedEmployeeId('');
    setUprankReason('');
    setLockedUntil('');
    setSelectedTeam('');
    setShowUprankModal(true);
  };

  const closeUprankModal = () => {
    setShowUprankModal(false);
    setSelectedEmployeeId('');
    setUprankReason('');
    setLockedUntil('');
    setSelectedTeam('');
  };

  const handleUprankSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTeam) {
      // Auto-Sperre basierend auf Team
      createAutoUprankLockMutation.mutate({
        employeeId: selectedEmployeeId,
        team: selectedTeam,
      });
    } else {
      // Manuelle Sperre
      createUprankLockMutation.mutate({
        employeeId: selectedEmployeeId,
        reason: uprankReason,
        lockedUntil,
      });
    }
  };

  // Application Modal Functions
  const openApplicationModal = () => {
    setAppDiscordId('');
    setAppUsername('');
    setAppNotes('');
    setShowApplicationModal(true);
  };

  const closeApplicationModal = () => {
    setShowApplicationModal(false);
    setAppDiscordId('');
    setAppUsername('');
    setAppNotes('');
  };

  const openInterviewModal = (app: Application) => {
    setSelectedApplication(app);
    setInterviewDate(app.interviewDate ? app.interviewDate.split('T')[0] : '');
    setShowInterviewModal(true);
  };

  const closeInterviewModal = () => {
    setShowInterviewModal(false);
    setSelectedApplication(null);
    setInterviewDate('');
  };

  const openAcceptModal = (app: Application) => {
    setSelectedApplication(app);
    setInterviewNotes(app.interviewNotes || '');
    setShowAcceptModal(true);
  };

  const closeAcceptModal = () => {
    setShowAcceptModal(false);
    setSelectedApplication(null);
    setInterviewNotes('');
  };

  const openRejectModal = (app: Application) => {
    setSelectedApplication(app);
    setRejectionReason('');
    setAddToBlacklist(false);
    setBlacklistReason('');
    setBlacklistExpires('');
    setShowRejectModal(true);
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setSelectedApplication(null);
    setRejectionReason('');
    setAddToBlacklist(false);
    setBlacklistReason('');
    setBlacklistExpires('');
  };

  const openDetailModal = (app: Application) => {
    setSelectedApplication(app);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedApplication(null);
  };

  const handleApplicationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createApplicationMutation.mutate({
      discordId: appDiscordId,
      discordUsername: appUsername,
      notes: appNotes || undefined,
    });
  };

  const handleInterviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedApplication) {
      scheduleInterviewMutation.mutate({
        id: selectedApplication.id,
        date: interviewDate,
      });
    }
  };

  const handleAcceptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedApplication) {
      acceptApplicationMutation.mutate({
        id: selectedApplication.id,
        notes: interviewNotes || undefined,
      });
    }
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedApplication) {
      rejectApplicationMutation.mutate({
        id: selectedApplication.id,
        data: {
          rejectionReason,
          addToBlacklist,
          blacklistReason: addToBlacklist ? (blacklistReason || rejectionReason) : undefined,
          blacklistExpires: addToBlacklist && blacklistExpires ? blacklistExpires : undefined,
        },
      });
    }
  };

  const getStatusBadge = (status: Application['status']) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2 py-0.5 text-xs bg-blue-600/20 text-blue-400 rounded-full">Offen</span>;
      case 'INTERVIEW':
        return <span className="px-2 py-0.5 text-xs bg-amber-600/20 text-amber-400 rounded-full">Gespräch</span>;
      case 'ACCEPTED':
        return <span className="px-2 py-0.5 text-xs bg-green-600/20 text-green-400 rounded-full">Angenommen</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 text-xs bg-red-600/20 text-red-400 rounded-full">Abgelehnt</span>;
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  const getEmployeeName = (emp: Employee) => emp.user.displayName || emp.user.username;

  // Permission checks
  const canManageBlacklist = user?.role?.permissions?.some(
    (p: { name: string }) => p.name === 'blacklist.manage' || p.name === 'admin.full'
  );

  const canManageUprank = user?.role?.permissions?.some(
    (p: { name: string }) => p.name === 'uprank.manage' || p.name === 'admin.full'
  );

  const canManageHR = user?.role?.permissions?.some(
    (p: { name: string }) => p.name === 'hr.manage' || p.name === 'admin.full'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Human Resources</h1>
          <p className="text-slate-400 mt-1">Blacklist & Uprank-Sperren verwalten</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('applications')}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === 'applications'
              ? 'text-green-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Bewerbungen
            {applicationStats && applicationStats.pending > 0 && (
              <span className="px-2 py-0.5 text-xs bg-green-600/20 text-green-400 rounded-full">
                {applicationStats.pending}
              </span>
            )}
          </div>
          {activeTab === 'applications' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('blacklist')}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === 'blacklist'
              ? 'text-red-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Ban className="h-4 w-4" />
            Blacklist
            {blacklistStats && (
              <span className="px-2 py-0.5 text-xs bg-red-600/20 text-red-400 rounded-full">
                {blacklistStats.total}
              </span>
            )}
          </div>
          {activeTab === 'blacklist' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('uprank')}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === 'uprank'
              ? 'text-amber-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Uprank-Sperren
            {uprankStats && (
              <span className="px-2 py-0.5 text-xs bg-amber-600/20 text-amber-400 rounded-full">
                {uprankStats.active}
              </span>
            )}
          </div>
          {activeTab === 'uprank' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
          )}
        </button>
      </div>

      {/* Applications Tab */}
      {activeTab === 'applications' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-5 bg-gradient-to-br from-blue-900/20 to-slate-800/50 border-blue-700/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600/20 rounded-xl">
                  <FileText className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-400">{applicationStats?.pending || 0}</p>
                  <p className="text-sm text-slate-400">Offen</p>
                </div>
              </div>
            </div>
            <div className="card p-5 bg-gradient-to-br from-amber-900/20 to-slate-800/50 border-amber-700/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-600/20 rounded-xl">
                  <MessageSquare className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-400">{applicationStats?.interview || 0}</p>
                  <p className="text-sm text-slate-400">Gespräch</p>
                </div>
              </div>
            </div>
            <div className="card p-5 bg-gradient-to-br from-green-900/20 to-slate-800/50 border-green-700/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-600/20 rounded-xl">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-400">{applicationStats?.accepted || 0}</p>
                  <p className="text-sm text-slate-400">Angenommen</p>
                </div>
              </div>
            </div>
            <div className="card p-5 bg-gradient-to-br from-red-900/20 to-slate-800/50 border-red-700/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-600/20 rounded-xl">
                  <XCircle className="h-6 w-6 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-400">{applicationStats?.rejected || 0}</p>
                  <p className="text-sm text-slate-400">Abgelehnt</p>
                </div>
              </div>
            </div>
          </div>

          {/* Applications Card */}
          <div className="card">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="font-semibold text-white">Bewerbungen</h2>
                <select
                  value={applicationStatus}
                  onChange={(e) => setApplicationStatus(e.target.value)}
                  className="input py-1 px-2 text-sm w-auto"
                >
                  <option value="ALL">Alle</option>
                  <option value="PENDING">Offen</option>
                  <option value="INTERVIEW">Gespräch geplant</option>
                  <option value="ACCEPTED">Angenommen</option>
                  <option value="REJECTED">Abgelehnt</option>
                </select>
              </div>
              {canManageHR && (
                <button onClick={openApplicationModal} className="btn-primary flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Neue Bewerbung
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-700">
              {applicationsLoading ? (
                <div className="p-12 text-center">
                  <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto" />
                </div>
              ) : applications.length === 0 ? (
                <div className="p-12 text-center">
                  <UserPlus className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Keine Bewerbungen vorhanden</p>
                </div>
              ) : (
                applications.map((app) => (
                  <div key={app.id} className="p-4 hover:bg-slate-750 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-600/20 rounded-xl">
                        <UserPlus className="h-5 w-5 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-white">{app.discordUsername}</span>
                          <span className="text-xs text-slate-500">({app.discordId})</span>
                          {getStatusBadge(app.status)}
                          {app.interviewDate && app.status === 'INTERVIEW' && (
                            <span className="flex items-center gap-1 text-xs text-amber-400">
                              <Calendar className="h-3 w-3" />
                              {formatDate(app.interviewDate)}
                            </span>
                          )}
                        </div>
                        {app.notes && (
                          <p className="text-sm text-slate-400 truncate">{app.notes}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          Erstellt von {app.createdBy.displayName || app.createdBy.username} am {formatDateTime(app.createdAt)}
                          {app.processedBy && (
                            <> | Bearbeitet von {app.processedBy.displayName || app.processedBy.username}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openDetailModal(app)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg transition-colors"
                          title="Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canManageHR && app.status === 'PENDING' && (
                          <button
                            onClick={() => openInterviewModal(app)}
                            className="p-2 text-amber-400 hover:bg-amber-600/20 rounded-lg transition-colors"
                            title="Gespräch planen"
                          >
                            <Calendar className="h-4 w-4" />
                          </button>
                        )}
                        {canManageHR && (app.status === 'PENDING' || app.status === 'INTERVIEW') && (
                          <>
                            <button
                              onClick={() => openAcceptModal(app)}
                              className="p-2 text-green-400 hover:bg-green-600/20 rounded-lg transition-colors"
                              title="Annehmen"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openRejectModal(app)}
                              className="p-2 text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                              title="Ablehnen"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {canManageHR && (
                          <button
                            onClick={() => {
                              if (confirm('Bewerbung wirklich löschen?')) {
                                deleteApplicationMutation.mutate(app.id);
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Blacklist Tab */}
      {activeTab === 'blacklist' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 bg-gradient-to-br from-red-900/20 to-slate-800/50 border-red-700/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-600/20 rounded-xl">
                  <Ban className="h-6 w-6 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-400">{blacklistStats?.total || 0}</p>
                  <p className="text-sm text-slate-400">Gesamt</p>
                </div>
              </div>
            </div>
            <div className="card p-5 bg-gradient-to-br from-slate-800/50 to-slate-800/50 border-slate-700/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-600/20 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-slate-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{blacklistStats?.permanent || 0}</p>
                  <p className="text-sm text-slate-400">Permanent</p>
                </div>
              </div>
            </div>
            <div className="card p-5 bg-gradient-to-br from-amber-900/20 to-slate-800/50 border-amber-700/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-600/20 rounded-xl">
                  <Clock className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-400">{blacklistStats?.temporary || 0}</p>
                  <p className="text-sm text-slate-400">Temporär</p>
                </div>
              </div>
            </div>
          </div>

          {/* Blacklist Card */}
          <div className="card">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-white">Blacklist-Einträge</h2>
              {canManageBlacklist && (
                <button onClick={() => openBlacklistModal()} className="btn-primary flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Hinzufügen
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-700">
              {blacklistLoading ? (
                <div className="p-12 text-center">
                  <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto" />
                </div>
              ) : blacklist.length === 0 ? (
                <div className="p-12 text-center">
                  <Ban className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Keine Blacklist-Einträge</p>
                </div>
              ) : (
                blacklist.map((entry) => (
                  <div key={entry.id} className="p-4 hover:bg-slate-750 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-red-600/20 rounded-xl">
                        <Ban className="h-5 w-5 text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-white">{entry.username}</span>
                          <span className="text-xs text-slate-500">({entry.discordId})</span>
                          {entry.expiresAt && (
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              isExpired(entry.expiresAt)
                                ? 'bg-green-600/20 text-green-400'
                                : 'bg-amber-600/20 text-amber-400'
                            }`}>
                              {isExpired(entry.expiresAt) ? 'Abgelaufen' : `Bis ${formatDate(entry.expiresAt)}`}
                            </span>
                          )}
                          {!entry.expiresAt && (
                            <span className="px-2 py-0.5 text-xs bg-red-600/20 text-red-400 rounded-full">
                              Permanent
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 truncate">{entry.reason}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Hinzugefügt von {entry.addedBy.displayName || entry.addedBy.username} am {formatDateTime(entry.createdAt)}
                        </p>
                      </div>
                      {canManageBlacklist && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openBlacklistModal(entry)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Eintrag wirklich löschen?')) {
                                deleteBlacklistMutation.mutate(entry.id);
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Uprank Tab */}
      {activeTab === 'uprank' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 bg-gradient-to-br from-amber-900/20 to-slate-800/50 border-amber-700/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-600/20 rounded-xl">
                  <Lock className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-400">{uprankStats?.active || 0}</p>
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
                  <p className="text-2xl font-bold text-white">{uprankStats?.expired || 0}</p>
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
                  <p className="text-2xl font-bold text-blue-400">{uprankStats?.total || 0}</p>
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

          {/* Uprank Locks Card */}
          <div className="card">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-white">Aktive Uprank-Sperren</h2>
              {canManageUprank && (
                <button onClick={openUprankModal} className="btn-primary flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Sperre erstellen
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-700">
              {uprankLoading ? (
                <div className="p-12 text-center">
                  <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto" />
                </div>
              ) : uprankLocks.length === 0 ? (
                <div className="p-12 text-center">
                  <Lock className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Keine aktiven Uprank-Sperren</p>
                </div>
              ) : (
                uprankLocks.map((lock) => {
                  const expired = new Date(lock.lockedUntil) < new Date();
                  return (
                    <div key={lock.id} className="p-4 hover:bg-slate-750 transition-colors">
                      <div className="flex items-center gap-4">
                        <img
                          src={
                            lock.employee.user.avatar ||
                            `https://ui-avatars.com/api/?name=${getEmployeeName(lock.employee as Employee)}&size=40&background=334155&color=fff`
                          }
                          className="h-10 w-10 rounded-full"
                          alt=""
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-white">
                              {getEmployeeName(lock.employee as Employee)}
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
                        {canManageUprank && (
                          <div className="flex items-center gap-2">
                            {!expired && lock.isActive && (
                              <button
                                onClick={() => {
                                  if (confirm('Sperre wirklich aufheben?')) {
                                    revokeUprankLockMutation.mutate(lock.id);
                                  }
                                }}
                                className="p-2 text-green-400 hover:bg-green-600/20 rounded-lg transition-colors"
                                title="Sperre aufheben"
                              >
                                <Unlock className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (confirm('Sperre wirklich löschen?')) {
                                  deleteUprankLockMutation.mutate(lock.id);
                                }
                              }}
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

      {/* Blacklist Modal */}
      {showBlacklistModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {editingBlacklist ? 'Blacklist bearbeiten' : 'Zur Blacklist hinzufügen'}
              </h2>
              <button onClick={closeBlacklistModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleBlacklistSubmit} className="p-6 space-y-5">
              {!editingBlacklist && (
                <>
                  <div>
                    <label className="label">Discord ID *</label>
                    <input
                      type="text"
                      value={discordId}
                      onChange={(e) => setDiscordId(e.target.value)}
                      className="input"
                      placeholder="z.B. 123456789012345678"
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Username *</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="input"
                      placeholder="Discord Username"
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <label className="label">Grund *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="Grund für die Blacklist"
                  required
                />
              </div>

              <div>
                <label className="label">Ablaufdatum (optional)</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="input"
                  min={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-slate-500 mt-1">Leer lassen für permanente Sperre</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeBlacklistModal} className="btn-ghost px-5">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary px-5">
                  {editingBlacklist ? 'Speichern' : 'Hinzufügen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Uprank Lock Modal */}
      {showUprankModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Uprank-Sperre erstellen</h2>
              <button onClick={closeUprankModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleUprankSubmit} className="p-6 space-y-5">
              <div>
                <label className="label">Mitarbeiter *</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Mitarbeiter auswählen...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.rank} - {getEmployeeName(emp)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Team (für automatische Sperre)</label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="input"
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
                    <label className="label">Grund *</label>
                    <textarea
                      value={uprankReason}
                      onChange={(e) => setUprankReason(e.target.value)}
                      className="input min-h-[80px]"
                      placeholder="Grund für die Sperre"
                      required={!selectedTeam}
                    />
                  </div>

                  <div>
                    <label className="label">Gesperrt bis *</label>
                    <input
                      type="date"
                      value={lockedUntil}
                      onChange={(e) => setLockedUntil(e.target.value)}
                      className="input"
                      min={new Date().toISOString().split('T')[0]}
                      required={!selectedTeam}
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeUprankModal} className="btn-ghost px-5">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary px-5">
                  Sperre erstellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Application Create Modal */}
      {showApplicationModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Neue Bewerbung</h2>
              <button onClick={closeApplicationModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleApplicationSubmit} className="p-6 space-y-5">
              <div>
                <label className="label">Discord ID *</label>
                <input
                  type="text"
                  value={appDiscordId}
                  onChange={(e) => setAppDiscordId(e.target.value)}
                  className="input"
                  placeholder="z.B. 123456789012345678"
                  required
                />
              </div>

              <div>
                <label className="label">Discord Username *</label>
                <input
                  type="text"
                  value={appUsername}
                  onChange={(e) => setAppUsername(e.target.value)}
                  className="input"
                  placeholder="Discord Username"
                  required
                />
              </div>

              <div>
                <label className="label">Notizen</label>
                <textarea
                  value={appNotes}
                  onChange={(e) => setAppNotes(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="Notizen zur Bewerbung..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeApplicationModal} className="btn-ghost px-5">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary px-5">
                  Erstellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interview Schedule Modal */}
      {showInterviewModal && selectedApplication && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Gespräch planen</h2>
              <button onClick={closeInterviewModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleInterviewSubmit} className="p-6 space-y-5">
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-white font-medium">{selectedApplication.discordUsername}</p>
                <p className="text-sm text-slate-400">{selectedApplication.discordId}</p>
              </div>

              <div>
                <label className="label">Gesprächstermin *</label>
                <input
                  type="datetime-local"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeInterviewModal} className="btn-ghost px-5">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary px-5">
                  Planen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Accept Modal */}
      {showAcceptModal && selectedApplication && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Bewerbung annehmen</h2>
              <button onClick={closeAcceptModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleAcceptSubmit} className="p-6 space-y-5">
              <div className="p-4 bg-green-900/20 border border-green-700/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                  <div>
                    <p className="text-white font-medium">{selectedApplication.discordUsername}</p>
                    <p className="text-sm text-slate-400">Wird als Cadet eingestellt</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Gesprächsnotizen</label>
                <textarea
                  value={interviewNotes}
                  onChange={(e) => setInterviewNotes(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="Notizen vom Bewerbungsgespräch..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeAcceptModal} className="btn-ghost px-5">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary bg-green-600 hover:bg-green-700 px-5">
                  Einstellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedApplication && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Bewerbung ablehnen</h2>
              <button onClick={closeRejectModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="p-6 space-y-5">
              <div className="p-4 bg-red-900/20 border border-red-700/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <XCircle className="h-6 w-6 text-red-400" />
                  <div>
                    <p className="text-white font-medium">{selectedApplication.discordUsername}</p>
                    <p className="text-sm text-slate-400">{selectedApplication.discordId}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Ablehnungsgrund *</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="Grund für die Ablehnung..."
                  required
                />
              </div>

              <div className="p-4 bg-slate-700/50 rounded-lg space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addToBlacklist}
                    onChange={(e) => setAddToBlacklist(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-red-500 focus:ring-red-500"
                  />
                  <span className="text-white">Zur Blacklist hinzufügen</span>
                </label>

                {addToBlacklist && (
                  <>
                    <div>
                      <label className="label text-sm">Blacklist-Grund</label>
                      <input
                        type="text"
                        value={blacklistReason}
                        onChange={(e) => setBlacklistReason(e.target.value)}
                        className="input"
                        placeholder="Leer = Ablehnungsgrund verwenden"
                      />
                    </div>
                    <div>
                      <label className="label text-sm">Ablaufdatum (optional)</label>
                      <input
                        type="date"
                        value={blacklistExpires}
                        onChange={(e) => setBlacklistExpires(e.target.value)}
                        className="input"
                        min={new Date().toISOString().split('T')[0]}
                      />
                      <p className="text-xs text-slate-500 mt-1">Leer = Permanente Sperre</p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeRejectModal} className="btn-ghost px-5">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary bg-red-600 hover:bg-red-700 px-5">
                  Ablehnen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedApplication && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Bewerbungsdetails</h2>
              <button onClick={closeDetailModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium text-lg">{selectedApplication.discordUsername}</p>
                  <p className="text-sm text-slate-400">{selectedApplication.discordId}</p>
                </div>
                {getStatusBadge(selectedApplication.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Erstellt am</p>
                  <p className="text-white">{formatDateTime(selectedApplication.createdAt)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Erstellt von</p>
                  <p className="text-white">
                    {selectedApplication.createdBy.displayName || selectedApplication.createdBy.username}
                  </p>
                </div>
                {selectedApplication.interviewDate && (
                  <div>
                    <p className="text-slate-500">Gesprächstermin</p>
                    <p className="text-white">{formatDateTime(selectedApplication.interviewDate)}</p>
                  </div>
                )}
                {selectedApplication.processedBy && (
                  <div>
                    <p className="text-slate-500">Bearbeitet von</p>
                    <p className="text-white">
                      {selectedApplication.processedBy.displayName || selectedApplication.processedBy.username}
                    </p>
                  </div>
                )}
              </div>

              {selectedApplication.notes && (
                <div>
                  <p className="text-slate-500 text-sm mb-1">Notizen</p>
                  <p className="text-white bg-slate-700/50 rounded-lg p-3">{selectedApplication.notes}</p>
                </div>
              )}

              {selectedApplication.interviewNotes && (
                <div>
                  <p className="text-slate-500 text-sm mb-1">Gesprächsnotizen</p>
                  <p className="text-white bg-slate-700/50 rounded-lg p-3">{selectedApplication.interviewNotes}</p>
                </div>
              )}

              {selectedApplication.rejectionReason && (
                <div>
                  <p className="text-slate-500 text-sm mb-1">Ablehnungsgrund</p>
                  <p className="text-red-400 bg-red-900/20 rounded-lg p-3">{selectedApplication.rejectionReason}</p>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button onClick={closeDetailModal} className="btn-ghost px-5">
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
