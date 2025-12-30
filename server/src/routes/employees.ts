import { Router, Response } from 'express';
import { prisma } from '../index.js';
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

// Alle Mitarbeiter abrufen
router.get('/', authMiddleware, requirePermission('employees.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { search, department, rank, team, page = '1', limit = '20' } = req.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

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

    console.log('Employee filter:', { search, department, rank, team, where });

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
        orderBy: { rankLevel: 'desc' },
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

    const employee = await prisma.employee.create({
      data: {
        userId,
        badgeNumber,
        rank: rank || 'Cadet',
        department: department || '',
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

    res.json({
      success: true,
      employee: updatedEmployee,
    });
  } catch (error) {
    console.error('Set units error:', error);
    res.status(500).json({ error: 'Fehler beim Setzen der Units' });
  }
});

// Uprank - Rang erhöhen
router.post('/:id/uprank', authMiddleware, requirePermission('employees.edit'), async (req: AuthRequest, res: Response) => {
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
router.post('/:id/downrank', authMiddleware, requirePermission('employees.edit'), async (req: AuthRequest, res: Response) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!employee) {
      res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
      return;
    }

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
    const { reason } = req.body;

    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!employee) {
      res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
      return;
    }

    const kickResult = await kickMember(employee.user.discordId, reason || 'Kündigung');

    if (!kickResult.success) {
      console.warn(`Discord-Kick fehlgeschlagen: ${kickResult.error}`);
    }

    await prisma.employee.delete({
      where: { id: req.params.id },
    });

    await prisma.user.update({
      where: { id: employee.userId },
      data: { isActive: false },
    });

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
            role: true,
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
            role: true,
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
            role: true,
          },
        },
      },
    });

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

    res.json({ success: true });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Fehler beim Entlassen des Mitarbeiters' });
  }
});

export default router;
