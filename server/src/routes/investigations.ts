import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { triggerInvestigationOpened, triggerInvestigationClosed, getEmployeeIdFromUserId } from '../services/bonusService.js';
import { broadcastCreate, broadcastUpdate, broadcastDelete } from '../services/socketService.js';
import { trackActivityByUserId } from '../services/unitWorkService.js';

const router = Router();

// Alle Routen erfordern Authentifizierung
router.use(authMiddleware);

// Generate case number
async function generateCaseNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `IA-${year}-`;

  const lastCase = await prisma.investigation.findFirst({
    where: { caseNumber: { startsWith: prefix } },
    orderBy: { caseNumber: 'desc' },
  });

  let nextNumber = 1;
  if (lastCase) {
    const lastNumber = parseInt(lastCase.caseNumber.split('-')[2]);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
}

// Get stats
router.get('/stats', requirePermission('ia.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const [total, open, inProgress, closed] = await Promise.all([
      prisma.investigation.count(),
      prisma.investigation.count({ where: { status: 'OPEN' } }),
      prisma.investigation.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.investigation.count({ where: { status: 'CLOSED' } }),
    ]);

    res.json({ total, open, inProgress, closed });
  } catch (error) {
    console.error('Error fetching investigation stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get all investigations
router.get('/', requirePermission('ia.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, category, priority } = req.query;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;

    const investigations = await prisma.investigation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        accused: {
          include: {
            user: { select: { displayName: true, username: true } }
          }
        },
        leadInvestigator: {
          select: { id: true, displayName: true, username: true }
        },
        _count: {
          select: { notes: true, witnesses: true }
        }
      }
    });

    res.json(investigations);
  } catch (error) {
    console.error('Error fetching investigations:', error);
    res.status(500).json({ error: 'Failed to fetch investigations' });
  }
});

// Hilfsfunktion: Berechnet Start der aktuellen Woche (Montag 00:00)
function getCurrentWeekStart(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - adjustedDay + 1);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

// Get employees for selection (with IA check lock status)
router.get('/employees', requirePermission('ia.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const weekStart = getCurrentWeekStart();

    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: { select: { id: true, displayName: true, username: true } },
        iaCheckLocks: {
          where: { weekStart },
          include: {
            checkedBy: { select: { displayName: true, username: true } },
          },
        },
      },
      orderBy: { user: { displayName: 'asc' } }
    });

    // Transform to include check lock info
    const employeesWithLockStatus = employees.map(emp => ({
      ...emp,
      isCheckedThisWeek: emp.iaCheckLocks.length > 0,
      checkedAt: emp.iaCheckLocks[0]?.createdAt || null,
      checkedBy: emp.iaCheckLocks[0]?.checkedBy || null,
      iaCheckLocks: undefined, // Remove from response
    }));

    res.json(employeesWithLockStatus);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get single investigation
router.get('/:id', requirePermission('ia.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const investigation = await prisma.investigation.findUnique({
      where: { id },
      include: {
        accused: {
          include: {
            user: { select: { displayName: true, username: true } }
          }
        },
        leadInvestigator: {
          select: { id: true, displayName: true, username: true }
        },
        notes: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: { select: { displayName: true, username: true } }
          }
        },
        witnesses: {
          orderBy: { createdAt: 'asc' },
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

    if (!investigation) {
      return res.status(404).json({ error: 'Investigation not found' });
    }

    res.json(investigation);
  } catch (error) {
    console.error('Error fetching investigation:', error);
    res.status(500).json({ error: 'Failed to fetch investigation' });
  }
});

// Create investigation
router.post('/', requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, priority, category, accusedId, complainant } = req.body;
    const userId = req.user!.id;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const caseNumber = await generateCaseNumber();

    const investigation = await prisma.investigation.create({
      data: {
        caseNumber,
        title,
        description,
        priority: priority || 'NORMAL',
        category: category || 'BESCHWERDE',
        accusedId: accusedId || null,
        complainant,
        leadInvestigatorId: userId,
      },
      include: {
        accused: {
          include: {
            user: { select: { displayName: true, username: true } }
          }
        },
        leadInvestigator: {
          select: { id: true, displayName: true, username: true }
        }
      }
    });

    // Bonus-Trigger für eröffnete IA-Ermittlung
    const leadEmployeeId = await getEmployeeIdFromUserId(userId);
    if (leadEmployeeId) {
      await triggerInvestigationOpened(leadEmployeeId, caseNumber, investigation.id);
    }

    // Live-Update broadcast
    broadcastCreate('investigation', investigation);

    res.status(201).json(investigation);
  } catch (error) {
    console.error('Error creating investigation:', error);
    res.status(500).json({ error: 'Failed to create investigation' });
  }
});

