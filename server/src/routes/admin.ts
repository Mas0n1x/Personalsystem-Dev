import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { getGuildInfo, syncAllRoles, syncDiscordMembers } from '../services/discordBot.js';

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
