import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, employeesApi, sanctionsApi, treasuryApi, announcementsApi, notificationsApi } from '../services/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import { usePermissions } from '../hooks/usePermissions';
import {
  Plus,
  X,
  Calendar,
  GripVertical,
  Trash2,
  Edit2,
  CheckSquare,
  AlertTriangle,
  Search,
  Check,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  DollarSign,
  Skull,
  Megaphone,
  Send,
  Hash,
  ChevronRight,
  Bell,
  Users,
  Globe,
  History,
  FileText,
  Save,
  Copy,
  Clock,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ==================== TYPES ====================

interface TaskAssignee {
  id: string;
  employeeId: string;
  employee: {
    id: string;
    user: { displayName: string | null; username: string; avatar: string | null };
  };
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate: string | null;
  dueTime: string | null;
  assignees: TaskAssignee[];
  createdBy: { displayName: string | null; username: string };
  createdAt: string;
}

interface Sanction {
  id: string;
  hasWarning: boolean;
  hasFine: boolean;
  hasMeasure: boolean;
  warningCompleted: boolean;
  fineCompleted: boolean;
  measureCompleted: boolean;
  reason: string;
  amount: number | null;
  measure: string | null;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'COMPLETED';
  expiresAt: string | null;
  createdAt: string;
  employee: {
    id: string;
    badgeNumber: string | null;
    rank: string;
    user: { displayName: string | null; username: string; avatar: string | null };
  };
  issuedBy: { displayName: string | null; username: string };
}

interface Treasury {
  id: string;
  regularCash: number;
  blackMoney: number;
  updatedAt: string;
}

interface TreasuryTransaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  moneyType: 'REGULAR' | 'BLACK';
  amount: number;
  reason: string;
  createdAt: string;
  createdBy: {
    displayName: string | null;
    username: string;
    avatar: string | null;
  };
}

interface Employee {
  id: string;
  badgeNumber: string | null;
  rank: string;
  user: { displayName: string | null; username: string; avatar: string | null };
}

// ==================== CONSTANTS ====================

const PRIORITY_COLORS = {
  LOW: 'bg-slate-500 text-slate-200',
  MEDIUM: 'bg-yellow-600 text-white',
  HIGH: 'bg-red-600 text-white',
};

const PRIORITY_LABELS = { LOW: 'Niedrig', MEDIUM: 'Mittel', HIGH: 'Hoch' };

const STATUS_COLUMNS = [
  { key: 'OPEN', label: 'Offen', color: 'bg-slate-600' },
  { key: 'IN_PROGRESS', label: 'In Arbeit', color: 'bg-blue-600' },
  { key: 'DONE', label: 'Erledigt', color: 'bg-green-600' },
] as const;

// ==================== MAIN COMPONENT ====================

