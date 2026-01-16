import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { academyApi } from '../../services/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {
  GraduationCap,
  Plus,
  Trash2,
  GripVertical,
  Pencil,
  X,
  Save,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface AcademyModule {
  id: string;
  name: string;
  description: string | null;
  category: 'JUNIOR_OFFICER' | 'OFFICER';
  sortOrder: number;
  isActive: boolean;
}

export default function AcademyModules() {
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingModule, setEditingModule] = useState<AcademyModule | null>(null);
  const [newModule, setNewModule] = useState({
    name: '',
    description: '',
    category: 'JUNIOR_OFFICER' as 'JUNIOR_OFFICER' | 'OFFICER',
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

  // Query
  const { data: modules = [], isLoading } = useQuery({
    queryKey: ['academy-modules'],
    queryFn: () => academyApi.getModules().then(res => res.data),
  });

  // Mutations
  const createModule = useMutation({
    mutationFn: academyApi.createModule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-modules'] });
      setShowCreateModal(false);
      setNewModule({ name: '', description: '', category: 'JUNIOR_OFFICER' });
      toast.success('Modul erstellt');
    },
    onError: () => {
      toast.error('Fehler beim Erstellen des Moduls');
    },
  });

  const updateModule = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AcademyModule> }) =>
      academyApi.updateModule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-modules'] });
      setEditingModule(null);
      toast.success('Modul aktualisiert');
    },
    onError: () => {
      toast.error('Fehler beim Aktualisieren des Moduls');
    },
  });

  const deleteModule = useMutation({
    mutationFn: academyApi.deleteModule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-modules'] });
      toast.success('Modul gelöscht');
    },
    onError: () => {
      toast.error('Fehler beim Löschen des Moduls');
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModule.name.trim()) {
      toast.error('Name ist erforderlich');
      return;
    }
    createModule.mutate({
      name: newModule.name.trim(),
      description: newModule.description.trim() || undefined,
      category: newModule.category,
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModule) return;
    updateModule.mutate({
      id: editingModule.id,
      data: {
        name: editingModule.name,
        description: editingModule.description,
        category: editingModule.category,
      },
    });
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Modul löschen',
      message: `Möchtest du das Modul "${name}" wirklich löschen? Dies entfernt auch alle Fortschrittsdaten.`,
      confirmText: 'Löschen',
      variant: 'danger',
      onConfirm: () => deleteModule.mutate(id),
    });
  };

  const handleToggleActive = (module: AcademyModule) => {
    updateModule.mutate({
      id: module.id,
      data: { isActive: !module.isActive },
    });
  };

  const juniorOfficerModules = modules.filter((m: AcademyModule) => m.category === 'JUNIOR_OFFICER');
  const officerModules = modules.filter((m: AcademyModule) => m.category === 'OFFICER');

  const renderModuleList = (moduleList: AcademyModule[], category: string, title: string, emoji: string, color: string) => (
    <div className="card">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h2 className={clsx('text-lg font-semibold flex items-center gap-2', color)}>
          <span>{emoji}</span>
          {title}
        </h2>
        <span className="text-sm text-slate-400">{moduleList.length} Module</span>
      </div>
      <div className="divide-y divide-slate-700">
        {moduleList.map((module) => (
          <div
            key={module.id}
            className={clsx(
              'p-4 flex items-center gap-4 transition-colors',
              !module.isActive && 'opacity-50'
            )}
          >
            <GripVertical className="h-5 w-5 text-slate-600 cursor-move" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-white">{module.name}</h3>
                {!module.isActive && (
                  <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-400">
                    Deaktiviert
                  </span>
                )}
              </div>
              {module.description && (
                <p className="text-sm text-slate-400 mt-1">{module.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleActive(module)}
                className={clsx(
                  'px-3 py-1 rounded text-sm transition-colors',
                  module.isActive
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                )}
              >
                {module.isActive ? 'Aktiv' : 'Inaktiv'}
              </button>
              <button
                onClick={() => setEditingModule(module)}
                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(module.id, module.name)}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {moduleList.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            Keine Module in dieser Kategorie
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header mit Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600/20 via-slate-800 to-cyan-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-2xl backdrop-blur-sm border border-blue-500/30 shadow-lg shadow-blue-500/20">
              <GraduationCap className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Academy Module verwalten</h1>
              <p className="text-slate-400 mt-0.5">Ausbildungsmodule für die Police Academy konfigurieren</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Neues Modul
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      )}

      {/* Module Lists */}
      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderModuleList(juniorOfficerModules, 'JUNIOR_OFFICER', 'Junior Officer', '🎖', 'text-amber-400')}
          {renderModuleList(officerModules, 'OFFICER', 'Officer', '🔰', 'text-orange-400')}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl max-w-md w-full border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Neues Ausbildungsmodul</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={newModule.name}
                  onChange={(e) => setNewModule({ ...newModule, name: e.target.value })}
                  className="input w-full"
                  placeholder="z.B. Aktenschulung"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Beschreibung
                </label>
                <textarea
                  value={newModule.description}
                  onChange={(e) => setNewModule({ ...newModule, description: e.target.value })}
                  className="input w-full"
                  rows={2}
                  placeholder="Optionale Beschreibung..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Kategorie *
                </label>
                <select
                  value={newModule.category}
                  onChange={(e) => setNewModule({ ...newModule, category: e.target.value as 'JUNIOR_OFFICER' | 'OFFICER' })}
                  className="input w-full"
                >
                  <option value="JUNIOR_OFFICER">🎖 Junior Officer</option>
                  <option value="OFFICER">🔰 Officer</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-2"
                  disabled={createModule.isPending}
                >
                  <Save className="h-4 w-4" />
                  {createModule.isPending ? 'Erstelle...' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingModule && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl max-w-md w-full border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Modul bearbeiten</h2>
              <button
                onClick={() => setEditingModule(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={editingModule.name}
                  onChange={(e) => setEditingModule({ ...editingModule, name: e.target.value })}
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Beschreibung
                </label>
                <textarea
                  value={editingModule.description || ''}
                  onChange={(e) => setEditingModule({ ...editingModule, description: e.target.value || null })}
                  className="input w-full"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Kategorie *
                </label>
                <select
                  value={editingModule.category}
                  onChange={(e) => setEditingModule({ ...editingModule, category: e.target.value as 'JUNIOR_OFFICER' | 'OFFICER' })}
                  className="input w-full"
                >
                  <option value="JUNIOR_OFFICER">🎖 Junior Officer</option>
                  <option value="OFFICER">🔰 Officer</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingModule(null)}
                  className="btn-secondary"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-2"
                  disabled={updateModule.isPending}
                >
                  <Save className="h-4 w-4" />
                  {updateModule.isPending ? 'Speichere...' : 'Speichern'}
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
