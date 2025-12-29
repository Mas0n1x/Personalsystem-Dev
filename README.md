# LSPD Personalmanagementsystem

Ein umfassendes Personalmanagementsystem mit Discord-Bot-Integration für das LSPD.

## Features

- **Personalverwaltung**: HR, Internal Affairs, Police Academy, Quality Assurance
- **Finanzen**: Kasse, Asservaten, Raubdokumentation, Abmeldungen
- **Discord Integration**: OAuth2 Login, Rollensynchronisation, Ankündigungen
- **Live-Sync**: Echtzeit-Updates via WebSockets
- **Admin-Panel**: Benutzer, Rollen, Audit-Logs

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Express.js + TypeScript + Prisma ORM
- **Datenbank**: PostgreSQL
- **Discord**: discord.js v14
- **Live-Sync**: Socket.io

## Voraussetzungen

- Node.js 18+
- PostgreSQL 15+
- Discord Application (für OAuth2 und Bot)

## Installation

### 1. Repository klonen

```bash
git clone <repository-url>
cd Personalsystem
```

### 2. PostgreSQL starten

```bash
docker-compose up -d postgres
```

### 3. Backend einrichten

```bash
cd server
npm install
cp .env.example .env
# .env mit deinen Werten füllen
npm run db:push
npm run dev
```

### 4. Frontend einrichten

```bash
cd client
npm install
npm run dev
```

### 5. Discord Application erstellen

1. Gehe zu https://discord.com/developers/applications
2. Erstelle eine neue Application
3. Unter "OAuth2":
   - Kopiere Client ID und Client Secret
   - Füge Redirect URI hinzu: `http://localhost:5173/auth/callback`
4. Unter "Bot":
   - Erstelle einen Bot
   - Kopiere den Bot Token
   - Aktiviere "Server Members Intent" und "Message Content Intent"
5. Lade den Bot auf deinen Server ein (OAuth2 URL Generator mit `bot` und `applications.commands` Scopes)

### 6. Environment Variablen

Fülle die `.env` Datei im `server` Ordner:

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/lspd_personalsystem?schema=public"

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

### Datenbank migrieren

```bash
cd server
npm run db:push    # Schema pushen (Entwicklung)
npm run db:migrate # Migration erstellen (Produktion)
npm run db:studio  # Prisma Studio öffnen
```

## Erste Schritte nach Installation

1. Öffne http://localhost:5173
2. Logge dich mit Discord ein
3. Gehe zu Admin > Rollen
4. Klicke auf "Berechtigungen initialisieren"
5. Erstelle eine Admin-Rolle mit `admin.full` Berechtigung
6. Gehe zu Admin > Benutzer und weise dir die Admin-Rolle zu

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
│   └── prisma/             # Prisma Schema
│
└── docker-compose.yml      # PostgreSQL Container
```

## Lizenz

MIT
