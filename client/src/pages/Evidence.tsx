import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evidenceApi } from '../services/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import MaterialIcon from '../components/ui/MaterialIcon';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import {
  Plus,
  X,
  Search,
  Package,
  Archive,
  ArchiveX,
  Filter,
  RefreshCw,
  User,
  Flame,
  CheckSquare,
  Square,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Evidence {
  id: string;
  name: string;
  description: string | null;
  category: string;
  quantity: number;
  location: string | null;
  caseNumber: string | null;
  status: string;
  storedBy: { displayName: string | null; username: string; avatar: string | null };
  releasedBy: { displayName: string | null; username: string; avatar: string | null } | null;
  releasedAt: string | null;
  releaseReason: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  eingelagert: number;
  ausgelagert: number;
  vernichtet: number;
  byCategory: { category: string; count: number }[];
}

// Item für Multi-Einlagerung
interface EvidenceItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
}

const CATEGORIES = [
  { value: 'WAFFEN', label: 'Waffen', icon: 'local_fire_department', color: 'bg-red-600/20 text-red-400 border-red-500/50' },
  { value: 'DROGEN', label: 'Drogen', icon: 'medication', color: 'bg-purple-600/20 text-purple-400 border-purple-500/50' },
  { value: 'SONSTIGES', label: 'Sonstiges', icon: 'inventory_2', color: 'bg-slate-600/20 text-slate-400 border-slate-500/50' },
];

// Keywords für automatische Kategorisierung
const WEAPON_KEYWORDS = [
  'pistole', 'revolver', 'gewehr', 'rifle', 'shotgun', 'schrotflinte', 'mp', 'smg', 'maschinenpistole',
  'messer', 'knife', 'machete', 'schwert', 'axt', 'baseballschläger', 'schlagstock', 'knüppel',
  'munition', 'ammo', 'patronen', 'magazin', 'waffe', 'gun', 'glock', 'ak', 'uzi', 'tec',
  'sniper', 'rpg', 'granate', 'bombe', 'sprengstoff', 'c4', 'deagle', 'desert eagle',
  'carbine', 'assault', 'combat', 'micro smg', 'mini smg', 'heavy pistol', 'sns pistol',
  'vintage pistol', 'marksman', 'bullpup', 'advanced rifle', 'special carbine',
  'schlagring', 'butterfly', 'balisong', 'stiletto', 'dolch', 'kampfmesser',
];

const DRUG_KEYWORDS = [
  'kokain', 'cocaine', 'koks', 'heroin', 'meth', 'crystal', 'amphetamin', 'speed',
  'marihuana', 'marijuana', 'cannabis', 'weed', 'gras', 'haschisch', 'hash',
  'ecstasy', 'mdma', 'xtc', 'lsd', 'acid', 'pillen', 'pills', 'tabletten',
  'crack', 'opium', 'morphin', 'fentanyl', 'oxy', 'oxycodon', 'xanax', 'valium',
  'ketamin', 'ghb', 'pcp', 'dmt', 'shrooms', 'pilze', 'mushrooms', 'spice',
  'droge', 'drogen', 'drug', 'drugs', 'stoff', 'substanz', 'betäubungsmittel', 'btm',
  'joint', 'blunt', 'bong', 'pipe', 'spritze', 'nadel', 'needle', 'syringe',
];

// Funktion zur automatischen Kategorisierung
function autoCategorize(itemName: string): string {
  const lowerName = itemName.toLowerCase().trim();

  // Prüfe auf Waffen-Keywords
  for (const keyword of WEAPON_KEYWORDS) {
    if (lowerName.includes(keyword)) {
      return 'WAFFEN';
    }
  }

  // Prüfe auf Drogen-Keywords
  for (const keyword of DRUG_KEYWORDS) {
    if (lowerName.includes(keyword)) {
      return 'DROGEN';
    }
  }

  // Standard: Sonstiges
  return 'SONSTIGES';
}

