import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma.js';
import { getAllMembersWithRoles } from '../services/discordBot.js';

const router = Router();

// Cache fuer Mitarbeiter-Units (5 Minuten TTL)
interface UnitCache {
  data: Map<string, string[]>;
  timestamp: number;
}
let unitCache: UnitCache | null = null;
const UNIT_CACHE_TTL = 5 * 60 * 1000; // 5 Minuten

function isUnitCacheValid(): boolean {
  return unitCache !== null && (Date.now() - unitCache.timestamp) < UNIT_CACHE_TTL;
}

// Bekannte Haupt-Units (Main Units) - nur diese werden zurueckgegeben
const MAIN_UNITS = [
  'S.W.A.T.',
  'Detectives',
  'Highway Patrol',
  'Air Support',
  'Internal Affairs',
  'Quality Assurance',
  'F.T.O.',
  'Leitstelle',
  'Human Resources',
  'Police Academy',
];

// Unit-Rollen Mapping (synchronisiert mit discordBot.ts)
const UNIT_ROLES: Record<string, { unit: string; isBase: boolean }> = {
  // S.W.A.T.
  '» Special Weapons and Tactics': { unit: 'S.W.A.T.', isBase: true },
  '» S.W.A.T. Rookie': { unit: 'S.W.A.T.', isBase: false },
  '» S.W.A.T. Officer': { unit: 'S.W.A.T.', isBase: false },
  '» S.W.A.T. Sergeant': { unit: 'S.W.A.T.', isBase: false },
  '» S.W.A.T. Commander': { unit: 'S.W.A.T.', isBase: false },
  '» Co-Director of S.W.A.T.': { unit: 'S.W.A.T.', isBase: false },
  '» Director of S.W.A.T.': { unit: 'S.W.A.T.', isBase: false },
  // Detectives
  '» Detectives': { unit: 'Detectives', isBase: true },
  '» Detective Trainee': { unit: 'Detectives', isBase: false },
  '» Detective Member': { unit: 'Detectives', isBase: false },
  '» Detective Instructor': { unit: 'Detectives', isBase: false },
  '» Co. Director of Detectives': { unit: 'Detectives', isBase: false },
  '» Director of Detectives': { unit: 'Detectives', isBase: false },
  // Highway Patrol
  '» State Highway Patrol': { unit: 'Highway Patrol', isBase: true },
  '» S.H.P. Rookie': { unit: 'Highway Patrol', isBase: false },
  '» S.H.P. Trooper': { unit: 'Highway Patrol', isBase: false },
  '» S.H.P. Senior Trooper': { unit: 'Highway Patrol', isBase: false },
  '» S.H.P. Head Trooper': { unit: 'Highway Patrol', isBase: false },
  '» Co-Director of S.H.P': { unit: 'Highway Patrol', isBase: false },
  '» Director of S.H.P': { unit: 'Highway Patrol', isBase: false },
  // Air Support Division (aktualisiert nach discordBot.ts)
  '» Air Support Division': { unit: 'Air Support', isBase: true },
  '» A.S.D. Flight Student': { unit: 'Air Support', isBase: false },
  '» A.S.D. Flight Officer': { unit: 'Air Support', isBase: false },
  '» A.S.D. Flight Instructor': { unit: 'Air Support', isBase: false },
  '» Co-Director of ASD': { unit: 'Air Support', isBase: false },
  '» Director of ASD': { unit: 'Air Support', isBase: false },
  // Internal Affairs (aktualisiert nach discordBot.ts)
  '» Internal Affairs': { unit: 'Internal Affairs', isBase: true },
  '» Instructor of Internal Affairs': { unit: 'Internal Affairs', isBase: false },
  '» Co. Director of Internal Affairs': { unit: 'Internal Affairs', isBase: false },
  '» Director of Internal Affairs': { unit: 'Internal Affairs', isBase: false },
  // Human Resources
  '» Human Resources': { unit: 'Human Resources', isBase: true },
  '» Instructor of H.R.': { unit: 'Human Resources', isBase: false },
  '» Co. Director of H.R.': { unit: 'Human Resources', isBase: false },
  '» Director of Human Resources': { unit: 'Human Resources', isBase: false },
  // Quality Assurance (aktualisiert nach discordBot.ts)
  '» Quality Assurance': { unit: 'Quality Assurance', isBase: true },
  '» Instructor of Quality Assurance': { unit: 'Quality Assurance', isBase: false },
  '» Co. Director of Quality Assurance': { unit: 'Quality Assurance', isBase: false },
  '» Director of Quality Assurance': { unit: 'Quality Assurance', isBase: false },
  // F.T.O. (Field Training Officer) - nicht in discordBot.ts gefunden, behalte original
  '» Field Training Officer': { unit: 'F.T.O.', isBase: true },
  '» F.T.O. Instructor': { unit: 'F.T.O.', isBase: false },
  '» F.T.O. Senior Instructor': { unit: 'F.T.O.', isBase: false },
  '» Co-Director of F.T.O.': { unit: 'F.T.O.', isBase: false },
  '» Director of F.T.O.': { unit: 'F.T.O.', isBase: false },
  // Leitstelle - nicht in discordBot.ts gefunden, behalte original
  '» Leitstelle': { unit: 'Leitstelle', isBase: true },
  '» Leitstelle Agent': { unit: 'Leitstelle', isBase: false },
  '» Leitstelle Senior Agent': { unit: 'Leitstelle', isBase: false },
  '» Co-Director of Leitstelle': { unit: 'Leitstelle', isBase: false },
  '» Director of Leitstelle': { unit: 'Leitstelle', isBase: false },
  // Police Academy (aus discordBot.ts)
  '» Police Academy': { unit: 'Police Academy', isBase: true },
  '» Instructor of Police Academy': { unit: 'Police Academy', isBase: false },
  '» Co. Director of P.A.': { unit: 'Police Academy', isBase: false },
  '» Director of Police Academy': { unit: 'Police Academy', isBase: false },
};

