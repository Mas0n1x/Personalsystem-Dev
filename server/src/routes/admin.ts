import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { sendAnnouncement, getGuildInfo, syncAllRoles } from '../services/discordBot.js';

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
      // Admin
      { name: 'admin.full', description: 'Vollzugriff auf alle Funktionen', category: 'admin' },

      // Users
      { name: 'users.view', description: 'Benutzer anzeigen', category: 'users' },
      { name: 'users.edit', description: 'Benutzer bearbeiten', category: 'users' },
      { name: 'users.delete', description: 'Benutzer löschen', category: 'users' },

      // Employees
      { name: 'employees.view', description: 'Mitarbeiter anzeigen', category: 'employees' },
      { name: 'employees.edit', description: 'Mitarbeiter bearbeiten', category: 'employees' },
      { name: 'employees.delete', description: 'Mitarbeiter entlassen', category: 'employees' },

      // HR
      { name: 'hr.view', description: 'HR-Bereich anzeigen', category: 'hr' },
      { name: 'hr.manage', description: 'HR-Bereich verwalten', category: 'hr' },
      { name: 'hr.applications', description: 'Bewerbungen verwalten', category: 'hr' },

      // IA
      { name: 'ia.view', description: 'IA-Bereich anzeigen', category: 'ia' },
      { name: 'ia.manage', description: 'IA-Bereich verwalten', category: 'ia' },
      { name: 'ia.investigate', description: 'Ermittlungen durchführen', category: 'ia' },

      // Academy
      { name: 'academy.view', description: 'Academy anzeigen', category: 'academy' },
      { name: 'academy.manage', description: 'Academy verwalten', category: 'academy' },
      { name: 'academy.teach', description: 'Trainings durchführen', category: 'academy' },

      // QA
      { name: 'qa.view', description: 'QA-Bereich anzeigen', category: 'qa' },
      { name: 'qa.manage', description: 'QA-Bereich verwalten', category: 'qa' },

      // Finance
      { name: 'finance.view', description: 'Finanzen anzeigen', category: 'finance' },
      { name: 'finance.manage', description: 'Finanzen verwalten', category: 'finance' },
      { name: 'finance.approve', description: 'Zahlungen genehmigen', category: 'finance' },

      // Announcements
      { name: 'announcements.view', description: 'Ankündigungen anzeigen', category: 'announcements' },
      { name: 'announcements.create', description: 'Ankündigungen erstellen', category: 'announcements' },
      { name: 'announcements.publish', description: 'Ankündigungen veröffentlichen', category: 'announcements' },

      // Audit
      { name: 'audit.view', description: 'Audit-Logs anzeigen', category: 'audit' },
      { name: 'backup.manage', description: 'Backups verwalten', category: 'backup' },
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

// ==================== ANKÜNDIGUNGEN ====================

router.get('/announcements', authMiddleware, requirePermission('announcements.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        include: { author: true },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.announcement.count(),
    ]);

    res.json({
      data: announcements,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Ankündigungen' });
  }
});

router.post('/announcements', authMiddleware, requirePermission('announcements.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, priority, discordChannelId } = req.body;

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        priority,
        discordChannelId,
        authorId: req.user!.id,
      },
      include: { author: true },
    });

    res.status(201).json(announcement);
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Ankündigung' });
  }
});

router.post('/announcements/:id/publish', authMiddleware, requirePermission('announcements.publish'), async (req: AuthRequest, res: Response) => {
  try {
    const announcement = await prisma.announcement.findUnique({
      where: { id: req.params.id },
    });

    if (!announcement) {
      res.status(404).json({ error: 'Ankündigung nicht gefunden' });
      return;
    }

    if (!announcement.discordChannelId) {
      res.status(400).json({ error: 'Kein Discord-Channel angegeben' });
      return;
    }

    // An Discord senden
    const messageId = await sendAnnouncement(
      announcement.discordChannelId,
      announcement.title,
      announcement.content,
      announcement.priority
    );

    // Aktualisieren
    const updated = await prisma.announcement.update({
      where: { id: req.params.id },
      data: {
        publishedAt: new Date(),
        discordMessageId: messageId,
      },
      include: { author: true },
    });

    res.json(updated);
  } catch (error) {
    console.error('Publish announcement error:', error);
    res.status(500).json({ error: 'Fehler beim Veröffentlichen der Ankündigung' });
  }
});

router.delete('/announcements/:id', authMiddleware, requirePermission('announcements.create'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.announcement.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Ankündigung' });
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
