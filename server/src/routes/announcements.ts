import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { sendAnnouncementToChannel, getAnnouncementChannels } from '../services/discordBot.js';
import { broadcastCreate, broadcastUpdate, broadcastDelete } from '../services/socketService.js';

const router = Router();

// GET alle Ankündigungen
router.get('/', authMiddleware, requirePermission('leadership.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const announcements = await prisma.announcement.findMany({
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(announcements);
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Ankündigungen' });
  }
});

// GET verfügbare Discord-Kanäle
router.get('/channels', authMiddleware, requirePermission('leadership.manage'), async (_req: AuthRequest, res: Response) => {
  try {
    const channels = await getAnnouncementChannels();
    res.json(channels);
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Kanäle' });
  }
});

// POST neue Ankündigung erstellen (Draft)
router.post('/', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, channelId } = req.body;

    if (!title || !content) {
      res.status(400).json({ error: 'Titel und Inhalt sind erforderlich' });
      return;
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        channelId,
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

    // Live-Update broadcast
    broadcastCreate('announcement', announcement);

    res.status(201).json(announcement);
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Ankündigung' });
  }
});

// POST Ankündigung an Discord senden
router.post('/:id/send', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const announcement = await prisma.announcement.findUnique({ where: { id } });

    if (!announcement) {
      res.status(404).json({ error: 'Ankündigung nicht gefunden' });
      return;
    }

    if (announcement.status === 'SENT') {
      res.status(400).json({ error: 'Ankündigung wurde bereits gesendet' });
      return;
    }

    if (!announcement.channelId) {
      res.status(400).json({ error: 'Kein Kanal ausgewählt' });
      return;
    }

    // An Discord senden
    let messageId: string | null = null;
    try {
      messageId = await sendAnnouncementToChannel(
        announcement.channelId,
        announcement.title,
        announcement.content
      );
    } catch (discordError: any) {
      console.error('Discord send error:', discordError);

      // Spezifische Fehlermeldung für Berechtigungsfehler
      if (discordError.message && discordError.message.includes('Berechtigungen')) {
        res.status(403).json({ error: discordError.message });
        return;
      }

      // Spezifische Fehlermeldung für Discord API Fehler
      if (discordError.code === 50001) {
        res.status(403).json({ error: 'Bot hat keinen Zugriff auf den ausgewählten Channel. Bitte prüfe die Discord-Berechtigungen des Bots.' });
        return;
      }

      res.status(500).json({ error: 'Fehler beim Senden an Discord' });
      return;
    }

    // Ankündigung aktualisieren
    const updatedAnnouncement = await prisma.announcement.update({
      where: { id },
      data: {
        status: 'SENT',
        messageId,
        sentAt: new Date(),
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

    // Live-Update broadcast
    broadcastUpdate('announcement', updatedAnnouncement);

    res.json(updatedAnnouncement);
  } catch (error) {
    console.error('Send announcement error:', error);
    res.status(500).json({ error: 'Fehler beim Senden der Ankündigung' });
  }
});

// PUT Ankündigung bearbeiten
router.put('/:id', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, channelId } = req.body;

    const existingAnnouncement = await prisma.announcement.findUnique({ where: { id } });

    if (!existingAnnouncement) {
      res.status(404).json({ error: 'Ankündigung nicht gefunden' });
      return;
    }

    if (existingAnnouncement.status === 'SENT') {
      res.status(400).json({ error: 'Gesendete Ankündigungen können nicht bearbeitet werden' });
      return;
    }

    const announcement = await prisma.announcement.update({
      where: { id },
      data: {
        title,
        content,
        channelId,
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

    // Live-Update broadcast
    broadcastUpdate('announcement', announcement);

    res.json(announcement);
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Ankündigung' });
  }
});

// DELETE Ankündigung löschen
router.delete('/:id', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.announcement.delete({ where: { id } });

    // Live-Update broadcast
    broadcastDelete('announcement', id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Ankündigung' });
  }
});

// POST Direkt an Discord senden (ohne Speicherung)
router.post('/send-direct', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, channelId } = req.body;

    if (!title || !content || !channelId) {
      res.status(400).json({ error: 'Titel, Inhalt und Kanal sind erforderlich' });
      return;
    }

    // Direkt an Discord senden
    const messageId = await sendAnnouncementToChannel(channelId, title, content);

    res.json({ success: true, messageId });
  } catch (error: any) {
    console.error('Send direct announcement error:', error);

    // Spezifische Fehlermeldung für Berechtigungsfehler
    if (error.message && error.message.includes('Berechtigungen')) {
      res.status(403).json({ error: error.message });
      return;
    }

    // Spezifische Fehlermeldung für Discord API Fehler
    if (error.code === 50001) {
      res.status(403).json({ error: 'Bot hat keinen Zugriff auf den Channel. Bitte prüfe die Discord-Berechtigungen.' });
      return;
    }

    res.status(500).json({ error: 'Fehler beim Senden der Ankündigung an Discord' });
  }
});

