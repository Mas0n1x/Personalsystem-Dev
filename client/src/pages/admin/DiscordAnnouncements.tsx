import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { discordAnnouncementsApi } from '../../services/api';
import {
  MessageSquare,
  Save,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowLeftRight,
  Star,
  GraduationCap,
  UserMinus,
  UserPlus,
  Check,
  X,
  Hash
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface AnnouncementConfig {
  id: string | null;
  type: string;
  channelId: string | null;
  enabled: boolean;
  description: string;
  createdAt: string | null;
  updatedAt: string | null;
}

interface DiscordChannel {
  id: string;
  name: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  PROMOTION: <TrendingUp className="h-5 w-5 text-green-400" />,
  DEMOTION: <TrendingDown className="h-5 w-5 text-red-400" />,
  SANCTION: <AlertTriangle className="h-5 w-5 text-orange-400" />,
  UNIT_CHANGE: <ArrowLeftRight className="h-5 w-5 text-purple-400" />,
  UNIT_PROMOTION: <Star className="h-5 w-5 text-cyan-400" />,
  ACADEMY_GRADUATION: <GraduationCap className="h-5 w-5 text-blue-400" />,
  TERMINATION: <UserMinus className="h-5 w-5 text-slate-400" />,
  HIRE: <UserPlus className="h-5 w-5 text-emerald-400" />,
};

const TYPE_COLORS: Record<string, string> = {
  PROMOTION: 'bg-green-500/10 border-green-500/30',
  DEMOTION: 'bg-red-500/10 border-red-500/30',
  SANCTION: 'bg-orange-500/10 border-orange-500/30',
  UNIT_CHANGE: 'bg-purple-500/10 border-purple-500/30',
  UNIT_PROMOTION: 'bg-cyan-500/10 border-cyan-500/30',
  ACADEMY_GRADUATION: 'bg-blue-500/10 border-blue-500/30',
  TERMINATION: 'bg-slate-500/10 border-slate-500/30',
  HIRE: 'bg-emerald-500/10 border-emerald-500/30',
};

export default function DiscordAnnouncements() {
  const queryClient = useQueryClient();
  const [configs, setConfigs] = useState<AnnouncementConfig[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Konfigurationen laden
  const { data: configsData, isLoading: configsLoading } = useQuery({
    queryKey: ['discord-announcement-configs'],
    queryFn: async () => {
      const res = await discordAnnouncementsApi.getConfigs();
      return res.data as AnnouncementConfig[];
    },
  });

  // Verfügbare Discord-Kanäle laden
  const { data: channelsData, isLoading: channelsLoading } = useQuery({
    queryKey: ['discord-announcement-channels'],
    queryFn: async () => {
      const res = await discordAnnouncementsApi.getChannels();
      return res.data as { serverName: string; channels: DiscordChannel[] };
    },
  });

  useEffect(() => {
    if (configsData) {
      setConfigs(configsData);
    }
  }, [configsData]);

  // Speicher-Mutation
  const saveMutation = useMutation({
    mutationFn: () => discordAnnouncementsApi.saveAllConfigs(
      configs.map(c => ({
        type: c.type,
        channelId: c.channelId,
        enabled: c.enabled,
      }))
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discord-announcement-configs'] });
      setHasChanges(false);
      toast.success('Einstellungen gespeichert');
    },
    onError: () => {
      toast.error('Fehler beim Speichern');
    },
  });

  const handleToggle = (type: string) => {
    setConfigs(prev => prev.map(c =>
      c.type === type ? { ...c, enabled: !c.enabled } : c
    ));
    setHasChanges(true);
  };

  const handleChannelChange = (type: string, channelId: string) => {
    setConfigs(prev => prev.map(c =>
      c.type === type ? { ...c, channelId: channelId || null } : c
    ));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate();
  };

  if (configsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-primary-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Discord Ankündigungen</h1>
            <p className="text-slate-400 text-sm">
              Konfiguriere Discord-Kanäle für automatische Ankündigungen
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['discord-announcement-configs'] })}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Aktualisieren
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            className={clsx(
              'btn-primary flex items-center gap-2',
              (!hasChanges || saveMutation.isPending) && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Server-Info */}
      {channelsData && (
        <div className="card p-4">
          <div className="flex items-center gap-2 text-slate-300">
            <Hash className="h-5 w-5 text-primary-400" />
            <span>Verbunden mit: <strong className="text-white">{channelsData.serverName}</strong></span>
            <span className="text-slate-500">|</span>
            <span>{channelsData.channels.length} Kanäle verfügbar</span>
          </div>
        </div>
      )}

      {/* Konfigurationskarten */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {configs.map((config) => (
          <div
            key={config.type}
            className={clsx(
              'card p-4 border-2 transition-all',
              config.enabled ? TYPE_COLORS[config.type] : 'border-transparent opacity-60'
            )}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {TYPE_ICONS[config.type]}
                <div>
                  <h3 className="font-semibold text-white">{config.description}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{config.type}</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle(config.type)}
                className={clsx(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  config.enabled ? 'bg-primary-500' : 'bg-slate-600'
                )}
              >
                <span
                  className={clsx(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    config.enabled ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-slate-500" />
              <select
                value={config.channelId || ''}
                onChange={(e) => handleChannelChange(config.type, e.target.value)}
                disabled={!config.enabled}
                className={clsx(
                  'input flex-1 text-sm',
                  !config.enabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <option value="">Kanal auswählen...</option>
                {channelsData?.channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status-Indikator */}
            <div className="mt-3 flex items-center gap-2 text-xs">
              {config.enabled && config.channelId ? (
                <span className="flex items-center gap-1 text-green-400">
                  <Check className="h-3 w-3" />
                  Aktiv
                </span>
              ) : config.enabled ? (
                <span className="flex items-center gap-1 text-yellow-400">
                  <AlertTriangle className="h-3 w-3" />
                  Kein Kanal ausgewählt
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-500">
                  <X className="h-3 w-3" />
                  Deaktiviert
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Hinweis */}
      <div className="card p-4 bg-blue-500/10 border-blue-500/30">
        <h4 className="text-blue-400 font-medium mb-2">Hinweis</h4>
        <p className="text-sm text-slate-300">
          Die Discord-Ankündigungen werden automatisch gesendet, wenn die entsprechenden Aktionen im Personalsystem durchgeführt werden.
          Stelle sicher, dass der Bot die Berechtigung hat, in den ausgewählten Kanälen zu schreiben.
        </p>
      </div>
    </div>
  );
}
