import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';

const router = Router();

// Alle Benutzer abrufen
router.get('/', authMiddleware, requirePermission('users.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { search, roleId, isActive, page = '1', limit = '20' } = req.query;

    const where: {
      isActive?: boolean;
      roleId?: string;
      OR?: Array<{ username?: { contains: string; mode: 'insensitive' }; displayName?: { contains: string; mode: 'insensitive' } }>;
    } = {};

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (roleId) {
      where.roleId = roleId as string;
    }

    if (search) {
      where.OR = [
        { username: { contains: search as string, mode: 'insensitive' } },
        { displayName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          role: true,
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
        role: {
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
    const { roleId, isActive } = req.body;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        roleId,
        isActive,
      },
      include: {
        role: true,
      },
    });

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

    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Benutzers' });
  }
});

export default router;
