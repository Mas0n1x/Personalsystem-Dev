import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { getGuildInfo, getAllMembersWithRoles, getMemberRoles } from '../services/discordBot.js';

const router = Router();

// ==================== PUBLIC ROUTES (nur View-Permission) ====================

// Alle aktiven Units mit ihren Rollen abrufen
router.get('/', authMiddleware, requirePermission('employees.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const units = await prisma.unit.findMany({
      where: { isActive: true },
      include: {
        roles: {
          orderBy: { sortOrder: 'desc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    res.json(units);
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Units' });
  }
});

// Alle Units mit Mitgliederanzahl (für Übersicht) - WICHTIG: VOR /:id Route!
router.get('/overview', authMiddleware, requirePermission('employees.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const units = await prisma.unit.findMany({
      where: { isActive: true },
      include: {
        roles: {
          orderBy: { sortOrder: 'desc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const guildInfo = await getGuildInfo();

    if (!guildInfo) {
      // Fallback ohne Discord-Daten
      res.json(units.map(u => ({
        ...u,
        memberCount: 0,
        leadershipCount: 0,
      })));
      return;
    }

    // Alle aktiven Employees laden
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: {
          select: {
            discordId: true,
          },
        },
      },
    });

    // PERFORMANT: Alle Member-Rollen auf einmal laden statt einzeln
    const allMemberRoles = await getAllMembersWithRoles();

    // OPTIMIERT: Erstelle eine Map von RoleId -> Employee-Counts
    // Dies reduziert O(units * employees) zu O(employees + units)
    const roleCountMap = new Map<string, { members: Set<string>; leadership: Set<string> }>();

    // Sammle alle Role-IDs die wir brauchen
    const allRoleIds = new Set<string>();
    const leadershipRoleSet = new Set<string>();
    for (const unit of units) {
      for (const role of unit.roles) {
        allRoleIds.add(role.discordRoleId);
        if (role.isLeadership) {
          leadershipRoleSet.add(role.discordRoleId);
        }
      }
    }

    // Initialisiere die Map für alle relevanten Rollen
    for (const roleId of allRoleIds) {
      roleCountMap.set(roleId, { members: new Set(), leadership: new Set() });
    }

    // Ein Durchlauf durch alle Employees
    for (const employee of employees) {
      const memberRoles = allMemberRoles.get(employee.user.discordId) || [];
      for (const role of memberRoles) {
        const roleData = roleCountMap.get(role.id);
        if (roleData) {
          roleData.members.add(employee.id);
          if (leadershipRoleSet.has(role.id)) {
            roleData.leadership.add(employee.id);
          }
        }
      }
    }

    // Für jede Unit die Mitglieder zählen (jetzt O(unit.roles) statt O(employees))
    const unitsWithCounts = units.map((unit) => {
      const memberIds = new Set<string>();
      const leadershipIds = new Set<string>();

      for (const role of unit.roles) {
        const roleData = roleCountMap.get(role.discordRoleId);
        if (roleData) {
          roleData.members.forEach(id => memberIds.add(id));
          if (role.isLeadership) {
            roleData.leadership.forEach(id => leadershipIds.add(id));
          }
        }
      }

      return {
        ...unit,
        memberCount: memberIds.size,
        leadershipCount: leadershipIds.size,
      };
    });

    res.json(unitsWithCounts);
  } catch (error) {
    console.error('Error fetching units overview:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Units-Übersicht' });
  }
});

