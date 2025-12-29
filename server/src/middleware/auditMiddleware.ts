import { Request, Response, NextFunction } from 'express';
import { prisma } from '../index.js';
import { AuthRequest } from './authMiddleware.js';

// Aktionen die geloggt werden sollen
const AUDIT_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Routen die nicht geloggt werden sollen
const EXCLUDED_ROUTES = [
  '/api/health',
  '/api/auth/me',
  '/api/dashboard/stats',
];

export async function auditMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Nur bestimmte Methoden loggen
  if (!AUDIT_METHODS.includes(req.method)) {
    next();
    return;
  }

  // Ausgeschlossene Routen überspringen
  if (EXCLUDED_ROUTES.some(route => req.path.startsWith(route))) {
    next();
    return;
  }

  // Original res.json überschreiben um nach Response zu loggen
  const originalJson = res.json.bind(res);

  res.json = function(body: unknown) {
    // Nach erfolgreicher Response loggen
    if (res.statusCode < 400) {
      logAuditEntry(req as AuthRequest, body).catch(console.error);
    }
    return originalJson(body);
  };

  next();
}

async function logAuditEntry(req: AuthRequest, responseBody: unknown): Promise<void> {
  try {
    const userId = req.user?.id;

    // Aktion aus Route und Methode ableiten
    const action = `${req.method} ${req.path}`;

    // Entity aus Route extrahieren (z.B. /api/users -> users)
    const pathParts = req.path.split('/').filter(Boolean);
    const entity = pathParts[1] || 'unknown';

    // Entity ID aus Route oder Body extrahieren
    const entityId = pathParts[2] || (responseBody as { id?: string })?.id;

    // Sensitive Daten aus dem Log entfernen
    const sanitizedBody = sanitizeForAudit(req.body);

    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        details: {
          method: req.method,
          path: req.path,
          body: sanitizedBody,
          query: req.query,
        },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        userId,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}

function sanitizeForAudit(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = ['password', 'token', 'secret', 'authorization'];
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeForAudit(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

// Manuelle Audit-Funktion für spezielle Fälle
export async function createAuditLog(
  action: string,
  entity: string,
  entityId?: string,
  details?: Record<string, unknown>,
  userId?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        details: details as object,
        userId,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}
