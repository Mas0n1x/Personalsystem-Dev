import express, { Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, requirePermission, AuthRequest } from '../middleware/authMiddleware.js';

const router = express.Router();

// ==================== ZIVILDIENST-TRACKING ====================

// GET aktuelle Session (falls eingestempelt)
router.get('/current', authMiddleware, requirePermission('detectives.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.query;

    if (!employeeId) {
      res.status(400).json({ error: 'employeeId ist erforderlich' });
      return;
    }

    const currentSession = await prisma.civilianServiceSession.findFirst({
      where: {
        employeeId: employeeId as string,
        endTime: null, // Noch aktiv
      },
      include: {
        employee: {
          select: {
            id: true,
            rank: true,
            user: {
              select: {
                displayName: true,
                username: true,
              },
            },
          },
        },
      },
    });

    res.json(currentSession);
  } catch (error) {
    console.error('Get current session error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der aktuellen Session' });
  }
});

// GET alle Sessions eines Detektivs
router.get('/sessions', authMiddleware, requirePermission('detectives.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, limit = '50', offset = '0' } = req.query;

    if (!employeeId) {
      res.status(400).json({ error: 'employeeId ist erforderlich' });
      return;
    }

    const sessions = await prisma.civilianServiceSession.findMany({
      where: {
        employeeId: employeeId as string,
      },
      include: {
        employee: {
          select: {
            id: true,
            rank: true,
            user: {
              select: {
                displayName: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: { startTime: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    res.json(sessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Sessions' });
  }
});

// GET Statistiken
router.get('/stats', authMiddleware, requirePermission('detectives.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.query;

    if (!employeeId) {
      res.status(400).json({ error: 'employeeId ist erforderlich' });
      return;
    }

    // Alle abgeschlossenen Sessions
    const completedSessions = await prisma.civilianServiceSession.findMany({
      where: {
        employeeId: employeeId as string,
        endTime: { not: null },
      },
      select: {
        duration: true,
        startTime: true,
      },
    });

    const totalMinutes = completedSessions.reduce((sum, session) => sum + (session.duration || 0), 0);
    const totalSessions = completedSessions.length;
    const averageMinutes = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;

    // Aktuelle Session
    const currentSession = await prisma.civilianServiceSession.findFirst({
      where: {
        employeeId: employeeId as string,
        endTime: null,
      },
    });

    res.json({
      totalMinutes,
      totalHours: Math.floor(totalMinutes / 60),
      totalSessions,
      averageMinutes,
      averageHours: Math.floor(averageMinutes / 60),
      isActive: !!currentSession,
      currentSessionStart: currentSession?.startTime || null,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

// GET Gesamt-Statistiken aller aktiven Detectives
router.get('/overview-stats', authMiddleware, requirePermission('detectives.view'), async (_req: AuthRequest, res: Response) => {
  try {
    // Alle aktiven Detectives finden
    const detectives = await prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        department: {
          contains: 'Detectives',
        },
      },
      select: {
        id: true,
        rank: true,
        badgeNumber: true,
        user: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        rankLevel: 'desc',
      },
    });

    const employeeIds = detectives.map((d) => d.id);

    // Zeitbereiche definieren
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sonntag
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Sessions für heute
    const todaySessions = await prisma.civilianServiceSession.findMany({
      where: {
        employeeId: { in: employeeIds },
        startTime: { gte: startOfToday },
        endTime: { not: null },
      },
      select: {
        duration: true,
      },
    });

    // Sessions für diese Woche
    const weekSessions = await prisma.civilianServiceSession.findMany({
      where: {
        employeeId: { in: employeeIds },
        startTime: { gte: startOfWeek },
        endTime: { not: null },
      },
      select: {
        duration: true,
      },
    });

    // Sessions für diesen Monat
    const monthSessions = await prisma.civilianServiceSession.findMany({
      where: {
        employeeId: { in: employeeIds },
        startTime: { gte: startOfMonth },
        endTime: { not: null },
      },
      select: {
        duration: true,
      },
    });

    // Aktive Sessions zählen
    const activeSessions = await prisma.civilianServiceSession.count({
      where: {
        employeeId: { in: employeeIds },
        endTime: null,
      },
    });

    const todayMinutes = todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const weekMinutes = weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const monthMinutes = monthSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    // Individuelle Detective-Statistiken berechnen
    const detectiveStats = await Promise.all(
      detectives.map(async (detective) => {
        // Alle Sessions dieses Detectives
        const allSessions = await prisma.civilianServiceSession.findMany({
          where: {
            employeeId: detective.id,
            endTime: { not: null },
          },
          select: {
            duration: true,
            startTime: true,
          },
        });

        // Aktive Session prüfen
        const activeSession = await prisma.civilianServiceSession.findFirst({
          where: {
            employeeId: detective.id,
            endTime: null,
          },
        });

        // Statistiken für verschiedene Zeiträume
        const todayStats = allSessions.filter((s) => s.startTime >= startOfToday);
        const weekStats = allSessions.filter((s) => s.startTime >= startOfWeek);
        const monthStats = allSessions.filter((s) => s.startTime >= startOfMonth);

        const todayMinutes = todayStats.reduce((sum, s) => sum + (s.duration || 0), 0);
        const weekMinutes = weekStats.reduce((sum, s) => sum + (s.duration || 0), 0);
        const monthMinutes = monthStats.reduce((sum, s) => sum + (s.duration || 0), 0);
        const totalMinutes = allSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

        return {
          employee: {
            id: detective.id,
            rank: detective.rank,
            badgeNumber: detective.badgeNumber,
            user: detective.user,
          },
          stats: {
            today: {
              totalMinutes: todayMinutes,
              totalHours: Math.floor(todayMinutes / 60),
              sessions: todayStats.length,
            },
            week: {
              totalMinutes: weekMinutes,
              totalHours: Math.floor(weekMinutes / 60),
              sessions: weekStats.length,
            },
            month: {
              totalMinutes: monthMinutes,
              totalHours: Math.floor(monthMinutes / 60),
              sessions: monthStats.length,
            },
            total: {
              totalMinutes,
              totalHours: Math.floor(totalMinutes / 60),
              sessions: allSessions.length,
            },
            isActive: !!activeSession,
            currentSessionStart: activeSession?.startTime || null,
          },
        };
      })
    );

    res.json({
      today: {
        totalMinutes: todayMinutes,
        totalHours: Math.floor(todayMinutes / 60),
        sessions: todaySessions.length,
      },
      week: {
        totalMinutes: weekMinutes,
        totalHours: Math.floor(weekMinutes / 60),
        sessions: weekSessions.length,
      },
      month: {
        totalMinutes: monthMinutes,
        totalHours: Math.floor(monthMinutes / 60),
        sessions: monthSessions.length,
      },
      activeSessions,
      totalDetectives: detectives.length,
      detectives: detectiveStats,
    });
  } catch (error) {
    console.error('Get overview stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Übersichts-Statistiken' });
  }
});

// POST Einstempeln
router.post('/clock-in', authMiddleware, requirePermission('detectives.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, notes } = req.body;

    if (!employeeId) {
      res.status(400).json({ error: 'employeeId ist erforderlich' });
      return;
    }

    // Prüfen ob bereits eingestempelt
    const existingSession = await prisma.civilianServiceSession.findFirst({
      where: {
        employeeId,
        endTime: null,
      },
    });

    if (existingSession) {
      res.status(400).json({ error: 'Bereits eingestempelt' });
      return;
    }

    const session = await prisma.civilianServiceSession.create({
      data: {
        employeeId,
        notes: notes || null,
      },
      include: {
        employee: {
          select: {
            id: true,
            rank: true,
            user: {
              select: {
                displayName: true,
                username: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json(session);
  } catch (error) {
    console.error('Clock in error:', error);
    res.status(500).json({ error: 'Fehler beim Einstempeln' });
  }
});

// POST Ausstempeln
router.post('/clock-out', authMiddleware, requirePermission('detectives.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.body;

    if (!employeeId) {
      res.status(400).json({ error: 'employeeId ist erforderlich' });
      return;
    }

    // Aktuelle Session finden
    const currentSession = await prisma.civilianServiceSession.findFirst({
      where: {
        employeeId,
        endTime: null,
      },
    });

    if (!currentSession) {
      res.status(400).json({ error: 'Keine aktive Session gefunden' });
      return;
    }

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - currentSession.startTime.getTime()) / 1000 / 60); // Minuten

    const updatedSession = await prisma.civilianServiceSession.update({
      where: { id: currentSession.id },
      data: {
        endTime,
        duration,
      },
      include: {
        employee: {
          select: {
            id: true,
            rank: true,
            user: {
              select: {
                displayName: true,
                username: true,
              },
            },
          },
        },
      },
    });

    res.json(updatedSession);
  } catch (error) {
    console.error('Clock out error:', error);
    res.status(500).json({ error: 'Fehler beim Ausstempeln' });
  }
});

// DELETE Session löschen
router.delete('/sessions/:id', authMiddleware, requirePermission('detectives.manage'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.civilianServiceSession.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Session' });
  }
});

export default router;
