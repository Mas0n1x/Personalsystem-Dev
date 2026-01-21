import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { notificationsApi } from '../../services/api';
import {
  Bell,
  LogOut,
  User,
  ChevronDown,
  Wifi,
  WifiOff,
  Check,
  CheckCheck,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Car,
  Users,
  Award,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'PROMOTION':
      return <TrendingUp className="h-5 w-5 text-green-400" />;
    case 'DEMOTION':
      return <TrendingDown className="h-5 w-5 text-red-400" />;
    case 'SANCTION':
      return <AlertTriangle className="h-5 w-5 text-orange-400" />;
    case 'BONUS':
      return <DollarSign className="h-5 w-5 text-yellow-400" />;
    case 'TUNING':
      return <Car className="h-5 w-5 text-blue-400" />;
    case 'UNIT_CHANGE':
      return <Users className="h-5 w-5 text-purple-400" />;
    case 'UNIT_PROMOTION':
      return <Award className="h-5 w-5 text-cyan-400" />;
    default:
      return <Bell className="h-5 w-5 text-slate-400" />;
  }
};

export default function Header() {
  const { user, logout } = useAuth();
  const { isConnected, onlineUsers } = useSocket();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const onlineMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Benachrichtigungen laden
  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getAll({ limit: 20 }),
    refetchInterval: 30000, // Alle 30 Sekunden aktualisieren
  });

  const { data: unreadCountData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: 15000, // Alle 15 Sekunden aktualisieren
  });

  const notifications = (notificationsData?.data || []) as Notification[];
  const unreadCount = (unreadCountData?.data?.count || 0) as number;

  // Mutation: Als gelesen markieren
  const markAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // Mutation: Alle als gelesen markieren
  const markAllAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // Mutation: Benachrichtigung löschen
  const deleteMutation = useMutation({
    mutationFn: notificationsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // Außerhalb klicken schließt Menüs
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (onlineMenuRef.current && !onlineMenuRef.current.contains(event.target as Node)) {
        setShowOnlineUsers(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6">
      {/* Left side - Breadcrumb / Title */}
      <div>
        <h2 className="text-lg font-semibold text-white">Willkommen zurück!</h2>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-4">
        {/* Connection Status */}
        <div className="flex items-center gap-2 text-sm">
          {isConnected ? (
            <span className="flex items-center gap-1.5 text-green-400">
              <Wifi className="h-4 w-4" />
              <span className="hidden sm:inline">Verbunden</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-red-400">
              <WifiOff className="h-4 w-4" />
              <span className="hidden sm:inline">Getrennt</span>
            </span>
          )}
        </div>

        {/* Online Users */}
        <div className="relative" ref={onlineMenuRef}>
          <button
            onClick={() => setShowOnlineUsers(!showOnlineUsers)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            <div className="flex -space-x-2">
              {onlineUsers.slice(0, 3).map((u) => (
                <img
                  key={u.id}
                  src={u.avatar || `https://ui-avatars.com/api/?name=${u.username}&background=random`}
                  alt={u.username}
                  className="h-6 w-6 rounded-full border-2 border-slate-700"
                />
              ))}
            </div>
            <span className="text-sm text-slate-300">
              {onlineUsers.length} Online
            </span>
          </button>

          {showOnlineUsers && (
            <div className="dropdown animate-fade-in">
              <div className="px-4 py-2 border-b border-slate-700">
                <p className="text-xs font-medium text-slate-400">Online Benutzer</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {onlineUsers.length === 0 ? (
                  <p className="px-4 py-2 text-sm text-slate-400">Keine Benutzer online</p>
                ) : (
                  onlineUsers.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-700">
                      <img
                        src={u.avatar || `https://ui-avatars.com/api/?name=${u.username}&background=random`}
                        alt={u.username}
                        className="h-8 w-8 rounded-full"
                      />
                      <div>
                        <p className="text-sm font-medium text-white">{u.displayName || u.username}</p>
                        <p className="text-xs text-slate-400">@{u.username}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={clsx(
              'relative p-2 rounded-lg transition-colors',
              showNotifications
                ? 'text-white bg-slate-700'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            )}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-96 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 animate-fade-in">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <p className="text-sm font-medium text-white">Benachrichtigungen</p>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsReadMutation.mutate()}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    <CheckCheck className="h-3 w-3" />
                    Alle gelesen
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell className="h-10 w-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Keine Benachrichtigungen</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => {
                        setSelectedNotification(notification);
                        setShowNotifications(false);
                        if (!notification.isRead) {
                          markAsReadMutation.mutate(notification.id);
                        }
                      }}
                      className={clsx(
                        'px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/50 transition-colors cursor-pointer',
                        !notification.isRead && 'bg-slate-700/30'
                      )}
                    >
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={clsx(
                            'text-sm font-medium',
                            notification.isRead ? 'text-slate-300' : 'text-white'
                          )}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {formatDistanceToNow(new Date(notification.createdAt), {
                              addSuffix: true,
                              locale: de,
                            })}
                          </p>
                        </div>
                        <div className="flex-shrink-0 flex flex-col gap-1">
                          {!notification.isRead && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsReadMutation.mutate(notification.id);
                              }}
                              className="p-1 text-slate-400 hover:text-green-400 transition-colors"
                              title="Als gelesen markieren"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMutation.mutate(notification.id);
                            }}
                            className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                            title="Löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={clsx(
              'flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors',
              showUserMenu ? 'bg-slate-700' : 'hover:bg-slate-700'
            )}
          >
            <img
              src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.username}&background=random`}
              alt={user?.username}
              className="h-8 w-8 rounded-full"
            />
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-white">
                {user?.displayName || user?.username}
              </p>
              <p className="text-xs text-slate-400">
                {user?.roles && user.roles.length > 0
                  ? user.roles.map(r => r.displayName).join(', ')
                  : 'Keine Rollen'}
              </p>
            </div>
            <ChevronDown className={clsx(
              'h-4 w-4 text-slate-400 transition-transform',
              showUserMenu && 'rotate-180'
            )} />
          </button>

          {showUserMenu && (
            <div className="dropdown animate-fade-in">
              <div className="px-4 py-3 border-b border-slate-700">
                <p className="text-sm font-medium text-white">{user?.displayName || user?.username}</p>
                <p className="text-xs text-slate-400">@{user?.username}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    if (user?.employee?.id) {
                      navigate(`/employees/${user.employee.id}`);
                      setShowUserMenu(false);
                    }
                  }}
                  disabled={!user?.employee?.id}
                  className={clsx(
                    'dropdown-item w-full text-left',
                    !user?.employee?.id && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <User className="h-4 w-4" />
                  Mein Profil
                </button>
                <button
                  onClick={logout}
                  className="dropdown-item w-full text-left text-red-400 hover:text-red-300"
                >
                  <LogOut className="h-4 w-4" />
                  Abmelden
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl w-full max-w-lg border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
              <div className="flex items-center gap-3">
                {getNotificationIcon(selectedNotification.type)}
                <h2 className="text-lg font-bold text-white">{selectedNotification.title}</h2>
              </div>
              <button
                onClick={() => setSelectedNotification(null)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-300 whitespace-pre-wrap">{selectedNotification.message}</p>
              <p className="text-xs text-slate-500 mt-4">
                {formatDistanceToNow(new Date(selectedNotification.createdAt), {
                  addSuffix: true,
                  locale: de,
                })}
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-700 flex justify-end">
              <button
                onClick={() => setSelectedNotification(null)}
                className="btn-secondary"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
