import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { getGuildInfo, syncAllRoles, syncDiscordMembers } from '../services/discordBot.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// ==================== ROLLEN VERWALTUNG ====================

router.get('/roles', authMiddleware, requirePermission('admin.full'), async (_req: AuthRequest, res: Response) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: true,
        _count: { select: { users: true } },
      },
      orderBy: { level: 'desc' },
    });

    res.json(roles);
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Rollen' });
  }
});

router.post('/roles', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, displayName, color, discordRoleId, level, permissionIds } = req.body;

    const role = await prisma.role.create({
      data: {
        name,
        displayName,
        color,
        discordRoleId,
        level,
        permissions: permissionIds ? { connect: permissionIds.map((id: string) => ({ id })) } : undefined,
      },
      include: { permissions: true },
    });

    res.status(201).json(role);
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Rolle' });
  }
});

router.put('/roles/:id', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, displayName, color, discordRoleId, level, permissionIds } = req.body;

    const role = await prisma.role.update({
      where: { id: req.params.id },
      data: {
        name,
        displayName,
        color,
        discordRoleId,
        level,
        permissions: permissionIds ? { set: permissionIds.map((id: string) => ({ id })) } : undefined,
      },
      include: { permissions: true },
    });

    res.json(role);
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Rolle' });
  }
});

router.delete('/roles/:id', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.role.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Rolle' });
  }
});

// ==================== FIX PERMISSIONS (für eingeloggten User - ohne vorherige Berechtigungsprüfung) ====================

