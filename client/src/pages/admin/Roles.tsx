import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Modal from '../../components/ui/Modal';
import { Plus, Edit, Trash2, Shield, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Role, Permission } from '../../types';

interface RoleWithCount extends Role {
  _count: { users: number };
}

interface DiscordRole {
  id: string;
  name: string;
  color: string;
}

export default function Roles() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleWithCount | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
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

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: adminApi.getRoles,
  });

  const { data: permissionsData } = useQuery({
    queryKey: ['permissions'],
    queryFn: adminApi.getPermissions,
  });

  const { data: discordInfoData } = useQuery({
    queryKey: ['discord-info'],
    queryFn: adminApi.getDiscordInfo,
  });

  const roles = rolesData?.data as RoleWithCount[] | undefined;
  const permissions = permissionsData?.data as Permission[] | undefined;
  const discordRoles = discordInfoData?.data?.roles as DiscordRole[] | undefined;

  const createMutation = useMutation({
    mutationFn: adminApi.createRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowCreateModal(false);
      toast.success('Rolle erstellt');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      adminApi.updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setSelectedRole(null);
      toast.success('Rolle aktualisiert');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Rolle gelöscht');
    },
  });

  const seedPermissionsMutation = useMutation({
    mutationFn: adminApi.seedPermissions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      toast.success('Berechtigungen erstellt');
    },
  });

  // Permissions nach Kategorie gruppieren
  const permissionsByCategory = permissions?.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      name: formData.get('name') as string,
      displayName: formData.get('displayName') as string,
      color: formData.get('color') as string,
      discordRoleId: formData.get('discordRoleId') as string,
      level: Number(formData.get('level')),
      permissionIds: selectedPermissions,
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedRole) return;
    const formData = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: selectedRole.id,
      data: {
        name: formData.get('name') as string,
        displayName: formData.get('displayName') as string,
        color: formData.get('color') as string,
        discordRoleId: formData.get('discordRoleId') as string,
        level: Number(formData.get('level')),
        permissionIds: selectedPermissions,
      },
    });
  };

  const openEditModal = (role: RoleWithCount) => {
    setSelectedRole(role);
    setSelectedPermissions(role.permissions.map((p) => p.id));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header mit Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600/20 via-slate-800 to-purple-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 rounded-2xl backdrop-blur-sm border border-indigo-500/30 shadow-lg shadow-indigo-500/20">
              <Shield className="h-8 w-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Rollen</h1>
              <p className="text-slate-400 mt-0.5">Rollen und Berechtigungen verwalten</p>
            </div>
          </div>
          <div className="flex gap-2">
            {!permissions?.length && (
              <button
                onClick={() => seedPermissionsMutation.mutate()}
                className="btn-secondary"
              >
                Berechtigungen initialisieren
              </button>
            )}
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              <Plus className="h-4 w-4" />
              Neue Rolle
            </button>
          </div>
        </div>
      </div>

      {/* Rollen-Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles?.map((role) => {
          const discordRole = discordRoles?.find(dr => dr.id === role.discordRoleId);
          return (
            <div key={role.id} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-8 w-8" style={{ color: role.color }} />
                  <div>
                    <h3 className="font-semibold text-white">{role.displayName}</h3>
                    <p className="text-sm text-slate-400">Level {role.level}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditModal(role)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDialog({
                      isOpen: true,
                      title: 'Rolle löschen',
                      message: 'Möchtest du diese Rolle wirklich löschen?',
                      confirmText: 'Löschen',
                      variant: 'danger',
                      onConfirm: () => deleteMutation.mutate(role.id),
                    })}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {discordRole && (
                <div className="mb-3 px-2 py-1 rounded bg-slate-700/50 inline-block">
                  <span className="text-xs text-slate-400">Discord: </span>
                  <span className="text-xs text-white">{discordRole.name}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
                <Users className="h-4 w-4" />
                <span>{role._count.users} Benutzer</span>
              </div>

              <div className="flex flex-wrap gap-1">
                {role.permissions.slice(0, 5).map((perm) => (
                  <span key={perm.id} className="badge-gray text-xs">
                    {perm.name}
                  </span>
                ))}
                {role.permissions.length > 5 && (
                  <span className="badge-gray text-xs">
                    +{role.permissions.length - 5} weitere
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedPermissions([]);
        }}
        title="Neue Rolle"
        size="lg"
        footer={
          <>
            <button
              onClick={() => {
                setShowCreateModal(false);
                setSelectedPermissions([]);
              }}
              className="btn-secondary"
            >
              Abbrechen
            </button>
            <button type="submit" form="create-form" className="btn-primary">
              Erstellen
            </button>
          </>
        }
      >
        <form id="create-form" onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Name (intern) *</label>
              <input name="name" className="input" required placeholder="z.B. admin" />
            </div>
            <div>
              <label className="label">Anzeigename *</label>
              <input name="displayName" className="input" required placeholder="z.B. Administrator" />
            </div>
          </div>
          <div>
            <label className="label">Discord Rolle *</label>
            <select name="discordRoleId" className="input" required>
              <option value="">Discord Rolle auswählen...</option>
              {discordRoles?.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Farbe</label>
              <input name="color" type="color" className="input h-10" defaultValue="#6B7280" />
            </div>
            <div>
              <label className="label">Level</label>
              <input name="level" type="number" min="0" className="input" defaultValue="0" />
            </div>
          </div>
          <div>
            <label className="label">Berechtigungen</label>
            <div className="max-h-64 overflow-y-auto space-y-4 p-4 bg-slate-700/50 rounded-lg">
              {permissionsByCategory &&
                Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div key={category}>
                    <p className="text-sm font-medium text-slate-300 mb-2 uppercase">
                      {category}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {perms.map((perm) => (
                        <label
                          key={perm.id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                            selectedPermissions.includes(perm.id)
                              ? 'bg-primary-600 text-white'
                              : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(perm.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPermissions([...selectedPermissions, perm.id]);
                              } else {
                                setSelectedPermissions(
                                  selectedPermissions.filter((id) => id !== perm.id)
                                );
                              }
                            }}
                            className="sr-only"
                          />
                          <span className="text-sm">{perm.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!selectedRole}
        onClose={() => {
          setSelectedRole(null);
          setSelectedPermissions([]);
        }}
        title="Rolle bearbeiten"
        size="lg"
        footer={
          <>
            <button
              onClick={() => {
                setSelectedRole(null);
                setSelectedPermissions([]);
              }}
              className="btn-secondary"
            >
              Abbrechen
            </button>
            <button type="submit" form="edit-form" className="btn-primary">
              Speichern
            </button>
          </>
        }
      >
        {selectedRole && (
          <form id="edit-form" onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Name (intern) *</label>
                <input
                  name="name"
                  className="input"
                  required
                  defaultValue={selectedRole.name}
                />
              </div>
              <div>
                <label className="label">Anzeigename *</label>
                <input
                  name="displayName"
                  className="input"
                  required
                  defaultValue={selectedRole.displayName}
                />
              </div>
            </div>
            <div>
              <label className="label">Discord Rolle *</label>
              <select name="discordRoleId" className="input" required defaultValue={selectedRole.discordRoleId || ''}>
                <option value="">Discord Rolle auswählen...</option>
                {discordRoles?.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Farbe</label>
                <input
                  name="color"
                  type="color"
                  className="input h-10"
                  defaultValue={selectedRole.color}
                />
              </div>
              <div>
                <label className="label">Level</label>
                <input
                  name="level"
                  type="number"
                  min="0"
                  className="input"
                  defaultValue={selectedRole.level}
                />
              </div>
            </div>
            <div>
              <label className="label">Berechtigungen</label>
              <div className="max-h-64 overflow-y-auto space-y-4 p-4 bg-slate-700/50 rounded-lg">
                {permissionsByCategory &&
                  Object.entries(permissionsByCategory).map(([category, perms]) => (
                    <div key={category}>
                      <p className="text-sm font-medium text-slate-300 mb-2 uppercase">
                        {category}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {perms.map((perm) => (
                          <label
                            key={perm.id}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                              selectedPermissions.includes(perm.id)
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedPermissions.includes(perm.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPermissions([...selectedPermissions, perm.id]);
                                } else {
                                  setSelectedPermissions(
                                    selectedPermissions.filter((id) => id !== perm.id)
                                  );
                                }
                              }}
                              className="sr-only"
                            />
                            <span className="text-sm">{perm.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </form>
        )}
      </Modal>

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
