import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/Badge';
import { Plus, Send, Trash2, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';
import type { Announcement, PaginatedResponse } from '../../types';

export default function Announcements() {
  const queryClient = useQueryClient();
  const { canPublishAnnouncements } = usePermissions();
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', page],
    queryFn: () =>
      adminApi.getAnnouncements({
        page: String(page),
        limit: '20',
      }),
  });

  const response = data?.data as PaginatedResponse<Announcement> | undefined;

  const createMutation = useMutation({
    mutationFn: adminApi.createAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setShowCreateModal(false);
      toast.success('Ankündigung erstellt');
    },
  });

  const publishMutation = useMutation({
    mutationFn: adminApi.publishAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Ankündigung veröffentlicht');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Ankündigung gelöscht');
    },
  });

  const columns = [
    {
      key: 'title',
      header: 'Titel',
      render: (announcement: Announcement) => (
        <div className="flex items-center gap-3">
          <Megaphone className="h-5 w-5 text-slate-400" />
          <div>
            <p className="font-medium text-white">{announcement.title}</p>
            <p className="text-sm text-slate-400 line-clamp-1">{announcement.content}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priorität',
      render: (announcement: Announcement) => <StatusBadge status={announcement.priority} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (announcement: Announcement) => (
        <span
          className={`badge ${
            announcement.publishedAt ? 'badge-success' : 'badge-warning'
          }`}
        >
          {announcement.publishedAt ? 'Veröffentlicht' : 'Entwurf'}
        </span>
      ),
    },
    {
      key: 'author',
      header: 'Autor',
      render: (announcement: Announcement) => (
        <span className="text-slate-400">
          {announcement.author?.displayName || announcement.author?.username}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Erstellt',
      render: (announcement: Announcement) => (
        <span className="text-slate-400">
          {format(new Date(announcement.createdAt), 'dd.MM.yyyy HH:mm', { locale: de })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (announcement: Announcement) => (
        <div className="flex items-center gap-2">
          {!announcement.publishedAt && canPublishAnnouncements && announcement.discordChannelId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                publishMutation.mutate(announcement.id);
              }}
              className="btn-sm btn-success"
            >
              <Send className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Ankündigung wirklich löschen?')) {
                deleteMutation.mutate(announcement.id);
              }
            }}
            className="btn-sm btn-ghost text-red-400"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ),
    },
  ];

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      priority: formData.get('priority') as string,
      discordChannelId: formData.get('discordChannelId') as string,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ankündigungen</h1>
          <p className="text-slate-400 mt-1">Discord-Ankündigungen verwalten</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          Neue Ankündigung
        </button>
      </div>

      {/* Tabelle */}
      <Table
        columns={columns}
        data={response?.data || []}
        keyExtractor={(a) => a.id}
        isLoading={isLoading}
        emptyMessage="Keine Ankündigungen gefunden"
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

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Neue Ankündigung"
        size="lg"
        footer={
          <>
            <button onClick={() => setShowCreateModal(false)} className="btn-secondary">
              Abbrechen
            </button>
            <button type="submit" form="create-form" className="btn-primary">
              Erstellen
            </button>
          </>
        }
      >
        <form id="create-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Titel *</label>
            <input name="title" className="input" required />
          </div>
          <div>
            <label className="label">Inhalt *</label>
            <textarea name="content" className="input" rows={6} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Priorität</label>
              <select name="priority" className="input" defaultValue="NORMAL">
                <option value="LOW">Niedrig</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">Hoch</option>
                <option value="URGENT">Dringend</option>
              </select>
            </div>
            <div>
              <label className="label">Discord Channel ID</label>
              <input
                name="discordChannelId"
                className="input"
                placeholder="Für Discord-Veröffentlichung"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
