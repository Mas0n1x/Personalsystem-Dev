import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
import { JwtPayload } from '../types/index.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    discordId: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    roles?: {
      id: string;
      name: string;
      level: number;
      permissions: { name: string }[];
    }[];
    // Zusammengefasste Permissions aus allen Rollen
    allPermissions?: string[];
    // Höchstes Level aus allen Rollen
    maxLevel?: number;
  };
}

// User-Cache für schnellere Auth-Checks (30 Sekunden TTL)
interface CachedUser {
  user: AuthRequest['user'];
  timestamp: number;
}
const userCache = new Map<string, CachedUser>();
const USER_CACHE_TTL = 30 * 1000; // 30 Sekunden

function getCachedUser(userId: string): AuthRequest['user'] | null {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < USER_CACHE_TTL) {
    return cached.user;
  }
  if (cached) {
    userCache.delete(userId);
  }
  return null;
}

function setCachedUser(userId: string, user: AuthRequest['user']): void {
  userCache.set(userId, { user, timestamp: Date.now() });
}

// Cache invalidieren wenn nötig (z.B. bei Rollenänderung)
export function invalidateUserCache(userId?: string): void {
  if (userId) {
    userCache.delete(userId);
  } else {
    userCache.clear();
  }
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ error: 'Nicht autorisiert' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    // Versuche erst aus dem Cache zu laden
    let user = getCachedUser(decoded.userId);

    if (!user) {
      // Cache miss - aus DB laden
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          roles: {
            include: {
              permissions: true,
            },
          },
        },
      });

      if (!dbUser || !dbUser.isActive) {
        res.status(401).json({ error: 'Benutzer nicht gefunden oder deaktiviert' });
        return;
      }

      // Berechne zusammengefasste Permissions und maxLevel aus allen Rollen
      const allPermissions = new Set<string>();
      let maxLevel = 0;

      for (const role of dbUser.roles) {
        if (role.level > maxLevel) {
          maxLevel = role.level;
        }
        for (const perm of role.permissions) {
          allPermissions.add(perm.name);
        }
      }

      user = {
        ...dbUser,
        allPermissions: Array.from(allPermissions),
        maxLevel,
      };
      setCachedUser(decoded.userId, user);
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Ungültiger Token' });
  }
}

export function requirePermission(...requiredPermissions: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Nicht autorisiert' });
      return;
    }

    // Nutze die zusammengefassten Permissions aus allen Rollen
    const userPermissions = req.user.allPermissions || [];

    // Admin hat immer alle Rechte
    if (userPermissions.includes('admin.full')) {
      next();
      return;
    }

    const hasPermission = requiredPermissions.some(perm => userPermissions.includes(perm));

    if (!hasPermission) {
      res.status(403).json({ error: 'Keine Berechtigung für diese Aktion' });
      return;
    }

    next();
  };
}

export function requireRole(...allowedRoles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Nicht autorisiert' });
      return;
    }

    // Prüfe ob der User mindestens eine der erlaubten Rollen hat
    const userRoleNames = req.user.roles?.map(r => r.name) || [];
    const hasRole = allowedRoles.some(role => userRoleNames.includes(role));

    if (!hasRole) {
      res.status(403).json({ error: 'Keine Berechtigung für diese Aktion' });
      return;
    }

    next();
  };
}

export function requireMinLevel(minLevel: number) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Nicht autorisiert' });
      return;
    }

    // Nutze das höchste Level aus allen Rollen
    const userLevel = req.user.maxLevel || 0;

    if (userLevel < minLevel) {
      res.status(403).json({ error: 'Keine Berechtigung für diese Aktion' });
      return;
    }

    next();
  };
}
