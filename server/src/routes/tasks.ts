import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';

const router = Router();

// GET alle Tasks (mit Filter)
router.get('/', authMiddleware, requirePermission('leadership.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, assigneeId, priority } = req.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (status) {
      where.status = status as string;
    }

    if (assigneeId) {
      where.assigneeId = assigneeId as string;
    }

    if (priority) {
      where.priority = priority as string;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: {
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
            avatar: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { order: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Aufgaben' });
  }
});

// POST neuen Task erstellen
router.post('/', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, priority, assigneeId, dueDate } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Titel ist erforderlich' });
      return;
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority: priority || 'MEDIUM',
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        createdById: req.user!.id,
      },
      include: {
        assignee: {
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
            avatar: true,
          },
        },
      },
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Aufgabe' });
  }
});

// PUT Task Status ändern (für Drag & Drop)
router.put('/:id/status', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['OPEN', 'IN_PROGRESS', 'DONE'].includes(status)) {
      res.status(400).json({ error: 'Ungültiger Status' });
      return;
    }

    const task = await prisma.task.update({
      where: { id },
      data: { status },
      include: {
        assignee: {
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
            avatar: true,
          },
        },
      },
    });

    res.json(task);
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ error: 'Fehler beim Ändern des Status' });
  }
});

// PUT Task aktualisieren
router.put('/:id', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, priority, assigneeId, dueDate, status } = req.body;

    const task = await prisma.task.update({
      where: { id },
      data: {
        title,
        description,
        priority,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status,
      },
      include: {
        assignee: {
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
            avatar: true,
          },
        },
      },
    });

    res.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Aufgabe' });
  }
});

// DELETE Task löschen
router.delete('/:id', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.task.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Aufgabe' });
  }
});

export default router;
