import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';

const router = Router();

// Dashboard Statistiken (erweitert)
router.get('/stats', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Montag
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalEmployees,
      activeEmployees,
      onLeaveEmployees,
      suspendedEmployees,
      terminatedThisMonth,
      newHiresThisMonth,
      newHiresLastMonth,
      promotionsThisWeek,
      promotionsThisMonth,
      activeAbsences,
      pendingApplications,
      pendingUprankRequests,
      pendingUnitReviews,
      totalUnits,
      activeUnitsCount,
      recentActivity,
      teamDistribution,
      rankDistribution,
    ] = await Promise.all([
      // Gesamt Mitarbeiter
      prisma.employee.count(),

      // Aktive Mitarbeiter
      prisma.employee.count({ where: { status: 'ACTIVE' } }),

      // Mitarbeiter im Urlaub
      prisma.employee.count({ where: { status: 'ON_LEAVE' } }),

      // Suspendierte Mitarbeiter
      prisma.employee.count({ where: { status: 'SUSPENDED' } }),

      // Kündigungen diesen Monat
      prisma.employee.count({
        where: {
          status: 'TERMINATED',
          updatedAt: { gte: startOfMonth },
        },
      }),

      // Neueinstellungen diesen Monat
      prisma.employee.count({
        where: {
          createdAt: { gte: startOfMonth },
        },
      }),

      // Neueinstellungen letzten Monat (für Vergleich)
      prisma.employee.count({
        where: {
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
      }),

      // Beförderungen diese Woche
      prisma.promotion.count({
        where: {
          createdAt: { gte: startOfWeek },
        },
      }),

      // Beförderungen diesen Monat
      prisma.promotion.count({
        where: {
          createdAt: { gte: startOfMonth },
        },
      }),

      // Aktive Abmeldungen
      prisma.absence.count({
        where: {
          status: 'APPROVED',
          startDate: { lte: now },
          endDate: { gte: now },
        },
      }),

      // Offene Bewerbungen
      prisma.application.count({
        where: { status: 'PENDING' },
      }),

      // Offene Uprank-Anfragen
      prisma.uprankRequest.count({
        where: { status: 'PENDING' },
      }),

      // Offene Unit-Reviews
      prisma.unitReview.count({
        where: { status: 'PENDING' },
      }),

      // Units gesamt
      prisma.unit.count(),

      // Aktive Units
      prisma.unit.count({ where: { isActive: true } }),

      // Letzte Aktivitäten (5)
      prisma.auditLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true,
            },
          },
        },
      }),

      // Team-Verteilung
      prisma.employee.groupBy({
        by: ['team'],
        where: { status: 'ACTIVE' },
        _count: true,
      }),

      // Rang-Verteilung (Top 10)
      prisma.employee.groupBy({
        by: ['rank'],
        where: { status: 'ACTIVE' },
        _count: true,
        orderBy: { _count: { rank: 'desc' } },
        take: 10,
      }),
    ]);

    // Berechne Trends
    const newHiresTrend = newHiresLastMonth > 0
      ? Math.round(((newHiresThisMonth - newHiresLastMonth) / newHiresLastMonth) * 100)
      : newHiresThisMonth > 0 ? 100 : 0;

    res.json({
      stats: {
        totalEmployees,
        activeEmployees,
        onLeaveEmployees,
        suspendedEmployees,
        terminatedThisMonth,
        newHiresThisMonth,
        newHiresTrend,
        promotionsThisWeek,
        promotionsThisMonth,
        activeAbsences,
        pendingApplications,
        pendingUprankRequests,
        pendingUnitReviews,
        totalPending: pendingApplications + pendingUprankRequests + pendingUnitReviews,
        totalUnits,
        activeUnitsCount,
      },
      recentActivity,
      teamDistribution: teamDistribution.map(t => ({
        team: t.team || 'Kein Team',
        count: t._count,
      })),
      rankDistribution: rankDistribution.map(r => ({
        rank: r.rank,
        count: r._count,
      })),
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
      include: {
        user: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    if (!employee) {
      res.json({ employee: null });
      return;
    }

    // Hole zusätzliche Infos
    const [promotionCount, lastPromotion, bonusThisWeek] = await Promise.all([
      prisma.promotion.count({ where: { employeeId: employee.id } }),
      prisma.promotion.findFirst({
        where: { employeeId: employee.id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.bonusPayment.aggregate({
        where: {
          employeeId: employee.id,
          createdAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + 1)),
          },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    res.json({
      employee: {
        ...employee,
        promotionCount,
        daysSinceLastPromotion: lastPromotion
          ? Math.floor((Date.now() - lastPromotion.createdAt.getTime()) / (1000 * 60 * 60 * 24))
          : null,
        bonusThisWeek: bonusThisWeek._sum.amount || 0,
        bonusCountThisWeek: bonusThisWeek._count,
      },
    });
  } catch (error) {
    console.error('Get my overview error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Übersicht' });
  }
});

// Schnell-Statistiken für Sidebar/Header
router.get('/quick-stats', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const [pendingApplications, pendingUprankRequests, pendingUnitReviews] = await Promise.all([
      prisma.application.count({ where: { status: 'PENDING' } }),
      prisma.uprankRequest.count({ where: { status: 'PENDING' } }),
      prisma.unitReview.count({ where: { status: 'PENDING' } }),
    ]);

    res.json({
      pendingApplications,
      pendingUprankRequests,
      pendingUnitReviews,
      totalPending: pendingApplications + pendingUprankRequests + pendingUnitReviews,
    });
  } catch (error) {
    console.error('Get quick stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Schnell-Statistiken' });
  }
});

export default router;
