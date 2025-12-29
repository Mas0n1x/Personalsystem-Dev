import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { Settings as SettingsIcon, RefreshCw, Database, Bot, Save } from 'lucide-react';
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

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: adminApi.getSettings,
    onSuccess: (data) => setSettings(data.data || {}),
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
      toast.success('Einstellungen gespeichert');
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-8 w-8 text-primary-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Einstellungen</h1>
          <p className="text-slate-400 mt-1">System-Konfiguration</p>
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
            </div>

            <div>
              <label className="label">Standard-Abteilung für neue Mitarbeiter</label>
              <input
                className="input"
                value={settings.defaultDepartment || ''}
                onChange={(e) => setSettings({ ...settings, defaultDepartment: e.target.value })}
                placeholder="Patrol"
              />
            </div>

            <div>
              <label className="label">Standard-Rang für neue Mitarbeiter</label>
              <input
                className="input"
                value={settings.defaultRank || ''}
                onChange={(e) => setSettings({ ...settings, defaultRank: e.target.value })}
                placeholder="Cadet"
              />
            </div>

            <div>
              <label className="label">Backup-Aufbewahrung (Tage)</label>
              <input
                type="number"
                className="input"
                value={settings.backupRetention || ''}
                onChange={(e) => setSettings({ ...settings, backupRetention: e.target.value })}
                placeholder="30"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={updateSettingsMutation.isLoading}
              className="btn-primary w-full"
            >
              <Save className="h-4 w-4" />
              Einstellungen speichern
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card border-red-900/50">
        <div className="card-header border-red-900/50">
          <h2 className="font-semibold text-red-400">Gefahrenzone</h2>
        </div>
        <div className="card-body">
          <p className="text-slate-400 text-sm mb-4">
            Diese Aktionen können nicht rückgängig gemacht werden. Bitte sei vorsichtig.
          </p>
          <div className="flex gap-4">
            <button className="btn-danger" disabled>
              Datenbank zurücksetzen
            </button>
            <button className="btn-danger" disabled>
              Alle Audit-Logs löschen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