router.post('/fix-permissions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const username = req.user!.username;

    // Liste aller Standard-Berechtigungen
    const defaultPermissions = [
      { name: 'admin.full', description: 'Vollzugriff auf alle Funktionen', category: 'admin' },
      { name: 'users.view', description: 'Benutzer anzeigen', category: 'users' },
      { name: 'users.edit', description: 'Benutzer bearbeiten', category: 'users' },
      { name: 'users.delete', description: 'Benutzer löschen', category: 'users' },
      { name: 'employees.view', description: 'Mitarbeiter anzeigen', category: 'employees' },
      { name: 'employees.edit', description: 'Mitarbeiter bearbeiten', category: 'employees' },
      { name: 'employees.delete', description: 'Mitarbeiter entlassen', category: 'employees' },
      { name: 'audit.view', description: 'Audit-Logs anzeigen', category: 'audit' },
      { name: 'backup.manage', description: 'Backups verwalten', category: 'backup' },
      { name: 'leadership.view', description: 'Leadership-Bereich anzeigen', category: 'leadership' },
      { name: 'leadership.manage', description: 'Leadership-Bereich verwalten', category: 'leadership' },
      { name: 'treasury.view', description: 'Kasse anzeigen', category: 'treasury' },
      { name: 'treasury.manage', description: 'Kasse verwalten', category: 'treasury' },
      { name: 'sanctions.view', description: 'Sanktionen anzeigen', category: 'sanctions' },
      { name: 'sanctions.manage', description: 'Sanktionen verwalten', category: 'sanctions' },
      { name: 'evidence.view', description: 'Asservate anzeigen', category: 'evidence' },
      { name: 'evidence.manage', description: 'Asservate verwalten', category: 'evidence' },
      { name: 'tuning.view', description: 'Tuning-Rechnungen anzeigen', category: 'tuning' },
      { name: 'tuning.manage', description: 'Tuning-Rechnungen verwalten', category: 'tuning' },
      { name: 'robbery.view', description: 'Räube anzeigen', category: 'robbery' },
      { name: 'robbery.create', description: 'Räube erstellen', category: 'robbery' },
      { name: 'robbery.manage', description: 'Räube verwalten', category: 'robbery' },
      { name: 'calendar.view', description: 'Kalender anzeigen', category: 'calendar' },
      { name: 'calendar.manage', description: 'Termine verwalten', category: 'calendar' },
      { name: 'blacklist.view', description: 'Blacklist anzeigen', category: 'blacklist' },
      { name: 'blacklist.manage', description: 'Blacklist verwalten', category: 'blacklist' },
      { name: 'uprank.view', description: 'Uprank-Sperren anzeigen', category: 'uprank' },
      { name: 'uprank.manage', description: 'Uprank-Sperren verwalten', category: 'uprank' },
      { name: 'hr.view', description: 'Bewerbungen anzeigen', category: 'hr' },
      { name: 'hr.manage', description: 'Bewerbungen verwalten', category: 'hr' },
      { name: 'detectives.view', description: 'Ermittlungsakten anzeigen', category: 'detectives' },
      { name: 'detectives.manage', description: 'Ermittlungsakten verwalten', category: 'detectives' },
      { name: 'academy.view', description: 'Schulungen anzeigen', category: 'academy' },
      { name: 'academy.manage', description: 'Schulungen verwalten', category: 'academy' },
      { name: 'ia.view', description: 'Interne Ermittlungen anzeigen', category: 'ia' },
      { name: 'ia.manage', description: 'Interne Ermittlungen verwalten', category: 'ia' },
      { name: 'qa.view', description: 'Unit-Reviews anzeigen', category: 'qa' },
      { name: 'qa.manage', description: 'Unit-Reviews verwalten', category: 'qa' },
      { name: 'teamlead.view', description: 'Uprank-Anträge anzeigen', category: 'teamlead' },
      { name: 'teamlead.manage', description: 'Uprank-Anträge erstellen', category: 'teamlead' },
      { name: 'management.view', description: 'Management-Bereich anzeigen', category: 'management' },
      { name: 'management.uprank', description: 'Uprank-Anträge bearbeiten', category: 'management' },
      // Bonus/Sonderzahlungen Permissions
      { name: 'bonus.view', description: 'Sonderzahlungen anzeigen', category: 'bonus' },
      { name: 'bonus.manage', description: 'Sonderzahlungen verwalten', category: 'bonus' },
      { name: 'bonus.pay', description: 'Sonderzahlungen auszahlen', category: 'bonus' },
      // Admin Settings Permissions
      { name: 'admin.settings', description: 'System-Einstellungen verwalten', category: 'admin' },
    ];

    // Alle Berechtigungen erstellen/aktualisieren
    for (const perm of defaultPermissions) {
      await prisma.permission.upsert({
        where: { name: perm.name },
        update: perm,
        create: perm,
      });
    }

    // Admin-Berechtigung holen
    const adminPerm = await prisma.permission.findUnique({ where: { name: 'admin.full' } });

    // Admin-Rolle erstellen/aktualisieren mit admin.full Berechtigung
    const adminRole = await prisma.role.upsert({
      where: { name: 'admin' },
      update: {
        permissions: { connect: { id: adminPerm!.id } },
      },
      create: {
        name: 'admin',
        displayName: 'Administrator',
        color: '#ef4444',
        level: 100,
        permissions: { connect: { id: adminPerm!.id } },
      },
    });

    // Benutzer der Admin-Rolle zuweisen
    await prisma.user.update({
      where: { id: userId },
      data: { roleId: adminRole.id },
    });

    // Aktualisierte User-Daten laden
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: { permissions: true },
        },
      },
    });

    res.json({
      success: true,
      message: `Berechtigungen für ${username} repariert. Du bist jetzt Administrator mit allen Rechten.`,
      user: {
        id: updatedUser?.id,
        username: updatedUser?.username,
        role: updatedUser?.role?.name,
        permissions: updatedUser?.role?.permissions.map(p => p.name),
      },
      permissionsCreated: defaultPermissions.length,
    });
  } catch (error) {
    console.error('Fix permissions error:', error);
    res.status(500).json({ error: 'Fehler beim Reparieren der Berechtigungen' });
  }
});

// ==================== INITIAL SETUP (nur wenn keine Admins existieren) ====================

