import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';

const router = Router();

// Dashboard Statistiken
router.get('/stats', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalEmployees,
      activeEmployees,
      onLeaveEmployees,
      pendingApplications,
      monthlyTransactions,
      upcomingTrainings,
      recentAnnouncements,
    ] = await Promise.all([
      // Gesamt Mitarbeiter
      prisma.employee.count(),

      // Aktive Mitarbeiter
      prisma.employee.count({ where: { status: 'ACTIVE' } }),

      // Mitarbeiter im Urlaub
      prisma.employee.count({ where: { status: 'ON_LEAVE' } }),

      // Ausstehende Bewerbungen
      prisma.application.count({ where: { status: 'PENDING' } }),

      // Monatliche Transaktionen
      prisma.transaction.groupBy({
        by: ['type'],
        where: { createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),

      // Anstehende Trainings
      prisma.training.count({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { gte: now },
        },
      }),

      // Neueste Ankündigungen
      prisma.announcement.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { author: true },
      }),
    ]);

    // Monatliche Einnahmen/Ausgaben berechnen
    const monthlyIncome = monthlyTransactions.find(t => t.type === 'INCOME')?._sum.amount || 0;
    const monthlyExpenses = monthlyTransactions.find(t => t.type === 'EXPENSE')?._sum.amount || 0;

    res.json({
      stats: {
        totalEmployees,
        activeEmployees,
        onLeaveEmployees,
        pendingApplications,
        upcomingTrainings,
        monthlyIncome,
        monthlyExpenses,
        balance: monthlyIncome - monthlyExpenses,
      },
      recentAnnouncements,
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

    const [employee, pendingAbsences, myEvaluations, upcomingTrainings] = await Promise.all([
      // Eigene Mitarbeiterdaten
      prisma.employee.findUnique({
        where: { userId },
      }),

      // Ausstehende Abmeldungen
      prisma.absence.findMany({
        where: { userId, status: 'PENDING' },
      }),

      // Letzte erhaltene Bewertungen
      prisma.evaluation.findMany({
        where: { employeeId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { evaluator: true },
      }),

      // Anstehende Trainings als Teilnehmer
      prisma.trainingParticipant.findMany({
        where: {
          userId,
          training: {
            status: 'SCHEDULED',
            scheduledAt: { gte: new Date() },
          },
        },
        include: { training: true },
        take: 5,
      }),
    ]);

    res.json({
      employee,
      pendingAbsences,
      myEvaluations,
      upcomingTrainings: upcomingTrainings.map(tp => tp.training),
    });
  } catch (error) {
    console.error('Get my overview error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Übersicht' });
  }
});

export default router;
