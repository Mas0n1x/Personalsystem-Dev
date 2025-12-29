import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';
import { DiscordUserInfo, DiscordTokenResponse } from '../types/index.js';

const router = Router();

const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_CDN = 'https://cdn.discordapp.com';

// Discord OAuth2 URL generieren
router.get('/discord', (_req, res: Response) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    redirect_uri: process.env.DISCORD_REDIRECT_URI!,
    response_type: 'code',
    scope: 'identify email guilds',
  });

  res.json({ url: `https://discord.com/oauth2/authorize?${params}` });
});

// Discord Callback verarbeiten
router.post('/discord/callback', async (req, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ error: 'Code fehlt' });
      return;
    }

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
        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Discord token error:', error);
      res.status(400).json({ error: 'Discord Token-Abruf fehlgeschlagen' });
      return;
    }

    const tokens: DiscordTokenResponse = await tokenResponse.json();

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

    const discordUser: DiscordUserInfo = await userResponse.json();

    // Avatar URL generieren
    const avatarUrl = discordUser.avatar
      ? `${DISCORD_CDN}/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null;

    // Benutzer in Datenbank erstellen/aktualisieren
    const user = await prisma.user.upsert({
      where: { discordId: discordUser.id },
      create: {
        discordId: discordUser.id,
        username: discordUser.username,
        displayName: discordUser.global_name,
        avatar: avatarUrl,
        email: discordUser.email,
        lastLogin: new Date(),
      },
      update: {
        username: discordUser.username,
        displayName: discordUser.global_name,
        avatar: avatarUrl,
        email: discordUser.email,
        lastLogin: new Date(),
      },
      include: {
        role: {
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
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Token als HttpOnly Cookie setzen
    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Tage
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        discordId: user.discordId,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        role: user.role,
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
        role: {
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

    res.json({
      id: user.id,
      discordId: user.discordId,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      email: user.email,
      role: user.role,
      employee: user.employee,
      permissions: user.role?.permissions.map(p => p.name) || [],
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
