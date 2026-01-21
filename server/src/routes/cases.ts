import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { triggerCaseOpened, triggerCaseClosed, getEmployeeIdFromUserId } from '../services/bonusService.js';
import { broadcastCreate, broadcastUpdate, broadcastDelete } from '../services/socketService.js';
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

// ==================== DETECTIVE FOLDERS ====================

// GET alle Ordner
router.get('/folders', authMiddleware, requirePermission('detectives.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const folders = await prisma.detectiveFolder.findMany({
      include: {
        detective: {
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
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
        _count: {
          select: { cases: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(folders);
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Ordner' });
  }
});

// GET einzelner Ordner mit Akten
router.get('/folders/:id', authMiddleware, requirePermission('detectives.view'), async (req: AuthRequest, res: Response) => {
  try {
    const folder = await prisma.detectiveFolder.findUnique({
      where: { id: req.params.id },
      include: {
        detective: {
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
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
        cases: {
          include: {
            createdBy: {
              select: {
                displayName: true,
                username: true,
              },
            },
            _count: {
              select: { images: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!folder) {
      res.status(404).json({ error: 'Ordner nicht gefunden' });
      return;
    }

    res.json(folder);
  } catch (error) {
    console.error('Get folder error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Ordners' });
  }
});

// POST neuen Ordner erstellen
router.post('/folders', authMiddleware, requirePermission('detectives.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { detectiveId, description } = req.body;

    if (!detectiveId) {
      res.status(400).json({ error: 'Detektiv ist erforderlich' });
      return;
    }

    // Prüfen ob Ordner für diesen Detektiv bereits existiert
    const existingFolder = await prisma.detectiveFolder.findUnique({
      where: { detectiveId },
    });

    if (existingFolder) {
      res.status(400).json({ error: 'Für diesen Detektiv existiert bereits ein Ordner' });
      return;
    }

    // Detektiv-Namen für Ordnername holen
    const detective = await prisma.employee.findUnique({
      where: { id: detectiveId },
      include: {
        user: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    if (!detective) {
      res.status(404).json({ error: 'Detektiv nicht gefunden' });
      return;
    }

    const name = detective.user.displayName || detective.user.username;

    const folder = await prisma.detectiveFolder.create({
      data: {
        name,
        description,
        detectiveId,
        createdById: req.user!.id,
      },
      include: {
        detective: {
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
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
        _count: {
          select: { cases: true },
        },
      },
    });

    res.status(201).json(folder);
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Ordners' });
  }
});

// PUT Ordner aktualisieren
router.put('/folders/:id', authMiddleware, requirePermission('detectives.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { description, status } = req.body;

    const updateData: Record<string, unknown> = {};
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'CLOSED') {
        updateData.closedAt = new Date();
      } else if (status === 'OPEN') {
        updateData.closedAt = null;
      }
    }

    const folder = await prisma.detectiveFolder.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        detective: {
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
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
        _count: {
          select: { cases: true },
        },
      },
    });

    res.json(folder);
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Ordners' });
  }
});

// DELETE Ordner löschen (löscht auch alle Akten im Ordner) - OPTIMIERT
router.delete('/folders/:id', authMiddleware, requirePermission('detectives.manage'), async (req: AuthRequest, res: Response) => {
  try {
    // Zuerst alle Akten und ihre Bilder im Ordner löschen
    const cases = await prisma.case.findMany({
      where: { folderId: req.params.id },
      include: { images: true },
    });

    // Lösche Bilder vom Dateisystem (synchron ist hier ok, da Dateisystem)
    for (const caseItem of cases) {
      for (const image of caseItem.images) {
        const filePath = path.join(uploadDir, image.imagePath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    // OPTIMIERT: Lösche alle Akten auf einmal statt in einer Schleife
    if (cases.length > 0) {
      await prisma.case.deleteMany({
        where: { folderId: req.params.id },
      });
    }

    // Jetzt kann der Ordner sicher gelöscht werden
    await prisma.detectiveFolder.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Ordners' });
  }
});

// GET Mitarbeiter ohne Ordner (für Ordner-Erstellung)
router.get('/employees-without-folder', authMiddleware, requirePermission('detectives.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const employees = await prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        detectiveFolders: {
          none: {},
        },
      },
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
    console.error('Get employees without folder error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Mitarbeiter' });
  }
});

// GET Statistiken
router.get('/stats', authMiddleware, requirePermission('detectives.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const [folders, open, inProgress, closed, archived] = await Promise.all([
      prisma.detectiveFolder.count(),
      prisma.case.count({ where: { status: 'OPEN' } }),
      prisma.case.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.case.count({ where: { status: 'CLOSED' } }),
      prisma.case.count({ where: { status: 'ARCHIVED' } }),
    ]);

    res.json({
      folders,
      open,
      inProgress,
      closed,
      archived,
      totalCases: open + inProgress + closed + archived,
    });
  } catch (error) {
    console.error('Get case stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

// ==================== CASES ====================

// GET alle Fälle (optional mit Ordner-Filter)
router.get('/', authMiddleware, requirePermission('detectives.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, priority, search, folderId } = req.query;

    const where: Record<string, unknown> = {};
    if (folderId) {
      where.folderId = folderId;
    }
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
        folder: {
          include: {
            detective: {
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
        folder: {
          include: {
            detective: {
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
router.get('/image/:filename', authMiddleware, requirePermission('detectives.view'), async (req: AuthRequest, res: Response) => {
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
    const { title, description, priority, suspects, notes, folderId } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Titel ist erforderlich' });
      return;
    }

    if (!folderId) {
      res.status(400).json({ error: 'Ordner ist erforderlich' });
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
        folderId,
        createdById: req.user!.id,
      },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
        folder: {
          include: {
            detective: {
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
        },
      },
    });

    // Bonus-Trigger für eröffnete Ermittlungsakte
    if (newCase.folder.detective) {
      await triggerCaseOpened(newCase.folder.detectiveId, caseNumber, newCase.id);
    }

    // Live-Update broadcast
    broadcastCreate('case', newCase);

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
    const { title, description, status, priority, suspects, notes } = req.body;

    // Hole vorherigen Status für Bonus-Trigger
    const previousCase = await prisma.case.findUnique({
      where: { id: req.params.id },
      select: { status: true, caseNumber: true, folder: { select: { detectiveId: true } } }
    });

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
        folder: {
          include: {
            detective: {
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
        },
      },
    });

    // Bonus-Trigger wenn Fall abgeschlossen wird
    if ((status === 'CLOSED' || status === 'ARCHIVED') && previousCase?.status !== 'CLOSED' && previousCase?.status !== 'ARCHIVED') {
      if (previousCase?.folder.detectiveId) {
        await triggerCaseClosed(previousCase.folder.detectiveId, previousCase.caseNumber, req.params.id);
      }
    }

    // Live-Update broadcast
    broadcastUpdate('case', updatedCase);

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

    // Live-Update broadcast
    broadcastDelete('case', req.params.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete case error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Falls' });
  }
});

export default router;
