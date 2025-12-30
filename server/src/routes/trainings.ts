import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';

const router = Router();

// Alle Routen erfordern Authentifizierung
router.use(authMiddleware);

// ==================== TRAINING TYPES ====================

// Get all training types
router.get('/types', requirePermission('academy.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const types = await prisma.trainingType.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { trainings: true }
        }
      }
    });
    res.json(types);
  } catch (error) {
    console.error('Error fetching training types:', error);
    res.status(500).json({ error: 'Failed to fetch training types' });
  }
});

// Create training type
router.post('/types', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, duration } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const type = await prisma.trainingType.create({
      data: {
        name,
        description,
        duration: duration || 60,
      }
    });

    res.status(201).json(type);
  } catch (error: unknown) {
    console.error('Error creating training type:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return res.status(400).json({ error: 'Ein Schulungstyp mit diesem Namen existiert bereits' });
    }
    res.status(500).json({ error: 'Failed to create training type' });
  }
});

// Update training type
router.put('/types/:id', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, duration, isActive } = req.body;

    const type = await prisma.trainingType.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(duration && { duration }),
        ...(isActive !== undefined && { isActive }),
      }
    });

    res.json(type);
  } catch (error) {
    console.error('Error updating training type:', error);
    res.status(500).json({ error: 'Failed to update training type' });
  }
});

// Delete training type
router.delete('/types/:id', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if there are trainings using this type
    const trainingCount = await prisma.training.count({
      where: { typeId: id }
    });

    if (trainingCount > 0) {
      return res.status(400).json({
        error: 'Dieser Schulungstyp wird noch verwendet. Bitte löschen Sie erst alle zugehörigen Schulungen.'
      });
    }

    await prisma.trainingType.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting training type:', error);
    res.status(500).json({ error: 'Failed to delete training type' });
  }
});

// ==================== TRAININGS ====================

// Get stats
router.get('/stats', requirePermission('academy.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();

    const [total, scheduled, completed, thisMonth] = await Promise.all([
      prisma.training.count(),
      prisma.training.count({ where: { status: 'SCHEDULED' } }),
      prisma.training.count({ where: { status: 'COMPLETED' } }),
      prisma.training.count({
        where: {
          scheduledAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
            lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
          }
        }
      })
    ]);

    res.json({ total, scheduled, completed, thisMonth });
  } catch (error) {
    console.error('Error fetching training stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get all trainings
router.get('/', requirePermission('academy.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, typeId, upcoming } = req.query;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (typeId) {
      where.typeId = typeId;
    }

    if (upcoming === 'true') {
      where.scheduledAt = { gte: new Date() };
      where.status = { in: ['SCHEDULED', 'IN_PROGRESS'] };
    }

    const trainings = await prisma.training.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      include: {
        type: true,
        instructor: {
          select: { id: true, displayName: true, username: true }
        },
        participants: {
          include: {
            employee: {
              include: {
                user: { select: { displayName: true, username: true } }
              }
            }
          }
        },
        _count: {
          select: { participants: true }
        }
      }
    });

    res.json(trainings);
  } catch (error) {
    console.error('Error fetching trainings:', error);
    res.status(500).json({ error: 'Failed to fetch trainings' });
  }
});

// Get employees for selection
router.get('/employees', requirePermission('academy.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: { select: { id: true, displayName: true, username: true } }
      },
      orderBy: { user: { displayName: 'asc' } }
    });
    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get single training
router.get('/:id', requirePermission('academy.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const training = await prisma.training.findUnique({
      where: { id },
      include: {
        type: true,
        instructor: {
          select: { id: true, displayName: true, username: true }
        },
        participants: {
          include: {
            employee: {
              include: {
                user: { select: { id: true, displayName: true, username: true } }
              }
            }
          },
          orderBy: { registeredAt: 'asc' }
        }
      }
    });

    if (!training) {
      return res.status(404).json({ error: 'Training not found' });
    }

    res.json(training);
  } catch (error) {
    console.error('Error fetching training:', error);
    res.status(500).json({ error: 'Failed to fetch training' });
  }
});

// Create training
router.post('/', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { typeId, title, description, scheduledAt, location, maxParticipants, notes } = req.body;
    const userId = req.user!.id;

    if (!typeId || !title || !scheduledAt) {
      return res.status(400).json({ error: 'Type, title and scheduled date are required' });
    }

    const training = await prisma.training.create({
      data: {
        typeId,
        title,
        description,
        scheduledAt: new Date(scheduledAt),
        location,
        maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
        instructorId: userId,
        notes,
      },
      include: {
        type: true,
        instructor: {
          select: { id: true, displayName: true, username: true }
        }
      }
    });

    res.status(201).json(training);
  } catch (error) {
    console.error('Error creating training:', error);
    res.status(500).json({ error: 'Failed to create training' });
  }
});

