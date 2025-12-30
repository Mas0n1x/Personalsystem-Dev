import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';

const router = Router();

// Hilfsfunktion: Prüfen ob Dienstfrei diese Woche schon genutzt wurde
async function hasUsedDayOffThisWeek(employeeId: string): Promise<boolean> {
  // Berechne Sonntag 23:59 der aktuellen Woche
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sonntag

  // Finde den Start der Woche (Montag 00:00)
  const startOfWeek = new Date(now);
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(now.getDate() - daysToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  // Prüfe ob es ein DAY_OFF in dieser Woche gibt
  const existingDayOff = await prisma.absence.findFirst({
    where: {
      employeeId,
      type: 'DAY_OFF',
      createdAt: {
        gte: startOfWeek,
      },
    },
  });

  return !!existingDayOff;
}

// Alle aktiven Abmeldungen abrufen (für Dashboard)
router.get('/active', authMiddleware, requirePermission('employees.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();

    const absences = await prisma.absence.findMany({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: {
        employee: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { endDate: 'asc' },
    });

    res.json(absences);
  } catch (error) {
    console.error('Get active absences error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der aktiven Abmeldungen' });
  }
});

// Alle Abmeldungen abrufen (mit Pagination und Filter)
router.get('/', authMiddleware, requirePermission('employees.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { type, employeeId, active, page = '1', limit = '20' } = req.query;
    const now = new Date();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (type) {
      where.type = type as string;
    }

    if (employeeId) {
      where.employeeId = employeeId as string;
    }

    // Nur aktive Abmeldungen (laufend)
    if (active === 'true') {
      where.startDate = { lte: now };
      where.endDate = { gte: now };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [absences, total] = await Promise.all([
      prisma.absence.findMany({
        where,
        include: {
          employee: {
            include: {
              user: true,
            },
          },
        },
        skip,
        take: parseInt(limit as string),
        orderBy: { startDate: 'desc' },
      }),
      prisma.absence.count({ where }),
    ]);

    res.json({
      data: absences,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get absences error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Abmeldungen' });
  }
});

// Abmeldungen eines Mitarbeiters abrufen
router.get('/employee/:employeeId', authMiddleware, requirePermission('employees.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.params;
    const { limit = '10' } = req.query;

    const absences = await prisma.absence.findMany({
      where: { employeeId },
      orderBy: { startDate: 'desc' },
      take: parseInt(limit as string),
    });

    // Prüfen ob Dienstfrei diese Woche verfügbar ist
    const dayOffUsedThisWeek = await hasUsedDayOffThisWeek(employeeId);

    res.json({
      absences,
      dayOffUsedThisWeek,
    });
  } catch (error) {
    console.error('Get employee absences error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Abmeldungen' });
  }
});

// Neue Abmeldung erstellen
router.post('/', authMiddleware, requirePermission('employees.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { type, reason, startDate, endDate } = req.body;

    // Hole den eingeloggten User und dessen Employee-Eintrag
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { employee: true },
    });

    if (!user?.employee) {
      res.status(400).json({ error: 'Du bist kein Mitarbeiter' });
      return;
    }

    const employeeId = user.employee.id;

    // Bei Dienstfrei: Prüfen ob diese Woche schon genutzt
    if (type === 'DAY_OFF') {
      const alreadyUsed = await hasUsedDayOffThisWeek(employeeId);
      if (alreadyUsed) {
        res.status(400).json({ error: 'Dienstfrei wurde diese Woche bereits genutzt. Neues Dienstfrei ab Montag möglich.' });
        return;
      }
    }

    // Start auf 00:00:00 und Ende auf 23:59:59 setzen
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const absence = await prisma.absence.create({
      data: {
        employeeId,
        type,
        reason,
        startDate: start,
        endDate: end,
      },
      include: {
        employee: {
          include: {
            user: true,
          },
        },
      },
    });

    res.status(201).json(absence);
  } catch (error) {
    console.error('Create absence error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Abmeldung' });
  }
});

// Abmeldung löschen (nur eigene oder mit edit Berechtigung)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const absence = await prisma.absence.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!absence) {
      res.status(404).json({ error: 'Abmeldung nicht gefunden' });
      return;
    }

    // Prüfen ob eigene Abmeldung oder Admin
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { employee: true, role: { include: { permissions: true } } },
    });

    const isOwnAbsence = user?.employee?.id === absence.employeeId;
    const hasEditPermission = user?.role?.permissions.some(p => p.name === 'employees.edit' || p.name === 'admin.full');

    if (!isOwnAbsence && !hasEditPermission) {
      res.status(403).json({ error: 'Keine Berechtigung zum Löschen dieser Abmeldung' });
      return;
    }

    await prisma.absence.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete absence error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Abmeldung' });
  }
});

export default router;
