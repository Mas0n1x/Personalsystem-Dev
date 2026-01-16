import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import type { User } from '../types';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Partial<User>[];
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Partial<User>[]>([]);

  // Ref um die User-ID zu tracken und unnötige Reconnects zu vermeiden
  const userIdRef = useRef<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const userId = user?.id || null;

    // Nur reconnecten wenn sich die User-ID wirklich geändert hat
    if (userId === userIdRef.current && socketRef.current?.connected) {
      return;
    }

    // Wenn User sich ausloggt
    if (!userId) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      userIdRef.current = null;
      return;
    }

    // Wenn bereits eine Verbindung mit demselben User besteht
    if (socketRef.current?.connected && userId === userIdRef.current) {
      return;
    }

    // Alte Verbindung trennen falls vorhanden
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    userIdRef.current = userId;

    const newSocket = io({
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      // Nicht automatisch reconnecten wenn absichtlich getrennt
      if (reason === 'io client disconnect') {
        return;
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Online Users
    newSocket.on('users:online', (users: Partial<User>[]) => {
      setOnlineUsers(users);
    });

    newSocket.on('user:online', ({ user: onlineUser }: { user: Partial<User> }) => {
      setOnlineUsers((prev) => {
        if (prev.find((u) => u.id === onlineUser.id)) return prev;
        return [...prev, onlineUser];
      });
    });

    newSocket.on('user:offline', ({ userId: offlineUserId }: { userId: string }) => {
      setOnlineUsers((prev) => prev.filter((u) => u.id !== offlineUserId));
    });

    // Benachrichtigungen
    newSocket.on('notification', (notification: { title: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }) => {
      switch (notification.type) {
        case 'success':
          toast.success(notification.message);
          break;
        case 'error':
          toast.error(notification.message);
          break;
        default:
          toast(notification.message);
      }
    });

    setSocket(newSocket);

    return () => {
      // Cleanup nur wenn Komponente wirklich unmountet wird
      // (nicht bei React StrictMode double-render)
    };
  }, [user?.id]); // Nur auf user.id reagieren, nicht auf das gesamte user-Objekt

  // Cleanup bei echtem Unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