router.post('/setup', async (req, res: Response) => {
  try {
    const existingAdmin = await prisma.role.findFirst({
      where: { permissions: { some: { name: 'admin.full' } } },
      include: { users: true },
    });

    if (existingAdmin && existingAdmin.users.length > 0) {
      res.status(400).json({ error: 'Setup bereits abgeschlossen. Ein Admin existiert bereits.' });
      return;
    }

    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId erforderlich' });
      return;
    }

    const defaultPermissions = [
      { name: 'admin.full', description: 'Vollzugriff auf alle Funktionen', category: 'admin' },
      { name: 'users.view', description: 'Benutzer anzeigen', category: 'users' },
      { name: 'users.edit', description: 'Benutzer bearbeiten', category: 'users' },
      { name: 'users.delete', description: 'Benutzer löschen', category: 'users' },
      { name: 'employees.view', description: 'Mitarbeiter anzeigen', category: 'employees' },
      { name: 'employees.edit', description: 'Mitarbeiter bearbeiten', category: 'employees' },
      { name: 'employees.delete', description: 'Mitarbeiter entlassen', category: 'employees' },
      { name: 'audit.view', description: 'Audit-Logs anzeigen', category: 'audit' },
      { name: 'backup.manage', description: 'Backups verwalten', category: 'backup' },
      // Leadership Permissions
      { name: 'leadership.view', description: 'Leadership-Bereich anzeigen', category: 'leadership' },
      { name: 'leadership.manage', description: 'Leadership-Bereich verwalten', category: 'leadership' },
      { name: 'treasury.view', description: 'Kasse anzeigen', category: 'treasury' },
      { name: 'treasury.manage', description: 'Kasse verwalten', category: 'treasury' },
      { name: 'sanctions.view', description: 'Sanktionen anzeigen', category: 'sanctions' },
      { name: 'sanctions.manage', description: 'Sanktionen verwalten', category: 'sanctions' },
      // Evidence Permissions
      { name: 'evidence.view', description: 'Asservate anzeigen', category: 'evidence' },
      { name: 'evidence.manage', description: 'Asservate verwalten', category: 'evidence' },
      // Tuning Permissions
      { name: 'tuning.view', description: 'Tuning-Rechnungen anzeigen', category: 'tuning' },
      { name: 'tuning.manage', description: 'Tuning-Rechnungen verwalten', category: 'tuning' },
      // Robbery Permissions
      { name: 'robbery.view', description: 'Räube anzeigen', category: 'robbery' },
      { name: 'robbery.create', description: 'Räube erstellen', category: 'robbery' },
      { name: 'robbery.manage', description: 'Räube verwalten', category: 'robbery' },
      // Calendar Permissions
      { name: 'calendar.view', description: 'Kalender anzeigen', category: 'calendar' },
      { name: 'calendar.manage', description: 'Termine verwalten', category: 'calendar' },
      // Blacklist Permissions
      { name: 'blacklist.view', description: 'Blacklist anzeigen', category: 'blacklist' },
      { name: 'blacklist.manage', description: 'Blacklist verwalten', category: 'blacklist' },
      // Uprank-Sperren Permissions
      { name: 'uprank.view', description: 'Uprank-Sperren anzeigen', category: 'uprank' },
      { name: 'uprank.manage', description: 'Uprank-Sperren verwalten', category: 'uprank' },
      // HR/Bewerbungen Permissions
      { name: 'hr.view', description: 'Bewerbungen anzeigen', category: 'hr' },
      { name: 'hr.manage', description: 'Bewerbungen verwalten', category: 'hr' },
      // Detectives Permissions
      { name: 'detectives.view', description: 'Ermittlungsakten anzeigen', category: 'detectives' },
      { name: 'detectives.manage', description: 'Ermittlungsakten verwalten', category: 'detectives' },
      // Academy Permissions
      { name: 'academy.view', description: 'Schulungen anzeigen', category: 'academy' },
      { name: 'academy.manage', description: 'Schulungen verwalten', category: 'academy' },
      // Internal Affairs Permissions
      { name: 'ia.view', description: 'Interne Ermittlungen anzeigen', category: 'ia' },
      { name: 'ia.manage', description: 'Interne Ermittlungen verwalten', category: 'ia' },
      // Quality Assurance Permissions
      { name: 'qa.view', description: 'Unit-Reviews anzeigen', category: 'qa' },
      { name: 'qa.manage', description: 'Unit-Reviews verwalten', category: 'qa' },
      // Teamleitung Permissions
      { name: 'teamlead.view', description: 'Uprank-Anträge anzeigen', category: 'teamlead' },
      { name: 'teamlead.manage', description: 'Uprank-Anträge erstellen', category: 'teamlead' },
      // Management Permissions
      { name: 'management.view', description: 'Management-Bereich anzeigen', category: 'management' },
      { name: 'management.uprank', description: 'Uprank-Anträge bearbeiten', category: 'management' },
      // Bonus/Sonderzahlungen Permissions
      { name: 'bonus.view', description: 'Sonderzahlungen anzeigen', category: 'bonus' },
      { name: 'bonus.manage', description: 'Sonderzahlungen verwalten', category: 'bonus' },
      { name: 'bonus.pay', description: 'Sonderzahlungen auszahlen', category: 'bonus' },
      // Admin Settings Permissions
      { name: 'admin.settings', description: 'System-Einstellungen verwalten', category: 'admin' },
    ];

    for (const perm of defaultPermissions) {
      await prisma.permission.upsert({
        where: { name: perm.name },
        update: perm,
        create: perm,
      });
    }

    const adminPerm = await prisma.permission.findUnique({ where: { name: 'admin.full' } });

    const adminRole = await prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: {
        name: 'admin',
        displayName: 'Administrator',
        color: '#ef4444',
        level: 100,
        permissions: { connect: { id: adminPerm!.id } },
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { roleId: adminRole.id },
    });

    res.json({ success: true, message: 'Setup abgeschlossen. Du bist jetzt Administrator.' });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Setup fehlgeschlagen' });
  }
});

