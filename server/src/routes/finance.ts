import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { TransactionType, EvidenceStatus, RobberyStatus, PaymentStatus, AbsenceType, AbsenceStatus } from '@prisma/client';

const router = Router();

// ==================== TRANSAKTIONEN (KASSE) ====================

router.get('/transactions', authMiddleware, requirePermission('finance.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { type, category, startDate, endDate, page = '1', limit = '20' } = req.query;

    const where: {
      type?: TransactionType;
      category?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    if (type) where.type = type as TransactionType;
    if (category) where.category = category as string;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [transactions, total, summary] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { user: true },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.groupBy({
        by: ['type'],
        where,
        _sum: { amount: true },
      }),
    ]);

    const income = summary.find(s => s.type === 'INCOME')?._sum.amount || 0;
    const expense = summary.find(s => s.type === 'EXPENSE')?._sum.amount || 0;

    res.json({
      data: transactions,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
      summary: { income, expense, balance: income - expense },
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Transaktionen' });
  }
});

router.post('/transactions', authMiddleware, requirePermission('finance.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { type, amount, category, description, reference } = req.body;

    const transaction = await prisma.transaction.create({
      data: {
        type,
        amount,
        category,
        description,
        reference,
        userId: req.user!.id,
      },
      include: { user: true },
    });

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Transaktion' });
  }
});

// ==================== ASSERVATEN ====================

router.get('/evidence', authMiddleware, requirePermission('finance.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, page = '1', limit = '20' } = req.query;

    const where: {
      status?: EvidenceStatus;
      OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; caseNumber?: { contains: string; mode: 'insensitive' } }>;
    } = {};

    if (status) where.status = status as EvidenceStatus;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { caseNumber: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [evidence, total] = await Promise.all([
      prisma.evidence.findMany({
        where,
        include: {
          logs: {
            include: { user: true },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.evidence.count({ where }),
    ]);

    res.json({
      data: evidence,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get evidence error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Asservaten' });
  }
});

router.post('/evidence', authMiddleware, requirePermission('finance.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, value, location, caseNumber } = req.body;

    const evidence = await prisma.evidence.create({
      data: {
        name,
        description,
        value,
        location,
        caseNumber,
        logs: {
          create: {
            action: 'IN',
            userId: req.user!.id,
            notes: 'Initial Eingang',
          },
        },
      },
      include: { logs: { include: { user: true } } },
    });

    res.status(201).json(evidence);
  } catch (error) {
    console.error('Create evidence error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Asservats' });
  }
});

router.post('/evidence/:id/log', authMiddleware, requirePermission('finance.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { action, notes } = req.body;

    // Status basierend auf Aktion aktualisieren
    const statusMap: Record<string, EvidenceStatus> = {
      'IN': 'IN_STORAGE',
      'OUT': 'CHECKED_OUT',
      'RELEASED': 'RELEASED',
      'DESTROYED': 'DESTROYED',
    };

    const [log, evidence] = await Promise.all([
      prisma.evidenceLog.create({
        data: {
          evidenceId: req.params.id,
          action,
          notes,
          userId: req.user!.id,
        },
        include: { user: true },
      }),
      prisma.evidence.update({
        where: { id: req.params.id },
        data: { status: statusMap[action] || 'IN_STORAGE' },
      }),
    ]);

    res.json({ log, evidence });
  } catch (error) {
    console.error('Create evidence log error:', error);
    res.status(500).json({ error: 'Fehler beim Protokollieren' });
  }
});

// ==================== RAUBDOKUMENTATION ====================

router.get('/robberies', authMiddleware, requirePermission('finance.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, startDate, endDate, page = '1', limit = '20' } = req.query;

    const where: {
      status?: RobberyStatus;
      date?: { gte?: Date; lte?: Date };
    } = {};

    if (status) where.status = status as RobberyStatus;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [robberies, total, totalDamage] = await Promise.all([
      prisma.robberyReport.findMany({
        where,
        include: { reporter: true },
        skip,
        take: parseInt(limit as string),
        orderBy: { date: 'desc' },
      }),
      prisma.robberyReport.count({ where }),
      prisma.robberyReport.aggregate({ where, _sum: { damage: true } }),
    ]);

    res.json({
      data: robberies,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
      totalDamage: totalDamage._sum.damage || 0,
    });
  } catch (error) {
    console.error('Get robberies error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Raubberichte' });
  }
});

router.post('/robberies', authMiddleware, requirePermission('finance.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { date, location, damage, description, suspects } = req.body;

    const robbery = await prisma.robberyReport.create({
      data: {
        date: date ? new Date(date) : new Date(),
        location,
        damage,
        description,
        suspects,
        reporterId: req.user!.id,
      },
      include: { reporter: true },
    });

    res.status(201).json(robbery);
  } catch (error) {
    console.error('Create robbery error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Raubberichts' });
  }
});

router.put('/robberies/:id', authMiddleware, requirePermission('finance.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, location, damage, description, suspects } = req.body;

    const robbery = await prisma.robberyReport.update({
      where: { id: req.params.id },
      data: { status, location, damage, description, suspects },
      include: { reporter: true },
    });

    res.json(robbery);
  } catch (error) {
    console.error('Update robbery error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Raubberichts' });
  }
});

