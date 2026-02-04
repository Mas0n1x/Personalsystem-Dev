import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';

const router = Router();

// Alle Routen erfordern Authentifizierung und IA/Leadership Berechtigung
router.use(authMiddleware);

// GET alle IA-Notizen für einen Mitarbeiter
router.get('/employee/:employeeId', requirePermission('ia.view', 'leadership.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.params;

    const notes = await prisma.iANote.findMany({
      where: { employeeId },
      include: {
        createdBy: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(notes);
  } catch (error) {
    console.error('Get IA notes error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der IA-Notizen' });
  }
});

// GET Anzahl der IA-Notizen für einen Mitarbeiter (für Badge)
router.get('/employee/:employeeId/count', requirePermission('ia.view', 'leadership.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.params;

    const count = await prisma.iANote.count({
      where: { employeeId },
    });

    res.json({ count });
  } catch (error) {
    console.error('Get IA notes count error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Anzahl' });
  }
});

// POST neue IA-Notiz erstellen
router.post('/', requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, content, category } = req.body;

    if (!employeeId || !content) {
      res.status(400).json({ error: 'Mitarbeiter und Inhalt sind erforderlich' });
      return;
    }

    // Prüfen ob Mitarbeiter existiert
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
      return;
    }

    const note = await prisma.iANote.create({
      data: {
        employeeId,
        content,
        category: category || 'GENERAL',
        createdById: req.user!.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    res.status(201).json(note);
  } catch (error) {
    console.error('Create IA note error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der IA-Notiz' });
  }
});

// PUT IA-Notiz bearbeiten
router.put('/:id', requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content, category } = req.body;

    const existingNote = await prisma.iANote.findUnique({ where: { id } });

    if (!existingNote) {
      res.status(404).json({ error: 'Notiz nicht gefunden' });
      return;
    }

    // Nur der Ersteller oder Admins können bearbeiten
    if (existingNote.createdById !== req.user!.id && !req.user!.allPermissions?.includes('admin.full')) {
      res.status(403).json({ error: 'Keine Berechtigung zum Bearbeiten dieser Notiz' });
      return;
    }

    const note = await prisma.iANote.update({
      where: { id },
      data: {
        content,
        category,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    res.json(note);
  } catch (error) {
    console.error('Update IA note error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der IA-Notiz' });
  }
});

// DELETE IA-Notiz löschen
router.delete('/:id', requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingNote = await prisma.iANote.findUnique({ where: { id } });

    if (!existingNote) {
      res.status(404).json({ error: 'Notiz nicht gefunden' });
      return;
    }

    // Nur der Ersteller oder Admins können löschen
    if (existingNote.createdById !== req.user!.id && !req.user!.allPermissions?.includes('admin.full')) {
      res.status(403).json({ error: 'Keine Berechtigung zum Löschen dieser Notiz' });
      return;
    }

    await prisma.iANote.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete IA note error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der IA-Notiz' });
  }
});

// GET alle Mitarbeiter mit IA-Notizen (Übersicht)
router.get('/overview', requirePermission('ia.view', 'leadership.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const employeesWithNotes = await prisma.employee.findMany({
      where: {
        iaNotes: {
          some: {},
        },
      },
      select: {
        id: true,
        badgeNumber: true,
        rank: true,
        user: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            iaNotes: true,
          },
        },
        iaNotes: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            category: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        iaNotes: {
          _count: 'desc',
        },
      },
    });

    res.json(employeesWithNotes);
  } catch (error) {
    console.error('Get IA notes overview error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Übersicht' });
  }
});

export default router;