// ==================== BERECHTIGUNGEN ====================

router.get('/permissions', authMiddleware, requirePermission('admin.full'), async (_req: AuthRequest, res: Response) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    res.json(permissions);
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Berechtigungen' });
  }
});

router.post('/permissions/seed', authMiddleware, requirePermission('admin.full'), async (_req: AuthRequest, res: Response) => {
  try {
    const defaultPermissions = [
      { name: 'admin.full', description: 'Vollzugriff auf alle Funktionen', category: 'admin' },
      { name: 'users.view', description: 'Benutzer anzeigen', category: 'users' },
      { name: 'users.edit', description: 'Benutzer bearbeiten', category: 'users' },
      { name: 'users.delete', description: 'Benutzer löschen', category: 'users' },
      { name: 'employees.view', description: 'Mitarbeiter anzeigen', category: 'employees' },
      { name: 'employees.edit', description: 'Mitarbeiter bearbeiten', category: 'employees' },
      { name: 'employees.delete', description: 'Mitarbeiter entlassen', category: 'employees' },
      { name: 'audit.view', description: 'Audit-Logs anzeigen', category: 'audit' },
      { name: 'backup.manage', description: 'Backups verwalten', category: 'backup' },
      // Leadership Permissions
      { name: 'leadership.view', description: 'Leadership-Bereich anzeigen', category: 'leadership' },
      { name: 'leadership.manage', description: 'Leadership-Bereich verwalten', category: 'leadership' },
      { name: 'treasury.view', description: 'Kasse anzeigen', category: 'treasury' },
      { name: 'treasury.manage', description: 'Kasse verwalten', category: 'treasury' },
      { name: 'sanctions.view', description: 'Sanktionen anzeigen', category: 'sanctions' },
      { name: 'sanctions.manage', description: 'Sanktionen verwalten', category: 'sanctions' },
      // Evidence Permissions
      { name: 'evidence.view', description: 'Asservate anzeigen', category: 'evidence' },
      { name: 'evidence.manage', description: 'Asservate verwalten', category: 'evidence' },
      // Tuning Permissions
      { name: 'tuning.view', description: 'Tuning-Rechnungen anzeigen', category: 'tuning' },
      { name: 'tuning.manage', description: 'Tuning-Rechnungen verwalten', category: 'tuning' },
      // Robbery Permissions
      { name: 'robbery.view', description: 'Räube anzeigen', category: 'robbery' },
      { name: 'robbery.create', description: 'Räube erstellen', category: 'robbery' },
      { name: 'robbery.manage', description: 'Räube verwalten', category: 'robbery' },
      // Calendar Permissions
      { name: 'calendar.view', description: 'Kalender anzeigen', category: 'calendar' },
      { name: 'calendar.manage', description: 'Termine verwalten', category: 'calendar' },
      // Blacklist Permissions
      { name: 'blacklist.view', description: 'Blacklist anzeigen', category: 'blacklist' },
      { name: 'blacklist.manage', description: 'Blacklist verwalten', category: 'blacklist' },
      // Uprank-Sperren Permissions
      { name: 'uprank.view', description: 'Uprank-Sperren anzeigen', category: 'uprank' },
      { name: 'uprank.manage', description: 'Uprank-Sperren verwalten', category: 'uprank' },
      // HR/Bewerbungen Permissions
      { name: 'hr.view', description: 'Bewerbungen anzeigen', category: 'hr' },
      { name: 'hr.manage', description: 'Bewerbungen verwalten', category: 'hr' },
      // Detectives Permissions
      { name: 'detectives.view', description: 'Ermittlungsakten anzeigen', category: 'detectives' },
      { name: 'detectives.manage', description: 'Ermittlungsakten verwalten', category: 'detectives' },
      // Academy Permissions
      { name: 'academy.view', description: 'Schulungen anzeigen', category: 'academy' },
      { name: 'academy.manage', description: 'Schulungen verwalten', category: 'academy' },
      // Internal Affairs Permissions
      { name: 'ia.view', description: 'Interne Ermittlungen anzeigen', category: 'ia' },
      { name: 'ia.manage', description: 'Interne Ermittlungen verwalten', category: 'ia' },
      // Quality Assurance Permissions
      { name: 'qa.view', description: 'Unit-Reviews anzeigen', category: 'qa' },
      { name: 'qa.manage', description: 'Unit-Reviews verwalten', category: 'qa' },
      // Teamleitung Permissions
      { name: 'teamlead.view', description: 'Uprank-Anträge anzeigen', category: 'teamlead' },
      { name: 'teamlead.manage', description: 'Uprank-Anträge erstellen', category: 'teamlead' },
      // Management Permissions
      { name: 'management.view', description: 'Management-Bereich anzeigen', category: 'management' },
      { name: 'management.uprank', description: 'Uprank-Anträge bearbeiten', category: 'management' },
      // Bonus/Sonderzahlungen Permissions
      { name: 'bonus.view', description: 'Sonderzahlungen anzeigen', category: 'bonus' },
      { name: 'bonus.manage', description: 'Sonderzahlungen verwalten', category: 'bonus' },
      { name: 'bonus.pay', description: 'Sonderzahlungen auszahlen', category: 'bonus' },
      // Admin Settings Permissions
      { name: 'admin.settings', description: 'System-Einstellungen verwalten', category: 'admin' },
    ];

    for (const perm of defaultPermissions) {
      await prisma.permission.upsert({
        where: { name: perm.name },
        update: perm,
        create: perm,
      });
    }

    res.json({ success: true, count: defaultPermissions.length });
  } catch (error) {
    console.error('Seed permissions error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Berechtigungen' });
  }
});

