import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { createInviteLink, updateDiscordNickname, assignHireRoles, findFreeBadgeNumber, getTeamConfigForLevel, findDiscordMember } from '../services/discordBot.js';
import { triggerApplicationCompleted, triggerApplicationOnboarding, triggerApplicationRejected, getEmployeeIdFromUserId } from '../services/bonusService.js';
import { announceHire } from '../services/discordAnnouncements.js';
import { broadcastCreate, broadcastUpdate, broadcastDelete, emitEmployeeHired } from '../services/socketService.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Upload-Verzeichnis für Personalausweise
const uploadDir = path.join(__dirname, '../../uploads/id-cards');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer-Konfiguration für Bild-Upload
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'idcard-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Nur JPEG, PNG und WebP erlaubt'));
    }
  },
});

const router = Router();

// Rang zu Level Mapping
const RANK_TO_LEVEL: Record<string, number> = {
  'Recruit': 1,
  'Officer I': 2,
  'Officer II': 3,
  'Officer III': 4,
  'Senior Officer': 5,
  'Corporal': 6,
  'Sergeant I': 7,
  'Sergeant II': 8,
  'Lieutenant I': 9,
  'Lieutenant II': 10,
  'Captain': 11,
  'Commander': 12,
  'Deputy Chief': 13,
  'Assistant Chief': 14,
  'Chief of Police': 15,
};

// Fallback Onboarding-Checkliste falls keine in DB konfiguriert
const FALLBACK_ONBOARDING_CHECKLIST = [
  { id: 'clothes', text: 'Klamotten besorgen (Dienstkleidung)' },
  { id: 'discord', text: 'Discord Rollen vergeben' },
  { id: 'inventory', text: 'Standardinventar erklärt' },
  { id: 'garage', text: 'Fahrzeuggarage erklärt' },
];

// ==================== CACHING für statische Daten ====================
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 Minuten Cache
const cache: {
  questions: CacheEntry<{ id: string; text: string }[]> | null;
  criteria: CacheEntry<{ id: string; name: string }[]> | null;
  onboarding: CacheEntry<{ id: string; text: string }[]> | null;
} = {
  questions: null,
  criteria: null,
  onboarding: null,
};

// Cache invalidieren (bei Änderungen an den Daten aufrufen)
export function invalidateHRCache(type?: 'questions' | 'criteria' | 'onboarding') {
  if (type) {
    cache[type] = null;
  } else {
    cache.questions = null;
    cache.criteria = null;
    cache.onboarding = null;
  }
}

// Hilfsfunktion um Onboarding-Items zu laden (aus DB oder Fallback) - MIT CACHE
async function getOnboardingChecklist() {
  const now = Date.now();
  if (cache.onboarding && (now - cache.onboarding.timestamp) < CACHE_TTL) {
    return cache.onboarding.data;
  }

  const dbItems = await prisma.onboardingItem.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  const result = dbItems.length > 0
    ? dbItems.map(item => ({ id: item.id, text: item.text }))
    : FALLBACK_ONBOARDING_CHECKLIST;

  cache.onboarding = { data: result, timestamp: now };
  return result;
}

// Fallback-Fragen (auch weiter unten definiert, hier für Cache-Funktionen)
const FALLBACK_QUESTIONS_CACHE = [
  { id: 'q1', text: 'Was sind deine Aufgaben als Recruit?' },
  { id: 'q2', text: 'Wie verhältst du dich bei einer Verkehrskontrolle?' },
  { id: 'q3', text: 'Was machst du bei einem Notruf?' },
];

// Fallback-Kriterien (auch weiter unten definiert, hier für Cache-Funktionen)
const FALLBACK_CRITERIA_CACHE = [
  { id: 'stabilization', name: 'Stabilisationsschein geprüft' },
  { id: 'visa', name: 'Visumsstufe geprüft' },
  { id: 'noOffenses', name: 'Keine Straftaten (7 Tage)' },
  { id: 'appearance', name: 'Angemessenes Aussehen' },
  { id: 'noFactionLock', name: 'Keine Fraktionssperre' },
  { id: 'noOpenBills', name: 'Keine offenen Rechnungen' },
  { id: 'searched', name: 'Durchsuchen' },
  { id: 'blacklistChecked', name: 'Blacklist gecheckt' },
  { id: 'handbookGiven', name: 'Diensthandbuch ausgegeben' },
  { id: 'employmentTest', name: 'Einstellungstest' },
  { id: 'rpSituation', name: 'RP Situation dargestellt (AVK) & Smalltalk' },
];

// Gecachte Fragen laden
async function getCachedQuestions() {
  const now = Date.now();
  if (cache.questions && (now - cache.questions.timestamp) < CACHE_TTL) {
    return cache.questions.data;
  }

  const questions = await prisma.academyQuestion.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  const result = questions.length > 0
    ? questions.map(q => ({ id: q.id, text: q.question }))
    : FALLBACK_QUESTIONS_CACHE;

  cache.questions = { data: result, timestamp: now };
  return result;
}

