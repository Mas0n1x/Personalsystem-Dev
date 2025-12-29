import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Bell, LogOut, User, ChevronDown, Wifi, WifiOff } from 'lucide-react';
import clsx from 'clsx';

export default function Header() {
  const { user, logout } = useAuth();
  const { isConnected, onlineUsers } = useSocket();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const onlineMenuRef = useRef<HTMLDivElement>(null);

  // Außerhalb klicken schließt Menüs
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (onlineMenuRef.current && !onlineMenuRef.current.contains(event.target as Node)) {
        setShowOnlineUsers(false);
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
        <button className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
          <Bell className="h-5 w-5" />
          {/* Badge für ungelesene Benachrichtigungen */}
          {/* <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" /> */}
        </button>

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
                {user?.role?.displayName || 'Kein Rang'}
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
                <button className="dropdown-item w-full text-left">
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
    </header>
  );
}
