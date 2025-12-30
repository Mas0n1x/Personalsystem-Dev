import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Upload-Verzeichnis für Case-Bilder
const uploadDir = path.join(__dirname, '../../uploads/cases');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'case-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Nur Bilder erlaubt!'));
    }
  },
});

// Hilfsfunktion für Aktenzeichen
async function generateCaseNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DET-${year}-`;

  const lastCase = await prisma.case.findFirst({
    where: { caseNumber: { startsWith: prefix } },
    orderBy: { caseNumber: 'desc' },
  });

  let nextNumber = 1;
  if (lastCase) {
    const lastNumber = parseInt(lastCase.caseNumber.split('-')[2], 10);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
}

// GET alle Fälle
router.get('/', authMiddleware, requirePermission('detectives.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, priority, search } = req.query;

    const where: Record<string, unknown> = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (priority && priority !== 'ALL') {
      where.priority = priority;
    }
    if (search) {
      where.OR = [
        { title: { contains: search as string } },
        { caseNumber: { contains: search as string } },
        { suspects: { contains: search as string } },
      ];
    }

    const cases = await prisma.case.findMany({
      where,
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
        leadInvestigator: {
          include: {
            user: {
              select: {
                displayName: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: { images: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(cases);
  } catch (error) {
    console.error('Get cases error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Fälle' });
  }
});

// GET Statistiken
router.get('/stats', authMiddleware, requirePermission('detectives.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const [open, inProgress, closed, archived] = await Promise.all([
      prisma.case.count({ where: { status: 'OPEN' } }),
      prisma.case.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.case.count({ where: { status: 'CLOSED' } }),
      prisma.case.count({ where: { status: 'ARCHIVED' } }),
    ]);

    res.json({
      open,
      inProgress,
      closed,
      archived,
      total: open + inProgress + closed + archived,
    });
  } catch (error) {
    console.error('Get case stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

// GET Mitarbeiter für Lead Investigator
router.get('/employees', authMiddleware, requirePermission('detectives.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { rankLevel: 'desc' },
    });

    res.json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Mitarbeiter' });
  }
});

// GET einzelner Fall mit allen Details
router.get('/:id', authMiddleware, requirePermission('detectives.view'), async (req: AuthRequest, res: Response) => {
  try {
    const caseData = await prisma.case.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
        leadInvestigator: {
          include: {
            user: {
              select: {
                displayName: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        images: {
          include: {
            uploadedBy: {
              select: {
                displayName: true,
                username: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!caseData) {
      res.status(404).json({ error: 'Fall nicht gefunden' });
      return;
    }

    res.json(caseData);
  } catch (error) {
    console.error('Get case error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Falls' });
  }
});

// GET Bild
router.get('/image/:filename', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const filePath = path.join(uploadDir, req.params.filename);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'Bild nicht gefunden' });
    }
  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Bildes' });
  }
});

// POST neuen Fall erstellen
router.post('/', authMiddleware, requirePermission('detectives.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, priority, suspects, notes, leadInvestigatorId } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Titel ist erforderlich' });
      return;
    }

    const caseNumber = await generateCaseNumber();

    const newCase = await prisma.case.create({
      data: {
        caseNumber,
        title,
        description,
        priority: priority || 'NORMAL',
        suspects,
        notes,
        leadInvestigatorId: leadInvestigatorId || null,
        createdById: req.user!.id,
      },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
        leadInvestigator: {
          include: {
            user: {
              select: {
                displayName: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json(newCase);
  } catch (error) {
    console.error('Create case error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Falls' });
  }
});

// POST Bild zu Fall hinzufügen
router.post('/:id/images', authMiddleware, requirePermission('detectives.manage'), upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Kein Bild hochgeladen' });
      return;
    }

    const { description } = req.body;

    const image = await prisma.caseImage.create({
      data: {
        caseId: req.params.id,
        imagePath: req.file.filename,
        description,
        uploadedById: req.user!.id,
      },
      include: {
        uploadedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    res.status(201).json(image);
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Fehler beim Hochladen des Bildes' });
  }
});

// PUT Fall aktualisieren
router.put('/:id', authMiddleware, requirePermission('detectives.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, status, priority, suspects, notes, leadInvestigatorId } = req.body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'CLOSED' || status === 'ARCHIVED') {
        updateData.closedAt = new Date();
      }
    }
    if (priority !== undefined) updateData.priority = priority;
    if (suspects !== undefined) updateData.suspects = suspects;
    if (notes !== undefined) updateData.notes = notes;
    if (leadInvestigatorId !== undefined) updateData.leadInvestigatorId = leadInvestigatorId || null;

    const updatedCase = await prisma.case.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
        leadInvestigator: {
          include: {
            user: {
              select: {
                displayName: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    res.json(updatedCase);
  } catch (error) {
    console.error('Update case error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Falls' });
  }
});

// DELETE Bild löschen
router.delete('/images/:imageId', authMiddleware, requirePermission('detectives.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const image = await prisma.caseImage.findUnique({
      where: { id: req.params.imageId },
    });

    if (!image) {
      res.status(404).json({ error: 'Bild nicht gefunden' });
      return;
    }

    // Datei löschen
    const filePath = path.join(uploadDir, image.imagePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.caseImage.delete({
      where: { id: req.params.imageId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Bildes' });
  }
});

// DELETE Fall löschen
router.delete('/:id', authMiddleware, requirePermission('detectives.manage'), async (req: AuthRequest, res: Response) => {
  try {
    // Zuerst alle Bilder des Falls löschen
    const images = await prisma.caseImage.findMany({
      where: { caseId: req.params.id },
    });

    for (const image of images) {
      const filePath = path.join(uploadDir, image.imagePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.case.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete case error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Falls' });
  }
});

export default router;
