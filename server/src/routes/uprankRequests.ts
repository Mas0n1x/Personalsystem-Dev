import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { notifyPromotion } from '../services/notificationService.js';
import { announcePromotion, announceAcademyGraduation } from '../services/discordAnnouncements.js';
import { broadcastCreate, broadcastUpdate, broadcastDelete } from '../services/socketService.js';
import { updateDiscordNickname, syncDiscordMembers, getAllRankRoles, syncUserRole, getTeamConfigForLevel } from '../services/discordBot.js';

const router = Router();

// Team-Sperrdauer in Wochen (gleich wie in uprankLock.ts)
const TEAM_LOCK_DURATION: Record<string, number> = {
  'Green': 1,
  'Silver': 2,
  'Gold': 4,
};

// Rank-Level Mapping
const RANK_TO_LEVEL: Record<string, number> = {
  'Recruit': 1,
  'Officer I': 2,
  'Officer II': 3,
  'Officer III': 4,
  'Senior Officer': 5,
  'Corporal': 6,
  'Sergeant I': 7,
  'Sergeant II': 8,
  'Lieutenant I': 9,
  'Lieutenant II': 10,
  'Captain': 11,
  'Commander': 12,
  'Deputy Chief': 13,
  'Assistant Chief': 14,
  'Chief of Police': 15,
};

router.use(authMiddleware);

// Get stats
router.get('/stats', requirePermission('teamlead.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const [total, pending, approved, rejected] = await Promise.all([
      prisma.uprankRequest.count(),
      prisma.uprankRequest.count({ where: { status: 'PENDING' } }),
      prisma.uprankRequest.count({ where: { status: 'APPROVED' } }),
      prisma.uprankRequest.count({ where: { status: 'REJECTED' } }),
    ]);

    res.json({ total, pending, approved, rejected });
  } catch (error) {
    console.error('Error fetching uprank request stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get all uprank requests
router.get('/', requirePermission('teamlead.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const requests = await prisma.uprankRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: {
          include: {
            user: { select: { displayName: true, username: true } }
          }
        },
        requestedBy: {
          select: { id: true, displayName: true, username: true }
        },
        processedBy: {
          select: { displayName: true, username: true }
        }
      }
    });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching uprank requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Get employees for selection
router.get('/employees', requirePermission('teamlead.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: { select: { id: true, displayName: true, username: true } },
        uprankLocks: {
          where: {
            isActive: true,
            lockedUntil: { gt: new Date() }
          }
        }
      },
      orderBy: { user: { displayName: 'asc' } }
    });

    // Map to include lock status
    const employeesWithLockStatus = employees.map(emp => ({
      ...emp,
      hasActiveLock: emp.uprankLocks.length > 0,
      lockUntil: emp.uprankLocks[0]?.lockedUntil || null
    }));

    res.json(employeesWithLockStatus);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get single request