// Gecachte Kriterien laden
async function getCachedCriteria() {
  const now = Date.now();
  if (cache.criteria && (now - cache.criteria.timestamp) < CACHE_TTL) {
    return cache.criteria.data;
  }

  const criteria = await prisma.academyCriterion.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  const result = criteria.length > 0
    ? criteria.map(c => ({ id: c.id, name: c.name }))
    : FALLBACK_CRITERIA_CACHE;

  cache.criteria = { data: result, timestamp: now };
  return result;
}

// ==================== KOMBINIERTER INIT-ENDPOINT für HR-Seite ====================
// Reduziert 7 API-Calls auf 1 für schnelleres Laden
router.get('/init', authMiddleware, requirePermission('hr.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, page = '1', limit = '50' } = req.query;

    const where: Record<string, unknown> = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    // Alle Daten parallel laden für maximale Performance
    const [
      applications,
      applicationTotal,
      criteriaStats,
      questionsStats,
      onboardingStats,
      completedStats,
      rejectedStats,
      questions,
      criteria,
      onboardingItems,
      blacklist,
      blacklistTotal,
      blacklistPermanent,
      blacklistTemporary,
    ] = await Promise.all([
      // Bewerbungen
      prisma.application.findMany({
        where,
        include: {
          createdBy: { select: { displayName: true, username: true } },
          processedBy: { select: { displayName: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.application.count({ where }),
      // Application Stats
      prisma.application.count({ where: { status: 'CRITERIA' } }),
      prisma.application.count({ where: { status: 'QUESTIONS' } }),
      prisma.application.count({ where: { status: 'ONBOARDING' } }),
      prisma.application.count({ where: { status: 'COMPLETED' } }),
      prisma.application.count({ where: { status: 'REJECTED' } }),
      // Gecachte statische Daten
      getCachedQuestions(),
      getCachedCriteria(),
      getOnboardingChecklist(),
      // Blacklist
      prisma.blacklist.findMany({
        include: { addedBy: { select: { displayName: true, username: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.blacklist.count(),
      prisma.blacklist.count({ where: { expiresAt: null } }),
      prisma.blacklist.count({ where: { expiresAt: { not: null, gt: new Date() } } }),
    ]);

    res.json({
      applications: {
        data: applications,
        total: applicationTotal,
        page: parseInt(page as string),
        limit: take,
        totalPages: Math.ceil(applicationTotal / take),
      },
      applicationStats: {
        criteria: criteriaStats,
        questions: questionsStats,
        onboarding: onboardingStats,
        completed: completedStats,
        rejected: rejectedStats,
        pending: criteriaStats + questionsStats + onboardingStats,
        total: criteriaStats + questionsStats + onboardingStats + completedStats + rejectedStats,
      },
      questions,
      criteria,
      onboardingItems,
      blacklist,
      blacklistStats: {
        total: blacklistTotal,
        permanent: blacklistPermanent,
        temporary: blacklistTemporary,
      },
    });
  } catch (error) {
    console.error('HR Init error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der HR-Daten' });
  }
});

// GET alle Bewerbungen
router.get('/', authMiddleware, requirePermission('hr.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, page = '1', limit = '50' } = req.query;

    const where: Record<string, unknown> = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          createdBy: {
            select: {
              displayName: true,
              username: true,
            },
          },
          processedBy: {
            select: {
              displayName: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.application.count({ where }),
    ]);

    res.json({
      data: applications,
      total,
      page: parseInt(page as string),
      limit: take,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Bewerbungen' });
  }
});

// GET Statistiken
router.get('/stats', authMiddleware, requirePermission('hr.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const [criteria, questions, onboarding, completed, rejected] = await Promise.all([
      prisma.application.count({ where: { status: 'CRITERIA' } }),
      prisma.application.count({ where: { status: 'QUESTIONS' } }),
      prisma.application.count({ where: { status: 'ONBOARDING' } }),
      prisma.application.count({ where: { status: 'COMPLETED' } }),
      prisma.application.count({ where: { status: 'REJECTED' } }),
    ]);

    res.json({
      criteria,
      questions,
      onboarding,
      completed,
      rejected,
      pending: criteria + questions + onboarding, // In Bearbeitung
      total: criteria + questions + onboarding + completed + rejected,
    });
  } catch (error) {
    console.error('Get application stats error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
  }
});

// Fallback-Fragen für den Fall, dass keine in der Datenbank konfiguriert sind
const FALLBACK_QUESTIONS = [
  { id: 'q1', text: 'Was sind deine Aufgaben als Recruit?' },
  { id: 'q2', text: 'Wie verhältst du dich bei einer Verkehrskontrolle?' },
  { id: 'q3', text: 'Was machst du bei einem Notruf?' },
];

// GET Fragenkatalog (dynamisch aus Datenbank)
router.get('/questions', authMiddleware, requirePermission('hr.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const questions = await prisma.academyQuestion.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Verwende Fallback, wenn keine Fragen in der DB
    if (questions.length === 0) {
      res.json(FALLBACK_QUESTIONS);
      return;
    }

    // Format für Frontend-Kompatibilität
    res.json(questions.map(q => ({ id: q.id, text: q.question })));
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Fragen' });
  }
});

// GET Einstellungskriterien (dynamisch aus Datenbank)
router.get('/criteria', authMiddleware, requirePermission('hr.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const criteria = await prisma.academyCriterion.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Verwende Fallback, wenn keine Kriterien in der DB
    if (criteria.length === 0) {
      res.json(FALLBACK_CRITERIA);
      return;
    }

    res.json(criteria.map(c => ({ id: c.id, name: c.name })));
  } catch (error) {
    console.error('Get criteria error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Kriterien' });
  }
});

// GET Onboarding-Checkliste (dynamisch aus DB oder Fallback)
router.get('/onboarding-checklist', authMiddleware, requirePermission('hr.view'), async (_req: AuthRequest, res: Response) => {
  try {
    const checklist = await getOnboardingChecklist();
    res.json(checklist);
  } catch (error) {
    console.error('Get onboarding checklist error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Onboarding-Checkliste' });
  }
});

// ==================== ONBOARDING-CHECKLISTE VERWALTUNG (Admin only) ====================

// POST Neues Onboarding-Item erstellen
router.post('/onboarding-checklist', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { text, sortOrder } = req.body;

    if (!text || !text.trim()) {
      res.status(400).json({ error: 'Text ist erforderlich' });
      return;
    }

    // Finde höchste sortOrder wenn keine angegeben
    const maxSort = await prisma.onboardingItem.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const newItem = await prisma.onboardingItem.create({
      data: {
        text: text.trim(),
        sortOrder: sortOrder !== undefined ? sortOrder : (maxSort?.sortOrder || 0) + 1,
      },
    });

    res.json(newItem);
  } catch (error) {
    console.error('Create onboarding item error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Onboarding-Items' });
  }
});

