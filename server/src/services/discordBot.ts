import { Client, GatewayIntentBits, EmbedBuilder, TextChannel, Guild, ChannelType } from 'discord.js';
import { prisma } from '../index.js';

let client: Client | null = null;
let guild: Guild | null = null;

// Sync Result Type
interface SyncResult {
  created: number;
  updated: number;
  total: number;
  errors: string[];
}

// Extract rank name from Discord role (e.g., "» 5 | Sergeant" -> "Sergeant")
function extractRankFromRoleName(roleName: string): { level: number; rank: string } | null {
  // Matches patterns like "» 1 | Recruit", "»  13 | Captain" (with extra spaces)
  const match = roleName.match(/^»\s*(\d{1,2})\s*\|\s*(.+)$/);
  if (match) {
    const level = parseInt(match[1]);
    if (level >= 1 && level <= 17) {
      return { level, rank: match[2].trim() };
    }
  }
  return null;
}

// Bekannte Unit/Abteilungs-Rollen (ohne Nummer, nur "» Name")
const UNIT_ROLES: Record<string, string> = {
  '» Special Weapons and Tactics': 'S.W.A.T.',
  '» S.W.A.T. Officer': 'S.W.A.T.',
  '» S.W.A.T. Sergeant': 'S.W.A.T.',
  '» S.W.A.T. Commander': 'S.W.A.T.',
  '» S.W.A.T. Rookie': 'S.W.A.T.',
  '» Detectives': 'Detectives',
  '» Detective Member': 'Detectives',
  '» Detective Trainee': 'Detectives',
  '» Detective Instructor': 'Detectives',
  '» State Highway Patrol': 'Highway Patrol',
  '» S.H.P. Rookie': 'Highway Patrol',
  '» S.H.P. Trooper': 'Highway Patrol',
  '» S.H.P. Senior Trooper': 'Highway Patrol',
  '» S.H.P. Head Trooper': 'Highway Patrol',
  '» Air Support Division': 'Air Support',
  '» A.S.D. Flight Student': 'Air Support',
  '» A.S.D. Flight Officer': 'Air Support',
  '» A.S.D. Flight Instructor': 'Air Support',
  '» Internal Affairs': 'Internal Affairs',
  '» Human Resources': 'Human Resources',
  '» Police Academy': 'Police Academy',
  '» BIKERS': 'BIKERS',
  '» Member of BIKERS': 'BIKERS',
  '» Quality Assurance': 'Quality Assurance',
  '» Management': 'Management',
  '» Leadership': 'Leadership',
};

// Extract badge number from display name (e.g., "[PD-104] Jack Ripper" -> "PD-104")
function extractBadgeNumber(displayName: string | null): string | null {
  if (!displayName) return null;
  const match = displayName.match(/\[([A-Z]+-\d+)\]/);
  return match ? match[1] : null;
}

// Extract all departments from Discord roles
function extractDepartmentsFromRoles(roles: Map<string, { name: string }>): string[] {
  const departments: Set<string> = new Set();

  for (const [, role] of roles) {
    if (UNIT_ROLES[role.name]) {
      departments.add(UNIT_ROLES[role.name]);
    }
  }

  // Wenn keine Unit gefunden, Patrol als Standard
  if (departments.size === 0) {
    departments.add('Patrol');
  }

  return Array.from(departments);
}

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

          // Initial sync
          const initialResult = await syncDiscordMembers();
          console.log(`Discord-Sync: ${initialResult.created} erstellt, ${initialResult.updated} aktualisiert, ${initialResult.total} Mitglieder`);

          // Periodischer Sync alle 5 Minuten
          const SYNC_INTERVAL = 5 * 60 * 1000; // 5 Minuten
          setInterval(async () => {
            try {
              // Cache periodisch aktualisieren
              await guild.members.fetch();
            } catch (e) {
              // Ignorieren, nutze bestehenden Cache
            }
            const result = await syncDiscordMembers();
            if (result.created > 0 || result.updated > 0) {
              console.log(`Discord-Sync: ${result.created} erstellt, ${result.updated} aktualisiert`);
            }
          }, SYNC_INTERVAL);
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

// Discord Mitglieder mit Rollen 1-17 als Mitarbeiter synchronisieren
export async function syncDiscordMembers(): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, total: 0, errors: [] };

  if (!guild) {
    result.errors.push('Guild nicht verfügbar');
    return result;
  }

  try {
    // Members aus Cache verwenden (wurde beim Startup geladen)
    // Nur neu fetchen wenn Cache leer ist
    let members = guild.members.cache;
    if (members.size === 0) {
      members = await guild.members.fetch();
    }

    for (const [, member] of members) {
      // Bots überspringen
      if (member.user.bot) continue;

      // Finde alle Rollen mit Nummern 1-17
      const rankedRoles: { role: typeof member.roles.cache extends Map<string, infer R> ? R : never; level: number; rank: string }[] = [];

      for (const [, role] of member.roles.cache) {
        const extracted = extractRankFromRoleName(role.name);
        if (extracted) {
          rankedRoles.push({ role, ...extracted });
        }
      }

      // Überspringe Mitglieder ohne passende Rollen
      if (rankedRoles.length === 0) continue;

      result.total++;

      // Höchsten Rang nehmen (höchste Nummer)
      rankedRoles.sort((a, b) => b.level - a.level);
      const highestRank = rankedRoles[0];

      // Abteilungen aus Rollen extrahieren (mehrere möglich)
      const departments = extractDepartmentsFromRoles(member.roles.cache as Map<string, { name: string }>);
      const department = departments.join(', ');

      try {
        // User erstellen/aktualisieren
        const user = await prisma.user.upsert({
          where: { discordId: member.id },
          create: {
            discordId: member.id,
            username: member.user.username,
            displayName: member.displayName || member.user.globalName || null,
            avatar: member.user.avatarURL() || null,
            isActive: true,
          },
          update: {
            username: member.user.username,
            displayName: member.displayName || member.user.globalName || null,
            avatar: member.user.avatarURL() || null,
            isActive: true,
          },
        });

        // Prüfen ob Employee existiert
        const existingEmployee = await prisma.employee.findUnique({
          where: { userId: user.id },
        });

        // Badge-Nummer aus Display-Name extrahieren
        const badgeNumber = extractBadgeNumber(member.displayName);

        if (existingEmployee) {
          // Rang, Abteilung, Badge-Nummer und RankLevel aktualisieren falls geändert
          if (existingEmployee.rank !== highestRank.rank ||
              existingEmployee.rankLevel !== highestRank.level ||
              existingEmployee.department !== department ||
              existingEmployee.badgeNumber !== badgeNumber) {
            await prisma.employee.update({
              where: { id: existingEmployee.id },
              data: {
                rank: highestRank.rank,
                rankLevel: highestRank.level,
                department: department,
                badgeNumber: badgeNumber,
              },
            });
            result.updated++;
          }
        } else {
          // Neuen Employee erstellen
          await prisma.employee.create({
            data: {
              userId: user.id,
              rank: highestRank.rank,
              rankLevel: highestRank.level,
              department: department,
              badgeNumber: badgeNumber,
              status: 'ACTIVE',
            },
          });
          result.created++;
        }
      } catch (error) {
        result.errors.push(`Fehler bei ${member.user.tag}: ${error}`);
      }
    }
  } catch (error) {
    result.errors.push(`Fetch Fehler: ${error}`);
  }

  return result;
}

export { client };
