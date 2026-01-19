import { prisma } from '../prisma.js';
import { EmbedBuilder, TextChannel, ChannelType } from 'discord.js';
import { client } from './discordBot.js';
import cron from 'node-cron';

// Kalender-Event Interface
interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startDate: Date;
  endDate: Date | null;
  isAllDay: boolean;
  color: string;
  category: string;
  discordRoleIds: string | null;
  reminderMinutes: number | null;
  reminderSent: boolean;
}

// Kategorie-Labels für deutsche Anzeige
const categoryLabels: Record<string, string> = {
  GENERAL: 'Allgemein',
  TRAINING: 'Training',
  MEETING: 'Besprechung',
  EVENT: 'Event',
  DEADLINE: 'Deadline',
};

// Farben für Embeds (Hex zu Number)
function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

// Datum formatieren
function formatDate(date: Date, isAllDay: boolean): string {
  if (isAllDay) {
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  return date.toLocaleString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Discord Erinnerung für ein Event senden
export async function sendCalendarReminder(event: CalendarEvent): Promise<boolean> {
  if (!client) {
    console.error('[Calendar] Discord Client nicht verfügbar');
    return false;
  }

  if (!event.discordRoleIds) {
    console.log(`[Calendar] Event "${event.title}" hat keine Discord-Rollen konfiguriert`);
    return false;
  }

  try {
    // Discord-Rollen IDs parsen
    const roleIds: string[] = JSON.parse(event.discordRoleIds);
    if (roleIds.length === 0) {
      console.log(`[Calendar] Event "${event.title}" hat leere Rollen-Liste`);
      return false;
    }

    // Kanal aus Umgebungsvariable oder Default
    const channelId = process.env.CALENDAR_REMINDER_CHANNEL_ID;
    if (!channelId) {
      console.error('[Calendar] CALENDAR_REMINDER_CHANNEL_ID nicht konfiguriert');
      return false;
    }

    const channel = await client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      console.error(`[Calendar] Kanal ${channelId} nicht gefunden oder kein Text-Kanal`);
      return false;
    }

    const textChannel = channel as TextChannel;

    // Embed erstellen
    const embed = new EmbedBuilder()
      .setTitle(`📅 ${event.title}`)
      .setColor(hexToNumber(event.color))
      .setTimestamp();

    // Beschreibung
    if (event.description) {
      embed.setDescription(event.description);
    }

    // Felder hinzufügen
    embed.addFields(
      {
        name: '📆 Datum',
        value: formatDate(event.startDate, event.isAllDay),
        inline: true,
      },
      {
        name: '🏷️ Kategorie',
        value: categoryLabels[event.category] || event.category,
        inline: true,
      }
    );

    if (event.location) {
      embed.addFields({
        name: '📍 Ort',
        value: event.location,
        inline: true,
      });
    }

    if (event.endDate && !event.isAllDay) {
      embed.addFields({
        name: '⏰ Ende',
        value: formatDate(event.endDate, false),
        inline: true,
      });
    }

    // Rollen-Mentions erstellen
    const mentions = roleIds.map(id => `<@&${id}>`).join(' ');

    // Nachricht senden
    await textChannel.send({
      content: `**Terminerinnerung!** ${mentions}`,
      embeds: [embed],
    });

    // Event als erinnert markieren
    await prisma.calendarEvent.update({
      where: { id: event.id },
      data: { reminderSent: true },
    });

    console.log(`[Calendar] Erinnerung für "${event.title}" gesendet`);
    return true;
  } catch (error) {
    console.error(`[Calendar] Fehler beim Senden der Erinnerung für "${event.title}":`, error);
    return false;
  }
}

// Cron-Job für Kalender-Erinnerungen (jede Minute prüfen)
export function initializeCalendarReminders(): void {
  console.log('[Calendar] Initialisiere Erinnerungs-Service...');

  // Verzögere den ersten Run um 30 Sekunden, damit Prisma vollständig initialisiert ist
  let isReady = false;
  setTimeout(() => {
    isReady = true;
  }, 30000);

  // Jede Minute prüfen
  cron.schedule('* * * * *', async () => {
    try {
      // Skip if not ready yet
      if (!isReady) {
        return;
      }

      // Verify prisma is available
      if (!prisma || !prisma.calendarEvent) {
        console.error('[Calendar] Prisma not available yet, skipping reminder check');
        return;
      }

      const now = new Date();

      // Alle Events finden, die noch nicht erinnert wurden und deren Erinnerungszeit erreicht ist
      const events = await prisma.calendarEvent.findMany({
        where: {
          reminderSent: false,
          reminderMinutes: { not: null },
          discordRoleIds: { not: null },
        },
      });

      for (const event of events) {
        if (event.reminderMinutes === null) continue;

        // Berechne die Erinnerungszeit
        const reminderTime = new Date(event.startDate.getTime() - event.reminderMinutes * 60 * 1000);

        // Prüfe ob die Erinnerungszeit erreicht ist
        if (now >= reminderTime && now < event.startDate) {
          await sendCalendarReminder(event);
        }
      }
    } catch (error) {
      console.error('[Calendar] Fehler beim Prüfen der Erinnerungen:', error);
    }
  });

  console.log('[Calendar] ✅ Erinnerungs-Service gestartet');
}