// Unit mit Mitgliedern abrufen (basierend auf Discord-Rollen)
router.get('/:id/members', authMiddleware, requirePermission('employees.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Unit laden
    const unit = await prisma.unit.findUnique({
      where: { id },
    });

    if (!unit) {
      res.status(404).json({ error: 'Unit nicht gefunden' });
      return;
    }

    // Rollen separat laden (um sicherzustellen dass sie geladen werden)
    const unitRoles = await prisma.unitRole.findMany({
      where: { unitId: id },
      orderBy: { sortOrder: 'desc' },
    });

    // Unit mit Rollen ergänzen
    const unitWithRoles = { ...unit, roles: unitRoles };

    // Discord Role IDs der Unit sammeln
    const roleIds = unitRoles.map(r => r.discordRoleId);

    if (roleIds.length === 0) {
      res.json({
        unit: unitWithRoles,
        members: [],
      });
      return;
    }

    // Alle Mitarbeiter mit den entsprechenden Discord-Rollen finden
    const guildInfo = await getGuildInfo();

    if (!guildInfo) {
      res.status(503).json({ error: 'Discord nicht verbunden' });
      return;
    }

    // Alle aktiven Employees mit ihren User-Daten laden
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: {
          select: {
            id: true,
            discordId: true,
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // PERFORMANT: Alle Member-Rollen auf einmal laden
    const allMemberRoles = await getAllMembersWithRoles();

    console.log(`[Units] Loaded ${allMemberRoles.size} Discord members with roles`);
    console.log(`[Units] Active employees to check: ${employees.length}`);
    console.log(`[Units] Unit roles to match: ${unitRoles.map(r => r.position).join(', ')}`);

    // Für jeden Employee prüfen, ob er eine der Unit-Rollen hat
    const membersWithRoles: Array<{
      employee: typeof employees[0];
      unitRole: typeof unitRoles[0] | null;
      discordRoles: Array<{ id: string; name: string }>;
    }> = [];

    for (const employee of employees) {
      const memberRoles = allMemberRoles.get(employee.user.discordId) || [];

      if (memberRoles.length === 0) {
        console.log(`[Units] No Discord roles found for employee: ${employee.user.displayName || employee.user.username} (${employee.user.discordId})`);
      }

      // Finde die höchste Unit-Rolle die der Member hat
      let highestUnitRole: typeof unitRoles[0] | null = null;

      for (const unitRole of unitRoles) {
        if (memberRoles.some(mr => mr.id === unitRole.discordRoleId)) {
          if (!highestUnitRole || unitRole.sortOrder > highestUnitRole.sortOrder) {
            highestUnitRole = unitRole;
          }
        }
      }

      if (highestUnitRole) {
        membersWithRoles.push({
          employee,
          unitRole: highestUnitRole,
          discordRoles: memberRoles,
        });
        console.log(`[Units] ✅ Found member: ${employee.user.displayName || employee.user.username} - ${highestUnitRole.position}`);
      }
    }

    console.log(`[Units] Total members found: ${membersWithRoles.length}`);

    // Sortieren nach Unit-Rolle (höchste zuerst)
    membersWithRoles.sort((a, b) => {
      const aOrder = a.unitRole?.sortOrder || 0;
      const bOrder = b.unitRole?.sortOrder || 0;
      return bOrder - aOrder;
    });

    res.json({
      unit: unitWithRoles,
      members: membersWithRoles.map(m => ({
        id: m.employee.id,
        name: m.employee.user.displayName || m.employee.user.username,
        avatar: m.employee.user.avatar,
        rank: m.employee.rank,
        badgeNumber: m.employee.badgeNumber,
        unitPosition: m.unitRole?.position || 'Mitglied',
        isLeadership: m.unitRole?.isLeadership || false,
        sortOrder: m.unitRole?.sortOrder || 0,
      })),
    });
  } catch (error) {
    console.error('Error fetching unit members:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Unit-Mitglieder' });
  }
});

// ==================== ADMIN ROUTES ====================

