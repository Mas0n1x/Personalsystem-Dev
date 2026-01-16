import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { unitsApi } from '../../services/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  X,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Crown,
  Save,
  Settings,
  Crosshair,
  Scale,
  GraduationCap,
  Search,
  UserCheck,
  Bike,
  PartyPopper,
  Car,
  BadgeCheck,
  type LucideIcon,
} from 'lucide-react';

// Icon Mapping fuer Units basierend auf Name/ShortName
const unitIconMap: Record<string, LucideIcon> = {
  'SWAT': Crosshair,
  'Special Weapons & Tactics': Crosshair,
  'IA': Scale,
  'Internal Affairs': Scale,
  'PA': GraduationCap,
  'Police Academy': GraduationCap,
  'DET': Search,
  'Detectives': Search,
  'HR': UserCheck,
  'Human Ressource': UserCheck,
  'Biker': Bike,
  'MGMT': Settings,
  'Management': Settings,
  'ET': PartyPopper,
  'Eventteam': PartyPopper,
  'SHP': Car,
  'State & Highway Patrol': Car,
  'QA': BadgeCheck,
  'Quality Assurance': BadgeCheck,
  'TL': Crown,
  'Teamleitung': Crown,
};

function getUnitIcon(unit: { name: string; shortName: string | null }): LucideIcon {
  if (unit.shortName && unitIconMap[unit.shortName]) {
    return unitIconMap[unit.shortName];
  }
  if (unitIconMap[unit.name]) {
    return unitIconMap[unit.name];
  }
  return Shield;
}

interface UnitRole {
  id: string;
  discordRoleId: string;
  discordRoleName: string;
  position: string;
  sortOrder: number;
  isLeadership: boolean;
}

interface Unit {
  id: string;
  name: string;
  shortName: string | null;
  description: string | null;
  color: string;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
  roles: UnitRole[];
}

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
}

