import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { getGuildInfo, getAllMembersWithRoles } from '../services/discordBot.js';
import { io } from '../index.js';

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

// ==================== LEADERSHIP FEATURES ====================

// Verfügbare Discord-Rollen für Ankündigungen abrufen
router.get('/discord-roles', authMiddleware, requirePermission('leadership.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const guildInfo = await getGuildInfo();

    if (!guildInfo) {
      res.status(503).json({ error: 'Discord nicht verbunden' });
      return;
    }

    // Filtere relevante Rollen (beginnen mit "»" oder enthalten wichtige Keywords)
    const relevantRoles = guildInfo.roles.filter(r =>
      r.name.startsWith('»') ||
      r.name.toLowerCase().includes('team') ||
      r.name.toLowerCase().includes('management') ||
      r.name.toLowerCase().includes('leadership')
    );

    // Sortiere nach Namen
    relevantRoles.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      serverName: guildInfo.name,
      roles: relevantRoles,
    });
  } catch (error) {
    console.error('Error fetching Discord roles:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Discord-Rollen' });
  }
});

// Broadcast-Benachrichtigung an Benutzer mit bestimmten Discord-Rollen senden
router.post('/broadcast', authMiddleware, requirePermission('leadership.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, message, roleIds, type = 'INFO' } = req.body;

    if (!title?.trim() || !message?.trim()) {
      res.status(400).json({ error: 'Titel und Nachricht sind erforderlich' });
      return;
    }

    if (!roleIds || !Array.isArray(roleIds) || roleIds.length === 0) {
      res.status(400).json({ error: 'Mindestens eine Rolle muss ausgewählt werden' });
      return;
    }

    // Hole alle Member mit ihren Rollen
    const allMemberRoles = await getAllMembersWithRoles();

    // Finde alle Discord-IDs die mindestens eine der ausgewählten Rollen haben
    const targetDiscordIds: string[] = [];

    for (const [discordId, memberRoles] of allMemberRoles) {
      const hasRole = memberRoles.some(r => roleIds.includes(r.id));
      if (hasRole) {
        targetDiscordIds.push(discordId);
      }
    }

    if (targetDiscordIds.length === 0) {
      res.status(400).json({ error: 'Keine Benutzer mit den ausgewählten Rollen gefunden' });
      return;
    }

    // Finde alle User mit diesen Discord-IDs
    const users = await prisma.user.findMany({
      where: {
        discordId: { in: targetDiscordIds },
        isActive: true,
      },
      select: { id: true },
    });

    if (users.length === 0) {
      res.status(400).json({ error: 'Keine registrierten Benutzer mit den ausgewählten Rollen gefunden' });
      return;
    }

    // Erstelle Benachrichtigungen für alle Benutzer
    const notifications = await prisma.notification.createMany({
      data: users.map(user => ({
        userId: user.id,
        title: title.trim(),
        message: message.trim(),
        type: type,
      })),
    });

    // Sende Echtzeit-Benachrichtigung via Socket.io
    for (const user of users) {
      io.to(`user:${user.id}`).emit('notification', {
        title: title.trim(),
        message: message.trim(),
        type: type,
      });
    }

    res.json({
      success: true,
      recipientCount: notifications.count,
      message: `Benachrichtigung an ${notifications.count} Benutzer gesendet`,
    });
  } catch (error) {
    console.error('Error broadcasting notification:', error);
    res.status(500).json({ error: 'Fehler beim Senden der Benachrichtigungen' });
  }
});

// Broadcast an alle aktiven Benutzer senden
router.post('/broadcast-all', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, message, type = 'INFO' } = req.body;

    if (!title?.trim() || !message?.trim()) {
      res.status(400).json({ error: 'Titel und Nachricht sind erforderlich' });
      return;
    }

    // Finde alle aktiven User
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    if (users.length === 0) {
      res.status(400).json({ error: 'Keine aktiven Benutzer gefunden' });
      return;
    }

    // Erstelle Benachrichtigungen für alle Benutzer
    const notifications = await prisma.notification.createMany({
      data: users.map(user => ({
        userId: user.id,
        title: title.trim(),
        message: message.trim(),
        type: type,
      })),
    });

    // Sende Echtzeit-Benachrichtigung via Socket.io
    io.emit('notification', {
      title: title.trim(),
      message: message.trim(),
      type: type,
    });

    res.json({
      success: true,
      recipientCount: notifications.count,
      message: `Benachrichtigung an ${notifications.count} Benutzer gesendet`,
    });
  } catch (error) {
    console.error('Error broadcasting notification to all:', error);
    res.status(500).json({ error: 'Fehler beim Senden der Benachrichtigungen' });
  }
});

export default router;
