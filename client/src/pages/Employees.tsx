import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { employeesApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import { Search, Plus, Filter } from 'lucide-react';
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

export default function Employees() {
  const navigate = useNavigate();
  const { canEditEmployees } = usePermissions();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page, search, department],
    queryFn: () =>
      employeesApi.getAll({
        page: String(page),
        limit: '20',
        ...(search && { search }),
        ...(department && { department }),
      }),
  });

  const response = data?.data as PaginatedResponse<Employee> | undefined;

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
            alt={employee.user?.displayName}
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
        const departments = employee.department?.split(', ').filter(Boolean) || ['Patrol'];
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
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mitarbeiter</h1>
          <p className="text-slate-400 mt-1">Übersicht aller Mitarbeiter des LSPD</p>
        </div>
        {canEditEmployees && (
          <button className="btn-primary">
            <Plus className="h-4 w-4" />
            Neuer Mitarbeiter
          </button>
        )}
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
            <option value="Patrol">Patrol</option>
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

          <button className="btn-ghost">
            <Filter className="h-4 w-4" />
            Mehr Filter
          </button>
        </div>
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
    </div>
  );
}
