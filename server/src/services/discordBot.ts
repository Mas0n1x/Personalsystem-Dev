import { Client, GatewayIntentBits, EmbedBuilder, TextChannel, Guild, ChannelType, GuildMember } from 'discord.js';
import { prisma } from '../prisma.js';
import { setDiscordClient } from './discordAnnouncements.js';

let client: Client | null = null;
let guild: Guild | null = null;

// Sync Result Type
interface SyncResult {
  created: number;
  updated: number;
  removed: number;
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

// Team-Konfiguration basierend auf Rang-Level
// Dienstnummern-Bereiche und Team-Rollen
interface TeamConfig {
  team: string;
  teamRole: string;
  teamLeitungRole?: string;
  badgePrefix: string;
  badgeMin: number;
  badgeMax: number;
}

function getTeamConfigForLevel(level: number): TeamConfig {
  if (level === 17) {
    return { team: 'White', teamRole: '» Team White', badgePrefix: 'PD', badgeMin: 1, badgeMax: 1 };
  } else if (level === 16) {
    return { team: 'White', teamRole: '» Team White', badgePrefix: 'PD', badgeMin: 2, badgeMax: 2 };
  } else if (level === 15) {
    return { team: 'Red', teamRole: '» Team Red', teamLeitungRole: '» Team Red Leitung', badgePrefix: 'PD', badgeMin: 3, badgeMax: 3 };
  } else if (level >= 13 && level <= 14) {
    return { team: 'Red', teamRole: '» Team Red', badgePrefix: 'PD', badgeMin: 4, badgeMax: 10 };
  } else if (level >= 10 && level <= 12) {
    return { team: 'Gold', teamRole: '» Team Gold', badgePrefix: 'PD', badgeMin: 100, badgeMax: 130 };
  } else if (level >= 6 && level <= 9) {
    return { team: 'Silver', teamRole: '» Team Silver', badgePrefix: 'PD', badgeMin: 131, badgeMax: 200 };
  } else {
    // 1-5: Green
    return { team: 'Green', teamRole: '» Team Green', badgePrefix: 'PD', badgeMin: 201, badgeMax: 300 };
  }
}

// Alle Team-Rollen Namen
const ALL_TEAM_ROLES = [
  '» Team White',
  '» Team Red Leitung',
  '» Team Red',
  '» Team Gold Leitung',
  '» Team Gold',
  '» Team Silver Leitung',
  '» Team Silver',
  '» Team Green Leitung',
  '» Team Green',
];

// Bekannte Unit/Abteilungs-Rollen (ohne Nummer, nur "» Name")
// Format: { unit: 'Unit Name', isBase: true/false } - isBase = Basis-Mitgliedsrolle
const UNIT_ROLES: Record<string, { unit: string; isBase: boolean; order: number }> = {
  // S.W.A.T.
  '» Special Weapons and Tactics': { unit: 'S.W.A.T.', isBase: true, order: 0 },
  '» S.W.A.T. Rookie': { unit: 'S.W.A.T.', isBase: false, order: 1 },
  '» S.W.A.T. Officer': { unit: 'S.W.A.T.', isBase: false, order: 2 },
  '» S.W.A.T. Sergeant': { unit: 'S.W.A.T.', isBase: false, order: 3 },
  '» S.W.A.T. Commander': { unit: 'S.W.A.T.', isBase: false, order: 4 },
  '» Co-Director of S.W.A.T.': { unit: 'S.W.A.T.', isBase: false, order: 5 },
  '» Director of S.W.A.T.': { unit: 'S.W.A.T.', isBase: false, order: 6 },

  // Detectives
  '» Detectives': { unit: 'Detectives', isBase: true, order: 0 },
  '» Detective Trainee': { unit: 'Detectives', isBase: false, order: 1 },
  '» Detective Member': { unit: 'Detectives', isBase: false, order: 2 },
  '» Detective Instructor': { unit: 'Detectives', isBase: false, order: 3 },
  '» Co. Director of Detectives': { unit: 'Detectives', isBase: false, order: 4 },
  '» Director of Detectives': { unit: 'Detectives', isBase: false, order: 5 },

  // Highway Patrol
  '» State Highway Patrol': { unit: 'Highway Patrol', isBase: true, order: 0 },
  '» S.H.P. Rookie': { unit: 'Highway Patrol', isBase: false, order: 1 },
  '» S.H.P. Trooper': { unit: 'Highway Patrol', isBase: false, order: 2 },
  '» S.H.P. Senior Trooper': { unit: 'Highway Patrol', isBase: false, order: 3 },
  '» S.H.P. Head Trooper': { unit: 'Highway Patrol', isBase: false, order: 4 },
  '» Co-Director of S.H.P': { unit: 'Highway Patrol', isBase: false, order: 5 },
  '» Director of S.H.P': { unit: 'Highway Patrol', isBase: false, order: 6 },

  // Air Support Division
  '» Air Support Division': { unit: 'Air Support', isBase: true, order: 0 },
  '» A.S.D. Flight Student': { unit: 'Air Support', isBase: false, order: 1 },
  '» A.S.D. Flight Officer': { unit: 'Air Support', isBase: false, order: 2 },
  '» A.S.D. Flight Instructor': { unit: 'Air Support', isBase: false, order: 3 },
  '» Co-Director of ASD': { unit: 'Air Support', isBase: false, order: 4 },
  '» Director of ASD': { unit: 'Air Support', isBase: false, order: 5 },

  // BIKERS
  '» BIKERS': { unit: 'BIKERS', isBase: true, order: 0 },
  '» Member of BIKERS': { unit: 'BIKERS', isBase: false, order: 1 },
  '» Instructor of BIKERS': { unit: 'BIKERS', isBase: false, order: 2 },
  '» Co-Director of BIKERS': { unit: 'BIKERS', isBase: false, order: 3 },
  '» Director of BIKERS': { unit: 'BIKERS', isBase: false, order: 4 },

  // Internal Affairs
  '» Internal Affairs': { unit: 'Internal Affairs', isBase: true, order: 0 },
  '» Instructor of Internal Affairs': { unit: 'Internal Affairs', isBase: false, order: 1 },
  '» Co. Director of Internal Affairs': { unit: 'Internal Affairs', isBase: false, order: 2 },
  '» Director of Internal Affairs': { unit: 'Internal Affairs', isBase: false, order: 3 },

  // Human Resources
  '» Human Resources': { unit: 'Human Resources', isBase: true, order: 0 },
  '» Instructor of H.R.': { unit: 'Human Resources', isBase: false, order: 1 },
  '» Co. Director of H.R.': { unit: 'Human Resources', isBase: false, order: 2 },
  '» Director of Human Resources': { unit: 'Human Resources', isBase: false, order: 3 },

  // Police Academy
  '» Police Academy': { unit: 'Police Academy', isBase: true, order: 0 },
  '» Instructor of Police Academy': { unit: 'Police Academy', isBase: false, order: 1 },
  '» Co. Director of P.A.': { unit: 'Police Academy', isBase: false, order: 2 },
  '» Director of Police Academy': { unit: 'Police Academy', isBase: false, order: 3 },

  // Quality Assurance
  '» Quality Assurance': { unit: 'Quality Assurance', isBase: true, order: 0 },
  '» Instructor of Quality Assurance': { unit: 'Quality Assurance', isBase: false, order: 1 },
  '» Co. Director of Quality Assurance': { unit: 'Quality Assurance', isBase: false, order: 2 },
  '» Director of Quality Assurance': { unit: 'Quality Assurance', isBase: false, order: 3 },

  // Management & Leadership
  '» Management': { unit: 'Management', isBase: true, order: 0 },
  '» Leadership': { unit: 'Leadership', isBase: true, order: 0 },
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
    const unitInfo = UNIT_ROLES[role.name];
    if (unitInfo) {
      departments.add(unitInfo.unit);
    }
  }

