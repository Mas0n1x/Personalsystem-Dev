import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadershipTodosApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import {
  ListTodo,
  User,
  Save,
  Edit2,
  Clock,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface LeadershipUser {
  id: string;
  displayName: string | null;
  username: string;
  avatar: string | null;
  leadershipTodo: {
    id: string;
    content: string;
    updatedAt: string;
    lastEditedBy: {
      displayName: string | null;
      username: string;
    } | null;
  } | null;
}

export default function LeadershipTodos() {
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Hole alle Leadership-User mit ihren Todo-Listen
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['leadership-todo-users'],
    queryFn: () => leadershipTodosApi.getUsers().then(res => res.data as LeadershipUser[]),
  });

  const users = usersData || [];

  // Mutation zum Speichern
  const saveMutation = useMutation({
    mutationFn: ({ userId, content }: { userId: string; content: string }) =>
      leadershipTodosApi.update(userId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leadership-todo-users'] });
      setIsEditing(false);
      toast.success('Todo-Liste gespeichert');
    },
    onError: () => toast.error('Fehler beim Speichern'),
  });

  const selectedUser = users.find(u => u.id === selectedUserId);

  const handleSelectUser = (user: LeadershipUser) => {
    setSelectedUserId(user.id);
    setEditContent(user.leadershipTodo?.content || '');
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    if (selectedUser) {
      setEditContent(selectedUser.leadershipTodo?.content || '');
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    if (selectedUserId) {
      saveMutation.mutate({ userId: selectedUserId, content: editContent });
    }
  };

  const handleCancel = () => {
    if (selectedUser) {
      setEditContent(selectedUser.leadershipTodo?.content || '');
    }
    setIsEditing(false);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAvatarUrl = (discordId: string, avatar: string | null) => {
    if (!avatar) return null;
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png`;
  };

  if (!permissions.hasAnyPermission('leadership.view', 'admin.full')) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-400">Keine Berechtigung für diese Seite.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600/20 via-slate-800 to-teal-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-2xl backdrop-blur-sm border border-emerald-500/30 shadow-lg shadow-emerald-500/20">
              <ListTodo className="h-8 w-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Leadership Todo-Listen</h1>
              <p className="text-slate-400 mt-0.5">Persönliche Notizen und Aufgaben der Führungsebene</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User List */}
        <div className="card">
          <div className="p-4 border-b border-slate-700">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <User className="h-4 w-4" />
              Mitglieder
            </h2>
          </div>
          {isLoading ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-6 w-6 text-slate-400 animate-spin mx-auto" />
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className={clsx(
                    'w-full p-4 flex items-center gap-3 text-left transition-colors',
                    selectedUserId === user.id
                      ? 'bg-emerald-500/10 border-l-2 border-emerald-400'
                      : 'hover:bg-slate-700/50'
                  )}
                >
                  {user.avatar ? (
                    <img
                      src={getAvatarUrl(user.id, user.avatar) || ''}
                      alt={user.displayName || user.username}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">
                      {user.displayName || user.username}
                    </p>
                    <p className="text-xs text-slate-500">
                      {user.leadershipTodo ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(user.leadershipTodo.updatedAt)}
                        </span>
                      ) : (
                        'Noch keine Liste'
                      )}
                    </p>
                  </div>
                  {user.leadershipTodo?.content && (
                    <div className="w-2 h-2 rounded-full bg-emerald-400" title="Hat Einträge" />
                  )}
                </button>
              ))}
              {users.length === 0 && (
                <p className="p-4 text-center text-slate-400">Keine Mitglieder gefunden</p>
              )}
            </div>
          )}
        </div>

        {/* Todo Content */}
        <div className="lg:col-span-2 card">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-white">
              {selectedUser ? (
                <span className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4" />
                  Todo-Liste von {selectedUser.displayName || selectedUser.username}
                </span>
              ) : (
                'Wähle ein Mitglied aus'
              )}
            </h2>
            {selectedUser && !isEditing && (
              <button
                onClick={handleStartEdit}
                className="btn-secondary flex items-center gap-2"
              >
                <Edit2 className="h-4 w-4" />
                Bearbeiten
              </button>
            )}
          </div>
          <div className="p-4">
            {!selectedUser ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <ListTodo className="h-12 w-12 mb-4 opacity-50" />
                <p>Wähle ein Mitglied aus der Liste, um dessen Todo-Liste anzuzeigen.</p>
              </div>
            ) : isEditing ? (
              <div className="space-y-4">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="input w-full h-96 font-mono text-sm"
                  placeholder="Notizen, Aufgaben, Todos..."
                  autoFocus
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-slate-500">
                    Markdown-Formatierung wird unterstützt
                  </p>
                  <div className="flex gap-2">
                    <button onClick={handleCancel} className="btn-ghost">
                      Abbrechen
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {saveMutation.isPending ? 'Speichern...' : 'Speichern'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedUser.leadershipTodo?.content ? (
                  <pre className="whitespace-pre-wrap font-mono text-sm text-slate-300 bg-slate-800/50 p-4 rounded-lg min-h-[200px]">
                    {selectedUser.leadershipTodo.content}
                  </pre>
                ) : (
                  <div className="h-48 flex flex-col items-center justify-center text-slate-400 bg-slate-800/50 rounded-lg">
                    <p>Noch keine Einträge vorhanden</p>
                    <button
                      onClick={handleStartEdit}
                      className="mt-2 text-emerald-400 hover:text-emerald-300"
                    >
                      Klicke hier um zu beginnen
                    </button>
                  </div>
                )}
                {selectedUser.leadershipTodo?.lastEditedBy && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Edit2 className="h-3 w-3" />
                    Zuletzt bearbeitet von {selectedUser.leadershipTodo.lastEditedBy.displayName || selectedUser.leadershipTodo.lastEditedBy.username}
                    {' '}am {formatDate(selectedUser.leadershipTodo.updatedAt)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