// PUT Onboarding-Item aktualisieren
router.put('/onboarding-checklist/:id', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { text, sortOrder, isActive } = req.body;

    const updateData: any = {};
    if (text !== undefined) updateData.text = text.trim();
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await prisma.onboardingItem.update({
      where: { id },
      data: updateData,
    });

    res.json(updated);
  } catch (error) {
    console.error('Update onboarding item error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Onboarding-Items' });
  }
});

// DELETE Onboarding-Item löschen
router.delete('/onboarding-checklist/:id', authMiddleware, requirePermission('admin.full'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.onboardingItem.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete onboarding item error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Onboarding-Items' });
  }
});

// POST Initialisiere Standard-Checkliste
router.post('/onboarding-checklist/init', authMiddleware, requirePermission('admin.full'), async (_req: AuthRequest, res: Response) => {
  try {
    // Prüfe ob bereits Items existieren
    const existing = await prisma.onboardingItem.count();
    if (existing > 0) {
      res.status(400).json({ error: 'Checkliste wurde bereits initialisiert' });
      return;
    }

    // Erstelle Standard-Items
    const items = await prisma.onboardingItem.createMany({
      data: FALLBACK_ONBOARDING_CHECKLIST.map((item, index) => ({
        text: item.text,
        sortOrder: index + 1,
      })),
    });

    res.json({ message: `${items.count} Standard-Items erstellt`, count: items.count });
  } catch (error) {
    console.error('Init onboarding checklist error:', error);
    res.status(500).json({ error: 'Fehler beim Initialisieren der Checkliste' });
  }
});

// POST Discord Einladungslink generieren
router.post('/generate-invite', authMiddleware, requirePermission('hr.manage'), async (_req: AuthRequest, res: Response) => {
  try {
    const result = await createInviteLink(86400, 1); // 24h, 1 Verwendung

    if (!result.success) {
      res.status(500).json({ error: result.error || 'Fehler beim Erstellen der Einladung' });
      return;
    }

    res.json({ inviteUrl: result.inviteUrl });
  } catch (error) {
    console.error('Generate invite error:', error);
    res.status(500).json({ error: 'Fehler beim Generieren des Einladungslinks' });
  }
});

// GET einzelne Bewerbung
router.get('/:id', authMiddleware, requirePermission('hr.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
        processedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    if (!application) {
      res.status(404).json({ error: 'Bewerbung nicht gefunden' });
      return;
    }

    res.json(application);
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Bewerbung' });
  }
});

// GET Personalausweis-Bild (on-demand laden)
router.get('/:id/id-card', authMiddleware, requirePermission('hr.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const application = await prisma.application.findUnique({
      where: { id },
      select: { idCardImage: true },
    });

    if (!application || !application.idCardImage) {
      res.status(404).json({ error: 'Bild nicht gefunden' });
      return;
    }

    const imagePath = path.join(uploadDir, application.idCardImage);
    if (!fs.existsSync(imagePath)) {
      res.status(404).json({ error: 'Bilddatei nicht gefunden' });
      return;
    }

    res.sendFile(imagePath);
  } catch (error) {
    console.error('Get ID card error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Bildes' });
  }
});

