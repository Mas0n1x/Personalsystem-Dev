import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';

const router = Router();

// GET alle Bewerbungen
router.get('/', authMiddleware, requirePermission('hr.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;

    const where: Record<string, unknown> = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const applications = await prisma.application.findMany({
      where,
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
        processedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(applications);
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Bewerbungen' });
  }
});

// GET Statistiken
router.get('/stats', authMiddleware, requirePermission('hr.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const [pending, interview, accepted, rejected] = await Promise.all([
      prisma.application.count({ where: { status: 'PENDING' } }),
      prisma.application.count({ where: { status: 'INTERVIEW' } }),
      prisma.application.count({ where: { status: 'ACCEPTED' } }),
      prisma.application.count({ where: { status: 'REJECTED' } }),
    ]);

    res.json({
      pending,
      interview,
      accepted,
      rejected,
      total: pending + interview + accepted + rejected,
    });
  } catch (error) {
    console.error('Get application stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

// GET Blacklist-Check für Bewerbung
router.get('/check-blacklist/:discordId', authMiddleware, requirePermission('hr.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { discordId } = req.params;

    // Prüfe Blacklist
    const blacklistEntry = await prisma.blacklist.findUnique({
      where: { discordId },
    });

    if (!blacklistEntry) {
      res.json({ blacklisted: false });
      return;
    }

    // Prüfe ob abgelaufen
    if (blacklistEntry.expiresAt && new Date(blacklistEntry.expiresAt) < new Date()) {
      res.json({ blacklisted: false, expired: true });
      return;
    }

    res.json({
      blacklisted: true,
      reason: blacklistEntry.reason,
      expiresAt: blacklistEntry.expiresAt,
      username: blacklistEntry.username,
    });
  } catch (error) {
    console.error('Check blacklist error:', error);
    res.status(500).json({ error: 'Fehler beim Prüfen der Blacklist' });
  }
});

// POST neue Bewerbung erstellen
router.post('/', authMiddleware, requirePermission('hr.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { discordId, discordUsername, notes } = req.body;

    if (!discordId || !discordUsername) {
      res.status(400).json({ error: 'Discord ID und Username sind erforderlich' });
      return;
    }

    // Prüfe Blacklist automatisch
    const blacklistEntry = await prisma.blacklist.findUnique({
      where: { discordId },
    });

    if (blacklistEntry) {
      // Prüfe ob abgelaufen
      if (!blacklistEntry.expiresAt || new Date(blacklistEntry.expiresAt) > new Date()) {
        res.status(400).json({
          error: 'BLACKLISTED',
          message: `Bewerber ist auf der Blacklist: ${blacklistEntry.reason}`,
          blacklistEntry,
        });
        return;
      }
    }

    // Prüfe ob bereits eine offene Bewerbung existiert
    const existingApplication = await prisma.application.findFirst({
      where: {
        discordId,
        status: { in: ['PENDING', 'INTERVIEW'] },
      },
    });

    if (existingApplication) {
      res.status(400).json({ error: 'Es existiert bereits eine offene Bewerbung für diese Discord ID' });
      return;
    }

    const application = await prisma.application.create({
      data: {
        discordId,
        discordUsername,
        notes,
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

    res.status(201).json(application);
  } catch (error) {
    console.error('Create application error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Bewerbung' });
  }
});

// PUT Bewerbung aktualisieren (Notizen, Gesprächstermin)
router.put('/:id', authMiddleware, requirePermission('hr.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { notes, interviewDate, interviewNotes } = req.body;

    const application = await prisma.application.update({
      where: { id },
      data: {
        notes,
        interviewDate: interviewDate ? new Date(interviewDate) : undefined,
        interviewNotes,
      },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
        processedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    res.json(application);
  } catch (error) {
    console.error('Update application error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Bewerbung' });
  }
});

// PUT Status auf "Gespräch geplant" setzen
router.put('/:id/schedule-interview', authMiddleware, requirePermission('hr.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { interviewDate } = req.body;

    if (!interviewDate) {
      res.status(400).json({ error: 'Gesprächstermin ist erforderlich' });
      return;
    }

    const application = await prisma.application.update({
      where: { id },
      data: {
        status: 'INTERVIEW',
        interviewDate: new Date(interviewDate),
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

    res.json(application);
  } catch (error) {
    console.error('Schedule interview error:', error);
    res.status(500).json({ error: 'Fehler beim Planen des Gesprächs' });
  }
});

// PUT Bewerbung annehmen (erstellt automatisch Mitarbeiter)
router.put('/:id/accept', authMiddleware, requirePermission('hr.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { interviewNotes } = req.body;

    const application = await prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      res.status(404).json({ error: 'Bewerbung nicht gefunden' });
      return;
    }

    // Nochmals Blacklist prüfen
    const blacklistEntry = await prisma.blacklist.findUnique({
      where: { discordId: application.discordId },
    });

    if (blacklistEntry && (!blacklistEntry.expiresAt || new Date(blacklistEntry.expiresAt) > new Date())) {
      res.status(400).json({
        error: 'BLACKLISTED',
        message: `Bewerber ist auf der Blacklist: ${blacklistEntry.reason}`,
      });
      return;
    }

    // Prüfe ob User bereits existiert
    let user = await prisma.user.findUnique({
      where: { discordId: application.discordId },
    });

    // Erstelle User falls nicht existiert
    if (!user) {
      user = await prisma.user.create({
        data: {
          discordId: application.discordId,
          username: application.discordUsername,
          displayName: application.discordUsername,
        },
      });
    }

    // Prüfe ob bereits Mitarbeiter
    const existingEmployee = await prisma.employee.findUnique({
      where: { userId: user.id },
    });

    if (existingEmployee) {
      res.status(400).json({ error: 'Diese Person ist bereits als Mitarbeiter registriert' });
      return;
    }

    // Erstelle Mitarbeiter
    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        rank: 'Cadet',
        rankLevel: 1,
        department: 'Patrol',
        status: 'ACTIVE',
      },
    });

    // Aktualisiere Bewerbung
    const updatedApplication = await prisma.application.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        interviewNotes,
        processedById: req.user!.id,
        processedAt: new Date(),
      },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
        processedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    res.json({
      application: updatedApplication,
      employee,
      message: `${application.discordUsername} wurde als Cadet eingestellt`,
    });
  } catch (error) {
    console.error('Accept application error:', error);
    res.status(500).json({ error: 'Fehler beim Annehmen der Bewerbung' });
  }
});

