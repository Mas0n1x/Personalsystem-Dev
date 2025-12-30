import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';

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
    // Summiere die Mengen (quantity) statt nur Einträge zu zählen
    const [totalAgg, eingelagertAgg, vernichtetAgg] = await Promise.all([
      prisma.evidence.aggregate({ _sum: { quantity: true } }),
      prisma.evidence.aggregate({ where: { status: 'EINGELAGERT' }, _sum: { quantity: true } }),
      prisma.evidence.aggregate({ where: { status: 'VERNICHTET' }, _sum: { quantity: true } }),
    ]);

    res.json({
      total: totalAgg._sum.quantity || 0,
      eingelagert: eingelagertAgg._sum.quantity || 0,
      vernichtet: vernichtetAgg._sum.quantity || 0,
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

    await prisma.evidence.updateMany({
      where: { id: { in: ids }, status: 'EINGELAGERT' },
      data: {
        status: 'VERNICHTET',
        releasedAt: new Date(),
      },
    });

    // Update releasedById for each (updateMany doesn't support relations)
    for (const id of ids) {
      await prisma.evidence.update({
        where: { id },
        data: { releasedById: req.user!.id },
      });
    }

    res.json({ success: true, count: ids.length });
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

    res.json({ success: true });
  } catch (error) {
    console.error('Delete evidence error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Asservats' });
  }
});

export default router;
