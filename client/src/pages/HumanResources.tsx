import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blacklistApi, applicationApi, adminApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import {
  Plus,
  X,
  Ban,
  RefreshCw,
  Trash2,
  Clock,
  AlertTriangle,
  Edit2,
  UserPlus,
  CheckCircle,
  XCircle,
  Eye,
  Upload,
  FileCheck,
  MessageSquare,
  ClipboardList,
  Image as ImageIcon,
  Link,
  Search,
  ShieldAlert,
  Check,
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

interface Application {
  id: string;
  applicantName: string;
  applicationDate: string;
  idCardImage: string | null;
  discordId: string | null;
  discordUsername: string | null;
  status: 'CRITERIA' | 'QUESTIONS' | 'ONBOARDING' | 'COMPLETED' | 'REJECTED';
  currentStep: number;
  criteriaData: string | null; // JSON: {"criterionId": true/false, ...}
  questionsCompleted: string | null;
  onboardingCompleted: string | null;
  discordInviteLink: string | null;
  discordRolesAssigned: boolean;
  notes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  processedAt: string | null;
  createdBy: { displayName: string | null; username: string };
  processedBy: { displayName: string | null; username: string } | null;
}

interface Question {
  id: string;
  text: string;
}

interface Criterion {
  id: string;
  name: string;
}

interface OnboardingItem {
  id: string;
  text: string;
}

type Tab = 'applications' | 'blacklist';

// Fallback-Kriterien wurden auf den Server verschoben (/api/applications/criteria)

export default function HumanResources() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useLiveUpdates();
  const [activeTab, setActiveTab] = useState<Tab>('applications');

  // Blacklist State
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [editingBlacklist, setEditingBlacklist] = useState<BlacklistEntry | null>(null);
  const [discordId, setDiscordId] = useState('');
  const [username, setUsername] = useState('');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  // Application State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<string>('ALL');

  // Create Form State
  const [applicantName, setApplicantName] = useState('');
  const [applicationDate, setApplicationDate] = useState(new Date().toISOString().split('T')[0]);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [checkDiscordId, setCheckDiscordId] = useState('');
  const [checkUsername, setCheckUsername] = useState('');
  const [blacklistCheckResult, setBlacklistCheckResult] = useState<{
    checked: boolean;
    isBlacklisted: boolean;
    matchedBy?: 'discordId' | 'username' | 'both';
    entry?: { reason: string; expiresAt?: string };
  } | null>(null);
  const [isCheckingBlacklist, setIsCheckingBlacklist] = useState(false);

  // Detail Form State
  const [criteria, setCriteria] = useState<Record<string, boolean>>({});
  const [questionsCompleted, setQuestionsCompleted] = useState<string[]>([]);
  const [onboardingCompleted, setOnboardingCompleted] = useState<string[]>([]);
  const [detailDiscordId, setDetailDiscordId] = useState('');
  const [detailDiscordUsername, setDetailDiscordUsername] = useState('');

  // Confirm Dialog State
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
  const [discordInviteLink, setDiscordInviteLink] = useState('');
  const [discordRolesAssigned, setDiscordRolesAssigned] = useState(false);

  // Reject State
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

  const { data: applicationsData, isLoading: applicationsLoading } = useQuery({
    queryKey: ['applications', applicationStatus],
    queryFn: () => applicationApi.getAll(applicationStatus !== 'ALL' ? { status: applicationStatus } : undefined),
  });

  const { data: applicationStatsData } = useQuery({
    queryKey: ['application-stats'],
    queryFn: () => applicationApi.getStats(),
  });

  const { data: questionsData } = useQuery({
    queryKey: ['application-questions'],
    queryFn: () => applicationApi.getQuestions(),
  });

  const { data: onboardingData } = useQuery({
    queryKey: ['application-onboarding'],
    queryFn: () => applicationApi.getOnboardingChecklist(),
  });

  // Dynamische Einstellungskriterien aus der Applications-API (inkl. Fallback)
  const { data: criteriaData } = useQuery({
    queryKey: ['application-criteria'],
    queryFn: () => applicationApi.getCriteria(),
  });

  const blacklist = (blacklistData?.data || []) as BlacklistEntry[];
  const blacklistStats = blacklistStatsData?.data as { total: number; permanent: number; temporary: number } | undefined;
  const applications = (applicationsData?.data || []) as Application[];
  const applicationStats = applicationStatsData?.data as { criteria: number; questions: number; onboarding: number; completed: number; rejected: number; pending: number; total: number } | undefined;
  const questions = (questionsData?.data || []) as Question[];
  const onboardingItems = (onboardingData?.data || []) as OnboardingItem[];
  // Kriterien kommen jetzt direkt vom /applications/criteria Endpunkt (inkl. Fallback vom Server)
  const dynamicCriteria = (criteriaData?.data || []) as Criterion[];

  // Kriterienliste - Server liefert jetzt bereits Fallback wenn keine in DB
  const CRITERIA_ITEMS = useMemo(() => {
    // Server gibt jetzt immer Kriterien zurück (entweder aus DB oder Fallback)
    return dynamicCriteria.map((c) => ({
      key: c.id,
      label: c.name,
    }));
  }, [dynamicCriteria]);

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

  // Application Mutations
  const createApplicationMutation = useMutation({
    mutationFn: applicationApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-stats'] });
      closeCreateModal();
      toast.success('Bewerbung erstellt');
    },
    onError: (error: { response?: { data?: { error?: string; message?: string } } }) => {
      if (error.response?.data?.error === 'BLACKLISTED') {
        toast.error(error.response.data.message || 'Bewerber ist auf der Blacklist');
      }
    },
  });

  const updateCriteriaMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, boolean> }) =>
      applicationApi.updateCriteria(id, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-stats'] });
      setSelectedApplication(response.data);
      if (response.data.status === 'QUESTIONS') {
        toast.success('Alle Kriterien erfüllt - weiter zum Fragenkatalog');
      }
    },
  });

  const updateQuestionsMutation = useMutation({
    mutationFn: ({ id, questionsCompleted }: { id: string; questionsCompleted: string[] }) =>
      applicationApi.updateQuestions(id, questionsCompleted),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-stats'] });
      setSelectedApplication(response.data);
      if (response.data.status === 'ONBOARDING') {
        toast.success('Fragenkatalog abgeschlossen - weiter zum Onboarding');
      }
    },
  });

  const updateOnboardingMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      applicationApi.updateOnboarding(id, data as {
        onboardingCompleted?: string[];
        discordId?: string;
        discordUsername?: string;
        discordInviteLink?: string;
        discordRolesAssigned?: boolean;
      }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setSelectedApplication(response.data.application);
    },
  });

  const completeApplicationMutation = useMutation({
    mutationFn: applicationApi.complete,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-stats'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      closeDetailModal();
      toast.success(response.data.message || 'Bewerbung abgeschlossen');
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
      closeDetailModal();
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

  const generateInviteMutation = useMutation({
    mutationFn: applicationApi.generateInvite,
    onSuccess: (response) => {
      const inviteUrl = response.data.inviteUrl;
      setDiscordInviteLink(inviteUrl);
      toast.success('Einladungslink generiert');
      // Automatisch speichern
      if (selectedApplication) {
        updateOnboardingMutation.mutate({
          id: selectedApplication.id,
          data: {
            onboardingCompleted,
            discordId: detailDiscordId || undefined,
            discordUsername: detailDiscordUsername || undefined,
            discordInviteLink: inviteUrl,
            discordRolesAssigned,
          },
        });
      }
    },
    onError: () => {
      toast.error('Fehler beim Generieren des Einladungslinks');
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

  // Create Modal Functions
  const closeCreateModal = () => {
    setShowCreateModal(false);
    setApplicantName('');
    setApplicationDate(new Date().toISOString().split('T')[0]);
    setIdCardFile(null);
    setCheckDiscordId('');
    setCheckUsername('');
    setBlacklistCheckResult(null);
    setIsCheckingBlacklist(false);
  };

  // Blacklist Check Funktion
  const checkBlacklist = async () => {
    if (!checkDiscordId && !checkUsername) {
      toast.error('Bitte Discord ID oder Username eingeben');
      return;
    }

    setIsCheckingBlacklist(true);
    setBlacklistCheckResult(null);

    try {
      // Prüfe gegen alle Blacklist-Einträge
      const blacklistData = await blacklistApi.getAll();
      const entries = blacklistData.data || [];

      let matchedEntry = null;
      let matchedBy: 'discordId' | 'username' | 'both' | undefined;

      for (const entry of entries) {
        const matchesDiscordId = checkDiscordId && entry.discordId === checkDiscordId;
        const matchesUsername = checkUsername && entry.username.toLowerCase() === checkUsername.toLowerCase();

        if (matchesDiscordId && matchesUsername) {
          matchedEntry = entry;
          matchedBy = 'both';
          break;
        } else if (matchesDiscordId) {
          matchedEntry = entry;
          matchedBy = 'discordId';
        } else if (matchesUsername && !matchedEntry) {
          matchedEntry = entry;
          matchedBy = 'username';
        }
      }

      if (matchedEntry) {
        setBlacklistCheckResult({
          checked: true,
          isBlacklisted: true,
          matchedBy,
          entry: { reason: matchedEntry.reason, expiresAt: matchedEntry.expiresAt },
        });
      } else {
        setBlacklistCheckResult({
          checked: true,
          isBlacklisted: false,
        });
      }
    } catch {
      toast.error('Fehler beim Prüfen der Blacklist');
    } finally {
      setIsCheckingBlacklist(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('applicantName', applicantName);
    formData.append('applicationDate', applicationDate);
    if (idCardFile) {
      formData.append('idCardImage', idCardFile);
    }
    // Discord-Daten mitschicken für Blacklist-Check im Backend
    if (checkDiscordId) {
      formData.append('discordId', checkDiscordId);
    }
    if (checkUsername) {
      formData.append('discordUsername', checkUsername);
    }

    createApplicationMutation.mutate(formData);
  };

  // Detail Modal Functions
  const openDetailModal = (app: Application) => {
    setSelectedApplication(app);

    // Criteria laden (aus dem JSON-Feld criteriaData)
    try {
      const savedCriteria = app.criteriaData ? JSON.parse(app.criteriaData) : {};
      const criteriaState: Record<string, boolean> = {};
      CRITERIA_ITEMS.forEach((item) => {
        criteriaState[item.key] = savedCriteria[item.key] || false;
      });
      setCriteria(criteriaState);
    } catch {
      // Fallback: Initialisiere alle Kriterien als false
      const criteriaState: Record<string, boolean> = {};
      CRITERIA_ITEMS.forEach((item) => {
        criteriaState[item.key] = false;
      });
      setCriteria(criteriaState);
    }

    // Questions laden
    try {
      setQuestionsCompleted(app.questionsCompleted ? JSON.parse(app.questionsCompleted) : []);
    } catch {
      setQuestionsCompleted([]);
    }

    // Onboarding laden
    try {
      setOnboardingCompleted(app.onboardingCompleted ? JSON.parse(app.onboardingCompleted) : []);
    } catch {
      setOnboardingCompleted([]);
    }

    setDetailDiscordId(app.discordId || '');
    setDetailDiscordUsername(app.discordUsername || '');
    setDiscordInviteLink(app.discordInviteLink || '');
    setDiscordRolesAssigned(app.discordRolesAssigned || false);

    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedApplication(null);
    setCriteria({});
    setQuestionsCompleted([]);
    setOnboardingCompleted([]);
    setDetailDiscordId('');
    setDetailDiscordUsername('');
    setDiscordInviteLink('');
    setDiscordRolesAssigned(false);
  };

  // Reject Modal
  const openRejectModal = () => {
    setRejectionReason('');
    setAddToBlacklist(false);
    setBlacklistReason('');
    setBlacklistExpires('');
    setShowRejectModal(true);
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setRejectionReason('');
    setAddToBlacklist(false);
    setBlacklistReason('');
    setBlacklistExpires('');
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedApplication) {
      rejectApplicationMutation.mutate({
        id: selectedApplication.id,
        data: {
          rejectionReason,
          addToBlacklist: addToBlacklist && !!detailDiscordId,
          blacklistReason: addToBlacklist ? (blacklistReason || rejectionReason) : undefined,
          blacklistExpires: addToBlacklist && blacklistExpires ? blacklistExpires : undefined,
        },
      });
    }
  };

  // Handlers
  const handleCriteriaChange = (key: string, value: boolean) => {
    const newCriteria = { ...criteria, [key]: value };
    setCriteria(newCriteria);

    if (selectedApplication) {
      updateCriteriaMutation.mutate({
        id: selectedApplication.id,
        data: newCriteria,
      });
    }
  };

  const handleQuestionToggle = (questionId: string) => {
    const newQuestions = questionsCompleted.includes(questionId)
      ? questionsCompleted.filter((q) => q !== questionId)
      : [...questionsCompleted, questionId];
    setQuestionsCompleted(newQuestions);

    if (selectedApplication) {
      updateQuestionsMutation.mutate({
        id: selectedApplication.id,
        questionsCompleted: newQuestions,
      });
    }
  };

  const handleOnboardingToggle = (itemId: string) => {
    const newOnboarding = onboardingCompleted.includes(itemId)
      ? onboardingCompleted.filter((i) => i !== itemId)
      : [...onboardingCompleted, itemId];
    setOnboardingCompleted(newOnboarding);

    if (selectedApplication) {
      updateOnboardingMutation.mutate({
        id: selectedApplication.id,
        data: {
          onboardingCompleted: newOnboarding,
          discordId: detailDiscordId || undefined,
          discordUsername: detailDiscordUsername || undefined,
          discordInviteLink: discordInviteLink || undefined,
          discordRolesAssigned,
        },
      });
    }
  };

  const handleDiscordDataSave = () => {
    if (selectedApplication) {
      updateOnboardingMutation.mutate({
        id: selectedApplication.id,
        data: {
          onboardingCompleted,
          discordId: detailDiscordId || undefined,
          discordUsername: detailDiscordUsername || undefined,
          discordInviteLink: discordInviteLink || undefined,
          discordRolesAssigned,
        },
      });
      toast.success('Discord-Daten gespeichert');
    }
  };

  const handleComplete = () => {
    if (selectedApplication) {
      if (!detailDiscordId || !detailDiscordUsername) {
        toast.error('Discord-Daten sind erforderlich');
        return;
      }
      completeApplicationMutation.mutate(selectedApplication.id);
    }
  };

  // Utility Functions
  const getStatusBadge = (status: Application['status']) => {
    switch (status) {
      case 'CRITERIA':
        return <span className="px-2 py-0.5 text-xs bg-blue-600/20 text-blue-400 rounded-full">Kriterien</span>;
      case 'QUESTIONS':
        return <span className="px-2 py-0.5 text-xs bg-purple-600/20 text-purple-400 rounded-full">Fragen</span>;
      case 'ONBOARDING':
        return <span className="px-2 py-0.5 text-xs bg-amber-600/20 text-amber-400 rounded-full">Onboarding</span>;
      case 'COMPLETED':
        return <span className="px-2 py-0.5 text-xs bg-green-600/20 text-green-400 rounded-full">Abgeschlossen</span>;
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

  // Permission checks
  const canManageBlacklist = user?.role?.permissions?.some(
    (p: { name: string }) => p.name === 'blacklist.manage' || p.name === 'admin.full'
  );

  const canManageHR = user?.role?.permissions?.some(
    (p: { name: string }) => p.name === 'hr.manage' || p.name === 'admin.full'
  );

  // Sync selectedApplication when data changes
  useEffect(() => {
    if (selectedApplication && applications.length > 0) {
      const updated = applications.find((a) => a.id === selectedApplication.id);
      if (updated) {
        setSelectedApplication(updated);
      }
    }
  }, [applications, selectedApplication?.id]);

  return (
    <div className="space-y-6">
      {/* Header mit Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600/20 via-slate-800 to-red-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-2xl backdrop-blur-sm border border-green-500/30 shadow-lg shadow-green-500/20">
              <UserPlus className="h-8 w-8 text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Human Resources</h1>
              <p className="text-slate-400 mt-0.5">Bewerbungen & Blacklist verwalten</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 bg-slate-800/50 rounded-t-xl px-2">
        <button
          onClick={() => setActiveTab('applications')}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === 'applications' ? 'text-green-400' : 'text-slate-400 hover:text-white'
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
          {activeTab === 'applications' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-400" />}
        </button>
        <button
          onClick={() => setActiveTab('blacklist')}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === 'blacklist' ? 'text-red-400' : 'text-slate-400 hover:text-white'
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
          {activeTab === 'blacklist' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-400" />}
        </button>
      </div>

      {/* Applications Tab */}
      {activeTab === 'applications' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="card p-4 bg-gradient-to-br from-blue-900/30 to-slate-800/50 border-blue-700/30 hover:border-blue-600/50 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/20 rounded-xl group-hover:scale-110 transition-transform">
                  <FileCheck className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-blue-400">{applicationStats?.criteria || 0}</p>
                  <p className="text-xs text-slate-400">Kriterien</p>
                </div>
              </div>
            </div>
            <div className="card p-4 bg-gradient-to-br from-purple-900/30 to-slate-800/50 border-purple-700/30 hover:border-purple-600/50 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-600/20 rounded-xl group-hover:scale-110 transition-transform">
                  <MessageSquare className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-purple-400">{applicationStats?.questions || 0}</p>
                  <p className="text-xs text-slate-400">Fragen</p>
                </div>
              </div>
            </div>
            <div className="card p-4 bg-gradient-to-br from-amber-900/30 to-slate-800/50 border-amber-700/30 hover:border-amber-600/50 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-600/20 rounded-xl group-hover:scale-110 transition-transform">
                  <ClipboardList className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-400">{applicationStats?.onboarding || 0}</p>
                  <p className="text-xs text-slate-400">Onboarding</p>
                </div>
              </div>
            </div>
            <div className="card p-4 bg-gradient-to-br from-green-900/30 to-slate-800/50 border-green-700/30 hover:border-green-600/50 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-600/20 rounded-xl group-hover:scale-110 transition-transform">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-green-400">{applicationStats?.completed || 0}</p>
                  <p className="text-xs text-slate-400">Fertig</p>
                </div>
              </div>
            </div>
            <div className="card p-4 bg-gradient-to-br from-red-900/30 to-slate-800/50 border-red-700/30 hover:border-red-600/50 transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-600/20 rounded-xl group-hover:scale-110 transition-transform">
                  <XCircle className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-red-400">{applicationStats?.rejected || 0}</p>
                  <p className="text-xs text-slate-400">Abgelehnt</p>
                </div>
              </div>
            </div>
          </div>

          {/* Applications List */}
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
                  <option value="CRITERIA">Kriterien</option>
                  <option value="QUESTIONS">Fragen</option>
                  <option value="ONBOARDING">Onboarding</option>
                  <option value="COMPLETED">Abgeschlossen</option>
                  <option value="REJECTED">Abgelehnt</option>
                </select>
              </div>
              {canManageHR && (
                <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
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
                          <span className="font-medium text-white">{app.applicantName}</span>
                          {getStatusBadge(app.status)}
                          {app.idCardImage && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <ImageIcon className="h-3 w-3" />
                              Ausweis
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400">
                          Bewerbung vom {formatDate(app.applicationDate)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Erstellt von {app.createdBy.displayName || app.createdBy.username}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openDetailModal(app)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg transition-colors"
                          title="Bearbeiten"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canManageHR && app.status !== 'COMPLETED' && app.status !== 'REJECTED' && (
                          <button
                            onClick={() => {
                              setSelectedApplication(app);
                              openRejectModal();
                            }}
                            className="p-2 text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                            title="Ablehnen"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                        {canManageHR && (
                          <button
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: 'Bewerbung löschen',
                                message: 'Möchtest du diese Bewerbung wirklich löschen?',
                                confirmText: 'Löschen',
                                variant: 'danger',
                                onConfirm: () => deleteApplicationMutation.mutate(app.id),
                              });
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
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full ${
                                isExpired(entry.expiresAt)
                                  ? 'bg-green-600/20 text-green-400'
                                  : 'bg-amber-600/20 text-amber-400'
                              }`}
                            >
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
                          Hinzugefügt von {entry.addedBy.displayName || entry.addedBy.username} am{' '}
                          {formatDateTime(entry.createdAt)}
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
                              setConfirmDialog({
                                isOpen: true,
                                title: 'Blacklist-Eintrag löschen',
                                message: 'Möchtest du diesen Blacklist-Eintrag wirklich löschen?',
                                confirmText: 'Löschen',
                                variant: 'danger',
                                onConfirm: () => deleteBlacklistMutation.mutate(entry.id),
                              });
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

      {/* Create Application Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl w-full max-w-lg border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
              <h2 className="text-xl font-bold text-white">Neue Bewerbung</h2>
              <button onClick={closeCreateModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-5">
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <h3 className="font-medium text-white mb-3">Basisdaten</h3>
                <div className="space-y-4">
                  <div>
                    <label className="label">Name des Bewerbers *</label>
                    <input
                      type="text"
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      className="input"
                      placeholder="Vor- und Nachname"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Bewerbungsdatum *</label>
                    <input
                      type="date"
                      value={applicationDate}
                      onChange={(e) => setApplicationDate(e.target.value)}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Personalausweis-Bild</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => setIdCardFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="id-card-upload"
                      />
                      <label
                        htmlFor="id-card-upload"
                        className="btn-secondary flex items-center gap-2 cursor-pointer"
                      >
                        <Upload className="h-4 w-4" />
                        {idCardFile ? 'Ändern' : 'Hochladen'}
                      </label>
                      {idCardFile && (
                        <span className="text-sm text-slate-400">{idCardFile.name}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-red-900/20 border border-red-700/30 rounded-lg">
                <h3 className="font-medium text-red-400 mb-3">Blacklist-Check (optional)</h3>
                <p className="text-xs text-slate-400 mb-3">
                  Gib Discord-Daten ein um zu prüfen ob der Bewerber auf der Blacklist steht.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-sm">Discord ID</label>
                    <input
                      type="text"
                      value={checkDiscordId}
                      onChange={(e) => {
                        setCheckDiscordId(e.target.value);
                        setBlacklistCheckResult(null);
                      }}
                      className="input"
                      placeholder="123456789..."
                    />
                  </div>
                  <div>
                    <label className="label text-sm">Discord Username</label>
                    <input
                      type="text"
                      value={checkUsername}
                      onChange={(e) => {
                        setCheckUsername(e.target.value);
                        setBlacklistCheckResult(null);
                      }}
                      className="input"
                      placeholder="username"
                    />
                  </div>
                </div>

                {/* Check Button */}
                <button
                  type="button"
                  onClick={checkBlacklist}
                  disabled={isCheckingBlacklist || (!checkDiscordId && !checkUsername)}
                  className="mt-3 w-full btn-secondary flex items-center justify-center gap-2"
                >
                  {isCheckingBlacklist ? (
                    <>
                      <div className="h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      Prüfe Blacklist...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Blacklist prüfen
                    </>
                  )}
                </button>

                {/* Check Result */}
                {blacklistCheckResult && (
                  <div className={`mt-3 p-3 rounded-lg ${
                    blacklistCheckResult.isBlacklisted
                      ? 'bg-red-500/20 border border-red-500/50'
                      : 'bg-green-500/20 border border-green-500/50'
                  }`}>
                    {blacklistCheckResult.isBlacklisted ? (
                      <div>
                        <div className="flex items-center gap-2 text-red-400 font-medium">
                          <ShieldAlert className="h-5 w-5" />
                          Auf Blacklist gefunden!
                        </div>
                        <p className="text-sm text-red-300 mt-1">
                          Gefunden über: {blacklistCheckResult.matchedBy === 'both'
                            ? 'Discord ID & Username'
                            : blacklistCheckResult.matchedBy === 'discordId'
                              ? 'Discord ID'
                              : 'Username'}
                        </p>
                        <p className="text-sm text-slate-300 mt-1">
                          Grund: {blacklistCheckResult.entry?.reason}
                        </p>
                        {blacklistCheckResult.entry?.expiresAt && (
                          <p className="text-sm text-slate-400 mt-1">
                            Ablauf: {new Date(blacklistCheckResult.entry.expiresAt).toLocaleDateString('de-DE')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-green-400 font-medium">
                        <Check className="h-5 w-5" />
                        Nicht auf Blacklist - Bewerber ist sauber
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeCreateModal} className="btn-ghost px-5">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary px-5" disabled={createApplicationMutation.isPending}>
                  Erstellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedApplication && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl w-full max-w-3xl border border-slate-700/50 shadow-2xl shadow-black/50 my-8 animate-scale-in overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedApplication.applicantName}</h2>
                <p className="text-sm text-slate-400">
                  Bewerbung vom {formatDate(selectedApplication.applicationDate)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(selectedApplication.status)}
                <button onClick={closeDetailModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Personalausweis */}
              {selectedApplication.idCardImage && (
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-white">Personalausweis</h3>
                    <button
                      onClick={() => setShowImageModal(true)}
                      className="btn-secondary text-sm flex items-center gap-2"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Anzeigen
                    </button>
                  </div>
                </div>
              )}

              {/* Step 1: Einstellungskriterien */}
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    selectedApplication.status === 'CRITERIA' ? 'bg-blue-600' : 'bg-green-600'
                  }`}>
                    {selectedApplication.currentStep > 1 ? (
                      <CheckCircle className="h-5 w-5 text-white" />
                    ) : (
                      <span className="text-white font-bold">1</span>
                    )}
                  </div>
                  <h3 className="font-medium text-white">Einstellungskriterien</h3>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {CRITERIA_ITEMS.map((item) => (
                    <label
                      key={item.key}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        criteria[item.key] ? 'bg-green-900/20' : 'hover:bg-slate-600/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={criteria[item.key] || false}
                        onChange={(e) => handleCriteriaChange(item.key, e.target.checked)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500"
                        disabled={selectedApplication.status !== 'CRITERIA' && selectedApplication.status !== 'QUESTIONS'}
                      />
                      <span className={`text-sm ${criteria[item.key] ? 'text-green-400' : 'text-slate-300'}`}>
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Step 2: Fragenkatalog */}
              {(selectedApplication.currentStep >= 2 || selectedApplication.status === 'QUESTIONS') && (
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      selectedApplication.status === 'QUESTIONS' ? 'bg-purple-600' :
                      selectedApplication.currentStep > 2 ? 'bg-green-600' : 'bg-slate-600'
                    }`}>
                      {selectedApplication.currentStep > 2 ? (
                        <CheckCircle className="h-5 w-5 text-white" />
                      ) : (
                        <span className="text-white font-bold">2</span>
                      )}
                    </div>
                    <h3 className="font-medium text-white">Fragenkatalog</h3>
                    <span className="text-xs text-slate-400">(Informativ)</span>
                  </div>
                  <div className="space-y-2">
                    {questions.map((q, index) => (
                      <label
                        key={q.id}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          questionsCompleted.includes(q.id)
                            ? 'bg-green-600/20 border border-green-600/30'
                            : 'bg-slate-600/30 hover:bg-slate-600/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={questionsCompleted.includes(q.id)}
                          onChange={() => handleQuestionToggle(q.id)}
                          disabled={selectedApplication.status === 'COMPLETED' || selectedApplication.status === 'REJECTED'}
                          className="mt-1 h-4 w-4 rounded border-slate-500 text-green-600 focus:ring-green-500 focus:ring-offset-slate-800"
                        />
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600/30 text-purple-400 text-xs flex items-center justify-center font-medium">
                          {index + 1}
                        </span>
                        <span className={`text-sm ${questionsCompleted.includes(q.id) ? 'text-green-400' : 'text-slate-300'}`}>
                          {q.text}
                        </span>
                      </label>
                    ))}
                  </div>
                  {/* Richtige Antworten Zähler */}
                  <div className="mt-4 p-3 bg-slate-600/30 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-slate-400">Richtige Antworten:</span>
                    <span className={`text-lg font-bold ${
                      questionsCompleted.length === questions.length
                        ? 'text-green-400'
                        : questionsCompleted.length >= questions.length * 0.7
                        ? 'text-yellow-400'
                        : 'text-slate-300'
                    }`}>
                      {questionsCompleted.length} / {questions.length}
                    </span>
                  </div>
                </div>
              )}

              {/* Step 3: Onboarding */}
              {(selectedApplication.currentStep >= 3 || selectedApplication.status === 'ONBOARDING') && (
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      selectedApplication.status === 'ONBOARDING' ? 'bg-amber-600' :
                      selectedApplication.status === 'COMPLETED' ? 'bg-green-600' : 'bg-slate-600'
                    }`}>
                      {selectedApplication.status === 'COMPLETED' ? (
                        <CheckCircle className="h-5 w-5 text-white" />
                      ) : (
                        <span className="text-white font-bold">3</span>
                      )}
                    </div>
                    <h3 className="font-medium text-white">Onboarding & Discord</h3>
                  </div>

                  {/* Discord Server Einladung */}
                  <div className="mb-4 p-3 bg-[#5865F2]/20 border border-[#5865F2]/30 rounded-lg">
                    <h4 className="text-sm font-medium text-[#5865F2] mb-3">Discord Server Einladung</h4>
                    <div className="mb-3">
                      <label className="label text-xs">Discord ID *</label>
                      <input
                        type="text"
                        value={detailDiscordId}
                        onChange={(e) => setDetailDiscordId(e.target.value)}
                        className="input text-sm"
                        placeholder="123456789..."
                        disabled={selectedApplication.status === 'COMPLETED' || selectedApplication.status === 'REJECTED'}
                      />
                      <p className="text-xs text-slate-500 mt-1">Der Anzeigename wird vom Bot automatisch aus dem Personalsystem übernommen</p>
                    </div>
                    <div className="mb-3">
                      <label className="label text-xs">Einladungslink</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={discordInviteLink}
                          onChange={(e) => setDiscordInviteLink(e.target.value)}
                          className="input text-sm flex-1"
                          placeholder="https://discord.gg/..."
                          disabled={selectedApplication.status === 'COMPLETED' || selectedApplication.status === 'REJECTED'}
                        />
                        <button
                          type="button"
                          onClick={() => generateInviteMutation.mutate()}
                          className="btn-primary text-sm flex items-center gap-1"
                          disabled={selectedApplication.status === 'COMPLETED' || selectedApplication.status === 'REJECTED' || generateInviteMutation.isPending}
                          title="Einladungslink generieren"
                        >
                          {generateInviteMutation.isPending ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Link className="h-4 w-4" />
                          )}
                          Generieren
                        </button>
                        <button
                          type="button"
                          onClick={handleDiscordDataSave}
                          className="btn-secondary text-sm"
                          disabled={selectedApplication.status === 'COMPLETED' || selectedApplication.status === 'REJECTED'}
                        >
                          Speichern
                        </button>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={discordRolesAssigned}
                        onChange={(e) => {
                          setDiscordRolesAssigned(e.target.checked);
                          if (selectedApplication && selectedApplication.status === 'ONBOARDING') {
                            updateOnboardingMutation.mutate({
                              id: selectedApplication.id,
                              data: {
                                onboardingCompleted,
                                discordId: detailDiscordId || undefined,
                                discordUsername: detailDiscordUsername || undefined,
                                discordInviteLink: discordInviteLink || undefined,
                                discordRolesAssigned: e.target.checked,
                              },
                            });
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500"
                        disabled={selectedApplication.status === 'COMPLETED' || selectedApplication.status === 'REJECTED'}
                      />
                      <span className="text-sm text-white">Discord Rollen vergeben</span>
                    </label>
                  </div>

                  {/* Onboarding Checkliste */}
                  <h4 className="text-sm font-medium text-white mb-3">Onboarding Checkliste</h4>
                  <div className="space-y-2">
                    {onboardingItems.map((item) => (
                      <label
                        key={item.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          onboardingCompleted.includes(item.id) ? 'bg-green-900/20' : 'hover:bg-slate-600/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={onboardingCompleted.includes(item.id)}
                          onChange={() => handleOnboardingToggle(item.id)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500"
                          disabled={selectedApplication.status !== 'ONBOARDING'}
                        />
                        <span className={`text-sm ${onboardingCompleted.includes(item.id) ? 'text-green-400' : 'text-slate-300'}`}>
                          {item.text}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Rejection Info */}
              {selectedApplication.status === 'REJECTED' && selectedApplication.rejectionReason && (
                <div className="p-4 bg-red-900/20 border border-red-700/30 rounded-lg">
                  <h3 className="font-medium text-red-400 mb-2">Ablehnungsgrund</h3>
                  <p className="text-sm text-slate-300">{selectedApplication.rejectionReason}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            {selectedApplication.status === 'ONBOARDING' && (
              <div className="px-6 py-4 border-t border-slate-700 flex justify-between">
                <button onClick={openRejectModal} className="btn-danger flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Ablehnen
                </button>
                <button
                  onClick={handleComplete}
                  className="btn-primary bg-green-600 hover:bg-green-700 flex items-center gap-2"
                  disabled={!detailDiscordId || completeApplicationMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4" />
                  Bewerbung abschließen
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && selectedApplication?.idCardImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={() => setShowImageModal(false)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-slate-300"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={applicationApi.getIdCardUrl(selectedApplication.id)}
              alt="Personalausweis"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedApplication && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl w-full max-w-lg border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
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
                    <p className="text-white font-medium">{selectedApplication.applicantName}</p>
                    <p className="text-sm text-slate-400">Bewerbung wird abgelehnt</p>
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

              {detailDiscordId && (
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
              )}

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

      {/* Blacklist Modal */}
      {showBlacklistModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl w-full max-w-md border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
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
                    <label className="label">Discord ID</label>
                    <input
                      type="text"
                      value={discordId}
                      onChange={(e) => setDiscordId(e.target.value)}
                      className="input"
                      placeholder="z.B. 123456789012345678"
                    />
                  </div>

                  <div>
                    <label className="label">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="input"
                      placeholder="Discord Username"
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
                <button
                  type="submit"
                  className="btn-primary px-5"
                  disabled={
                    createBlacklistMutation.isPending ||
                    updateBlacklistMutation.isPending ||
                    !reason.trim() ||
                    (!editingBlacklist && !discordId.trim() && !username.trim())
                  }
                >
                  {createBlacklistMutation.isPending || updateBlacklistMutation.isPending
                    ? 'Wird gespeichert...'
                    : editingBlacklist ? 'Speichern' : 'Hinzufügen'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
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