// API-Key Middleware
async function apiKeyMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey) {
    res.status(401).json({ error: 'API-Key erforderlich', code: 'MISSING_API_KEY' });
    return;
  }

  // API-Key aus Einstellungen laden
  const apiKeySetting = await prisma.systemSetting.findUnique({
    where: { key: 'leitstelleExternalApiKey' },
  });

  if (!apiKeySetting?.value || apiKey !== apiKeySetting.value) {
    res.status(401).json({ error: 'Ungueltiger API-Key', code: 'INVALID_API_KEY' });
    return;
  }

  next();
}

// Hilfsfunktion um Units aus Discord-Rollen zu extrahieren
function extractUnitsFromRoles(roleNames: string[]): string[] {
  const units = new Set<string>();

  for (const roleName of roleNames) {
    const unitInfo = UNIT_ROLES[roleName];
    if (unitInfo && MAIN_UNITS.includes(unitInfo.unit)) {
      units.add(unitInfo.unit);
    }
  }

  return Array.from(units);
}

// Interface fuer Leitstelle Response
interface LeitstelleEmployee {
  id: string;
  badgeNumber: string | null;
  name: string;
  discordId: string;
  rank: string;
  rankLevel: number;
  units: string[];
  status: string;
}

// =====================================================
// API ENDPOINTS
// =====================================================

// GET /api/leitstelle-external/status - API Status pruefen
router.get('/status', async (_req: Request, res: Response) => {
  const apiKeySetting = await prisma.systemSetting.findUnique({
    where: { key: 'leitstelleExternalApiKey' },
  });

  res.json({
    configured: !!apiKeySetting?.value,
    version: '1.0.0',
    endpoints: [
      'GET /api/leitstelle-external/employees - Alle Mitarbeiter abrufen',
      'GET /api/leitstelle-external/employees/:id - Einzelnen Mitarbeiter abrufen',
      'WS /api/leitstelle-external/events - WebSocket fuer Live-Updates',
    ],
  });
});

// GET /api/leitstelle-external/employees - Alle aktiven Mitarbeiter
router.get('/employees', apiKeyMiddleware, async (_req: Request, res: Response) => {
  try {
    const employees = await prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            discordId: true,
            displayName: true,
            username: true,
          },
        },
      },
      orderBy: [
        { rankLevel: 'desc' },
        { badgeNumber: 'asc' },
      ],
    });

    // Units aus Cache oder neu laden
    let unitsMap: Map<string, string[]>;

    if (isUnitCacheValid() && unitCache) {
      unitsMap = unitCache.data;
    } else {
      // OPTIMIERT: Alle Discord-Rollen auf einmal holen (cached in discordBot.ts)
      unitsMap = new Map<string, string[]>();
      const allMemberRoles = await getAllMembersWithRoles();

      for (const emp of employees) {
        if (emp.user.discordId) {
          const memberRoles = allMemberRoles.get(emp.user.discordId);
          if (memberRoles) {
            unitsMap.set(emp.user.discordId, extractUnitsFromRoles(memberRoles.map(r => r.name)));
          } else {
            unitsMap.set(emp.user.discordId, []);
          }
        }
      }

      // Cache aktualisieren
      unitCache = { data: unitsMap, timestamp: Date.now() };
    }

    // Result zusammenbauen
    const result: LeitstelleEmployee[] = employees.map((emp) => ({
      id: emp.id,
      badgeNumber: emp.badgeNumber,
      name: emp.user.displayName || emp.user.username,
      discordId: emp.user.discordId,
      rank: emp.rank,
      rankLevel: emp.rankLevel,
      units: unitsMap.get(emp.user.discordId) || [],
      status: emp.status,
    }));

    res.json({
      success: true,
      count: result.length,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Leitstelle API - Fehler beim Abrufen der Mitarbeiter:', error);
    res.status(500).json({ error: 'Interner Serverfehler', code: 'INTERNAL_ERROR' });
  }
});

// GET /api/leitstelle-external/employees/:id - Einzelner Mitarbeiter
router.get('/employees/:id', apiKeyMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { id },
          { badgeNumber: id },
          { user: { discordId: id } },
        ],
      },
      include: {
        user: {
          select: {
            discordId: true,
            displayName: true,
            username: true,
          },
        },
      },
    });

    if (!employee) {
      res.status(404).json({ error: 'Mitarbeiter nicht gefunden', code: 'NOT_FOUND' });
      return;
    }

    let units: string[] = [];
    try {
      if (employee.user.discordId) {
        const memberRoles = await getMemberRoles(employee.user.discordId);
        if (memberRoles) {
          units = extractUnitsFromRoles(memberRoles.map(r => r.name));
        }
      }
    } catch (error) {
      console.error(`Fehler beim Laden der Rollen:`, error);
    }

    const result: LeitstelleEmployee = {
      id: employee.id,
      badgeNumber: employee.badgeNumber,
      name: employee.user.displayName || employee.user.username,
      discordId: employee.user.discordId,
      rank: employee.rank,
      rankLevel: employee.rankLevel,
      units,
      status: employee.status,
    };

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Leitstelle API - Fehler:', error);
    res.status(500).json({ error: 'Interner Serverfehler', code: 'INTERNAL_ERROR' });
  }
});

export default router;
