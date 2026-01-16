import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { notifyBonus } from '../services/notificationService.js';
import { broadcastCreate, broadcastUpdate, broadcastDelete } from '../services/socketService.js';

const router = Router();

// ==================== HELPER FUNCTIONS ====================

// Berechnet den Wochenstart (Montag 00:00) und Wochenende (Sonntag 23:59) für ein Datum
export function getWeekBounds(date: Date = new Date()): { weekStart: Date; weekEnd: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Montag als Wochenstart

  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

// Standard Bonus-Konfigurationen
const DEFAULT_BONUS_CONFIGS = [
  // HR
  { activityType: 'APPLICATION_COMPLETED', displayName: 'Bewerbung abgeschlossen', category: 'HR', amount: 0 },
  { activityType: 'APPLICATION_ONBOARDING', displayName: 'Onboarding durchgeführt', category: 'HR', amount: 0 },

  // Academy
  { activityType: 'TRAINING_CONDUCTED', displayName: 'Schulung durchgeführt', category: 'ACADEMY', amount: 0 },
  { activityType: 'TRAINING_PARTICIPATED', displayName: 'Schulung teilgenommen', category: 'ACADEMY', amount: 0 },
  { activityType: 'EXAM_CONDUCTED', displayName: 'Prüfung abgenommen', category: 'ACADEMY', amount: 0 },
  { activityType: 'RETRAINING_COMPLETED', displayName: 'Nachschulung durchgeführt', category: 'ACADEMY', amount: 0 },
  { activityType: 'ACADEMY_MODULE_COMPLETED', displayName: 'Ausbildungsmodul abgeschlossen', category: 'ACADEMY', amount: 0 },

  // Internal Affairs
  { activityType: 'INVESTIGATION_OPENED', displayName: 'IA Ermittlung eröffnet', category: 'IA', amount: 0 },
  { activityType: 'INVESTIGATION_CLOSED', displayName: 'IA Ermittlung abgeschlossen', category: 'IA', amount: 0 },
  { activityType: 'UNIT_REVIEW_COMPLETED', displayName: 'Unit-Überprüfung durchgeführt', category: 'IA', amount: 0 },

  // Detective
  { activityType: 'CASE_OPENED', displayName: 'Ermittlungsakte eröffnet', category: 'DETECTIVE', amount: 0 },
  { activityType: 'CASE_CLOSED', displayName: 'Ermittlungsakte abgeschlossen', category: 'DETECTIVE', amount: 0 },

  // General
  { activityType: 'ROBBERY_LEADER', displayName: 'Räuber-Einsatzleitung', category: 'GENERAL', amount: 0 },
  { activityType: 'ROBBERY_NEGOTIATOR', displayName: 'Räuber-Verhandlungsführung', category: 'GENERAL', amount: 0 },
  { activityType: 'EVIDENCE_STORED', displayName: 'Asservat eingelagert', category: 'GENERAL', amount: 0 },
  { activityType: 'SANCTION_ISSUED', displayName: 'Sanktion erteilt', category: 'GENERAL', amount: 0 },
];

// ==================== BONUS CONFIG ROUTES ====================

// GET alle Bonus-Konfigurationen
router.get('/config', authMiddleware, requirePermission('bonus.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const configs = await prisma.bonusConfig.findMany({
      orderBy: [{ category: 'asc' }, { displayName: 'asc' }],
    });
    res.json(configs);
  } catch (error) {
    console.error('Get bonus configs error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Bonus-Konfiguration' });
  }
});

// POST Initialisiere Standard-Konfigurationen (falls nicht vorhanden)
router.post('/config/init', authMiddleware, requirePermission('admin.full'), async (_req: AuthRequest, res: Response) => {
  try {
    let created = 0;

    for (const config of DEFAULT_BONUS_CONFIGS) {
      const existing = await prisma.bonusConfig.findUnique({
        where: { activityType: config.activityType },
      });

      if (!existing) {
        await prisma.bonusConfig.create({
          data: config,
        });
        created++;
      }
    }

    res.json({ message: `${created} Bonus-Konfigurationen erstellt`, created });
  } catch (error) {
    console.error('Init bonus configs error:', error);
    res.status(500).json({ error: 'Fehler beim Initialisieren der Bonus-Konfiguration' });
  }
});

// PUT Aktualisiere eine Bonus-Konfiguration
router.put('/config/:id', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, isActive, displayName, description } = req.body;

    const config = await prisma.bonusConfig.update({
      where: { id },
      data: {
        ...(amount !== undefined && { amount: parseInt(amount) }),
        ...(isActive !== undefined && { isActive }),
        ...(displayName && { displayName }),
        ...(description !== undefined && { description }),
      },
    });

    res.json(config);
  } catch (error) {
    console.error('Update bonus config error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Bonus-Konfiguration' });
  }
});

