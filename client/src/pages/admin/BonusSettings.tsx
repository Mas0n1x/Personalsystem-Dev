import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bonusApi } from '../../services/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {
  DollarSign,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface BonusConfig {
  id: string;
  activityType: string;
  displayName: string;
  description: string | null;
  amount: number;
  isActive: boolean;
  category: string;
}

const CATEGORIES = [
  { id: 'HR', name: 'Human Resources', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { id: 'ACADEMY', name: 'Academy', color: 'text-green-400', bg: 'bg-green-500/10' },
  { id: 'IA', name: 'Internal Affairs', color: 'text-red-400', bg: 'bg-red-500/10' },
  { id: 'DETECTIVE', name: 'Detektive', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { id: 'GENERAL', name: 'Allgemein', color: 'text-slate-400', bg: 'bg-slate-500/10' },
];

export default function BonusSettings() {
  const queryClient = useQueryClient();
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['HR', 'ACADEMY', 'IA', 'DETECTIVE', 'GENERAL']);
  const [editingConfig, setEditingConfig] = useState<BonusConfig | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newConfig, setNewConfig] = useState({
    activityType: '',
    displayName: '',
    description: '',
    amount: 0,
    category: 'GENERAL',
  });
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

  const { data: configsData, isLoading } = useQuery({
    queryKey: ['bonus-configs'],
    queryFn: async () => {
      const res = await bonusApi.getConfigs();
      return res.data as BonusConfig[];
    },
  });

  const configs = configsData || [];

  const initConfigsMutation = useMutation({
    mutationFn: bonusApi.initConfigs,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['bonus-configs'] });
      toast.success(`${response.data.created} Standard-Konfigurationen erstellt`);
    },
    onError: () => {
      toast.error('Fehler beim Initialisieren');
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BonusConfig> }) =>
      bonusApi.updateConfig(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonus-configs'] });
      setEditingConfig(null);
      toast.success('Konfiguration aktualisiert');
    },
    onError: () => {
      toast.error('Fehler beim Aktualisieren');
    },
  });

  const createConfigMutation = useMutation({
    mutationFn: bonusApi.createConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonus-configs'] });
      setShowNewForm(false);
      setNewConfig({
        activityType: '',
        displayName: '',
        description: '',
        amount: 0,
        category: 'GENERAL',
      });
      toast.success('Bonus-Art erstellt');
    },
    onError: () => {
      toast.error('Fehler beim Erstellen');
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: bonusApi.deleteConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonus-configs'] });
      toast.success('Bonus-Art gelöscht');
    },
    onError: () => {
      toast.error('Fehler beim Löschen');
    },
  });

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleActive = (config: BonusConfig) => {
    updateConfigMutation.mutate({
      id: config.id,
      data: { isActive: !config.isActive },
    });
  };

  const saveAmount = (config: BonusConfig, amount: number) => {
    updateConfigMutation.mutate({
      id: config.id,
      data: { amount },
    });
  };

  const groupedConfigs = CATEGORIES.map(cat => ({
    ...cat,
    configs: configs.filter(c => c.category === cat.id),
  }));

  const totalConfigured = configs.filter(c => c.isActive && c.amount > 0).length;
  const totalAmount = configs.filter(c => c.isActive).reduce((sum, c) => sum + c.amount, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header mit Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-600/20 via-slate-800 to-amber-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-500/20 rounded-2xl backdrop-blur-sm border border-yellow-500/30 shadow-lg shadow-yellow-500/20">
              <DollarSign className="h-8 w-8 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Sonderzahlungen</h1>
              <p className="text-slate-400 mt-0.5">Bonus-Konfiguration für Tätigkeiten</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => initConfigsMutation.mutate()}
              disabled={initConfigsMutation.isPending}
              className="btn-secondary"
            >
              <RefreshCw className={`h-4 w-4 ${initConfigsMutation.isPending ? 'animate-spin' : ''}`} />
              Standard-Boni initialisieren
            </button>
            <button
              onClick={() => setShowNewForm(true)}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" />
              Neue Bonus-Art
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-sm text-slate-400">Konfigurierte Boni</p>
          <p className="text-2xl font-bold text-white">{totalConfigured} / {configs.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-400">Aktive Bonus-Arten</p>
          <p className="text-2xl font-bold text-green-400">{configs.filter(c => c.isActive).length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-400">Max. Bonus pro Tätigkeit</p>
          <p className="text-2xl font-bold text-yellow-400">
            ${Math.max(...configs.map(c => c.amount), 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-400 text-sm">
          <strong>Hinweis:</strong> Setze den Betrag auf 0, um eine Bonus-Art zu deaktivieren.
          Die Boni werden automatisch vergeben, wenn die entsprechende Tätigkeit abgeschlossen wird.
          Jeden Sonntag um 23:59 Uhr wird die Woche automatisch geschlossen und die offenen Zahlungen ans Management weitergeleitet.
        </p>
      </div>

      {/* New Config Form */}
      {showNewForm && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-white">Neue Bonus-Art erstellen</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Technischer Name</label>
                <input
                  className="input"
                  value={newConfig.activityType}
                  onChange={(e) => setNewConfig({ ...newConfig, activityType: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })}
                  placeholder="z.B. CUSTOM_ACTIVITY"
                />
                <p className="text-xs text-slate-500 mt-1">Nur Großbuchstaben, Zahlen und Unterstriche</p>
              </div>
              <div>
                <label className="label">Anzeigename</label>
                <input
                  className="input"
                  value={newConfig.displayName}
                  onChange={(e) => setNewConfig({ ...newConfig, displayName: e.target.value })}
                  placeholder="z.B. Sondereinsatz durchgeführt"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Kategorie</label>
                <select
                  className="input"
                  value={newConfig.category}
                  onChange={(e) => setNewConfig({ ...newConfig, category: e.target.value })}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Betrag ($)</label>
                <input
                  type="number"
                  className="input"
                  value={newConfig.amount}
                  onChange={(e) => setNewConfig({ ...newConfig, amount: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </div>
            </div>
            <div>
              <label className="label">Beschreibung (optional)</label>
              <input
                className="input"
                value={newConfig.description}
                onChange={(e) => setNewConfig({ ...newConfig, description: e.target.value })}
                placeholder="Kurze Beschreibung der Tätigkeit"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowNewForm(false)}
                className="btn-secondary"
              >
                Abbrechen
              </button>
              <button
                onClick={() => createConfigMutation.mutate(newConfig)}
                disabled={!newConfig.activityType || !newConfig.displayName || createConfigMutation.isPending}
                className="btn-primary"
              >
                <Save className="h-4 w-4" />
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categories */}
      {groupedConfigs.map(category => (
        <div key={category.id} className="card">
          <button
            onClick={() => toggleCategory(category.id)}
            className="w-full card-header flex items-center justify-between hover:bg-slate-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${category.bg} ${category.color}`}></span>
              <h2 className={`font-semibold ${category.color}`}>{category.name}</h2>
              <span className="badge-gray">{category.configs.length} Einträge</span>
            </div>
            {expandedCategories.includes(category.id) ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </button>

          {expandedCategories.includes(category.id) && (
            <div className="card-body">
              {category.configs.length === 0 ? (
                <p className="text-slate-400 text-center py-4">Keine Bonus-Arten in dieser Kategorie</p>
              ) : (
                <div className="space-y-2">
                  {category.configs.map(config => (
                    <div
                      key={config.id}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        config.isActive ? 'bg-slate-700/50' : 'bg-slate-800/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        {/* Toggle */}
                        <button
                          onClick={() => toggleActive(config)}
                          className="flex-shrink-0"
                          title={config.isActive ? 'Deaktivieren' : 'Aktivieren'}
                        >
                          {config.isActive ? (
                            <ToggleRight className="h-6 w-6 text-green-400" />
                          ) : (
                            <ToggleLeft className="h-6 w-6 text-slate-500" />
                          )}
                        </button>

                        {/* Name & Description */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${config.isActive ? 'text-white' : 'text-slate-400'}`}>
                            {config.displayName}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {config.activityType}
                            {config.description && ` - ${config.description}`}
                          </p>
                        </div>

                        {/* Amount Input */}
                        {editingConfig?.id === config.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">$</span>
                            <input
                              type="number"
                              className="input w-24 text-right"
                              value={editingConfig.amount}
                              onChange={(e) => setEditingConfig({ ...editingConfig, amount: parseInt(e.target.value) || 0 })}
                              min={0}
                              autoFocus
                            />
                            <button
                              onClick={() => saveAmount(config, editingConfig.amount)}
                              className="btn-primary text-sm py-1 px-2"
                              disabled={updateConfigMutation.isPending}
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingConfig(null)}
                              className="btn-secondary text-sm py-1 px-2"
                            >
                              Abbrechen
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingConfig(config)}
                            className={`px-4 py-1 rounded font-medium transition-colors ${
                              config.amount > 0
                                ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                                : 'bg-slate-600/50 text-slate-400 hover:bg-slate-600'
                            }`}
                          >
                            ${config.amount.toLocaleString()}
                          </button>
                        )}

                        {/* Delete (only for custom configs) */}
                        <button
                          onClick={() => setConfirmDialog({
                            isOpen: true,
                            title: 'Bonus-Art löschen',
                            message: `Möchtest du "${config.displayName}" wirklich löschen?`,
                            confirmText: 'Löschen',
                            variant: 'danger',
                            onConfirm: () => deleteConfigMutation.mutate(config.id),
                          })}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                          title="Löschen"
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
      ))}

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
