import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { checkAllStreamers } from '../services/twitchService.js';

const router = Router();

router.use(authMiddleware);

// GET alle Twitch Streamer
router.get('/', requirePermission('admin.full'), async (_req: AuthRequest, res: Response) => {
  try {
    const streamers = await prisma.twitchStreamer.findMany({
      orderBy: [
        { isLive: 'desc' },
        { displayName: 'asc' },
      ],
    });

    res.json(streamers);
  } catch (error) {
    console.error('Get Twitch streamers error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Streamer' });
  }
});

// GET einzelner Streamer
router.get('/:id', requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const streamer = await prisma.twitchStreamer.findUnique({
      where: { id },
    });

    if (!streamer) {
      res.status(404).json({ error: 'Streamer nicht gefunden' });
      return;
    }

    res.json(streamer);
  } catch (error) {
    console.error('Get Twitch streamer error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Streamers' });
  }
});

// POST neuen Streamer hinzufügen
router.post('/', requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { twitchUsername, displayName, customMessage } = req.body;

    if (!twitchUsername) {
      res.status(400).json({ error: 'Twitch-Benutzername ist erforderlich' });
      return;
    }

    // Prüfe ob Streamer bereits existiert
    const existing = await prisma.twitchStreamer.findUnique({
      where: { twitchUsername: twitchUsername.toLowerCase() },
    });

    if (existing) {
      res.status(409).json({ error: 'Dieser Streamer ist bereits eingetragen' });
      return;
    }

    const streamer = await prisma.twitchStreamer.create({
      data: {
        twitchUsername: twitchUsername.toLowerCase(),
        displayName: displayName || twitchUsername,
        customMessage,
      },
    });

    res.status(201).json(streamer);
  } catch (error) {
    console.error('Create Twitch streamer error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Streamers' });
  }
});

// PUT Streamer aktualisieren
router.put('/:id', requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { displayName, isActive, customMessage } = req.body;

    const streamer = await prisma.twitchStreamer.update({
      where: { id },
      data: {
        displayName,
        isActive,
        customMessage,
      },
    });

    res.json(streamer);
  } catch (error) {
    console.error('Update Twitch streamer error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Streamers' });
  }
});

// DELETE Streamer löschen
router.delete('/:id', requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.twitchStreamer.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete Twitch streamer error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Streamers' });
  }
});

// POST Manueller Check ALLER Streamer
router.post('/check-all', requirePermission('admin.full'), async (_req: AuthRequest, res: Response) => {
  try {
    await checkAllStreamers();
    res.json({ success: true, message: 'Alle Streamer wurden überprüft' });
  } catch (error) {
    console.error('Check all Twitch streamers error:', error);
    res.status(500).json({ error: 'Fehler beim Prüfen der Streamer' });
  }
});

// POST Manueller Check eines Streamers (für Tests)
router.post('/:id/check', requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const streamer = await prisma.twitchStreamer.findUnique({
      where: { id },
    });

    if (!streamer) {
      res.status(404).json({ error: 'Streamer nicht gefunden' });
      return;
    }

    // Hier würde normalerweise der Twitch API Call stattfinden
    // Für jetzt nur den Check-Timestamp aktualisieren
    await prisma.twitchStreamer.update({
      where: { id },
      data: {
        lastCheckedAt: new Date(),
      },
    });

    res.json({ success: true, message: 'Check durchgeführt' });
  } catch (error) {
    console.error('Check Twitch streamer error:', error);
    res.status(500).json({ error: 'Fehler beim Prüfen des Streamers' });
  }
});

export default router;
