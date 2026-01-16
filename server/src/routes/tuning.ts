import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { broadcastCreate, broadcastDelete } from '../services/socketService.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { notifyTuningPayment } from '../services/notificationService.js';

const router = Router();

// Setup für Datei-Upload
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../../uploads/tuning');

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

// GET alle Tuning-Rechnungen
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const invoices = await prisma.tuningInvoice.findMany({
      where: { status: 'OFFEN' },
      include: {
        submittedBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(invoices);
  } catch (error) {
    console.error('Get tuning invoices error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Rechnungen' });
  }
});

// GET Statistiken
router.get('/stats', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const [offenCount, offenSum] = await Promise.all([
      prisma.tuningInvoice.count({ where: { status: 'OFFEN' } }),
      prisma.tuningInvoice.aggregate({
        where: { status: 'OFFEN' },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      offen: offenCount,
      summe: offenSum._sum.amount || 0,
    });
  } catch (error) {
    console.error('Get tuning stats error:', error);
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

// POST neue Rechnung einreichen
router.post('/', authMiddleware, upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    const { amount } = req.body;
    const file = req.file;

    if (!amount || !file) {
      // Lösche hochgeladene Datei falls vorhanden
      if (file) {
        fs.unlinkSync(file.path);
      }
      res.status(400).json({ error: 'Betrag und Beweisfoto sind erforderlich' });
      return;
    }

    const parsedAmount = parseInt(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: 'Ungültiger Betrag' });
      return;
    }

    const invoice = await prisma.tuningInvoice.create({
      data: {
        amount: parsedAmount,
        imagePath: file.filename,
        submittedById: req.user!.id,
      },
      include: {
        submittedBy: {
          select: {
            displayName: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Live-Update broadcast
    broadcastCreate('tuning', invoice);

    res.status(201).json(invoice);
  } catch (error) {
    console.error('Create tuning invoice error:', error);
    res.status(500).json({ error: 'Fehler beim Einreichen der Rechnung' });
  }
});

// PUT Rechnung als erledigt markieren (löscht automatisch)
router.put('/:id/complete', authMiddleware, requirePermission('tuning.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Hole die Rechnung mit User-Info für Notification
    const invoice = await prisma.tuningInvoice.findUnique({
      where: { id },
      include: {
        submittedBy: { select: { id: true } },
      },
    });

    if (!invoice) {
      res.status(404).json({ error: 'Rechnung nicht gefunden' });
      return;
    }

    // Lösche das Bild
    const imagePath = path.join(uploadDir, invoice.imagePath);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Benachrichtigung an den Einreicher senden
    const completedByUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { displayName: true, username: true },
    });
    const completedByName = completedByUser?.displayName || completedByUser?.username || 'Unbekannt';

    await notifyTuningPayment(
      invoice.submittedById,
      invoice.amount,
      completedByName
    );

    // Lösche die Rechnung aus der Datenbank
    await prisma.tuningInvoice.delete({ where: { id } });

    // Live-Update broadcast
    broadcastDelete('tuning', id);

    res.json({ success: true });
  } catch (error) {
    console.error('Complete tuning invoice error:', error);
    res.status(500).json({ error: 'Fehler beim Abschließen der Rechnung' });
  }
});

// DELETE Rechnung löschen (nur eigene oder mit Berechtigung)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.tuningInvoice.findUnique({ where: { id } });

    if (!invoice) {
      res.status(404).json({ error: 'Rechnung nicht gefunden' });
      return;
    }

    // Prüfe ob User Berechtigung hat oder eigene Rechnung
    const isOwner = invoice.submittedById === req.user!.id;
    const hasPermission = req.user!.role?.permissions?.some(
      (p: { name: string }) => p.name === 'tuning.manage' || p.name === 'admin.full'
    );

    if (!isOwner && !hasPermission) {
      res.status(403).json({ error: 'Keine Berechtigung' });
      return;
    }

    // Lösche das Bild
    const imagePath = path.join(uploadDir, invoice.imagePath);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Lösche die Rechnung
    await prisma.tuningInvoice.delete({ where: { id } });

    // Live-Update broadcast
    broadcastDelete('tuning', id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete tuning invoice error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Rechnung' });
  }
});

export default router;
