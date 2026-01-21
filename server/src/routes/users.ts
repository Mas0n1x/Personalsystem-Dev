import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission, invalidateUserCache } from '../middleware/authMiddleware.js';

const router = Router();

// Alle Benutzer abrufen
router.get('/', authMiddleware, requirePermission('users.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { search, roleId, isActive, page = '1', limit = '20' } = req.query;

    const where: {
      isActive?: boolean;
      roles?: { some: { id: string } };
      OR?: Array<{ username?: { contains: string }; displayName?: { contains: string } }>;
    } = {};

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (roleId) {
      where.roles = { some: { id: roleId as string } };
    }

    if (search) {
      where.OR = [
        { username: { contains: search as string } },
        { displayName: { contains: search as string } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          roles: true,
          employee: true,
        },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      data: users,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Benutzer' });
  }
});

// Einzelnen Benutzer abrufen
router.get('/:id', authMiddleware, requirePermission('users.view'), async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        roles: {
          include: {
            permissions: true,
          },
        },
        employee: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Benutzer nicht gefunden' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Benutzers' });
  }
});

// Benutzer aktualisieren
router.put('/:id', authMiddleware, requirePermission('users.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const { roleIds, isActive } = req.body;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        // Setze die Rollen auf die übergebenen IDs (ersetzt alle bisherigen)
        ...(roleIds !== undefined ? {
          roles: { set: roleIds.map((id: string) => ({ id })) },
        } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: {
        roles: true,
      },
    });

    // Cache invalidieren damit neue Permissions sofort wirksam werden
    invalidateUserCache(req.params.id);

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Benutzers' });
  }
});

// Benutzer deaktivieren/löschen
router.delete('/:id', authMiddleware, requirePermission('users.delete'), async (req: AuthRequest, res: Response) => {
  try {
    // Soft delete - nur deaktivieren
    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    // Cache invalidieren
    invalidateUserCache(req.params.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Benutzers' });
  }
});

export default router;