// GET Discord-Member suchen (für automatische ID-Erkennung)
router.get('/search-discord/:query', authMiddleware, requirePermission('hr.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.params;

    if (!query || query.length < 2) {
      res.status(400).json({ error: 'Suchbegriff zu kurz' });
      return;
    }

    const result = await findDiscordMember(query);
    res.json(result);
  } catch (error) {
    console.error('Search Discord member error:', error);
    res.status(500).json({ error: 'Fehler bei der Discord-Suche' });
  }
});

// GET Blacklist-Check
router.get('/check-blacklist/:discordId', authMiddleware, requirePermission('hr.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { discordId } = req.params;

    const blacklistEntry = await prisma.blacklist.findUnique({
      where: { discordId },
    });

    if (!blacklistEntry) {
      res.json({ blacklisted: false });
      return;
    }

    if (blacklistEntry.expiresAt && new Date(blacklistEntry.expiresAt) < new Date()) {
      res.json({ blacklisted: false, expired: true });
      return;
    }

    res.json({
      blacklisted: true,
      reason: blacklistEntry.reason,
      expiresAt: blacklistEntry.expiresAt,
      username: blacklistEntry.username,
    });
  } catch (error) {
    console.error('Check blacklist error:', error);
    res.status(500).json({ error: 'Fehler beim Prüfen der Blacklist' });
  }
});

