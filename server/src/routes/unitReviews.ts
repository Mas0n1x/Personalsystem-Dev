import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { triggerUnitReviewCompleted, getEmployeeIdFromUserId } from '../services/bonusService.js';

const router = Router();

router.use(authMiddleware);

// Fallback Units (werden verwendet wenn keine in DB)
const FALLBACK_UNITS = [
  'Team Green',
  'Team Silver',
  'Team Gold',
  'Team Red',
  'Team White',
  'Human Resources',
  'Internal Affairs',
  'Police Academy',
  'Quality Assurance',
  'Detectives',
];

// Get units list (dynamisch aus DB oder Fallback)
router.get('/units', requirePermission('qa.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const dbUnits = await prisma.qAUnit.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { name: true },
    });

    if (dbUnits.length > 0) {
      res.json(dbUnits.map(u => u.name));
    } else {
      res.json(FALLBACK_UNITS);
    }
  } catch (error) {
    console.error('Get units error:', error);
    res.json(FALLBACK_UNITS);
  }
});

// Get stats
router.get('/stats', requirePermission('qa.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const [total, draft, submitted, reviewed] = await Promise.all([
      prisma.unitReview.count(),
      prisma.unitReview.count({ where: { status: 'DRAFT' } }),
      prisma.unitReview.count({ where: { status: 'SUBMITTED' } }),
      prisma.unitReview.count({ where: { status: 'REVIEWED' } }),
    ]);

    // Average rating
    const avgResult = await prisma.unitReview.aggregate({
      _avg: { rating: true },
      where: { status: { in: ['SUBMITTED', 'REVIEWED'] } }
    });

    res.json({
      total,
      draft,
      submitted,
      reviewed,
      averageRating: avgResult._avg.rating || 0
    });
  } catch (error) {
    console.error('Error fetching review stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get all reviews
router.get('/', requirePermission('qa.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { unit, status } = req.query;

    const where: Record<string, unknown> = {};
    if (unit) where.unit = unit;
    if (status) where.status = status;

    const reviews = await prisma.unitReview.findMany({
      where,
      orderBy: { reviewDate: 'desc' },
      include: {
        reviewer: {
          select: { id: true, displayName: true, username: true }
        }
      }
    });

    res.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get single review
router.get('/:id', requirePermission('qa.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const review = await prisma.unitReview.findUnique({
      where: { id },
      include: {
        reviewer: {
          select: { id: true, displayName: true, username: true }
        }
      }
    });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json(review);
  } catch (error) {
    console.error('Error fetching review:', error);
    res.status(500).json({ error: 'Failed to fetch review' });
  }
});

// Create review
router.post('/', requirePermission('qa.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { unit, reviewDate, rating, findings, recommendations } = req.body;
    const userId = req.user!.id;

    if (!unit || !reviewDate) {
      return res.status(400).json({ error: 'Unit and review date are required' });
    }

    const review = await prisma.unitReview.create({
      data: {
        unit,
        reviewDate: new Date(reviewDate),
        rating: rating ? parseInt(rating) : 3,
        findings,
        recommendations,
        reviewerId: userId,
      },
      include: {
        reviewer: {
          select: { id: true, displayName: true, username: true }
        }
      }
    });

    res.status(201).json(review);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Update review
router.put('/:id', requirePermission('qa.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { unit, reviewDate, rating, findings, recommendations, status } = req.body;

    // Hole vorherigen Status für Bonus-Trigger
    const previousReview = await prisma.unitReview.findUnique({
      where: { id },
      select: { status: true, unit: true, reviewerId: true }
    });

    const review = await prisma.unitReview.update({
      where: { id },
      data: {
        ...(unit && { unit }),
        ...(reviewDate && { reviewDate: new Date(reviewDate) }),
        ...(rating && { rating: parseInt(rating) }),
        ...(findings !== undefined && { findings }),
        ...(recommendations !== undefined && { recommendations }),
        ...(status && { status }),
      },
      include: {
        reviewer: {
          select: { id: true, displayName: true, username: true }
        }
      }
    });

    // Bonus-Trigger wenn Review auf REVIEWED gesetzt wird (erstmalig)
    if (status === 'REVIEWED' && previousReview?.status !== 'REVIEWED' && previousReview?.reviewerId) {
      const employeeId = await getEmployeeIdFromUserId(previousReview.reviewerId);
      if (employeeId) {
        await triggerUnitReviewCompleted(employeeId, previousReview.unit, id);
      }
    }

    res.json(review);
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// Delete review
router.delete('/:id', requirePermission('qa.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.unitReview.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// Get reviews by unit (for unit leaders to see their reviews)
router.get('/by-unit/:unit', requirePermission('qa.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { unit } = req.params;

    const reviews = await prisma.unitReview.findMany({
      where: {
        unit,
        status: { in: ['SUBMITTED', 'REVIEWED'] }
      },
      orderBy: { reviewDate: 'desc' },
      include: {
        reviewer: {
          select: { displayName: true, username: true }
        }
      }
    });

    res.json(reviews);
  } catch (error) {
    console.error('Error fetching unit reviews:', error);
    res.status(500).json({ error: 'Failed to fetch unit reviews' });
  }
});

export default router;
