/**
 * Leitstelle-CC.de API Service
 *
 * Holt Dienstzeiten von der Leitstelle-API für Mitarbeiter
 */

// Cache für API-Daten (5 Minuten TTL)
interface CacheEntry {
  data: LeitstelleResponse;
  timestamp: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 Minuten

// API Response Types
export interface DutyStats {
  total: { hours: number; minutes: number };
  week: { hours: number; minutes: number };
  month: { hours: number; minutes: number };
  last_session: {
    start: string;
    end: string;
    active: boolean;
  };
  requested_range?: {
    start: string;
    end: string;
    hours: number;
    total_minutes: number;
  };
}

export interface LeitstelleEmployee {
  discord_id: string;
  display_name: string;
  stats: DutyStats;
}

export interface LeitstelleResponse {
  success: boolean;
  data: LeitstelleEmployee[];
}

// Formatierte Dienstzeit für Frontend
export interface FormattedDutyTime {
  discordId: string;
  displayName: string;
  total: string;
  totalMinutes: number;
  week: string;
  weekMinutes: number;
  month: string;
  monthMinutes: number;
  lastSession: {
    start: string | null;
    end: string | null;
    active: boolean;
    duration: string | null;
  };
  requestedRange?: {
    start: string;
    end: string;
    duration: string;
    totalMinutes: number;
  };
}

/**
 * Formatiert Minuten in lesbare Stunden:Minuten
 */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

/**
 * Berechnet Dauer zwischen zwei Zeitpunkten
 */
function calculateSessionDuration(start: string, end: string): string | null {
  try {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    return formatDuration(diffMins);
  } catch {
    return null;
  }
}

/**
 * Holt alle Dienstzeiten von der Leitstelle-API
 */
export async function fetchAllDutyTimes(rangeStart?: string): Promise<LeitstelleResponse | null> {
  const apiKey = process.env.LEITSTELLE_API_KEY;

  if (!apiKey) {
    console.error('LEITSTELLE_API_KEY nicht konfiguriert');
    return null;
  }

  // Cache prüfen (nur wenn kein spezifischer Range angefragt wird)
  if (!rangeStart && cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  try {
    let url = `https://leitstelle-cc.de/api/export_all_duty_times.php?api_key=${encodeURIComponent(apiKey)}`;

    if (rangeStart) {
      url += `&range_start=${encodeURIComponent(rangeStart)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Leitstelle API Fehler: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json() as LeitstelleResponse;

    if (!data.success) {
      console.error('Leitstelle API: Erfolg = false');
      return null;
    }

    // Cache aktualisieren (nur Standard-Abfragen)
    if (!rangeStart) {
      cache = {
        data,
        timestamp: Date.now(),
      };
    }

    return data;
  } catch (error) {
    console.error('Leitstelle API Fehler:', error);
    return null;
  }
}

/**
 * Holt Dienstzeiten für einen bestimmten Mitarbeiter (nach Discord-ID)
 */
export async function getDutyTimeByDiscordId(
  discordId: string,
  rangeStart?: string
): Promise<FormattedDutyTime | null> {
  const response = await fetchAllDutyTimes(rangeStart);

  if (!response || !response.data) {
    return null;
  }

  const employee = response.data.find(e => e.discord_id === discordId);

  if (!employee) {
    return null;
  }

  return formatEmployeeDutyTime(employee);
}

/**
 * Holt Dienstzeiten für mehrere Mitarbeiter
 */
export async function getDutyTimesForDiscordIds(
  discordIds: string[],
  rangeStart?: string
): Promise<Map<string, FormattedDutyTime>> {
  const response = await fetchAllDutyTimes(rangeStart);
  const result = new Map<string, FormattedDutyTime>();

  if (!response || !response.data) {
    return result;
  }

  const discordIdSet = new Set(discordIds);

  for (const employee of response.data) {
    if (discordIdSet.has(employee.discord_id)) {
      result.set(employee.discord_id, formatEmployeeDutyTime(employee));
    }
  }

  return result;
}

/**
 * Formatiert einen Mitarbeiter-Eintrag für das Frontend
 */
function formatEmployeeDutyTime(employee: LeitstelleEmployee): FormattedDutyTime {
  const { stats } = employee;

  const formatted: FormattedDutyTime = {
    discordId: employee.discord_id,
    displayName: employee.display_name,
    total: formatDuration(stats.total.minutes),
    totalMinutes: stats.total.minutes,
    week: formatDuration(stats.week.minutes),
    weekMinutes: stats.week.minutes,
    month: formatDuration(stats.month.minutes),
    monthMinutes: stats.month.minutes,
    lastSession: {
      start: stats.last_session.start || null,
      end: stats.last_session.end || null,
      active: stats.last_session.active,
      duration: stats.last_session.start && stats.last_session.end
        ? calculateSessionDuration(stats.last_session.start, stats.last_session.end)
        : null,
    },
  };

  if (stats.requested_range) {
    formatted.requestedRange = {
      start: stats.requested_range.start,
      end: stats.requested_range.end,
      duration: formatDuration(stats.requested_range.total_minutes),
      totalMinutes: stats.requested_range.total_minutes,
    };
  }

  return formatted;
}

/**
 * Leert den Cache (z.B. für manuelle Aktualisierung)
 */
export function clearDutyTimeCache(): void {
  cache = null;
}

/**
 * Prüft ob die Leitstelle-API konfiguriert ist
 */
export function isLeitstelleConfigured(): boolean {
  return !!process.env.LEITSTELLE_API_KEY;
}
