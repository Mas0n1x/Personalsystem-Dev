import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import {
  updateDiscordNickname,
  changeRank,
  setUnitRoles,
  kickMember,
  getAllUnitRoles,
  getMemberRoles,
  syncDiscordMembers,
  getAllDiscordUnitStyleRoles,
  findFreeBadgeNumber,
  getTeamConfigForLevel
} from '../services/discordBot.js';
import { notifyPromotion, notifyDemotion, notifyUnitChange } from '../services/notificationService.js';
import { announcePromotion, announceDemotion, announceUnitChange, announceTermination, announceEmployeeChange } from '../services/discordAnnouncements.js';
import {
  broadcastCreate,
  broadcastUpdate,
  broadcastDelete,
  emitEmployeeTerminated,
  emitEmployeePromoted,
  emitEmployeeDemoted,
  emitEmployeeUnitJoined,
  emitEmployeeUnitLeft,
  LeitstelleEmployeeData,
} from '../services/socketService.js';

const router = Router();

// ============================================================================
// WICHTIG: Routen-Reihenfolge in Express ist kritisch!
// 1. Statische Routen zuerst (z.B. /stats/overview)
// 2. Parametrisierte Sub-Routen (z.B. /:id/units, /:id/uprank)
// 3. Einfache parametrisierte Routen zuletzt (z.B. /:id)
// ============================================================================

// Debug: Alle Discord Unit-Style Rollen anzeigen (temporär)
router.get('/debug/discord-roles', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const allRoles = getAllDiscordUnitStyleRoles();
  const unmappedRoles = allRoles.filter(r => !r.mapped);

  res.json({
    total: allRoles.length,
    mapped: allRoles.filter(r => r.mapped).length,
    unmapped: unmappedRoles.length,
    unmappedRoles: unmappedRoles.map(r => r.name),
    allRoles,
  });
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

// Team zu RankLevel Range Mapping
function getTeamRankLevelRange(team: string): { min: number; max: number } | null {
  switch (team) {
    case 'Green': return { min: 1, max: 5 };
    case 'Silver': return { min: 6, max: 9 };
    case 'Gold': return { min: 10, max: 12 };
    case 'Red': return { min: 13, max: 15 };
    case 'White': return { min: 16, max: 17 };
    default: return null;
  }
}

// Hilfsfunktion zum Parsen der Dienstnummer für Sortierung
function parseBadgeNumber(badgeNumber: string | null): { prefix: string; num: number } {
  if (!badgeNumber) return { prefix: 'ZZZ', num: 9999 }; // Ohne Dienstnummer ans Ende
  const match = badgeNumber.match(/^([A-Z]+)-(\d+)$/);
  if (match) {
    return { prefix: match[1], num: parseInt(match[2], 10) };
  }
  return { prefix: 'ZZZ', num: 9999 };
}

// Alle Mitarbeiter abrufen
router.get('/', authMiddleware, requirePermission('employees.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { search, department, rank, team, page = '1', limit = '20', all = 'false', sortBy = 'badgeNumber' } = req.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      // Standardmäßig nur aktive Mitarbeiter anzeigen
      status: 'ACTIVE',
    };

    // Department-Filter (mit contains, da Departments als "Patrol, S.W.A.T." gespeichert sind)
    if (department) {
      where.department = { contains: department as string };
    }

    if (rank) {
      where.rank = rank as string;
    }

    // Team-Filter (nach rankLevel Range filtern)
    if (team) {
      const range = getTeamRankLevelRange(team as string);
      if (range) {
        where.rankLevel = { gte: range.min, lte: range.max };
      }
    }

    if (search) {
      where.OR = [
        { user: { username: { contains: search as string } } },
        { user: { displayName: { contains: search as string } } },
        { badgeNumber: { contains: search as string } },
      ];
    }

    // Wenn all=true, alle Mitarbeiter ohne Pagination laden
    const loadAll = all === 'true';
    const skip = loadAll ? undefined : (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = loadAll ? undefined : parseInt(limit as string);

    console.log('Employee filter:', { search, department, rank, team, all, sortBy, loadAll, skip, take, where });

    const now = new Date();
    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          user: {
            include: {
              roles: true,
            },
          },
          // Aktuelle Abwesenheiten einschließen
          absences: {
            where: {
              startDate: { lte: now },
              endDate: { gte: now },
            },
            take: 1,
          },
        },
        skip,
        take,
        // Basis-Sortierung nach rankLevel (wird später im Code nach Dienstnummer sortiert)
        orderBy: { rankLevel: 'desc' },
      }),
      prisma.employee.count({ where }),
    ]);

    // Debug: Absences loggen
    const employeesWithAbsences = employees.filter(e => e.absences && e.absences.length > 0);
    if (employeesWithAbsences.length > 0) {
      console.log('Employees with active absences:', employeesWithAbsences.map(e => ({
        badge: e.badgeNumber,
        absences: e.absences,
      })));
    } else {
      console.log('No employees with active absences found. Current time:', now.toISOString());
    }

    // Sortierung nach Dienstnummer wenn gewünscht
    let sortedEmployees = employees;
    if (sortBy === 'badgeNumber') {
      sortedEmployees = [...employees].sort((a, b) => {
        const badgeA = parseBadgeNumber(a.badgeNumber);
        const badgeB = parseBadgeNumber(b.badgeNumber);

        // Erst nach Prefix sortieren (A vor B vor C usw.)
        if (badgeA.prefix !== badgeB.prefix) {
          return badgeA.prefix.localeCompare(badgeB.prefix);
        }
        // Dann nach Nummer sortieren (01, 02, 03...)
        return badgeA.num - badgeB.num;
      });
    }

    res.json({
      data: sortedEmployees,
      total,
      page: loadAll ? 1 : parseInt(page as string),
      limit: loadAll ? total : parseInt(limit as string),
      totalPages: loadAll ? 1 : Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Mitarbeiter' });
  }
});

