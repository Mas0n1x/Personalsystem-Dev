import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {
  ClipboardCheck,
  Plus,
  Trash2,
  Pencil,
  X,
  Save,
  Eye,
  EyeOff,
  GripVertical,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface QAUnit {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export default function QASettings() {
  const queryClient = useQueryClient();

  // Units State
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<QAUnit | null>(null);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitDescription, setNewUnitDescription] = useState('');
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

  // Units Query
  const { data: units = [], isLoading } = useQuery<QAUnit[]>({
    queryKey: ['qa-units-all'],
    queryFn: () => adminApi.getAllQAUnits().then(res => res.data),
  });

  // Unit Mutations
  const createUnit = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      adminApi.createQAUnit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qa-units-all'] });
      queryClient.invalidateQueries({ queryKey: ['qa-units'] });
      setShowUnitModal(false);
      setNewUnitName('');
      setNewUnitDescription('');
      toast.success('Unit erstellt');
    },
    onError: () => {
      toast.error('Fehler beim Erstellen der Unit');
    },
  });

  const updateUnit = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<QAUnit> }) =>
      adminApi.updateQAUnit(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qa-units-all'] });
      queryClient.invalidateQueries({ queryKey: ['qa-units'] });
      setEditingUnit(null);
      toast.success('Unit aktualisiert');
    },
    onError: () => {
      toast.error('Fehler beim Aktualisieren der Unit');
    },
  });

  const deleteUnit = useMutation({
    mutationFn: (id: string) => adminApi.deleteQAUnit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qa-units-all'] });
      queryClient.invalidateQueries({ queryKey: ['qa-units'] });
      toast.success('Unit gelöscht');
    },
    onError: () => {
      toast.error('Fehler beim Löschen der Unit');
    },
  });

  const toggleUnitActive = (unit: QAUnit) => {
    updateUnit.mutate({
      id: unit.id,
      data: { isActive: !unit.isActive },
    });
  };

  const handleCreateUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUnitName.trim()) {
      createUnit.mutate({
        name: newUnitName.trim(),
        description: newUnitDescription.trim() || undefined,
      });
    }
  };

  const handleUpdateUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUnit) {
      updateUnit.mutate({
        id: editingUnit.id,
        data: {
          name: editingUnit.name,
          description: editingUnit.description,
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-600/20 via-slate-800 to-cyan-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-teal-500/20 rounded-2xl backdrop-blur-sm border border-teal-500/30 shadow-lg shadow-teal-500/20">
              <ClipboardCheck className="h-8 w-8 text-teal-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">QA-Einstellungen</h1>
              <p className="text-slate-400 mt-0.5">
                Units für Quality Assurance Berichte konfigurieren
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Units Section */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-400" />
            <h2 className="font-semibold text-white">QA Units</h2>
          </div>
          <button
            onClick={() => setShowUnitModal(true)}
            className="btn-primary text-sm"
          >
            <Plus className="h-4 w-4" />
            Unit hinzufügen
          </button>
        </div>
        <div className="card-body p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : units.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Keine Units vorhanden</p>
              <p className="text-sm mt-1">
                Füge Units hinzu, die in QA-Berichten verwendet werden können.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {units.map((unit, index) => (
                <div
                  key={unit.id}
                  className={clsx(
                    'flex items-center gap-4 p-4 transition-colors',
                    !unit.isActive && 'opacity-50'
                  )}
                >
                  <GripVertical className="h-5 w-5 text-slate-500 cursor-grab" />
                  <span className="text-sm text-slate-500 w-6">{index + 1}</span>
                  <div className="flex-1">
                    {editingUnit?.id === unit.id ? (
                      <form
                        onSubmit={handleUpdateUnit}
                        className="flex flex-col gap-2"
                      >
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingUnit.name}
                            onChange={(e) =>
                              setEditingUnit({
                                ...editingUnit,
                                name: e.target.value,
                              })
                            }
                            className="input flex-1"
                            placeholder="Unit-Name"
                            autoFocus
                          />
                        </div>
                        <input
                          type="text"
                          value={editingUnit.description || ''}
                          onChange={(e) =>
                            setEditingUnit({
                              ...editingUnit,
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
                            onClick={() => setEditingUnit(null)}
                            className="btn-secondary text-sm"
                          >
                            <X className="h-4 w-4" />
                            Abbrechen
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div>
                        <p className="text-white font-medium">{unit.name}</p>
                        {unit.description && (
                          <p className="text-sm text-slate-400 mt-1">
                            {unit.description}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {editingUnit?.id !== unit.id && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleUnitActive(unit)}
                        className={clsx(
                          'p-2 rounded-lg transition-colors',
                          unit.isActive
                            ? 'text-green-400 hover:bg-green-600/20'
                            : 'text-slate-400 hover:bg-slate-700'
                        )}
                        title={unit.isActive ? 'Deaktivieren' : 'Aktivieren'}
                      >
                        {unit.isActive ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setEditingUnit(unit)}
                        className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-600/20 rounded-lg transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          setConfirmDialog({
                            isOpen: true,
                            title: 'Unit löschen',
                            message: `Möchtest du die Unit "${unit.name}" wirklich löschen?`,
                            confirmText: 'Löschen',
                            variant: 'danger',
                            onConfirm: () => deleteUnit.mutate(unit.id),
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
            <strong>Hinweis:</strong> Die hier definierten Units werden im
            Dropdown der QA-Berichte verwendet. Deaktivierte Units werden
            nicht mehr als Option angezeigt, bestehende Berichte mit dieser
            Unit bleiben jedoch erhalten.
          </p>
        </div>
      </div>

      {/* Create Unit Modal */}
      {showUnitModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl w-full max-w-md border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Neue Unit</h2>
              <button
                onClick={() => {
                  setShowUnitModal(false);
                  setNewUnitName('');
                  setNewUnitDescription('');
                }}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateUnit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  className="input w-full"
                  placeholder="z.B. Team Green"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Beschreibung
                </label>
                <input
                  type="text"
                  value={newUnitDescription}
                  onChange={(e) => setNewUnitDescription(e.target.value)}
                  className="input w-full"
                  placeholder="Optionale Beschreibung"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnitModal(false);
                    setNewUnitName('');
                    setNewUnitDescription('');
                  }}
                  className="btn-secondary"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={
                    createUnit.isPending ||
                    !newUnitName.trim()
                  }
                  className="btn-primary"
                >
                  {createUnit.isPending ? 'Erstelle...' : 'Erstellen'}
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
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
