import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { EvaluationType } from '@prisma/client';

const router = Router();

// ==================== BEWERTUNGEN ====================

// Alle Bewertungen abrufen
router.get('/evaluations', authMiddleware, requirePermission('ia.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, type, isPositive, page = '1', limit = '20' } = req.query;

    const where: {
      employeeId?: string;
      type?: EvaluationType;
      isPositive?: boolean;
    } = {};

    if (employeeId) where.employeeId = employeeId as string;
    if (type) where.type = type as EvaluationType;
    if (isPositive !== undefined) where.isPositive = isPositive === 'true';

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [evaluations, total] = await Promise.all([
      prisma.evaluation.findMany({
        where,
        include: {
          employee: true,
          evaluator: true,
        },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.evaluation.count({ where }),
    ]);

    res.json({
      data: evaluations,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get evaluations error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Bewertungen' });
  }
});

// Bewertung für einen Mitarbeiter abrufen
router.get('/evaluations/employee/:userId', authMiddleware, requirePermission('ia.view'), async (req: AuthRequest, res: Response) => {
  try {
    const evaluations = await prisma.evaluation.findMany({
      where: { employeeId: req.params.userId },
      include: { evaluator: true },
      orderBy: { createdAt: 'desc' },
    });

    // Durchschnittliche Bewertung berechnen
    const avgRating = evaluations.length > 0
      ? evaluations.reduce((sum, e) => sum + e.rating, 0) / evaluations.length
      : 0;

    const positiveCount = evaluations.filter(e => e.isPositive).length;
    const negativeCount = evaluations.filter(e => !e.isPositive).length;

    res.json({
      evaluations,
      stats: {
        total: evaluations.length,
        avgRating: Math.round(avgRating * 10) / 10,
        positiveCount,
        negativeCount,
      },
    });
  } catch (error) {
    console.error('Get employee evaluations error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Mitarbeiter-Bewertungen' });
  }
});

// Neue Bewertung erstellen
router.post('/evaluations', authMiddleware, requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, type, rating, comment, isPositive } = req.body;

    // Validierung
    if (rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Bewertung muss zwischen 1 und 5 liegen' });
      return;
    }

    const evaluation = await prisma.evaluation.create({
      data: {
        employeeId,
        evaluatorId: req.user!.id,
        type: type || 'PERFORMANCE',
        rating,
        comment,
        isPositive: isPositive ?? true,
      },
      include: {
        employee: true,
        evaluator: true,
      },
    });

    res.status(201).json(evaluation);
  } catch (error) {
    console.error('Create evaluation error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Bewertung' });
  }
});

// Verwarnung erstellen
router.post('/warnings', authMiddleware, requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, comment, severity } = req.body;

    const evaluation = await prisma.evaluation.create({
      data: {
        employeeId,
        evaluatorId: req.user!.id,
        type: 'WARNING',
        rating: severity || 1, // 1-5 Schweregrad
        comment,
        isPositive: false,
      },
      include: {
        employee: true,
        evaluator: true,
      },
    });

    res.status(201).json(evaluation);
  } catch (error) {
    console.error('Create warning error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Verwarnung' });
  }
});

// Belobigung erstellen
router.post('/commendations', authMiddleware, requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, comment } = req.body;

    const evaluation = await prisma.evaluation.create({
      data: {
        employeeId,
        evaluatorId: req.user!.id,
        type: 'COMMENDATION',
        rating: 5,
        comment,
        isPositive: true,
      },
      include: {
        employee: true,
        evaluator: true,
      },
    });

    res.status(201).json(evaluation);
  } catch (error) {
    console.error('Create commendation error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Belobigung' });
  }
});

// Bewertung aktualisieren
router.put('/evaluations/:id', authMiddleware, requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { rating, comment, isPositive } = req.body;

    const evaluation = await prisma.evaluation.update({
      where: { id: req.params.id },
      data: {
        rating,
        comment,
        isPositive,
      },
      include: {
        employee: true,
        evaluator: true,
      },
    });

    res.json(evaluation);
  } catch (error) {
    console.error('Update evaluation error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Bewertung' });
  }
});

// Bewertung löschen
router.delete('/evaluations/:id', authMiddleware, requirePermission('ia.manage'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.evaluation.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete evaluation error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Bewertung' });
  }
});

// IA Statistiken
router.get('/stats', authMiddleware, requirePermission('ia.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const [total, byType, avgRating] = await Promise.all([
      prisma.evaluation.count(),
      prisma.evaluation.groupBy({
        by: ['type'],
        _count: true,
      }),
      prisma.evaluation.aggregate({
        _avg: { rating: true },
      }),
    ]);

    res.json({
      total,
      avgRating: Math.round((avgRating._avg.rating || 0) * 10) / 10,
      byType: byType.reduce((acc, curr) => ({ ...acc, [curr.type]: curr._count }), {}),
    });
  } catch (error) {
    console.error('Get IA stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

export default router;
