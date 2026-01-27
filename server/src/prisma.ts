import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// SQLite Performance-Optimierungen: WAL-Modus und Busy-Timeout
async function initSqliteOptimizations() {
  try {
    // WAL-Modus: Erlaubt gleichzeitiges Lesen während des Schreibens
    // PRAGMA-Befehle geben Ergebnisse zurück, daher $queryRawUnsafe verwenden
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    // Busy-Timeout: Wartet 10 Sekunden bei Locks statt sofort zu failen
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 10000;');
    // Synchronous NORMAL: Schneller als FULL, aber immer noch sicher mit WAL
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
    // Cache-Size erhöhen (negative Werte = KB, hier 64MB)
    await prisma.$queryRawUnsafe('PRAGMA cache_size = -65536;');
    console.log('[DB] SQLite-Optimierungen aktiviert (WAL-Modus, Busy-Timeout 10s, Cache 64MB)');
  } catch (error) {
    console.error('[DB] Fehler bei SQLite-Optimierungen:', error);
  }
}

initSqliteOptimizations();