// Alle Units (auch inaktive) für Admin
router.get('/admin/all', authMiddleware, requirePermission('admin.full'), async (_req: AuthRequest, res: Response) => {
  try {
    const units = await prisma.unit.findMany({
      include: {
        roles: {
          orderBy: { sortOrder: 'desc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    res.json(units);
  } catch (error) {
    console.error('Error fetching all units:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Units' });
  }
});

// Verfügbare Discord-Rollen abrufen (für Dropdown) - WICHTIG: VOR /:id Routen!
router.get('/discord-roles', authMiddleware, requirePermission('admin.full'), async (_req: AuthRequest, res: Response) => {
  try {
    const guildInfo = await getGuildInfo();

    if (!guildInfo) {
      res.status(503).json({ error: 'Discord nicht verbunden' });
      return;
    }

    // Filtere nur Unit-relevante Rollen (beginnen mit "»")
    const unitRoles = guildInfo.roles.filter(r => r.name.startsWith('»'));

    res.json({
      serverName: guildInfo.name,
      roles: unitRoles,
    });
  } catch (error) {
    console.error('Error fetching Discord roles:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Discord-Rollen' });
  }
});

// Neue Unit erstellen
router.post('/', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, shortName, description, color, icon, sortOrder } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name ist erforderlich' });
      return;
    }

    // Prüfen ob Unit mit diesem Namen bereits existiert
    const existing = await prisma.unit.findUnique({
      where: { name },
    });

    if (existing) {
      res.status(400).json({ error: 'Eine Unit mit diesem Namen existiert bereits' });
      return;
    }

    const unit = await prisma.unit.create({
      data: {
        name,
        shortName: shortName || null,
        description: description || null,
        color: color || '#6366f1',
        icon: icon || null,
        sortOrder: sortOrder || 0,
      },
      include: {
        roles: true,
      },
    });

    res.status(201).json(unit);
  } catch (error) {
    console.error('Error creating unit:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Unit' });
  }
});

// Unit aktualisieren
router.put('/:id', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, shortName, description, color, icon, isActive, sortOrder } = req.body;

    const unit = await prisma.unit.update({
      where: { id },
      data: {
        name,
        shortName,
        description,
        color,
        icon,
        isActive,
        sortOrder,
      },
      include: {
        roles: {
          orderBy: { sortOrder: 'desc' },
        },
      },
    });

    res.json(unit);
  } catch (error) {
    console.error('Error updating unit:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Unit' });
  }
});

// Unit löschen
router.delete('/:id', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.unit.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting unit:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Unit' });
  }
});

// ==================== UNIT ROLES ====================

// Rolle zu Unit hinzufügen
router.post('/:id/roles', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { discordRoleId, discordRoleName, position, sortOrder, isLeadership } = req.body;

    if (!discordRoleId || !position) {
      res.status(400).json({ error: 'Discord Role ID und Position sind erforderlich' });
      return;
    }

    // Prüfen ob Unit existiert
    const unit = await prisma.unit.findUnique({
      where: { id },
    });

    if (!unit) {
      res.status(404).json({ error: 'Unit nicht gefunden' });
      return;
    }

    // Prüfen ob Rolle bereits zugewiesen
    const existing = await prisma.unitRole.findFirst({
      where: {
        unitId: id,
        discordRoleId,
      },
    });

    if (existing) {
      res.status(400).json({ error: 'Diese Discord-Rolle ist bereits der Unit zugewiesen' });
      return;
    }

    const role = await prisma.unitRole.create({
      data: {
        unitId: id,
        discordRoleId,
        discordRoleName: discordRoleName || 'Unbekannte Rolle',
        position,
        sortOrder: sortOrder || 0,
        isLeadership: isLeadership || false,
      },
    });

    res.status(201).json(role);
  } catch (error) {
    console.error('Error adding unit role:', error);
    res.status(500).json({ error: 'Fehler beim Hinzufügen der Rolle' });
  }
});

// Rolle aktualisieren
router.put('/:id/roles/:roleId', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { roleId } = req.params;
    const { position, sortOrder, isLeadership } = req.body;

    const role = await prisma.unitRole.update({
      where: { id: roleId },
      data: {
        position,
        sortOrder,
        isLeadership,
      },
    });

    res.json(role);
  } catch (error) {
    console.error('Error updating unit role:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Rolle' });
  }
});

// Rolle entfernen
router.delete('/:id/roles/:roleId', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { roleId } = req.params;

    await prisma.unitRole.delete({
      where: { id: roleId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing unit role:', error);
    res.status(500).json({ error: 'Fehler beim Entfernen der Rolle' });
  }
});

export default router;
