import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';

const router = Router();

// Alle Benachrichtigungen des aktuellen Benutzers abrufen
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const unreadOnly = req.query.unreadOnly === 'true';

    if (!userId) {
      res.status(401).json({ error: 'Nicht autorisiert' });
      return;
    }

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Benachrichtigungen' });
  }
});

// Anzahl der ungelesenen Benachrichtigungen
router.get('/unread-count', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Nicht autorisiert' });
      return;
    }

    const count = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Fehler beim Laden der ungelesenen Anzahl' });
  }
});

// Eine Benachrichtigung als gelesen markieren
router.put('/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const notificationId = req.params.id;

    if (!userId) {
      res.status(401).json({ error: 'Nicht autorisiert' });
      return;
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      res.status(404).json({ error: 'Benachrichtigung nicht gefunden' });
      return;
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Fehler beim Markieren als gelesen' });
  }
});

// Alle Benachrichtigungen als gelesen markieren
router.put('/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Nicht autorisiert' });
      return;
    }

    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: 'Fehler beim Markieren als gelesen' });
  }
});

// Eine Benachrichtigung löschen
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const notificationId = req.params.id;

    if (!userId) {
      res.status(401).json({ error: 'Nicht autorisiert' });
      return;
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      res.status(404).json({ error: 'Benachrichtigung nicht gefunden' });
      return;
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Benachrichtigung' });
  }
});

// Alle Benachrichtigungen löschen
router.delete('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Nicht autorisiert' });
      return;
    }

    await prisma.notification.deleteMany({
      where: { userId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Benachrichtigungen' });
  }
});

export default router;