// Update training
router.put('/:id', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { typeId, title, description, scheduledAt, location, maxParticipants, status, notes } = req.body;

    const training = await prisma.training.update({
      where: { id },
      data: {
        ...(typeId && { typeId }),
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
        ...(location !== undefined && { location }),
        ...(maxParticipants !== undefined && { maxParticipants: maxParticipants ? parseInt(maxParticipants) : null }),
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        type: true,
        instructor: {
          select: { id: true, displayName: true, username: true }
        },
        participants: {
          include: {
            employee: {
              include: {
                user: { select: { displayName: true, username: true } }
              }
            }
          }
        }
      }
    });

    res.json(training);
  } catch (error) {
    console.error('Error updating training:', error);
    res.status(500).json({ error: 'Failed to update training' });
  }
});

// Delete training
router.delete('/:id', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.training.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting training:', error);
    res.status(500).json({ error: 'Failed to delete training' });
  }
});

// ==================== PARTICIPANTS ====================

// Add participant
router.post('/:id/participants', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    // Check max participants
    const training = await prisma.training.findUnique({
      where: { id },
      include: { _count: { select: { participants: true } } }
    });

    if (!training) {
      return res.status(404).json({ error: 'Training not found' });
    }

    if (training.maxParticipants && training._count.participants >= training.maxParticipants) {
      return res.status(400).json({ error: 'Maximale Teilnehmerzahl erreicht' });
    }

    const participant = await prisma.trainingParticipant.create({
      data: {
        trainingId: id,
        employeeId,
      },
      include: {
        employee: {
          include: {
            user: { select: { displayName: true, username: true } }
          }
        }
      }
    });

    res.status(201).json(participant);
  } catch (error: unknown) {
    console.error('Error adding participant:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return res.status(400).json({ error: 'Mitarbeiter ist bereits registriert' });
    }
    res.status(500).json({ error: 'Failed to add participant' });
  }
});

// Update participant (status, grade, feedback)
router.put('/:id/participants/:participantId', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { participantId } = req.params;
    const { status, grade, feedback } = req.body;

    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;
      if (status === 'ATTENDED') {
        updateData.attendedAt = new Date();
      }
    }
    if (grade !== undefined) updateData.grade = grade;
    if (feedback !== undefined) updateData.feedback = feedback;

    const participant = await prisma.trainingParticipant.update({
      where: { id: participantId },
      data: updateData,
      include: {
        employee: {
          include: {
            user: { select: { displayName: true, username: true } }
          }
        }
      }
    });

    res.json(participant);
  } catch (error) {
    console.error('Error updating participant:', error);
    res.status(500).json({ error: 'Failed to update participant' });
  }
});

// Remove participant
router.delete('/:id/participants/:participantId', requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { participantId } = req.params;

    await prisma.trainingParticipant.delete({ where: { id: participantId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing participant:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

// ==================== MY TRAININGS (for regular employees) ====================

// Get my upcoming trainings
router.get('/my/upcoming', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get employee for this user
    const employee = await prisma.employee.findUnique({
      where: { userId }
    });

    if (!employee) {
      return res.json([]);
    }

    const trainings = await prisma.trainingParticipant.findMany({
      where: {
        employeeId: employee.id,
        training: {
          scheduledAt: { gte: new Date() },
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] }
        }
      },
      include: {
        training: {
          include: {
            type: true,
            instructor: { select: { displayName: true, username: true } },
            _count: { select: { participants: true } }
          }
        }
      },
      orderBy: { training: { scheduledAt: 'asc' } }
    });

    res.json(trainings);
  } catch (error) {
    console.error('Error fetching my trainings:', error);
    res.status(500).json({ error: 'Failed to fetch my trainings' });
  }
});

// Get my training history
router.get('/my/history', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const employee = await prisma.employee.findUnique({
      where: { userId }
    });

    if (!employee) {
      return res.json([]);
    }

    const trainings = await prisma.trainingParticipant.findMany({
      where: {
        employeeId: employee.id,
        status: { in: ['ATTENDED', 'NO_SHOW', 'EXCUSED'] }
      },
      include: {
        training: {
          include: {
            type: true,
            instructor: { select: { displayName: true, username: true } }
          }
        }
      },
      orderBy: { training: { scheduledAt: 'desc' } }
    });

    res.json(trainings);
  } catch (error) {
    console.error('Error fetching training history:', error);
    res.status(500).json({ error: 'Failed to fetch training history' });
  }
});

export default router;
