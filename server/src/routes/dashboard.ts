import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';

const router = Router();

// Dashboard Statistiken (erweitert) - PERFORMANCE OPTIMIERT
router.get('/stats', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Montag
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // PERFORMANCE: Mitarbeiter-Statistiken in EINER groupBy Query statt 5 separaten counts
    const [
      employeeStatusCounts,
      newHiresCounts,
      promotionCounts,
      pendingCounts,
      unitCounts,
      recentActivity,
      teamDistribution,
      rankDistribution,
    ] = await Promise.all([
      // Alle Status-Counts in einer Query
      prisma.employee.groupBy({
        by: ['status'],
        _count: true,
      }),

      // Neueinstellungen (diesen + letzten Monat) - 2 Queries statt separater
      Promise.all([
        prisma.employee.count({ where: { createdAt: { gte: startOfMonth } } }),
        prisma.employee.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
      ]),

      // Beförderungen (Woche + Monat)
      Promise.all([
        prisma.promotionArchive.count({ where: { promotedAt: { gte: startOfWeek } } }),
        prisma.promotionArchive.count({ where: { promotedAt: { gte: startOfMonth } } }),
      ]),

      // Alle Pending-Counts zusammen
      Promise.all([
        prisma.absence.count({ where: { startDate: { lte: now }, endDate: { gte: now } } }),
        prisma.application.count({ where: { status: 'PENDING' } }),
        prisma.uprankRequest.count({ where: { status: 'PENDING' } }),
        prisma.unitReview.count({ where: { status: 'PENDING' } }),
      ]),

      // Unit-Counts
      Promise.all([
        prisma.unit.count(),
        prisma.unit.count({ where: { isActive: true } }),
      ]),

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

      // Team-Verteilung basierend auf rankLevel
      prisma.employee.groupBy({
        by: ['rankLevel'],
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

    // Status-Counts aus groupBy extrahieren
    const statusMap = new Map(employeeStatusCounts.map(s => [s.status, s._count]));
    const totalEmployees = employeeStatusCounts.reduce((sum, s) => sum + s._count, 0);
    const activeEmployees = statusMap.get('ACTIVE') || 0;
    const onLeaveEmployees = statusMap.get('ON_LEAVE') || 0;
    const suspendedEmployees = statusMap.get('SUSPENDED') || 0;

    // Kündigungen diesen Monat (separate Query nötig wegen Datumsfilter)
    const terminatedThisMonth = await prisma.employee.count({
      where: { status: 'TERMINATED', updatedAt: { gte: startOfMonth } },
    });

    const [newHiresThisMonth, newHiresLastMonth] = newHiresCounts;
    const [promotionsThisWeek, promotionsThisMonth] = promotionCounts;
    const [activeAbsences, pendingApplications, pendingUprankRequests, pendingUnitReviews] = pendingCounts;
    const [totalUnits, activeUnitsCount] = unitCounts;

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
      teamDistribution: (() => {
        // RankLevel zu Team Mapping: 1-5=Green, 6-9=Silver, 10-12=Gold, 13-15=Red, 16-17=White
        const teams: { [key: string]: number } = { Green: 0, Silver: 0, Gold: 0, Red: 0, White: 0 };
        teamDistribution.forEach(t => {
          const level = t.rankLevel || 0;
          if (level >= 16) teams.White += t._count;
          else if (level >= 13) teams.Red += t._count;
          else if (level >= 10) teams.Gold += t._count;
          else if (level >= 6) teams.Silver += t._count;
          else if (level >= 1) teams.Green += t._count;
        });
        return Object.entries(teams).map(([team, count]) => ({ team, count }));
      })(),
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
        roles: true,
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
      prisma.promotionArchive.count({ where: { employeeId: employee.id } }),
      prisma.promotionArchive.findFirst({
        where: { employeeId: employee.id },
        orderBy: { promotedAt: 'desc' },
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
          ? Math.floor((Date.now() - lastPromotion.promotedAt.getTime()) / (1000 * 60 * 60 * 24))
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