// POST Neue Bonus-Konfiguration erstellen
router.post('/config', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { activityType, displayName, description, amount, category, isActive } = req.body;

    if (!activityType || !displayName) {
      res.status(400).json({ error: 'activityType und displayName sind erforderlich' });
      return;
    }

    const config = await prisma.bonusConfig.create({
      data: {
        activityType,
        displayName,
        description: description || null,
        amount: parseInt(amount) || 0,
        category: category || 'GENERAL',
        isActive: isActive !== false,
      },
    });

    res.json(config);
  } catch (error) {
    console.error('Create bonus config error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Bonus-Konfiguration' });
  }
});

// DELETE Bonus-Konfiguration löschen
router.delete('/config/:id', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.bonusConfig.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete bonus config error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Bonus-Konfiguration' });
  }
});

// ==================== BONUS PAYMENT ROUTES ====================

// GET alle Bonus-Zahlungen (mit Filter)
router.get('/payments', authMiddleware, requirePermission('bonus.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { week, status, employeeId } = req.query;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    // Filter nach Woche
    if (week === 'current') {
      const { weekStart, weekEnd } = getWeekBounds();
      where.weekStart = weekStart;
      where.weekEnd = weekEnd;
    } else if (week) {
      // week ist ein ISO-Datum, finde die Woche dafür
      const { weekStart, weekEnd } = getWeekBounds(new Date(week as string));
      where.weekStart = weekStart;
      where.weekEnd = weekEnd;
    }

    const payments = await prisma.bonusPayment.findMany({
      where,
      include: {
        config: true,
        employee: {
          include: {
            user: {
              select: { username: true, displayName: true },
            },
          },
        },
        paidBy: {
          select: { username: true, displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(payments);
  } catch (error) {
    console.error('Get bonus payments error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Bonus-Zahlungen' });
  }
});

// GET Zusammenfassung für aktuelle Woche
router.get('/summary', authMiddleware, requirePermission('bonus.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { week } = req.query;

    let weekStart: Date, weekEnd: Date;

    if (week === 'current' || !week) {
      const bounds = getWeekBounds();
      weekStart = bounds.weekStart;
      weekEnd = bounds.weekEnd;
    } else {
      const bounds = getWeekBounds(new Date(week as string));
      weekStart = bounds.weekStart;
      weekEnd = bounds.weekEnd;
    }

    // Alle Zahlungen für diese Woche
    const payments = await prisma.bonusPayment.findMany({
      where: {
        weekStart,
        weekEnd,
      },
      include: {
        config: true,
        employee: {
          include: {
            user: {
              select: { username: true, displayName: true },
            },
          },
        },
      },
    });

    // Gruppiere nach Mitarbeiter
    const byEmployee: Record<string, {
      employeeId: string;
      employeeName: string;
      totalAmount: number;
      pendingAmount: number;
      paidAmount: number;
      activities: { type: string; displayName: string; amount: number; count: number }[];
    }> = {};

    for (const payment of payments) {
      const empId = payment.employeeId;
      const empName = payment.employee.user?.displayName || payment.employee.user?.username || 'Unbekannt';

      if (!byEmployee[empId]) {
        byEmployee[empId] = {
          employeeId: empId,
          employeeName: empName,
          totalAmount: 0,
          pendingAmount: 0,
          paidAmount: 0,
          activities: [],
        };
      }

      byEmployee[empId].totalAmount += payment.amount;

      if (payment.status === 'PENDING') {
        byEmployee[empId].pendingAmount += payment.amount;
      } else if (payment.status === 'PAID') {
        byEmployee[empId].paidAmount += payment.amount;
      }

      // Aktivitäten zählen
      const existingActivity = byEmployee[empId].activities.find(
        a => a.type === payment.config.activityType
      );

      if (existingActivity) {
        existingActivity.count++;
        existingActivity.amount += payment.amount;
      } else {
        byEmployee[empId].activities.push({
          type: payment.config.activityType,
          displayName: payment.config.displayName,
          amount: payment.amount,
          count: 1,
        });
      }
    }

    // Gesamtsummen
    const totals = {
      totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
      pendingAmount: payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0),
      paidAmount: payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0),
      paymentCount: payments.length,
      employeeCount: Object.keys(byEmployee).length,
    };

    res.json({
      weekStart,
      weekEnd,
      totals,
      byEmployee: Object.values(byEmployee).sort((a, b) => b.totalAmount - a.totalAmount),
    });
  } catch (error) {
    console.error('Get bonus summary error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Bonus-Zusammenfassung' });
  }
});