// ==================== DISCORD ====================

router.get('/discord/info', authMiddleware, requirePermission('admin.full'), async (_req: AuthRequest, res: Response) => {
  try {
    const info = await getGuildInfo();
    res.json(info);
  } catch (error) {
    console.error('Get Discord info error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Discord-Informationen' });
  }
});

router.post('/discord/sync-roles', authMiddleware, requirePermission('admin.full'), async (_req: AuthRequest, res: Response) => {
  try {
    await syncAllRoles();
    res.json({ success: true });
  } catch (error) {
    console.error('Sync roles error:', error);
    res.status(500).json({ error: 'Fehler beim Synchronisieren der Rollen' });
  }
});

// Discord-Mitglieder als Mitarbeiter synchronisieren
router.post('/discord/sync-members', authMiddleware, requirePermission('admin.full'), async (_req: AuthRequest, res: Response) => {
  try {
    const result = await syncDiscordMembers();

    res.json({
      success: true,
      message: 'Synchronisation abgeschlossen',
      data: {
        created: result.created,
        updated: result.updated,
        removed: result.removed,
        total: result.total,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error('Sync members error:', error);
    res.status(500).json({ error: 'Fehler beim Synchronisieren der Discord-Mitglieder' });
  }
});

// ==================== AUDIT LOGS ====================

router.get('/audit-logs', authMiddleware, requirePermission('audit.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { entity, userId, action, startDate, endDate, page = '1', limit = '50' } = req.query;

    const where: {
      entity?: string;
      userId?: string;
      action?: { contains: string };
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    if (entity) where.entity = entity as string;
    if (userId) where.userId = userId as string;
    if (action) where.action = { contains: action as string };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: true },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      data: logs,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Audit-Logs' });
  }
});

// ==================== SYSTEM SETTINGS ====================

router.get('/settings', authMiddleware, requirePermission('admin.full'), async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.systemSetting.findMany();
    res.json(settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {}));
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Einstellungen' });
  }
});