const STATUS_OPTIONS = [
  { value: 'EINGELAGERT', label: 'Eingelagert', color: 'bg-green-600/20 text-green-400' },
  { value: 'AUSGELAGERT', label: 'Ausgelagert', color: 'bg-yellow-600/20 text-yellow-400' },
  { value: 'VERNICHTET', label: 'Vernichtet', color: 'bg-red-600/20 text-red-400' },
  { value: 'FREIGEGEBEN', label: 'Freigegeben', color: 'bg-blue-600/20 text-blue-400' },
];

export default function Evidence() {
  const queryClient = useQueryClient();
  useLiveUpdates();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null);
  const [releasingEvidence, setReleasingEvidence] = useState<Evidence | null>(null);

  // Multi-Item Form State
  const [items, setItems] = useState<EvidenceItem[]>([{ id: '1', name: '', category: 'SONSTIGES', quantity: 1 }]);
  const [suspect, setSuspect] = useState('');

  // Single Edit Form State
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('SONSTIGES');
  const [editQuantity, setEditQuantity] = useState('1');
  const [editSuspect, setEditSuspect] = useState('');

  // Release form state
  const [releaseStatus, setReleaseStatus] = useState('AUSGELAGERT');
  const [releaseReason, setReleaseReason] = useState('');

  // Selection state for bulk destroy
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
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
    confirmText: 'Vernichten',
    variant: 'danger',
    onConfirm: () => {},
  });

  // Destroy modal state
  const [showDestroyModal, setShowDestroyModal] = useState(false);
  const [destroyingEvidence, setDestroyingEvidence] = useState<Evidence | null>(null);
  const [destroyQuantity, setDestroyQuantity] = useState('1');

  const { data: evidenceData, isLoading } = useQuery({
    queryKey: ['evidence', search, filterCategory],
    queryFn: () => evidenceApi.getAll({
      search: search || undefined,
      category: filterCategory || undefined,
      limit: '100',
    } as Record<string, string>),
  });

  const { data: statsData } = useQuery({
    queryKey: ['evidence-stats'],
    queryFn: () => evidenceApi.getStats(),
  });

  const evidence = (evidenceData?.data?.data || []) as Evidence[];
  const stats = statsData?.data as Stats | undefined;

  const createMutation = useMutation({
    mutationFn: evidenceApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['evidence-stats'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => evidenceApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      closeModal();
      toast.success('Asservat aktualisiert');
    },
  });

  const releaseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: string; releaseReason?: string } }) => evidenceApi.release(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['evidence-stats'] });
      closeReleaseModal();
      toast.success('Asservat ausgelagert');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: evidenceApi.restore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['evidence-stats'] });
      toast.success('Asservat wiedereingelagert');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: evidenceApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['evidence-stats'] });
      toast.success('Asservat gelöscht');
    },
  });

  const destroyBulkMutation = useMutation({
    mutationFn: evidenceApi.destroyBulk,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['evidence-stats'] });
      setSelectedIds(new Set());
      setIsSelectMode(false);
      toast.success(`${variables.length} Asservat${variables.length > 1 ? 'en' : ''} vernichtet`);
    },
  });

  const destroyMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity?: number }) => evidenceApi.destroy(id, quantity),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['evidence-stats'] });
      closeDestroyModal();
      const qty = variables.quantity || destroyingEvidence?.quantity || 1;
      toast.success(`${qty}x vernichtet`);
    },
  });

  const openCreateModal = () => {
    setEditingEvidence(null);
    setItems([{ id: '1', name: '', category: 'SONSTIGES', quantity: 1 }]);
    setSuspect('');
    setShowModal(true);
  };

  const openEditModal = (e: Evidence) => {
    setEditingEvidence(e);
    setEditName(e.name);
    setEditCategory(e.category);
    setEditQuantity(String(e.quantity));
    setEditSuspect(e.description || '');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEvidence(null);
  };

  const openReleaseModal = (e: Evidence) => {
    setReleasingEvidence(e);
    setReleaseStatus('AUSGELAGERT');
    setReleaseReason('');
    setShowReleaseModal(true);
  };

  const closeReleaseModal = () => {
    setShowReleaseModal(false);
    setReleasingEvidence(null);
  };

  const openDestroyModal = (e: Evidence) => {
    setDestroyingEvidence(e);
    setDestroyQuantity(String(e.quantity));
    setShowDestroyModal(true);
  };

  const closeDestroyModal = () => {
    setShowDestroyModal(false);
    setDestroyingEvidence(null);
    setDestroyQuantity('1');
  };

  const handleDestroy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destroyingEvidence) return;

    const qty = parseInt(destroyQuantity);
    if (qty <= 0 || qty > destroyingEvidence.quantity) {
      toast.error('Ungültige Menge');
      return;
    }

    destroyMutation.mutate({
      id: destroyingEvidence.id,
      quantity: qty,
    });
  };

  // Multi-Item Functions
  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), name: '', category: 'SONSTIGES', quantity: 1 }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof EvidenceItem, value: string | number) => {
    setItems(items.map(i => {
      if (i.id !== id) return i;

      const updated = { ...i, [field]: value };

      // Auto-Kategorisierung wenn Name geändert wird
      if (field === 'name' && typeof value === 'string') {
        updated.category = autoCategorize(value);
      }

      return updated;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingEvidence) {
      // Single Edit
      if (!editName.trim()) {
        toast.error('Bezeichnung ist erforderlich');
        return;
      }
      updateMutation.mutate({
        id: editingEvidence.id,
        data: {
          name: editName.trim(),
          category: editCategory,
          quantity: parseInt(editQuantity) || 1,
          description: editSuspect.trim() || undefined,
        },
      });
    } else {
      // Multi-Create
      const validItems = items.filter(i => i.name.trim());
      if (validItems.length === 0) {
        toast.error('Mindestens ein Gegenstand ist erforderlich');
        return;
      }

      try {
        for (const item of validItems) {
          await createMutation.mutateAsync({
            name: item.name.trim(),
            category: item.category,
            quantity: item.quantity,
            description: suspect.trim() || undefined,
          });
        }
        closeModal();
        toast.success(`${validItems.length} Asservat${validItems.length > 1 ? 'en' : ''} eingelagert`);
      } catch {
        toast.error('Fehler beim Einlagern');
      }
    }
  };

  const handleRelease = (e: React.FormEvent) => {
    e.preventDefault();
    if (!releasingEvidence) return;

    releaseMutation.mutate({
      id: releasingEvidence.id,
      data: {
        status: releaseStatus,
        releaseReason: releaseReason.trim() || undefined,
      },
    });
  };

  const getCategoryInfo = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[2];
  const getStatusInfo = (status: string) => STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];

  // Selection functions
  const eingelagerteEvidence = evidence.filter(e => e.status === 'EINGELAGERT');

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === eingelagerteEvidence.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eingelagerteEvidence.map(e => e.id)));
    }
  };

  const handleDestroySelected = () => {
    if (selectedIds.size === 0) {
      toast.error('Keine Asservate ausgewählt');
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: 'Asservate vernichten',
      message: `Möchtest du wirklich ${selectedIds.size} Asservat${selectedIds.size > 1 ? 'en' : ''} vernichten? Diese Aktion kann nicht rückgängig gemacht werden.`,
      confirmText: 'Vernichten',
      variant: 'danger',
      onConfirm: () => destroyBulkMutation.mutate(Array.from(selectedIds)),
    });
  };

  const cancelSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-6">
      {/* Header mit Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600/20 via-slate-800 to-emerald-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/20 rounded-2xl backdrop-blur-sm border border-purple-500/30 shadow-lg shadow-purple-500/20">
              <Package className="h-8 w-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Asservaten</h1>
              <p className="text-slate-400 mt-0.5">Verwaltung von beschlagnahmten Gegenständen</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSelectMode ? (
              <>
                <button
                  onClick={toggleSelectAll}
                  className="btn-ghost flex items-center gap-2 backdrop-blur-sm"
                >
                  {selectedIds.size === eingelagerteEvidence.length ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  Alle auswählen
                </button>
                <button onClick={cancelSelectMode} className="btn-ghost flex items-center gap-2 backdrop-blur-sm">
                  <X className="h-4 w-4" />
                  Abbrechen
                </button>
                <button
                  onClick={handleDestroySelected}
                  disabled={selectedIds.size === 0 || destroyBulkMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-red-500/20"
                >
                  <Flame className="h-4 w-4" />
                  {destroyBulkMutation.isPending ? 'Wird vernichtet...' : `${selectedIds.size} Vernichten`}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsSelectMode(true)}
                  className="bg-red-600/20 text-red-400 hover:bg-red-600/30 px-4 py-2 rounded-xl flex items-center gap-2 transition-all border border-red-500/30"
                >
                  <Flame className="h-4 w-4" />
                  Vernichten
                </button>
                <button onClick={openCreateModal} className="btn-primary flex items-center gap-2 shadow-lg shadow-primary-500/20">
                  <Plus className="h-4 w-4" />
                  Einlagern
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 bg-gradient-to-br from-purple-900/30 to-slate-800/50 border-purple-700/30 hover:border-purple-600/50 transition-all group">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/20 rounded-xl group-hover:scale-110 transition-transform">
              <Package className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-400">{stats?.total || 0}</p>
              <p className="text-xs text-slate-400">Gesamt erfasst</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-green-900/30 to-slate-800/50 border-green-700/30 hover:border-green-600/50 transition-all group">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-500/20 rounded-xl group-hover:scale-110 transition-transform">
              <Archive className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">{stats?.eingelagert || 0}</p>
              <p className="text-xs text-slate-400">Eingelagert</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-amber-900/30 to-slate-800/50 border-amber-700/30 hover:border-amber-600/50 transition-all group">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 rounded-xl group-hover:scale-110 transition-transform">
              <ArchiveX className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">{stats?.ausgelagert || 0}</p>
              <p className="text-xs text-slate-400">Ausgelagert</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-red-900/30 to-slate-800/50 border-red-700/30 hover:border-red-600/50 transition-all group">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500/20 rounded-xl group-hover:scale-110 transition-transform">
              <Flame className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{stats?.vernichtet || 0}</p>
              <p className="text-xs text-slate-400">Vernichtet</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 backdrop-blur-xl bg-slate-800/80">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[250px]">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-purple-400 transition-colors" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10 focus:border-purple-500/50 focus:ring-purple-500/20"
                placeholder="Suchen nach Name oder Tatverdächtiger..."
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="input w-44"
            >
              <option value="">Alle Kategorien</option>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Evidence Grid */}
      <div className="grid gap-4">
        {isLoading ? (
          <div className="card p-12 text-center">
            <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto" />
            <p className="text-slate-400 mt-3">Lädt...</p>
          </div>
        ) : evidence.length === 0 ? (
          <div className="card p-12 text-center">
            <Package className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">Keine Asservaten gefunden</p>
            <p className="text-slate-500 text-sm mt-1">Klicke auf "Einlagern" um neue Gegenstände hinzuzufügen</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {evidence.map((e) => {
              const catInfo = getCategoryInfo(e.category);
              const statusInfo = getStatusInfo(e.status);
              const isSelected = selectedIds.has(e.id);
              const canSelect = isSelectMode && e.status === 'EINGELAGERT';
              return (
                <div
                  key={e.id}
                  className={`card p-4 hover:bg-slate-750 transition-colors ${isSelected ? 'ring-2 ring-red-500 bg-red-900/10' : ''} ${canSelect ? 'cursor-pointer' : ''}`}
                  onClick={canSelect ? () => toggleSelect(e.id) : undefined}
                >
                  <div className="flex items-center gap-4">
                    {/* Checkbox in select mode */}
                    {isSelectMode && e.status === 'EINGELAGERT' && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); toggleSelect(e.id); }}
                        className="text-slate-400 hover:text-white"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-6 w-6 text-red-400" />
                        ) : (
                          <Square className="h-6 w-6" />
                        )}
                      </button>
                    )}

                    {/* Category Icon */}
                    <div className={`p-3 rounded-xl ${catInfo.color}`}>
                      <MaterialIcon name={catInfo.icon} size={24} filled />
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-white text-lg">{e.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span className="font-medium">{e.quantity}x</span>
                        <span>{catInfo.label}</span>
                        {e.description && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {e.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stored By */}
                    <div className="hidden md:flex items-center gap-2 text-sm">
                      <img
                        src={e.storedBy.avatar || `https://ui-avatars.com/api/?name=${e.storedBy.displayName || e.storedBy.username}&size=32&background=334155&color=fff`}
                        className="h-8 w-8 rounded-full"
                        alt=""
                      />
                      <div className="text-right">
                        <p className="text-slate-300">{e.storedBy.displayName || e.storedBy.username}</p>
                        <p className="text-slate-500 text-xs">{formatDate(e.createdAt)}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    {!isSelectMode && e.status === 'EINGELAGERT' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(ev) => { ev.stopPropagation(); openDestroyModal(e); }}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Vernichten"
                        >
                          <Flame className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(ev) => { ev.stopPropagation(); openReleaseModal(e); }}
                          className="p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors"
                          title="Auslagern"
                        >
                          <ArchiveX className="h-5 w-5" />
                        </button>
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl w-full max-w-2xl border border-slate-700/50 shadow-2xl shadow-black/50 max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {editingEvidence ? 'Asservat bearbeiten' : 'Asservaten einlagern'}
                </h2>
                {!editingEvidence && (
                  <p className="text-sm text-slate-400 mt-1">Füge mehrere Gegenstände gleichzeitig hinzu</p>
                )}
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {editingEvidence ? (
                  // Single Edit Form
                  <>
                    <div>
                      <label className="label">Bezeichnung *</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => {
                          const newName = e.target.value;
                          setEditName(newName);
                          // Auto-Kategorisierung
                          setEditCategory(autoCategorize(newName));
                        }}
                        className="input"
                        placeholder="z.B. Glock 17"
                        required
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="label mb-0">Kategorie</label>
                        {editName.trim() && autoCategorize(editName) !== 'SONSTIGES' && (
                          <span className="text-[10px] bg-green-600/80 text-white px-1.5 py-0.5 rounded">
                            Auto erkannt
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {CATEGORIES.map(c => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setEditCategory(c.value)}
                            className={`py-3 px-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                              editCategory === c.value
                                ? c.color + ' border-2'
                                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 border-2 border-transparent'
                            }`}
                          >
                            <MaterialIcon name={c.icon} size={20} filled />
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="label">Menge</label>
                      <input
                        type="number"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(e.target.value)}
                        className="input w-32"
                        min="1"
                      />
                    </div>

                    <div>
                      <label className="label">Tatverdächtiger</label>
                      <input
                        type="text"
                        value={editSuspect}
                        onChange={(e) => setEditSuspect(e.target.value)}
                        className="input"
                        placeholder="Name des Tatverdächtigen..."
                      />
                    </div>
                  </>
                ) : (
                  // Multi-Create Form
                  <>
                    {/* Items List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="label mb-0">Gegenstände</label>
                        <button
                          type="button"
                          onClick={addItem}
                          className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
                        >
                          <Plus className="h-4 w-4" />
                          Hinzufügen
                        </button>
                      </div>

                      {items.map((item, index) => (
                        <div key={item.id} className="bg-slate-700/30 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-400 font-medium">Gegenstand {index + 1}</span>
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="text-slate-500 hover:text-red-400 transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-5">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                className="input"
                                placeholder="Bezeichnung..."
                              />
                            </div>
                            <div className="col-span-5">
                              <div className="relative">
                                <select
                                  value={item.category}
                                  onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                                  className={`input ${item.name.trim() && autoCategorize(item.name) !== 'SONSTIGES' ? 'border-green-500/50' : ''}`}
                                >
                                  {CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                  ))}
                                </select>
                                {item.name.trim() && autoCategorize(item.name) !== 'SONSTIGES' && (
                                  <span className="absolute -top-2 right-2 text-[10px] bg-green-600/80 text-white px-1.5 py-0.5 rounded">
                                    Auto
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="col-span-2">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                className="input text-center"
                                min="1"
                                placeholder="Menge"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Suspect */}
                    <div>
                      <label className="label">Tatverdächtiger</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={suspect}
                          onChange={(e) => setSuspect(e.target.value)}
                          className="input pl-10"
                          placeholder="Name des Tatverdächtigen (optional)..."
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Submit */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                  <button type="button" onClick={closeModal} className="btn-ghost px-5">
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="btn-primary flex items-center gap-2 px-5"
                  >
                    <Archive className="h-4 w-4" />
                    {createMutation.isPending || updateMutation.isPending
                      ? 'Wird gespeichert...'
                      : editingEvidence
                        ? 'Speichern'
                        : `${items.filter(i => i.name.trim()).length || 0} Einlagern`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Release Modal */}
      {showReleaseModal && releasingEvidence && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl w-full max-w-md border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Asservat auslagern</h2>
              <button onClick={closeReleaseModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6">
              {/* Item Info */}
              <div className="bg-slate-700/30 rounded-xl p-4 mb-5 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${getCategoryInfo(releasingEvidence.category).color}`}>
                  <MaterialIcon name={getCategoryInfo(releasingEvidence.category).icon} size={24} filled />
                </div>
                <div>
                  <p className="font-semibold text-white">{releasingEvidence.name}</p>
                  <p className="text-sm text-slate-400">{releasingEvidence.quantity}x • {getCategoryInfo(releasingEvidence.category).label}</p>
                </div>
              </div>

              <form onSubmit={handleRelease} className="space-y-4">
                <div>
                  <label className="label">Status</label>
                  <div className="grid grid-cols-3 gap-2">
                    {STATUS_OPTIONS.filter(s => s.value !== 'EINGELAGERT').map(s => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setReleaseStatus(s.value)}
                        className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                          releaseStatus === s.value
                            ? s.color + ' ring-2 ring-current'
                            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Grund</label>
                  <textarea
                    value={releaseReason}
                    onChange={(e) => setReleaseReason(e.target.value)}
                    className="input h-24 resize-none"
                    placeholder="Grund für die Auslagerung..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={closeReleaseModal} className="btn-ghost px-5">
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={releaseMutation.isPending}
                    className="btn-primary flex items-center gap-2 px-5"
                  >
                    <ArchiveX className="h-4 w-4" />
                    {releaseMutation.isPending ? 'Wird ausgelagert...' : 'Auslagern'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Destroy Modal */}
      {showDestroyModal && destroyingEvidence && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl w-full max-w-md border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Asservat vernichten</h2>
              <button onClick={closeDestroyModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6">
              {/* Item Info */}
              <div className="bg-slate-700/30 rounded-xl p-4 mb-5 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${getCategoryInfo(destroyingEvidence.category).color}`}>
                  <MaterialIcon name={getCategoryInfo(destroyingEvidence.category).icon} size={24} filled />
                </div>
                <div>
                  <p className="font-semibold text-white">{destroyingEvidence.name}</p>
                  <p className="text-sm text-slate-400">Verfügbar: {destroyingEvidence.quantity}x • {getCategoryInfo(destroyingEvidence.category).label}</p>
                </div>
              </div>

              <form onSubmit={handleDestroy} className="space-y-4">
                <div>
                  <label className="label">Menge zum Vernichten</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={destroyQuantity}
                      onChange={(e) => setDestroyQuantity(e.target.value)}
                      className="input w-32 text-center"
                      min="1"
                      max={destroyingEvidence.quantity}
                    />
                    <span className="text-slate-400">von {destroyingEvidence.quantity}</span>
                    <button
                      type="button"
                      onClick={() => setDestroyQuantity(String(destroyingEvidence.quantity))}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Alle
                    </button>
                  </div>
                  {parseInt(destroyQuantity) < destroyingEvidence.quantity && (
                    <p className="text-xs text-slate-500 mt-2">
                      Nach Vernichtung bleiben {destroyingEvidence.quantity - parseInt(destroyQuantity || '0')}x übrig
                    </p>
                  )}
                </div>

                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3">
                  <p className="text-red-400 text-sm">
                    Diese Aktion kann nicht rückgängig gemacht werden.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={closeDestroyModal} className="btn-ghost px-5">
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={destroyMutation.isPending || parseInt(destroyQuantity) <= 0 || parseInt(destroyQuantity) > destroyingEvidence.quantity}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl flex items-center gap-2 transition-all"
                  >
                    <Flame className="h-4 w-4" />
                    {destroyMutation.isPending ? 'Wird vernichtet...' : `${destroyQuantity}x Vernichten`}
                  </button>
                </div>
              </form>
            </div>
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
