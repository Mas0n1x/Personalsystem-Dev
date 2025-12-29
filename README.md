# LSPD Personalsystem

Ein schlankes Personalmanagementsystem mit Discord-Integration für das LSPD.

## Features

- **Mitarbeiterverwaltung**: Mitarbeiter anlegen, bearbeiten, Status verwalten
- **Discord Integration**: OAuth2 Login, Rollensynchronisation
- **Live-Sync**: Echtzeit-Updates via WebSockets
- **Admin-Panel**: Benutzer, Rollen, Berechtigungen, Audit-Logs

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Express.js + TypeScript + Prisma ORM
- **Datenbank**: SQLite
- **Discord**: discord.js v14
- **Live-Sync**: Socket.io

## Voraussetzungen

- Node.js 18+
- Discord Application (OAuth2 und Bot)

## Installation

### 1. Repository klonen

```bash
git clone <repository-url>
cd Personalsystem
```

### 2. Backend einrichten

```bash
cd server
npm install
cp .env.example .env
# .env mit deinen Werten ausfuellen
npx prisma generate
npx prisma db push
npm run dev
```

### 3. Frontend einrichten

```bash
cd client
npm install
npm run dev
```

### 4. Discord Application erstellen

1. Gehe zu https://discord.com/developers/applications
2. Erstelle eine neue Application
3. Unter "OAuth2":
   - Kopiere Client ID und Client Secret
   - Fuege Redirect URI hinzu: `http://localhost:5173/auth/callback`
4. Unter "Bot":
   - Erstelle einen Bot
   - Kopiere den Bot Token
   - Aktiviere "Server Members Intent"
5. Lade den Bot auf deinen Server ein

### 5. Environment Variablen

Erstelle eine `.env` Datei im `server` Ordner:

```env
# Server
PORT=3001
NODE_ENV=development

# Discord
DISCORD_CLIENT_ID=deine_client_id
DISCORD_CLIENT_SECRET=dein_client_secret
DISCORD_REDIRECT_URI=http://localhost:5173/auth/callback
DISCORD_BOT_TOKEN=dein_bot_token
DISCORD_GUILD_ID=deine_server_id

# JWT
JWT_SECRET=ein_sicherer_geheimer_schluessel
JWT_EXPIRES_IN=7d

# Frontend
FRONTEND_URL=http://localhost:5173
```

## Entwicklung

### Backend starten

```bash
cd server
npm run dev
```

### Frontend starten

```bash
cd client
npm run dev
```

### Datenbank

```bash
cd server
npx prisma generate  # Prisma Client generieren
npx prisma db push   # Schema pushen
npx prisma studio    # Prisma Studio oeffnen
```

## Erste Schritte

1. Oeffne http://localhost:5173
2. Logge dich mit Discord ein
3. Der erste Benutzer kann ueber `/api/admin/setup` zum Admin gemacht werden

## Projektstruktur

```
Personalsystem/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # UI-Komponenten
│   │   ├── pages/          # Seiten
│   │   ├── hooks/          # Custom Hooks
│   │   ├── context/        # React Context
│   │   ├── services/       # API Services
│   │   └── types/          # TypeScript Types
│   └── ...
│
├── server/                 # Express Backend
│   ├── src/
│   │   ├── routes/         # API Routes
│   │   ├── middleware/     # Express Middleware
│   │   ├── services/       # Business Logic
│   │   └── types/          # TypeScript Types
│   └── prisma/             # Prisma Schema + SQLite DB
│
└── .gitignore
```

## Lizenz

MIT