// Mitarbeiter erstellen
router.post('/', authMiddleware, requirePermission('employees.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId, badgeNumber, rank, department, status } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'Benutzer nicht gefunden' });
      return;
    }

    const existingEmployee = await prisma.employee.findUnique({ where: { userId } });
    if (existingEmployee) {
      res.status(400).json({ error: 'Benutzer ist bereits Mitarbeiter' });
      return;
    }

    // Prüfe auf doppelte Dienstnummer
    if (badgeNumber) {
      const badgeExists = await prisma.employee.findFirst({
        where: { badgeNumber },
      });
      if (badgeExists) {
        res.status(400).json({ error: `Dienstnummer ${badgeNumber} ist bereits vergeben` });
        return;
      }
    }

    const employee = await prisma.employee.create({
      data: {
        userId,
        badgeNumber,
        rank: rank || 'Recruit',
        department: department || '',
        status: status || 'ACTIVE',
      },
      include: {
        user: {
          include: {
            roles: true,
          },
        },
      },
    });

    // WebSocket Broadcast für Live-Updates
    broadcastCreate('employee', employee);

    res.status(201).json(employee);
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Mitarbeiters' });
  }
});

// ============================================================================
// PARAMETRISIERTE SUB-ROUTEN - MÜSSEN VOR /:id KOMMEN!
// ============================================================================

// Unit-Rollen abrufen
router.get('/:id/units', authMiddleware, requirePermission('employees.view'), async (req: AuthRequest, res: Response) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!employee) {
      res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
      return;
    }

    const allUnitRoles = getAllUnitRoles();
    const memberRoles = await getMemberRoles(employee.user.discordId);
    const memberRoleIds = new Set(memberRoles.map(r => r.id));

    const unitRolesWithStatus = allUnitRoles.map(role => ({
      ...role,
      active: memberRoleIds.has(role.id),
    }));

    res.json({
      unitRoles: unitRolesWithStatus,
      memberRoles: memberRoles,
    });
  } catch (error) {
    console.error('Get units error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Units' });
  }
});