// GET Meine Bonus-Zahlungen (für Dashboard)
router.get('/my', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    // Finde den Employee für diesen User
    const employee = await prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      res.json({ payments: [], summary: { total: 0, pending: 0, paid: 0 } });
      return;
    }

    const { weekStart, weekEnd } = getWeekBounds();

    const payments = await prisma.bonusPayment.findMany({
      where: {
        employeeId: employee.id,
        weekStart,
        weekEnd,
      },
      include: {
        config: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const summary = {
      total: payments.reduce((sum, p) => sum + p.amount, 0),
      pending: payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0),
      paid: payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0),
      count: payments.length,
    };

    res.json({ payments, summary, weekStart, weekEnd });
  } catch (error) {
    console.error('Get my bonuses error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der eigenen Bonus-Zahlungen' });
  }
});

// POST Manueller Bonus hinzufügen
router.post('/payments', authMiddleware, requirePermission('bonus.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, configId, reason, referenceId, referenceType } = req.body;

    if (!employeeId || !configId) {
      res.status(400).json({ error: 'employeeId und configId sind erforderlich' });
      return;
    }

    const config = await prisma.bonusConfig.findUnique({
      where: { id: configId },
    });

    if (!config) {
      res.status(404).json({ error: 'Bonus-Konfiguration nicht gefunden' });
      return;
    }

    if (!config.isActive) {
      res.status(400).json({ error: 'Diese Bonus-Art ist deaktiviert' });
      return;
    }

    const { weekStart, weekEnd } = getWeekBounds();

    const payment = await prisma.bonusPayment.create({
      data: {
        configId,
        employeeId,
        amount: config.amount,
        reason: reason || null,
        referenceId: referenceId || null,
        referenceType: referenceType || null,
        weekStart,
        weekEnd,
      },
      include: {
        config: true,
        employee: {
          include: {
            user: { select: { username: true, displayName: true } },
          },
        },
      },
    });

    // WebSocket Broadcast für Live-Updates
    broadcastCreate('bonus', payment);

    res.json(payment);
  } catch (error) {
    console.error('Create bonus payment error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Bonus-Zahlung' });
  }
});

// PUT Bonus-Zahlung als bezahlt markieren
router.put('/payments/:id/pay', authMiddleware, requirePermission('bonus.pay'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const payment = await prisma.bonusPayment.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paidById: userId,
      },
    });

    // WebSocket Broadcast für Live-Updates
    broadcastUpdate('bonus', payment);

    res.json(payment);
  } catch (error) {
    console.error('Pay bonus error:', error);
    res.status(500).json({ error: 'Fehler beim Bezahlen des Bonus' });
  }
});

// PUT Alle offenen Zahlungen eines Mitarbeiters bezahlen
router.put('/payments/pay-employee/:employeeId', authMiddleware, requirePermission('bonus.pay'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.params;
    const { week } = req.body;
    const userId = req.user?.id;

    let weekStart: Date, weekEnd: Date;

    if (week) {
      const bounds = getWeekBounds(new Date(week));
      weekStart = bounds.weekStart;
      weekEnd = bounds.weekEnd;
    } else {
      const bounds = getWeekBounds();
      weekStart = bounds.weekStart;
      weekEnd = bounds.weekEnd;
    }

    // Zuerst offene Zahlungen holen für Notification
    const pendingPayments = await prisma.bonusPayment.findMany({
      where: {
        employeeId,
        weekStart,
        weekEnd,
        status: 'PENDING',
      },
      include: {
        employee: { select: { userId: true } },
        config: { select: { displayName: true } },
      },
    });

    const result = await prisma.bonusPayment.updateMany({
      where: {
        employeeId,
        weekStart,
        weekEnd,
        status: 'PENDING',
      },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paidById: userId,
      },
    });

    // Benachrichtigung senden wenn Zahlungen vorhanden
    if (pendingPayments.length > 0 && result.count > 0) {
      const totalAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
      const paidByUser = await prisma.user.findUnique({
        where: { id: userId! },
        select: { displayName: true, username: true },
      });
      const paidByName = paidByUser?.displayName || paidByUser?.username || 'Unbekannt';
      const reasons = pendingPayments.map(p => p.config.displayName).join(', ');

      await notifyBonus(
        pendingPayments[0].employee.userId,
        totalAmount,
        reasons,
        paidByName
      );

      // WebSocket Broadcast für Live-Updates
      broadcastUpdate('bonus', { employeeId, status: 'PAID', count: result.count });
    }

    res.json({ success: true, updated: result.count });
  } catch (error) {
    console.error('Pay employee bonuses error:', error);
    res.status(500).json({ error: 'Fehler beim Bezahlen der Bonus-Zahlungen' });
  }
});

