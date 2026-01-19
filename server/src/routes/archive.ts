import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';

const router = Router();

// ==================== BEFÖRDERUNGSARCHIV ====================

// Alle Beförderungen abrufen
router.get('/promotions', authMiddleware, requirePermission('management.uprank'), async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '50', offset = '0' } = req.query;

    const promotions = await prisma.promotionArchive.findMany({
      include: {
        employee: {
          include: {
            user: {
              select: {
                displayName: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        promotedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
      orderBy: { promotedAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.promotionArchive.count();

    res.json({ data: promotions, total });
  } catch (error) {
    console.error('Get promotions archive error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Beförderungen' });
  }
});

// Beförderungen für einen Mitarbeiter
router.get('/promotions/employee/:employeeId', authMiddleware, requirePermission('management.uprank'), async (req: AuthRequest, res: Response) => {
  try {
    const promotions = await prisma.promotionArchive.findMany({
      where: { employeeId: req.params.employeeId },
      include: {
        promotedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
      orderBy: { promotedAt: 'desc' },
    });

    res.json(promotions);
  } catch (error) {
    console.error('Get employee promotions error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Beförderungen' });
  }
});

// ==================== KÜNDIGUNGSARCHIV ====================

// Alle Kündigungen abrufen
router.get('/terminations', authMiddleware, requirePermission('management.uprank'), async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '50', offset = '0', type } = req.query;

    const where: Record<string, unknown> = {};
    if (type && type !== 'ALL') {
      where.terminationType = type;
    }

    const terminations = await prisma.terminationArchive.findMany({
      where,
      include: {
        terminatedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
      orderBy: { terminatedAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.terminationArchive.count({ where });

    res.json({ data: terminations, total });
  } catch (error) {
    console.error('Get terminations archive error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Kündigungen' });
  }
});

// ==================== BEWERBUNGSARCHIV ====================

// Abgeschlossene/Abgelehnte Bewerbungen abrufen (aus bestehender Application-Tabelle)
router.get('/applications', authMiddleware, requirePermission('management.uprank'), async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '50', offset = '0', status } = req.query;

    const where: Record<string, unknown> = {
      status: {
        in: ['COMPLETED', 'REJECTED'],
      },
    };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    const applications = await prisma.application.findMany({
      where,
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
        processedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
      orderBy: { processedAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.application.count({ where });

    res.json({ data: applications, total });
  } catch (error) {
    console.error('Get applications archive error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Bewerbungen' });
  }
});

// ==================== STATISTIKEN ====================

router.get('/stats', authMiddleware, requirePermission('management.uprank'), async (_req: AuthRequest, res: Response) => {
  try {
    const [promotionsCount, terminationsCount, applicationsCompleted, applicationsRejected] = await Promise.all([
      prisma.promotionArchive.count(),
      prisma.terminationArchive.count(),
      prisma.application.count({ where: { status: 'COMPLETED' } }),
      prisma.application.count({ where: { status: 'REJECTED' } }),
    ]);

    // Letzte 30 Tage Statistiken
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [recentPromotions, recentTerminations, recentApplications] = await Promise.all([
      prisma.promotionArchive.count({ where: { promotedAt: { gte: thirtyDaysAgo } } }),
      prisma.terminationArchive.count({ where: { terminatedAt: { gte: thirtyDaysAgo } } }),
      prisma.application.count({
        where: {
          status: { in: ['COMPLETED', 'REJECTED'] },
          processedAt: { gte: thirtyDaysAgo },
        }
      }),
    ]);

    res.json({
      promotions: {
        total: promotionsCount,
        recent: recentPromotions,
      },
      terminations: {
        total: terminationsCount,
        recent: recentTerminations,
      },
      applications: {
        completed: applicationsCompleted,
        rejected: applicationsRejected,
        recent: recentApplications,
      },
    });
  } catch (error) {
    console.error('Get archive stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

export default router;