// Unit-Rollen setzen
router.post('/:id/units', authMiddleware, requirePermission('employees.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const { unitRoleIds } = req.body;

    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!employee) {
      res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
      return;
    }

    // Alte Units für Vergleich speichern
    const oldDepartment = employee.department;

    const result = await setUnitRoles(employee.user.discordId, unitRoleIds || []);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    await syncDiscordMembers();

    const updatedEmployee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    // Benachrichtigung bei Unit-Änderung senden
    if (updatedEmployee && updatedEmployee.department !== oldDepartment) {
      await notifyUnitChange(
        updatedEmployee.userId,
        oldDepartment || null,
        updatedEmployee.department || 'Keine Unit'
      );

      // Discord Announcement senden
      const cleanName = (name: string | null) => {
        if (!name) return null;
        return name.replace(/^\[[A-Z]+-\d+\]\s*/, '').trim();
      };
      const pureName = cleanName(updatedEmployee.user.displayName) || updatedEmployee.user.username;

      await announceUnitChange({
        employeeName: pureName,
        employeeAvatar: updatedEmployee.user.avatar,
        previousUnit: oldDepartment || null,
        newUnit: updatedEmployee.department || 'Keine Unit',
        badgeNumber: updatedEmployee.badgeNumber,
      });

      // Leitstelle API Events: Unit Eintritt/Austritt
      const oldUnits = oldDepartment?.split(',').map(d => d.trim()).filter(Boolean) || [];
      const newUnits = updatedEmployee.department?.split(',').map(d => d.trim()).filter(Boolean) || [];

      const leitstelleData: LeitstelleEmployeeData = {
        id: updatedEmployee.id,
        badgeNumber: updatedEmployee.badgeNumber,
        name: pureName,
        discordId: updatedEmployee.user.discordId,
        rank: updatedEmployee.rank,
        rankLevel: updatedEmployee.rankLevel,
        units: newUnits,
        status: updatedEmployee.status,
      };

      // Units die neu hinzugekommen sind
      const joinedUnits = newUnits.filter(u => !oldUnits.includes(u));
      for (const unit of joinedUnits) {
        emitEmployeeUnitJoined(leitstelleData, unit);
      }

      // Units die verlassen wurden
      const leftUnits = oldUnits.filter(u => !newUnits.includes(u));
      for (const unit of leftUnits) {
        emitEmployeeUnitLeft(leitstelleData, unit);
      }
    }

    res.json({
      success: true,
      employee: updatedEmployee,
    });
  } catch (error) {
    console.error('Set units error:', error);
    res.status(500).json({ error: 'Fehler beim Setzen der Units' });
  }
});

// Beförderungshistorie eines Mitarbeiters
router.get('/:id/promotions', authMiddleware, requirePermission('employees.view'), async (req: AuthRequest, res: Response) => {
  try {
    const promotions = await prisma.promotionArchive.findMany({
      where: { employeeId: req.params.id },
      include: {
        promotedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
      orderBy: { promotedAt: 'desc' },
      take: 10, // Letzte 10 Beförderungen
    });

    res.json(promotions);
  } catch (error) {
    console.error('Get employee promotions error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Beförderungen' });
  }
});