// POST neue Bewerbung erstellen (Schritt 1: Basisdaten)
router.post('/', authMiddleware, requirePermission('hr.manage'), upload.single('idCardImage'), async (req: AuthRequest, res: Response) => {
  try {
    const { applicantName, applicationDate, discordId, discordUsername } = req.body;
    const idCardImage = req.file?.filename;

    if (!applicantName) {
      res.status(400).json({ error: 'Name des Bewerbers ist erforderlich' });
      return;
    }

    // Blacklist-Check falls Discord-Daten angegeben wurden
    if (discordId || discordUsername) {
      // Optimiert: Direkter DB-Query statt alle Eintraege laden
      const whereConditions = [];
      if (discordId) {
        whereConditions.push({ discordId });
      }
      if (discordUsername) {
        // SQLite case-insensitive Suche
        whereConditions.push({ username: discordUsername });
      }

      const blacklistMatch = await prisma.blacklist.findFirst({
        where: {
          OR: whereConditions,
        },
      });

      if (blacklistMatch) {
        // Case-insensitive Vergleich fuer username im Nachhinein (SQLite)
        const isMatch = (discordId && blacklistMatch.discordId === discordId) ||
          (discordUsername && blacklistMatch.username.toLowerCase() === discordUsername.toLowerCase());

        if (isMatch) {
          // Pruefe ob abgelaufen
          if (!blacklistMatch.expiresAt || new Date(blacklistMatch.expiresAt) > new Date()) {
            res.status(400).json({
              error: 'BLACKLISTED',
              message: `Bewerber ist auf der Blacklist: ${blacklistMatch.reason}`,
              blacklistEntry: blacklistMatch,
            });
            return;
          }
        }
      }
    }

    const application = await prisma.application.create({
      data: {
        applicantName,
        applicationDate: applicationDate ? new Date(applicationDate) : new Date(),
        idCardImage,
        discordId: discordId || null,
        discordUsername: discordUsername || null,
        createdById: req.user!.id,
        status: 'CRITERIA',
        currentStep: 1,
      },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    // Live-Update broadcast
    broadcastCreate('application', application);

    res.status(201).json(application);
  } catch (error) {
    console.error('Create application error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Bewerbung' });
  }
});

// Fallback-Kriterien für den Fall, dass keine in der Datenbank konfiguriert sind
const FALLBACK_CRITERIA = [
  { id: 'stabilization', name: 'Stabilisationsschein geprüft' },
  { id: 'visa', name: 'Visumsstufe geprüft' },
  { id: 'noOffenses', name: 'Keine Straftaten (7 Tage)' },
  { id: 'appearance', name: 'Angemessenes Aussehen' },
  { id: 'noFactionLock', name: 'Keine Fraktionssperre' },
  { id: 'noOpenBills', name: 'Keine offenen Rechnungen' },
  { id: 'searched', name: 'Durchsuchen' },
  { id: 'blacklistChecked', name: 'Blacklist gecheckt' },
  { id: 'handbookGiven', name: 'Diensthandbuch ausgegeben' },
  { id: 'employmentTest', name: 'Einstellungstest' },
  { id: 'rpSituation', name: 'RP Situation dargestellt (AVK) & Smalltalk' },
];

// PUT Einstellungskriterien aktualisieren (Schritt 1) - Dynamisch
router.put('/:id/criteria', authMiddleware, requirePermission('hr.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const criteriaData = req.body; // { "criterionId1": true, "criterionId2": false, ... }

    // Hole alle aktiven Kriterien aus der Datenbank
    const dbCriteria = await prisma.academyCriterion.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Verwende Fallback-Kriterien, wenn keine in der DB konfiguriert sind
    const activeCriteria = dbCriteria.length > 0
      ? dbCriteria
      : FALLBACK_CRITERIA;

    // Prüfe ob alle Kriterien erfüllt sind (mindestens eines muss existieren)
    const allCriteriaMet = activeCriteria.length > 0 &&
      activeCriteria.every((criterion) => criteriaData[criterion.id] === true);

    const application = await prisma.application.update({
      where: { id },
      data: {
        criteriaData: JSON.stringify(criteriaData),
        // Wenn alle Kriterien erfüllt, zum nächsten Schritt
        status: allCriteriaMet ? 'QUESTIONS' : 'CRITERIA',
        currentStep: allCriteriaMet ? 2 : 1,
      },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    // Live-Update broadcast
    broadcastUpdate('application', application);

    res.json(application);
  } catch (error) {
    console.error('Update criteria error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Kriterien' });
  }
});

// PUT Fragenkatalog aktualisieren (Schritt 2)
router.put('/:id/questions', authMiddleware, requirePermission('hr.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { questionsCompleted } = req.body;

    // Hole aktive Fragen aus der Datenbank für Vollständigkeitsprüfung
    const dbQuestionsCount = await prisma.academyQuestion.count({
      where: { isActive: true },
    });

    // Verwende Fallback-Anzahl, wenn keine Fragen in der DB
    const totalQuestions = dbQuestionsCount > 0 ? dbQuestionsCount : FALLBACK_QUESTIONS.length;

    // Mindestens 70% der Fragen müssen richtig beantwortet werden (nicht alle)
    const minQuestionsRequired = Math.ceil(totalQuestions * 0.7);
    const questionsAnswered = questionsCompleted && Array.isArray(questionsCompleted) ? questionsCompleted.length : 0;
    const allQuestionsCompleted = questionsAnswered >= minQuestionsRequired;

    const application = await prisma.application.update({
      where: { id },
      data: {
        questionsCompleted: JSON.stringify(questionsCompleted || []),
        // Wenn alle Fragen beantwortet, zum nächsten Schritt
        status: allQuestionsCompleted ? 'ONBOARDING' : 'QUESTIONS',
        currentStep: allQuestionsCompleted ? 3 : 2,
      },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    // Live-Update broadcast
    broadcastUpdate('application', application);

    res.json(application);
  } catch (error) {
    console.error('Update questions error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Fragen' });
  }
});

// PUT Onboarding aktualisieren (Schritt 3)
router.put('/:id/onboarding', authMiddleware, requirePermission('hr.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { onboardingCompleted, discordId, discordUsername, discordInviteLink, discordRolesAssigned } = req.body;

    // Prüfe ob Onboarding vollständig (dynamisch basierend auf DB-Items)
    const checklist = await getOnboardingChecklist();
    const allOnboardingCompleted =
      onboardingCompleted &&
      Array.isArray(onboardingCompleted) &&
      onboardingCompleted.length >= checklist.length;

    const application = await prisma.application.update({
      where: { id },
      data: {
        onboardingCompleted: JSON.stringify(onboardingCompleted || []),
        discordId: discordId || undefined,
        discordUsername: discordUsername || undefined,
        discordInviteLink: discordInviteLink || undefined,
        discordRolesAssigned: discordRolesAssigned || false,
      },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    // Live-Update broadcast
    broadcastUpdate('application', application);

    res.json({ application, allComplete: allOnboardingCompleted });
  } catch (error) {
    console.error('Update onboarding error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Onboardings' });
  }
});

// PUT Discord-Rollen sofort vergeben (ohne Bewerbung abzuschließen)
router.put('/:id/assign-discord-roles', authMiddleware, requirePermission('hr.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const application = await prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      res.status(404).json({ error: 'Bewerbung nicht gefunden' });
      return;
    }

    if (!application.discordId) {
      res.status(400).json({ error: 'Discord ID ist erforderlich' });
      return;
    }

    // Discord-Rollen aus Admin-Einstellungen zuweisen
    try {
      const hireRolesSetting = await prisma.systemSetting.findUnique({
        where: { key: 'hrOnboardingRoleIds' },
      });

      if (!hireRolesSetting?.value) {
        res.status(400).json({ error: 'Keine Discord-Rollen in den Einstellungen konfiguriert' });
        return;
      }

      // Unterstütze sowohl kommaseparierte IDs als auch JSON-Array
      let roleIds: string[] = [];
      try {
        roleIds = JSON.parse(hireRolesSetting.value) as string[];
      } catch {
        // Fallback: kommaseparierte IDs
        roleIds = hireRolesSetting.value.split(',').map(id => id.trim()).filter(Boolean);
      }

      if (!roleIds || roleIds.length === 0) {
        res.status(400).json({ error: 'Keine Discord-Rollen in den Einstellungen konfiguriert' });
        return;
      }

      const roleResult = await assignHireRoles(application.discordId, roleIds);
      console.log(`Discord Rollen manuell zugewiesen: ${roleResult.assigned.length} erfolgreich, ${roleResult.failed.length} fehlgeschlagen`);

      if (roleResult.assigned.length === 0) {
        res.status(500).json({ error: 'Fehler beim Zuweisen der Discord-Rollen' });
        return;
      }

      // Discord Nickname setzen (nur Name, ohne Dienstnummer)
      let nicknameUpdated = false;
      try {
        await updateDiscordNickname(application.discordId, application.applicantName);
        console.log(`Discord Nickname für ${application.discordId} auf "${application.applicantName}" gesetzt`);
        nicknameUpdated = true;
      } catch (nickError) {
        console.error('Fehler beim Setzen des Discord Nicknames:', nickError);
        // Nicht abbrechen, da Rollen bereits zugewiesen wurden
      }

      // discordRolesAssigned Flag setzen
      const updatedApplication = await prisma.application.update({
        where: { id },
        data: {
          discordRolesAssigned: true,
        },
        include: {
          createdBy: {
            select: {
              displayName: true,
              username: true,
            },
          },
        },
      });

      // Live-Update broadcast
      broadcastUpdate('application', updatedApplication);

      res.json({
        success: true,
        application: updatedApplication,
        rolesAssigned: roleResult.assigned.length,
        rolesFailed: roleResult.failed.length,
        nicknameUpdated,
      });
    } catch (roleError) {
      console.error('Fehler beim Zuweisen der Discord-Rollen:', roleError);
      res.status(500).json({ error: 'Fehler beim Zuweisen der Discord-Rollen' });
    }
  } catch (error) {
    console.error('Assign discord roles error:', error);
    res.status(500).json({ error: 'Fehler beim Zuweisen der Discord-Rollen' });
  }
});