router.get('/:id', requirePermission('teamlead.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const request = await prisma.uprankRequest.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            user: { select: { displayName: true, username: true } },
            uprankLocks: {
              where: {
                isActive: true,
                lockedUntil: { gt: new Date() }
              }
            }
          }
        },
        requestedBy: {
          select: { id: true, displayName: true, username: true }
        },
        processedBy: {
          select: { displayName: true, username: true }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(request);
  } catch (error) {
    console.error('Error fetching uprank request:', error);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

// Create uprank request (Teamleiter)
router.post('/', requirePermission('teamlead.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, targetRank, reason, achievements, interviewCompleted, interviewNotes, interviewDate } = req.body;
    const userId = req.user!.id;

    if (!employeeId || !targetRank || !reason) {
      return res.status(400).json({ error: 'Employee, target rank and reason are required' });
    }

    // Bewerbungsgespräch ist erforderlich
    if (!interviewCompleted) {
      return res.status(400).json({ error: 'Ein Bewerbungsgespräch mit dem Mitarbeiter muss vor dem Uprank-Antrag durchgeführt werden' });
    }

    // Get employee current rank
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        uprankLocks: {
          where: {
            isActive: true,
            lockedUntil: { gt: new Date() }
          }
        }
      }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check for active uprank lock
    if (employee.uprankLocks.length > 0) {
      const lock = employee.uprankLocks[0];
      return res.status(400).json({
        error: `Mitarbeiter hat eine aktive Uprank-Sperre bis ${new Date(lock.lockedUntil).toLocaleDateString('de-DE')}`
      });
    }

    // Check for pending request
    const existingRequest = await prisma.uprankRequest.findFirst({
      where: {
        employeeId,
        status: 'PENDING'
      }
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'Es gibt bereits einen offenen Antrag für diesen Mitarbeiter' });
    }

    const request = await prisma.uprankRequest.create({
      data: {
        employeeId,
        currentRank: employee.rank,
        targetRank,
        reason,
        achievements,
        interviewCompleted: true,
        interviewNotes: interviewNotes || null,
        interviewDate: interviewDate ? new Date(interviewDate) : new Date(),
        requestedById: userId,
      },
      include: {
        employee: {
          include: {
            user: { select: { displayName: true, username: true } }
          }
        },
        requestedBy: {
          select: { id: true, displayName: true, username: true }
        }
      }
    });

    // Live-Update broadcast
    broadcastCreate('uprankRequest', request);

    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating uprank request:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// Process request (Management - approve/reject)
router.put('/:id/process', requirePermission('management.uprank'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    const userId = req.user!.id;

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Valid status (APPROVED/REJECTED) is required' });
    }

    if (status === 'REJECTED' && !rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const request = await prisma.uprankRequest.findUnique({
      where: { id },
      include: { employee: true }
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Request has already been processed' });
    }

    // Update request
    const updatedRequest = await prisma.uprankRequest.update({
      where: { id },
      data: {
        status,
        rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        processedById: userId,
        processedAt: new Date(),
      },
      include: {
        employee: {
          include: {
            user: { select: { displayName: true, username: true } }
          }
        },
        requestedBy: {
          select: { displayName: true, username: true }
        },
        processedBy: {
          select: { displayName: true, username: true }
        }
      }
    });

    // If approved, update employee rank and archive
    if (status === 'APPROVED') {
      // Neues Rank-Level berechnen
      const newRankLevel = RANK_TO_LEVEL[request.targetRank] || request.employee.rankLevel + 1;

      // Beförderung im Archiv speichern
      await prisma.promotionArchive.create({
        data: {
          employeeId: request.employeeId,
          oldRank: request.employee.rank,
          oldRankLevel: request.employee.rankLevel,
          newRank: request.targetRank,
          newRankLevel: newRankLevel,
          promotedById: userId,
          reason: request.reason,
        },
      });

      const updatedEmployee = await prisma.employee.update({
        where: { id: request.employeeId },
        data: {
          rank: request.targetRank,
          rankLevel: newRankLevel
        },
        include: {
          user: true
        }
      });

      // Name ohne Badge-Nummer extrahieren
      const cleanName = (name: string | null) => {
        if (!name) return null;
        return name.replace(/^\[[A-Z]+-\d+\]\s*/, '').trim();
      };
      const pureName = cleanName(updatedEmployee.user.displayName) || updatedEmployee.user.username;

      // Discord Nickname aktualisieren (mit Badge-Nummer)
      const newNickname = updatedEmployee.badgeNumber
        ? `[${updatedEmployee.badgeNumber}] ${pureName}`
        : pureName;

      await updateDiscordNickname(updatedEmployee.user.discordId, newNickname);

      // User displayName auch aktualisieren
      await prisma.user.update({
        where: { id: updatedEmployee.userId },
        data: { displayName: newNickname },
      });

      // Discord Rang-Rolle aktualisieren
      const allRankRoles = getAllRankRoles();

      // Alte Rang-Rolle finden und entfernen
      const oldRankRole = allRankRoles.find(r => r.rank === request.employee.rank);
      if (oldRankRole) {
        await syncUserRole(updatedEmployee.user.discordId, oldRankRole.id, 'remove');
        console.log(`[Uprank] Alte Rang-Rolle entfernt: ${oldRankRole.rank}`);
      }

      // Neue Rang-Rolle finden und hinzufügen
      const newRankRole = allRankRoles.find(r => r.rank === request.targetRank);
      if (newRankRole) {
        await syncUserRole(updatedEmployee.user.discordId, newRankRole.id, 'add');
        console.log(`[Uprank] Neue Rang-Rolle hinzugefügt: ${newRankRole.rank}`);
      } else {
        console.warn(`[Uprank] Rang-Rolle für "${request.targetRank}" nicht gefunden!`);
      }

      // Discord-Rollen synchronisieren (aktualisiert System-Rollen in DB)
      await syncDiscordMembers();

      // Automatische Uprank-Sperre basierend auf neuem Team setzen
      const teamConfig = getTeamConfigForLevel(newRankLevel);
      const lockWeeks = TEAM_LOCK_DURATION[teamConfig.team];

      if (lockWeeks) {
        // Alte Sperren deaktivieren
        await prisma.uprankLock.updateMany({
          where: { employeeId: request.employeeId, isActive: true },
          data: { isActive: false },
        });

        // Neue Sperre erstellen
        const lockedUntil = new Date();
        lockedUntil.setDate(lockedUntil.getDate() + lockWeeks * 7);

        await prisma.uprankLock.create({
          data: {
            employeeId: request.employeeId,
            reason: `Beförderung zu ${request.targetRank} (Team ${teamConfig.team} - ${lockWeeks} Woche${lockWeeks > 1 ? 'n' : ''} Sperre)`,
            team: `Team ${teamConfig.team}`,
            lockedUntil,
            createdById: userId,
          },
        });

        console.log(`[Uprank] Automatische Sperre bis ${lockedUntil.toLocaleDateString('de-DE')} erstellt (Team ${teamConfig.team})`);
      }

      // Benachrichtigung an den beförderten Mitarbeiter senden
      const promotedByName = updatedRequest.processedBy?.displayName || updatedRequest.processedBy?.username || 'Unbekannt';
      await notifyPromotion(
        request.employee.userId,
        request.employee.rank,
        request.targetRank,
        promotedByName
      );

      // Discord Announcement senden
      if (request.isAcademyRequest) {
        // Academy Graduation Announcement - Ausbilder ist der requestedBy (der die Ausbildung durchgeführt hat)
        const trainerName = updatedRequest.requestedBy?.displayName || updatedRequest.requestedBy?.username || 'Academy';
        await announceAcademyGraduation({
          employeeName: pureName,
          employeeAvatar: null, // Nicht verfügbar in diesem Context
          graduationType: request.targetRank === 'Junior Officer' ? 'Junior Officer Ausbildung' : 'Officer Ausbildung',
          completedBy: trainerName,
          badgeNumber: updatedRequest.employee.badgeNumber,
          notes: request.achievements || null,
        });
      } else {
        // Normale Promotion Announcement
        await announcePromotion({
          employeeName: pureName,
          employeeAvatar: null,
          oldRank: request.employee.rank,
          newRank: request.targetRank,
          promotedBy: promotedByName,
          reason: request.reason || null,
          badgeNumber: updatedRequest.employee.badgeNumber,
        });
      }
    }

    // Live-Update broadcast
    broadcastUpdate('uprankRequest', updatedRequest);

    res.json(updatedRequest);
  } catch (error) {
    console.error('Error processing uprank request:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Delete request (only if pending and by creator)
router.delete('/:id', requirePermission('teamlead.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const request = await prisma.uprankRequest.findUnique({ where: { id } });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending requests can be deleted' });
    }

    // Check if user is creator or has admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: { permissions: true }
        }
      }
    });

    // Prüfe alle Rollen des Users auf admin.full Permission
    const isAdmin = user?.roles?.some(role =>
      role.permissions.some((p: { name: string }) => p.name === 'admin.full')
    );
    const isCreator = request.requestedById === userId;

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Only the creator or admin can delete this request' });
    }

    await prisma.uprankRequest.delete({ where: { id } });

    // Live-Update broadcast
    broadcastDelete('uprankRequest', id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting uprank request:', error);
    res.status(500).json({ error: 'Failed to delete request' });
  }
});

// Get my requests (for team leaders)
router.get('/my/requests', authMiddleware, requirePermission('teamlead.view'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const requests = await prisma.uprankRequest.findMany({
      where: { requestedById: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        employee: {
          include: {
            user: { select: { displayName: true, username: true } }
          }
        },
        processedBy: {
          select: { displayName: true, username: true }
        }
      }
    });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching my requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

export default router;
