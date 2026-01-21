import { Router, Response, Request } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';
import { DiscordUserInfo, DiscordTokenResponse } from '../types/index.js';
import { getDiscordClient } from '../services/discordBot.js';

const router = Router();

const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_CDN = 'https://cdn.discordapp.com';

// CACHE für System-Rollen (5 Minuten TTL)
let systemRolesCache: { id: string; discordRoleId: string | null; level: number }[] | null = null;
let systemRolesCacheTime = 0;
const SYSTEM_ROLES_CACHE_TTL = 5 * 60 * 1000; // 5 Minuten

async function getSystemRoles() {
  const now = Date.now();
  if (systemRolesCache && (now - systemRolesCacheTime) < SYSTEM_ROLES_CACHE_TTL) {
    return systemRolesCache;
  }
  systemRolesCache = await prisma.role.findMany({
    where: { discordRoleId: { not: null } },
    orderBy: { level: 'desc' },
    select: { id: true, discordRoleId: true, level: true },
  });
  systemRolesCacheTime = now;
  return systemRolesCache;
}

// Funktion um System-Rollen basierend auf Discord-Rollen zuzuweisen (Multi-Role)
async function assignRolesFromDiscord(discordId: string): Promise<string[]> {
  try {
    const client = await getDiscordClient();
    if (!client || !process.env.DISCORD_GUILD_ID) return [];

    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
    if (!guild) return [];

    // Nutze Cache statt fetch wenn möglich
    let member = guild.members.cache.get(discordId);
    if (!member) {
      member = await guild.members.fetch(discordId).catch(() => undefined);
    }
    if (!member) return [];

    // Hole gecachte System-Rollen
    const systemRoles = await getSystemRoles();

    // Finde ALLE System-Rollen, deren Discord-Rolle der Benutzer hat
    const matchedRoleIds: string[] = [];
    for (const sysRole of systemRoles) {
      if (sysRole.discordRoleId && member.roles.cache.has(sysRole.discordRoleId)) {
        matchedRoleIds.push(sysRole.id);
      }
    }

    return matchedRoleIds;
  } catch (error) {
    console.error('Error assigning roles from Discord:', error);
    return [];
  }
}

// Erlaubte Redirect URIs (müssen auch im Discord Developer Portal eingetragen sein!)
const ALLOWED_REDIRECT_URIS: Record<string, string> = {
  'http://localhost:5173': 'http://localhost:5173/auth/callback',
  'http://192.168.2.103:5173': 'http://192.168.2.103:5173/auth/callback',
  'http://test.mas0n1x.online': 'http://test.mas0n1x.online/auth/callback',
  'https://test.mas0n1x.online': 'https://test.mas0n1x.online/auth/callback',
  'http://personal.corleone-lspd.de': 'http://personal.corleone-lspd.de/auth/callback',
  'https://personal.corleone-lspd.de': 'https://personal.corleone-lspd.de/auth/callback',
};

// Redirect URI basierend auf Origin ermitteln
function getRedirectUri(req: Request): string {
  const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '').replace(/\/auth\/callback$/, '').replace(/\/login$/, '');

  if (origin && ALLOWED_REDIRECT_URIS[origin]) {
    return ALLOWED_REDIRECT_URIS[origin];
  }

  // Fallback auf Umgebungsvariable
  return process.env.DISCORD_REDIRECT_URI!;
}

// Discord OAuth2 URL generieren
router.get('/discord', (req: Request, res: Response) => {
  const redirectUri = getRedirectUri(req);

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify email guilds',
  });

  res.json({ url: `https://discord.com/oauth2/authorize?${params}` });
});

