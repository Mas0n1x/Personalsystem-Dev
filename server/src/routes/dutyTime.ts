import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import {
  getDutyTimeByDiscordId,
  getDutyTimesForDiscordIds,
  clearDutyTimeCache,
  isLeitstelleConfigured,
  fetchAllDutyTimes,
} from '../services/leitstelleService.js';

const router = Router();

// GET Prüfe ob Leitstelle-API konfiguriert ist
router.get('/status', authMiddleware, async (_req: AuthRequest, res: Response) => {
  res.json({
    configured: isLeitstelleConfigured(),
  });
});

// GET Dienstzeit für einen einzelnen Mitarbeiter
router.get('/employee/:employeeId', authMiddleware, requirePermission('employees.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.params;
    const { rangeStart } = req.query;

    // Hole Mitarbeiter mit Discord-ID
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        user: {
          select: { discordId: true },
        },
      },
    });

    if (!employee) {
      res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
      return;
    }

    if (!isLeitstelleConfigured()) {
      res.status(503).json({ error: 'Leitstelle-API nicht konfiguriert' });
      return;
    }

    const dutyTime = await getDutyTimeByDiscordId(
      employee.user.discordId,
      rangeStart as string | undefined
    );

    if (!dutyTime) {
      res.json({
        found: false,
        message: 'Keine Dienstzeiten gefunden',
        data: null,
      });
      return;
    }

    res.json({
      found: true,
      data: dutyTime,
    });
  } catch (error) {
    console.error('Get duty time error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Dienstzeiten' });
  }
});

// GET Eigene Dienstzeiten (für eingeloggten Benutzer)
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rangeStart } = req.query;

    // Hole User mit Discord-ID
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { discordId: true },
    });

    if (!user) {
      res.status(404).json({ error: 'Benutzer nicht gefunden' });
      return;
    }

    if (!isLeitstelleConfigured()) {
      res.status(503).json({ error: 'Leitstelle-API nicht konfiguriert' });
      return;
    }

    const dutyTime = await getDutyTimeByDiscordId(
      user.discordId,
      rangeStart as string | undefined
    );

    if (!dutyTime) {
      res.json({
        found: false,
        message: 'Keine Dienstzeiten gefunden',
        data: null,
      });
      return;
    }

    res.json({
      found: true,
      data: dutyTime,
    });
  } catch (error) {
    console.error('Get own duty time error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Dienstzeiten' });
  }
});

// GET Dienstzeiten für mehrere Mitarbeiter (Bulk)
router.post('/bulk', authMiddleware, requirePermission('employees.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeIds, rangeStart } = req.body;

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      res.status(400).json({ error: 'employeeIds Array erforderlich' });
      return;
    }

    // Limit auf 100 Mitarbeiter pro Anfrage
    if (employeeIds.length > 100) {
      res.status(400).json({ error: 'Maximal 100 Mitarbeiter pro Anfrage' });
      return;
    }

    // Hole Discord-IDs für alle Mitarbeiter
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: {
        user: {
          select: { discordId: true },
        },
      },
    });

    if (!isLeitstelleConfigured()) {
      res.status(503).json({ error: 'Leitstelle-API nicht konfiguriert' });
      return;
    }

    const discordIds = employees.map(e => e.user.discordId);
    const dutyTimes = await getDutyTimesForDiscordIds(discordIds, rangeStart);

    // Mapping von Employee-ID zu Dienstzeit
    const result: Record<string, unknown> = {};
    for (const employee of employees) {
      const dutyTime = dutyTimes.get(employee.user.discordId);
      result[employee.id] = dutyTime || null;
    }

    res.json({
      data: result,
    });
  } catch (error) {
    console.error('Get bulk duty times error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Dienstzeiten' });
  }
});

// GET Alle Dienstzeiten (für Übersicht/Statistiken)
router.get('/all', authMiddleware, requirePermission('leadership.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { rangeStart } = req.query;

    if (!isLeitstelleConfigured()) {
      res.status(503).json({ error: 'Leitstelle-API nicht konfiguriert' });
      return;
    }

    const response = await fetchAllDutyTimes(rangeStart as string | undefined);

    if (!response) {
      res.status(503).json({ error: 'Leitstelle-API nicht erreichbar' });
      return;
    }

    // Hole alle aktiven Mitarbeiter mit Discord-IDs
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: {
          select: { discordId: true, displayName: true, username: true },
        },
      },
    });

    // Erstelle ein Mapping von Discord-ID zu Employee
    const discordToEmployee = new Map(
      employees.map(e => [e.user.discordId, e])
    );

    // Filtere nur unsere Mitarbeiter und füge Employee-Infos hinzu
    const matchedData = response.data
      .filter(d => discordToEmployee.has(d.discord_id))
      .map(d => {
        const employee = discordToEmployee.get(d.discord_id)!;
        return {
          employeeId: employee.id,
          employeeName: employee.user.displayName || employee.user.username,
          badgeNumber: employee.badgeNumber,
          rank: employee.rank,
          ...d,
        };
      });

    res.json({
      total: matchedData.length,
      data: matchedData,
    });
  } catch (error) {
    console.error('Get all duty times error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Dienstzeiten' });
  }
});

// POST Cache leeren (Admin)
router.post('/clear-cache', authMiddleware, requirePermission('admin.full'), async (_req: AuthRequest, res: Response) => {
  clearDutyTimeCache();
  res.json({ success: true, message: 'Cache geleert' });
});

export default router;