// PUT Bewerbung abschließen (erstellt Mitarbeiter)
router.put('/:id/complete', authMiddleware, requirePermission('hr.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const application = await prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      res.status(404).json({ error: 'Bewerbung nicht gefunden' });
      return;
    }

    if (!application.discordId) {
      res.status(400).json({ error: 'Discord ID ist erforderlich' });
      return;
    }

    // Prüfe Blacklist
    const blacklistEntry = await prisma.blacklist.findUnique({
      where: { discordId: application.discordId },
    });

    if (blacklistEntry && (!blacklistEntry.expiresAt || new Date(blacklistEntry.expiresAt) > new Date())) {
      res.status(400).json({
        error: 'BLACKLISTED',
        message: `Bewerber ist auf der Blacklist: ${blacklistEntry.reason}`,
      });
      return;
    }

    // User erstellen/finden
    let user = await prisma.user.findUnique({
      where: { discordId: application.discordId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          discordId: application.discordId,
          username: application.discordUsername || application.applicantName,
          displayName: application.applicantName,
        },
      });
    }

    // Discord Nickname wird später mit Dienstnummer gesetzt (nach Mitarbeiter-Erstellung)

    // Discord-Rollen aus Admin-Einstellungen zuweisen
    try {
      const hireRolesSetting = await prisma.systemSetting.findUnique({
        where: { key: 'hrOnboardingRoleIds' },
      });

      if (hireRolesSetting?.value) {
        // Unterstütze sowohl kommaseparierte IDs als auch JSON-Array
        let roleIds: string[] = [];
        try {
          roleIds = JSON.parse(hireRolesSetting.value) as string[];
        } catch {
          // Fallback: kommaseparierte IDs
          roleIds = hireRolesSetting.value.split(',').map(id => id.trim()).filter(Boolean);
        }

        if (roleIds && roleIds.length > 0) {
          const roleResult = await assignHireRoles(application.discordId, roleIds);
          console.log(`Discord Rollen zugewiesen: ${roleResult.assigned.length} erfolgreich, ${roleResult.failed.length} fehlgeschlagen`);
        }
      }
    } catch (roleError) {
      console.error('Fehler beim Zuweisen der Discord-Rollen:', roleError);
      // Nicht abbrechen, da das kein kritischer Fehler ist
    }

    // Prüfe ob bereits aktiver Mitarbeiter
    const existingEmployee = await prisma.employee.findUnique({
      where: { userId: user.id },
    });

    if (existingEmployee) {
      if (existingEmployee.status === 'ACTIVE') {
        res.status(400).json({ error: 'Diese Person ist bereits als aktiver Mitarbeiter registriert' });
        return;
      }

      // Wenn inaktiver/gekündigter Mitarbeiter existiert, reaktivieren wir ihn
      console.log(`Reaktiviere ehemaligen Mitarbeiter ${user.displayName} (Employee ID: ${existingEmployee.id})`);

      // Einstellung für Start-Rang laden
      const startRankSettingReactivate = await prisma.systemSetting.findUnique({
        where: { key: 'hrStartingRank' }
      });
      const startRankReactivate = startRankSettingReactivate?.value || 'Recruit';
      const startRankLevelReactivate = RANK_TO_LEVEL[startRankReactivate] || 1;

      // Neue Dienstnummer vergeben
      const teamConfigReactivate = getTeamConfigForLevel(startRankLevelReactivate);
      let newBadgeNumber: string | null = null;
      try {
        newBadgeNumber = await findFreeBadgeNumber(teamConfigReactivate.badgeMin, teamConfigReactivate.badgeMax, teamConfigReactivate.badgePrefix);
      } catch (badgeError) {
        console.error('Fehler bei der Dienstnummer-Vergabe:', badgeError);
      }

      // Employee reaktivieren mit neuem Rang und Dienstnummer
      const reactivatedEmployee = await prisma.employee.update({
        where: { id: existingEmployee.id },
        data: {
          status: 'ACTIVE',
          rank: startRankReactivate,
          rankLevel: startRankLevelReactivate,
          badgeNumber: newBadgeNumber,
          department: 'Patrol', // Reset auf Standard-Abteilung
          hireDate: new Date(), // Neues Einstellungsdatum
          notes: null, // Alte Notizen löschen
        },
      });

      // Discord Nickname aktualisieren
      try {
        const nickname = newBadgeNumber
          ? `[${newBadgeNumber}] ${application.applicantName}`
          : application.applicantName;
        await updateDiscordNickname(application.discordId, nickname);

        await prisma.user.update({
          where: { id: user.id },
          data: { displayName: nickname },
        });
      } catch (nickError) {
        console.error('Fehler beim Setzen des Discord Nicknames:', nickError);
      }

      // Bewerbung abschließen
      const updatedApplicationReactivate = await prisma.application.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          currentStep: 4,
          processedById: req.user!.id,
          processedAt: new Date(),
        },
        include: {
          createdBy: { select: { displayName: true, username: true } },
          processedBy: { select: { displayName: true, username: true } },
        },
      });

      // Bonus-Trigger
      const processorEmployeeIdReactivate = await getEmployeeIdFromUserId(req.user!.id);
      if (processorEmployeeIdReactivate) {
        await triggerApplicationCompleted(processorEmployeeIdReactivate, application.applicantName, id);
        await triggerApplicationOnboarding(processorEmployeeIdReactivate, application.applicantName, id);
      }

      // Discord Announcement
      const hiredByNameReactivate = updatedApplicationReactivate.processedBy?.displayName || updatedApplicationReactivate.processedBy?.username || 'Unbekannt';
      await announceHire({
        employeeName: application.applicantName,
        employeeAvatar: null,
        rank: startRankReactivate,
        badgeNumber: reactivatedEmployee.badgeNumber || 'Noch nicht zugewiesen',
        hiredBy: hiredByNameReactivate,
      });

      // Live-Updates
      broadcastUpdate('application', updatedApplicationReactivate);
      broadcastUpdate('employee', reactivatedEmployee);

      // Leitstelle API Event
      emitEmployeeHired({
        id: reactivatedEmployee.id,
        badgeNumber: reactivatedEmployee.badgeNumber,
        name: application.applicantName,
        discordId: application.discordId,
        rank: startRankReactivate,
        rankLevel: startRankLevelReactivate,
        units: [],
        status: 'ACTIVE',
      });

      res.json({
        application: updatedApplicationReactivate,
        employee: reactivatedEmployee,
        message: `${application.applicantName} wurde als ${startRankReactivate} wiedereingestellt`,
        reactivated: true,
      });
      return;
    }

    // Einstellung fuer Start-Rang laden
    const startRankSetting = await prisma.systemSetting.findUnique({
      where: { key: 'hrStartingRank' }
    });

    const startRank = startRankSetting?.value || 'Recruit';
    const startRankLevel = RANK_TO_LEVEL[startRank] || 1;

    // Dienstnummer basierend auf dem Team-Bereich generieren
    const teamConfig = getTeamConfigForLevel(startRankLevel);
    let badgeNumber: string | null = null;
    try {
      badgeNumber = await findFreeBadgeNumber(teamConfig.badgeMin, teamConfig.badgeMax, teamConfig.badgePrefix);
      if (badgeNumber) {
        console.log(`Dienstnummer ${badgeNumber} fuer neuen Mitarbeiter ${application.applicantName} vergeben`);
      } else {
        console.warn(`Keine freie Dienstnummer im Bereich ${teamConfig.badgePrefix}-${teamConfig.badgeMin} bis ${teamConfig.badgeMax}`);
      }
    } catch (badgeError) {
      console.error('Fehler bei der Dienstnummer-Vergabe:', badgeError);
    }

    // Mitarbeiter erstellen
    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        rank: startRank,
        rankLevel: startRankLevel,
        badgeNumber: badgeNumber,
        status: 'ACTIVE',
      },
    });

    // Discord Nickname automatisch setzen MIT Dienstnummer
    try {
      const nickname = badgeNumber
        ? `[${badgeNumber}] ${application.applicantName}`
        : application.applicantName;
      await updateDiscordNickname(application.discordId, nickname);
      console.log(`Discord Nickname für ${application.discordId} auf "${nickname}" gesetzt`);

      // User displayName auch aktualisieren
      await prisma.user.update({
        where: { id: user.id },
        data: { displayName: nickname },
      });
    } catch (nickError) {
      console.error('Fehler beim Setzen des Discord Nicknames:', nickError);
      // Nicht abbrechen, da das kein kritischer Fehler ist
    }

    // Bewerbung abschließen
    const updatedApplication = await prisma.application.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        currentStep: 4,
        processedById: req.user!.id,
        processedAt: new Date(),
      },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
        processedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    // Bonus-Trigger für abgeschlossene Bewerbung
    const processorEmployeeId = await getEmployeeIdFromUserId(req.user!.id);
    if (processorEmployeeId) {
      await triggerApplicationCompleted(processorEmployeeId, application.applicantName, id);
      await triggerApplicationOnboarding(processorEmployeeId, application.applicantName, id);
    }

    // Discord Announcement fuer Neueinstellung senden
    const hiredByName = updatedApplication.processedBy?.displayName || updatedApplication.processedBy?.username || 'Unbekannt';
    await announceHire({
      employeeName: application.applicantName,
      employeeAvatar: null, // Avatar noch nicht verfuegbar
      rank: startRank,
      badgeNumber: employee.badgeNumber || 'Noch nicht zugewiesen',
      hiredBy: hiredByName,
    });

    // Live-Update broadcast
    broadcastUpdate('application', updatedApplication);
    broadcastCreate('employee', employee);

    // Leitstelle API Event: Einstellung
    emitEmployeeHired({
      id: employee.id,
      badgeNumber: employee.badgeNumber,
      name: application.applicantName,
      discordId: application.discordId,
      rank: startRank,
      rankLevel: startRankLevel,
      units: [],
      status: 'ACTIVE',
    });

    res.json({
      application: updatedApplication,
      employee,
      message: `${application.applicantName} wurde als ${startRank} eingestellt`,
    });
  } catch (error) {
    console.error('Complete application error:', error);
    res.status(500).json({ error: 'Fehler beim Abschließen der Bewerbung' });
  }
});