router.put('/settings', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const settings = req.body;

    for (const [key, value] of Object.entries(settings)) {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: value as string },
        create: { key, value: value as string },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern der Einstellungen' });
  }
});

// ==================== BACKUPS ====================

// Backup-Ordner Pfad
const BACKUP_DIR = path.join(__dirname, '../../backups');
const DB_PATH = path.join(__dirname, '../../prisma/dev.db');

// Stelle sicher, dass der Backup-Ordner existiert
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Liste aller Backups
router.get('/backups', authMiddleware, requirePermission('backup.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [backups, total] = await Promise.all([
      prisma.backup.findMany({
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.backup.count(),
    ]);

    res.json({
      data: backups,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get backups error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Backups' });
  }
});

// Neues Backup erstellen
router.post('/backups', authMiddleware, requirePermission('backup.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { description } = req.body;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, filename);

    // Prüfe ob Datenbank existiert
    if (!fs.existsSync(DB_PATH)) {
      res.status(400).json({ error: 'Datenbank nicht gefunden' });
      return;
    }

    // Kopiere Datenbank
    fs.copyFileSync(DB_PATH, backupPath);

    // Dateigröße ermitteln
    const stats = fs.statSync(backupPath);
    const size = stats.size;

    // Backup in Datenbank speichern
    const backup = await prisma.backup.create({
      data: {
        filename,
        size,
        path: backupPath,
        status: 'COMPLETED',
      },
    });

    // Audit-Log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'BACKUP_CREATED',
        entity: 'Backup',
        entityId: backup.id,
        details: JSON.stringify({ filename, size, description }),
      },
    });

    res.status(201).json(backup);
  } catch (error) {
    console.error('Create backup error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Backups' });
  }
});

// Backup-Stats (MUSS vor /:id Routen stehen!)
router.get('/backups/stats', authMiddleware, requirePermission('backup.manage'), async (_req: AuthRequest, res: Response) => {
  try {
    const backups = await prisma.backup.findMany();
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    const latestBackup = await prisma.backup.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      totalBackups: backups.length,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      latestBackup: latestBackup?.createdAt || null,
    });
  } catch (error) {
    console.error('Get backup stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Backup-Statistiken' });
  }
});

