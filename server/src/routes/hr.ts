import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { ApplicationStatus } from '@prisma/client';
import { syncUserRole } from '../services/discordBot.js';

const router = Router();

// ==================== BEWERBUNGEN ====================

// Alle Bewerbungen abrufen
router.get('/applications', authMiddleware, requirePermission('hr.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;

    const where: { status?: ApplicationStatus } = {};
    if (status) {
      where.status = status as ApplicationStatus;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          reviewer: true,
          createdBy: true,
        },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.application.count({ where }),
    ]);

    res.json({
      data: applications,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Bewerbungen' });
  }
});

// Neue Bewerbung erstellen
router.post('/applications', authMiddleware, requirePermission('hr.applications'), async (req: AuthRequest, res: Response) => {
  try {
    const { applicantName, discordId, discordName, notes } = req.body;

    const application = await prisma.application.create({
      data: {
        applicantName,
        discordId,
        discordName,
        notes,
        createdById: req.user!.id,
      },
    });

    res.status(201).json(application);
  } catch (error) {
    console.error('Create application error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Bewerbung' });
  }
});

// Bewerbung aktualisieren
router.put('/applications/:id', authMiddleware, requirePermission('hr.applications'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, notes, interviewDate, reviewerId } = req.body;

    const application = await prisma.application.update({
      where: { id: req.params.id },
      data: {
        status,
        notes,
        interviewDate: interviewDate ? new Date(interviewDate) : undefined,
        reviewerId: reviewerId || req.user!.id,
      },
      include: {
        reviewer: true,
      },
    });

    res.json(application);
  } catch (error) {
    console.error('Update application error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Bewerbung' });
  }
});

// Bewerbung annehmen und Mitarbeiter erstellen
router.post('/applications/:id/accept', authMiddleware, requirePermission('hr.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { rank, department, badgeNumber, roleId } = req.body;

    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
    });

    if (!application) {
      res.status(404).json({ error: 'Bewerbung nicht gefunden' });
      return;
    }

    if (!application.discordId) {
      res.status(400).json({ error: 'Bewerbung hat keine Discord-ID' });
      return;
    }

    // Benutzer erstellen oder finden
    let user = await prisma.user.findUnique({
      where: { discordId: application.discordId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          discordId: application.discordId,
          username: application.discordName || application.applicantName,
          roleId,
        },
      });
    } else if (roleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { roleId },
      });
    }

    // Mitarbeiter erstellen
    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        rank: rank || 'Cadet',
        department: department || 'Patrol',
        badgeNumber,
      },
    });

    // Bewerbung aktualisieren
    await prisma.application.update({
      where: { id: req.params.id },
      data: {
        status: 'ACCEPTED',
        reviewerId: req.user!.id,
      },
    });

    // Discord Rolle synchronisieren
    if (roleId) {
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (role?.discordRoleId) {
        await syncUserRole(application.discordId, role.discordRoleId, 'add');
      }
    }

    res.json({ user, employee });
  } catch (error) {
    console.error('Accept application error:', error);
    res.status(500).json({ error: 'Fehler beim Annehmen der Bewerbung' });
  }
});

// Bewerbung ablehnen
router.post('/applications/:id/reject', authMiddleware, requirePermission('hr.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;

    const application = await prisma.application.update({
      where: { id: req.params.id },
      data: {
        status: 'REJECTED',
        notes: reason,
        reviewerId: req.user!.id,
      },
    });

    res.json(application);
  } catch (error) {
    console.error('Reject application error:', error);
    res.status(500).json({ error: 'Fehler beim Ablehnen der Bewerbung' });
  }
});

// Bewerbung löschen
router.delete('/applications/:id', authMiddleware, requirePermission('hr.manage'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.application.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete application error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Bewerbung' });
  }
});

// HR Statistiken
router.get('/stats', authMiddleware, requirePermission('hr.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const [total, byStatus, thisMonth] = await Promise.all([
      prisma.application.count(),
      prisma.application.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.application.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    res.json({
      total,
      thisMonth,
      byStatus: byStatus.reduce((acc, curr) => ({ ...acc, [curr.status]: curr._count }), {}),
    });
  } catch (error) {
    console.error('Get HR stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

export default router;