// Discord Callback verarbeiten
router.post('/discord/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ error: 'Code fehlt' });
      return;
    }

    // Redirect URI basierend auf Origin ermitteln (muss mit der URL übereinstimmen, die beim Login verwendet wurde)
    const redirectUri = getRedirectUri(req);

    // Token von Discord holen
    const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Discord token error:', error);
      console.error('Used redirect_uri:', redirectUri);
      console.error('Origin:', req.headers.origin);
      console.error('Referer:', req.headers.referer);
      res.status(400).json({ error: 'Discord Token-Abruf fehlgeschlagen', details: error });
      return;
    }

    const tokens = await tokenResponse.json() as DiscordTokenResponse;

    // Benutzerinfo von Discord holen
    const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      res.status(400).json({ error: 'Discord Benutzerinfo-Abruf fehlgeschlagen' });
      return;
    }

    const discordUser = await userResponse.json() as DiscordUserInfo;

    // Avatar URL generieren
    const avatarUrl = discordUser.avatar
      ? `${DISCORD_CDN}/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null;

    // Prüfe ob User bereits existiert und hole den displayName
    const existingUser = await prisma.user.findUnique({
      where: { discordId: discordUser.id },
      select: { id: true, displayName: true, roles: { select: { id: true } } },
    });

    // Wenn User keine Rollen hat, versuche sie aus Discord zuzuweisen
    const existingRoleIds = existingUser?.roles?.map(r => r.id) || [];
    let roleIdsToAssign: string[] = existingRoleIds;
    if (roleIdsToAssign.length === 0) {
      roleIdsToAssign = await assignRolesFromDiscord(discordUser.id);
    }

    // Versuche den Server-Nickname aus Discord zu holen (falls verfügbar)
    let serverNickname: string | null = null;
    try {
      const client = await getDiscordClient();
      if (client && process.env.DISCORD_GUILD_ID) {
        const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
        if (guild) {
          const member = await guild.members.fetch(discordUser.id).catch(() => null);
          if (member) {
            // Server-Nickname hat Priorität, dann global_name, dann username
            serverNickname = member.displayName || member.nickname || null;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching server nickname:', error);
    }

    // DisplayName Priorität:
    // 1. Bestehender displayName (wenn vorhanden)
    // 2. Server-Nickname aus Discord
    // 3. Discord global_name
    // 4. Discord username
    const displayNameToUse = existingUser?.displayName || serverNickname || discordUser.global_name || discordUser.username;

    // Benutzer in Datenbank erstellen/aktualisieren
    const user = await prisma.user.upsert({
      where: { discordId: discordUser.id },
      create: {
        discordId: discordUser.id,
        username: discordUser.username,
        displayName: displayNameToUse,
        avatar: avatarUrl,
        email: discordUser.email,
        lastLogin: new Date(),
        roles: roleIdsToAssign.length > 0 ? { connect: roleIdsToAssign.map(id => ({ id })) } : undefined,
      },
      update: {
        username: discordUser.username,
        // displayName nur aktualisieren wenn noch keiner gesetzt ist
        ...(existingUser?.displayName ? {} : { displayName: displayNameToUse }),
        avatar: avatarUrl,
        email: discordUser.email,
        lastLogin: new Date(),
        // Rollen nur aktualisieren wenn noch keine gesetzt sind
        ...(existingRoleIds.length > 0 ? {} : {
          roles: roleIdsToAssign.length > 0 ? { connect: roleIdsToAssign.map(id => ({ id })) } : undefined,
        }),
      },
      include: {
        roles: {
          include: {
            permissions: true,
          },
        },
      },
    });

    // JWT erstellen
    const jwtToken = jwt.sign(
      {
        userId: user.id,
        discordId: user.discordId,
        username: user.username,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Token als HttpOnly Cookie setzen
    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS nur in Production
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Tage
    });

    // Berechne zusammengefasste Permissions aus allen Rollen
    const allPermissions = new Set<string>();
    for (const role of user.roles) {
      for (const perm of role.permissions) {
        allPermissions.add(perm.name);
      }
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        discordId: user.discordId,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        roles: user.roles,
        permissions: Array.from(allPermissions),
      },
    });
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).json({ error: 'Authentifizierung fehlgeschlagen' });
  }
});

// Aktuellen Benutzer abrufen
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        roles: {
          include: {
            permissions: true,
          },
        },
        employee: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Benutzer nicht gefunden' });
      return;
    }

    // Berechne zusammengefasste Permissions aus allen Rollen
    const allPermissions = new Set<string>();
    for (const role of user.roles) {
      for (const perm of role.permissions) {
        allPermissions.add(perm.name);
      }
    }

    res.json({
      id: user.id,
      discordId: user.discordId,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      email: user.email,
      roles: user.roles,
      employee: user.employee,
      permissions: Array.from(allPermissions),
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Benutzerdaten' });
  }
});

// Logout
router.post('/logout', (_req, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true });
});

export default router;
