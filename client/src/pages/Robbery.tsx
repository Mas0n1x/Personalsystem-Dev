import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { robberyApi } from '../services/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import {
  Plus,
  X,
  Crosshair,
  RefreshCw,
  Upload,
  Eye,
  Trash2,
  Users,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  rank: string;
  user: {
    displayName: string | null;
    username: string;
    avatar: string | null;
  };
}

interface Robbery {
  id: string;
  imagePath: string;
  leader: {
    id: string;
    rank: string;
    user: {
      displayName: string | null;
      username: string;
      avatar: string | null;
    };
  };
  negotiator: {
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
  createdAt: string;
}

interface Stats {
  weekTotal: number;
  weekStart: string;
  weekEnd: string;
}

export default function Robbery() {
  const { user, hasAnyPermission } = useAuth();
  const queryClient = useQueryClient();
  useLiveUpdates();
  const [showModal, setShowModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState<string | null>(null);
  const [leaderId, setLeaderId] = useState('');
  const [negotiatorId, setNegotiatorId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

  const { data: robberiesData, isLoading } = useQuery({
    queryKey: ['robberies'],
    queryFn: () => robberyApi.getAll(),
  });

  const { data: statsData } = useQuery({
    queryKey: ['robbery-stats'],
    queryFn: () => robberyApi.getStats(),
  });

  const { data: employeesData } = useQuery({
    queryKey: ['robbery-employees'],
    queryFn: () => robberyApi.getEmployees(),
  });

  const robberies = (robberiesData?.data || []) as Robbery[];
  const stats = statsData?.data as Stats | undefined;
  const employees = (employeesData?.data || []) as Employee[];

  const createMutation = useMutation({
    mutationFn: robberyApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['robberies'] });
      queryClient.invalidateQueries({ queryKey: ['robbery-stats'] });
      closeModal();
      toast.success('Raub eingetragen');
    },
    onError: (error: unknown) => {
      // Bessere Fehlermeldung anzeigen
      const axiosError = error as { response?: { data?: { error?: string }; status?: number } };
      if (axiosError.response?.status === 403) {
        toast.error('Keine Berechtigung zum Eintragen');
      } else if (axiosError.response?.status === 413) {
        toast.error('Bild ist zu groß (max. 10MB)');
      } else if (axiosError.response?.data?.error) {
        toast.error(axiosError.response.data.error);
      } else {
        toast.error('Fehler beim Eintragen - bitte erneut versuchen');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: robberyApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['robberies'] });
      queryClient.invalidateQueries({ queryKey: ['robbery-stats'] });
      toast.success('Raub gelöscht');
    },
  });

  const openModal = () => {
    setLeaderId('');
    setNegotiatorId('');
    setSelectedFile(null);
    setPreviewUrl(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setLeaderId('');
    setNegotiatorId('');
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          setSelectedFile(file);
          const url = URL.createObjectURL(file);
          setPreviewUrl(url);
          e.preventDefault();
          break;
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!leaderId || !selectedFile) {
      toast.error('Bitte Einsatzleitung und Beweisfoto auswählen');
      return;
    }

    const formData = new FormData();
    formData.append('leaderId', leaderId);
    if (negotiatorId) {
      formData.append('negotiatorId', negotiatorId);
    }
    formData.append('image', selectedFile);

    createMutation.mutate(formData);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatWeekRange = () => {
    if (!stats) return '';
    const start = new Date(stats.weekStart);
    const end = new Date(stats.weekEnd);
    return `${start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} - ${end.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  };

  // Check if user can manage (has permission)
  const canManage = hasAnyPermission('robbery.manage', 'admin.full');

  // Check if user can create
  const canCreate = hasAnyPermission('robbery.create', 'robbery.manage', 'admin.full');

  const getEmployeeName = (emp: Employee) => emp.user.displayName || emp.user.username;

  return (
    <div className="space-y-6">
      {/* Header mit Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600/20 via-slate-800 to-orange-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/20 rounded-2xl backdrop-blur-sm border border-red-500/30 shadow-lg shadow-red-500/20">
              <Crosshair className="h-8 w-8 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Räube</h1>
              <p className="text-slate-400 mt-0.5">Übersicht der Räube dieser Woche</p>
            </div>
          </div>
          {canCreate && (
            <button onClick={openModal} className="btn-primary flex items-center gap-2 shadow-lg shadow-primary-500/20">
              <Plus className="h-4 w-4" />
              Raub eintragen
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 bg-gradient-to-br from-red-900/30 to-slate-800/50 border-red-700/30 hover:border-red-600/50 transition-all group">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-red-600/20 rounded-2xl group-hover:scale-110 transition-transform">
              <Crosshair className="h-8 w-8 text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-3xl font-bold text-red-400">{stats?.weekTotal || 0}</p>
              <p className="text-sm text-slate-400 mt-0.5">Räube diese Woche</p>
            </div>
          </div>
        </div>
        <div className="card p-5 bg-gradient-to-br from-blue-900/30 to-slate-800/50 border-blue-700/30 hover:border-blue-600/50 transition-all group">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-blue-600/20 rounded-2xl group-hover:scale-110 transition-transform">
              <Calendar className="h-8 w-8 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-xl font-bold text-blue-400">{formatWeekRange()}</p>
              <p className="text-sm text-slate-400 mt-0.5">Aktuelle Woche</p>
            </div>
          </div>
        </div>
      </div>

      {/* Robberies List */}
      <div className="card">
        <div className="p-4 border-b border-slate-700">
          <h2 className="font-semibold text-white">Räube der Woche</h2>
        </div>
        <div className="divide-y divide-slate-700">
          {isLoading ? (
            <div className="p-12 text-center">
              <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto" />
              <p className="text-slate-400 mt-3">Lädt...</p>
            </div>
          ) : robberies.length === 0 ? (
            <div className="p-12 text-center">
              <Crosshair className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">Keine Räube diese Woche</p>
              <p className="text-slate-500 text-sm mt-1">
                Klicke auf &quot;Raub eintragen&quot; um einen neuen Raub hinzuzufügen
              </p>
            </div>
          ) : (
            robberies.map((robbery) => (
              <div key={robbery.id} className="p-4 hover:bg-slate-750 transition-colors">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="p-3 bg-red-600/20 rounded-xl">
                    <Crosshair className="h-6 w-6 text-red-400" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1">
                      {/* Leader */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 uppercase">Einsatzleitung:</span>
                        <img
                          src={
                            robbery.leader.user.avatar ||
                            `https://ui-avatars.com/api/?name=${getEmployeeName(robbery.leader as Employee)}&size=24&background=334155&color=fff`
                          }
                          className="h-5 w-5 rounded-full"
                          alt=""
                        />
                        <span className="text-white font-medium">
                          {getEmployeeName(robbery.leader as Employee)}
                        </span>
                      </div>

                      {/* Negotiator */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 uppercase">Verhandlung:</span>
                        <img
                          src={
                            robbery.negotiator.user.avatar ||
                            `https://ui-avatars.com/api/?name=${getEmployeeName(robbery.negotiator as Employee)}&size=24&background=334155&color=fff`
                          }
                          className="h-5 w-5 rounded-full"
                          alt=""
                        />
                        <span className="text-white font-medium">
                          {getEmployeeName(robbery.negotiator as Employee)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                      <span>Eingetragen von {robbery.createdBy.displayName || robbery.createdBy.username}</span>
                      <span>•</span>
                      <span>{formatDate(robbery.createdAt)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {/* View Image Button */}
                    <button
                      onClick={() => setShowImageModal(robbery.imagePath)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg transition-colors"
                      title="Beweisfoto anzeigen"
                    >
                      <Eye className="h-5 w-5" />
                    </button>

                    {/* Delete Button (only for managers) */}
                    {canManage && (
                      <button
                        onClick={() => setConfirmDialog({
                          isOpen: true,
                          title: 'Raub löschen',
                          message: 'Möchtest du diesen Raub wirklich löschen?',
                          confirmText: 'Löschen',
                          variant: 'danger',
                          onConfirm: () => deleteMutation.mutate(robbery.id),
                        })}
                        disabled={deleteMutation.isPending}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl w-full max-w-md border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Raub eintragen</h2>
              <button onClick={closeModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} onPaste={handlePaste} className="p-6 space-y-5">
              {/* Leader Selection */}
              <div>
                <label className="label">Einsatzleitung *</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <select
                    value={leaderId}
                    onChange={(e) => setLeaderId(e.target.value)}
                    className="input pl-10"
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
              </div>

              {/* Negotiator Selection */}
              <div>
                <label className="label">Verhandlungsführung (Optional)</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <select
                    value={negotiatorId}
                    onChange={(e) => setNegotiatorId(e.target.value)}
                    className="input pl-10"
                  >
                    <option value="">Mitarbeiter auswählen...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.rank} - {getEmployeeName(emp)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="label">Beweisfoto *</label>
                <div
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                    previewUrl
                      ? 'border-green-500/50 bg-green-900/10'
                      : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
                  }`}
                  onClick={() => document.getElementById('robbery-file-input')?.click()}
                >
                  <input
                    id="robbery-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {previewUrl ? (
                    <div className="space-y-2">
                      <img
                        src={previewUrl}
                        alt="Vorschau"
                        className="max-h-40 mx-auto rounded-lg"
                      />
                      <p className="text-sm text-green-400">{selectedFile?.name}</p>
                    </div>
                  ) : (
                    <div className="py-4">
                      <Upload className="h-10 w-10 text-slate-500 mx-auto mb-2" />
                      <p className="text-slate-400">Klicken um Bild auszuwählen</p>
                      <p className="text-xs text-slate-500 mt-1">JPEG, PNG, GIF, WebP (max. 10MB) • Strg+V zum Einfügen</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-ghost px-5">
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !leaderId || !selectedFile}
                  className="btn-primary flex items-center gap-2 px-5"
                >
                  <Plus className="h-4 w-4" />
                  {createMutation.isPending ? 'Wird eingetragen...' : 'Eintragen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setShowImageModal(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowImageModal(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-slate-300 transition-colors"
            >
              <X className="h-8 w-8" />
            </button>
            <img
              src={robberyApi.getImageUrl(showImageModal)}
              alt="Beweisfoto"
              className="max-w-full max-h-[85vh] rounded-xl shadow-2xl"
            />
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