// ==================== SONDERZAHLUNGEN ====================

router.get('/special-payments', authMiddleware, requirePermission('finance.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, userId, page = '1', limit = '20' } = req.query;

    const where: { status?: PaymentStatus; userId?: string } = {};
    if (status) where.status = status as PaymentStatus;
    if (userId) where.userId = userId as string;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [payments, total] = await Promise.all([
      prisma.specialPayment.findMany({
        where,
        include: { user: true },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.specialPayment.count({ where }),
    ]);

    res.json({
      data: payments,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get special payments error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Sonderzahlungen' });
  }
});

router.post('/special-payments', authMiddleware, requirePermission('finance.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId, amount, reason } = req.body;

    const payment = await prisma.specialPayment.create({
      data: { userId, amount, reason },
      include: { user: true },
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Create special payment error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Sonderzahlung' });
  }
});

router.post('/special-payments/:id/approve', authMiddleware, requirePermission('finance.approve'), async (req: AuthRequest, res: Response) => {
  try {
    const payment = await prisma.specialPayment.update({
      where: { id: req.params.id },
      data: {
        status: 'APPROVED',
        approvedBy: req.user!.id,
        approvedAt: new Date(),
      },
      include: { user: true },
    });

    res.json(payment);
  } catch (error) {
    console.error('Approve payment error:', error);
    res.status(500).json({ error: 'Fehler beim Genehmigen der Sonderzahlung' });
  }
});

// ==================== ABMELDUNGEN ====================

router.get('/absences', authMiddleware, requirePermission('finance.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, type, userId, page = '1', limit = '20' } = req.query;

    const where: { status?: AbsenceStatus; type?: AbsenceType; userId?: string } = {};
    if (status) where.status = status as AbsenceStatus;
    if (type) where.type = type as AbsenceType;
    if (userId) where.userId = userId as string;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [absences, total] = await Promise.all([
      prisma.absence.findMany({
        where,
        include: { user: true },
        skip,
        take: parseInt(limit as string),
        orderBy: { startDate: 'desc' },
      }),
      prisma.absence.count({ where }),
    ]);

    res.json({
      data: absences,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get absences error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Abmeldungen' });
  }
});

router.post('/absences', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { type, startDate, endDate, reason } = req.body;

    const absence = await prisma.absence.create({
      data: {
        userId: req.user!.id,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
      },
      include: { user: true },
    });

    res.status(201).json(absence);
  } catch (error) {
    console.error('Create absence error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Abmeldung' });
  }
});

router.post('/absences/:id/approve', authMiddleware, requirePermission('finance.approve'), async (req: AuthRequest, res: Response) => {
  try {
    const absence = await prisma.absence.update({
      where: { id: req.params.id },
      data: {
        status: 'APPROVED',
        approvedBy: req.user!.id,
        approvedAt: new Date(),
      },
      include: { user: true },
    });

    res.json(absence);
  } catch (error) {
    console.error('Approve absence error:', error);
    res.status(500).json({ error: 'Fehler beim Genehmigen der Abmeldung' });
  }
});

// ==================== TUNINGSRECHNUNGEN ====================

router.get('/tuning-invoices', authMiddleware, requirePermission('finance.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [invoices, total] = await Promise.all([
      prisma.tuningInvoice.findMany({
        include: { user: true },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tuningInvoice.count(),
    ]);

    res.json({
      data: invoices,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get tuning invoices error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Tuningsrechnungen' });
  }
});

router.post('/tuning-invoices', authMiddleware, requirePermission('finance.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { vehicle, licensePlate, amount, description } = req.body;

    const invoice = await prisma.tuningInvoice.create({
      data: {
        vehicle,
        licensePlate,
        amount,
        description,
        userId: req.user!.id,
      },
      include: { user: true },
    });

    res.status(201).json(invoice);
  } catch (error) {
    console.error('Create tuning invoice error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Tuningsrechnung' });
  }
});

// ==================== FINANZ-STATISTIKEN ====================

router.get('/stats', authMiddleware, requirePermission('finance.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [transactions, evidence, robberies, payments, absences] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['type'],
        where: { createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.evidence.groupBy({ by: ['status'], _count: true }),
      prisma.robberyReport.aggregate({
        where: { date: { gte: startOfMonth } },
        _sum: { damage: true },
        _count: true,
      }),
      prisma.specialPayment.count({ where: { status: 'PENDING' } }),
      prisma.absence.count({ where: { status: 'PENDING' } }),
    ]);

    const income = transactions.find(t => t.type === 'INCOME')?._sum.amount || 0;
    const expenses = transactions.find(t => t.type === 'EXPENSE')?._sum.amount || 0;

    res.json({
      monthlyIncome: income,
      monthlyExpenses: expenses,
      monthlyBalance: income - expenses,
      evidenceByStatus: evidence.reduce((acc, e) => ({ ...acc, [e.status]: e._count }), {}),
      monthlyRobberies: robberies._count,
      monthlyRobberyDamage: robberies._sum.damage || 0,
      pendingPayments: payments,
      pendingAbsences: absences,
    });
  } catch (error) {
    console.error('Get finance stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

export default router;