export default function UnitsAdmin() {
  const queryClient = useQueryClient();
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [selectedUnitForRole, setSelectedUnitForRole] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<UnitRole | null>(null);

  // Unit Form State
  const [unitName, setUnitName] = useState('');
  const [unitShortName, setUnitShortName] = useState('');
  const [unitDescription, setUnitDescription] = useState('');
  const [unitColor, setUnitColor] = useState('#6366f1');
  const [unitSortOrder, setUnitSortOrder] = useState(0);
  const [unitIsActive, setUnitIsActive] = useState(true);

  // Role Form State
  const [roleDiscordId, setRoleDiscordId] = useState('');
  const [rolePosition, setRolePosition] = useState('');
  const [roleSortOrder, setRoleSortOrder] = useState(0);
  const [roleIsLeadership, setRoleIsLeadership] = useState(false);
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
  const { data: unitsData, isLoading: unitsLoading } = useQuery({
    queryKey: ['units-admin'],
    queryFn: async () => {
      const res = await unitsApi.getAllAdmin();
      return res.data as Unit[];
    },
  });

  const { data: discordRolesData, isLoading: discordRolesLoading } = useQuery({
    queryKey: ['discord-roles-units'],
    queryFn: async () => {
      const res = await unitsApi.getDiscordRoles();
      return res.data as { serverName: string; roles: DiscordRole[] };
    },
  });

  const units = unitsData || [];
  const discordRoles = discordRolesData?.roles || [];

  // Mutations
  const createUnitMutation = useMutation({
    mutationFn: unitsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units-admin'] });
      queryClient.invalidateQueries({ queryKey: ['units-overview'] });
      closeUnitModal();
      toast.success('Unit erstellt');
    },
    onError: () => {
      toast.error('Fehler beim Erstellen der Unit');
    },
  });

  const updateUnitMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof unitsApi.update>[1] }) =>
      unitsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units-admin'] });
      queryClient.invalidateQueries({ queryKey: ['units-overview'] });
      closeUnitModal();
      toast.success('Unit aktualisiert');
    },
    onError: () => {
      toast.error('Fehler beim Aktualisieren der Unit');
    },
  });

  const deleteUnitMutation = useMutation({
    mutationFn: unitsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units-admin'] });
      queryClient.invalidateQueries({ queryKey: ['units-overview'] });
      toast.success('Unit gelöscht');
    },
    onError: () => {
      toast.error('Fehler beim Löschen der Unit');
    },
  });

  const addRoleMutation = useMutation({
    mutationFn: ({ unitId, data }: { unitId: string; data: Parameters<typeof unitsApi.addRole>[1] }) =>
      unitsApi.addRole(unitId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units-admin'] });
      queryClient.invalidateQueries({ queryKey: ['units-overview'] });
      closeRoleModal();
      toast.success('Rolle hinzugefügt');
    },
    onError: () => {
      toast.error('Fehler beim Hinzufügen der Rolle');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ unitId, roleId, data }: { unitId: string; roleId: string; data: Parameters<typeof unitsApi.updateRole>[2] }) =>
      unitsApi.updateRole(unitId, roleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units-admin'] });
      queryClient.invalidateQueries({ queryKey: ['units-overview'] });
      closeRoleModal();
      toast.success('Rolle aktualisiert');
    },
    onError: () => {
      toast.error('Fehler beim Aktualisieren der Rolle');
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: ({ unitId, roleId }: { unitId: string; roleId: string }) =>
      unitsApi.deleteRole(unitId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units-admin'] });
      queryClient.invalidateQueries({ queryKey: ['units-overview'] });
      toast.success('Rolle entfernt');
    },
    onError: () => {
      toast.error('Fehler beim Entfernen der Rolle');
    },
  });

  // Modal Functions
  const openUnitModal = (unit?: Unit) => {
    if (unit) {
      setEditingUnit(unit);
      setUnitName(unit.name);
      setUnitShortName(unit.shortName || '');
      setUnitDescription(unit.description || '');
      setUnitColor(unit.color);
      setUnitSortOrder(unit.sortOrder);
      setUnitIsActive(unit.isActive);
    } else {
      setEditingUnit(null);
      setUnitName('');
      setUnitShortName('');
      setUnitDescription('');
      setUnitColor('#6366f1');
      setUnitSortOrder(units.length);
      setUnitIsActive(true);
    }
    setShowUnitModal(true);
  };

  const closeUnitModal = () => {
    setShowUnitModal(false);
    setEditingUnit(null);
    setUnitName('');
    setUnitShortName('');
    setUnitDescription('');
    setUnitColor('#6366f1');
    setUnitSortOrder(0);
    setUnitIsActive(true);
  };

  const openRoleModal = (unitId: string, role?: UnitRole) => {
    setSelectedUnitForRole(unitId);
    if (role) {
      setEditingRole(role);
      setRoleDiscordId(role.discordRoleId);
      setRolePosition(role.position);
      setRoleSortOrder(role.sortOrder);
      setRoleIsLeadership(role.isLeadership);
    } else {
      setEditingRole(null);
      setRoleDiscordId('');
      setRolePosition('');
      setRoleSortOrder(0);
      setRoleIsLeadership(false);
    }
    setShowRoleModal(true);
  };

  const closeRoleModal = () => {
    setShowRoleModal(false);
    setSelectedUnitForRole(null);
    setEditingRole(null);
    setRoleDiscordId('');
    setRolePosition('');
    setRoleSortOrder(0);
    setRoleIsLeadership(false);
  };

  const handleUnitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: unitName,
      shortName: unitShortName || undefined,
      description: unitDescription || undefined,
      color: unitColor,
      sortOrder: unitSortOrder,
      isActive: unitIsActive,
    };

    if (editingUnit) {
      updateUnitMutation.mutate({ id: editingUnit.id, data });
    } else {
      createUnitMutation.mutate(data);
    }
  };

  const handleRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitForRole) return;

    const selectedRole = discordRoles.find((r) => r.id === roleDiscordId);
    const data = {
      discordRoleId: roleDiscordId,
      discordRoleName: selectedRole?.name || 'Unbekannte Rolle',
      position: rolePosition,
      sortOrder: roleSortOrder,
      isLeadership: roleIsLeadership,
    };

    if (editingRole) {
      updateRoleMutation.mutate({
        unitId: selectedUnitForRole,
        roleId: editingRole.id,
        data: { position: rolePosition, sortOrder: roleSortOrder, isLeadership: roleIsLeadership },
      });
    } else {
      addRoleMutation.mutate({ unitId: selectedUnitForRole, data });
    }
  };

  const toggleUnit = (unitId: string) => {
    setExpandedUnit((prev) => (prev === unitId ? null : unitId));
  };

  if (unitsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header mit Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-600/20 via-slate-800 to-teal-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-500/20 rounded-2xl backdrop-blur-sm border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
              <Settings className="h-8 w-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Units Verwaltung</h1>
              <p className="text-slate-400 mt-0.5">Units erstellen und Discord-Rollen zuweisen</p>
            </div>
          </div>
          <button
            onClick={() => openUnitModal()}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Neue Unit
          </button>
        </div>
      </div>

      {/* Discord Info */}
      {discordRolesData && (
        <div className="card p-4 bg-[#5865F2]/10 border-[#5865F2]/30">
          <div className="flex items-center gap-2 text-slate-300">
            <Shield className="h-5 w-5 text-[#5865F2]" />
            <span>Verbunden mit: <strong className="text-white">{discordRolesData.serverName}</strong></span>
            <span className="text-slate-500">|</span>
            <span>{discordRoles.length} Unit-Rollen verfügbar (beginnen mit »)</span>
          </div>
        </div>
      )}

      {/* Units List */}
      <div className="space-y-4">
        {units.length === 0 ? (
          <div className="card p-12 text-center">
            <Shield className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Keine Units vorhanden</p>
            <button
              onClick={() => openUnitModal()}
              className="btn-primary mt-4"
            >
              Erste Unit erstellen
            </button>
          </div>
        ) : (
          units.map((unit) => (
            <div
              key={unit.id}
              className={clsx(
                'card overflow-hidden',
                !unit.isActive && 'opacity-60'
              )}
            >
              {/* Unit Header */}
              <div
                className="flex items-center gap-4 p-4"
                style={{ borderLeft: `4px solid ${unit.color}` }}
              >
                <button
                  onClick={() => toggleUnit(unit.id)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {expandedUnit === unit.id ? (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  )}
                </button>
                {(() => {
                  const UnitIcon = getUnitIcon(unit);
                  return (
                    <div
                      className="p-3 rounded-xl"
                      style={{ backgroundColor: `${unit.color}20` }}
                    >
                      <UnitIcon className="h-6 w-6" style={{ color: unit.color }} />
                    </div>
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{unit.name}</h3>
                    {unit.shortName && (
                      <span className="px-2 py-0.5 text-xs bg-slate-600/50 text-slate-300 rounded">
                        {unit.shortName}
                      </span>
                    )}
                    {!unit.isActive && (
                      <span className="px-2 py-0.5 text-xs bg-red-600/20 text-red-400 rounded">
                        Inaktiv
                      </span>
                    )}
                  </div>
                  {unit.description && (
                    <p className="text-sm text-slate-400 truncate mt-0.5">
                      {unit.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-white">{unit.roles.length}</p>
                    <p className="text-xs text-slate-400">Rollen</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-amber-400">
                      {unit.roles.filter((r) => r.isLeadership).length}
                    </p>
                    <p className="text-xs text-slate-400">Leitung</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openUnitModal(unit)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDialog({
                      isOpen: true,
                      title: 'Unit löschen',
                      message: `Möchtest du die Unit "${unit.name}" wirklich löschen?`,
                      confirmText: 'Löschen',
                      variant: 'danger',
                      onConfirm: () => deleteUnitMutation.mutate(unit.id),
                    })}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Unit Roles */}
              {expandedUnit === unit.id && (
                <div className="border-t border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-white">Discord-Rollen</h4>
                    <button
                      onClick={() => openRoleModal(unit.id)}
                      className="btn-secondary text-sm flex items-center gap-1"
                      disabled={discordRolesLoading}
                    >
                      <Plus className="h-3 w-3" />
                      Rolle hinzufügen
                    </button>
                  </div>
                  {unit.roles.length === 0 ? (
                    <p className="text-slate-500 text-sm">
                      Keine Rollen zugewiesen. Füge Discord-Rollen hinzu, um Mitglieder dieser Unit anzuzeigen.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {unit.roles
                        .sort((a, b) => b.sortOrder - a.sortOrder)
                        .map((role) => (
                          <div
                            key={role.id}
                            className={clsx(
                              'flex items-center gap-3 p-3 rounded-lg',
                              role.isLeadership
                                ? 'bg-amber-900/10 border border-amber-700/30'
                                : 'bg-slate-700/30'
                            )}
                          >
                            {role.isLeadership && (
                              <Crown className="h-4 w-4 text-amber-400" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white">{role.position}</span>
                                <span className="text-xs text-slate-500">
                                  ({role.discordRoleName})
                                </span>
                              </div>
                              <span className="text-xs text-slate-400">
                                Sortierung: {role.sortOrder}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openRoleModal(unit.id, role)}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmDialog({
                                  isOpen: true,
                                  title: 'Rolle entfernen',
                                  message: 'Möchtest du diese Rolle wirklich entfernen?',
                                  confirmText: 'Entfernen',
                                  variant: 'danger',
                                  onConfirm: () => deleteRoleMutation.mutate({ unitId: unit.id, roleId: role.id }),
                                })}
                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-600/20 rounded transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Unit Modal */}
      {showUnitModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl w-full max-w-lg border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {editingUnit ? 'Unit bearbeiten' : 'Neue Unit'}
              </h2>
              <button onClick={closeUnitModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleUnitSubmit} className="p-6 space-y-5">
              <div>
                <label className="label">Name *</label>
                <input
                  type="text"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  className="input"
                  placeholder="z.B. Internal Affairs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Kürzel</label>
                  <input
                    type="text"
                    value={unitShortName}
                    onChange={(e) => setUnitShortName(e.target.value)}
                    className="input"
                    placeholder="z.B. IA"
                  />
                </div>
                <div>
                  <label className="label">Farbe</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={unitColor}
                      onChange={(e) => setUnitColor(e.target.value)}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={unitColor}
                      onChange={(e) => setUnitColor(e.target.value)}
                      className="input flex-1"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Beschreibung</label>
                <textarea
                  value={unitDescription}
                  onChange={(e) => setUnitDescription(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="Beschreibung der Unit..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Sortierung</label>
                  <input
                    type="number"
                    value={unitSortOrder}
                    onChange={(e) => setUnitSortOrder(parseInt(e.target.value) || 0)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Status</label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={unitIsActive}
                      onChange={(e) => setUnitIsActive(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500"
                    />
                    <span className="text-white">Aktiv</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeUnitModal} className="btn-ghost px-5">
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-2 px-5"
                  disabled={createUnitMutation.isPending || updateUnitMutation.isPending}
                >
                  <Save className="h-4 w-4" />
                  {editingUnit ? 'Speichern' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Modal */}
      {showRoleModal && selectedUnitForRole && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl w-full max-w-md border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {editingRole ? 'Rolle bearbeiten' : 'Rolle hinzufügen'}
              </h2>
              <button onClick={closeRoleModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleRoleSubmit} className="p-6 space-y-5">
              {!editingRole && (
                <div>
                  <label className="label">Discord-Rolle *</label>
                  <select
                    value={roleDiscordId}
                    onChange={(e) => setRoleDiscordId(e.target.value)}
                    className="input"
                    required
                  >
                    <option value="">Rolle auswählen...</option>
                    {discordRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Nur Rollen die mit » beginnen werden angezeigt
                  </p>
                </div>
              )}

              <div>
                <label className="label">Positionsname *</label>
                <input
                  type="text"
                  value={rolePosition}
                  onChange={(e) => setRolePosition(e.target.value)}
                  className="input"
                  placeholder="z.B. Abteilungsleiter, Mitglied, etc."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Sortierung</label>
                  <input
                    type="number"
                    value={roleSortOrder}
                    onChange={(e) => setRoleSortOrder(parseInt(e.target.value) || 0)}
                    className="input"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Höher = weiter oben
                  </p>
                </div>
                <div>
                  <label className="label">Typ</label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roleIsLeadership}
                      onChange={(e) => setRoleIsLeadership(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                    />
                    <Crown className="h-4 w-4 text-amber-400" />
                    <span className="text-white">Leitungsposition</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeRoleModal} className="btn-ghost px-5">
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-2 px-5"
                  disabled={addRoleMutation.isPending || updateRoleMutation.isPending}
                >
                  <Save className="h-4 w-4" />
                  {editingRole ? 'Speichern' : 'Hinzufügen'}
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
