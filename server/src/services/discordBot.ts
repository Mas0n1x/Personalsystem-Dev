import { Client, GatewayIntentBits, EmbedBuilder, TextChannel, Guild, ChannelType } from 'discord.js';
import { prisma } from '../index.js';

let client: Client | null = null;
let guild: Guild | null = null;

export async function initializeDiscordBot(): Promise<void> {
  if (!process.env.DISCORD_BOT_TOKEN) {
    console.log('Discord Bot Token nicht konfiguriert');
    return;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
    ],
  });

  client.on('ready', async () => {
    console.log(`Discord Bot eingeloggt als ${client?.user?.tag}`);

    // Debug: Zeige alle Server auf denen der Bot ist
    console.log(`Bot ist auf ${client?.guilds.cache.size} Server(n):`);
    client?.guilds.cache.forEach(g => {
      console.log(`  - ${g.name} (ID: ${g.id})`);
    });

    if (process.env.DISCORD_GUILD_ID && client) {
      try {
        // Erst aus Cache versuchen, dann aktiv fetchen
        guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID) || null;

        if (!guild) {
          // Aktiv vom Discord API fetchen
          guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
        }

        if (guild) {
          console.log(`Verbunden mit Server: ${guild.name}`);
          // Members vorladen für schnellere Suche
          await guild.members.fetch();
        }
      } catch (error) {
        console.warn('Discord Server nicht gefunden oder kein Zugriff.');
        console.warn(`Gesuchte Guild ID: ${process.env.DISCORD_GUILD_ID}`);
        guild = null;
      }
    }
  });

  client.on('guildMemberAdd', async (member) => {
    console.log(`Neues Mitglied: ${member.user.tag}`);
    // Hier könnte eine Willkommensnachricht gesendet werden
  });

  client.on('guildMemberRemove', async (member) => {
    console.log(`Mitglied verlassen: ${member.user.tag}`);
    // Benutzer in DB als inaktiv markieren
    try {
      await prisma.user.updateMany({
        where: { discordId: member.id },
        data: { isActive: false },
      });
    } catch (error) {
      console.error('Error updating user on leave:', error);
    }
  });

  await client.login(process.env.DISCORD_BOT_TOKEN);
}

export async function getDiscordClient(): Promise<Client | null> {
  return client;
}

export async function getGuild(): Promise<Guild | null> {
  return guild;
}

// Rolle einem Benutzer hinzufügen/entfernen
export async function syncUserRole(
  discordId: string,
  discordRoleId: string,
  action: 'add' | 'remove'
): Promise<boolean> {
  if (!guild) return false;

  try {
    const member = await guild.members.fetch(discordId);
    if (!member) return false;

    if (action === 'add') {
      await member.roles.add(discordRoleId);
    } else {
      await member.roles.remove(discordRoleId);
    }

    return true;
  } catch (error) {
    console.error(`Error syncing role for ${discordId}:`, error);
    return false;
  }
}

// Alle Rollen synchronisieren
export async function syncAllRoles(): Promise<void> {
  if (!guild) return;

  const users = await prisma.user.findMany({
    where: { isActive: true },
    include: { role: true },
  });

  for (const user of users) {
    if (!user.role?.discordRoleId) continue;

    try {
      const member = await guild.members.fetch(user.discordId);
      if (!member) continue;

      // Prüfen ob Rolle bereits vorhanden
      if (!member.roles.cache.has(user.role.discordRoleId)) {
        await member.roles.add(user.role.discordRoleId);
        console.log(`Rolle ${user.role.name} zu ${user.username} hinzugefügt`);
      }
    } catch (error) {
      console.error(`Error syncing roles for ${user.username}:`, error);
    }
  }
}

// Ankündigung senden
export async function sendAnnouncement(
  channelId: string,
  title: string,
  content: string,
  priority: string = 'NORMAL'
): Promise<string | null> {
  if (!client) return null;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) return null;

    const textChannel = channel as TextChannel;

    const colorMap: Record<string, number> = {
      LOW: 0x808080,      // Grau
      NORMAL: 0x3498db,   // Blau
      HIGH: 0xf39c12,     // Orange
      URGENT: 0xe74c3c,   // Rot
    };

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(content)
      .setColor(colorMap[priority] || colorMap.NORMAL)
      .setTimestamp()
      .setFooter({ text: 'LSPD Personalsystem' });

    if (priority === 'URGENT') {
      embed.setAuthor({ name: '🚨 DRINGEND 🚨' });
    }

    const message = await textChannel.send({
      content: priority === 'URGENT' ? '@everyone' : undefined,
      embeds: [embed],
    });

    return message.id;
  } catch (error) {
    console.error('Error sending announcement:', error);
    return null;
  }
}

// Guild Info abrufen
export async function getGuildInfo(): Promise<{
  name: string;
  memberCount: number;
  channels: { id: string; name: string; type: string }[];
  roles: { id: string; name: string; color: string }[];
} | null> {
  if (!guild) return null;

  try {
    const channels = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildText)
      .map(c => ({
        id: c.id,
        name: c.name,
        type: 'text',
      }));

    const roles = guild.roles.cache
      .filter(r => r.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
      }));

    return {
      name: guild.name,
      memberCount: guild.memberCount,
      channels: [...channels],
      roles: [...roles],
    };
  } catch (error) {
    console.error('Error getting guild info:', error);
    return null;
  }
}

// Benutzer in Discord suchen
export async function findDiscordUser(query: string): Promise<{
  id: string;
  username: string;
  avatar: string | null;
}[]> {
  if (!guild) return [];

  try {
    const members = await guild.members.fetch({ query, limit: 10 });
    return members.map(m => ({
      id: m.id,
      username: m.user.username,
      avatar: m.user.avatarURL(),
    }));
  } catch (error) {
    console.error('Error finding Discord user:', error);
    return [];
  }
}

export { client };