// PUT Bewerbung ablehnen
router.put('/:id/reject', authMiddleware, requirePermission('hr.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rejectionReason, addToBlacklist, blacklistReason, blacklistExpires } = req.body;

    if (!rejectionReason) {
      res.status(400).json({ error: 'Ablehnungsgrund ist erforderlich' });
      return;
    }

    const application = await prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      res.status(404).json({ error: 'Bewerbung nicht gefunden' });
      return;
    }

    // Optional: Zur Blacklist hinzufügen
    if (addToBlacklist) {
      const existingBlacklist = await prisma.blacklist.findUnique({
        where: { discordId: application.discordId },
      });

      if (!existingBlacklist) {
        await prisma.blacklist.create({
          data: {
            discordId: application.discordId,
            username: application.discordUsername,
            reason: blacklistReason || rejectionReason,
            expiresAt: blacklistExpires ? new Date(blacklistExpires) : null,
            addedById: req.user!.id,
          },
        });
      }
    }

    const updatedApplication = await prisma.application.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason,
        processedById: req.user!.id,
        processedAt: new Date(),
      },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
        processedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    res.json(updatedApplication);
  } catch (error) {
    console.error('Reject application error:', error);
    res.status(500).json({ error: 'Fehler beim Ablehnen der Bewerbung' });
  }
});

// DELETE Bewerbung löschen
router.delete('/:id', authMiddleware, requirePermission('hr.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.application.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete application error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Bewerbung' });
  }
});

export default router;
