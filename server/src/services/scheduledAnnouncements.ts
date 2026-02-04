import { prisma } from '../prisma.js';
import { sendAnnouncementToChannel } from './discordBot.js';

// Prüft und sendet fällige geplante Ankündigungen
export async function processScheduledAnnouncements(): Promise<void> {
  try {
    const now = new Date();

    // Finde alle geplanten Ankündigungen, deren Zeit gekommen ist
    const dueAnnouncements = await prisma.announcement.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          lte: now,
        },
      },
    });

    if (dueAnnouncements.length === 0) return;

    console.log(`[ScheduledAnnouncements] ${dueAnnouncements.length} geplante Ankündigung(en) werden gesendet...`);

    for (const announcement of dueAnnouncements) {
      try {
        if (!announcement.channelId) {
          // Kein Kanal ausgewählt - als fehlgeschlagen markieren
          await prisma.announcement.update({
            where: { id: announcement.id },
            data: {
              status: 'FAILED',
              errorMessage: 'Kein Kanal ausgewählt',
            },
          });
          console.error(`[ScheduledAnnouncements] Ankündigung ${announcement.id}: Kein Kanal ausgewählt`);
          continue;
        }

        // An Discord senden
        const messageId = await sendAnnouncementToChannel(
          announcement.channelId,
          announcement.title,
          announcement.content
        );

        // Erfolgreich - Status aktualisieren
        await prisma.announcement.update({
          where: { id: announcement.id },
          data: {
            status: 'SENT',
            messageId,
            sentAt: new Date(),
          },
        });

        console.log(`[ScheduledAnnouncements] Ankündigung ${announcement.id} erfolgreich gesendet`);
      } catch (error: any) {
        // Fehler beim Senden - als fehlgeschlagen markieren
        await prisma.announcement.update({
          where: { id: announcement.id },
          data: {
            status: 'FAILED',
            errorMessage: error.message || 'Unbekannter Fehler',
          },
        });

        console.error(`[ScheduledAnnouncements] Fehler bei Ankündigung ${announcement.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[ScheduledAnnouncements] Fehler beim Verarbeiten geplanter Ankündigungen:', error);
  }
}

// Startet den Scheduler (wird jede Minute ausgeführt)
let schedulerInterval: NodeJS.Timeout | null = null;

export function startAnnouncementScheduler(): void {
  if (schedulerInterval) {
    console.log('[ScheduledAnnouncements] Scheduler läuft bereits');
    return;
  }

  // Initial ausführen
  processScheduledAnnouncements();

  // Dann jede Minute prüfen
  schedulerInterval = setInterval(() => {
    processScheduledAnnouncements();
  }, 60 * 1000); // Alle 60 Sekunden

  console.log('[ScheduledAnnouncements] Scheduler gestartet (prüft alle 60 Sekunden)');
}

export function stopAnnouncementScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[ScheduledAnnouncements] Scheduler gestoppt');
  }
}
