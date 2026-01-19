import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {
  ShieldAlert,
  Plus,
  Trash2,
  Pencil,
  X,
  Save,
  Eye,
  EyeOff,
  GripVertical,
  FileText,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface IACategory {
  id: string;
  name: string;
  key: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export default function IASettings() {
  const queryClient = useQueryClient();

  // Categories State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<IACategory | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryKey, setNewCategoryKey] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
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

  // Categories Query
  const { data: categories = [], isLoading } = useQuery<IACategory[]>({
    queryKey: ['ia-categories-all'],
    queryFn: () => adminApi.getAllIACategories().then(res => res.data),
  });

  // Category Mutations
  const createCategory = useMutation({
    mutationFn: (data: { name: string; key: string; description?: string }) =>
      adminApi.createIACategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ia-categories-all'] });
      queryClient.invalidateQueries({ queryKey: ['ia-categories'] });
      setShowCategoryModal(false);
      setNewCategoryName('');
      setNewCategoryKey('');
      setNewCategoryDescription('');
      toast.success('Kategorie erstellt');
    },
    onError: () => {
      toast.error('Fehler beim Erstellen der Kategorie');
    },
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<IACategory> }) =>
      adminApi.updateIACategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ia-categories-all'] });
      queryClient.invalidateQueries({ queryKey: ['ia-categories'] });
      setEditingCategory(null);
      toast.success('Kategorie aktualisiert');
    },
    onError: () => {
      toast.error('Fehler beim Aktualisieren der Kategorie');
    },
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => adminApi.deleteIACategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ia-categories-all'] });
      queryClient.invalidateQueries({ queryKey: ['ia-categories'] });
      toast.success('Kategorie gelöscht');
    },
    onError: () => {
      toast.error('Fehler beim Löschen der Kategorie');
    },
  });

  const toggleCategoryActive = (category: IACategory) => {
    updateCategory.mutate({
      id: category.id,
      data: { isActive: !category.isActive },
    });
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategoryName.trim() && newCategoryKey.trim()) {
      createCategory.mutate({
        name: newCategoryName.trim(),
        key: newCategoryKey.trim().toUpperCase().replace(/\s+/g, '_'),
        description: newCategoryDescription.trim() || undefined,
      });
    }
  };

  const handleUpdateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      updateCategory.mutate({
        id: editingCategory.id,
        data: {
          name: editingCategory.name,
          key: editingCategory.key.toUpperCase().replace(/\s+/g, '_'),
          description: editingCategory.description,
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
              <h1 className="text-2xl font-bold text-white">IA-Einstellungen</h1>
              <p className="text-slate-400 mt-0.5">
                Kategorien für Interne Ermittlungen konfigurieren
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Section */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-red-400" />
            <h2 className="font-semibold text-white">Ermittlungs-Kategorien</h2>
          </div>
          <button
            onClick={() => setShowCategoryModal(true)}
            className="btn-primary text-sm"
          >
            <Plus className="h-4 w-4" />
            Kategorie hinzufügen
          </button>
        </div>
        <div className="card-body p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : categories.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Keine Kategorien vorhanden</p>
              <p className="text-sm mt-1">
                Füge Kategorien hinzu, die in der IA-Abteilung verwendet werden
                können.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {categories.map((category, index) => (
                <div
                  key={category.id}
                  className={clsx(
                    'flex items-center gap-4 p-4 transition-colors',
                    !category.isActive && 'opacity-50'
                  )}
                >
                  <GripVertical className="h-5 w-5 text-slate-500 cursor-grab" />
                  <span className="text-sm text-slate-500 w-6">{index + 1}</span>
                  <div className="flex-1">
                    {editingCategory?.id === category.id ? (
                      <form
                        onSubmit={handleUpdateCategory}
                        className="flex flex-col gap-2"
                      >
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingCategory.name}
                            onChange={(e) =>
                              setEditingCategory({
                                ...editingCategory,
                                name: e.target.value,
                              })
                            }
                            className="input flex-1"
                            placeholder="Kategorie-Name"
                            autoFocus
                          />
                          <input
                            type="text"
                            value={editingCategory.key}
                            onChange={(e) =>
                              setEditingCategory({
                                ...editingCategory,
                                key: e.target.value,
                              })
                            }
                            className="input w-40"
                            placeholder="Schlüssel"
                          />
                        </div>
                        <input
                          type="text"
                          value={editingCategory.description || ''}
                          onChange={(e) =>
                            setEditingCategory({
                              ...editingCategory,
                              description: e.target.value,
                            })
                          }
                          className="input"
                          placeholder="Beschreibung (optional)"
                        />
                        <div className="flex gap-2">
                          <button type="submit" className="btn-primary text-sm">
                            <Save className="h-4 w-4" />
                            Speichern
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCategory(null)}
                            className="btn-secondary text-sm"
                          >
                            <X className="h-4 w-4" />
                            Abbrechen
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div>
                        <p className="text-white font-medium">{category.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">
                            {category.key}
                          </span>
                          {category.description && (
                            <span className="text-sm text-slate-400">
                              - {category.description}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {editingCategory?.id !== category.id && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleCategoryActive(category)}
                        className={clsx(
                          'p-2 rounded-lg transition-colors',
                          category.isActive
                            ? 'text-green-400 hover:bg-green-600/20'
                            : 'text-slate-400 hover:bg-slate-700'
                        )}
                        title={category.isActive ? 'Deaktivieren' : 'Aktivieren'}
                      >
                        {category.isActive ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setEditingCategory(category)}
                        className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-600/20 rounded-lg transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          setConfirmDialog({
                            isOpen: true,
                            title: 'Kategorie löschen',
                            message: `Möchtest du die Kategorie "${category.name}" wirklich löschen?`,
                            confirmText: 'Löschen',
                            variant: 'danger',
                            onConfirm: () => deleteCategory.mutate(category.id),
                          })
                        }
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="card border-blue-700/30 bg-blue-900/10">
        <div className="card-body">
          <p className="text-sm text-blue-400">
            <strong>Hinweis:</strong> Die hier definierten Kategorien werden im
            Dropdown der IA-Seite verwendet. Deaktivierte Kategorien werden
            nicht mehr als Option angezeigt, bestehende Ermittlungen mit dieser
            Kategorie bleiben jedoch erhalten.
          </p>
        </div>
      </div>

      {/* Create Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl w-full max-w-md border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Neue Kategorie</h2>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setNewCategoryName('');
                  setNewCategoryKey('');
                  setNewCategoryDescription('');
                }}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => {
                    setNewCategoryName(e.target.value);
                    // Auto-generiere Key wenn noch nicht gesetzt
                    if (!newCategoryKey || newCategoryKey === newCategoryName.toUpperCase().replace(/\s+/g, '_')) {
                      setNewCategoryKey(
                        e.target.value.toUpperCase().replace(/\s+/g, '_')
                      );
                    }
                  }}
                  className="input w-full"
                  placeholder="z.B. Beschwerde"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Schlüssel *
                </label>
                <input
                  type="text"
                  value={newCategoryKey}
                  onChange={(e) =>
                    setNewCategoryKey(
                      e.target.value.toUpperCase().replace(/\s+/g, '_')
                    )
                  }
                  className="input w-full font-mono"
                  placeholder="z.B. BESCHWERDE"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Technischer Schlüssel (Großbuchstaben, keine Leerzeichen)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Beschreibung
                </label>
                <input
                  type="text"
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  className="input w-full"
                  placeholder="Optionale Beschreibung"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false);
                    setNewCategoryName('');
                    setNewCategoryKey('');
                    setNewCategoryDescription('');
                  }}
                  className="btn-secondary"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={
                    createCategory.isPending ||
                    !newCategoryName.trim() ||
                    !newCategoryKey.trim()
                  }
                  className="btn-primary"
                >
                  {createCategory.isPending ? 'Erstelle...' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
