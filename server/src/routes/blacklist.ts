import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';

const router = Router();

// GET alle Blacklist-Einträge
router.get('/', authMiddleware, requirePermission('blacklist.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const entries = await prisma.blacklist.findMany({
      include: {
        addedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(entries);
  } catch (error) {
    console.error('Get blacklist error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Blacklist' });
  }
});

// GET Blacklist-Check (prüft ob Discord ID auf Blacklist ist)
router.get('/check/:discordId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { discordId } = req.params;

    const entry = await prisma.blacklist.findUnique({
      where: { discordId },
    });

    if (!entry) {
      res.json({ blacklisted: false });
      return;
    }

    // Prüfe ob abgelaufen
    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
      res.json({ blacklisted: false, expired: true });
      return;
    }

    res.json({
      blacklisted: true,
      reason: entry.reason,
      expiresAt: entry.expiresAt,
      username: entry.username,
    });
  } catch (error) {
    console.error('Check blacklist error:', error);
    res.status(500).json({ error: 'Fehler beim Prüfen der Blacklist' });
  }
});

// GET Statistiken
router.get('/stats', authMiddleware, requirePermission('blacklist.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();

    const [total, permanent, temporary] = await Promise.all([
      prisma.blacklist.count(),
      prisma.blacklist.count({ where: { expiresAt: null } }),
      prisma.blacklist.count({
        where: {
          expiresAt: { not: null, gt: now }
        }
      }),
    ]);

    res.json({
      total,
      permanent,
      temporary,
    });
  } catch (error) {
    console.error('Get blacklist stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

// POST neuen Blacklist-Eintrag erstellen
router.post('/', authMiddleware, requirePermission('blacklist.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { discordId, username, reason, expiresAt } = req.body;

    if (!discordId || !username || !reason) {
      res.status(400).json({ error: 'Discord ID, Username und Grund sind erforderlich' });
      return;
    }

    // Prüfe ob bereits auf Blacklist
    const existing = await prisma.blacklist.findUnique({
      where: { discordId },
    });

    if (existing) {
      res.status(400).json({ error: 'Diese Discord ID ist bereits auf der Blacklist' });
      return;
    }

    const entry = await prisma.blacklist.create({
      data: {
        discordId,
        username,
        reason,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        addedById: req.user!.id,
      },
      include: {
        addedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    res.status(201).json(entry);
  } catch (error) {
    console.error('Create blacklist entry error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Blacklist-Eintrags' });
  }
});

// PUT Blacklist-Eintrag aktualisieren
router.put('/:id', authMiddleware, requirePermission('blacklist.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, expiresAt } = req.body;

    const entry = await prisma.blacklist.update({
      where: { id },
      data: {
        reason,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        addedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    res.json(entry);
  } catch (error) {
    console.error('Update blacklist entry error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Blacklist-Eintrags' });
  }
});

// DELETE Blacklist-Eintrag löschen
router.delete('/:id', authMiddleware, requirePermission('blacklist.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.blacklist.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete blacklist entry error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Blacklist-Eintrags' });
  }
});

export default router;