// ==================== GEPLANTE ANKÜNDIGUNGEN ====================

// GET alle geplanten Ankündigungen
router.get('/scheduled', authMiddleware, requirePermission('leadership.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const announcements = await prisma.announcement.findMany({
      where: {
        status: { in: ['SCHEDULED', 'FAILED'] },
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
      orderBy: { scheduledAt: 'asc' },
    });

    res.json(announcements);
  } catch (error) {
    console.error('Get scheduled announcements error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der geplanten Ankündigungen' });
  }
});

// POST Ankündigung planen
router.post('/schedule', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, channelId, channelName, scheduledAt } = req.body;

    if (!title || !content || !channelId || !scheduledAt) {
      res.status(400).json({ error: 'Titel, Inhalt, Kanal und Zeitpunkt sind erforderlich' });
      return;
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      res.status(400).json({ error: 'Ungültiges Datum' });
      return;
    }

    if (scheduledDate <= new Date()) {
      res.status(400).json({ error: 'Zeitpunkt muss in der Zukunft liegen' });
      return;
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        channelId,
        channelName,
        status: 'SCHEDULED',
        scheduledAt: scheduledDate,
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

    res.status(201).json(announcement);
  } catch (error) {
    console.error('Schedule announcement error:', error);
    res.status(500).json({ error: 'Fehler beim Planen der Ankündigung' });
  }
});

// PUT Geplante Ankündigung bearbeiten
router.put('/scheduled/:id', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, channelId, channelName, scheduledAt } = req.body;

    const existingAnnouncement = await prisma.announcement.findUnique({ where: { id } });

    if (!existingAnnouncement) {
      res.status(404).json({ error: 'Ankündigung nicht gefunden' });
      return;
    }

    if (existingAnnouncement.status === 'SENT') {
      res.status(400).json({ error: 'Gesendete Ankündigungen können nicht bearbeitet werden' });
      return;
    }

    const scheduledDate = scheduledAt ? new Date(scheduledAt) : existingAnnouncement.scheduledAt;
    if (scheduledDate && scheduledDate <= new Date()) {
      res.status(400).json({ error: 'Zeitpunkt muss in der Zukunft liegen' });
      return;
    }

    const announcement = await prisma.announcement.update({
      where: { id },
      data: {
        title,
        content,
        channelId,
        channelName,
        scheduledAt: scheduledDate,
        status: 'SCHEDULED', // Falls FAILED war, wieder auf SCHEDULED setzen
        errorMessage: null,
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

    res.json(announcement);
  } catch (error) {
    console.error('Update scheduled announcement error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der geplanten Ankündigung' });
  }
});

// DELETE Geplante Ankündigung abbrechen
router.delete('/scheduled/:id', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const announcement = await prisma.announcement.findUnique({ where: { id } });

    if (!announcement) {
      res.status(404).json({ error: 'Ankündigung nicht gefunden' });
      return;
    }

    if (announcement.status === 'SENT') {
      res.status(400).json({ error: 'Gesendete Ankündigungen können nicht gelöscht werden' });
      return;
    }

    await prisma.announcement.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Cancel scheduled announcement error:', error);
    res.status(500).json({ error: 'Fehler beim Abbrechen der geplanten Ankündigung' });
  }
});

// ==================== VORLAGEN ====================

// GET alle Vorlagen
router.get('/templates', authMiddleware, requirePermission('leadership.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const templates = await prisma.announcementTemplate.findMany({
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(templates);
  } catch (error) {
    console.error('Get announcement templates error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Vorlagen' });
  }
});

// POST neue Vorlage erstellen
router.post('/templates', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, title, content, channelId, category } = req.body;

    if (!name || !title || !content) {
      res.status(400).json({ error: 'Name, Titel und Inhalt sind erforderlich' });
      return;
    }

    const template = await prisma.announcementTemplate.create({
      data: {
        name,
        title,
        content,
        channelId,
        category: category || 'GENERAL',
        createdById: req.user!.id,
      },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('Create announcement template error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Vorlage' });
  }
});

// PUT Vorlage bearbeiten
router.put('/templates/:id', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, title, content, channelId, category } = req.body;

    const existingTemplate = await prisma.announcementTemplate.findUnique({ where: { id } });

    if (!existingTemplate) {
      res.status(404).json({ error: 'Vorlage nicht gefunden' });
      return;
    }

    const template = await prisma.announcementTemplate.update({
      where: { id },
      data: {
        name,
        title,
        content,
        channelId,
        category,
      },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    res.json(template);
  } catch (error) {
    console.error('Update announcement template error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Vorlage' });
  }
});

// DELETE Vorlage löschen
router.delete('/templates/:id', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.announcementTemplate.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete announcement template error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Vorlage' });
  }
});

export default router;