  // Leeres Array wenn keine Unit gefunden
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

    // Discord Client für Announcements setzen
    if (client) {
      setDiscordClient(client);
      console.log('[Discord Announcements] Client verbunden');
    }

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

          // Debug: Zeige fehlende Unit-Rollen
          const allUnitStyleRoles = getAllDiscordUnitStyleRoles();
          const unmapped = allUnitStyleRoles.filter(r => !r.mapped);
          if (unmapped.length > 0) {
            console.log(`⚠️ Fehlende Unit-Rollen im Mapping (${unmapped.length}):`);
            unmapped.forEach(r => console.log(`   - "${r.name}"`));
          }

          // Periodischer Sync alle 5 Minuten
          const SYNC_INTERVAL = 5 * 60 * 1000; // 5 Minuten
          setInterval(async () => {
            try {
              // Cache periodisch aktualisieren
              if (guild) {
                await guild.members.fetch();
              }
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

// Mehrere Discord-Rollen einem Benutzer zuweisen (für Einstellung)
export async function assignHireRoles(discordId: string, roleIds: string[]): Promise<{ success: boolean; assigned: string[]; failed: string[] }> {
  const result = { success: true, assigned: [] as string[], failed: [] as string[] };

  if (!guild) {
    console.error('Guild nicht verfügbar für Rollen-Zuweisung');
    return { success: false, assigned: [], failed: roleIds };
  }

  if (!roleIds || roleIds.length === 0) {
    console.log('Keine Rollen zum Zuweisen konfiguriert');
    return result;
  }

  try {
    const member = await guild.members.fetch(discordId);
    if (!member) {
      console.error(`Mitglied ${discordId} nicht gefunden`);
      return { success: false, assigned: [], failed: roleIds };
    }

    console.log(`\n=== Discord Rollen-Zuweisung bei Einstellung ===`);
    console.log(`Mitglied: ${member.user.tag}`);
    console.log(`Zuzuweisende Rollen: ${roleIds.length}`);

    for (const roleId of roleIds) {
      try {
        const role = guild.roles.cache.get(roleId);
        if (!role) {
          console.warn(`Rolle ${roleId} nicht gefunden`);
          result.failed.push(roleId);
          continue;
        }

        // Prüfe ob Member die Rolle bereits hat
        if (member.roles.cache.has(roleId)) {
          console.log(`  ℹ️ Rolle "${role.name}" bereits vorhanden`);
          result.assigned.push(roleId);
          continue;
        }

        await member.roles.add(roleId);
        console.log(`  ✅ Rolle "${role.name}" hinzugefügt`);
        result.assigned.push(roleId);
      } catch (roleError) {
        console.error(`  ❌ Fehler bei Rolle ${roleId}:`, roleError);
        result.failed.push(roleId);
      }
    }

    result.success = result.failed.length === 0;
    console.log(`=== Rollen-Zuweisung abgeschlossen: ${result.assigned.length} erfolgreich, ${result.failed.length} fehlgeschlagen ===\n`);

    return result;
  } catch (error) {
    console.error(`Error assigning hire roles for ${discordId}:`, error);
    return { success: false, assigned: [], failed: roleIds };
  }
}

// Discord-Nickname aktualisieren
export async function updateDiscordNickname(discordId: string, newNickname: string): Promise<boolean> {
  console.log(`\n=== Discord Nickname Update Start ===`);
  console.log(`Target Discord ID: ${discordId}`);
  console.log(`New Nickname: ${newNickname}`);

  if (!guild) {
    console.error('Guild nicht verfügbar für Nickname-Update');
    return false;
  }

  try {
    const member = await guild.members.fetch(discordId);
    if (!member) {
      console.error(`Mitglied ${discordId} nicht gefunden`);
      return false;
    }

    console.log(`Member gefunden: ${member.user.tag}`);
    console.log(`Aktueller Nickname: ${member.nickname || '(kein Nickname)'}`);

    // Debug: Rollen-Hierarchie prüfen BEVOR wir versuchen zu ändern
    const botMember = guild.members.me;
    if (botMember) {
      const botHighestRole = botMember.roles.highest;
      const memberHighestRole = member.roles.highest;
      console.log(`\n--- Rollen-Hierarchie ---`);
      console.log(`Bot-Rolle: "${botHighestRole.name}" (Position: ${botHighestRole.position})`);
      console.log(`Member-Rolle: "${memberHighestRole.name}" (Position: ${memberHighestRole.position})`);
      console.log(`Bot kann Nickname ändern: ${botHighestRole.position > memberHighestRole.position ? 'JA' : 'NEIN'}`);

      if (memberHighestRole.position >= botHighestRole.position) {
        console.log(`\n⚠️ WARNUNG: Member hat höhere/gleiche Rolle als Bot!`);
        console.log(`Der Bot kann keine Nicknames für Mitglieder mit höherer/gleicher Rolle ändern.`);
        console.log(`Lösung: Die Bot-Rolle muss im Discord Server ÜBER der höchsten Rolle des Mitglieds platziert werden.`);
        return false;
      }
    } else {
      console.log(`⚠️ Bot-Member nicht gefunden in Guild!`);
    }

    // Nickname setzen (max 32 Zeichen)
    const nickname = newNickname.substring(0, 32);
    console.log(`\nVersuche Nickname zu setzen: "${nickname}"`);
    await member.setNickname(nickname);
    console.log(`✅ Discord-Nickname erfolgreich geändert!`);
    console.log(`=== Discord Nickname Update Ende ===\n`);
    return true;
  } catch (error) {
    console.error(`\n❌ Fehler beim Ändern des Discord-Nicknames für ${discordId}:`);
    console.error(error);
    console.log(`=== Discord Nickname Update Ende (mit Fehler) ===\n`);
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
  const result: SyncResult = { created: 0, updated: 0, removed: 0, total: 0, errors: [] };

  console.log('[Discord-Sync] Starte Sync...');

  if (!guild) {
    console.log('[Discord-Sync] Guild nicht verfügbar!');
    result.errors.push('Guild nicht verfügbar');
    return result;
  }

  console.log(`[Discord-Sync] Guild gefunden: ${guild.name}`);

  try {
    // Members aus Cache verwenden (wurde beim Startup geladen)
    // Falls Cache leer, neu fetchen
    let members = guild.members.cache;
    console.log(`[Discord-Sync] Cache hat ${members.size} Mitglieder`);

    if (members.size === 0) {
      console.log('[Discord-Sync] Cache leer, fetche Members...');
      members = await guild.members.fetch();
    }
    console.log(`[Discord-Sync] ${members.size} Mitglieder zur Verarbeitung`);

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
        // System-Rolle basierend auf Discord-Rollen finden
        // Hole alle System-Rollen die eine Discord-Rolle zugewiesen haben
        const systemRoles = await prisma.role.findMany({
          where: { discordRoleId: { not: null } },
          orderBy: { level: 'desc' },
        });

        // Finde die höchste System-Rolle, deren Discord-Rolle der Benutzer hat
        let assignedRoleId: string | null = null;
        for (const sysRole of systemRoles) {
          if (sysRole.discordRoleId && member.roles.cache.has(sysRole.discordRoleId)) {
            assignedRoleId = sysRole.id;
            break; // Höchste Rolle gefunden (sortiert nach level desc)
          }
        }

        // User erstellen/aktualisieren
        // WICHTIG: Bestehende roleId nicht überschreiben wenn bereits gesetzt (z.B. manuell als Admin)
        const existingUser = await prisma.user.findUnique({
          where: { discordId: member.id },
          select: { roleId: true },
        });

        // Nur roleId setzen wenn:
        // 1. Es einen neuen assignedRoleId gibt (basierend auf Discord-Rollen), ODER
        // 2. Der User noch keine roleId hat
        const newRoleId = assignedRoleId || existingUser?.roleId || null;

        const user = await prisma.user.upsert({
          where: { discordId: member.id },
          create: {
            discordId: member.id,
            username: member.user.username,
            displayName: member.displayName || member.user.globalName || null,
            avatar: member.user.avatarURL() || null,
            isActive: true,
            roleId: assignedRoleId,
          },
          update: {
            username: member.user.username,
            displayName: member.displayName || member.user.globalName || null,
            avatar: member.user.avatarURL() || null,
            isActive: true,
            // Nur roleId aktualisieren wenn es eine neue Discord-basierte Rolle gibt
            // ODER wenn der User noch keine Rolle hat
            ...(assignedRoleId ? { roleId: assignedRoleId } : {}),
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

  // Mitarbeiter entfernen, die nicht mehr auf dem Discord sind
  try {
    // Alle Discord-IDs der aktuellen Server-Mitglieder sammeln
    const currentDiscordIds = new Set<string>();
    const members = guild.members.cache;
    for (const [, member] of members) {
      if (!member.user.bot) {
        currentDiscordIds.add(member.id);
      }
    }

    // Alle User/Employees aus der Datenbank holen (auch inaktive, um sie zu löschen)
    const allUsers = await prisma.user.findMany({
      include: { employee: true },
    });

    let removed = 0;
    for (const user of allUsers) {
      // Wenn der User nicht mehr auf dem Discord ist
      if (!currentDiscordIds.has(user.discordId)) {
        const username = user.username;

        // Employee komplett löschen falls vorhanden
        if (user.employee) {
          await prisma.employee.delete({
            where: { id: user.employee.id },
          });
        }

        // User komplett löschen
        await prisma.user.delete({
          where: { id: user.id },
        });

        removed++;
        console.log(`[Discord-Sync] Gelöscht: ${username} (nicht mehr auf Discord)`);
      }
    }

    if (removed > 0) {
      console.log(`Discord-Sync: ${removed} Mitarbeiter entfernt (nicht mehr auf Discord)`);
    }

    result.removed = removed;
  } catch (error) {
    result.errors.push(`Cleanup Fehler: ${error}`);
  }

  return result;
}

// Alle Rang-Rollen abrufen (» 1 | ... bis » 17 | ...)
export function getAllRankRoles(): { id: string; name: string; level: number; rank: string; position: number }[] {
  if (!guild) return [];

  const rankRoles: { id: string; name: string; level: number; rank: string; position: number }[] = [];

  for (const [, role] of guild.roles.cache) {
    const extracted = extractRankFromRoleName(role.name);
    if (extracted) {
      rankRoles.push({
        id: role.id,
        name: role.name,
        level: extracted.level,
        rank: extracted.rank,
        position: role.position,
      });
    }
  }

  // Nach Level sortieren
  return rankRoles.sort((a, b) => a.level - b.level);
}

// Debug: Alle Discord-Rollen mit "»" ausgeben (für fehlende Unit-Rollen)
export function getAllDiscordUnitStyleRoles(): { id: string; name: string; position: number; mapped: boolean }[] {
  if (!guild) return [];

  const roles: { id: string; name: string; position: number; mapped: boolean }[] = [];

  for (const [, role] of guild.roles.cache) {
    // Alle Rollen die mit "»" beginnen aber KEINE Rang-Rollen sind (keine Nummer)
    if (role.name.startsWith('»') && !extractRankFromRoleName(role.name)) {
      roles.push({
        id: role.id,
        name: role.name,
        position: role.position,
        mapped: !!UNIT_ROLES[role.name],
      });
    }
  }

  return roles.sort((a, b) => b.position - a.position);
}

// Alle Unit-Rollen abrufen
export function getAllUnitRoles(): { id: string; name: string; unit: string; isBase: boolean; order: number; position: number }[] {
  if (!guild) return [];

  const unitRoles: { id: string; name: string; unit: string; isBase: boolean; order: number; position: number }[] = [];

  for (const [, role] of guild.roles.cache) {
    const unitInfo = UNIT_ROLES[role.name];
    if (unitInfo) {
      unitRoles.push({
        id: role.id,
        name: role.name,
        unit: unitInfo.unit,
        isBase: unitInfo.isBase,
        order: unitInfo.order,
        position: role.position,
      });
    }
  }

  // Sortieren: Erst nach Unit-Name, dann Basis-Rolle zuerst, dann nach order
  return unitRoles.sort((a, b) => {
    if (a.unit !== b.unit) return a.unit.localeCompare(b.unit);
    if (a.isBase !== b.isBase) return a.isBase ? -1 : 1;
    return a.order - b.order;
  });
}

// Freie Dienstnummer im angegebenen Bereich finden
export async function findFreeBadgeNumber(min: number, max: number, prefix: string): Promise<string | null> {
  // Alle belegten Badge-Nummern aus der Datenbank holen
  const employees = await prisma.employee.findMany({
    where: {
      badgeNumber: {
        startsWith: prefix,
      },
    },
    select: {
      badgeNumber: true,
    },
  });

  // Extrahiere die Nummern aus den Badge-Nummern
  const usedNumbers = new Set<number>();
  for (const emp of employees) {
    if (emp.badgeNumber) {
      const match = emp.badgeNumber.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (match) {
        usedNumbers.add(parseInt(match[1]));
      }
    }
  }

  // Finde die erste freie Nummer im Bereich
  for (let num = min; num <= max; num++) {
    if (!usedNumbers.has(num)) {
      // Formatiere die Nummer mit führenden Nullen
      const numStr = num.toString().padStart(2, '0');
      return `${prefix}-${numStr}`;
    }
  }

  return null; // Keine freie Nummer gefunden
}

// Team-Rollen aktualisieren
async function updateTeamRoles(member: GuildMember, newTeamConfig: TeamConfig): Promise<void> {
  if (!guild) return;

  // Alle Team-Rollen-IDs sammeln
  const teamRoleIds: Map<string, string> = new Map();
  for (const [, role] of guild.roles.cache) {
    if (ALL_TEAM_ROLES.includes(role.name)) {
      teamRoleIds.set(role.name, role.id);
    }
  }

  // Alte Team-Rollen entfernen
  for (const [, role] of member.roles.cache) {
    if (ALL_TEAM_ROLES.includes(role.name)) {
      await member.roles.remove(role.id);
      console.log(`  ➖ Team-Rolle entfernt: ${role.name}`);
    }
  }

  // Neue Team-Rolle hinzufügen
  const newTeamRoleId = teamRoleIds.get(newTeamConfig.teamRole);
  if (newTeamRoleId) {
    await member.roles.add(newTeamRoleId);
    console.log(`  ➕ Team-Rolle hinzugefügt: ${newTeamConfig.teamRole}`);
  }

  // Leitung-Rolle hinzufügen wenn vorhanden
  if (newTeamConfig.teamLeitungRole) {
    const leitungRoleId = teamRoleIds.get(newTeamConfig.teamLeitungRole);
    if (leitungRoleId) {
      await member.roles.add(leitungRoleId);
      console.log(`  ➕ Leitung-Rolle hinzugefügt: ${newTeamConfig.teamLeitungRole}`);
    }
  }
}

// Rang ändern (Uprank/Downrank) mit automatischer Team- und Dienstnummer-Anpassung
export async function changeRank(
  discordId: string,
  direction: 'up' | 'down'
): Promise<{ success: boolean; newRank?: string; newLevel?: number; newBadgeNumber?: string; teamChanged?: boolean; newTeam?: string; error?: string }> {
  if (!guild) {
    return { success: false, error: 'Guild nicht verfügbar' };
  }

  try {
    const member = await guild.members.fetch(discordId);
    if (!member) {
      return { success: false, error: 'Mitglied nicht gefunden' };
    }

    // Aktuelle Rang-Rolle finden
    let currentRankRole: { role: ReturnType<typeof guild.roles.cache.get>; level: number; rank: string } | null = null;

    for (const [, role] of member.roles.cache) {
      const extracted = extractRankFromRoleName(role.name);
      if (extracted) {
        if (!currentRankRole || extracted.level > currentRankRole.level) {
          currentRankRole = { role, ...extracted };
        }
      }
    }

    if (!currentRankRole) {
      return { success: false, error: 'Keine Rang-Rolle gefunden' };
    }

    const newLevel = direction === 'up' ? currentRankRole.level + 1 : currentRankRole.level - 1;

    if (newLevel < 1 || newLevel > 17) {
      return { success: false, error: `Rang ${newLevel} existiert nicht (1-17)` };
    }

    // Neue Rang-Rolle finden
    const allRankRoles = getAllRankRoles();
    const newRankRole = allRankRoles.find(r => r.level === newLevel);

    if (!newRankRole) {
      return { success: false, error: `Rolle für Rang ${newLevel} nicht gefunden` };
    }

    // Team-Konfiguration ermitteln
    const oldTeamConfig = getTeamConfigForLevel(currentRankRole.level);
    const newTeamConfig = getTeamConfigForLevel(newLevel);
    const teamChanged = oldTeamConfig.team !== newTeamConfig.team;

    console.log(`Rang-Änderung für ${member.user.tag}: ${currentRankRole.rank} (${currentRankRole.level}) -> ${newRankRole.rank} (${newLevel})`);
    console.log(`  Team: ${oldTeamConfig.team} -> ${newTeamConfig.team} (${teamChanged ? 'WECHSEL' : 'kein Wechsel'})`);

    // 1. Rang-Rolle ändern
    await member.roles.remove(currentRankRole.role!.id);
    await member.roles.add(newRankRole.id);
    console.log(`  ✅ Rang-Rolle geändert`);

    // 2. Team-Rollen aktualisieren
    await updateTeamRoles(member, newTeamConfig);

    // 3. Neue Dienstnummer nur wenn Team wechselt
    let newBadgeNumber: string | undefined;
    if (teamChanged) {
      const freeBadge = await findFreeBadgeNumber(newTeamConfig.badgeMin, newTeamConfig.badgeMax, newTeamConfig.badgePrefix);
      if (freeBadge) {
        newBadgeNumber = freeBadge;
        console.log(`  ✅ Neue Dienstnummer: ${freeBadge}`);
      } else {
        console.warn(`  ⚠️ Keine freie Dienstnummer im Bereich ${newTeamConfig.badgeMin}-${newTeamConfig.badgeMax}`);
      }
    }

    console.log(`✅ Rang erfolgreich geändert!`);

    return {
      success: true,
      newRank: newRankRole.rank,
      newLevel: newRankRole.level,
      newBadgeNumber,
      teamChanged,
      newTeam: newTeamConfig.team,
    };
  } catch (error) {
    console.error(`Fehler bei Rang-Änderung für ${discordId}:`, error);
    return { success: false, error: String(error) };
  }
}

// Unit-Rollen setzen
export async function setUnitRoles(
  discordId: string,
  unitRoleIds: string[]
): Promise<{ success: boolean; error?: string }> {
  if (!guild) {
    return { success: false, error: 'Guild nicht verfügbar' };
  }

  try {
    const member = await guild.members.fetch(discordId);
    if (!member) {
      return { success: false, error: 'Mitglied nicht gefunden' };
    }

    // Alle Unit-Rollen-IDs sammeln
    const allUnitRoleIds = new Set<string>();
    for (const [, role] of guild.roles.cache) {
      if (UNIT_ROLES[role.name]) {
        allUnitRoleIds.add(role.id);
      }
    }

    // Aktuelle Unit-Rollen entfernen
    for (const [, role] of member.roles.cache) {
      if (allUnitRoleIds.has(role.id)) {
        await member.roles.remove(role.id);
      }
    }

    // Neue Unit-Rollen hinzufügen
    for (const roleId of unitRoleIds) {
      if (allUnitRoleIds.has(roleId)) {
        await member.roles.add(roleId);
      }
    }

    console.log(`✅ Unit-Rollen für ${member.user.tag} aktualisiert`);

    return { success: true };
  } catch (error) {
    console.error(`Fehler beim Setzen der Unit-Rollen für ${discordId}:`, error);
    return { success: false, error: String(error) };
  }
}

// Mitglied kicken
export async function kickMember(
  discordId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  if (!guild) {
    return { success: false, error: 'Guild nicht verfügbar' };
  }

  try {
    const member = await guild.members.fetch(discordId);
    if (!member) {
      return { success: false, error: 'Mitglied nicht gefunden' };
    }

    await member.kick(reason || 'Kündigung über Personalsystem');
    console.log(`✅ ${member.user.tag} wurde gekickt`);

    return { success: true };
  } catch (error) {
    console.error(`Fehler beim Kicken von ${discordId}:`, error);
    return { success: false, error: String(error) };
  }
}

// Member Rollen abrufen
export async function getMemberRoles(discordId: string): Promise<{ id: string; name: string }[]> {
  if (!guild) return [];

  try {
    const member = await guild.members.fetch(discordId);
    if (!member) return [];

    return Array.from(member.roles.cache.values())
      .filter(r => r.name !== '@everyone')
      .map(r => ({ id: r.id, name: r.name }));
  } catch (error: unknown) {
    // 10007 = Unknown Member - Member ist nicht mehr im Server, still ignorieren
    if (error && typeof error === 'object' && 'code' in error && error.code === 10007) {
      return [];
    }
    console.error(`Fehler beim Abrufen der Rollen für ${discordId}:`, error);
    return [];
  }
}

// Batch-Funktion: Alle Member-Rollen auf einmal abrufen (performant!)
export async function getAllMembersWithRoles(): Promise<Map<string, { id: string; name: string }[]>> {
  const result = new Map<string, { id: string; name: string }[]>();

  if (!client) {
    console.error('[Discord] Client not available for getAllMembersWithRoles');
    return result;
  }

  try {
    // Stelle sicher dass Guild geladen ist
    if (!guild) {
      console.log('[Discord] Guild not cached, fetching from Discord API...');
      guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
      console.log(`[Discord] Guild loaded: ${guild.name}`);
    }

    if (!guild) {
      console.error('[Discord] Failed to load guild');
      return result;
    }

    console.log('[Discord] Fetching all guild members...');
    // Alle Members auf einmal laden (nutzt Discord.js Cache)
    const members = await guild.members.fetch();
    console.log(`[Discord] Fetched ${members.size} members from guild`);

    for (const [, member] of members) {
      const roles = Array.from(member.roles.cache.values())
        .filter(r => r.name !== '@everyone')
        .map(r => ({ id: r.id, name: r.name }));

      result.set(member.id, roles);
    }

    console.log(`[Discord] Built role map for ${result.size} members`);
  } catch (error) {
    console.error('[Discord] Fehler beim Batch-Abrufen der Member-Rollen:', error);
    console.error('[Discord] Error details:', error);
  }

  return result;
}

// Vordefinierte Ankündigungs-Kanäle aus .env abrufen
export async function getAnnouncementChannels(): Promise<{ id: string; name: string }[]> {
  if (!guild || !client) return [];

  const channelIds = (process.env.ANNOUNCEMENT_CHANNELS || '').split(',').filter(id => id.trim());

  if (channelIds.length === 0) {
    // Fallback: Alle Text-Kanäle zurückgeben
    return guild.channels.cache
      .filter(c => c.type === ChannelType.GuildText)
      .map(c => ({ id: c.id, name: c.name }));
  }

  const channels: { id: string; name: string }[] = [];

  for (const channelId of channelIds) {
    try {
      const channel = await client.channels.fetch(channelId.trim());
      if (channel && channel.type === ChannelType.GuildText) {
        channels.push({ id: channel.id, name: (channel as TextChannel).name });
      }
    } catch (error) {
      console.warn(`Kanal ${channelId} nicht gefunden`);
    }
  }

  return channels;
}

// Rolle die bei jeder Ankündigung erwähnt wird
const ANNOUNCEMENT_MENTION_ROLE_ID = '1213569073573793822';

// Ankündigung an einen bestimmten Kanal senden (vereinfachte Version)
export async function sendAnnouncementToChannel(
  channelId: string,
  title: string,
  content: string
): Promise<string | null> {
  if (!client) return null;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) return null;

    const textChannel = channel as TextChannel;

    // Prüfe Bot-Berechtigungen im Channel
    const permissions = textChannel.permissionsFor(client.user!);
    if (!permissions) {
      console.error(`[Discord] Bot hat keine Berechtigungen im Channel ${textChannel.name}`);
      throw new Error('Bot hat keine Berechtigungen in diesem Channel');
    }

    const requiredPermissions = ['SendMessages', 'EmbedLinks', 'MentionEveryone'] as const;
    const missingPermissions = requiredPermissions.filter(perm => !permissions.has(perm));

    if (missingPermissions.length > 0) {
      console.error(`[Discord] Fehlende Berechtigungen im Channel ${textChannel.name}: ${missingPermissions.join(', ')}`);
      throw new Error(`Bot fehlen folgende Berechtigungen: ${missingPermissions.join(', ')}`);
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(content)
      .setColor(0x3498db) // Blau
      .setTimestamp()
      .setFooter({ text: 'LSPD Personalsystem' });

    // Rolle erwähnen und Embed senden
    const message = await textChannel.send({
      content: `<@&${ANNOUNCEMENT_MENTION_ROLE_ID}>`,
      embeds: [embed],
    });
    return message.id;
  } catch (error) {
    console.error('Error sending announcement to channel:', error);
    throw error; // Throw error statt null zurückgeben für besseres Error Handling
  }
}

// Discord Einladungslink generieren
export async function createInviteLink(maxAge: number = 86400, maxUses: number = 1): Promise<{ success: boolean; inviteUrl?: string; error?: string }> {
  if (!guild || !client) {
    return { success: false, error: 'Discord nicht verbunden' };
  }

  try {
    // Finde einen geeigneten Kanal für die Einladung
    // Bevorzuge den System-Kanal oder den ersten Text-Kanal
    let inviteChannel = guild.systemChannel;

    if (!inviteChannel) {
      // Fallback: Ersten Text-Kanal finden
      const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
      if (textChannels.size > 0) {
        inviteChannel = textChannels.first() as TextChannel;
      }
    }

    if (!inviteChannel) {
      return { success: false, error: 'Kein geeigneter Kanal für Einladung gefunden' };
    }

    // Einladung erstellen
    const invite = await inviteChannel.createInvite({
      maxAge: maxAge, // Standard: 24 Stunden
      maxUses: maxUses, // Standard: 1 Verwendung
      unique: true,
      reason: 'HR Onboarding - Neuer Cadet',
    });

    return {
      success: true,
      inviteUrl: `https://discord.gg/${invite.code}`,
    };
  } catch (error) {
    console.error('Fehler beim Erstellen der Einladung:', error);
    return { success: false, error: String(error) };
  }
}

// Exportiere getTeamConfigForLevel für externe Verwendung
export { client, getTeamConfigForLevel };
