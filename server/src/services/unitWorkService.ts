import { prisma } from '../prisma.js';
import { getMemberRoles } from './discordBot.js';

// Hilfsfunktion: Berechnet Start und Ende der aktuellen Woche (Mo 00:00 - So 23:59)
export function getCurrentWeekRange(): { weekStart: Date; weekEnd: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  // Montag = 1, Sonntag = 0 -> Anpassung: Sonntag als 7 behandeln
  const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek;

  // Montag dieser Woche
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - adjustedDay + 1);
  weekStart.setHours(0, 0, 0, 0);

  // Sonntag dieser Woche 23:59:59
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

// Holt oder erstellt den Log-Eintrag für die aktuelle Woche einer Unit
export async function getOrCreateWeeklyLog(unitId: string) {
  const { weekStart, weekEnd } = getCurrentWeekRange();

  // Versuche existierenden Eintrag zu finden
  let log = await prisma.unitWorkLog.findUnique({
    where: {
      unitId_weekStart: {
        unitId,
        weekStart,
      },
    },
  });

  // Wenn nicht vorhanden, erstelle neuen
  if (!log) {
    log = await prisma.unitWorkLog.create({
      data: {
        unitId,
        weekStart,
        weekEnd,
      },
    });
  }

  return log;
}

// Aktivitäts-Typen
export type ActivityType =
  | 'casesCompleted'
  | 'tasksCompleted'
  | 'trainingsCompleted'
  | 'investigationsCompleted'
  | 'applicationsProcessed';

// Erhöht einen Aktivitäts-Zähler für eine Unit
export async function incrementUnitActivity(unitId: string, activityType: ActivityType, count = 1) {
  const log = await getOrCreateWeeklyLog(unitId);

  return prisma.unitWorkLog.update({
    where: { id: log.id },
    data: {
      [activityType]: {
        increment: count,
      },
    },
  });
}

// Holt die Units eines Benutzers basierend auf seiner Discord-ID
export async function getUserUnits(discordId: string): Promise<string[]> {
  try {
    // Discord-Rollen des Benutzers holen
    const memberRoles = await getMemberRoles(discordId);
    if (!memberRoles || memberRoles.length === 0) {
      return [];
    }

    const roleIds = memberRoles.map(r => r.id);

    // Units finden, die mindestens eine dieser Rollen haben
    const unitRoles = await prisma.unitRole.findMany({
      where: {
        discordRoleId: { in: roleIds },
      },
      select: {
        unitId: true,
      },
    });

    // Einzigartige Unit-IDs zurückgeben
    return [...new Set(unitRoles.map(ur => ur.unitId))];
  } catch (error) {
    console.error('[UnitWorkService] Fehler beim Abrufen der User-Units:', error);
    return [];
  }
}

// Erhöht Aktivität für alle Units eines Benutzers
export async function trackUserActivity(
  discordId: string,
  activityType: ActivityType,
  count = 1
): Promise<void> {
  try {
    const unitIds = await getUserUnits(discordId);

    if (unitIds.length === 0) {
      return; // Benutzer gehört zu keiner Unit
    }

    // Für alle Units des Benutzers die Aktivität erhöhen
    await Promise.all(
      unitIds.map(unitId => incrementUnitActivity(unitId, activityType, count))
    );

    console.log(`[UnitWorkService] ${activityType} +${count} für ${unitIds.length} Unit(s) von User ${discordId}`);
  } catch (error) {
    console.error('[UnitWorkService] Fehler beim Tracking der Aktivität:', error);
  }
}

// Hilfsfunktion: Holt Discord-ID eines Users anhand seiner User-ID
export async function getDiscordIdByUserId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { discordId: true },
  });
  return user?.discordId || null;
}

// Convenience-Funktion: Trackt Aktivität anhand der User-ID
export async function trackActivityByUserId(
  userId: string,
  activityType: ActivityType,
  count = 1
): Promise<void> {
  const discordId = await getDiscordIdByUserId(userId);
  if (!discordId) {
    console.log(`[UnitWorkService] Keine Discord-ID für User ${userId} gefunden`);
    return;
  }
  await trackUserActivity(discordId, activityType, count);
}

