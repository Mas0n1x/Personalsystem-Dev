import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

// GET alle Leadership Todo-Listen
router.get('/', requirePermission('leadership.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const todos = await prisma.leadershipTodo.findMany({
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatar: true,
          },
        },
        lastEditedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(todos);
  } catch (error) {
    console.error('Get leadership todos error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Todo-Listen' });
  }
});

// GET eigene Todo-Liste
router.get('/my', requirePermission('leadership.view'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    let todo = await prisma.leadershipTodo.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatar: true,
          },
        },
        lastEditedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    // Falls noch keine Liste existiert, erstelle eine leere
    if (!todo) {
      todo = await prisma.leadershipTodo.create({
        data: {
          userId,
          content: '',
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              username: true,
              avatar: true,
            },
          },
          lastEditedBy: {
            select: {
              displayName: true,
              username: true,
            },
          },
        },
      });
    }

    res.json(todo);
  } catch (error) {
    console.error('Get my leadership todo error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Todo-Liste' });
  }
});

// GET Todo-Liste eines bestimmten Users
router.get('/user/:userId', requirePermission('leadership.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const todo = await prisma.leadershipTodo.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatar: true,
          },
        },
        lastEditedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    if (!todo) {
      res.status(404).json({ error: 'Todo-Liste nicht gefunden' });
      return;
    }

    res.json(todo);
  } catch (error) {
    console.error('Get user leadership todo error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Todo-Liste' });
  }
});

// PUT Todo-Liste aktualisieren (kann auch fremde Listen bearbeiten)
router.put('/:userId', requirePermission('leadership.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { content } = req.body;
    const editorId = req.user!.id;

    // Prüfe ob die Liste existiert
    let todo = await prisma.leadershipTodo.findUnique({
      where: { userId },
    });

    if (!todo) {
      // Erstelle eine neue Liste für den User
      todo = await prisma.leadershipTodo.create({
        data: {
          userId,
          content: content || '',
          lastEditedById: editorId,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              username: true,
              avatar: true,
            },
          },
          lastEditedBy: {
            select: {
              displayName: true,
              username: true,
            },
          },
        },
      });
    } else {
      // Aktualisiere die bestehende Liste
      todo = await prisma.leadershipTodo.update({
        where: { userId },
        data: {
          content,
          lastEditedById: editorId,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              username: true,
              avatar: true,
            },
          },
          lastEditedBy: {
            select: {
              displayName: true,
              username: true,
            },
          },
        },
      });
    }

    res.json(todo);
  } catch (error) {
    console.error('Update leadership todo error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Todo-Liste' });
  }
});

// GET alle Leadership-User (für die Übersicht, wer Listen haben kann)
router.get('/users', requirePermission('leadership.view'), async (_req: AuthRequest, res: Response) => {
  try {
    // Hole nur User mit der "Leadership" Rolle
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        roles: {
          some: {
            name: 'Leadership',
          },
        },
      },
      select: {
        id: true,
        discordId: true,
        displayName: true,
        username: true,
        avatar: true,
        leadershipTodo: {
          select: {
            id: true,
            content: true,
            updatedAt: true,
            lastEditedBy: {
              select: {
                displayName: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: { displayName: 'asc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Get leadership users error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der User' });
  }
});

export default router;
