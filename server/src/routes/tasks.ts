import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { broadcastCreate, broadcastUpdate, broadcastDelete } from '../services/socketService.js';

const router = Router();

// Hilfsfunktion für Task-Include
const taskInclude = {
  assignees: {
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
    },
  },
  createdBy: {
    select: {
      displayName: true,
      username: true,
      avatar: true,
    },
  },
};

// GET alle Tasks (mit Filter)
router.get('/', authMiddleware, requirePermission('leadership.tasks'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, assigneeId, priority } = req.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (status) {
      where.status = status as string;
    }

    if (assigneeId) {
      where.assignees = {
        some: {
          employeeId: assigneeId as string,
        },
      };
    }

    if (priority) {
      where.priority = priority as string;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
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
router.post('/', authMiddleware, requirePermission('leadership.tasks'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, priority, assigneeIds, dueDate, dueTime } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Titel ist erforderlich' });
      return;
    }

    // Task erstellen
    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        dueTime: dueTime || null,
        createdById: req.user!.id,
        // Assignees hinzufügen wenn vorhanden
        assignees: assigneeIds && assigneeIds.length > 0 ? {
          create: assigneeIds.map((employeeId: string) => ({
            employeeId,
          })),
        } : undefined,
      },
      include: taskInclude,
    });

    // Live-Update broadcast
    broadcastCreate('task', task);

    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Aufgabe' });
  }
});

// PUT Task Status ändern (für Drag & Drop)
router.put('/:id/status', authMiddleware, requirePermission('leadership.tasks'), async (req: AuthRequest, res: Response) => {
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
      include: taskInclude,
    });

    // Live-Update broadcast
    broadcastUpdate('task', task);

    res.json(task);
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ error: 'Fehler beim Ändern des Status' });
  }
});

// PUT Task aktualisieren
router.put('/:id', authMiddleware, requirePermission('leadership.tasks'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, priority, assigneeIds, dueDate, dueTime, status } = req.body;

    // Zuerst alle bestehenden Assignees löschen
    await prisma.taskAssignee.deleteMany({
      where: { taskId: id },
    });

    // Task aktualisieren und neue Assignees hinzufügen
    const task = await prisma.task.update({
      where: { id },
      data: {
        title,
        description,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        dueTime: dueTime || null,
        status,
        // Neue Assignees hinzufügen
        assignees: assigneeIds && assigneeIds.length > 0 ? {
          create: assigneeIds.map((employeeId: string) => ({
            employeeId,
          })),
        } : undefined,
      },
      include: taskInclude,
    });

    // Live-Update broadcast
    broadcastUpdate('task', task);

    res.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Aufgabe' });
  }
});

// DELETE Task löschen
router.delete('/:id', authMiddleware, requirePermission('leadership.tasks'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.task.delete({ where: { id } });

    // Live-Update broadcast
    broadcastDelete('task', id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Aufgabe' });
  }
});

export default router;