// Holt die Statistiken aller Units für die aktuelle Woche
export async function getCurrentWeekStats() {
  const { weekStart, weekEnd } = getCurrentWeekRange();

  // Alle aktiven Units mit ihren Logs holen
  const units = await prisma.unit.findMany({
    where: { isActive: true },
    include: {
      workLogs: {
        where: {
          weekStart: weekStart,
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  return units.map(unit => {
    const log = unit.workLogs[0];
    return {
      unitId: unit.id,
      unitName: unit.name,
      shortName: unit.shortName,
      color: unit.color,
      icon: unit.icon,
      weekStart,
      weekEnd,
      stats: log ? {
        casesCompleted: log.casesCompleted,
        tasksCompleted: log.tasksCompleted,
        trainingsCompleted: log.trainingsCompleted,
        investigationsCompleted: log.investigationsCompleted,
        applicationsProcessed: log.applicationsProcessed,
        total: log.casesCompleted + log.tasksCompleted + log.trainingsCompleted +
               log.investigationsCompleted + log.applicationsProcessed,
      } : {
        casesCompleted: 0,
        tasksCompleted: 0,
        trainingsCompleted: 0,
        investigationsCompleted: 0,
        applicationsProcessed: 0,
        total: 0,
      },
    };
  });
}

// Holt historische Statistiken (letzte N Wochen)
export async function getHistoricalStats(weeks = 4) {
  const { weekStart: currentWeekStart } = getCurrentWeekRange();

  // Berechne Start der ältesten Woche
  const oldestWeekStart = new Date(currentWeekStart);
  oldestWeekStart.setDate(oldestWeekStart.getDate() - (weeks - 1) * 7);

  const logs = await prisma.unitWorkLog.findMany({
    where: {
      weekStart: {
        gte: oldestWeekStart,
      },
    },
    include: {
      unit: {
        select: {
          id: true,
          name: true,
          shortName: true,
          color: true,
          icon: true,
        },
      },
    },
    orderBy: [
      { weekStart: 'desc' },
      { unit: { sortOrder: 'asc' } },
    ],
  });

  return logs;
}

// Wöchentlicher Reset - archiviert keine Daten, da sie bereits in UnitWorkLog gespeichert sind
// Diese Funktion stellt sicher, dass neue Wochen-Einträge für die kommende Woche erstellt werden können
export async function performWeeklyReset(): Promise<void> {
  console.log('[UnitWorkService] Wöchentlicher Reset wird ausgeführt...');

  // Die alten Logs bleiben erhalten für historische Auswertungen
  // Neue Logs werden automatisch bei der ersten Aktivität der neuen Woche erstellt

  console.log('[UnitWorkService] Reset abgeschlossen. Neue Woche beginnt.');
}

// Initialisiert den wöchentlichen Reset Cron Job (Sonntag 23:59)
let resetInterval: NodeJS.Timeout | null = null;

export function initializeWeeklyResetJob(): void {
  if (resetInterval) {
    console.log('[UnitWorkService] Weekly Reset Job läuft bereits');
    return;
  }

  // Berechne Zeit bis zum nächsten Sonntag 23:59
  const scheduleNextReset = () => {
    const now = new Date();
    const nextSunday = new Date(now);

    // Finde den nächsten Sonntag
    const daysUntilSunday = (7 - now.getDay()) % 7;
    nextSunday.setDate(now.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
    nextSunday.setHours(23, 59, 0, 0);

    // Wenn wir schon nach 23:59 sind, nächste Woche
    if (now > nextSunday) {
      nextSunday.setDate(nextSunday.getDate() + 7);
    }

    const msUntilReset = nextSunday.getTime() - now.getTime();

    console.log(`[UnitWorkService] Nächster Reset: ${nextSunday.toLocaleString('de-DE')}`);

    resetInterval = setTimeout(async () => {
      await performWeeklyReset();
      // Nach dem Reset, nächsten Reset planen
      scheduleNextReset();
    }, msUntilReset);
  };

  scheduleNextReset();
  console.log('[UnitWorkService] Weekly Reset Job initialisiert');
}

export function stopWeeklyResetJob(): void {
  if (resetInterval) {
    clearTimeout(resetInterval);
    resetInterval = null;
    console.log('[UnitWorkService] Weekly Reset Job gestoppt');
  }
}
