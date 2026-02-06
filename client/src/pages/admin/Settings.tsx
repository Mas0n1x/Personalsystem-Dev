import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { Settings as SettingsIcon, RefreshCw, Database, Bot, Save, UserPlus, X, Key, Copy, Eye, EyeOff, Twitch } from 'lucide-react';
import toast from 'react-hot-toast';

interface DiscordInfo {
  name: string;
  memberCount: number;
  channels: { id: string; name: string }[];
  roles: { id: string; name: string; color: string }[];
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [showApiKey, setShowApiKey] = useState(false);

  const { isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await adminApi.getSettings();
      setSettings(res.data || {});
      return res;
    },
  });

  const { data: discordData, isLoading: discordLoading } = useQuery({
    queryKey: ['discord-info'],
    queryFn: adminApi.getDiscordInfo,
  });

  const { data: statsData } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: adminApi.getStats,
  });

  const discordInfo = discordData?.data as DiscordInfo | undefined;
  const stats = statsData?.data;

  const updateSettingsMutation = useMutation({
    mutationFn: adminApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['public-settings'] });
      toast.success('Einstellungen gespeichert');
    },
    onError: () => {
      toast.error('Fehler beim Speichern der Einstellungen');
    },
  });

  const syncRolesMutation = useMutation({
    mutationFn: adminApi.syncRoles,
    onSuccess: () => {
      toast.success('Rollen synchronisiert');
    },
  });

  const syncMembersMutation = useMutation({
    mutationFn: adminApi.syncMembers,
    onSuccess: (response) => {
      const data = response.data.data;
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success(`Sync abgeschlossen: ${data.created} erstellt, ${data.updated} aktualisiert`);
    },
  });

  const handleSave = () => {
    updateSettingsMutation.mutate(settings);
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header mit Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-600/20 via-slate-800 to-zinc-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-gray-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-zinc-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-500/20 rounded-2xl backdrop-blur-sm border border-gray-500/30 shadow-lg shadow-gray-500/20">
              <SettingsIcon className="h-8 w-8 text-gray-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Einstellungen</h1>
              <p className="text-slate-400 mt-0.5">System-Konfiguration</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-slate-400">Benutzer</p>
          <p className="text-2xl font-bold text-white">{stats?.users || 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-400">Mitarbeiter</p>
          <p className="text-2xl font-bold text-white">{stats?.employees || 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-400">Rollen</p>
          <p className="text-2xl font-bold text-white">{stats?.roles || 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-400">Audit-Logs</p>
          <p className="text-2xl font-bold text-white">{stats?.auditLogs || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Discord Integration */}
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Bot className="h-5 w-5 text-[#5865F2]" />
            <h2 className="font-semibold text-white">Discord Integration</h2>
          </div>
          <div className="card-body">
            {discordLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
              </div>
            ) : discordInfo ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-slate-400">Verbundener Server</p>
                  <p className="text-lg font-medium text-white">{discordInfo.name}</p>
                  <p className="text-sm text-slate-400">{discordInfo.memberCount} Mitglieder</p>
                </div>

                <div>
                  <p className="text-sm text-slate-400 mb-2">
                    {discordInfo.roles.length} Rollen verfügbar
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {discordInfo.roles.slice(0, 10).map((role) => (
                      <span
                        key={role.id}
                        className="px-2 py-1 rounded text-xs"
                        style={{ backgroundColor: role.color + '20', color: role.color }}
                      >
                        {role.name}
                      </span>
                    ))}
                    {discordInfo.roles.length > 10 && (
                      <span className="badge-gray text-xs">
                        +{discordInfo.roles.length - 10} weitere
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => syncMembersMutation.mutate()}
                    disabled={syncMembersMutation.isPending}
                    className="btn-primary w-full"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncMembersMutation.isPending ? 'animate-spin' : ''}`} />
                    Mitglieder synchronisieren (Rang 1-17)
                  </button>
                  <p className="text-xs text-slate-400 text-center">
                    Automatische Synchronisation alle 5 Minuten aktiv
                  </p>
                  <button
                    onClick={() => syncRolesMutation.mutate()}
                    disabled={syncRolesMutation.isPending}
                    className="btn-secondary w-full"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncRolesMutation.isPending ? 'animate-spin' : ''}`} />
                    Discord-Rollen synchronisieren
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-slate-400">
                <p>Discord-Bot nicht verbunden</p>
                <p className="text-sm mt-1">
                  Stelle sicher, dass DISCORD_BOT_TOKEN konfiguriert ist.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* System Settings */}
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Database className="h-5 w-5 text-primary-400" />
            <h2 className="font-semibold text-white">Systemeinstellungen</h2>
          </div>
          <div className="card-body space-y-4">
            <div>
              <label className="label">Seiten-Titel</label>
              <input
                className="input"
                value={settings.siteTitle || ''}
                onChange={(e) => setSettings({ ...settings, siteTitle: e.target.value })}
                placeholder="LSPD Personalsystem"
              />
              <p className="text-xs text-slate-500 mt-1">
                Wird im Browser-Tab und Header angezeigt
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={updateSettingsMutation.isPending}
              className="btn-primary w-full"
            >
              <Save className="h-4 w-4" />
              Einstellungen speichern
            </button>
          </div>
        </div>
      </div>

      {/* HR Onboarding Einstellungen */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-green-400" />
          <h2 className="font-semibold text-white">HR Onboarding - Einstellungen</h2>
        </div>
        <div className="card-body space-y-4">
          <p className="text-sm text-slate-400">
            Konfiguriere die Standardwerte fuer neue Mitarbeiter bei der Einstellung.
          </p>

          <div>
            <label className="label">Start-Rang</label>
            <select
              className="input"
              value={settings.hrStartingRank || 'Recruit'}
              onChange={(e) => setSettings({ ...settings, hrStartingRank: e.target.value })}
            >
              <option value="Recruit">Recruit</option>
              <option value="Officer I">Officer I</option>
              <option value="Officer II">Officer II</option>
              <option value="Officer III">Officer III</option>
              <option value="Senior Officer">Senior Officer</option>
              <option value="Corporal">Corporal</option>
              <option value="Sergeant I">Sergeant I</option>
              <option value="Sergeant II">Sergeant II</option>
              <option value="Lieutenant I">Lieutenant I</option>
              <option value="Lieutenant II">Lieutenant II</option>
              <option value="Captain">Captain</option>
              <option value="Commander">Commander</option>
              <option value="Deputy Chief">Deputy Chief</option>
              <option value="Assistant Chief">Assistant Chief</option>
              <option value="Chief of Police">Chief of Police</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Rang der bei neuen Mitarbeitern vergeben wird
            </p>
          </div>

          <div className="p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <p className="text-xs text-blue-400">
              Bei der Einstellung wird automatisch eine Dienstnummer aus dem entsprechenden Team-Bereich vergeben.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={updateSettingsMutation.isPending}
            className="btn-primary w-full"
          >
            <Save className="h-4 w-4" />
            Einstellungen speichern
          </button>
        </div>
      </div>

      {/* HR Onboarding Discord Rollen */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-green-400" />
          <h2 className="font-semibold text-white">Discord Rollen bei Einstellung</h2>
        </div>
        <div className="card-body space-y-4">
          <p className="text-sm text-slate-400">
            Waehle die Discord-Rollen aus, die neuen Mitarbeitern bei der Einstellung automatisch zugewiesen werden.
          </p>

          {discordInfo && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {discordInfo.roles.map((role) => {
                const currentIds = settings.hrOnboardingRoleIds?.split(',').map(id => id.trim()).filter(Boolean) || [];
                const isSelected = currentIds.includes(role.id);
                return (
                  <label
                    key={role.id}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-green-900/30 border border-green-700/50' : 'bg-slate-700/30 hover:bg-slate-700/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        if (isSelected) {
                          const newIds = currentIds.filter(id => id !== role.id).join(', ');
                          setSettings({ ...settings, hrOnboardingRoleIds: newIds || '' });
                        } else {
                          const newIds = [...currentIds, role.id].join(', ');
                          setSettings({ ...settings, hrOnboardingRoleIds: newIds });
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-500 text-green-500 focus:ring-green-500 bg-slate-700"
                    />
                    <span
                      className="px-2 py-0.5 rounded text-sm font-medium"
                      style={{ backgroundColor: role.color + '20', color: role.color || '#fff' }}
                    >
                      {role.name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {settings.hrOnboardingRoleIds && (
            <div className="p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
              <p className="text-xs text-green-400">
                {settings.hrOnboardingRoleIds.split(',').filter(id => id.trim()).length} Rolle(n) ausgewaehlt
              </p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={updateSettingsMutation.isPending}
            className="btn-primary w-full"
          >
            <Save className="h-4 w-4" />
            Rollen-Einstellungen speichern
          </button>
        </div>
      </div>

      {/* Twitch Benachrichtigungen */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Twitch className="h-5 w-5 text-purple-400" />
          <h2 className="font-semibold text-white">Twitch Benachrichtigungen</h2>
        </div>
        <div className="card-body space-y-4">
          <p className="text-sm text-slate-400">
            Konfiguriere den Discord-Kanal für Twitch-Live-Benachrichtigungen.
          </p>

          <div>
            <label className="label">Benachrichtigungs-Kanal</label>
            <select
              className="input"
              value={settings.twitch_notification_channel || ''}
              onChange={(e) => setSettings({ ...settings, twitch_notification_channel: e.target.value })}
            >
              <option value="">-- Kanal auswählen --</option>
              {discordInfo?.channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  #{channel.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              In diesen Kanal werden Benachrichtigungen gesendet, wenn ein Streamer live geht.
            </p>
          </div>

          {settings.twitch_notification_channel && (
            <div className="p-3 bg-purple-900/20 border border-purple-700/30 rounded-lg">
              <p className="text-xs text-purple-400">
                Benachrichtigungen werden in{' '}
                <span className="font-medium">
                  #{discordInfo?.channels.find(c => c.id === settings.twitch_notification_channel)?.name || settings.twitch_notification_channel}
                </span>{' '}
                gesendet
              </p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={updateSettingsMutation.isPending}
            className="btn-primary w-full"
          >
            <Save className="h-4 w-4" />
            Twitch-Einstellungen speichern
          </button>
        </div>
      </div>

      {/* Leitstelle External API */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Key className="h-5 w-5 text-yellow-400" />
          <h2 className="font-semibold text-white">Leitstelle External API</h2>
        </div>
        <div className="card-body space-y-4">
          <p className="text-sm text-slate-400">
            API-Key fuer externe Systeme (z.B. Leitstelle von Paul Stevens).
            Diese API liefert Mitarbeiterdaten und Live-Updates via WebSocket.
          </p>

          <div>
            <label className="label">API-Key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  className="input pr-10 font-mono text-sm"
                  value={settings.leitstelleExternalApiKey || ''}
                  onChange={(e) => setSettings({ ...settings, leitstelleExternalApiKey: e.target.value })}
                  placeholder="API-Key eingeben oder generieren"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newKey = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
                  setSettings({ ...settings, leitstelleExternalApiKey: newKey });
                  toast.success('Neuer API-Key generiert');
                }}
                className="btn-secondary"
              >
                Generieren
              </button>
              {settings.leitstelleExternalApiKey && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(settings.leitstelleExternalApiKey || '');
                    toast.success('API-Key kopiert');
                  }}
                  className="btn-secondary"
                >
                  <Copy className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Dieser Key wird benoetigt um auf die externe API zuzugreifen.
            </p>
          </div>

          <div className="p-3 bg-slate-700/50 rounded-lg space-y-2">
            <p className="text-xs text-slate-400 font-medium">API Endpunkte:</p>
            <div className="text-xs font-mono text-slate-300 space-y-1">
              <p>GET /api/leitstelle-external/status</p>
              <p>GET /api/leitstelle-external/employees</p>
              <p>GET /api/leitstelle-external/employees/:id</p>
              <p className="text-blue-400">WS  /socket.io (Room: leitstelle-external)</p>
            </div>
          </div>

          <div className="p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <p className="text-xs text-blue-400">
              <strong>Authentifizierung:</strong> Header <code className="bg-slate-700 px-1 rounded">X-API-Key: [key]</code> oder Query <code className="bg-slate-700 px-1 rounded">?api_key=[key]</code>
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={updateSettingsMutation.isPending}
            className="btn-primary w-full"
          >
            <Save className="h-4 w-4" />
            API-Einstellungen speichern
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card border-red-900/50">
        <div className="card-header border-red-900/50">
          <h2 className="font-semibold text-red-400">Gefahrenzone</h2>
        </div>
        <div className="card-body">
          <p className="text-slate-400 text-sm mb-4">
            Diese Aktionen koennen nicht rueckgaengig gemacht werden. Bitte sei vorsichtig.
          </p>
          <div className="flex gap-4">
            <button className="btn-danger" disabled>
              Datenbank zuruecksetzen
            </button>
            <button className="btn-danger" disabled>
              Alle Audit-Logs loeschen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
