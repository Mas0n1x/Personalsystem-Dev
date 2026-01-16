import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, adminApi } from '../../services/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { Search, Edit, UserX, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';
import type { User, Role, PaginatedResponse } from '../../types';

export default function Users() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
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
    confirmText: 'Deaktivieren',
    variant: 'danger',
    onConfirm: () => {},
  });

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search],
    queryFn: () =>
      usersApi.getAll({
        page: String(page),
        limit: '20',
        ...(search && { search }),
      }),
  });

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: adminApi.getRoles,
  });

  const response = data?.data as PaginatedResponse<User> | undefined;
  const roles = rolesData?.data as Role[] | undefined;

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedUser(null);
      toast.success('Benutzer aktualisiert');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Benutzer deaktiviert');
    },
  });

  const columns = [
    {
      key: 'user',
      header: 'Benutzer',
      render: (user: User) => (
        <div className="flex items-center gap-3">
          <img
            src={
              user.avatar ||
              `https://ui-avatars.com/api/?name=${user.username}&background=random`
            }
            alt={user.username}
            className="h-10 w-10 rounded-full"
          />
          <div>
            <p className="font-medium text-white">{user.displayName || user.username}</p>
            <p className="text-sm text-slate-400">@{user.username}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rolle',
      render: (user: User) =>
        user.role ? (
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" style={{ color: user.role.color }} />
            <span style={{ color: user.role.color }}>{user.role.displayName}</span>
          </div>
        ) : (
          <span className="text-slate-500">Keine Rolle</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (user: User) => (
        <span
          className={`badge ${user.isActive ? 'badge-success' : 'badge-danger'}`}
        >
          {user.isActive ? 'Aktiv' : 'Inaktiv'}
        </span>
      ),
    },
    {
      key: 'lastLogin',
      header: 'Letzter Login',
      render: (user: User) => (
        <span className="text-slate-400">
          {user.lastLogin
            ? format(new Date(user.lastLogin), 'dd.MM.yyyy HH:mm', { locale: de })
            : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (user: User) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedUser(user);
            }}
            className="btn-sm btn-ghost"
          >
            <Edit className="h-4 w-4" />
          </button>
          {user.isActive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDialog({
                  isOpen: true,
                  title: 'Benutzer deaktivieren',
                  message: 'Möchtest du diesen Benutzer wirklich deaktivieren?',
                  confirmText: 'Deaktivieren',
                  variant: 'danger',
                  onConfirm: () => deleteMutation.mutate(user.id),
                });
              }}
              className="btn-sm btn-ghost text-red-400"
            >
              <UserX className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedUser) return;
    const formData = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: selectedUser.id,
      data: {
        roleId: formData.get('roleId') || null,
        isActive: formData.get('isActive') === 'true',
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Benutzer</h1>
        <p className="text-slate-400 mt-1">Benutzerverwaltung</p>
      </div>

      {/* Filter */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Benutzer suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Tabelle */}
      <Table
        columns={columns}
        data={response?.data || []}
        keyExtractor={(u) => u.id}
        isLoading={isLoading}
        emptyMessage="Keine Benutzer gefunden"
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

      {/* Edit Modal */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="Benutzer bearbeiten"
        footer={
          <>
            <button onClick={() => setSelectedUser(null)} className="btn-secondary">
              Abbrechen
            </button>
            <button type="submit" form="edit-form" className="btn-primary">
              Speichern
            </button>
          </>
        }
      >
        {selectedUser && (
          <form id="edit-form" onSubmit={handleUpdate} className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-slate-700/50 rounded-lg">
              <img
                src={
                  selectedUser.avatar ||
                  `https://ui-avatars.com/api/?name=${selectedUser.username}&background=random`
                }
                alt={selectedUser.username}
                className="h-12 w-12 rounded-full"
              />
              <div>
                <p className="font-medium text-white">
                  {selectedUser.displayName || selectedUser.username}
                </p>
                <p className="text-sm text-slate-400">@{selectedUser.username}</p>
              </div>
            </div>

            <div>
              <label className="label">Rolle</label>
              <select
                name="roleId"
                className="input"
                defaultValue={selectedUser.role?.id || ''}
              >
                <option value="">Keine Rolle</option>
                {roles?.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Status</label>
              <select
                name="isActive"
                className="input"
                defaultValue={selectedUser.isActive ? 'true' : 'false'}
              >
                <option value="true">Aktiv</option>
                <option value="false">Inaktiv</option>
              </select>
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