// Backup herunterladen
router.get('/backups/:id/download', authMiddleware, requirePermission('backup.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const backup = await prisma.backup.findUnique({
      where: { id: req.params.id },
    });

    if (!backup) {
      res.status(404).json({ error: 'Backup nicht gefunden' });
      return;
    }

    // Prüfe ob Datei existiert
    if (!fs.existsSync(backup.path)) {
      res.status(404).json({ error: 'Backup-Datei nicht gefunden' });
      return;
    }

    res.download(backup.path, backup.filename);
  } catch (error) {
    console.error('Download backup error:', error);
    res.status(500).json({ error: 'Fehler beim Herunterladen des Backups' });
  }
});

// Backup wiederherstellen
router.post('/backups/:id/restore', authMiddleware, requirePermission('backup.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const backup = await prisma.backup.findUnique({
      where: { id: req.params.id },
    });

    if (!backup) {
      res.status(404).json({ error: 'Backup nicht gefunden' });
      return;
    }

    // Prüfe ob Backup-Datei existiert
    if (!fs.existsSync(backup.path)) {
      res.status(404).json({ error: 'Backup-Datei nicht gefunden' });
      return;
    }

    // Erstelle erst ein Backup der aktuellen Datenbank
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const preRestoreFilename = `pre_restore_${timestamp}.db`;
    const preRestorePath = path.join(BACKUP_DIR, preRestoreFilename);

    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, preRestorePath);
      const preRestoreStats = fs.statSync(preRestorePath);

      await prisma.backup.create({
        data: {
          filename: preRestoreFilename,
          size: preRestoreStats.size,
          path: preRestorePath,
          status: 'PRE_RESTORE',
        },
      });
    }

    // Kopiere Backup zur Datenbank (überschreibe)
    fs.copyFileSync(backup.path, DB_PATH);

    // Audit-Log (muss vor dem Disconnect geschrieben werden)
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'BACKUP_RESTORED',
        entity: 'Backup',
        entityId: backup.id,
        details: JSON.stringify({ filename: backup.filename, restoredAt: new Date() }),
      },
    });

    res.json({
      success: true,
      message: 'Backup wurde wiederhergestellt. Der Server muss möglicherweise neu gestartet werden.',
      preRestoreBackup: preRestoreFilename,
    });
  } catch (error) {
    console.error('Restore backup error:', error);
    res.status(500).json({ error: 'Fehler beim Wiederherstellen des Backups' });
  }
});

// Backup löschen
router.delete('/backups/:id', authMiddleware, requirePermission('backup.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const backup = await prisma.backup.findUnique({
      where: { id: req.params.id },
    });

    if (!backup) {
      res.status(404).json({ error: 'Backup nicht gefunden' });
      return;
    }

    // Lösche Datei wenn vorhanden
    if (fs.existsSync(backup.path)) {
      fs.unlinkSync(backup.path);
    }

    // Lösche aus Datenbank
    await prisma.backup.delete({
      where: { id: req.params.id },
    });

    // Audit-Log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'BACKUP_DELETED',
        entity: 'Backup',
        entityId: backup.id,
        details: JSON.stringify({ filename: backup.filename }),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete backup error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Backups' });
  }
});

// Hilfsfunktion für Dateigröße
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==================== ACADEMY QUESTIONS (Fragenkatalog) ====================

// Alle Fragen abrufen
router.get('/academy-questions', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const questions = await prisma.academyQuestion.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(questions);
  } catch (error) {
    console.error('Get academy questions error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Fragen' });
  }
});

// Alle Fragen abrufen (inkl. inaktive - nur Admin)
router.get('/academy-questions/all', authMiddleware, requirePermission('admin.full'), async (_req: AuthRequest, res: Response) => {
  try {
    const questions = await prisma.academyQuestion.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    res.json(questions);
  } catch (error) {
    console.error('Get all academy questions error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Fragen' });
  }
});

