import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';

const router = Router();

// Dashboard Statistiken
router.get('/stats', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalEmployees,
      activeEmployees,
      onLeaveEmployees,
    ] = await Promise.all([
      // Gesamt Mitarbeiter
      prisma.employee.count(),

      // Aktive Mitarbeiter
      prisma.employee.count({ where: { status: 'ACTIVE' } }),

      // Mitarbeiter im Urlaub
      prisma.employee.count({ where: { status: 'ON_LEAVE' } }),
    ]);

    res.json({
      stats: {
        totalEmployees,
        activeEmployees,
        onLeaveEmployees,
      },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Dashboard-Statistiken' });
  }
});

// Aktivitäts-Feed
router.get('/activity', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '20' } = req.query;

    const activities = await prisma.auditLog.findMany({
      take: parseInt(limit as string),
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });

    res.json(activities);
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Aktivitäten' });
  }
});

// Online Benutzer (basierend auf letztem Login in den letzten 15 Minuten)
router.get('/online-users', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const onlineUsers = await prisma.user.findMany({
      where: {
        lastLogin: { gte: fifteenMinutesAgo },
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        role: true,
      },
    });

    res.json(onlineUsers);
  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Online-Benutzer' });
  }
});

// Schnellübersicht für eigene Daten
router.get('/my-overview', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const employee = await prisma.employee.findUnique({
      where: { userId },
    });

    res.json({
      employee,
    });
  } catch (error) {
    console.error('Get my overview error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Übersicht' });
  }
});

export default router;
