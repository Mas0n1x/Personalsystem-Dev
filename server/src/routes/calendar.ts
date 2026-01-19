import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { broadcastCreate, broadcastUpdate, broadcastDelete } from '../services/socketService.js';
import { sendCalendarReminder } from '../services/calendarService.js';

const router = Router();

// GET alle Kalender-Events (mit optionalem Datumsbereich)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!prisma) {
      console.error('Prisma client is undefined in /calendar');
      res.status(500).json({ error: 'Database not available' });
      return;
    }

    const { start, end, category } = req.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (start || end) {
      where.startDate = {};
      if (start) {
        where.startDate.gte = new Date(start as string);
      }
      if (end) {
        where.startDate.lte = new Date(end as string);
      }
    }

    if (category && category !== 'ALL') {
      where.category = category as string;
    }

    const events = await prisma.calendarEvent.findMany({
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
      orderBy: { startDate: 'asc' },
    });

    res.json(events);
  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Termine' });
  }
});

// GET nächste Termine (für Dashboard)
router.get('/upcoming', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    if (!prisma || typeof prisma.calendarEvent === 'undefined') {
      console.error('Prisma client or calendarEvent is undefined in /calendar/upcoming', { prisma: !!prisma, calendarEvent: prisma ? !!prisma.calendarEvent : 'no prisma' });
      res.status(500).json({ error: 'Database not available' });
      return;
    }

    const now = new Date();

    const events = await prisma.calendarEvent.findMany({
      where: {
        startDate: {
          gte: now,
        },
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
      orderBy: { startDate: 'asc' },
      take: 5, // Nächste 5 Termine
    });

    res.json(events);
  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der nächsten Termine' });
  }
});

// GET einzelnes Event
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const event = await prisma.calendarEvent.findUnique({
      where: { id },
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

    if (!event) {
      res.status(404).json({ error: 'Termin nicht gefunden' });
      return;
    }

    res.json(event);
  } catch (error) {
    console.error('Get calendar event error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Termins' });
  }
});

// POST neues Event erstellen
router.post('/', authMiddleware, requirePermission('calendar.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      description,
      location,
      startDate,
      endDate,
      isAllDay,
      color,
      category,
      discordRoleIds,
      notifyEmployeeIds,
      reminderMinutes,
    } = req.body;

    if (!title || !startDate) {
      res.status(400).json({ error: 'Titel und Startdatum sind erforderlich' });
      return;
    }

    const event = await prisma.calendarEvent.create({
      data: {
        title,
        description,
        location,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        isAllDay: isAllDay || false,
        color: color || '#3b82f6',
        category: category || 'GENERAL',
        discordRoleIds: discordRoleIds ? JSON.stringify(discordRoleIds) : null,
        notifyEmployeeIds: notifyEmployeeIds ? JSON.stringify(notifyEmployeeIds) : null,
        reminderMinutes: reminderMinutes || null,
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
    broadcastCreate('calendar', event);

    res.status(201).json(event);
  } catch (error) {
    console.error('Create calendar event error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Termins' });
  }
});

// PUT Event aktualisieren
router.put('/:id', authMiddleware, requirePermission('calendar.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      location,
      startDate,
      endDate,
      isAllDay,
      color,
      category,
      discordRoleIds,
      notifyEmployeeIds,
      reminderMinutes,
    } = req.body;

    const event = await prisma.calendarEvent.update({
      where: { id },
      data: {
        title,
        description,
        location,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : null,
        isAllDay,
        color,
        category,
        discordRoleIds: discordRoleIds ? JSON.stringify(discordRoleIds) : null,
        notifyEmployeeIds: notifyEmployeeIds ? JSON.stringify(notifyEmployeeIds) : null,
        reminderMinutes,
        // Reset reminderSent wenn sich Startdatum oder Erinnerungszeit ändert
        reminderSent: false,
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
    broadcastUpdate('calendar', event);

    res.json(event);
  } catch (error) {
    console.error('Update calendar event error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Termins' });
  }
});

// DELETE Event löschen
router.delete('/:id', authMiddleware, requirePermission('calendar.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.calendarEvent.delete({ where: { id } });

    // Live-Update broadcast
    broadcastDelete('calendar', id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete calendar event error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Termins' });
  }
});

// POST Erinnerung manuell senden (für Tests)
router.post('/:id/remind', authMiddleware, requirePermission('calendar.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const event = await prisma.calendarEvent.findUnique({
      where: { id },
    });

    if (!event) {
      res.status(404).json({ error: 'Termin nicht gefunden' });
      return;
    }

    if (!event.discordRoleIds) {
      res.status(400).json({ error: 'Keine Discord-Rollen für Benachrichtigung konfiguriert' });
      return;
    }

    const success = await sendCalendarReminder(event);

    if (success) {
      res.json({ success: true, message: 'Erinnerung gesendet' });
    } else {
      res.status(500).json({ error: 'Fehler beim Senden der Erinnerung' });
    }
  } catch (error) {
    console.error('Send reminder error:', error);
    res.status(500).json({ error: 'Fehler beim Senden der Erinnerung' });
  }
});

export default router;