// Neue Frage erstellen
router.post('/academy-questions', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { question, sortOrder } = req.body;

    // Hole höchste sortOrder wenn nicht angegeben
    let order = sortOrder;
    if (order === undefined) {
      const maxOrder = await prisma.academyQuestion.findFirst({
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      order = (maxOrder?.sortOrder ?? -1) + 1;
    }

    const newQuestion = await prisma.academyQuestion.create({
      data: {
        question,
        sortOrder: order,
      },
    });

    res.status(201).json(newQuestion);
  } catch (error) {
    console.error('Create academy question error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Frage' });
  }
});

// Frage aktualisieren
router.put('/academy-questions/:id', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { question, sortOrder, isActive } = req.body;

    const updatedQuestion = await prisma.academyQuestion.update({
      where: { id: req.params.id },
      data: {
        question,
        sortOrder,
        isActive,
      },
    });

    res.json(updatedQuestion);
  } catch (error) {
    console.error('Update academy question error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Frage' });
  }
});

// Frage löschen
router.delete('/academy-questions/:id', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.academyQuestion.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete academy question error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Frage' });
  }
});

// Reihenfolge aktualisieren (Bulk-Update)
router.put('/academy-questions/reorder', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body; // Array von { id, sortOrder }

    for (const item of items) {
      await prisma.academyQuestion.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder academy questions error:', error);
    res.status(500).json({ error: 'Fehler beim Neuordnen der Fragen' });
  }
});

// ==================== ACADEMY CRITERIA (Einstellungskriterien) ====================

// Alle Kriterien abrufen
router.get('/academy-criteria', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const criteria = await prisma.academyCriterion.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(criteria);
  } catch (error) {
    console.error('Get academy criteria error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Kriterien' });
  }
});

// Alle Kriterien abrufen (inkl. inaktive - nur Admin)
router.get('/academy-criteria/all', authMiddleware, requirePermission('admin.full'), async (_req: AuthRequest, res: Response) => {
  try {
    const criteria = await prisma.academyCriterion.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    res.json(criteria);
  } catch (error) {
    console.error('Get all academy criteria error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Kriterien' });
  }
});

// Neues Kriterium erstellen
router.post('/academy-criteria', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, sortOrder } = req.body;

    // Hole höchste sortOrder wenn nicht angegeben
    let order = sortOrder;
    if (order === undefined) {
      const maxOrder = await prisma.academyCriterion.findFirst({
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      order = (maxOrder?.sortOrder ?? -1) + 1;
    }

    const newCriterion = await prisma.academyCriterion.create({
      data: {
        name,
        sortOrder: order,
      },
    });

    res.status(201).json(newCriterion);
  } catch (error) {
    console.error('Create academy criterion error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Kriteriums' });
  }
});

// Kriterium aktualisieren
router.put('/academy-criteria/:id', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, sortOrder, isActive } = req.body;

    const updatedCriterion = await prisma.academyCriterion.update({
      where: { id: req.params.id },
      data: {
        name,
        sortOrder,
        isActive,
      },
    });

    res.json(updatedCriterion);
  } catch (error) {
    console.error('Update academy criterion error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Kriteriums' });
  }
});

// Kriterium löschen
router.delete('/academy-criteria/:id', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.academyCriterion.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete academy criterion error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Kriteriums' });
  }
});

// Reihenfolge aktualisieren (Bulk-Update)
router.put('/academy-criteria/reorder', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body; // Array von { id, sortOrder }

    for (const item of items) {
      await prisma.academyCriterion.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder academy criteria error:', error);
    res.status(500).json({ error: 'Fehler beim Neuordnen der Kriterien' });
  }
});

// ==================== SYSTEM STATS ====================

router.get('/stats', authMiddleware, requirePermission('admin.full'), async (_req: AuthRequest, res: Response) => {
  try {
    const [users, employees, roles, auditLogs] = await Promise.all([
      prisma.user.count(),
      prisma.employee.count(),
      prisma.role.count(),
      prisma.auditLog.count(),
    ]);

    res.json({
      users,
      employees,
      roles,
      auditLogs,
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

export default router;
