import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';

const router = Router();

// Alle Mitarbeiter abrufen
router.get('/', authMiddleware, requirePermission('employees.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { search, department, status, rank, page = '1', limit = '20' } = req.query;

    const where: {
      status?: string;
      department?: string;
      rank?: string;
      OR?: Array<{ user?: { username?: { contains: string }; displayName?: { contains: string } }; badgeNumber?: { contains: string } }>;
    } = {};

    if (status) {
      where.status = status as string;
    }

    if (department) {
      where.department = department as string;
    }

    if (rank) {
      where.rank = rank as string;
    }

    if (search) {
      where.OR = [
        { user: { username: { contains: search as string } } },
        { user: { displayName: { contains: search as string } } },
        { badgeNumber: { contains: search as string } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          user: {
            include: {
              role: true,
            },
          },
        },
        skip,
        take: parseInt(limit as string),
        orderBy: { rankLevel: 'desc' }, // Sortierung nach Rang-Level (17 oben, 1 unten)
      }),
      prisma.employee.count({ where }),
    ]);

    res.json({
      data: employees,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Mitarbeiter' });
  }
});

// Einzelnen Mitarbeiter abrufen
router.get('/:id', authMiddleware, requirePermission('employees.view'), async (req: AuthRequest, res: Response) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!employee) {
      res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
      return;
    }

    res.json(employee);
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Mitarbeiters' });
  }
});

// Mitarbeiter erstellen (z.B. bei Einstellung)
router.post('/', authMiddleware, requirePermission('employees.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId, badgeNumber, rank, department, status } = req.body;

    // Prüfen ob User existiert
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'Benutzer nicht gefunden' });
      return;
    }

    // Prüfen ob bereits Mitarbeiter
    const existingEmployee = await prisma.employee.findUnique({ where: { userId } });
    if (existingEmployee) {
      res.status(400).json({ error: 'Benutzer ist bereits Mitarbeiter' });
      return;
    }

    const employee = await prisma.employee.create({
      data: {
        userId,
        badgeNumber,
        rank: rank || 'Cadet',
        department: department || 'Patrol',
        status: status || 'ACTIVE',
      },
      include: {
        user: {
          include: {
            role: true,
          },
        },
      },
    });

    res.status(201).json(employee);
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Mitarbeiters' });
  }
});

// Mitarbeiter aktualisieren
router.put('/:id', authMiddleware, requirePermission('employees.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const { badgeNumber, rank, department, status, notes } = req.body;

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: {
        badgeNumber,
        rank,
        department,
        status,
        notes,
      },
      include: {
        user: {
          include: {
            role: true,
          },
        },
      },
    });

    res.json(employee);
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Mitarbeiters' });
  }
});

// Mitarbeiter entlassen
router.delete('/:id', authMiddleware, requirePermission('employees.delete'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.employee.update({
      where: { id: req.params.id },
      data: { status: 'TERMINATED' },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Fehler beim Entlassen des Mitarbeiters' });
  }
});

// Statistiken für Mitarbeiter
router.get('/stats/overview', authMiddleware, requirePermission('employees.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const [total, byStatus, byDepartment] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.employee.groupBy({
        by: ['department'],
        _count: true,
        where: { status: 'ACTIVE' },
      }),
    ]);

    res.json({
      total,
      byStatus: byStatus.reduce((acc, curr) => ({ ...acc, [curr.status]: curr._count }), {}),
      byDepartment: byDepartment.reduce((acc, curr) => ({ ...acc, [curr.department]: curr._count }), {}),
    });
  } catch (error) {
    console.error('Get employee stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

export default router;
