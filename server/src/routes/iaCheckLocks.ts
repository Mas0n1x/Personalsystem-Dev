import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

// Hilfsfunktion: Berechnet Start der aktuellen Woche (Montag 00:00)
function getCurrentWeekStart(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  // Montag = 1, Sonntag = 0 -> Anpassung: Sonntag als 7 behandeln
  const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - adjustedDay + 1);
  weekStart.setHours(0, 0, 0, 0);

  return weekStart;
}

// GET alle aktiven Sperren für die aktuelle Woche
router.get('/current', requirePermission('ia.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const weekStart = getCurrentWeekStart();

    const locks = await prisma.iACheckLock.findMany({
      where: { weekStart },
      include: {
        employee: {
          include: {
            user: {
              select: { displayName: true, username: true },
            },
          },
        },
        checkedBy: {
          select: { displayName: true, username: true },
        },
      },
    });

    res.json(locks);
  } catch (error) {
    console.error('Get IA check locks error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Prüfungssperren' });
  }
});

// GET Sperren für einen bestimmten Mitarbeiter
router.get('/employee/:employeeId', requirePermission('ia.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.params;
    const weekStart = getCurrentWeekStart();

    const lock = await prisma.iACheckLock.findUnique({
      where: {
        employeeId_weekStart: {
          employeeId,
          weekStart,
        },
      },
      include: {
        checkedBy: {
          select: { displayName: true, username: true },
        },
      },
    });

    res.json(lock);
  } catch (error) {
    console.error('Get IA check lock error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Prüfungssperre' });
  }
});

// POST neue Prüfungssperre erstellen (beim Auswählen für eine Ermittlung)
router.post('/', requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.body;

    if (!employeeId) {
      res.status(400).json({ error: 'Mitarbeiter-ID ist erforderlich' });
      return;
    }

    const weekStart = getCurrentWeekStart();

    // Prüfen ob bereits eine Sperre existiert
    const existingLock = await prisma.iACheckLock.findUnique({
      where: {
        employeeId_weekStart: {
          employeeId,
          weekStart,
        },
      },
    });

    if (existingLock) {
      res.status(409).json({ error: 'Mitarbeiter wurde diese Woche bereits geprüft' });
      return;
    }

    const lock = await prisma.iACheckLock.create({
      data: {
        employeeId,
        weekStart,
        checkedById: req.user!.id,
      },
      include: {
        employee: {
          include: {
            user: {
              select: { displayName: true, username: true },
            },
          },
        },
        checkedBy: {
          select: { displayName: true, username: true },
        },
      },
    });

    res.status(201).json(lock);
  } catch (error) {
    console.error('Create IA check lock error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Prüfungssperre' });
  }
});

// DELETE Sperre entfernen (nur Admins)
router.delete('/:id', requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.iACheckLock.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete IA check lock error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Prüfungssperre' });
  }
});

export default router;
