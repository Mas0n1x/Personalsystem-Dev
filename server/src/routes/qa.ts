import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';

const router = Router();

// ==================== QUALITÄTSBERICHTE ====================

// Alle Berichte abrufen
router.get('/reports', authMiddleware, requirePermission('qa.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { unit, minRating, page = '1', limit = '20' } = req.query;

    const where: {
      unit?: string;
      rating?: { gte: number };
    } = {};

    if (unit) where.unit = unit as string;
    if (minRating) where.rating = { gte: parseInt(minRating as string) };

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [reports, total] = await Promise.all([
      prisma.qualityReport.findMany({
        where,
        include: { reviewer: true },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.qualityReport.count({ where }),
    ]);

    res.json({
      data: reports,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get QA reports error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Berichte' });
  }
});

// Einzelnen Bericht abrufen
router.get('/reports/:id', authMiddleware, requirePermission('qa.view'), async (req: AuthRequest, res: Response) => {
  try {
    const report = await prisma.qualityReport.findUnique({
      where: { id: req.params.id },
      include: { reviewer: true },
    });

    if (!report) {
      res.status(404).json({ error: 'Bericht nicht gefunden' });
      return;
    }

    res.json(report);
  } catch (error) {
    console.error('Get QA report error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Berichts' });
  }
});

// Neuen Bericht erstellen
router.post('/reports', authMiddleware, requirePermission('qa.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { unit, rating, report, suggestions } = req.body;

    // Validierung
    if (rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Bewertung muss zwischen 1 und 5 liegen' });
      return;
    }

    const qualityReport = await prisma.qualityReport.create({
      data: {
        unit,
        rating,
        report,
        suggestions,
        reviewerId: req.user!.id,
      },
      include: { reviewer: true },
    });

    res.status(201).json(qualityReport);
  } catch (error) {
    console.error('Create QA report error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Berichts' });
  }
});

// Bericht aktualisieren
router.put('/reports/:id', authMiddleware, requirePermission('qa.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { unit, rating, report, suggestions } = req.body;

    const qualityReport = await prisma.qualityReport.update({
      where: { id: req.params.id },
      data: {
        unit,
        rating,
        report,
        suggestions,
      },
      include: { reviewer: true },
    });

    res.json(qualityReport);
  } catch (error) {
    console.error('Update QA report error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Berichts' });
  }
});

// Bericht löschen
router.delete('/reports/:id', authMiddleware, requirePermission('qa.manage'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.qualityReport.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete QA report error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Berichts' });
  }
});

// Berichte nach Unit
router.get('/units/:unit', authMiddleware, requirePermission('qa.view'), async (req: AuthRequest, res: Response) => {
  try {
    const reports = await prisma.qualityReport.findMany({
      where: { unit: req.params.unit },
      include: { reviewer: true },
      orderBy: { createdAt: 'desc' },
    });

    // Durchschnittsbewertung berechnen
    const avgRating = reports.length > 0
      ? reports.reduce((sum, r) => sum + r.rating, 0) / reports.length
      : 0;

    res.json({
      unit: req.params.unit,
      reports,
      stats: {
        total: reports.length,
        avgRating: Math.round(avgRating * 10) / 10,
      },
    });
  } catch (error) {
    console.error('Get unit reports error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Unit-Berichte' });
  }
});

// Alle Units mit ihren Durchschnittsbewertungen
router.get('/units', authMiddleware, requirePermission('qa.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const unitStats = await prisma.qualityReport.groupBy({
      by: ['unit'],
      _avg: { rating: true },
      _count: true,
    });

    res.json(unitStats.map(stat => ({
      unit: stat.unit,
      avgRating: Math.round((stat._avg.rating || 0) * 10) / 10,
      reportCount: stat._count,
    })));
  } catch (error) {
    console.error('Get units error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Units' });
  }
});

// QA Statistiken
router.get('/stats', authMiddleware, requirePermission('qa.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const [total, avgRating, byUnit, thisMonth] = await Promise.all([
      prisma.qualityReport.count(),
      prisma.qualityReport.aggregate({
        _avg: { rating: true },
      }),
      prisma.qualityReport.groupBy({
        by: ['unit'],
        _avg: { rating: true },
        _count: true,
      }),
      prisma.qualityReport.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    res.json({
      total,
      thisMonth,
      avgRating: Math.round((avgRating._avg.rating || 0) * 10) / 10,
      byUnit: byUnit.map(u => ({
        unit: u.unit,
        avgRating: Math.round((u._avg.rating || 0) * 10) / 10,
        count: u._count,
      })),
    });
  } catch (error) {
    console.error('Get QA stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

export default router;
