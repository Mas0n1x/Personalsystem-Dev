import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';

const router = Router();

// Team-Sperrdauer in Wochen
const TEAM_LOCK_DURATION: Record<string, number> = {
  'Team Green': 1,
  'Team Silver': 2,
  'Team Gold': 4,
};

// Hilfsfunktion: Berechne Sperrdatum
function calculateLockDate(team: string): Date {
  const weeks = TEAM_LOCK_DURATION[team] || 0;
  const lockDate = new Date();
  lockDate.setDate(lockDate.getDate() + weeks * 7);
  return lockDate;
}

// GET alle aktiven Uprank-Sperren
router.get('/', authMiddleware, requirePermission('uprank.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const locks = await prisma.uprankLock.findMany({
      where: { isActive: true },
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
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
      orderBy: { lockedUntil: 'asc' },
    });

    res.json(locks);
  } catch (error) {
    console.error('Get uprank locks error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Uprank-Sperren' });
  }
});

// GET Uprank-Sperre für spezifischen Mitarbeiter
router.get('/employee/:employeeId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.params;
    const now = new Date();

    const activeLock = await prisma.uprankLock.findFirst({
      where: {
        employeeId,
        isActive: true,
        lockedUntil: { gt: now },
      },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
      orderBy: { lockedUntil: 'desc' },
    });

    if (!activeLock) {
      res.json({ locked: false });
      return;
    }

    res.json({
      locked: true,
      lock: activeLock,
    });
  } catch (error) {
    console.error('Get employee uprank lock error:', error);
    res.status(500).json({ error: 'Fehler beim Prüfen der Uprank-Sperre' });
  }
});

// GET Statistiken
router.get('/stats', authMiddleware, requirePermission('uprank.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();

    const [total, active, expired] = await Promise.all([
      prisma.uprankLock.count(),
      prisma.uprankLock.count({
        where: {
          isActive: true,
          lockedUntil: { gt: now },
        },
      }),
      prisma.uprankLock.count({
        where: {
          OR: [
            { isActive: false },
            { lockedUntil: { lte: now } },
          ],
        },
      }),
    ]);

    res.json({
      total,
      active,
      expired,
    });
  } catch (error) {
    console.error('Get uprank lock stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

// POST automatische Uprank-Sperre bei Teamwechsel
router.post('/auto', authMiddleware, requirePermission('uprank.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, team } = req.body;

    if (!employeeId || !team) {
      res.status(400).json({ error: 'Mitarbeiter ID und Team sind erforderlich' });
      return;
    }

    // Prüfe ob Team eine Sperre auslöst
    if (!TEAM_LOCK_DURATION[team]) {
      res.json({ created: false, message: 'Dieses Team löst keine Uprank-Sperre aus' });
      return;
    }

    // Prüfe ob Mitarbeiter existiert
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
      return;
    }

    // Deaktiviere alte Sperren
    await prisma.uprankLock.updateMany({
      where: { employeeId, isActive: true },
      data: { isActive: false },
    });

    // Erstelle neue Sperre
    const lockedUntil = calculateLockDate(team);
    const weeks = TEAM_LOCK_DURATION[team];

    const lock = await prisma.uprankLock.create({
      data: {
        employeeId,
        reason: `Teamwechsel zu ${team} (${weeks} Woche${weeks > 1 ? 'n' : ''} Sperre)`,
        team,
        lockedUntil,
        createdById: req.user!.id,
      },
      include: {
        employee: {
          include: {
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

    res.status(201).json({
      created: true,
      lock,
      message: `Uprank-Sperre bis ${lockedUntil.toLocaleDateString('de-DE')} erstellt`,
    });
  } catch (error) {
    console.error('Create auto uprank lock error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Uprank-Sperre' });
  }
});

// POST manuelle Uprank-Sperre erstellen
router.post('/', authMiddleware, requirePermission('uprank.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, reason, lockedUntil } = req.body;

    if (!employeeId || !reason || !lockedUntil) {
      res.status(400).json({ error: 'Mitarbeiter ID, Grund und Sperrdatum sind erforderlich' });
      return;
    }

    // Prüfe ob Mitarbeiter existiert
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
      return;
    }

    const lock = await prisma.uprankLock.create({
      data: {
        employeeId,
        reason,
        team: 'Manuell',
        lockedUntil: new Date(lockedUntil),
        createdById: req.user!.id,
      },
      include: {
        employee: {
          include: {
            user: {
              select: {
                displayName: true,
                username: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    res.status(201).json(lock);
  } catch (error) {
    console.error('Create uprank lock error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Uprank-Sperre' });
  }
});

// PUT Uprank-Sperre aufheben
router.put('/:id/revoke', authMiddleware, requirePermission('uprank.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const lock = await prisma.uprankLock.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ success: true, lock });
  } catch (error) {
    console.error('Revoke uprank lock error:', error);
    res.status(500).json({ error: 'Fehler beim Aufheben der Uprank-Sperre' });
  }
});

// DELETE Uprank-Sperre löschen
router.delete('/:id', authMiddleware, requirePermission('uprank.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.uprankLock.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete uprank lock error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Uprank-Sperre' });
  }
});

export default router;
