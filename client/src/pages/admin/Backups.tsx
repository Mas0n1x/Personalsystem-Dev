import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {
  Database,
  Download,
  Trash2,
  RotateCcw,
  Plus,
  HardDrive,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileArchive,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface Backup {
  id: string;
  filename: string;
  size: number;
  path: string;
  status: string;
  createdAt: string;
}

interface BackupStats {
  totalBackups: number;
  totalSize: number;
  totalSizeFormatted: string;
  latestBackup: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'COMPLETED':
      return (
        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Erfolgreich
        </span>
      );
    case 'PRE_RESTORE':
      return (
        <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Vor-Wiederherstellung
        </span>
      );
    case 'FAILED':
      return (
        <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-medium flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Fehlgeschlagen
        </span>
      );
    default:
      return (
        <span className="px-2 py-1 bg-slate-500/20 text-slate-400 rounded-full text-xs font-medium">
          {status}
        </span>
      );
  }
}

export default function Backups() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);
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

  // Queries
  const { data: backupsData, isLoading } = useQuery({
    queryKey: ['admin-backups'],
    queryFn: () => adminApi.getBackups({ limit: '50' }).then(res => res.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-backup-stats'],
    queryFn: () => adminApi.getBackupStats().then(res => res.data),
  });

  const backups: Backup[] = backupsData?.data || [];
  const backupStats: BackupStats | undefined = stats;

  // Mutations
  const createBackup = useMutation({
    mutationFn: () => adminApi.createBackup(),
    onMutate: () => {
      setIsCreating(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-backups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-backup-stats'] });
      toast.success('Backup erfolgreich erstellt');
    },
    onError: () => {
      toast.error('Fehler beim Erstellen des Backups');
    },
    onSettled: () => {
      setIsCreating(false);
    },
  });

  const restoreBackup = useMutation({
    mutationFn: (id: string) => adminApi.restoreBackup(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-backups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-backup-stats'] });
      toast.success(data.data.message || 'Backup wurde wiederhergestellt');
      setRestoreConfirm(null);
    },
    onError: () => {
      toast.error('Fehler beim Wiederherstellen des Backups');
    },
  });

  const deleteBackup = useMutation({
    mutationFn: (id: string) => adminApi.deleteBackup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-backups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-backup-stats'] });
      toast.success('Backup gelöscht');
    },
    onError: () => {
      toast.error('Fehler beim Löschen des Backups');
    },
  });

  const handleDownload = (backup: Backup) => {
    window.open(adminApi.downloadBackup(backup.id), '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header mit Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600/20 via-slate-800 to-emerald-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-2xl backdrop-blur-sm border border-blue-500/30 shadow-lg shadow-blue-500/20">
              <Database className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Backups</h1>
              <p className="text-slate-400 mt-0.5">Datenbank-Backups verwalten</p>
            </div>
          </div>
          <button
            onClick={() => createBackup.mutate()}
            disabled={isCreating}
            className="btn-primary flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Erstelle Backup...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Neues Backup
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      {backupStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <FileArchive className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Anzahl Backups</p>
              <p className="text-2xl font-bold text-white">{backupStats.totalBackups}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <HardDrive className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Gesamtgröße</p>
              <p className="text-2xl font-bold text-white">{backupStats.totalSizeFormatted}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-500/20 rounded-lg">
              <Calendar className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Letztes Backup</p>
              <p className="text-lg font-bold text-white">
                {backupStats.latestBackup ? formatDate(backupStats.latestBackup) : 'Kein Backup'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Backups List */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      )}

      {!isLoading && backups.length === 0 && (
        <div className="card p-8 text-center">
          <Database className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Keine Backups vorhanden</h3>
          <p className="text-slate-400 mb-4">
            Erstellen Sie jetzt ein Backup Ihrer Datenbank.
          </p>
          <button
            onClick={() => createBackup.mutate()}
            disabled={isCreating}
            className="btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Erstes Backup erstellen
          </button>
        </div>
      )}

      {!isLoading && backups.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Dateiname
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Größe
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Erstellt
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {backups.map((backup) => (
                <tr key={backup.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Database className="h-5 w-5 text-slate-400" />
                      <span className="text-white font-medium">{backup.filename}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {formatBytes(backup.size)}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(backup.status)}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {formatDate(backup.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleDownload(backup)}
                        className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                        title="Herunterladen"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setRestoreConfirm(backup.id)}
                        className="p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors"
                        title="Wiederherstellen"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDialog({
                          isOpen: true,
                          title: 'Backup löschen',
                          message: 'Möchtest du dieses Backup wirklich löschen?',
                          confirmText: 'Löschen',
                          variant: 'danger',
                          onConfirm: () => deleteBackup.mutate(backup.id),
                        })}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {restoreConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl max-w-md w-full p-6 border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-amber-500/20 rounded-full">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Backup wiederherstellen?</h2>
            </div>
            <p className="text-slate-300 mb-6">
              Sind Sie sicher, dass Sie dieses Backup wiederherstellen möchten?
              Die aktuelle Datenbank wird durch das Backup ersetzt.
              Ein automatisches Backup des aktuellen Zustands wird vorher erstellt.
            </p>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-6">
              <p className="text-amber-400 text-sm">
                <strong>Hinweis:</strong> Nach der Wiederherstellung muss der Server möglicherweise
                neu gestartet werden, damit alle Änderungen wirksam werden.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRestoreConfirm(null)}
                className="btn-secondary"
              >
                Abbrechen
              </button>
              <button
                onClick={() => restoreBackup.mutate(restoreConfirm)}
                disabled={restoreBackup.isPending}
                className="btn-primary bg-amber-600 hover:bg-amber-700"
              >
                {restoreBackup.isPending ? 'Wiederherstellen...' : 'Wiederherstellen'}
              </button>
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