export default function Leadership() {
  const { canViewTasks } = usePermissions();

  return (
    <div className="space-y-6">
      {/* Header mit Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600/20 via-slate-800 to-pink-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 rounded-2xl backdrop-blur-sm border border-indigo-500/30 shadow-lg shadow-indigo-500/20">
              <CheckSquare className="h-8 w-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Leadership</h1>
              <p className="text-slate-400 mt-0.5">Verwaltungsbereich für das Führungsteam</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Row: Treasury + Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TreasuryWidget />
        <AnnouncementsWidget />
      </div>

      {/* Bottom Row: Tasks + Sanctions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {canViewTasks && <TasksWidget />}
        <SanctionsWidget />
      </div>
    </div>
  );
}

// ==================== TREASURY WIDGET ====================

function TreasuryWidget() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [transactionType, setTransactionType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [moneyType, setMoneyType] = useState<'REGULAR' | 'BLACK'>('REGULAR');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const { data: treasuryData } = useQuery({
    queryKey: ['treasury'],
    queryFn: () => treasuryApi.get(),
  });

  const { data: transactionsData } = useQuery({
    queryKey: ['treasury-transactions'],
    queryFn: () => treasuryApi.getTransactions({ limit: '50' }),
  });

  const treasury = treasuryData?.data as Treasury | undefined;
  const transactions = (transactionsData?.data?.data || []) as TreasuryTransaction[];

  const depositMutation = useMutation({
    mutationFn: treasuryApi.deposit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-transactions'] });
      closeModal();
      toast.success('Einzahlung erfolgreich');
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: treasuryApi.withdraw,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-transactions'] });
      closeModal();
      toast.success('Auszahlung erfolgreich');
    },
  });

  const closeModal = () => {
    setShowModal(false);
    setAmount('');
    setReason('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseInt(amount) <= 0) {
      toast.error('Bitte gültigen Betrag eingeben');
      return;
    }
    if (!reason.trim()) {
      toast.error('Bitte Grund angeben');
      return;
    }
    const data = { moneyType, amount: parseInt(amount), reason: reason.trim() };
    if (transactionType === 'DEPOSIT') depositMutation.mutate(data);
    else withdrawMutation.mutate(data);
  };

  const openModal = (type: 'DEPOSIT' | 'WITHDRAWAL', money: 'REGULAR' | 'BLACK') => {
    setTransactionType(type);
    setMoneyType(money);
    setShowModal(true);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);

  const formatDateTime = (date: string) =>
    new Date(date).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="card">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary-400" />
          <h2 className="font-semibold text-white">Kasse</h2>
        </div>
        <button
          onClick={() => setShowHistory(true)}
          className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded flex items-center gap-1"
        >
          <History className="h-3 w-3" /> Verlauf
        </button>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4">
        {/* Normal */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-green-400" />
            <span className="text-slate-400 text-sm">Normal</span>
          </div>
          <p className="text-xl font-bold text-green-400 mb-3">{formatCurrency(treasury?.regularCash || 0)}</p>
          <div className="flex gap-2">
            <button onClick={() => openModal('DEPOSIT', 'REGULAR')} className="flex-1 text-xs bg-green-600/20 hover:bg-green-600/30 text-green-400 py-1.5 rounded flex items-center justify-center gap-1">
              <ArrowUpCircle className="h-3 w-3" /> Ein
            </button>
            <button onClick={() => openModal('WITHDRAWAL', 'REGULAR')} className="flex-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 py-1.5 rounded flex items-center justify-center gap-1">
              <ArrowDownCircle className="h-3 w-3" /> Aus
            </button>
          </div>
        </div>
        {/* Black */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Skull className="h-4 w-4 text-slate-400" />
            <span className="text-slate-400 text-sm">Schwarz</span>
          </div>
          <p className="text-xl font-bold text-slate-300 mb-3">{formatCurrency(treasury?.blackMoney || 0)}</p>
          <div className="flex gap-2">
            <button onClick={() => openModal('DEPOSIT', 'BLACK')} className="flex-1 text-xs bg-green-600/20 hover:bg-green-600/30 text-green-400 py-1.5 rounded flex items-center justify-center gap-1">
              <ArrowUpCircle className="h-3 w-3" /> Ein
            </button>
            <button onClick={() => openModal('WITHDRAWAL', 'BLACK')} className="flex-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 py-1.5 rounded flex items-center justify-center gap-1">
              <ArrowDownCircle className="h-3 w-3" /> Aus
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-sm mx-4 border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <h2 className="text-lg font-bold text-white mb-4">
              {transactionType === 'DEPOSIT' ? 'Einzahlung' : 'Auszahlung'} - {moneyType === 'REGULAR' ? 'Normal' : 'Schwarz'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Betrag ($)</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="10000" min="1" required />
              </div>
              <div>
                <label className="label">Grund</label>
                <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder="Grund..." required />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="btn-ghost">Abbrechen</button>
                <button type="submit" disabled={depositMutation.isPending || withdrawMutation.isPending} className="btn-primary">
                  {depositMutation.isPending || withdrawMutation.isPending ? '...' : 'OK'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-2xl mx-4 border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="h-5 w-5 text-primary-400" />
                Transaktionsverlauf
              </h2>
              <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-slate-700 rounded">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {transactions.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">Keine Transaktionen vorhanden</p>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="bg-slate-700/30 rounded-lg p-3 flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${tx.type === 'DEPOSIT' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                      {tx.type === 'DEPOSIT' ? (
                        <ArrowUpCircle className="h-4 w-4 text-green-400" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold ${tx.type === 'DEPOSIT' ? 'text-green-400' : 'text-red-400'}`}>
                          {tx.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${tx.moneyType === 'REGULAR' ? 'bg-green-600/20 text-green-400' : 'bg-slate-600 text-slate-300'}`}>
                          {tx.moneyType === 'REGULAR' ? 'Normal' : 'Schwarz'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 truncate mt-0.5">{tx.reason}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <img
                          src={tx.createdBy.avatar || `https://ui-avatars.com/api/?name=${tx.createdBy.displayName || tx.createdBy.username}&size=16`}
                          className="h-4 w-4 rounded-full"
                          alt=""
                        />
                        <span>{tx.createdBy.displayName || tx.createdBy.username}</span>
                        <span>•</span>
                        <span>{formatDateTime(tx.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== ANNOUNCEMENTS WIDGET ====================

interface DiscordChannel {
  id: string;
  name: string;
}

interface DiscordRole {
  id: string;
  name: string;
  color: number;
}

interface AnnouncementTemplate {
  id: string;
  name: string;
  title: string;
  content: string;
  channelId: string | null;
  category: string;
  createdBy: { displayName: string | null; username: string };
  createdAt: string;
}

interface ScheduledAnnouncement {
  id: string;
  title: string;
  content: string;
  channelId: string | null;
  channelName: string | null;
  status: string;
  scheduledAt: string;
  errorMessage: string | null;
  createdBy: { displayName: string | null; username: string; avatar: string | null };
  createdAt: string;
}

function AnnouncementsWidget() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'discord' | 'inapp' | 'templates' | 'scheduled'>('discord');

  // Discord state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [channelId, setChannelId] = useState('');

  // In-App state
  const [inAppTitle, setInAppTitle] = useState('');
  const [inAppMessage, setInAppMessage] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [broadcastToAll, setBroadcastToAll] = useState(false);

  // Template state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AnnouncementTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [templateChannelId, setTemplateChannelId] = useState('');
  const [templateCategory, setTemplateCategory] = useState('GENERAL');

  // Scheduling state
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Discord Kanäle laden
  const { data: channelsData } = useQuery({
    queryKey: ['announcement-channels'],
    queryFn: async () => {
      const res = await announcementsApi.getChannels();
      return res.data as DiscordChannel[];
    },
  });

  const channels = channelsData || [];

  // Bei Kanälen laden: ersten Kanal auswählen
  useEffect(() => {
    if (channels.length > 0 && !channelId) {
      setChannelId(channels[0].id);
    }
  }, [channels, channelId]);

  // Templates laden
  const { data: templatesData } = useQuery({
    queryKey: ['announcement-templates'],
    queryFn: async () => {
      const res = await announcementsApi.getTemplates();
      return res.data as AnnouncementTemplate[];
    },
  });

  const templates = templatesData || [];

  // Geplante Ankündigungen laden
  const { data: scheduledData } = useQuery({
    queryKey: ['scheduled-announcements'],
    queryFn: async () => {
      const res = await announcementsApi.getScheduled();
      return res.data as ScheduledAnnouncement[];
    },
  });

  const scheduledAnnouncements = scheduledData || [];

  // Discord Rollen laden
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['notification-discord-roles'],
    queryFn: async () => {
      const res = await notificationsApi.getDiscordRoles();
      return res.data as { serverName: string; roles: DiscordRole[] };
    },
  });

  const discordRoles = rolesData?.roles || [];

  const sendDiscordMutation = useMutation({
    mutationFn: announcementsApi.sendDirect,
    onSuccess: () => {
      setTitle('');
      setContent('');
      toast.success('Discord-Ankündigung gesendet!');
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: notificationsApi.broadcast,
    onSuccess: (res) => {
      setInAppTitle('');
      setInAppMessage('');
      setSelectedRoles([]);
      toast.success(res.data.message || 'Benachrichtigung gesendet!');
    },
  });

  const broadcastAllMutation = useMutation({
    mutationFn: notificationsApi.broadcastAll,
    onSuccess: (res) => {
      setInAppTitle('');
      setInAppMessage('');
      setBroadcastToAll(false);
      toast.success(res.data.message || 'Benachrichtigung an alle gesendet!');
    },
  });

  // Template Mutations
  const createTemplateMutation = useMutation({
    mutationFn: announcementsApi.createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcement-templates'] });
      closeTemplateModal();
      toast.success('Vorlage erstellt!');
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      announcementsApi.updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcement-templates'] });
      closeTemplateModal();
      toast.success('Vorlage aktualisiert!');
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: announcementsApi.deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcement-templates'] });
      toast.success('Vorlage gelöscht!');
    },
  });

  // Schedule Mutations
  const scheduleMutation = useMutation({
    mutationFn: announcementsApi.schedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-announcements'] });
      setTitle('');
      setContent('');
      setScheduleDate('');
      setScheduleTime('');
      toast.success('Ankündigung geplant!');
    },
  });

  const cancelScheduledMutation = useMutation({
    mutationFn: announcementsApi.cancelScheduled,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-announcements'] });
      toast.success('Geplante Ankündigung abgebrochen!');
    },
  });

  const handleDiscordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !channelId) {
      toast.error('Bitte alle Felder ausfüllen');
      return;
    }
    sendDiscordMutation.mutate({ title: title.trim(), content: content.trim(), channelId });
  };

  const handleInAppSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inAppTitle.trim() || !inAppMessage.trim()) {
      toast.error('Bitte Titel und Nachricht ausfüllen');
      return;
    }

    if (broadcastToAll) {
      broadcastAllMutation.mutate({ title: inAppTitle.trim(), message: inAppMessage.trim(), type: 'INFO' });
    } else {
      if (selectedRoles.length === 0) {
        toast.error('Bitte mindestens eine Rolle auswählen');
        return;
      }
      broadcastMutation.mutate({ title: inAppTitle.trim(), message: inAppMessage.trim(), roleIds: selectedRoles, type: 'INFO' });
    }
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
    setBroadcastToAll(false);
  };

  const selectedChannel = channels.find(c => c.id === channelId);

  // Schedule handler
  const handleSchedule = () => {
    if (!title.trim() || !content.trim() || !channelId) {
      toast.error('Bitte alle Felder ausfüllen');
      return;
    }
    if (!scheduleDate || !scheduleTime) {
      toast.error('Bitte Datum und Uhrzeit auswählen');
      return;
    }

    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
    if (scheduledAt <= new Date()) {
      toast.error('Zeitpunkt muss in der Zukunft liegen');
      return;
    }

    const channelName = selectedChannel?.name || '';
    scheduleMutation.mutate({
      title: title.trim(),
      content: content.trim(),
      channelId,
      channelName,
      scheduledAt: scheduledAt.toISOString(),
    });
  };

  const formatScheduledDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Template Functions
  const openCreateTemplateModal = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateTitle('');
    setTemplateContent('');
    setTemplateChannelId('');
    setTemplateCategory('GENERAL');
    setShowTemplateModal(true);
  };

  const openEditTemplateModal = (template: AnnouncementTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateTitle(template.title);
    setTemplateContent(template.content);
    setTemplateChannelId(template.channelId || '');
    setTemplateCategory(template.category);
    setShowTemplateModal(true);
  };

  const closeTemplateModal = () => {
    setShowTemplateModal(false);
    setEditingTemplate(null);
  };

  const handleTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim() || !templateTitle.trim() || !templateContent.trim()) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    const data = {
      name: templateName.trim(),
      title: templateTitle.trim(),
      content: templateContent.trim(),
      channelId: templateChannelId || undefined,
      category: templateCategory,
    };

    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const loadTemplate = (template: AnnouncementTemplate) => {
    setTitle(template.title);
    setContent(template.content);
    if (template.channelId) {
      setChannelId(template.channelId);
    }
    setActiveTab('discord');
    toast.success(`Vorlage "${template.name}" geladen`);
  };

  const saveCurrentAsTemplate = () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Bitte zuerst Titel und Inhalt ausfüllen');
      return;
    }
    setTemplateName('');
    setTemplateTitle(title);
    setTemplateContent(content);
    setTemplateChannelId(channelId);
    setTemplateCategory('GENERAL');
    setEditingTemplate(null);
    setShowTemplateModal(true);
  };

  return (
    <div className="card">
      <div className="p-4 border-b border-slate-700 flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-primary-400" />
        <h2 className="font-semibold text-white">Ankündigungen</h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('discord')}
          className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'discord'
              ? 'text-primary-400 border-b-2 border-primary-400 bg-primary-500/5'
              : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
          }`}
        >
          <Hash className="h-4 w-4" />
          Discord
        </button>
        <button
          onClick={() => setActiveTab('inapp')}
          className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'inapp'
              ? 'text-primary-400 border-b-2 border-primary-400 bg-primary-500/5'
              : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
          }`}
        >
          <Bell className="h-4 w-4" />
          In-App
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'templates'
              ? 'text-primary-400 border-b-2 border-primary-400 bg-primary-500/5'
              : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
          }`}
        >
          <FileText className="h-4 w-4" />
          Vorlagen
        </button>
        <button
          onClick={() => setActiveTab('scheduled')}
          className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'scheduled'
              ? 'text-primary-400 border-b-2 border-primary-400 bg-primary-500/5'
              : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
          }`}
        >
          <Clock className="h-4 w-4" />
          Geplant
          {scheduledAnnouncements.length > 0 && (
            <span className="bg-primary-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {scheduledAnnouncements.length}
            </span>
          )}
        </button>
      </div>

      <div className="p-4">
        {activeTab === 'discord' ? (
          // Discord Announcement Form
          <form onSubmit={handleDiscordSubmit} className="space-y-3">
            {/* Template Selector */}
            {templates.length > 0 && (
              <div>
                <label className="label">Vorlage laden</label>
                <div className="flex flex-wrap gap-1.5">
                  {templates.slice(0, 6).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => loadTemplate(t)}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded flex items-center gap-1"
                    >
                      <Copy className="h-3 w-3" />
                      {t.name}
                    </button>
                  ))}
                  {templates.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('templates')}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs rounded"
                    >
                      +{templates.length - 6} mehr
                    </button>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="label">Kanal</label>
              <div className="flex flex-wrap gap-2">
                {channels.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChannelId(c.id)}
                    className={`py-2 px-3 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                      channelId === c.id
                        ? 'bg-primary-600/30 text-primary-400 border border-primary-500'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    <Hash className="h-4 w-4" />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Titel</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
                placeholder="Ankündigungstitel..."
                required
              />
            </div>

            <div>
              <label className="label">Inhalt</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="input h-20 resize-none"
                placeholder="Ankündigungstext..."
                required
              />
            </div>

            {(title || content) && (
              <div className="bg-[#36393f] rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-2">Vorschau:</p>
                <div className="border-l-4 border-[#5865f2] bg-[#2f3136] rounded p-3">
                  <h4 className="font-semibold text-white text-sm">{title || 'Titel...'}</h4>
                  <p className="text-[#dcddde] text-xs mt-1 whitespace-pre-wrap">{content || 'Inhalt...'}</p>
                </div>
              </div>
            )}

            {/* Scheduling Section */}
            <div className="bg-slate-700/30 rounded-lg p-3">
              <label className="label mb-2">Planen (optional)</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="input text-sm"
                  min={new Date().toISOString().split('T')[0]}
                />
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="input text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={sendDiscordMutation.isPending || !title.trim() || !content.trim()}
                className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5"
              >
                <Send className="h-4 w-4" />
                {sendDiscordMutation.isPending ? 'Wird gesendet...' : `An #${selectedChannel?.name || 'Kanal'} senden`}
              </button>
              {scheduleDate && scheduleTime && title.trim() && content.trim() && (
                <button
                  type="button"
                  onClick={handleSchedule}
                  disabled={scheduleMutation.isPending}
                  className="px-3 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-2 text-sm"
                  title="Ankündigung planen"
                >
                  <Clock className="h-4 w-4" />
                  {scheduleMutation.isPending ? '...' : 'Planen'}
                </button>
              )}
              {title.trim() && content.trim() && (
                <button
                  type="button"
                  onClick={saveCurrentAsTemplate}
                  className="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg flex items-center gap-2 text-sm"
                  title="Als Vorlage speichern"
                >
                  <Save className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
        ) : activeTab === 'inapp' ? (
          // In-App Notification Form
          <form onSubmit={handleInAppSubmit} className="space-y-3">
            <div>
              <label className="label">Empfänger</label>
              <button
                type="button"
                onClick={() => { setBroadcastToAll(!broadcastToAll); setSelectedRoles([]); }}
                className={`w-full py-2 px-3 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors mb-2 ${
                  broadcastToAll
                    ? 'bg-amber-600/30 text-amber-400 border border-amber-500'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                <Globe className="h-4 w-4" />
                An alle Benutzer senden
              </button>

              {!broadcastToAll && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Oder wähle Discord-Rollen:</p>
                  {rolesLoading ? (
                    <p className="text-sm text-slate-400">Lade Rollen...</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {discordRoles.map((role) => (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => toggleRole(role.id)}
                          className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                            selectedRoles.includes(role.id)
                              ? 'bg-primary-600/30 text-primary-400 border border-primary-500'
                              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                          }`}
                        >
                          {selectedRoles.includes(role.id) && <Check className="h-3 w-3" />}
                          {role.name.replace('»', '').trim()}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedRoles.length > 0 && (
                    <p className="text-xs text-primary-400">{selectedRoles.length} Rolle(n) ausgewählt</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="label">Titel</label>
              <input
                type="text"
                value={inAppTitle}
                onChange={(e) => setInAppTitle(e.target.value)}
                className="input"
                placeholder="Benachrichtigungstitel..."
                required
              />
            </div>

            <div>
              <label className="label">Nachricht</label>
              <textarea
                value={inAppMessage}
                onChange={(e) => setInAppMessage(e.target.value)}
                className="input h-20 resize-none"
                placeholder="Nachrichtentext..."
                required
              />
            </div>

            {/* Preview */}
            {(inAppTitle || inAppMessage) && (
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-2">Vorschau:</p>
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-600">
                  <div className="flex items-start gap-2">
                    <div className="p-1.5 rounded-lg bg-primary-500/20">
                      <Bell className="h-4 w-4 text-primary-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm">{inAppTitle || 'Titel...'}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{inAppMessage || 'Nachricht...'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={broadcastMutation.isPending || broadcastAllMutation.isPending || !inAppTitle.trim() || !inAppMessage.trim() || (!broadcastToAll && selectedRoles.length === 0)}
              className="w-full btn-primary flex items-center justify-center gap-2 py-2.5"
            >
              <Bell className="h-4 w-4" />
              {broadcastMutation.isPending || broadcastAllMutation.isPending
                ? 'Wird gesendet...'
                : broadcastToAll
                  ? 'An alle senden'
                  : `An ${selectedRoles.length} Rolle(n) senden`}
            </button>
          </form>
        ) : activeTab === 'templates' ? (
          // Templates Tab
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Gespeicherte Vorlagen</p>
              <button
                onClick={openCreateTemplateModal}
                className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-2 py-1 rounded flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Neue Vorlage
              </button>
            </div>

            {templates.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-10 w-10 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Keine Vorlagen vorhanden</p>
                <p className="text-slate-600 text-xs mt-1">Erstelle eine neue Vorlage oder speichere eine Ankündigung als Vorlage</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {templates.map((template) => (
                  <div key={template.id} className="bg-slate-700/30 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm">{template.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            template.category === 'IC' ? 'bg-green-600/20 text-green-400' :
                            template.category === 'OOC' ? 'bg-blue-600/20 text-blue-400' :
                            'bg-slate-600/50 text-slate-400'
                          }`}>
                            {template.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{template.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{template.content}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => loadTemplate(template)}
                          className="p-1.5 text-slate-400 hover:text-primary-400 hover:bg-slate-600 rounded"
                          title="Vorlage verwenden"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEditTemplateModal(template)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded"
                          title="Bearbeiten"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteTemplateMutation.mutate(template.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded"
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Scheduled Tab
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Geplante Ankündigungen</p>

            {scheduledAnnouncements.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-10 w-10 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Keine geplanten Ankündigungen</p>
                <p className="text-slate-600 text-xs mt-1">Plane eine Ankündigung im Discord-Tab</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {scheduledAnnouncements.map((announcement) => (
                  <div key={announcement.id} className={`bg-slate-700/30 rounded-lg p-3 ${announcement.status === 'FAILED' ? 'border border-red-500/50' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm">{announcement.title}</span>
                          {announcement.status === 'FAILED' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/20 text-red-400 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Fehlgeschlagen
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{announcement.content}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatScheduledDate(announcement.scheduledAt)}
                          </span>
                          {announcement.channelName && (
                            <span className="flex items-center gap-1">
                              <Hash className="h-3 w-3" />
                              {announcement.channelName}
                            </span>
                          )}
                        </div>
                        {announcement.errorMessage && (
                          <p className="text-xs text-red-400 mt-1">{announcement.errorMessage}</p>
                        )}
                      </div>
                      <button
                        onClick={() => cancelScheduledMutation.mutate(announcement.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded flex-shrink-0"
                        title="Abbrechen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-md mx-4 border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                {editingTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage'}
              </h2>
              <button onClick={closeTemplateModal} className="p-1 hover:bg-slate-700 rounded">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleTemplateSubmit} className="space-y-3">
              <div>
                <label className="label">Vorlagenname *</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="input"
                  placeholder="z.B. Wöchentliches Update"
                  required
                />
              </div>

              <div>
                <label className="label">Kategorie</label>
                <div className="flex gap-2">
                  {['GENERAL', 'IC', 'OOC'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setTemplateCategory(cat)}
                      className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                        templateCategory === cat
                          ? 'bg-primary-600/30 text-primary-400 border border-primary-500'
                          : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Standard-Kanal</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTemplateChannelId('')}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                      !templateChannelId
                        ? 'bg-primary-600/30 text-primary-400 border border-primary-500'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    Keiner
                  </button>
                  {channels.slice(0, 4).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setTemplateChannelId(c.id)}
                      className={`py-2 px-3 rounded text-sm font-medium flex items-center justify-center gap-1 transition-colors ${
                        templateChannelId === c.id
                          ? 'bg-primary-600/30 text-primary-400 border border-primary-500'
                          : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }`}
                    >
                      <Hash className="h-3 w-3" />
                      {c.name.replace('Ankündigungen', '').trim()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Titel *</label>
                <input
                  type="text"
                  value={templateTitle}
                  onChange={(e) => setTemplateTitle(e.target.value)}
                  className="input"
                  placeholder="Ankündigungstitel..."
                  required
                />
              </div>

              <div>
                <label className="label">Inhalt *</label>
                <textarea
                  value={templateContent}
                  onChange={(e) => setTemplateContent(e.target.value)}
                  className="input h-24 resize-none"
                  placeholder="Ankündigungstext..."
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeTemplateModal} className="btn-ghost">
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                  className="btn-primary"
                >
                  {createTemplateMutation.isPending || updateTemplateMutation.isPending
                    ? '...'
                    : editingTemplate
                      ? 'Speichern'
                      : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== TASKS WIDGET ====================

function TasksWidget() {
  const queryClient = useQueryClient();
  useLiveUpdates();
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
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

  const { data: tasksData } = useQuery({ queryKey: ['tasks'], queryFn: () => tasksApi.getAll() });
  const { data: employeesData } = useQuery({ queryKey: ['employees-list'], queryFn: () => employeesApi.getAll({ status: 'ACTIVE', limit: '500' }) });

  const tasks = (tasksData?.data || []) as Task[];
  const employees = (employeesData?.data?.data || []) as Employee[];

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); closeModal(); toast.success('Erstellt'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => tasksApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); closeModal(); toast.success('Aktualisiert'); },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => tasksApi.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Gelöscht'); },
  });

  const openCreateModal = () => { setEditingTask(null); setTitle(''); setDescription(''); setPriority('MEDIUM'); setAssigneeIds([]); setDueDate(''); setDueTime(''); setShowModal(true); };
  const openEditModal = (t: Task) => { setEditingTask(t); setTitle(t.title); setDescription(t.description || ''); setPriority(t.priority); setAssigneeIds(t.assignees.map(a => a.employeeId)); setDueDate(t.dueDate?.split('T')[0] || ''); setDueTime(t.dueTime || ''); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingTask(null); };

  const toggleAssignee = (employeeId: string) => {
    setAssigneeIds(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const data = { title: title.trim(), description: description.trim() || undefined, priority, assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined, dueDate: dueDate || undefined, dueTime: dueTime || undefined };
    if (editingTask) updateMutation.mutate({ id: editingTask.id, data });
    else createMutation.mutate(data);
  };

  const handleDrop = (status: string) => {
    if (draggedTask && draggedTask.status !== status) updateStatusMutation.mutate({ id: draggedTask.id, status });
    setDraggedTask(null);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

  return (
    <div className="card">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-primary-400" />
          <h2 className="font-semibold text-white">Aufgaben</h2>
          <span className="text-xs text-slate-500">({tasks.length})</span>
        </div>
        <button onClick={openCreateModal} className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-2 py-1 rounded flex items-center gap-1">
          <Plus className="h-3 w-3" /> Neu
        </button>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-3 gap-3">
          {STATUS_COLUMNS.map((col) => (
            <div
              key={col.key}
              className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.key)}
            >
              <div className={`px-3 py-2 ${col.color} flex items-center justify-between`}>
                <span className="text-xs font-medium text-white">{col.label}</span>
                <span className="text-xs text-white/70">{tasks.filter((t) => t.status === col.key).length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[120px] max-h-[300px] overflow-y-auto">
                {tasks.filter((t) => t.status === col.key).map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => setDraggedTask(task)}
                    className={`bg-slate-700/60 rounded p-2 cursor-grab active:cursor-grabbing border border-slate-600 hover:border-slate-500 ${draggedTask?.id === task.id ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="h-3 w-3 text-slate-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-medium text-white truncate">{task.title}</span>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button onClick={() => openEditModal(task)} className="p-0.5 text-slate-400 hover:text-white"><Edit2 className="h-3 w-3" /></button>
                            <button onClick={() => setConfirmDialog({
                              isOpen: true,
                              title: 'Aufgabe löschen',
                              message: 'Möchtest du diese Aufgabe wirklich löschen?',
                              confirmText: 'Löschen',
                              variant: 'danger',
                              onConfirm: () => deleteMutation.mutate(task.id),
                            })} className="p-0.5 text-slate-400 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        </div>
                        {task.description && (
                          <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${PRIORITY_COLORS[task.priority]}`}>{PRIORITY_LABELS[task.priority]}</span>
                          {task.dueDate && <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />{formatDate(task.dueDate)}{task.dueTime && ` ${task.dueTime}`}</span>}
                        </div>
                        {task.assignees && task.assignees.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <div className="flex -space-x-1">
                              {task.assignees.slice(0, 3).map((a) => (
                                <img key={a.id} src={a.employee.user.avatar || `https://ui-avatars.com/api/?name=${a.employee.user.displayName || a.employee.user.username}&size=16`} className="h-4 w-4 rounded-full border border-slate-700" alt="" title={a.employee.user.displayName || a.employee.user.username} />
                              ))}
                              {task.assignees.length > 3 && (
                                <span className="h-4 w-4 rounded-full bg-slate-600 text-[8px] flex items-center justify-center text-slate-300 border border-slate-700">+{task.assignees.length - 3}</span>
                              )}
                            </div>
                            {task.assignees.length === 1 && (
                              <span className="text-[10px] text-slate-400 truncate">{task.assignees[0].employee.user.displayName || task.assignees[0].employee.user.username}</span>
                            )}
                            {task.assignees.length > 1 && (
                              <span className="text-[10px] text-slate-400">{task.assignees.length} Personen</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-md border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">{editingTask ? 'Bearbeiten' : 'Neue Aufgabe'}</h2>
              <button onClick={closeModal} className="p-1 hover:bg-slate-700 rounded"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="label">Titel</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input" required />
              </div>
              <div>
                <label className="label">Beschreibung</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input h-16 resize-none" />
              </div>
              <div>
                <label className="label">Priorität</label>
                <div className="flex gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH'] as const).map((p) => (
                    <button key={p} type="button" onClick={() => setPriority(p)} className={`flex-1 py-1.5 rounded text-sm font-medium ${priority === p ? PRIORITY_COLORS[p] : 'bg-slate-700 text-slate-300'}`}>
                      {PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Zugewiesen an ({assigneeIds.length} ausgewählt)</label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-700/50 rounded-lg">
                  {employees.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => toggleAssignee(emp.id)}
                      className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                        assigneeIds.includes(emp.id)
                          ? 'bg-primary-600/30 text-primary-400 border border-primary-500'
                          : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                    >
                      {assigneeIds.includes(emp.id) && <Check className="h-3 w-3" />}
                      {emp.user.displayName || emp.user.username}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fällig am</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Uhrzeit</label>
                  <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="input" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="btn-ghost">Abbrechen</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary">
                  {createMutation.isPending || updateMutation.isPending ? '...' : 'Speichern'}
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

// ==================== SANCTIONS WIDGET ====================

function SanctionsWidget() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [hasWarning, setHasWarning] = useState(false);
  const [hasFine, setHasFine] = useState(false);
  const [hasMeasure, setHasMeasure] = useState(false);
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [measure, setMeasure] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [search, setSearch] = useState('');
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
    confirmText: 'Widerrufen',
    variant: 'warning',
    onConfirm: () => {},
  });

  const { data: sanctionsData } = useQuery({
    queryKey: ['sanctions'],
    queryFn: () => sanctionsApi.getAll({ limit: '5', status: 'ACTIVE' }),
  });

  const { data: employeesData } = useQuery({ queryKey: ['employees-list'], queryFn: () => employeesApi.getAll({ limit: '100' }) });

  const sanctions = (sanctionsData?.data?.data || []) as Sanction[];
  const employees = (employeesData?.data?.data || []) as Employee[];
  const filteredEmployees = employees.filter((e) => (e.user.displayName || e.user.username).toLowerCase().includes(search.toLowerCase()));

  const createMutation = useMutation({
    mutationFn: sanctionsApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sanctions'] }); closeModal(); toast.success('Sanktion erstellt'); },
  });

  const revokeMutation = useMutation({
    mutationFn: sanctionsApi.revoke,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sanctions'] }); toast.success('Widerrufen'); },
  });

  const completeMutation = useMutation({
    mutationFn: sanctionsApi.complete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sanctions'] }); toast.success('Als erledigt markiert'); },
  });

  const toggleTypeMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: 'warning' | 'fine' | 'measure' }) =>
      sanctionsApi.toggleType(id, type),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sanctions'] }); },
  });

  const closeModal = () => {
    setShowModal(false);
    setHasWarning(false);
    setHasFine(false);
    setHasMeasure(false);
    setReason('');
    setAmount('');
    setMeasure('');
    setEmployeeId('');
    setSearch('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !reason.trim() || (!hasWarning && !hasFine && !hasMeasure)) {
      toast.error('Bitte alle Felder ausfüllen');
      return;
    }
    createMutation.mutate({
      employeeId,
      hasWarning,
      hasFine,
      hasMeasure,
      reason: reason.trim(),
      amount: hasFine && amount ? parseInt(amount) : undefined,
      measure: hasMeasure && measure ? measure.trim() : undefined,
    });
  };

  const getSanctionTypes = (s: Sanction) => {
    const t = [];
    if (s.hasWarning) t.push({ label: 'Verwarnung', color: 'text-yellow-400' });
    if (s.hasFine) t.push({ label: 'Geldstrafe', color: 'text-red-400' });
    if (s.hasMeasure) t.push({ label: 'Maßnahme', color: 'text-orange-400' });
    return t;
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v);

  return (
    <div className="card">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary-400" />
          <h2 className="font-semibold text-white">Aktive Sanktionen</h2>
          <span className="text-xs text-slate-500">({sanctions.length})</span>
        </div>
        <button onClick={() => setShowModal(true)} className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-2 py-1 rounded flex items-center gap-1">
          <Plus className="h-3 w-3" /> Neu
        </button>
      </div>

      <div className="p-4 space-y-2">
        {sanctions.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">Keine aktiven Sanktionen</p>
        ) : (
          sanctions.map((s) => {
            const types = getSanctionTypes(s);
            return (
              <div key={s.id} className="bg-slate-700/30 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  {/* Checkboxen für jeden Typ */}
                  <div className="flex flex-col gap-1.5 mt-0.5">
                    {s.hasWarning && (
                      <button
                        onClick={() => toggleTypeMutation.mutate({ id: s.id, type: 'warning' })}
                        className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
                          s.warningCompleted
                            ? 'border-yellow-500 bg-yellow-500/20'
                            : 'border-slate-500 hover:border-yellow-500 hover:bg-yellow-500/10'
                        }`}
                        title="Verwarnung abhaken"
                      >
                        {s.warningCompleted && <Check className="h-3 w-3 text-yellow-400" />}
                      </button>
                    )}
                    {s.hasFine && (
                      <button
                        onClick={() => toggleTypeMutation.mutate({ id: s.id, type: 'fine' })}
                        className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
                          s.fineCompleted
                            ? 'border-red-500 bg-red-500/20'
                            : 'border-slate-500 hover:border-red-500 hover:bg-red-500/10'
                        }`}
                        title="Geldstrafe abhaken"
                      >
                        {s.fineCompleted && <Check className="h-3 w-3 text-red-400" />}
                      </button>
                    )}
                    {s.hasMeasure && (
                      <button
                        onClick={() => toggleTypeMutation.mutate({ id: s.id, type: 'measure' })}
                        className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
                          s.measureCompleted
                            ? 'border-orange-500 bg-orange-500/20'
                            : 'border-slate-500 hover:border-orange-500 hover:bg-orange-500/10'
                        }`}
                        title="Maßnahme abhaken"
                      >
                        {s.measureCompleted && <Check className="h-3 w-3 text-orange-400" />}
                      </button>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {types.map((t, i) => (
                        <span key={i} className={`text-xs font-medium ${t.color}`}>{t.label}</span>
                      ))}
                      {s.hasFine && s.amount && <span className="text-xs font-bold text-red-400">{formatCurrency(s.amount)}</span>}
                    </div>
                    <p className="text-white text-sm mt-1 line-clamp-1">{s.reason}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <span>{s.employee.user.displayName || s.employee.user.username}</span>
                      <ChevronRight className="h-3 w-3" />
                      <span>{s.issuedBy.displayName || s.issuedBy.username}</span>
                    </div>
                  </div>
                  <button onClick={() => setConfirmDialog({
                    isOpen: true,
                    title: 'Sanktion widerrufen',
                    message: 'Möchtest du diese Sanktion wirklich widerrufen?',
                    confirmText: 'Widerrufen',
                    variant: 'warning',
                    onConfirm: () => revokeMutation.mutate(s.id),
                  })} className="text-xs bg-slate-600 hover:bg-slate-500 text-slate-300 px-2 py-1 rounded ml-2 flex-shrink-0">
                    Widerrufen
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-md mx-4 border border-slate-700/50 shadow-2xl shadow-black/50 max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Neue Sanktion</h2>
              <button onClick={closeModal} className="p-1 hover:bg-slate-700 rounded"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Types */}
              <div>
                <label className="label">Typ(en)</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setHasWarning(!hasWarning)} className={`flex-1 py-2 rounded text-sm font-medium flex items-center justify-center gap-1 ${hasWarning ? 'bg-yellow-600/30 text-yellow-400 border border-yellow-500' : 'bg-slate-700 text-slate-400'}`}>
                    {hasWarning && <Check className="h-3 w-3" />} Verwarnung
                  </button>
                  <button type="button" onClick={() => setHasFine(!hasFine)} className={`flex-1 py-2 rounded text-sm font-medium flex items-center justify-center gap-1 ${hasFine ? 'bg-red-600/30 text-red-400 border border-red-500' : 'bg-slate-700 text-slate-400'}`}>
                    {hasFine && <Check className="h-3 w-3" />} Geldstrafe
                  </button>
                  <button type="button" onClick={() => setHasMeasure(!hasMeasure)} className={`flex-1 py-2 rounded text-sm font-medium flex items-center justify-center gap-1 ${hasMeasure ? 'bg-orange-600/30 text-orange-400 border border-orange-500' : 'bg-slate-700 text-slate-400'}`}>
                    {hasMeasure && <Check className="h-3 w-3" />} Maßnahme
                  </button>
                </div>
              </div>

              {/* Employee */}
              <div>
                <label className="label">Mitarbeiter</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Suchen..." />
                </div>
                {search && (
                  <div className="mt-1 max-h-32 overflow-y-auto bg-slate-700 rounded-lg">
                    {filteredEmployees.slice(0, 5).map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => { setEmployeeId(e.id); setSearch(e.user.displayName || e.user.username); }}
                        className={`w-full p-2 text-left text-sm hover:bg-slate-600 ${employeeId === e.id ? 'bg-slate-600' : ''}`}
                      >
                        {e.user.displayName || e.user.username}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="label">Grund</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="input h-16 resize-none" required />
              </div>

              {/* Amount */}
              {hasFine && (
                <div>
                  <label className="label">Betrag ($)</label>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="5000" />
                </div>
              )}

              {/* Measure */}
              {hasMeasure && (
                <div>
                  <label className="label">Maßnahme</label>
                  <input type="text" value={measure} onChange={(e) => setMeasure(e.target.value)} className="input" placeholder="z.B. 2 Wochen Streife" />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="btn-ghost">Abbrechen</button>
                <button type="submit" disabled={createMutation.isPending} className="btn-primary">{createMutation.isPending ? '...' : 'Erstellen'}</button>
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
