import { prisma } from '../prisma.js';
import { sendMessage, getSystemSetting } from './discordBot.js';
import { EmbedBuilder } from 'discord.js';

// Twitch API Konfiguration
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let accessToken: string | null = null;
let tokenExpiry: number = 0;

// Holt einen neuen Access Token von Twitch
async function getAccessToken(): Promise<string | null> {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    console.log('[TwitchService] Twitch API nicht konfiguriert (TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET fehlen)');
    return null;
  }

  // Token noch gültig?
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
    });

    if (!response.ok) {
      console.error('[TwitchService] Fehler beim Abrufen des Access Tokens:', response.status);
      return null;
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 Minute vor Ablauf erneuern

    console.log('[TwitchService] Access Token erfolgreich abgerufen');
    return accessToken;
  } catch (error) {
    console.error('[TwitchService] Fehler beim Abrufen des Access Tokens:', error);
    return null;
  }
}

// Prüft ob ein Streamer live ist
async function checkStreamStatus(twitchUsername: string): Promise<{
  isLive: boolean;
  title?: string;
  gameName?: string;
  viewerCount?: number;
  thumbnailUrl?: string;
} | null> {
  const token = await getAccessToken();
  if (!token || !TWITCH_CLIENT_ID) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(twitchUsername)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Client-Id': TWITCH_CLIENT_ID,
        },
      }
    );

    if (!response.ok) {
      console.error('[TwitchService] Fehler beim Prüfen des Stream-Status:', response.status);
      return null;
    }

    interface TwitchStreamData {
      data: Array<{
        title: string;
        game_name: string;
        viewer_count: number;
        thumbnail_url: string;
      }>;
    }

    const data = await response.json() as TwitchStreamData;

    if (data.data && data.data.length > 0) {
      const stream = data.data[0];
      return {
        isLive: true,
        title: stream.title,
        gameName: stream.game_name,
        viewerCount: stream.viewer_count,
        thumbnailUrl: stream.thumbnail_url?.replace('{width}', '320').replace('{height}', '180'),
      };
    }

    return { isLive: false };
  } catch (error) {
    console.error('[TwitchService] Fehler beim Prüfen des Stream-Status:', error);
    return null;
  }
}

// Sendet eine Discord-Benachrichtigung für einen Live-Streamer
async function sendLiveNotification(
  streamer: { displayName: string; twitchUsername: string; customMessage?: string | null },
  streamInfo: { title?: string; gameName?: string; viewerCount?: number; thumbnailUrl?: string }
): Promise<boolean> {
  try {
    // Channel-ID aus den System-Einstellungen holen
    const channelId = await getSystemSetting('twitch_notification_channel');
    if (!channelId) {
      console.log('[TwitchService] Kein Twitch-Benachrichtigungskanal konfiguriert');
      return false;
    }

    const embed = new EmbedBuilder()
      .setColor(0x9146FF) // Twitch Lila
      .setTitle(`🔴 ${streamer.displayName} ist jetzt live!`)
      .setURL(`https://twitch.tv/${streamer.twitchUsername}`)
      .setDescription(streamer.customMessage || `${streamer.displayName} streamt jetzt auf Twitch!`)
      .addFields(
        { name: 'Stream-Titel', value: streamInfo.title || 'Kein Titel', inline: false },
        { name: 'Spiel', value: streamInfo.gameName || 'Unbekannt', inline: true },
        { name: 'Zuschauer', value: String(streamInfo.viewerCount || 0), inline: true }
      )
      .setTimestamp();

    if (streamInfo.thumbnailUrl) {
      embed.setImage(streamInfo.thumbnailUrl);
    }

    await sendMessage(channelId, { embeds: [embed] });
    console.log(`[TwitchService] Live-Benachrichtigung für ${streamer.displayName} gesendet`);
    return true;
  } catch (error) {
    console.error('[TwitchService] Fehler beim Senden der Benachrichtigung:', error);
    return false;
  }
}

// Prüft alle aktiven Streamer
export async function checkAllStreamers(): Promise<void> {
  try {
    const streamers = await prisma.twitchStreamer.findMany({
      where: { isActive: true },
    });

    if (streamers.length === 0) {
      return;
    }

    console.log(`[TwitchService] Prüfe ${streamers.length} Streamer...`);

    for (const streamer of streamers) {
      const status = await checkStreamStatus(streamer.twitchUsername);

      if (!status) {
        continue; // API-Fehler, überspringen
      }

      const wasLive = streamer.isLive;
      const isNowLive = status.isLive;

      // Update Streamer-Status in DB
      await prisma.twitchStreamer.update({
        where: { id: streamer.id },
        data: {
          isLive: isNowLive,
          lastCheckedAt: new Date(),
          ...(isNowLive && !wasLive ? { lastLiveAt: new Date() } : {}),
        },
      });

      // Benachrichtigung senden wenn Streamer gerade live gegangen ist
      if (isNowLive && !wasLive) {
        // Prüfe ob wir kürzlich schon benachrichtigt haben (innerhalb der letzten 30 Minuten)
        const lastNotified = streamer.lastNotifiedAt;
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

        if (!lastNotified || lastNotified < thirtyMinutesAgo) {
          const sent = await sendLiveNotification(streamer, status);
          if (sent) {
            await prisma.twitchStreamer.update({
              where: { id: streamer.id },
              data: { lastNotifiedAt: new Date() },
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('[TwitchService] Fehler beim Prüfen der Streamer:', error);
  }
}

// Initialisiert den Twitch-Check Cron Job (alle 2 Minuten)
let checkInterval: NodeJS.Timeout | null = null;

export function initializeTwitchService(): void {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    console.log('[TwitchService] ℹ️ Twitch API nicht konfiguriert - Service deaktiviert');
    return;
  }

  if (checkInterval) {
    console.log('[TwitchService] Service läuft bereits');
    return;
  }

  // Initial Check nach 10 Sekunden
  setTimeout(() => {
    checkAllStreamers();
  }, 10000);

  // Regelmäßiger Check alle 2 Minuten
  checkInterval = setInterval(() => {
    checkAllStreamers();
  }, 2 * 60 * 1000);

  console.log('[TwitchService] ✅ Twitch Service initialisiert (Check alle 2 Minuten)');
}

export function stopTwitchService(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log('[TwitchService] Service gestoppt');
  }
}