// Sonderzahlungen eines Mitarbeiters (alle Zeit)
router.get('/:id/bonuses', authMiddleware, requirePermission('employees.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '20' } = req.query;
    const employeeId = req.params.id;

    // Optimiert: Eine Abfrage für Statistiken via Aggregation + eine für paginierte Daten
    const [payments, aggregates, categoryStats] = await Promise.all([
      // Paginierte Payments für Anzeige
      prisma.bonusPayment.findMany({
        where: { employeeId },
        include: {
          config: {
            select: {
              displayName: true,
              category: true,
              activityType: true,
            },
          },
          paidBy: {
            select: {
              displayName: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
      }),
      // Aggregierte Statistiken
      prisma.bonusPayment.groupBy({
        by: ['status'],
        where: { employeeId },
        _sum: { amount: true },
        _count: true,
      }),
      // Statistiken nach Kategorie
      prisma.$queryRaw<Array<{ category: string; count: bigint; paidAmount: bigint }>>`
        SELECT bc.category, COUNT(*) as count,
               COALESCE(SUM(CASE WHEN bp.status = 'PAID' THEN bp.amount ELSE 0 END), 0) as paidAmount
        FROM bonus_payments bp
        JOIN bonus_configs bc ON bp.configId = bc.id
        WHERE bp.employeeId = ${employeeId}
        GROUP BY bc.category
      `,
    ]);

    // Statistiken aus Aggregation zusammenbauen
    const stats = {
      totalEarned: 0,
      totalPending: 0,
      paymentCount: 0,
      byCategory: {} as Record<string, { count: number; amount: number }>,
    };

    for (const agg of aggregates) {
      stats.paymentCount += agg._count;
      if (agg.status === 'PAID') {
        stats.totalEarned = agg._sum.amount || 0;
      } else if (agg.status === 'PENDING') {
        stats.totalPending = agg._sum.amount || 0;
      }
    }

    for (const cat of categoryStats) {
      stats.byCategory[cat.category] = {
        count: Number(cat.count),
        amount: Number(cat.paidAmount),
      };
    }

    res.json({ payments, stats });
  } catch (error) {
    console.error('Get employee bonuses error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Sonderzahlungen' });
  }
});

// Unit-Aktivitätsstatistiken eines Mitarbeiters
router.get('/:id/unit-stats', authMiddleware, requirePermission('employees.view'), async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.params.id;
    const period = req.query.period as string | undefined; // 'week', 'month', 'all'

    // Hole den Mitarbeiter für die Unit-Zuordnung und User-ID
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { department: true, userId: true },
    });

    if (!employee) {
      res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
      return;
    }

    const userId = employee.userId;
    const departments = (employee.department || '').split(',').map(d => d.trim()).filter(Boolean);

    // Zeitfilter berechnen
    let dateFilter: { gte: Date } | undefined;
    if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { gte: weekAgo };
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { gte: monthAgo };
    }
    // period === 'all' oder undefined => kein Filter

    // Hole alle relevanten Statistiken
    const [
      trainingsCompleted,
      trainingsParticipated,
      investigationsOpened,
      investigationsClosed,
      casesOpened,
      casesClosed,
      unitReviews,
      applicationsProcessed,
      examsGiven,
      modulesCompleted,
      retrainingsCompleted,
    ] = await Promise.all([
      // Academy: Durchgeführte Trainings (als Instructor)
      prisma.training.count({
        where: {
          instructorId: userId,
          status: 'COMPLETED',
          ...(dateFilter && { updatedAt: dateFilter }),
        },
      }),
      // Academy: Teilgenommene Trainings (ATTENDED status)
      prisma.trainingParticipant.count({
        where: {
          employeeId,
          status: 'ATTENDED',
          ...(dateFilter && { attendedAt: dateFilter }),
        },
      }),
      // IA: Ermittlungen eröffnet (als Lead Investigator)
      prisma.investigation.count({
        where: {
          leadInvestigatorId: userId,
          ...(dateFilter && { createdAt: dateFilter }),
        },
      }),
      // IA: Ermittlungen abgeschlossen (als Lead Investigator)
      prisma.investigation.count({
        where: {
          leadInvestigatorId: userId,
          status: 'CLOSED',
          ...(dateFilter && { closedAt: dateFilter }),
        },
      }),
      // Detective: Akten eröffnet
      prisma.case.count({
        where: {
          createdById: userId,
          ...(dateFilter && { createdAt: dateFilter }),
        },
      }),
      // Detective: Akten abgeschlossen
      prisma.case.count({
        where: {
          createdById: userId,
          status: 'CLOSED',
          ...(dateFilter && { closedAt: dateFilter }),
        },
      }),
      // QA: Unit Reviews durchgeführt
      prisma.unitReview.count({
        where: {
          reviewerId: userId,
          ...(dateFilter && { createdAt: dateFilter }),
        },
      }),
      // HR: Bewerbungen bearbeitet
      prisma.application.count({
        where: {
          processedById: userId,
          status: { in: ['COMPLETED', 'REJECTED'] },
          ...(dateFilter && { processedAt: dateFilter }),
        },
      }),
      // Academy: Prüfungen abgenommen
      prisma.academyExam.count({
        where: {
          examinerId: userId,
          ...(dateFilter && { createdAt: dateFilter }),
        },
      }),
      // Academy: Module als abgeschlossen markiert (für Trainees)
      prisma.academyProgress.count({
        where: {
          completedById: userId,
          completed: true,
          ...(dateFilter && { completedAt: dateFilter }),
        },
      }),
      // Academy: Nachschulungen abgeschlossen
      prisma.academyRetraining.count({
        where: {
          completedById: userId,
          status: 'COMPLETED',
          ...(dateFilter && { completedAt: dateFilter }),
        },
      }),
    ]);

    res.json({
      departments,
      stats: {
        academy: {
          trainingsCompleted,
          trainingsParticipated,
          examsGiven,
          modulesCompleted,
          retrainingsCompleted,
          total: trainingsCompleted + examsGiven + modulesCompleted + retrainingsCompleted,
        },
        internalAffairs: {
          investigationsOpened,
          investigationsClosed,
          unitReviews,
          total: investigationsOpened + unitReviews,
        },
        detective: {
          casesOpened,
          casesClosed,
          total: casesOpened,
        },
        humanResources: {
          applicationsProcessed,
          total: applicationsProcessed,
        },
      },
    });
  } catch (error) {
    console.error('Get employee unit stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Unit-Statistiken' });
  }
});

