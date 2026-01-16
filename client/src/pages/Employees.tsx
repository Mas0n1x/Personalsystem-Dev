import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { employeesApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import Table from '../components/ui/Table';
import { Search, Filter, ChevronUp, ChevronDown, Users, UserX, X, Check, TrendingUp, Shield, Star, Moon, CalendarOff } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Employee, PaginatedResponse } from '../types';

// Team-Farben basierend auf Rang-Level
function getTeamInfo(rankLevel: number): { name: string; bgClass: string; textClass: string } {
  if (rankLevel >= 16) {
    // 16-17: White
    return { name: 'White', bgClass: 'bg-white', textClass: 'text-slate-900' };
  } else if (rankLevel >= 13) {
    // 13-15: Red
    return { name: 'Red', bgClass: 'bg-red-600', textClass: 'text-white' };
  } else if (rankLevel >= 10) {
    // 10-12: Gold
    return { name: 'Gold', bgClass: 'bg-yellow-500', textClass: 'text-slate-900' };
  } else if (rankLevel >= 6) {
    // 6-9: Silver
    return { name: 'Silver', bgClass: 'bg-slate-400', textClass: 'text-slate-900' };
  } else {
    // 1-5: Green
    return { name: 'Green', bgClass: 'bg-green-600', textClass: 'text-white' };
  }
}

interface UnitRole {
  id: string;
  name: string;
  unit: string;
  isBase: boolean;
  order: number;
  position: number;
  active: boolean;
}

