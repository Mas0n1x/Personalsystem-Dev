import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import {
  getCurrentWeekStats,
  getHistoricalStats,
  incrementUnitActivity,
  ActivityType,
} from '../services/unitWorkService.js';

const router = Router();

// GET aktuelle Wochenstatistiken aller Units
router.get('/current', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const stats = await getCurrentWeekStats();
    res.json(stats);
  } catch (error) {
    console.error('Get current unit work stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Unit-Statistiken' });
  }
});

// GET historische Statistiken (Query: weeks=4)
router.get('/history', authMiddleware, requirePermission('leadership.view'), async (req: AuthRequest, res: Response) => {
  try {
    const weeks = parseInt(req.query.weeks as string) || 4;
    const stats = await getHistoricalStats(Math.min(weeks, 12)); // Max 12 Wochen
    res.json(stats);
  } catch (error) {
    console.error('Get historical unit work stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der historischen Statistiken' });
  }
});

// POST Aktivität für eine Unit erhöhen (intern genutzt)
router.post('/increment', authMiddleware, requirePermission('leadership.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { unitId, activityType, count } = req.body;

    if (!unitId || !activityType) {
      res.status(400).json({ error: 'unitId und activityType sind erforderlich' });
      return;
    }

    const validTypes: ActivityType[] = [
      'casesCompleted',
      'tasksCompleted',
      'trainingsCompleted',
      'investigationsCompleted',
      'applicationsProcessed',
    ];

    if (!validTypes.includes(activityType)) {
      res.status(400).json({ error: 'Ungültiger activityType' });
      return;
    }

    const log = await incrementUnitActivity(unitId, activityType, count || 1);
    res.json(log);
  } catch (error) {
    console.error('Increment unit activity error:', error);
    res.status(500).json({ error: 'Fehler beim Erhöhen der Aktivität' });
  }
});

export default router;