// Uprank - Rang erhöhen
router.post('/:id/uprank', authMiddleware, requirePermission('employees.rank'), async (req: AuthRequest, res: Response) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!employee) {
      res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
      return;
    }

    const result = await changeRank(employee.user.discordId, 'up');

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    // Daten für Update vorbereiten
    const updateData: { rank: string; rankLevel: number; badgeNumber?: string } = {
      rank: result.newRank!,
      rankLevel: result.newLevel!,
    };

    // Bei Team-Wechsel: Neue Dienstnummer setzen
    if (result.teamChanged && result.newBadgeNumber) {
      updateData.badgeNumber = result.newBadgeNumber;
    }

    // Alten Rang für Archiv speichern
    const oldRank = employee.rank;
    const oldRankLevel = employee.rankLevel;

    const updatedEmployee = await prisma.employee.update({
      where: { id: req.params.id },
      data: updateData,
      include: { user: true },
    });

    // Beförderung im Archiv speichern
    await prisma.promotionArchive.create({
      data: {
        employeeId: employee.id,
        oldRank: oldRank,
        oldRankLevel: oldRankLevel,
        newRank: result.newRank!,
        newRankLevel: result.newLevel!,
        promotedById: req.user!.id,
        reason: req.body.reason || null,
      },
    });

    // Nickname auf Discord aktualisieren (mit neuer Badge-Nummer falls geändert)
    const cleanName = (name: string | null) => {
      if (!name) return null;
      return name.replace(/^\[[A-Z]+-\d+\]\s*/, '').trim();
    };
    const pureName = cleanName(updatedEmployee.user.displayName) || updatedEmployee.user.username;
    const newNickname = updatedEmployee.badgeNumber
      ? `[${updatedEmployee.badgeNumber}] ${pureName}`
      : pureName;

    await updateDiscordNickname(updatedEmployee.user.discordId, newNickname);

    // User displayName auch aktualisieren
    await prisma.user.update({
      where: { id: updatedEmployee.userId },
      data: { displayName: newNickname },
    });

    await syncDiscordMembers();

    // Benachrichtigung an den beförderten Mitarbeiter senden
    const promotedByUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { displayName: true, username: true },
    });
    const promotedByName = promotedByUser?.displayName || promotedByUser?.username || 'Unbekannt';

    await notifyPromotion(
      updatedEmployee.userId,
      oldRank,
      result.newRank!,
      promotedByName
    );

    // Discord Announcement senden
    await announcePromotion({
      employeeName: pureName,
      employeeAvatar: updatedEmployee.user.avatar,
      oldRank: oldRank,
      newRank: result.newRank!,
      promotedBy: promotedByName,
      reason: req.body.reason || null,
      badgeNumber: updatedEmployee.badgeNumber,
    });

    // Uprank-Sperre setzen nach jeder Beförderung
    if (result.newTeam) {
      // Berechne Sperrdauer basierend auf dem aktuellen Team
      const TEAM_LOCK_DURATION: Record<string, number> = {
        'Team Green': 1,
        'Team Silver': 2,
        'Team Gold': 4,
        'Team Red': 0,      // Team Red hat keine Sperre
        'Team White': 0,    // Team White hat keine Sperre
      };

      const weeks = TEAM_LOCK_DURATION[result.newTeam] || 0;

      if (weeks > 0) {
        const lockedUntil = new Date();
        lockedUntil.setDate(lockedUntil.getDate() + weeks * 7);

        // Deaktiviere alle alten Sperren für diesen Mitarbeiter
        await prisma.uprankLock.updateMany({
          where: { employeeId: employee.id, isActive: true },
          data: { isActive: false },
        });

        // Erstelle neue Sperre
        await prisma.uprankLock.create({
          data: {
            employeeId: employee.id,
            team: result.newTeam,
            lockedUntil,
            reason: result.teamChanged
              ? `Automatische Sperre nach Beförderung zu ${result.newTeam}`
              : `Automatische Sperre nach Beförderung innerhalb ${result.newTeam}`,
            createdById: req.user!.id,
          },
        });

        console.log(`✅ Uprank-Sperre gesetzt für ${pureName} bis ${lockedUntil.toLocaleDateString('de-DE')} (${weeks} Wochen, Team: ${result.newTeam})`);
      }
    }

    // WebSocket Broadcast für Live-Updates
    broadcastUpdate('employee', { ...updatedEmployee, promoted: true, oldRank, newRank: result.newRank });

    // Leitstelle API Event: Uprank
    const leitstelleData: LeitstelleEmployeeData = {
      id: updatedEmployee.id,
      badgeNumber: updatedEmployee.badgeNumber,
      name: updatedEmployee.user.displayName || updatedEmployee.user.username,
      discordId: updatedEmployee.user.discordId,
      rank: result.newRank!,
      rankLevel: result.newLevel!,
      units: updatedEmployee.department?.split(',').map(d => d.trim()).filter(Boolean) || [],
      status: updatedEmployee.status,
    };
    emitEmployeePromoted(leitstelleData, oldRank, oldRankLevel);

    res.json({
      success: true,
      employee: updatedEmployee,
      newRank: result.newRank,
      newLevel: result.newLevel,
      newBadgeNumber: result.newBadgeNumber,
      teamChanged: result.teamChanged,
    });
  } catch (error) {
    console.error('Uprank error:', error);
    res.status(500).json({ error: 'Fehler beim Befördern' });
  }
});