// PUT Bewerbung ablehnen
router.put('/:id/reject', authMiddleware, requirePermission('hr.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rejectionReason, addToBlacklist, blacklistReason, blacklistExpires } = req.body;

    if (!rejectionReason) {
      res.status(400).json({ error: 'Ablehnungsgrund ist erforderlich' });
      return;
    }

    const application = await prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      res.status(404).json({ error: 'Bewerbung nicht gefunden' });
      return;
    }

    // Optional: Zur Blacklist hinzufügen
    if (addToBlacklist && application.discordId) {
      const existingBlacklist = await prisma.blacklist.findUnique({
        where: { discordId: application.discordId },
      });

      if (!existingBlacklist) {
        await prisma.blacklist.create({
          data: {
            discordId: application.discordId,
            username: application.discordUsername || application.applicantName,
            reason: blacklistReason || rejectionReason,
            expiresAt: blacklistExpires ? new Date(blacklistExpires) : null,
            addedById: req.user!.id,
          },
        });
      }
    }

    const updatedApplication = await prisma.application.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason,
        processedById: req.user!.id,
        processedAt: new Date(),
      },
      include: {
        createdBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
        processedBy: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });

    // Bonus-Trigger für abgelehnte Bewerbung
    const processorEmployeeId = await getEmployeeIdFromUserId(req.user!.id);
    if (processorEmployeeId) {
      await triggerApplicationRejected(processorEmployeeId, application.applicantName, id);
    }

    // Live-Update broadcast
    broadcastUpdate('application', updatedApplication);

    res.json(updatedApplication);
  } catch (error) {
    console.error('Reject application error:', error);
    res.status(500).json({ error: 'Fehler beim Ablehnen der Bewerbung' });
  }
});

// DELETE Bewerbung löschen
router.delete('/:id', authMiddleware, requirePermission('hr.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Lösche zugehöriges Bild
    const application = await prisma.application.findUnique({
      where: { id },
      select: { idCardImage: true },
    });

    if (application?.idCardImage) {
      const imagePath = path.join(uploadDir, application.idCardImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await prisma.application.delete({ where: { id } });

    // Live-Update broadcast
    broadcastDelete('application', id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete application error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Bewerbung' });
  }
});

export default router;
