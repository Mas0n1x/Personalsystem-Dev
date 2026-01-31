import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { detectiveProfilesApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { User, Users, Eye, Pencil, Save, X, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';

interface DetectiveProfile {
  id: string;
  employeeId: string;
  civilianCoverName: string | null;
  detectiveName: string | null;
  realName: string | null;
  employee: {
    id: string;
    rank: string;
    rankLevel: number;
    department: string;
    badgeNumber: string | null;
    user: {
      displayName: string | null;
      username: string;
      avatar: string | null;
    };
  };
}

export default function DetectiveNamesManager() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    civilianCoverName: '',
    detectiveName: '',
    realName: '',
  });

  const canManage = hasPermission('detectives.manage');

  // Profiles query
  const { data: profiles = [], isLoading, refetch } = useQuery<DetectiveProfile[]>({
    queryKey: ['detective-profiles'],
    queryFn: async () => {
      const response = await detectiveProfilesApi.getAll();
      return response.data;
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ employeeId, data }: { employeeId: string; data: typeof formData }) =>
      detectiveProfilesApi.update(employeeId, data),
    onSuccess: () => {
      toast.success('Profil aktualisiert');
      queryClient.invalidateQueries({ queryKey: ['detective-profiles'] });
      setEditingProfile(null);
      setFormData({ civilianCoverName: '', detectiveName: '', realName: '' });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Fehler beim Aktualisieren');
    },
  });

  const handleEdit = (profile: DetectiveProfile) => {
    setEditingProfile(profile.employeeId);
    setFormData({
      civilianCoverName: profile.civilianCoverName || '',
      detectiveName: profile.detectiveName || '',
      realName: profile.realName || '',
    });
  };

  const handleSave = (employeeId: string) => {
    updateMutation.mutate({ employeeId, data: formData });
  };

  const handleCancel = () => {
    setEditingProfile(null);
    setFormData({ civilianCoverName: '', detectiveName: '', realName: '' });
  };

  const filteredProfiles = profiles.filter((profile) => {
    const query = searchQuery.toLowerCase();
    return (
      profile.employee.user.displayName?.toLowerCase().includes(query) ||
      profile.employee.user.username.toLowerCase().includes(query) ||
      profile.civilianCoverName?.toLowerCase().includes(query) ||
      profile.detectiveName?.toLowerCase().includes(query) ||
      profile.realName?.toLowerCase().includes(query) ||
      profile.employee.badgeNumber?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="h-6 w-6 text-blue-400" />
              Detective Namen-Dokumentation
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Verwalte Zivilnamen, Detective-Namen und Klarnamen aller Detectives
            </p>
          </div>

          <button onClick={() => refetch()} className="btn-ghost text-sm px-3 py-1">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Suche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Suche nach Namen, Badge-Nummer..."
            className="input w-full pl-10"
          />
        </div>
      </div>

      {/* Statistiken */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-sm text-slate-400 mb-1">Gesamt Detectives</p>
          <p className="text-2xl font-bold text-white">{profiles.length}</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-sm text-slate-400 mb-1">Profile mit Zivilnamen</p>
          <p className="text-2xl font-bold text-white">
            {profiles.filter((p) => p.civilianCoverName).length}
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-sm text-slate-400 mb-1">Vollständige Profile</p>
          <p className="text-2xl font-bold text-white">
            {profiles.filter((p) => p.civilianCoverName && p.detectiveName && p.realName).length}
          </p>
        </div>
      </div>

      {/* Profile Liste */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">
            {filteredProfiles.length === profiles.length
              ? `Alle Detectives (${profiles.length})`
              : `${filteredProfiles.length} von ${profiles.length} Detectives`}
          </h3>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">Lädt...</div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">
                {searchQuery ? 'Keine Detectives gefunden' : 'Keine Detectives vorhanden'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProfiles.map((profile) => {
                const isEditing = editingProfile === profile.employeeId;
                const displayName =
                  profile.employee.user.displayName || profile.employee.user.username;

                return (
                  <div
                    key={profile.id}
                    className="bg-slate-700/30 rounded-lg p-4 border border-slate-600"
                  >
                    {isEditing ? (
                      <div className="space-y-4">
                        {/* Badge & Rang */}
                        <div className="flex items-center gap-3 pb-4 border-b border-slate-600">
                          {profile.employee.user.avatar ? (
                            <img
                              src={profile.employee.user.avatar}
                              alt={displayName}
                              className="h-10 w-10 rounded-full"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold">
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-white">{displayName}</p>
                            <p className="text-sm text-slate-400">
                              {profile.employee.badgeNumber && `#${profile.employee.badgeNumber} • `}
                              {profile.employee.rank}
                            </p>
                          </div>
                        </div>

                        {/* Edit Form */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">
                              Ziviler Deckname
                            </label>
                            <input
                              type="text"
                              value={formData.civilianCoverName}
                              onChange={(e) =>
                                setFormData({ ...formData, civilianCoverName: e.target.value })
                              }
                              placeholder="z.B. John Doe"
                              className="input w-full"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">
                              Detektiv-Name
                            </label>
                            <input
                              type="text"
                              value={formData.detectiveName}
                              onChange={(e) =>
                                setFormData({ ...formData, detectiveName: e.target.value })
                              }
                              placeholder="z.B. Detective Smith"
                              className="input w-full"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">
                              Klarname
                            </label>
                            <input
                              type="text"
                              value={formData.realName}
                              onChange={(e) =>
                                setFormData({ ...formData, realName: e.target.value })
                              }
                              placeholder="z.B. Max Mustermann"
                              className="input w-full"
                            />
                          </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            onClick={() => handleSave(profile.employeeId)}
                            disabled={updateMutation.isPending}
                            className="btn-primary flex items-center gap-2"
                          >
                            <Save className="h-4 w-4" />
                            Speichern
                          </button>
                          <button
                            onClick={handleCancel}
                            disabled={updateMutation.isPending}
                            className="btn-ghost flex items-center gap-2"
                          >
                            <X className="h-4 w-4" />
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {/* View Mode */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              {profile.employee.user.avatar ? (
                                <img
                                  src={profile.employee.user.avatar}
                                  alt={displayName}
                                  className="h-10 w-10 rounded-full"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold">
                                  {displayName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-white">{displayName}</p>
                                <p className="text-sm text-slate-400">
                                  {profile.employee.badgeNumber && `#${profile.employee.badgeNumber} • `}
                                  {profile.employee.rank}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                              <div>
                                <p className="text-xs font-medium text-slate-400 mb-1">
                                  Ziviler Deckname
                                </p>
                                <p className="text-sm text-white">
                                  {profile.civilianCoverName || (
                                    <span className="text-slate-500 italic">Nicht angegeben</span>
                                  )}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-medium text-slate-400 mb-1">
                                  Detektiv-Name
                                </p>
                                <p className="text-sm text-white">
                                  {profile.detectiveName || (
                                    <span className="text-slate-500 italic">Nicht angegeben</span>
                                  )}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-medium text-slate-400 mb-1">Klarname</p>
                                <p className="text-sm text-white">
                                  {profile.realName || (
                                    <span className="text-slate-500 italic">Nicht angegeben</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>

                          {canManage && (
                            <button
                              onClick={() => handleEdit(profile)}
                              className="text-blue-400 hover:text-blue-300 transition-colors p-2"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