// Downrank - Rang verringern
router.post('/:id/downrank', authMiddleware, requirePermission('employees.rank'), async (req: AuthRequest, res: Response) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!employee) {
      res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
      return;
    }

    // Alten Rang für Notification speichern
    const oldRank = employee.rank;

    const result = await changeRank(employee.user.discordId, 'down');

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    // Daten für Update vorbereiten
    const updateData: { rank: string; rankLevel: number; badgeNumber?: string } = {
      rank: result.newRank!,
      rankLevel: result.newLevel!,
    };

    // Bei Team-Wechsel: Neue Dienstnummer setzen
    if (result.teamChanged && result.newBadgeNumber) {
      updateData.badgeNumber = result.newBadgeNumber;
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id: req.params.id },
      data: updateData,
      include: { user: true },
    });

    // Nickname auf Discord aktualisieren (mit neuer Badge-Nummer falls geändert)
    const cleanName = (name: string | null) => {
      if (!name) return null;
      return name.replace(/^\[[A-Z]+-\d+\]\s*/, '').trim();
    };
    const pureName = cleanName(updatedEmployee.user.displayName) || updatedEmployee.user.username;
    const newNickname = updatedEmployee.badgeNumber
      ? `[${updatedEmployee.badgeNumber}] ${pureName}`
      : pureName;

    await updateDiscordNickname(updatedEmployee.user.discordId, newNickname);

    // User displayName auch aktualisieren
    await prisma.user.update({
      where: { id: updatedEmployee.userId },
      data: { displayName: newNickname },
    });

    await syncDiscordMembers();

    // Benachrichtigung an den degradierten Mitarbeiter senden
    const demotedByUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { displayName: true, username: true },
    });
    const demotedByName = demotedByUser?.displayName || demotedByUser?.username || 'Unbekannt';

    await notifyDemotion(
      updatedEmployee.userId,
      oldRank,
      result.newRank!,
      demotedByName,
      req.body.reason
    );

    // Discord Announcement senden
    await announceDemotion({
      employeeName: pureName,
      employeeAvatar: updatedEmployee.user.avatar,
      oldRank: oldRank,
      newRank: result.newRank!,
      demotedBy: demotedByName,
      reason: req.body.reason || null,
      badgeNumber: updatedEmployee.badgeNumber,
    });

    // WebSocket Broadcast für Live-Updates
    broadcastUpdate('employee', { ...updatedEmployee, demoted: true, oldRank, newRank: result.newRank });

    // Leitstelle API Event: Downrank
    const oldRankLevel = employee.rankLevel;
    const leitstelleData: LeitstelleEmployeeData = {
      id: updatedEmployee.id,
      badgeNumber: updatedEmployee.badgeNumber,
      name: updatedEmployee.user.displayName || updatedEmployee.user.username,
      discordId: updatedEmployee.user.discordId,
      rank: result.newRank!,
      rankLevel: result.newLevel!,
      units: updatedEmployee.department?.split(',').map(d => d.trim()).filter(Boolean) || [],
      status: updatedEmployee.status,
    };
    emitEmployeeDemoted(leitstelleData, oldRank, oldRankLevel);

    res.json({
      success: true,
      employee: updatedEmployee,
      newRank: result.newRank,
      newLevel: result.newLevel,
      newBadgeNumber: result.newBadgeNumber,
      teamChanged: result.teamChanged,
    });
  } catch (error) {
    console.error('Downrank error:', error);
    res.status(500).json({ error: 'Fehler beim Degradieren' });
  }
});

