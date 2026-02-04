import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { twitchStreamersApi } from '../../services/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {
  Twitch,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Radio,
  Clock,
  Edit2,
  PlayCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface TwitchStreamer {
  id: string;
  twitchUsername: string;
  displayName: string;
  twitchUserId: string | null;
  isActive: boolean;
  isLive: boolean;
  lastLiveAt: string | null;
  lastCheckedAt: string | null;
  lastNotifiedAt: string | null;
  customMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function TwitchStreamers() {
  const queryClient = useQueryClient();
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingStreamer, setEditingStreamer] = useState<TwitchStreamer | null>(null);
  const [newStreamer, setNewStreamer] = useState({
    twitchUsername: '',
    displayName: '',
    customMessage: '',
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

  const { data: streamersData, isLoading, refetch } = useQuery({
    queryKey: ['twitch-streamers'],
    queryFn: async () => {
      const res = await twitchStreamersApi.getAll();
      return res.data as TwitchStreamer[];
    },
  });

  const streamers = streamersData || [];

  const createMutation = useMutation({
    mutationFn: twitchStreamersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['twitch-streamers'] });
      setShowNewForm(false);
      setNewStreamer({ twitchUsername: '', displayName: '', customMessage: '' });
      toast.success('Streamer hinzugefügt');
    },
    onError: () => toast.error('Fehler beim Hinzufügen'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TwitchStreamer> }) =>
      twitchStreamersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['twitch-streamers'] });
      setEditingStreamer(null);
      toast.success('Streamer aktualisiert');
    },
    onError: () => toast.error('Fehler beim Aktualisieren'),
  });

  const deleteMutation = useMutation({
    mutationFn: twitchStreamersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['twitch-streamers'] });
      toast.success('Streamer entfernt');
    },
    onError: () => toast.error('Fehler beim Löschen'),
  });

  const checkMutation = useMutation({
    mutationFn: twitchStreamersApi.check,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['twitch-streamers'] });
      toast.success('Alle Streamer überprüft');
    },
    onError: () => toast.error('Fehler beim Überprüfen'),
  });

  const handleCreate = () => {
    if (!newStreamer.twitchUsername || !newStreamer.displayName) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }
    createMutation.mutate(newStreamer);
  };

  const handleDelete = (streamer: TwitchStreamer) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Streamer entfernen',
      message: `Möchtest du "${streamer.displayName}" wirklich entfernen?`,
      confirmText: 'Entfernen',
      variant: 'danger',
      onConfirm: () => {
        deleteMutation.mutate(streamer.id);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleToggleActive = (streamer: TwitchStreamer) => {
    updateMutation.mutate({
      id: streamer.id,
      data: { isActive: !streamer.isActive },
    });
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Nie';
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600/20 via-slate-800 to-purple-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/20 rounded-2xl backdrop-blur-sm border border-purple-500/30 shadow-lg shadow-purple-500/20">
              <Twitch className="h-8 w-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Twitch Streamer</h1>
              <p className="text-slate-400 mt-0.5">
                Verwalte Streamer für Discord Live-Benachrichtigungen
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => checkMutation.mutate()}
              disabled={checkMutation.isPending}
              className="btn-secondary flex items-center gap-2"
            >
              <Radio className={clsx('h-4 w-4', checkMutation.isPending && 'animate-pulse')} />
              Jetzt prüfen
            </button>
            <button
              onClick={() => refetch()}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Aktualisieren
            </button>
            <button
              onClick={() => setShowNewForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Neuer Streamer
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 bg-gradient-to-br from-purple-900/20 to-slate-800/50 border-purple-700/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600/20 rounded-lg">
              <Twitch className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-purple-400">{streamers.length}</p>
              <p className="text-xs text-slate-400">Gesamt</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-green-900/20 to-slate-800/50 border-green-700/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-600/20 rounded-lg">
              <ToggleRight className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-green-400">
                {streamers.filter((s) => s.isActive).length}
              </p>
              <p className="text-xs text-slate-400">Aktiv</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-red-900/20 to-slate-800/50 border-red-700/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600/20 rounded-lg">
              <PlayCircle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-red-400">
                {streamers.filter((s) => s.isLive).length}
              </p>
              <p className="text-xs text-slate-400">Live</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-slate-800/50 to-slate-800/50 border-slate-700/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-600/20 rounded-lg">
              <ToggleLeft className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-400">
                {streamers.filter((s) => !s.isActive).length}
              </p>
              <p className="text-xs text-slate-400">Inaktiv</p>
            </div>
          </div>
        </div>
      </div>

      {/* New Streamer Form */}
      {showNewForm && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-purple-400" />
              Neuen Streamer hinzufügen
            </h2>
            <button
              onClick={() => setShowNewForm(false)}
              className="p-1 hover:bg-slate-700 rounded"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Twitch Username *
              </label>
              <input
                type="text"
                value={newStreamer.twitchUsername}
                onChange={(e) =>
                  setNewStreamer({ ...newStreamer, twitchUsername: e.target.value })
                }
                placeholder="z.B. shroud"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Anzeigename *
              </label>
              <input
                type="text"
                value={newStreamer.displayName}
                onChange={(e) =>
                  setNewStreamer({ ...newStreamer, displayName: e.target.value })
                }
                placeholder="z.B. Shroud"
                className="input w-full"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Benutzerdefinierte Nachricht (optional)
              </label>
              <input
                type="text"
                value={newStreamer.customMessage}
                onChange={(e) =>
                  setNewStreamer({ ...newStreamer, customMessage: e.target.value })
                }
                placeholder="z.B. Unser Streamer ist jetzt live!"
                className="input w-full"
              />
              <p className="text-xs text-slate-500 mt-1">
                Wenn leer, wird eine Standardnachricht verwendet
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowNewForm(false)} className="btn-ghost">
              Abbrechen
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {createMutation.isPending ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      )}

      {/* Streamers List */}
      <div className="card">
        <div className="p-4 border-b border-slate-700">
          <h2 className="font-semibold text-white">Streamer Liste</h2>
        </div>
        {streamers.length === 0 ? (
          <div className="p-12 text-center">
            <Twitch className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Noch keine Streamer hinzugefügt</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="mt-4 text-purple-400 hover:text-purple-300"
            >
              Ersten Streamer hinzufügen
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {streamers.map((streamer) => (
              <div
                key={streamer.id}
                className={clsx(
                  'p-4 flex items-center gap-4',
                  !streamer.isActive && 'opacity-50'
                )}
              >
                {/* Status Indicator */}
                <div className="relative">
                  <div
                    className={clsx(
                      'w-12 h-12 rounded-full flex items-center justify-center',
                      streamer.isLive
                        ? 'bg-red-500/20 border-2 border-red-500'
                        : 'bg-slate-700'
                    )}
                  >
                    <Twitch
                      className={clsx(
                        'h-6 w-6',
                        streamer.isLive ? 'text-red-400' : 'text-slate-400'
                      )}
                    />
                  </div>
                  {streamer.isLive && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {editingStreamer?.id === streamer.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editingStreamer.displayName}
                        onChange={(e) =>
                          setEditingStreamer({
                            ...editingStreamer,
                            displayName: e.target.value,
                          })
                        }
                        className="input w-full"
                        placeholder="Anzeigename"
                      />
                      <input
                        type="text"
                        value={editingStreamer.customMessage || ''}
                        onChange={(e) =>
                          setEditingStreamer({
                            ...editingStreamer,
                            customMessage: e.target.value || null,
                          })
                        }
                        className="input w-full"
                        placeholder="Benutzerdefinierte Nachricht"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            updateMutation.mutate({
                              id: editingStreamer.id,
                              data: {
                                displayName: editingStreamer.displayName,
                                customMessage: editingStreamer.customMessage,
                              },
                            })
                          }
                          className="btn-primary btn-sm flex items-center gap-1"
                        >
                          <Save className="h-3 w-3" />
                          Speichern
                        </button>
                        <button
                          onClick={() => setEditingStreamer(null)}
                          className="btn-ghost btn-sm"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{streamer.displayName}</p>
                        {streamer.isLive && (
                          <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full animate-pulse">
                            LIVE
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400">@{streamer.twitchUsername}</p>
                      {streamer.customMessage && (
                        <p className="text-xs text-slate-500 truncate mt-1">
                          {streamer.customMessage}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Timestamps */}
                <div className="hidden md:block text-right text-xs text-slate-500 space-y-1">
                  <div className="flex items-center justify-end gap-1">
                    <Clock className="h-3 w-3" />
                    Zuletzt geprüft: {formatDate(streamer.lastCheckedAt)}
                  </div>
                  {streamer.lastLiveAt && (
                    <div className="flex items-center justify-end gap-1">
                      <Radio className="h-3 w-3" />
                      Zuletzt live: {formatDate(streamer.lastLiveAt)}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(streamer)}
                    className={clsx(
                      'p-2 rounded-lg transition-colors',
                      streamer.isActive
                        ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    )}
                    title={streamer.isActive ? 'Deaktivieren' : 'Aktivieren'}
                  >
                    {streamer.isActive ? (
                      <ToggleRight className="h-5 w-5" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    onClick={() => setEditingStreamer(streamer)}
                    className="p-2 bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600 hover:text-white transition-colors"
                    title="Bearbeiten"
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(streamer)}
                    className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                    title="Löschen"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card p-4 bg-purple-500/5 border-purple-500/20">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Twitch className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-medium text-purple-300">Wie funktioniert's?</h3>
            <p className="text-sm text-slate-400 mt-1">
              Das System überprüft automatisch alle 2 Minuten, ob einer der eingetragenen
              Streamer live ist. Wenn ein Streamer live geht, wird eine Benachrichtigung
              im konfigurierten Discord-Kanal gesendet.
            </p>
            <p className="text-sm text-slate-400 mt-2">
              Stelle sicher, dass in den Einstellungen der Discord-Kanal für
              Twitch-Benachrichtigungen konfiguriert ist.
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
