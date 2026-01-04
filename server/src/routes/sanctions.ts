import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { triggerSanctionIssued, getEmployeeIdFromUserId } from '../services/bonusService.js';

const router = Router();

// GET alle Sanktionen (mit Filter und Pagination)
router.get('/', authMiddleware, requirePermission('sanctions.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, employeeId, page = '1', limit = '20' } = req.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (status) {
      where.status = status as string;
    }

    if (employeeId) {
      where.employeeId = employeeId as string;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [sanctions, total] = await Promise.all([
      prisma.sanction.findMany({
        where,
        include: {
          employee: {
            include: {
              user: {
                select: {
                  displayName: true,
                  username: true,
                  avatar: true,
                },
              },
            },
          },
          issuedBy: {
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
      prisma.sanction.count({ where }),
    ]);

    res.json({
      data: sanctions,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get sanctions error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Sanktionen' });
  }
});

// GET Sanktionen eines Mitarbeiters
router.get('/employee/:employeeId', authMiddleware, requirePermission('sanctions.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.params;

    const sanctions = await prisma.sanction.findMany({
      where: { employeeId },
      include: {
        issuedBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(sanctions);
  } catch (error) {
    console.error('Get employee sanctions error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Sanktionen' });
  }
});

// POST neue Sanktion erstellen
router.post('/', authMiddleware, requirePermission('sanctions.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, hasWarning, hasFine, hasMeasure, reason, amount, measure, expiresAt } = req.body;

    if (!employeeId || !reason) {
      res.status(400).json({ error: 'Mitarbeiter und Grund sind erforderlich' });
      return;
    }

    if (!hasWarning && !hasFine && !hasMeasure) {
      res.status(400).json({ error: 'Mindestens ein Sanktionstyp muss ausgewählt werden' });
      return;
    }

    // Prüfen ob Mitarbeiter existiert
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
      return;
    }

    const sanction = await prisma.sanction.create({
      data: {
        employeeId,
        hasWarning: !!hasWarning,
        hasFine: !!hasFine,
        hasMeasure: !!hasMeasure,
        reason,
        amount: hasFine ? amount : null,
        measure: hasMeasure ? measure : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        issuedById: req.user!.id,
      },
      include: {
        employee: {
          include: {
            user: {
              select: {
                displayName: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        issuedBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Bonus-Trigger für erteilte Sanktion
    const issuedByEmployeeId = await getEmployeeIdFromUserId(req.user!.id);
    if (issuedByEmployeeId) {
      const employeeName = sanction.employee.user.displayName || sanction.employee.user.username;
      await triggerSanctionIssued(issuedByEmployeeId, employeeName, sanction.id);
    }

    res.status(201).json(sanction);
  } catch (error) {
    console.error('Create sanction error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Sanktion' });
  }
});

// PUT Sanktion widerrufen
router.put('/:id/revoke', authMiddleware, requirePermission('sanctions.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const sanction = await prisma.sanction.update({
      where: { id },
      data: { status: 'REVOKED' },
      include: {
        employee: {
          include: {
            user: {
              select: {
                displayName: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        issuedBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    res.json(sanction);
  } catch (error) {
    console.error('Revoke sanction error:', error);
    res.status(500).json({ error: 'Fehler beim Widerrufen der Sanktion' });
  }
});

// PUT Sanktion bearbeiten
router.put('/:id', authMiddleware, requirePermission('sanctions.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, amount, status, expiresAt } = req.body;

    const sanction = await prisma.sanction.update({
      where: { id },
      data: {
        reason,
        amount,
        status,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        employee: {
          include: {
            user: {
              select: {
                displayName: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        issuedBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    res.json(sanction);
  } catch (error) {
    console.error('Update sanction error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Sanktion' });
  }
});

// DELETE Sanktion löschen
router.delete('/:id', authMiddleware, requirePermission('sanctions.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.sanction.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete sanction error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Sanktion' });
  }
});

export default router;