export default function Employees() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEditEmployees, canDeleteEmployees } = usePermissions();
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [rank, setRank] = useState('');
  const [team, setTeam] = useState('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Modal States
  const [unitsModalOpen, setUnitsModalOpen] = useState(false);
  const [terminateModalOpen, setTerminateModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedUnitRoles, setSelectedUnitRoles] = useState<string[]>([]);
  const [unitRoles, setUnitRoles] = useState<UnitRole[]>([]);
  const [terminateReason, setTerminateReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['employees', search, department, rank, team],
    queryFn: () =>
      employeesApi.getAll({
        all: 'true',
        sortBy: 'badgeNumber',
        ...(search && { search }),
        ...(department && { department }),
        ...(rank && { rank }),
        ...(team && { team }),
      }),
  });

  const response = data?.data as PaginatedResponse<Employee> | undefined;

  // Mutations
  const uprankMutation = useMutation({
    mutationFn: (id: string) => employeesApi.uprank(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success(`Befördert zu ${res.data.newRank}`);
    },
    onError: () => {
      toast.error('Beförderung fehlgeschlagen');
    },
  });

  const downrankMutation = useMutation({
    mutationFn: (id: string) => employeesApi.downrank(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success(`Degradiert zu ${res.data.newRank}`);
    },
    onError: () => {
      toast.error('Degradierung fehlgeschlagen');
    },
  });

  const setUnitsMutation = useMutation({
    mutationFn: ({ id, unitRoleIds }: { id: string; unitRoleIds: string[] }) =>
      employeesApi.setUnits(id, unitRoleIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Units aktualisiert');
      setUnitsModalOpen(false);
    },
    onError: () => {
      toast.error('Units-Update fehlgeschlagen');
    },
  });

  const terminateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      employeesApi.terminate(id, reason),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success(res.data.message);
      setTerminateModalOpen(false);
    },
    onError: () => {
      toast.error('Kündigung fehlgeschlagen');
    },
  });

  // Handlers
  const handleUprank = (e: React.MouseEvent, employee: Employee) => {
    e.stopPropagation();
    if (employee.rankLevel >= 17) {
      toast.error('Höchster Rang bereits erreicht');
      return;
    }
    uprankMutation.mutate(employee.id);
  };

  const handleDownrank = (e: React.MouseEvent, employee: Employee) => {
    e.stopPropagation();
    if (employee.rankLevel <= 1) {
      toast.error('Niedrigster Rang bereits erreicht');
      return;
    }
    downrankMutation.mutate(employee.id);
  };

  const handleOpenUnits = async (e: React.MouseEvent, employee: Employee) => {
    e.stopPropagation();
    setSelectedEmployee(employee);

    try {
      const res = await employeesApi.getUnits(employee.id);
      const roles = res.data.unitRoles as UnitRole[];
      setUnitRoles(roles);
      setSelectedUnitRoles(roles.filter(r => r.active).map(r => r.id));
      setUnitsModalOpen(true);
    } catch {
      toast.error('Fehler beim Laden der Units');
    }
  };

  const handleOpenTerminate = (e: React.MouseEvent, employee: Employee) => {
    e.stopPropagation();
    setSelectedEmployee(employee);
    setTerminateReason('');
    setTerminateModalOpen(true);
  };

  const handleSaveUnits = () => {
    if (!selectedEmployee) return;
    setUnitsMutation.mutate({
      id: selectedEmployee.id,
      unitRoleIds: selectedUnitRoles,
    });
  };

  const handleConfirmTerminate = () => {
    if (!selectedEmployee) return;
    terminateMutation.mutate({
      id: selectedEmployee.id,
      reason: terminateReason || undefined,
    });
  };

  const toggleUnitRole = (roleId: string) => {
    setSelectedUnitRoles(prev =>
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    );
  };

  // Rollen nach Unit gruppieren und sortieren (Basis-Rolle zuerst, dann nach order)
  const groupedUnitRoles = unitRoles.reduce<Record<string, UnitRole[]>>((acc, role) => {
    if (!acc[role.unit]) acc[role.unit] = [];
    acc[role.unit].push(role);
    return acc;
  }, {});

  // Innerhalb jeder Gruppe sortieren
  Object.values(groupedUnitRoles).forEach(roles => {
    roles.sort((a, b) => {
      if (a.isBase !== b.isBase) return a.isBase ? -1 : 1;
      return a.order - b.order;
    });
  });

  const columns = [
    {
      key: 'user',
      header: 'Mitarbeiter',
      render: (employee: Employee) => {
        const currentAbsence = employee.absences?.[0];
        return (
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={
                  employee.user?.avatar ||
                  `https://ui-avatars.com/api/?name=${employee.user?.displayName || employee.user?.username}&background=random`
                }
                alt={employee.user?.displayName || employee.user?.username}
                className="h-10 w-10 rounded-full"
              />
              {currentAbsence && (
                <div
                  className={`absolute -bottom-1 -right-1 p-1 rounded-full ${
                    currentAbsence.type === 'DAY_OFF'
                      ? 'bg-blue-500'
                      : 'bg-orange-500'
                  }`}
                  title={currentAbsence.type === 'DAY_OFF' ? 'Dienstfrei' : 'Abgemeldet'}
                >
                  {currentAbsence.type === 'DAY_OFF' ? (
                    <Moon className="h-3 w-3 text-white" />
                  ) : (
                    <CalendarOff className="h-3 w-3 text-white" />
                  )}
                </div>
              )}
            </div>
            <p className="font-medium text-white">
              {employee.user?.displayName || employee.user?.username}
            </p>
          </div>
        );
      },
    },
    {
      key: 'badgeNumber',
      header: 'Badge',
      render: (employee: Employee) => (
        <span className="text-slate-300">{employee.badgeNumber || '-'}</span>
      ),
    },
    {
      key: 'rankLevel',
      header: 'Team',
      render: (employee: Employee) => {
        const team = getTeamInfo(employee.rankLevel || 0);
        return (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${team.bgClass} ${team.textClass}`}>
            {team.name}
          </span>
        );
      },
    },
    {
      key: 'rank',
      header: 'Rang',
      render: (employee: Employee) => (
        <span className="text-white font-medium">{employee.rank}</span>
      ),
    },
    {
      key: 'department',
      header: 'Abteilung',
      render: (employee: Employee) => {
        const departments = employee.department?.split(', ').filter(Boolean) || [];
        if (departments.length === 0) {
          return <span className="text-slate-500">-</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {departments.map((dept, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-200"
              >
                {dept}
              </span>
            ))}
          </div>
        );
      },
    },
    ...(canEditEmployees
      ? [
          {
            key: 'actions',
            header: 'Aktionen',
            render: (employee: Employee) => (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {/* Uprank */}
                <button
                  onClick={(e) => handleUprank(e, employee)}
                  disabled={uprankMutation.isPending || employee.rankLevel >= 17}
                  className="p-1.5 rounded hover:bg-green-600/20 text-green-400 hover:text-green-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Befördern"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>

                {/* Downrank */}
                <button
                  onClick={(e) => handleDownrank(e, employee)}
                  disabled={downrankMutation.isPending || employee.rankLevel <= 1}
                  className="p-1.5 rounded hover:bg-orange-600/20 text-orange-400 hover:text-orange-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Degradieren"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>

                {/* Units */}
                <button
                  onClick={(e) => handleOpenUnits(e, employee)}
                  className="p-1.5 rounded hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 transition-colors"
                  title="Units bearbeiten"
                >
                  <Users className="h-4 w-4" />
                </button>

                {/* Terminate */}
                {canDeleteEmployees && (
                  <button
                    onClick={(e) => handleOpenTerminate(e, employee)}
                    className="p-1.5 rounded hover:bg-red-600/20 text-red-400 hover:text-red-300 transition-colors"
                    title="Kündigen"
                  >
                    <UserX className="h-4 w-4" />
                  </button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  // Filter zurücksetzen
  const resetFilters = () => {
    setSearch('');
    setDepartment('');
    setRank('');
    setTeam('');
  };

  const hasActiveFilters = search || department || rank || team;

  // Stats berechnen
  const employees = response?.data || [];
  const totalEmployees = response?.total || 0;
  const teamStats = {
    white: employees.filter(e => e.rankLevel >= 16).length,
    red: employees.filter(e => e.rankLevel >= 13 && e.rankLevel < 16).length,
    gold: employees.filter(e => e.rankLevel >= 10 && e.rankLevel < 13).length,
    silver: employees.filter(e => e.rankLevel >= 6 && e.rankLevel < 10).length,
    green: employees.filter(e => e.rankLevel >= 1 && e.rankLevel < 6).length,
  };

  return (
    <div className="space-y-6">
      {/* Header mit Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600/20 via-slate-800 to-purple-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-500/20 rounded-2xl backdrop-blur-sm border border-primary-500/30">
              <Users className="h-8 w-8 text-primary-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Mitarbeiter</h1>
              <p className="text-slate-400 mt-0.5">Übersicht aller Mitarbeiter des LSPD</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-white">{totalEmployees}</p>
              <p className="text-xs text-slate-400">Gesamt</p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card p-4 bg-gradient-to-br from-emerald-900/30 to-slate-800/50 border-emerald-700/30 hover:border-emerald-600/50 transition-all hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-400">{teamStats.green}</p>
              <p className="text-xs text-slate-400">Team Green</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-slate-500/30 to-slate-800/50 border-slate-500/30 hover:border-slate-400/50 transition-all hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-400/20 rounded-lg">
              <Shield className="h-4 w-4 text-slate-300" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-300">{teamStats.silver}</p>
              <p className="text-xs text-slate-400">Team Silver</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-amber-900/30 to-slate-800/50 border-amber-700/30 hover:border-amber-600/50 transition-all hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Star className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-amber-400">{teamStats.gold}</p>
              <p className="text-xs text-slate-400">Team Gold</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-red-900/30 to-slate-800/50 border-red-700/30 hover:border-red-600/50 transition-all hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <TrendingUp className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-red-400">{teamStats.red}</p>
              <p className="text-xs text-slate-400">Team Red</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-white/10 to-slate-800/50 border-white/20 hover:border-white/40 transition-all hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Star className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{teamStats.white}</p>
              <p className="text-xs text-slate-400">Team White</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="card p-4 backdrop-blur-xl">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <label htmlFor="employee-search" className="sr-only">Mitarbeiter suchen</label>
              <input
                id="employee-search"
                type="text"
                placeholder="Suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          <label htmlFor="department-filter" className="sr-only">Abteilung filtern</label>
          <select
            id="department-filter"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="input w-auto"
          >
            <option value="">Alle Abteilungen</option>
            <option value="S.W.A.T.">S.W.A.T.</option>
            <option value="Detectives">Detectives</option>
            <option value="Highway Patrol">Highway Patrol</option>
            <option value="Air Support">Air Support</option>
            <option value="Internal Affairs">Internal Affairs</option>
            <option value="Human Resources">Human Resources</option>
            <option value="Police Academy">Police Academy</option>
            <option value="BIKERS">BIKERS</option>
            <option value="Quality Assurance">Quality Assurance</option>
            <option value="Management">Management</option>
            <option value="Leadership">Leadership</option>
          </select>

          <button
            onClick={() => setShowMoreFilters(!showMoreFilters)}
            className={`btn-ghost ${showMoreFilters ? 'bg-slate-700' : ''}`}
          >
            <Filter className="h-4 w-4" />
            {showMoreFilters ? 'Weniger Filter' : 'Mehr Filter'}
          </button>

          {hasActiveFilters && (
            <button onClick={resetFilters} className="btn-ghost text-red-400 hover:text-red-300">
              <X className="h-4 w-4" />
              Filter zurücksetzen
            </button>
          )}
        </div>

        {/* Erweiterte Filter */}
        {showMoreFilters && (
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-700">
            <label htmlFor="rank-filter" className="sr-only">Rang filtern</label>
            <select
              id="rank-filter"
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              className="input w-auto"
            >
              <option value="">Alle Ränge</option>
              <option value="Recruit">Recruit</option>
              <option value="Junior Officer">Junior Officer</option>
              <option value="Officer I">Officer I</option>
              <option value="Officer II">Officer II</option>
              <option value="Officer III">Officer III</option>
              <option value="Senior Officer">Senior Officer</option>
              <option value="Sergeant">Sergeant</option>
              <option value="First Sergeant">First Sergeant</option>
              <option value="Staff Sergeant">Staff Sergeant</option>
              <option value="Lieutenant I">Lieutenant I</option>
              <option value="Lieutenant II">Lieutenant II</option>
              <option value="Senior Lieutenant">Senior Lieutenant</option>
              <option value="Captain">Captain</option>
              <option value="Commander">Commander</option>
              <option value="Commissioner of Teams / Units">Commissioner of Teams / Units</option>
              <option value="Assistant Chief">Assistant Chief</option>
              <option value="Chief">Chief</option>
            </select>

            <label htmlFor="team-filter" className="sr-only">Team filtern</label>
            <select
              id="team-filter"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="input w-auto"
            >
              <option value="">Alle Teams</option>
              <option value="Green">Team Green (1-5)</option>
              <option value="Silver">Team Silver (6-9)</option>
              <option value="Gold">Team Gold (10-12)</option>
              <option value="Red">Team Red (13-15)</option>
              <option value="White">Team White (16-17)</option>
            </select>
          </div>
        )}
      </div>

      {/* Tabelle */}
      <Table
        columns={columns}
        data={response?.data || []}
        keyExtractor={(e) => e.id}
        onRowClick={(e) => navigate(`/employees/${e.id}`)}
        isLoading={isLoading}
        emptyMessage="Keine Mitarbeiter gefunden"
      />


      {/* Units Modal */}
      {unitsModalOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-2xl mx-4 border border-slate-700/50 max-h-[80vh] overflow-y-auto shadow-2xl shadow-black/50 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                Units bearbeiten - {selectedEmployee.user?.displayName || selectedEmployee.user?.username}
              </h2>
              <button
                onClick={() => setUnitsModalOpen(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-6">
              {Object.entries(groupedUnitRoles).map(([unit, roles]) => (
                <div key={unit}>
                  <h3 className="text-lg font-semibold text-white mb-3">{unit}</h3>
                  <div className="space-y-2">
                    {/* Basis-Mitgliedsrolle */}
                    {roles.filter(r => r.isBase).map((role) => (
                      <button
                        key={role.id}
                        onClick={() => toggleUnitRole(role.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors w-full ${
                          selectedUnitRoles.includes(role.id)
                            ? 'bg-green-600/20 border-green-500 text-green-400'
                            : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selectedUnitRoles.includes(role.id)
                              ? 'border-green-500 bg-green-500'
                              : 'border-slate-500'
                          }`}
                        >
                          {selectedUnitRoles.includes(role.id) && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <span className="text-sm font-medium">{role.name.replace('» ', '')}</span>
                        <span className="text-xs text-slate-400 ml-auto">(Basis-Mitglied)</span>
                      </button>
                    ))}
                    {/* Rang-Rollen innerhalb der Unit */}
                    {roles.filter(r => !r.isBase).length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4 border-l-2 border-slate-600">
                        {roles.filter(r => !r.isBase).map((role) => (
                          <button
                            key={role.id}
                            onClick={() => toggleUnitRole(role.id)}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                              selectedUnitRoles.includes(role.id)
                                ? 'bg-primary-600/20 border-primary-500 text-primary-400'
                                : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                selectedUnitRoles.includes(role.id)
                                  ? 'border-primary-500 bg-primary-500'
                                  : 'border-slate-500'
                              }`}
                            >
                              {selectedUnitRoles.includes(role.id) && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <span className="text-sm">{role.name.replace('» ', '')}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={() => setUnitsModalOpen(false)}
                className="btn-ghost"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSaveUnits}
                disabled={setUnitsMutation.isPending}
                className="btn-primary"
              >
                {setUnitsMutation.isPending ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate Modal */}
      {terminateModalOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-md mx-4 border border-red-900/50 shadow-2xl shadow-red-900/20 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-red-400">Mitarbeiter kündigen</h2>
              <button
                onClick={() => setTerminateModalOpen(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 p-4 bg-slate-700/50 rounded-lg mb-4">
                <img
                  src={
                    selectedEmployee.user?.avatar ||
                    `https://ui-avatars.com/api/?name=${selectedEmployee.user?.username}&background=random`
                  }
                  alt={selectedEmployee.user?.displayName || selectedEmployee.user?.username}
                  className="h-12 w-12 rounded-full"
                />
                <div>
                  <p className="font-medium text-white">
                    {selectedEmployee.user?.displayName || selectedEmployee.user?.username}
                  </p>
                  <p className="text-sm text-slate-400">
                    {selectedEmployee.rank} - {selectedEmployee.badgeNumber || 'Kein Badge'}
                  </p>
                </div>
              </div>

              <p className="text-slate-300 mb-4">
                Dieser Mitarbeiter wird aus dem System gelöscht und vom Discord-Server gekickt.
                Diese Aktion kann nicht rückgängig gemacht werden.
              </p>

              <div>
                <label htmlFor="terminate-reason" className="block text-sm font-medium text-slate-300 mb-1">
                  Kündigungsgrund (optional)
                </label>
                <textarea
                  id="terminate-reason"
                  value={terminateReason}
                  onChange={(e) => setTerminateReason(e.target.value)}
                  className="input w-full h-24 resize-none"
                  placeholder="z.B. Inaktivität, Regelverstoß..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setTerminateModalOpen(false)}
                className="btn-ghost"
              >
                Abbrechen
              </button>
              <button
                onClick={handleConfirmTerminate}
                disabled={terminateMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {terminateMutation.isPending ? 'Wird gekündigt...' : 'Kündigen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
