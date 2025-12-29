import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';
import { JwtPayload } from '../types/index.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
  };
}

const onlineUsers = new Map<string, { socketId: string; user: AuthenticatedSocket['user'] }>();

let io: Server;

export function initializeSocket(socketIo: Server): void {
  io = socketIo;

  // Authentifizierung Middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.cookie?.split('token=')[1]?.split(';')[0];

      if (!token) {
        return next(new Error('Nicht authentifiziert'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
        },
      });

      if (!user) {
        return next(new Error('Benutzer nicht gefunden'));
      }

      socket.userId = user.id;
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket auth error:', error);
      next(new Error('Authentifizierung fehlgeschlagen'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`Socket connected: ${socket.userId} (${socket.user?.username})`);

    // Benutzer als online markieren
    if (socket.userId && socket.user) {
      onlineUsers.set(socket.userId, { socketId: socket.id, user: socket.user });

      // LastLogin aktualisieren
      prisma.user.update({
        where: { id: socket.userId },
        data: { lastLogin: new Date() },
      }).catch(console.error);

      // Allen mitteilen, dass jemand online ist
      io.emit('user:online', {
        userId: socket.userId,
        user: socket.user,
      });

      // Aktuelle Online-Liste senden
      socket.emit('users:online', Array.from(onlineUsers.values()).map(u => u.user));
    }

    // Raum beitreten (für spezifische Updates)
    socket.on('join:room', (room: string) => {
      socket.join(room);
      console.log(`${socket.user?.username} joined room: ${room}`);
    });

    // Raum verlassen
    socket.on('leave:room', (room: string) => {
      socket.leave(room);
      console.log(`${socket.user?.username} left room: ${room}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.userId}`);

      if (socket.userId) {
        onlineUsers.delete(socket.userId);

        io.emit('user:offline', {
          userId: socket.userId,
        });
      }
    });
  });
}

// Hilfsfunktionen für Broadcasting

export function emitToAll(event: string, data: unknown): void {
  io?.emit(event, data);
}

export function emitToRoom(room: string, event: string, data: unknown): void {
  io?.to(room).emit(event, data);
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  const userSocket = onlineUsers.get(userId);
  if (userSocket) {
    io?.to(userSocket.socketId).emit(event, data);
  }
}

export function getOnlineUsers(): AuthenticatedSocket['user'][] {
  return Array.from(onlineUsers.values()).map(u => u.user);
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

// Broadcast für CRUD-Operationen
export function broadcastCreate(entity: string, data: unknown): void {
  emitToAll(`${entity}:created`, data);
}

export function broadcastUpdate(entity: string, data: unknown): void {
  emitToAll(`${entity}:updated`, data);
}

export function broadcastDelete(entity: string, id: string): void {
  emitToAll(`${entity}:deleted`, { id });
}

// Benachrichtigungen
export function sendNotification(
  userId: string,
  notification: { title: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }
): void {
  emitToUser(userId, 'notification', notification);
}

export function broadcastNotification(
  notification: { title: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }
): void {
  emitToAll('notification', notification);
}
