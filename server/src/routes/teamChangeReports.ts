import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

// Get stats
router.get('/stats', requirePermission('ia.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const [total, pending, reviewed, archived] = await Promise.all([
      prisma.teamChangeReport.count(),
      prisma.teamChangeReport.count({ where: { status: 'PENDING' } }),
      prisma.teamChangeReport.count({ where: { status: 'REVIEWED' } }),
      prisma.teamChangeReport.count({ where: { status: 'ARCHIVED' } }),
    ]);

    // This month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const thisMonthCount = await prisma.teamChangeReport.count({
      where: { changeDate: { gte: thisMonth } },
    });

    res.json({ total, pending, reviewed, archived, thisMonth: thisMonthCount });
  } catch (error) {
    console.error('Error fetching team change report stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get all team change reports
router.get('/', requirePermission('ia.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const reports = await prisma.teamChangeReport.findMany({
      where,
      orderBy: { changeDate: 'desc' },
      include: {
        employee: {
          include: {
            user: { select: { displayName: true, username: true } },
          },
        },
        reviewedBy: {
          select: { displayName: true, username: true },
        },
      },
    });

    res.json(reports);
  } catch (error) {
    console.error('Error fetching team change reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Get single report
router.get('/:id', requirePermission('ia.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const report = await prisma.teamChangeReport.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            user: { select: { displayName: true, username: true } },
            uprankLocks: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        reviewedBy: {
          select: { displayName: true, username: true },
        },
      },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (error) {
    console.error('Error fetching team change report:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// Create a team change report (usually called when an employee changes teams)
router.post('/', requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, previousTeam, newTeam, notes, uprankLockId } = req.body;

    if (!employeeId || !previousTeam || !newTeam) {
      return res.status(400).json({ error: 'Employee, previous team, and new team are required' });
    }

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const report = await prisma.teamChangeReport.create({
      data: {
        employeeId,
        previousTeam,
        newTeam,
        notes,
        uprankLockId,
      },
      include: {
        employee: {
          include: {
            user: { select: { displayName: true, username: true } },
          },
        },
      },
    });

    res.status(201).json(report);
  } catch (error) {
    console.error('Error creating team change report:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// Review a report (IA)
router.put('/:id/review', requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reviewNotes, status } = req.body;
    const userId = req.user!.id;

    if (!status || !['REVIEWED', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({ error: 'Valid status (REVIEWED/ARCHIVED) is required' });
    }

    const report = await prisma.teamChangeReport.findUnique({ where: { id } });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const updatedReport = await prisma.teamChangeReport.update({
      where: { id },
      data: {
        status,
        reviewNotes,
        reviewedById: userId,
        reviewedAt: new Date(),
      },
      include: {
        employee: {
          include: {
            user: { select: { displayName: true, username: true } },
          },
        },
        reviewedBy: {
          select: { displayName: true, username: true },
        },
      },
    });

    res.json(updatedReport);
  } catch (error) {
    console.error('Error reviewing team change report:', error);
    res.status(500).json({ error: 'Failed to review report' });
  }
});

// Update report notes
router.put('/:id', requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const report = await prisma.teamChangeReport.findUnique({ where: { id } });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const updatedReport = await prisma.teamChangeReport.update({
      where: { id },
      data: { notes },
      include: {
        employee: {
          include: {
            user: { select: { displayName: true, username: true } },
          },
        },
      },
    });

    res.json(updatedReport);
  } catch (error) {
    console.error('Error updating team change report:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

// Delete report
router.delete('/:id', requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const report = await prisma.teamChangeReport.findUnique({ where: { id } });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    await prisma.teamChangeReport.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting team change report:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// Get reports for specific employee
router.get('/employee/:employeeId', requirePermission('ia.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.params;

    const reports = await prisma.teamChangeReport.findMany({
      where: { employeeId },
      orderBy: { changeDate: 'desc' },
      include: {
        reviewedBy: {
          select: { displayName: true, username: true },
        },
      },
    });

    res.json(reports);
  } catch (error) {
    console.error('Error fetching employee team change reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

export default router;
