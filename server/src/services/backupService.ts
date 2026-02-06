import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, '../../backups');
const DB_PATH = path.join(__dirname, '../../prisma/dev.db');
const RETENTION_DAYS = 7;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Jede Stunde prüfen

// Stelle sicher, dass der Backup-Ordner existiert
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function createAutoBackup(): Promise<void> {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.log('[Auto-Backup] Datenbank nicht gefunden, überspringe Backup');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `auto_backup_${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, filename);

    // Kopiere Datenbank
    fs.copyFileSync(DB_PATH, backupPath);
    const stats = fs.statSync(backupPath);

    // In DB speichern
    await prisma.backup.create({
      data: {
        filename,
        size: stats.size,
        path: backupPath,
        status: 'AUTO',
      },
    });

    console.log(`[Auto-Backup] Backup erstellt: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (error) {
    console.error('[Auto-Backup] Fehler beim Erstellen:', error);
  }
}

async function cleanupOldBackups(): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    // Finde alte automatische Backups
    const oldBackups = await prisma.backup.findMany({
      where: {
        status: 'AUTO',
        createdAt: { lt: cutoffDate },
      },
    });

    for (const backup of oldBackups) {
      // Lösche Datei
      if (fs.existsSync(backup.path)) {
        fs.unlinkSync(backup.path);
      }
      // Lösche DB-Eintrag
      await prisma.backup.delete({ where: { id: backup.id } });
    }

    if (oldBackups.length > 0) {
      console.log(`[Auto-Backup] ${oldBackups.length} alte Backup(s) gelöscht (älter als ${RETENTION_DAYS} Tage)`);
    }
  } catch (error) {
    console.error('[Auto-Backup] Fehler beim Aufräumen:', error);
  }
}

async function checkAndRunDailyBackup(): Promise<void> {
  try {
    // Prüfe ob heute schon ein Auto-Backup erstellt wurde
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayBackup = await prisma.backup.findFirst({
      where: {
        status: 'AUTO',
        createdAt: { gte: today },
      },
    });

    if (!todayBackup) {
      await createAutoBackup();
      await cleanupOldBackups();
    }
  } catch (error) {
    console.error('[Auto-Backup] Fehler bei täglicher Prüfung:', error);
  }
}

export function initializeAutoBackup(): void {
  // Erstes Backup nach 30 Sekunden (Server-Start abwarten)
  setTimeout(() => {
    checkAndRunDailyBackup();
  }, 30000);

  // Dann stündlich prüfen
  setInterval(() => {
    checkAndRunDailyBackup();
  }, CHECK_INTERVAL_MS);

  console.log(`[Auto-Backup] Service gestartet (täglich, ${RETENTION_DAYS} Tage Aufbewahrung)`);
}