// Update investigation
router.put('/:id', requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, category, accusedId, complainant, findings, recommendation } = req.body;

    // Hole vorherigen Status für Bonus-Trigger
    const previousInvestigation = await prisma.investigation.findUnique({
      where: { id },
      select: { status: true, caseNumber: true, leadInvestigatorId: true }
    });

    const updateData: Record<string, unknown> = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status) {
      updateData.status = status;
      if (status === 'CLOSED' || status === 'ARCHIVED') {
        updateData.closedAt = new Date();
      }
    }
    if (priority) updateData.priority = priority;
    if (category) updateData.category = category;
    if (accusedId !== undefined) updateData.accusedId = accusedId || null;
    if (complainant !== undefined) updateData.complainant = complainant;
    if (findings !== undefined) updateData.findings = findings;
    if (recommendation !== undefined) updateData.recommendation = recommendation;

    const investigation = await prisma.investigation.update({
      where: { id },
      data: updateData,
      include: {
        accused: {
          include: {
            user: { select: { displayName: true, username: true } }
          }
        },
        leadInvestigator: {
          select: { id: true, displayName: true, username: true }
        }
      }
    });

    // Bonus-Trigger wenn Ermittlung abgeschlossen wird
    if ((status === 'CLOSED' || status === 'ARCHIVED') && previousInvestigation?.status !== 'CLOSED' && previousInvestigation?.status !== 'ARCHIVED') {
      const leadEmployeeId = await getEmployeeIdFromUserId(investigation.leadInvestigator.id);
      if (leadEmployeeId && previousInvestigation) {
        await triggerInvestigationClosed(leadEmployeeId, previousInvestigation.caseNumber, id);
      }
      // Unit-Arbeit tracken
      await trackActivityByUserId(req.user!.id, 'investigationsCompleted');
    }

    // Live-Update broadcast
    broadcastUpdate('investigation', investigation);

    res.json(investigation);
  } catch (error) {
    console.error('Error updating investigation:', error);
    res.status(500).json({ error: 'Failed to update investigation' });
  }
});

// Delete investigation
router.delete('/:id', requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Storniere zugehörige Bonuszahlungen (nur PENDING)
    const cancelledBonuses = await prisma.bonusPayment.updateMany({
      where: {
        referenceId: id,
        referenceType: 'Investigation',
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    if (cancelledBonuses.count > 0) {
      console.log(`Investigation ${id} gelöscht: ${cancelledBonuses.count} Bonuszahlung(en) storniert`);
    }

    await prisma.investigation.delete({ where: { id } });

    // Live-Update broadcast
    broadcastDelete('investigation', id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting investigation:', error);
    res.status(500).json({ error: 'Failed to delete investigation' });
  }
});

// ==================== NOTES ====================

// Add note
router.post('/:id/notes', requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content, isConfidential } = req.body;
    const userId = req.user!.id;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const note = await prisma.investigationNote.create({
      data: {
        investigationId: id,
        content,
        isConfidential: isConfidential || false,
        createdById: userId,
      },
      include: {
        createdBy: { select: { displayName: true, username: true } }
      }
    });

    res.status(201).json(note);
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// Delete note
router.delete('/notes/:noteId', requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { noteId } = req.params;
    await prisma.investigationNote.delete({ where: { id: noteId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// ==================== WITNESSES ====================

// Add witness
router.post('/:id/witnesses', requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { employeeId, externalName, statement } = req.body;

    if (!employeeId && !externalName) {
      return res.status(400).json({ error: 'Employee ID or external name is required' });
    }

    const witness = await prisma.investigationWitness.create({
      data: {
        investigationId: id,
        employeeId: employeeId || null,
        externalName: externalName || null,
        statement,
      },
      include: {
        employee: {
          include: {
            user: { select: { displayName: true, username: true } }
          }
        }
      }
    });

    res.status(201).json(witness);
  } catch (error) {
    console.error('Error adding witness:', error);
    res.status(500).json({ error: 'Failed to add witness' });
  }
});

// Update witness
router.put('/witnesses/:witnessId', requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { witnessId } = req.params;
    const { statement, interviewedAt } = req.body;

    const updateData: Record<string, unknown> = {};
    if (statement !== undefined) updateData.statement = statement;
    if (interviewedAt !== undefined) updateData.interviewedAt = interviewedAt ? new Date(interviewedAt) : null;

    const witness = await prisma.investigationWitness.update({
      where: { id: witnessId },
      data: updateData,
      include: {
        employee: {
          include: {
            user: { select: { displayName: true, username: true } }
          }
        }
      }
    });

    res.json(witness);
  } catch (error) {
    console.error('Error updating witness:', error);
    res.status(500).json({ error: 'Failed to update witness' });
  }
});

// Delete witness
router.delete('/witnesses/:witnessId', requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { witnessId } = req.params;
    await prisma.investigationWitness.delete({ where: { id: witnessId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting witness:', error);
    res.status(500).json({ error: 'Failed to delete witness' });
  }
});

export default router;