// PUT Alle offenen Zahlungen einer Woche bezahlen
router.put('/payments/pay-all', authMiddleware, requirePermission('bonus.pay'), async (req: AuthRequest, res: Response) => {
  try {
    const { week } = req.body;
    const userId = req.user?.id;

    let weekStart: Date, weekEnd: Date;

    if (week) {
      const bounds = getWeekBounds(new Date(week));
      weekStart = bounds.weekStart;
      weekEnd = bounds.weekEnd;
    } else {
      const bounds = getWeekBounds();
      weekStart = bounds.weekStart;
      weekEnd = bounds.weekEnd;
    }

    const result = await prisma.bonusPayment.updateMany({
      where: {
        weekStart,
        weekEnd,
        status: 'PENDING',
      },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paidById: userId,
      },
    });

    // WebSocket Broadcast für Live-Updates
    if (result.count > 0) {
      broadcastUpdate('bonus', { type: 'pay-all', status: 'PAID', count: result.count });
    }

    res.json({ success: true, updated: result.count });
  } catch (error) {
    console.error('Pay all bonuses error:', error);
    res.status(500).json({ error: 'Fehler beim Bezahlen aller Bonus-Zahlungen' });
  }
});

// DELETE Bonus-Zahlung stornieren
router.delete('/payments/:id', authMiddleware, requirePermission('bonus.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const payment = await prisma.bonusPayment.findUnique({
      where: { id },
    });

    if (!payment) {
      res.status(404).json({ error: 'Bonus-Zahlung nicht gefunden' });
      return;
    }

    if (payment.status === 'PAID') {
      res.status(400).json({ error: 'Bereits bezahlte Bonus-Zahlungen können nicht storniert werden' });
      return;
    }

    await prisma.bonusPayment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // WebSocket Broadcast für Live-Updates
    broadcastDelete('bonus', id);

    res.json({ success: true });
  } catch (error) {
    console.error('Cancel bonus payment error:', error);
    res.status(500).json({ error: 'Fehler beim Stornieren der Bonus-Zahlung' });
  }
});

// ==================== BONUS WEEK ROUTES ====================

// GET alle Wochen
router.get('/weeks', authMiddleware, requirePermission('bonus.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const weeks = await prisma.bonusWeek.findMany({
      orderBy: { weekStart: 'desc' },
      take: 12, // Letzte 12 Wochen
    });

    res.json(weeks);
  } catch (error) {
    console.error('Get bonus weeks error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Bonus-Wochen' });
  }
});

// POST Woche an Management senden
router.post('/weeks/submit', authMiddleware, requirePermission('bonus.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { week } = req.body;

    let weekStart: Date, weekEnd: Date;

    if (week) {
      const bounds = getWeekBounds(new Date(week));
      weekStart = bounds.weekStart;
      weekEnd = bounds.weekEnd;
    } else {
      const bounds = getWeekBounds();
      weekStart = bounds.weekStart;
      weekEnd = bounds.weekEnd;
    }

    // Berechne Gesamtbetrag
    const payments = await prisma.bonusPayment.findMany({
      where: {
        weekStart,
        weekEnd,
        status: 'PENDING',
      },
    });

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    // Erstelle oder aktualisiere BonusWeek
    const bonusWeek = await prisma.bonusWeek.upsert({
      where: {
        weekStart_weekEnd: { weekStart, weekEnd },
      },
      create: {
        weekStart,
        weekEnd,
        status: 'CLOSED',
        totalAmount,
        closedAt: new Date(),
        submittedToManagement: true,
        submittedAt: new Date(),
      },
      update: {
        status: 'CLOSED',
        totalAmount,
        closedAt: new Date(),
        submittedToManagement: true,
        submittedAt: new Date(),
      },
    });

    res.json(bonusWeek);
  } catch (error) {
    console.error('Submit bonus week error:', error);
    res.status(500).json({ error: 'Fehler beim Einreichen der Bonus-Woche' });
  }
});

// ==================== AUTOMATISCHE BONUS-ERSTELLUNG ====================

// Hilfsfunktion zum automatischen Erstellen eines Bonus
export async function createBonusPayment(
  activityType: string,
  employeeId: string,
  reason?: string,
  referenceId?: string,
  referenceType?: string
): Promise<boolean> {
  try {
    // Finde die Konfiguration
    const config = await prisma.bonusConfig.findUnique({
      where: { activityType },
    });

    if (!config || !config.isActive || config.amount <= 0) {
      return false; // Kein Bonus konfiguriert oder deaktiviert
    }

    const { weekStart, weekEnd } = getWeekBounds();

    // Erstelle die Zahlung
    await prisma.bonusPayment.create({
      data: {
        configId: config.id,
        employeeId,
        amount: config.amount,
        reason: reason || null,
        referenceId: referenceId || null,
        referenceType: referenceType || null,
        weekStart,
        weekEnd,
      },
    });

    console.log(`Bonus created: ${activityType} for employee ${employeeId}, amount: ${config.amount}`);
    return true;
  } catch (error) {
    console.error('Error creating bonus payment:', error);
    return false;
  }
}

export default router;
