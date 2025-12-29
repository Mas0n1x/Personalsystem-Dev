import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const newSocket = io({
      withCredentials: true,
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
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

    newSocket.on('user:offline', ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => prev.filter((u) => u.id !== userId));
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
      newSocket.disconnect();
    };
  }, [user]);

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
