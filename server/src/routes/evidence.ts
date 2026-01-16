import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { triggerEvidenceStored, getEmployeeIdFromUserId } from '../services/bonusService.js';
import { broadcastCreate, broadcastUpdate, broadcastDelete } from '../services/socketService.js';

const router = Router();

// GET alle Asservate (mit Filter und Pagination)
router.get('/', authMiddleware, requirePermission('evidence.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, category, search, page = '1', limit = '20' } = req.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (status) {
      where.status = status as string;
    }

    if (category) {
      where.category = category as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { caseNumber: { contains: search as string } },
        { description: { contains: search as string } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [evidence, total] = await Promise.all([
      prisma.evidence.findMany({
        where,
        include: {
          storedBy: {
            select: {
              displayName: true,
              username: true,
              avatar: true,
            },
          },
          releasedBy: {
            select: {
              displayName: true,
              username: true,
              avatar: true,
            },
          },
        },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.evidence.count({ where }),
    ]);

    res.json({
      data: evidence,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get evidence error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Asservate' });
  }
});

// GET Statistiken
router.get('/stats', authMiddleware, requirePermission('evidence.view'), async (_req: AuthRequest, res: Response) => {
  try {
    // Optimiert: Eine groupBy Query statt 3 separate Queries
    const [totalAgg, statusGroups] = await Promise.all([
      prisma.evidence.aggregate({ _sum: { quantity: true } }),
      prisma.evidence.groupBy({
        by: ['status'],
        _sum: { quantity: true },
      }),
    ]);

    const statsByStatus = statusGroups.reduce((acc, group) => {
      acc[group.status] = group._sum.quantity || 0;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      total: totalAgg._sum.quantity || 0,
      eingelagert: statsByStatus['EINGELAGERT'] || 0,
      vernichtet: statsByStatus['VERNICHTET'] || 0,
      ausgelagert: statsByStatus['AUSGELAGERT'] || 0,
      freigegeben: statsByStatus['FREIGEGEBEN'] || 0,
    });
  } catch (error) {
    console.error('Get evidence stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

// POST neues Asservat einlagern
router.post('/', authMiddleware, requirePermission('evidence.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, category, quantity, location, caseNumber } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name ist erforderlich' });
      return;
    }

    const evidence = await prisma.evidence.create({
      data: {
        name,
        description,
        category: category || 'SONSTIGES',
        quantity: quantity || 1,
        location,
        caseNumber,
        storedById: req.user!.id,
      },
      include: {
        storedBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Bonus-Trigger für eingelagertes Asservat
    const storedByEmployeeId = await getEmployeeIdFromUserId(req.user!.id);
    if (storedByEmployeeId) {
      await triggerEvidenceStored(storedByEmployeeId, name, evidence.id);
    }

    // Live-Update broadcast
    broadcastCreate('evidence', evidence);

    res.status(201).json(evidence);
  } catch (error) {
    console.error('Create evidence error:', error);
    res.status(500).json({ error: 'Fehler beim Einlagern des Asservats' });
  }
});

// PUT Asservat bearbeiten
router.put('/:id', authMiddleware, requirePermission('evidence.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, category, quantity, location, caseNumber } = req.body;

    const evidence = await prisma.evidence.update({
      where: { id },
      data: {
        name,
        description,
        category,
        quantity,
        location,
        caseNumber,
      },
      include: {
        storedBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
        releasedBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Live-Update broadcast
    broadcastUpdate('evidence', evidence);

    res.json(evidence);
  } catch (error) {
    console.error('Update evidence error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Asservats' });
  }
});

// PUT Asservat auslagern/Status ändern
router.put('/:id/release', authMiddleware, requirePermission('evidence.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, releaseReason } = req.body;

    if (!status || !['AUSGELAGERT', 'VERNICHTET', 'FREIGEGEBEN'].includes(status)) {
      res.status(400).json({ error: 'Ungültiger Status' });
      return;
    }

    const evidence = await prisma.evidence.update({
      where: { id },
      data: {
        status,
        releaseReason,
        releasedById: req.user!.id,
        releasedAt: new Date(),
      },
      include: {
        storedBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
        releasedBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Live-Update broadcast
    broadcastUpdate('evidence', evidence);

    res.json(evidence);
  } catch (error) {
    console.error('Release evidence error:', error);
    res.status(500).json({ error: 'Fehler beim Auslagern des Asservats' });
  }
});

// PUT Asservat wieder einlagern
router.put('/:id/restore', authMiddleware, requirePermission('evidence.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const evidence = await prisma.evidence.update({
      where: { id },
      data: {
        status: 'EINGELAGERT',
        releaseReason: null,
        releasedById: null,
        releasedAt: null,
      },
      include: {
        storedBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Live-Update broadcast
    broadcastUpdate('evidence', evidence);

    res.json(evidence);
  } catch (error) {
    console.error('Restore evidence error:', error);
    res.status(500).json({ error: 'Fehler beim Wiedereinlagern des Asservats' });
  }
});

// PUT Mehrere Asservate vernichten (Bulk)
router.put('/destroy-bulk', authMiddleware, requirePermission('evidence.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'Keine Asservate ausgewählt' });
      return;
    }

    // Prüfe ob alle IDs existieren und eingelagert sind
    const existingEvidence = await prisma.evidence.findMany({
      where: {
        id: { in: ids },
        status: 'EINGELAGERT',
      },
      select: { id: true },
    });

    const validIds = existingEvidence.map(e => e.id);

    if (validIds.length === 0) {
      res.status(400).json({ error: 'Keine gültigen Asservate zum Vernichten gefunden' });
      return;
    }

    // Verwende $transaction für Batch-Update (vermeidet N+1 Problem)
    await prisma.$transaction(
      validIds.map((id) =>
        prisma.evidence.update({
          where: { id },
          data: {
            status: 'VERNICHTET',
            releasedAt: new Date(),
            releasedById: req.user!.id,
          },
        })
      )
    );

    res.json({ success: true, count: validIds.length });
  } catch (error) {
    console.error('Destroy bulk evidence error:', error);
    res.status(500).json({ error: 'Fehler beim Vernichten der Asservate' });
  }
});

// DELETE Asservat löschen
router.delete('/:id', authMiddleware, requirePermission('evidence.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.evidence.delete({ where: { id } });

    // Live-Update broadcast
    broadcastDelete('evidence', id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete evidence error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Asservats' });
  }
});

export default router;
