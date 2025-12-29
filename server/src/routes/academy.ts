import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { TrainingType, TrainingStatus } from '@prisma/client';

const router = Router();

// ==================== TRAININGS ====================

// Alle Trainings abrufen
router.get('/trainings', authMiddleware, requirePermission('academy.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { type, status, tutorId, page = '1', limit = '20' } = req.query;

    const where: {
      type?: TrainingType;
      status?: TrainingStatus;
      tutorId?: string;
    } = {};

    if (type) where.type = type as TrainingType;
    if (status) where.status = status as TrainingStatus;
    if (tutorId) where.tutorId = tutorId as string;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [trainings, total] = await Promise.all([
      prisma.training.findMany({
        where,
        include: {
          tutor: true,
          participants: {
            include: { user: true },
          },
        },
        skip,
        take: parseInt(limit as string),
        orderBy: { scheduledAt: 'desc' },
      }),
      prisma.training.count({ where }),
    ]);

    res.json({
      data: trainings,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get trainings error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Trainings' });
  }
});

// Einzelnes Training abrufen
router.get('/trainings/:id', authMiddleware, requirePermission('academy.view'), async (req: AuthRequest, res: Response) => {
  try {
    const training = await prisma.training.findUnique({
      where: { id: req.params.id },
      include: {
        tutor: true,
        participants: {
          include: { user: true },
        },
      },
    });

    if (!training) {
      res.status(404).json({ error: 'Training nicht gefunden' });
      return;
    }

    res.json(training);
  } catch (error) {
    console.error('Get training error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Trainings' });
  }
});

// Neues Training erstellen
router.post('/trainings', authMiddleware, requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, type, scheduledAt, maxParticipants } = req.body;

    const training = await prisma.training.create({
      data: {
        name,
        description,
        type: type || 'BASIC',
        tutorId: req.user!.id,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        maxParticipants,
      },
      include: {
        tutor: true,
      },
    });

    res.status(201).json(training);
  } catch (error) {
    console.error('Create training error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Trainings' });
  }
});

// Training aktualisieren
router.put('/trainings/:id', authMiddleware, requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, type, status, scheduledAt, completedAt, maxParticipants } = req.body;

    const training = await prisma.training.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        type,
        status,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        completedAt: completedAt ? new Date(completedAt) : undefined,
        maxParticipants,
      },
      include: {
        tutor: true,
        participants: {
          include: { user: true },
        },
      },
    });

    res.json(training);
  } catch (error) {
    console.error('Update training error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Trainings' });
  }
});

// Training löschen
router.delete('/trainings/:id', authMiddleware, requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.training.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete training error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Trainings' });
  }
});

// ==================== TEILNEHMER ====================

// Teilnehmer zu Training hinzufügen
router.post('/trainings/:id/participants', authMiddleware, requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.body;
    const trainingId = req.params.id;

    // Prüfen ob Training existiert
    const training = await prisma.training.findUnique({
      where: { id: trainingId },
      include: { participants: true },
    });

    if (!training) {
      res.status(404).json({ error: 'Training nicht gefunden' });
      return;
    }

    // Prüfen ob max Teilnehmer erreicht
    if (training.maxParticipants && training.participants.length >= training.maxParticipants) {
      res.status(400).json({ error: 'Maximale Teilnehmerzahl erreicht' });
      return;
    }

    const participant = await prisma.trainingParticipant.create({
      data: {
        trainingId,
        userId,
      },
      include: { user: true },
    });

    res.status(201).json(participant);
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(500).json({ error: 'Fehler beim Hinzufügen des Teilnehmers' });
  }
});

// Teilnehmer entfernen
router.delete('/trainings/:id/participants/:participantId', authMiddleware, requirePermission('academy.manage'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.trainingParticipant.delete({
      where: { id: req.params.participantId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({ error: 'Fehler beim Entfernen des Teilnehmers' });
  }
});

// Teilnehmer-Ergebnis aktualisieren
router.put('/trainings/:id/participants/:participantId', authMiddleware, requirePermission('academy.teach'), async (req: AuthRequest, res: Response) => {
  try {
    const { passed, grade, notes } = req.body;

    const participant = await prisma.trainingParticipant.update({
      where: { id: req.params.participantId },
      data: {
        passed,
        grade,
        notes,
      },
      include: { user: true },
    });

    res.json(participant);
  } catch (error) {
    console.error('Update participant error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Teilnehmers' });
  }
});

// Training abschließen
router.post('/trainings/:id/complete', authMiddleware, requirePermission('academy.teach'), async (req: AuthRequest, res: Response) => {
  try {
    const training = await prisma.training.update({
      where: { id: req.params.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      include: {
        tutor: true,
        participants: {
          include: { user: true },
        },
      },
    });

    res.json(training);
  } catch (error) {
    console.error('Complete training error:', error);
    res.status(500).json({ error: 'Fehler beim Abschließen des Trainings' });
  }
});

// Meine Trainings (als Teilnehmer)
router.get('/my-trainings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const participations = await prisma.trainingParticipant.findMany({
      where: { userId: req.user!.id },
      include: {
        training: {
          include: { tutor: true },
        },
      },
      orderBy: { training: { scheduledAt: 'desc' } },
    });

    res.json(participations);
  } catch (error) {
    console.error('Get my trainings error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der eigenen Trainings' });
  }
});

// Academy Statistiken
router.get('/stats', authMiddleware, requirePermission('academy.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const [total, byType, byStatus, participants] = await Promise.all([
      prisma.training.count(),
      prisma.training.groupBy({
        by: ['type'],
        _count: true,
      }),
      prisma.training.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.trainingParticipant.count(),
    ]);

    res.json({
      total,
      totalParticipants: participants,
      byType: byType.reduce((acc, curr) => ({ ...acc, [curr.type]: curr._count }), {}),
      byStatus: byStatus.reduce((acc, curr) => ({ ...acc, [curr.status]: curr._count }), {}),
    });
  } catch (error) {
    console.error('Get academy stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

export default router;
