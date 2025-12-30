import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';

const router = Router();

// GET alle Notizen
router.get('/', authMiddleware, requirePermission('leadership.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { category, isPinned } = req.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (category) {
      where.category = category as string;
    }

    if (isPinned === 'true') {
      where.isPinned = true;
    }

    const notes = await prisma.note.findMany({
      where,
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: [
        { isPinned: 'desc' },
        { updatedAt: 'desc' },
      ],
    });

    res.json(notes);
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Notizen' });
  }
});

// POST neue Notiz erstellen
router.post('/', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, category } = req.body;

    if (!title || !content) {
      res.status(400).json({ error: 'Titel und Inhalt sind erforderlich' });
      return;
    }

    const note = await prisma.note.create({
      data: {
        title,
        content,
        category: category || 'GENERAL',
        createdById: req.user!.id,
      },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    res.status(201).json(note);
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Notiz' });
  }
});

// PUT Notiz anpinnen/lösen
router.put('/:id/pin', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingNote = await prisma.note.findUnique({ where: { id } });
    if (!existingNote) {
      res.status(404).json({ error: 'Notiz nicht gefunden' });
      return;
    }

    const note = await prisma.note.update({
      where: { id },
      data: { isPinned: !existingNote.isPinned },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    res.json(note);
  } catch (error) {
    console.error('Toggle pin error:', error);
    res.status(500).json({ error: 'Fehler beim Anpinnen der Notiz' });
  }
});

// PUT Notiz bearbeiten
router.put('/:id', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, category } = req.body;

    const note = await prisma.note.update({
      where: { id },
      data: {
        title,
        content,
        category,
      },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    res.json(note);
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Notiz' });
  }
});

// DELETE Notiz löschen
router.delete('/:id', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.note.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Notiz' });
  }
});

export default router;
