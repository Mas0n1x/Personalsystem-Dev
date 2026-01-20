import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
import { JwtPayload } from '../types/index.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  isExternalApi?: boolean;
  externalApiName?: string;
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
      // Option 1: Externe API mit API-Key
      const apiKey = socket.handshake.auth.apiKey || socket.handshake.query.api_key;
      if (apiKey) {
        const apiKeySetting = await prisma.systemSetting.findUnique({
          where: { key: 'leitstelleExternalApiKey' },
        });

        if (apiKeySetting?.value && apiKey === apiKeySetting.value) {
          socket.isExternalApi = true;
          socket.externalApiName = 'leitstelle-external';
          socket.userId = 'external-api-leitstelle';
          console.log('[Socket] External API connected: leitstelle-external');
          return next();
        } else {
          console.error('[Socket] Invalid external API key');
          return next(new Error('Ungueltiger API-Key'));
        }
      }

      // Option 2: Token aus auth oder Cookie extrahieren (normale User)
      let token = socket.handshake.auth.token;

      if (!token && socket.handshake.headers.cookie) {
        const cookies = socket.handshake.headers.cookie.split(';');
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if (name === 'token') {
            token = value;
            break;
          }
        }
      }

      if (!token) {
        console.error('Socket: No token found');
        console.error('Socket cookies:', socket.handshake.headers.cookie);
        console.error('Socket auth:', socket.handshake.auth);
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
    // Externe API Verbindung
    if (socket.isExternalApi) {
      console.log(`[Socket] External API connected: ${socket.externalApiName}`);

      // Automatisch dem Leitstelle-Raum beitreten
      if (socket.externalApiName === 'leitstelle-external') {
        socket.join('leitstelle-external');
        console.log(`[Socket] External API joined room: leitstelle-external`);

        // Bestaetigung senden
        socket.emit('connected', {
          status: 'ok',
          room: 'leitstelle-external',
          events: [
            'leitstelle:event - Alle Mitarbeiter-Events (hired, terminated, promoted, demoted, unit_joined, unit_left)',
          ],
        });
      }

      socket.on('disconnect', () => {
        console.log(`[Socket] External API disconnected: ${socket.externalApiName}`);
      });

      return; // Keine weiteren Handler fuer externe APIs
    }

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

// =====================================================
// LEITSTELLE EXTERNAL API - Live Events
// =====================================================

export interface LeitstelleEmployeeData {
  id: string;
  badgeNumber: string | null;
  name: string;
  discordId: string;
  rank: string;
  rankLevel: number;
  units: string[];
  status: string;
}

// Event-Typen fuer Leitstelle
export type LeitstelleEventType =
  | 'employee:hired'      // Einstellung
  | 'employee:terminated' // Kuendigung
  | 'employee:promoted'   // Uprank
  | 'employee:demoted'    // Downrank
  | 'employee:unit_joined'  // Unit Eintritt
  | 'employee:unit_left';   // Unit Austritt

export interface LeitstelleEvent {
  type: LeitstelleEventType;
  employee: LeitstelleEmployeeData;
  details?: {
    previousRank?: string;
    newRank?: string;
    previousRankLevel?: number;
    newRankLevel?: number;
    unit?: string;
    reason?: string;
  };
  timestamp: string;
}

// Broadcast an Leitstelle-Raum
export function broadcastLeitstelleEvent(event: LeitstelleEvent): void {
  emitToRoom('leitstelle-external', 'leitstelle:event', event);
  console.log(`[Leitstelle API] Event: ${event.type} - ${event.employee.name}`);
}

// Einzelne Event-Helper
export function emitEmployeeHired(employee: LeitstelleEmployeeData): void {
  broadcastLeitstelleEvent({
    type: 'employee:hired',
    employee,
    timestamp: new Date().toISOString(),
  });
}

export function emitEmployeeTerminated(employee: LeitstelleEmployeeData, reason?: string): void {
  broadcastLeitstelleEvent({
    type: 'employee:terminated',
    employee,
    details: { reason },
    timestamp: new Date().toISOString(),
  });
}

export function emitEmployeePromoted(
  employee: LeitstelleEmployeeData,
  previousRank: string,
  previousRankLevel: number
): void {
  broadcastLeitstelleEvent({
    type: 'employee:promoted',
    employee,
    details: {
      previousRank,
      newRank: employee.rank,
      previousRankLevel,
      newRankLevel: employee.rankLevel,
    },
    timestamp: new Date().toISOString(),
  });
}

export function emitEmployeeDemoted(
  employee: LeitstelleEmployeeData,
  previousRank: string,
  previousRankLevel: number
): void {
  broadcastLeitstelleEvent({
    type: 'employee:demoted',
    employee,
    details: {
      previousRank,
      newRank: employee.rank,
      previousRankLevel,
      newRankLevel: employee.rankLevel,
    },
    timestamp: new Date().toISOString(),
  });
}

export function emitEmployeeUnitJoined(employee: LeitstelleEmployeeData, unit: string): void {
  broadcastLeitstelleEvent({
    type: 'employee:unit_joined',
    employee,
    details: { unit },
    timestamp: new Date().toISOString(),
  });
}

export function emitEmployeeUnitLeft(employee: LeitstelleEmployeeData, unit: string): void {
  broadcastLeitstelleEvent({
    type: 'employee:unit_left',
    employee,
    details: { unit },
    timestamp: new Date().toISOString(),
  });
}
