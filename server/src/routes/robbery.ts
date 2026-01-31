import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { triggerRobberyLeader, triggerRobberyNegotiator } from '../services/bonusService.js';
import { broadcastCreate, broadcastDelete } from '../services/socketService.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

const router = Router();

// ==================== EMPLOYEE CACHE ====================
// Cache für Mitarbeiter-Dropdown (60 Sekunden TTL)
interface EmployeeCache {
  data: unknown[];
  timestamp: number;
}
let employeeCache: EmployeeCache | null = null;
const EMPLOYEE_CACHE_TTL = 60 * 1000; // 60 Sekunden

function isEmployeeCacheValid(): boolean {
  return employeeCache !== null && (Date.now() - employeeCache.timestamp) < EMPLOYEE_CACHE_TTL;
}

// Cache invalidieren (z.B. bei Mitarbeiteränderungen)
export function invalidateEmployeeCache(): void {
  employeeCache = null;
}

// Setup für Datei-Upload
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../../uploads/robbery');

// Stelle sicher, dass der Upload-Ordner existiert
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Max 10MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Nur Bilder sind erlaubt (JPEG, PNG, GIF, WebP)'));
    }
  }
});

// Cron-Job: Jeden Sonntag um 23:59 Uhr alle Räube löschen
cron.schedule('59 23 * * 0', async () => {
  console.log('Cron-Job: Lösche alle Räube der Woche...');
  try {
    // Hole alle Räube mit ID und imagePath
    const robberies = await prisma.robbery.findMany({
      select: { id: true, imagePath: true },
    });

    // Storniere alle zugehörigen PENDING Bonuszahlungen
    const cancelledBonuses = await prisma.bonusPayment.updateMany({
      where: {
        referenceId: { in: robberies.map(r => r.id) },
        referenceType: 'Robbery',
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    if (cancelledBonuses.count > 0) {
      console.log(`Cron-Job: ${cancelledBonuses.count} Bonuszahlung(en) storniert`);
    }

    // Lösche alle Bilder (parallel für bessere Performance)
    await Promise.all(
      robberies.map(async (robbery) => {
        const imagePath = path.join(uploadDir, robbery.imagePath);
        try {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        } catch (err) {
          console.error(`Fehler beim Löschen von ${imagePath}:`, err);
        }
      })
    );

    // Lösche alle Räube aus der Datenbank
    const deleted = await prisma.robbery.deleteMany();
    console.log(`Cron-Job: ${deleted.count} Räube gelöscht`);
  } catch (error) {
    console.error('Cron-Job Fehler:', error);
  }
});

// Hilfsfunktion: Wochenanfang und -ende berechnen
function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  // Montag als Wochenanfang (0 = Sonntag, 1 = Montag, ...)
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const start = new Date(now);
  start.setDate(now.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

// GET alle Räube dieser Woche
router.get('/', authMiddleware, requirePermission('robbery.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const { start, end } = getWeekBounds();

    const robberies = await prisma.robbery.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        leader: {
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
        negotiator: {
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
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(robberies);
  } catch (error) {
    console.error('Get robberies error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Räube' });
  }
});

// GET Statistiken
router.get('/stats', authMiddleware, requirePermission('robbery.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const { start, end } = getWeekBounds();

    const count = await prisma.robbery.count({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });

    res.json({
      weekTotal: count,
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
    });
  } catch (error) {
    console.error('Get robbery stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

// GET Bild abrufen
router.get('/image/:filename', authMiddleware, (req: AuthRequest, res: Response) => {
  const { filename } = req.params;
  const filePath = path.join(uploadDir, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Bild nicht gefunden' });
    return;
  }

  res.sendFile(filePath);
});

// GET alle Mitarbeiter für Dropdown (mit Caching)
router.get('/employees', authMiddleware, requirePermission('robbery.view'), async (_req: AuthRequest, res: Response) => {
  try {
    // Aus Cache laden wenn gültig
    if (isEmployeeCacheValid() && employeeCache) {
      return res.json(employeeCache.data);
    }

    const employees = await prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        rank: true,
        user: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: [
        { rankLevel: 'desc' },
        { user: { displayName: 'asc' } },
      ],
    });

    // In Cache speichern
    employeeCache = { data: employees, timestamp: Date.now() };

    res.json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Mitarbeiter' });
  }
});

// POST neuen Raub erstellen
router.post('/', authMiddleware, requirePermission('robbery.create'), upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    const { leaderId, negotiatorId } = req.body;
    const file = req.file;

    // Nur Einsatzleitung und Beweisfoto sind Pflicht, Verhandlungsführung ist optional
    if (!leaderId || !file) {
      if (file) {
        fs.unlinkSync(file.path);
      }
      res.status(400).json({ error: 'Einsatzleitung und Beweisfoto sind erforderlich' });
      return;
    }

    // Prüfe ob Einsatzleitung existiert
    const leader = await prisma.employee.findUnique({ where: { id: leaderId } });

    if (!leader) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: 'Einsatzleitung nicht gefunden' });
      return;
    }

    // Prüfe ob Verhandlungsführung existiert (falls angegeben)
    if (negotiatorId) {
      const negotiator = await prisma.employee.findUnique({ where: { id: negotiatorId } });
      if (!negotiator) {
        fs.unlinkSync(file.path);
        res.status(400).json({ error: 'Verhandlungsführung nicht gefunden' });
        return;
      }
    }

    const robbery = await prisma.robbery.create({
      data: {
        leaderId,
        negotiatorId: negotiatorId || null,
        imagePath: file.filename,
        createdById: req.user!.id,
      },
      include: {
        leader: {
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
        negotiator: negotiatorId ? {
          include: {
            user: {
              select: {
                displayName: true,
                username: true,
                avatar: true,
              },
            },
          },
        } : undefined,
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    // Response sofort senden für schnelle UX
    res.status(201).json(robbery);

    // Live-Update broadcast (async)
    broadcastCreate('robbery', robbery);

    // Bonus-Trigger für Einsatzleitung (immer) und Verhandlungsführung (falls vorhanden)
    // Diese laufen im Hintergrund und blockieren nicht die Response
    const bonusTriggers = [triggerRobberyLeader(leaderId, robbery.id)];
    if (negotiatorId) {
      bonusTriggers.push(triggerRobberyNegotiator(negotiatorId, robbery.id));
    }
    Promise.all(bonusTriggers).catch((err) => console.error('Bonus trigger error:', err));
  } catch (error) {
    console.error('Create robbery error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Raubs' });
  }
});

// DELETE Raub löschen
router.delete('/:id', authMiddleware, requirePermission('robbery.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const robbery = await prisma.robbery.findUnique({ where: { id } });

    if (!robbery) {
      res.status(404).json({ error: 'Raub nicht gefunden' });
      return;
    }

    // Storniere zugehörige Bonuszahlungen (falls vorhanden)
    // Nur PENDING Zahlungen stornieren, bereits ausgezahlte bleiben bestehen
    const cancelledBonuses = await prisma.bonusPayment.updateMany({
      where: {
        referenceId: id,
        referenceType: 'Robbery',
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    if (cancelledBonuses.count > 0) {
      console.log(`Raub ${id} gelöscht: ${cancelledBonuses.count} Bonuszahlung(en) storniert`);
    }

    // Lösche das Bild
    const imagePath = path.join(uploadDir, robbery.imagePath);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Lösche den Raub
    await prisma.robbery.delete({ where: { id } });

    // Live-Update broadcast
    broadcastDelete('robbery', id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete robbery error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Raubs' });
  }
});

export default router;