// Mitarbeiter kündigen (löschen + Discord kick)
router.post('/:id/terminate', authMiddleware, requirePermission('employees.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const { reason, terminationType = 'TERMINATION' } = req.body;

    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!employee) {
      res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
      return;
    }

    // Kündigung im Archiv speichern (vor dem Löschen!)
    await prisma.terminationArchive.create({
      data: {
        discordId: employee.user.discordId,
        discordUsername: employee.user.username,
        displayName: employee.user.displayName,
        badgeNumber: employee.badgeNumber,
        rankName: employee.rank,
        hireDate: employee.hireDate,
        terminationType: terminationType,
        reason: reason || null,
        terminatedById: req.user!.id,
      },
    });

    // WICHTIG: Erst Employee Status ändern, dann kicken!
    // So erkennt das guildMemberRemove Event dass bereits gekündigt wurde
    await prisma.employee.update({
      where: { id: req.params.id },
      data: { status: 'TERMINATED' },
    });

    await prisma.user.update({
      where: { id: employee.userId },
      data: { isActive: false },
    });

    const kickResult = await kickMember(employee.user.discordId, reason || 'Kündigung');

    if (!kickResult.success) {
      console.warn(`Discord-Kick fehlgeschlagen: ${kickResult.error}`);
    }

    // Jetzt erst löschen (nach dem Kick)
    await prisma.employee.delete({
      where: { id: req.params.id },
    });

    // Discord Announcement senden
    const terminatedByUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { displayName: true, username: true },
    });
    const terminatedByName = terminatedByUser?.displayName || terminatedByUser?.username || 'Unbekannt';

    // Name ohne Badge-Nummer extrahieren
    const cleanName = (name: string | null) => {
      if (!name) return null;
      return name.replace(/^\[[A-Z]+-\d+\]\s*/, '').trim();
    };
    const pureName = cleanName(employee.user.displayName) || employee.user.username;

    await announceTermination({
      employeeName: pureName,
      employeeAvatar: employee.user.avatar,
      rank: employee.rank,
      terminationType: terminationType as 'RESIGNATION' | 'TERMINATION' | 'INACTIVE',
      reason: reason || null,
      terminatedBy: terminatedByName,
      badgeNumber: employee.badgeNumber,
      hireDate: employee.hireDate,
    });

    // WebSocket Broadcast für Live-Updates
    broadcastDelete('employee', employee.id);

    // Leitstelle API Event: Kuendigung
    const leitstelleData: LeitstelleEmployeeData = {
      id: employee.id,
      badgeNumber: employee.badgeNumber,
      name: pureName,
      discordId: employee.user.discordId,
      rank: employee.rank,
      rankLevel: employee.rankLevel,
      units: employee.department?.split(',').map(d => d.trim()).filter(Boolean) || [],
      status: 'TERMINATED',
    };
    emitEmployeeTerminated(leitstelleData, reason || terminationType);

    res.json({
      success: true,
      discordKicked: kickResult.success,
      message: kickResult.success
        ? 'Mitarbeiter gekündigt und aus Discord entfernt'
        : 'Mitarbeiter gekündigt (Discord-Kick fehlgeschlagen)',
    });
  } catch (error) {
    console.error('Terminate error:', error);
    res.status(500).json({ error: 'Fehler beim Kündigen' });
  }
});

// ============================================================================
// EINFACHE PARAMETRISIERTE ROUTEN - MÜSSEN ZULETZT KOMMEN!
// ============================================================================

