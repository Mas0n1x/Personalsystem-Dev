import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {
  UserPlus,
  ClipboardList,
  Plus,
  Trash2,
  Pencil,
  X,
  Save,
  Eye,
  EyeOff,
  GripVertical,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface OnboardingItem {
  id: string;
  text: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export default function HRSettings() {
  const queryClient = useQueryClient();

  // Onboarding State
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [editingItem, setEditingItem] = useState<OnboardingItem | null>(null);
  const [newItem, setNewItem] = useState('');
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

  // Onboarding Query
  const { data: items = [], isLoading } = useQuery<OnboardingItem[]>({
    queryKey: ['onboarding-items-all'],
    queryFn: () => adminApi.getAllOnboardingItems().then(res => res.data),
  });

  // Onboarding Mutations
  const createItem = useMutation({
    mutationFn: (text: string) => adminApi.createOnboardingItem({ text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-items-all'] });
      queryClient.invalidateQueries({ queryKey: ['application-onboarding'] });
      setShowOnboardingModal(false);
      setNewItem('');
      toast.success('Onboarding-Item erstellt');
    },
  });

  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<OnboardingItem> }) =>
      adminApi.updateOnboardingItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-items-all'] });
      queryClient.invalidateQueries({ queryKey: ['application-onboarding'] });
      setEditingItem(null);
      toast.success('Onboarding-Item aktualisiert');
    },
  });

  const deleteItem = useMutation({
    mutationFn: adminApi.deleteOnboardingItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-items-all'] });
      queryClient.invalidateQueries({ queryKey: ['application-onboarding'] });
      toast.success('Onboarding-Item gelöscht');
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) {
      toast.error('Text ist erforderlich');
      return;
    }
    createItem.mutate(newItem.trim());
  };

  const toggleItemActive = (item: OnboardingItem) => {
    updateItem.mutate({
      id: item.id,
      data: { isActive: !item.isActive },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header mit Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600/20 via-slate-800 to-emerald-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-2xl backdrop-blur-sm border border-green-500/30 shadow-lg shadow-green-500/20">
              <UserPlus className="h-8 w-8 text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">HR Einstellungen</h1>
              <p className="text-slate-400 mt-0.5">Verwalte Onboarding-Checkliste für neue Mitarbeiter</p>
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding Items */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">Onboarding-Checkliste</h2>
            <span className="px-2 py-0.5 text-xs bg-slate-700 rounded-full text-slate-300">
              {items.filter(i => i.isActive).length} aktiv
            </span>
          </div>
          <button
            onClick={() => setShowOnboardingModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Neues Item
          </button>
        </div>

        <div className="card p-4 bg-slate-700/30 border-slate-600">
          <p className="text-sm text-slate-300">
            Diese Checkliste wird beim Onboarding-Prozess neuer Mitarbeiter in HR verwendet.
            Items können per Drag & Drop sortiert werden.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="card p-8 text-center">
            <ClipboardList className="h-12 w-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">Keine Onboarding-Items vorhanden</p>
            <button
              onClick={() => setShowOnboardingModal(true)}
              className="btn-primary mt-4"
            >
              Erstes Item erstellen
            </button>
          </div>
        ) : (
          <div className="card">
            <div className="divide-y divide-slate-700">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={clsx(
                    'flex items-center gap-4 p-4 transition-colors',
                    !item.isActive && 'opacity-50'
                  )}
                >
                  <div className="flex items-center gap-2 text-slate-500">
                    <GripVertical className="h-4 w-4" />
                    <span className="w-6 h-6 flex items-center justify-center bg-slate-700 rounded-full text-sm text-white">
                      {index + 1}
                    </span>
                  </div>

                  {editingItem?.id === item.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        updateItem.mutate({
                          id: item.id,
                          data: { text: editingItem.text },
                        });
                      }}
                      className="flex-1 flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={editingItem.text}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, text: e.target.value })
                        }
                        className="input flex-1"
                        autoFocus
                      />
                      <button type="submit" className="btn-primary p-2">
                        <Save className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingItem(null)}
                        className="btn-secondary p-2"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <p className="flex-1 text-white">{item.text}</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleItemActive(item)}
                          className={clsx(
                            'p-2 rounded-lg transition-colors',
                            item.isActive
                              ? 'text-green-400 hover:bg-green-500/20'
                              : 'text-slate-500 hover:bg-slate-600'
                          )}
                          title={item.isActive ? 'Deaktivieren' : 'Aktivieren'}
                        >
                          {item.isActive ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setEditingItem(item)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDialog({
                            isOpen: true,
                            title: 'Onboarding-Item löschen',
                            message: 'Möchtest du dieses Onboarding-Item wirklich löschen?',
                            confirmText: 'Löschen',
                            variant: 'danger',
                            onConfirm: () => deleteItem.mutate(item.id),
                          })}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Item Modal */}
      {showOnboardingModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl w-full max-w-lg mx-4 border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="card-header flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Neues Onboarding-Item erstellen</h3>
              <button
                onClick={() => {
                  setShowOnboardingModal(false);
                  setNewItem('');
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="card-body space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Item Text *
                </label>
                <input
                  type="text"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  className="input w-full"
                  placeholder="z.B. Klamotten besorgen (Dienstkleidung)"
                  autoFocus
                />
                <p className="text-xs text-slate-500 mt-1">
                  Wird in der Onboarding-Checkliste für neue Mitarbeiter angezeigt
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowOnboardingModal(false);
                    setNewItem('');
                  }}
                  className="btn-secondary"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={createItem.isPending}
                  className="btn-primary"
                >
                  {createItem.isPending ? 'Erstelle...' : 'Erstellen'}
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
