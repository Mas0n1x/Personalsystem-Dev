import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { getGuildInfo } from '../services/discordBot.js';

const router = Router();

// Alle Announcement-Typen
const ANNOUNCEMENT_TYPES = [
  'PROMOTION',
  'DEMOTION',
  'SANCTION',
  'UNIT_CHANGE',
  'UNIT_PROMOTION',
  'ACADEMY_GRADUATION',
  'TERMINATION',
  'HIRE',
] as const;

// Beschreibungen für die Typen
const TYPE_DESCRIPTIONS: Record<string, string> = {
  PROMOTION: 'Beförderungen',
  DEMOTION: 'Degradierungen',
  SANCTION: 'Sanktionen',
  UNIT_CHANGE: 'Unit-Wechsel',
  UNIT_PROMOTION: 'Unit-Beförderungen',
  ACADEMY_GRADUATION: 'Ausbildungsabschlüsse',
  TERMINATION: 'Kündigungen',
  HIRE: 'Neueinstellungen',
};

// Alle Kanal-Konfigurationen abrufen
router.get('/', authMiddleware, requirePermission('admin.settings'), async (req: AuthRequest, res: Response) => {
  try {
    const configs = await prisma.discordAnnouncementChannel.findMany({
      orderBy: { type: 'asc' },
    });

    // Ergänze fehlende Typen mit Standardwerten
    const result = ANNOUNCEMENT_TYPES.map(type => {
      const existing = configs.find(c => c.type === type);
      return existing || {
        id: null,
        type,
        channelId: null,
        enabled: false,
        createdAt: null,
        updatedAt: null,
      };
    });

    // Füge Beschreibungen hinzu
    const resultWithDescriptions = result.map(config => ({
      ...config,
      description: TYPE_DESCRIPTIONS[config.type] || config.type,
    }));

    res.json(resultWithDescriptions);
  } catch (error) {
    console.error('Error fetching announcement configs:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Konfigurationen' });
  }
});

// Einzelne Kanal-Konfiguration aktualisieren
router.put('/:type', authMiddleware, requirePermission('admin.settings'), async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.params;
    const { channelId, enabled } = req.body;

    // Typ validieren
    if (!ANNOUNCEMENT_TYPES.includes(type as typeof ANNOUNCEMENT_TYPES[number])) {
      res.status(400).json({ error: 'Ungültiger Announcement-Typ' });
      return;
    }

    // Upsert - erstellen oder aktualisieren
    const config = await prisma.discordAnnouncementChannel.upsert({
      where: { type },
      create: {
        type,
        channelId: channelId || '',
        enabled: enabled ?? false,
      },
      update: {
        channelId: channelId || '',
        enabled: enabled ?? false,
      },
    });

    res.json({
      ...config,
      description: TYPE_DESCRIPTIONS[config.type] || config.type,
    });
  } catch (error) {
    console.error('Error updating announcement config:', error);
    res.status(500).json({ error: 'Fehler beim Speichern der Konfiguration' });
  }
});

// Alle Konfigurationen auf einmal speichern
router.put('/', authMiddleware, requirePermission('admin.settings'), async (req: AuthRequest, res: Response) => {
  try {
    const configs = req.body.configs as Array<{ type: string; channelId: string | null; enabled: boolean }>;

    if (!Array.isArray(configs)) {
      res.status(400).json({ error: 'Ungültige Daten' });
      return;
    }

    // Alle Konfigurationen in einer Transaktion speichern
    const results = await prisma.$transaction(
      configs.map(config =>
        prisma.discordAnnouncementChannel.upsert({
          where: { type: config.type },
          create: {
            type: config.type,
            channelId: config.channelId || '',
            enabled: config.enabled ?? false,
          },
          update: {
            channelId: config.channelId || '',
            enabled: config.enabled ?? false,
          },
        })
      )
    );

    res.json(results.map(config => ({
      ...config,
      description: TYPE_DESCRIPTIONS[config.type] || config.type,
    })));
  } catch (error) {
    console.error('Error saving announcement configs:', error);
    res.status(500).json({ error: 'Fehler beim Speichern der Konfigurationen' });
  }
});

// Verfügbare Discord-Kanäle abrufen
router.get('/channels', authMiddleware, requirePermission('admin.settings'), async (req: AuthRequest, res: Response) => {
  try {
    const guildInfo = await getGuildInfo();

    if (!guildInfo) {
      res.status(503).json({ error: 'Discord nicht verbunden' });
      return;
    }

    res.json({
      serverName: guildInfo.name,
      channels: guildInfo.channels,
    });
  } catch (error) {
    console.error('Error fetching Discord channels:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Discord-Kanäle' });
  }
});

export default router;
