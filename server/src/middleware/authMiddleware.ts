import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';
import { JwtPayload } from '../types/index.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    discordId: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    roleId: string | null;
    role?: {
      id: string;
      name: string;
      level: number;
      permissions: { name: string }[];
    } | null;
  };
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

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Benutzer nicht gefunden oder deaktiviert' });
      return;
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

    const userPermissions = req.user.role?.permissions.map(p => p.name) || [];

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

    const userRole = req.user.role?.name;

    if (!userRole || !allowedRoles.includes(userRole)) {
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

    const userLevel = req.user.role?.level || 0;

    if (userLevel < minLevel) {
      res.status(403).json({ error: 'Keine Berechtigung für diese Aktion' });
      return;
    }

    next();
  };
}
