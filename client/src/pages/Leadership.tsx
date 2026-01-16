import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, employeesApi, sanctionsApi, treasuryApi, announcementsApi, notificationsApi } from '../services/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';
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
} from 'lucide-react';
import toast from 'react-hot-toast';

// ==================== TYPES ====================

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate: string | null;
  assignee: {
    id: string;
    user: { displayName: string | null; username: string; avatar: string | null };
  } | null;
  createdBy: { displayName: string | null; username: string };
  createdAt: string;
}

interface Sanction {
  id: string;
  hasWarning: boolean;
  hasFine: boolean;
  hasMeasure: boolean;
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
        <TasksWidget />
        <SanctionsWidget />
      </div>
    </div>
  );
}

// ==================== TREASURY WIDGET ====================

function TreasuryWidget() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [moneyType, setMoneyType] = useState<'REGULAR' | 'BLACK'>('REGULAR');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const { data: treasuryData } = useQuery({
    queryKey: ['treasury'],
    queryFn: () => treasuryApi.get(),
  });

  const treasury = treasuryData?.data as Treasury | undefined;

  const depositMutation = useMutation({
    mutationFn: treasuryApi.deposit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury'] });
      closeModal();
      toast.success('Einzahlung erfolgreich');
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: treasuryApi.withdraw,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury'] });
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

  return (
    <div className="card">
      <div className="p-4 border-b border-slate-700 flex items-center gap-2">
        <Wallet className="h-5 w-5 text-primary-400" />
        <h2 className="font-semibold text-white">Kasse</h2>
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
    </div>
  );
}

// ==================== ANNOUNCEMENTS WIDGET ====================

// Hardcoded Discord Channels
const ANNOUNCEMENT_CHANNELS = [
  { id: '935022121468440626', name: 'IC Ankündigungen' },
  { id: '1015781213669163008', name: 'OOC Ankündigungen' },
];

interface DiscordRole {
  id: string;
  name: string;
  color: number;
}

function AnnouncementsWidget() {
  const [activeTab, setActiveTab] = useState<'discord' | 'inapp'>('discord');

  // Discord state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [channelId, setChannelId] = useState(ANNOUNCEMENT_CHANNELS[0].id);

  // In-App state
  const [inAppTitle, setInAppTitle] = useState('');
  const [inAppMessage, setInAppMessage] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [broadcastToAll, setBroadcastToAll] = useState(false);

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

  const selectedChannel = ANNOUNCEMENT_CHANNELS.find(c => c.id === channelId);

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
      </div>

      <div className="p-4">
        {activeTab === 'discord' ? (
          // Discord Announcement Form
          <form onSubmit={handleDiscordSubmit} className="space-y-3">
            <div>
              <label className="label">Kanal</label>
              <div className="flex gap-2">
                {ANNOUNCEMENT_CHANNELS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChannelId(c.id)}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
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

            <button
              type="submit"
              disabled={sendDiscordMutation.isPending || !title.trim() || !content.trim()}
              className="w-full btn-primary flex items-center justify-center gap-2 py-2.5"
            >
              <Send className="h-4 w-4" />
              {sendDiscordMutation.isPending ? 'Wird gesendet...' : `An #${selectedChannel?.name} senden`}
            </button>
          </form>
        ) : (
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
        )}
      </div>
    </div>
  );
}

// ==================== TASKS WIDGET ====================

function TasksWidget() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
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
  const { data: employeesData } = useQuery({ queryKey: ['employees-list'], queryFn: () => employeesApi.getAll({ limit: '100' }) });

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

  const openCreateModal = () => { setEditingTask(null); setTitle(''); setDescription(''); setPriority('MEDIUM'); setAssigneeId(''); setDueDate(''); setShowModal(true); };
  const openEditModal = (t: Task) => { setEditingTask(t); setTitle(t.title); setDescription(t.description || ''); setPriority(t.priority); setAssigneeId(t.assignee?.id || ''); setDueDate(t.dueDate?.split('T')[0] || ''); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingTask(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const data = { title: title.trim(), description: description.trim() || undefined, priority, assigneeId: assigneeId || undefined, dueDate: dueDate || undefined };
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
                        <div className="flex items-center gap-1 mt-1">
                          <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${PRIORITY_COLORS[task.priority]}`}>{PRIORITY_LABELS[task.priority]}</span>
                          {task.dueDate && <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />{formatDate(task.dueDate)}</span>}
                        </div>
                        {task.assignee && (
                          <div className="flex items-center gap-1 mt-1">
                            <img src={task.assignee.user.avatar || `https://ui-avatars.com/api/?name=${task.assignee.user.displayName || task.assignee.user.username}&size=16`} className="h-4 w-4 rounded-full" alt="" />
                            <span className="text-[10px] text-slate-400 truncate">{task.assignee.user.displayName || task.assignee.user.username}</span>
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-md mx-4 border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Zugewiesen</label>
                  <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="input">
                    <option value="">-</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.user.displayName || e.user.username}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Fällig</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
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
                  {/* Checkbox zum Abhaken */}
                  <button
                    onClick={() => setConfirmDialog({
                      isOpen: true,
                      title: 'Sanktion als erledigt markieren',
                      message: 'Möchtest du diese Sanktion als erledigt markieren?',
                      confirmText: 'Erledigt',
                      variant: 'default',
                      onConfirm: () => completeMutation.mutate(s.id),
                    })}
                    className="mt-1 h-5 w-5 rounded border-2 border-slate-500 hover:border-green-500 hover:bg-green-500/20 flex items-center justify-center transition-colors flex-shrink-0"
                    title="Als erledigt markieren"
                  >
                    <Check className="h-3 w-3 text-transparent hover:text-green-400" />
                  </button>
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
                  })} className="text-xs bg-slate-600 hover:bg-slate-500 text-slate-300 px-2 py-1 rounded ml-2">
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
