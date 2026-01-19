import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/authMiddleware.js';
import { createInviteLink, updateDiscordNickname, assignHireRoles } from '../services/discordBot.js';
import { triggerApplicationCompleted, triggerApplicationOnboarding, triggerApplicationRejected, getEmployeeIdFromUserId } from '../services/bonusService.js';
import { announceHire } from '../services/discordAnnouncements.js';
import { broadcastCreate, broadcastUpdate, broadcastDelete } from '../services/socketService.js';
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

// Fallback Onboarding-Checkliste falls keine in DB konfiguriert
const FALLBACK_ONBOARDING_CHECKLIST = [
  { id: 'clothes', text: 'Klamotten besorgen (Dienstkleidung)' },
  { id: 'discord', text: 'Discord Rollen vergeben' },
  { id: 'inventory', text: 'Standardinventar erklärt' },
  { id: 'garage', text: 'Fahrzeuggarage erklärt' },
];

// Hilfsfunktion um Onboarding-Items zu laden (aus DB oder Fallback)
async function getOnboardingChecklist() {
  const dbItems = await prisma.onboardingItem.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  if (dbItems.length > 0) {
    return dbItems.map(item => ({ id: item.id, text: item.text }));
  }

  return FALLBACK_ONBOARDING_CHECKLIST;
}

// GET alle Bewerbungen
router.get('/', authMiddleware, requirePermission('hr.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;

    const where: Record<string, unknown> = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const applications = await prisma.application.findMany({
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
    });

    res.json(applications);
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
  { id: 'q1', text: 'Was sind deine Aufgaben als Cadet?' },
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
      // Für SQLite: Hole alle Blacklist-Einträge und prüfe manuell (case-insensitive)
      const blacklistEntries = await prisma.blacklist.findMany();

      const blacklistMatch = blacklistEntries.find(entry => {
        if (discordId && entry.discordId === discordId) return true;
        if (discordUsername && entry.username.toLowerCase() === discordUsername.toLowerCase()) return true;
        return false;
      });

      if (blacklistMatch) {
        // Prüfe ob abgelaufen
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

    // Discord Nickname automatisch setzen auf den Namen aus dem Personalsystem
    try {
      await updateDiscordNickname(application.discordId, application.applicantName);
      console.log(`Discord Nickname für ${application.discordId} auf "${application.applicantName}" gesetzt`);
    } catch (nickError) {
      console.error('Fehler beim Setzen des Discord Nicknames:', nickError);
      // Nicht abbrechen, da das kein kritischer Fehler ist
    }

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

    // Prüfe ob bereits Mitarbeiter
    const existingEmployee = await prisma.employee.findUnique({
      where: { userId: user.id },
    });

    if (existingEmployee) {
      res.status(400).json({ error: 'Diese Person ist bereits als Mitarbeiter registriert' });
      return;
    }

    // Mitarbeiter erstellen
    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        rank: 'Cadet',
        rankLevel: 1,
        department: 'Patrol',
        status: 'ACTIVE',
      },
    });

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

    // Discord Announcement für Neueinstellung senden
    const hiredByName = updatedApplication.processedBy?.displayName || updatedApplication.processedBy?.username || 'Unbekannt';
    await announceHire({
      employeeName: application.applicantName,
      employeeAvatar: null, // Avatar noch nicht verfügbar
      rank: 'Cadet',
      badgeNumber: employee.badgeNumber || 'Noch nicht zugewiesen',
      hiredBy: hiredByName,
    });

    // Live-Update broadcast
    broadcastUpdate('application', updatedApplication);
    broadcastCreate('employee', employee);

    res.json({
      application: updatedApplication,
      employee,
      message: `${application.applicantName} wurde als Cadet eingestellt`,
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
