import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { employeesApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import { StatusBadge } from '../components/ui/Badge';
import { Search, Plus, Filter } from 'lucide-react';
import type { Employee, PaginatedResponse } from '../types';

export default function Employees() {
  const navigate = useNavigate();
  const { canEditEmployees } = usePermissions();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page, search, status, department],
    queryFn: () =>
      employeesApi.getAll({
        page: String(page),
        limit: '20',
        ...(search && { search }),
        ...(status && { status }),
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
              `https://ui-avatars.com/api/?name=${employee.user?.username}&background=random`
            }
            alt={employee.user?.username}
            className="h-10 w-10 rounded-full"
          />
          <div>
            <p className="font-medium text-white">
              {employee.user?.displayName || employee.user?.username}
            </p>
            <p className="text-sm text-slate-400">@{employee.user?.username}</p>
          </div>
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
      key: 'rank',
      header: 'Rang',
      render: (employee: Employee) => (
        <span className="text-white font-medium">{employee.rank}</span>
      ),
    },
    {
      key: 'department',
      header: 'Abteilung',
      render: (employee: Employee) => (
        <span className="text-slate-300">{employee.department}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (employee: Employee) => <StatusBadge status={employee.status} />,
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
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input w-auto"
          >
            <option value="">Alle Status</option>
            <option value="ACTIVE">Aktiv</option>
            <option value="INACTIVE">Inaktiv</option>
            <option value="ON_LEAVE">Abwesend</option>
            <option value="SUSPENDED">Suspendiert</option>
          </select>

          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="input w-auto"
          >
            <option value="">Alle Abteilungen</option>
            <option value="Patrol">Patrol</option>
            <option value="Detective">Detective</option>
            <option value="SWAT">SWAT</option>
            <option value="Traffic">Traffic</option>
            <option value="Air Support">Air Support</option>
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