// Einzelnen Mitarbeiter abrufen
router.get('/:id', authMiddleware, requirePermission('employees.view'), async (req: AuthRequest, res: Response) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          include: {
            roles: true,
          },
        },
        absences: {
          orderBy: { startDate: 'desc' },
          take: 10,
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

// Mitarbeiter aktualisieren
router.put('/:id', authMiddleware, requirePermission('employees.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const { badgeNumber, displayName, status } = req.body;

    const existingEmployee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!existingEmployee) {
      res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
      return;
    }

    // Badge-Nummer Validierung
    let finalBadgeNumber = badgeNumber || null;

    if (badgeNumber) {
      // Prüfe ob die Badge-Nummer bereits belegt ist (außer vom aktuellen Mitarbeiter)
      const badgeExists = await prisma.employee.findFirst({
        where: {
          badgeNumber: badgeNumber,
          id: { not: req.params.id },
        },
      });

      if (badgeExists) {
        res.status(400).json({ error: `Dienstnummer ${badgeNumber} ist bereits vergeben` });
        return;
      }

      // Prüfe ob die Badge-Nummer im gültigen Bereich für den Rang liegt
      const teamConfig = getTeamConfigForLevel(existingEmployee.rankLevel);
      const badgeMatch = badgeNumber.match(/^([A-Z]+)-(\d+)$/);

      if (badgeMatch) {
        const badgeNum = parseInt(badgeMatch[2]);
        if (badgeNum < teamConfig.badgeMin || badgeNum > teamConfig.badgeMax) {
          res.status(400).json({
            error: `Dienstnummer muss für Team ${teamConfig.team} im Bereich ${teamConfig.badgePrefix}-${teamConfig.badgeMin.toString().padStart(2, '0')} bis ${teamConfig.badgePrefix}-${teamConfig.badgeMax.toString().padStart(2, '0')} liegen`,
          });
          return;
        }
      }
    }

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: {
        badgeNumber: finalBadgeNumber,
        status,
      },
      include: {
        user: {
          include: {
            roles: true,
          },
        },
      },
    });

    const cleanName = (name: string | null) => {
      if (!name) return null;
      return name.replace(/^\[[A-Z]+-\d+\]\s*/, '').trim();
    };

    const pureName = cleanName(displayName) || cleanName(existingEmployee.user.displayName) || existingEmployee.user.username;

    const newNickname = finalBadgeNumber
      ? `[${finalBadgeNumber}] ${pureName}`
      : pureName;

    console.log(`Updating Discord nickname for ${existingEmployee.user.discordId} to "${newNickname}"`);

    const discordUpdated = await updateDiscordNickname(existingEmployee.user.discordId, newNickname);
    console.log(`Discord update result: ${discordUpdated}`);

    await prisma.user.update({
      where: { id: existingEmployee.userId },
      data: { displayName: newNickname },
    });

    const updatedEmployee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          include: {
            roles: true,
          },
        },
      },
    });

    // WebSocket Broadcast für Live-Updates
    if (updatedEmployee) {
      broadcastUpdate('employee', updatedEmployee);
    }

    // Discord-Ankündigung bei Dienstnummer oder Namensänderung
    const oldBadgeNumber = existingEmployee.badgeNumber;
    const oldDisplayName = cleanName(existingEmployee.user.displayName) || existingEmployee.user.username;
    const badgeChanged = oldBadgeNumber !== finalBadgeNumber;
    const nameChanged = displayName && oldDisplayName !== pureName;

    if (badgeChanged || nameChanged) {
      const changedByUser = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { displayName: true, username: true },
      });
      const changedByName = changedByUser?.displayName || changedByUser?.username || 'Unbekannt';

      await announceEmployeeChange({
        employeeName: pureName,
        employeeAvatar: existingEmployee.user.avatar,
        badgeNumber: finalBadgeNumber,
        oldBadgeNumber: oldBadgeNumber,
        oldName: badgeChanged && nameChanged ? oldDisplayName : undefined,
        changedBy: changedByName,
        changeType: badgeChanged && nameChanged ? 'BOTH' : badgeChanged ? 'BADGE_NUMBER' : 'NAME',
      });
    }

    res.json(updatedEmployee);
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Mitarbeiters' });
  }
});

// Mitarbeiter entlassen (soft delete)
router.delete('/:id', authMiddleware, requirePermission('employees.delete'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.employee.update({
      where: { id: req.params.id },
      data: { status: 'TERMINATED' },
    });

    // WebSocket Broadcast für Live-Updates
    broadcastDelete('employee', req.params.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Fehler beim Entlassen des Mitarbeiters' });
  }
});

export default router;
