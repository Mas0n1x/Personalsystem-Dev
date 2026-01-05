import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import { Search, FileText, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { AuditLog, PaginatedResponse } from '../../types';

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, entity, action],
    queryFn: () =>
      adminApi.getAuditLogs({
        page: String(page),
        limit: '50',
        ...(entity && { entity }),
        ...(action && { action }),
      }),
  });

  const response = data?.data as PaginatedResponse<AuditLog> | undefined;

  const getActionColor = (action: string): string => {
    if (action.includes('POST')) return 'text-green-400';
    if (action.includes('PUT') || action.includes('PATCH')) return 'text-yellow-400';
    if (action.includes('DELETE')) return 'text-red-400';
    return 'text-slate-400';
  };

  const columns = [
    {
      key: 'action',
      header: 'Aktion',
      render: (log: AuditLog) => (
        <span className={`font-mono text-sm ${getActionColor(log.action)}`}>
          {log.action}
        </span>
      ),
    },
    {
      key: 'entity',
      header: 'Bereich',
      render: (log: AuditLog) => (
        <span className="badge-gray">{log.entity}</span>
      ),
    },
    {
      key: 'user',
      header: 'Benutzer',
      render: (log: AuditLog) =>
        log.user ? (
          <div className="flex items-center gap-2">
            <img
              src={
                log.user.avatar ||
                `https://ui-avatars.com/api/?name=${log.user.username}&background=random`
              }
              alt={log.user.username}
              className="h-6 w-6 rounded-full"
            />
            <span className="text-slate-300">{log.user.displayName || log.user.username}</span>
          </div>
        ) : (
          <span className="text-slate-500">System</span>
        ),
    },
    {
      key: 'details',
      header: 'Details',
      render: (log: AuditLog) => (
        <span className="text-slate-400 text-sm line-clamp-1">
          {log.details ? JSON.stringify(log.details).substring(0, 50) + '...' : '-'}
        </span>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP',
      render: (log: AuditLog) => (
        <span className="text-slate-400 font-mono text-sm">{log.ipAddress || '-'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Zeit',
      render: (log: AuditLog) => (
        <span className="text-slate-400 text-sm">
          {format(new Date(log.createdAt), 'dd.MM.yyyy HH:mm:ss', { locale: de })}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header mit Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-600/20 via-slate-800 to-gray-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gray-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-500/20 rounded-2xl backdrop-blur-sm border border-slate-500/30 shadow-lg shadow-slate-500/20">
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Audit-Logs</h1>
              <p className="text-slate-400 mt-0.5">Alle Systemaktivitäten protokolliert</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Aktion suchen..."
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className="input w-auto"
          >
            <option value="">Alle Bereiche</option>
            <option value="auth">Auth</option>
            <option value="users">Users</option>
            <option value="employees">Employees</option>
            <option value="hr">HR</option>
            <option value="ia">IA</option>
            <option value="academy">Academy</option>
            <option value="qa">QA</option>
            <option value="finance">Finance</option>
            <option value="admin">Admin</option>
          </select>
          <button className="btn-ghost">
            <Filter className="h-4 w-4" />
            Mehr Filter
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="card p-4 bg-slate-800/50">
        <p className="text-sm text-slate-400">
          Alle Änderungen im System werden automatisch protokolliert. Die Logs werden
          für 90 Tage aufbewahrt.
        </p>
      </div>

      {/* Tabelle */}
      <Table
        columns={columns}
        data={response?.data || []}
        keyExtractor={(l) => l.id}
        isLoading={isLoading}
        emptyMessage="Keine Audit-Logs gefunden"
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
