import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { employeesApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import { Search, Filter, ChevronUp, ChevronDown, Users, UserX, X, Check } from 'lucide-react';
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
  const [page, setPage] = useState(1);
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
    queryKey: ['employees', page, search, department, rank, team],
    queryFn: () =>
      employeesApi.getAll({
        page: String(page),
        limit: '20',
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
      render: (employee: Employee) => (
        <div className="flex items-center gap-3">
          <img
            src={
              employee.user?.avatar ||
              `https://ui-avatars.com/api/?name=${employee.user?.displayName || employee.user?.username}&background=random`
            }
            alt={employee.user?.displayName || employee.user?.username}
            className="h-10 w-10 rounded-full"
          />
          <p className="font-medium text-white">
            {employee.user?.displayName || employee.user?.username}
          </p>
        </div>
      ),
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
    setPage(1);
  };

  const hasActiveFilters = search || department || rank || team;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mitarbeiter</h1>
          <p className="text-slate-400 mt-1">Übersicht aller Mitarbeiter des LSPD</p>
        </div>
      </div>

      {/* Filter */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          <select
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
            <select
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

            <select
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

      {/* Pagination */}
      {response && response.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={response.totalPages}
          onPageChange={setPage}
          total={response.total}
          limit={response.limit}
        />
      )}

      {/* Units Modal */}
      {unitsModalOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-2xl mx-4 border border-slate-700 max-h-[80vh] overflow-y-auto">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md mx-4 border border-slate-700">
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
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Kündigungsgrund (optional)
                </label>
                <textarea
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
