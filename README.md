# LSPD Personalsystem

Ein modernes Personalmanagementsystem mit Discord-Integration fuer das LSPD.

**Live**: https://personal.corleone-lspd.de

## Features

### Kernfunktionen
- **Mitarbeiterverwaltung**: Mitarbeiter anlegen, bearbeiten, Befoerderungen, Degradierungen
- **Discord Integration**: OAuth2 Login, automatische Rollensynchronisation
- **Live-Sync**: Echtzeit-Updates via WebSockets (optimiert mit Debouncing)
- **Benachrichtigungssystem**: In-App Benachrichtigungen und Discord-Ankuendigungen
- **Kalender**: Terminplanung mit Discord-Rollen-Benachrichtigungen und Erinnerungen
- **Dienstzeiten-Tracking**: Automatische Erfassung via Discord-Aktivitaet

### Units & Abteilungen
- **Units-Uebersicht**: Alle Einheiten mit Mitgliedern und Leitungspositionen
- **Human Resources (HR)**: Bewerbungsverwaltung mit mehrstufigem Prozess (Kriterien, Fragen, Onboarding)
- **Police Academy**: Ausbildungsmodule, Pruefungen, Nachschulungen, Azubi-Fortschritt mit Suchfunktion
- **Internal Affairs (IA)**: Interne Ermittlungen, Teamwechsel-Berichte
- **Quality Assurance (QA)**: Unit-Reviews und Qualitaetssicherung
- **Detectives**: Ermittlungsakten und Fallverwaltung mit Bearbeitungsfunktion
- **Teamleitung**: Uprank-Antraege an das Management

### Leadership Features
- **Dashboard**: Umfassende Statistiken und Ueberblick mit Quick-Links
- **Kasse (Treasury)**: Normale Kasse und Schwarzgeld-Verwaltung mit Transaktionshistorie
- **Sanktionen**: Verwarnungen, Geldstrafen, Massnahmen
- **Aufgaben**: Team-Organisation mit Beschreibungen, Prioritaeten und Zuweisung
- **Notizen**: Pinnbare Notizen mit Kategorien
- **Ankuendigungen**: Discord-Kanal und In-App Broadcasts

### Weitere Module
- **Abmeldungen**: Abmeldungen und Dienstfrei mit Kalenderansicht
- **Asservate**: Beweismittelverwaltung mit Kategorien, Teilvernichtung und Mengenangabe
- **Tuning-Rechnungen**: Fahrzeugtuning-Abrechnung mit Bildnachweis
- **Raububerfaelle**: Einsatzdokumentation
- **Blacklist**: Gesperrte Bewerber
- **Uprank-Sperren**: Automatische Sperren bei Teamwechseln mit Historie

### Management
- **Sonderzahlungen (Bonus)**: Wochenbasierte Bonusabrechnung mit Mitarbeiterstatistiken
- **Uprank-Antraege**: Bearbeitung von Befoerderungsantraegen
- **Archiv**: Befoerderungs- und Kuendigungshistorie

### Administration
- **Benutzer & Rollen**: Berechtigungsverwaltung
- **Audit-Logs**: Vollstaendige Aktivitaetsprotokollierung mit Filterung und lesbaren Beschreibungen
- **Backups**: Datensicherung und Wiederherstellung
- **System-Einstellungen**: Discord-Ankuendigungen, Bonus-Konfiguration
- **Academy-Module**: Ausbildungsmodule verwalten
- **Academy-Einstellungen**: Fragenkatalog und Einstellungskriterien (dynamisch konfigurierbar)
- **Units-Verwaltung**: Discord-Rollen zu Units zuweisen

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + TanStack Query
- **Backend**: Express.js + TypeScript + Prisma ORM
- **Datenbank**: SQLite (mit optimierten Indizes)
- **Discord**: discord.js v14
- **Live-Sync**: Socket.io
- **UI**: Lucide Icons, React Hot Toast

## Voraussetzungen

- Node.js 18+
- Discord Application (OAuth2 und Bot)

## Deployment (Produktion)

Das System laeuft auf einem Server mit Docker und Cloudflare Tunnel:

### Architektur
- **Frontend**: nginx Container auf Port 8095 (serviert statische Dateien aus `client/dist`)
- **Backend**: Node.js auf Port 3001 (direkt auf Host)
- **Datenbank**: SQLite (in `server/dev.db`)
- **Reverse Proxy**: Cloudflare Tunnel zu `personal.corleone-lspd.de`

### Deployment-Befehle

```bash
# Frontend bauen und deployen
cd /srv/Personalsystem-Dev/client
npm run build
docker restart personalsystem-dev

# Backend neu starten
cd /srv/Personalsystem-Dev/server
npm run build
# Server-Prozess neu starten (kill old + start new)
lsof -i :3001 -t | xargs kill -9
nohup node dist/index.js > /tmp/personalsystem.log 2>&1 &
```

### Docker Container
```bash
# Container Status
docker ps | grep personalsystem

# Logs ansehen
docker logs personalsystem-dev
tail -f /tmp/personalsystem.log
```

## Installation (Entwicklung)

### 1. Repository klonen

```bash
git clone <repository-url>
cd Personalsystem-Dev
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
   - Aktiviere "Server Members Intent" und "Message Content Intent"
5. Lade den Bot auf deinen Server ein (mit Admin-Rechten)

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

### Seed-Scripts

```bash
cd server
node seed-units.mjs      # Standard-Units erstellen
node seed-academy.mjs    # Academy-Module erstellen
```

## Erste Schritte

1. Oeffne http://localhost:5173
2. Logge dich mit Discord ein
3. Der erste Benutzer kann ueber die Admin-Oberflaeche zum Admin gemacht werden
4. Fuehre die Seed-Scripts aus fuer Standard-Daten
5. Konfiguriere die Discord-Ankuendigungskanaele unter Administration

## Berechtigungen

Das System nutzt ein rollenbasiertes Berechtigungssystem:

| Bereich | View | Manage |
|---------|------|--------|
| employees | Mitarbeiter anzeigen | Mitarbeiter bearbeiten |
| leadership | Leadership-Bereich | Aufgaben/Notizen/Sanktionen |
| treasury | Kasse anzeigen | Ein-/Auszahlungen |
| hr | Bewerbungen anzeigen | Bewerbungen bearbeiten |
| academy | Schulungen anzeigen | Schulungen verwalten |
| ia | Ermittlungen anzeigen | Ermittlungen verwalten |
| qa | Reviews anzeigen | Reviews verwalten |
| detectives | Akten anzeigen | Akten verwalten |
| teamlead | Antraege anzeigen | Antraege erstellen |
| management | Management-Bereich | Befoerderungen |
| bonus | Sonderzahlungen anzeigen | Sonderzahlungen verwalten |
| calendar | Kalender anzeigen | Termine verwalten |
| admin | - | Vollzugriff (admin.full) |

## Projektstruktur

```
Personalsystem-Dev/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # UI-Komponenten
│   │   │   ├── layout/     # Layout-Komponenten (Sidebar, Header)
│   │   │   └── ui/         # Wiederverwendbare UI-Elemente
│   │   ├── pages/          # Seiten
│   │   │   └── admin/      # Admin-Seiten
│   │   ├── hooks/          # Custom Hooks (Live-Updates, Permissions)
│   │   ├── context/        # React Context (Auth, Socket)
│   │   ├── services/       # API Services
│   │   └── types/          # TypeScript Types
│   ├── dist/               # Build Output (von nginx serviert)
│   └── ...
│
├── server/                 # Express Backend
│   ├── src/
│   │   ├── routes/         # API Routes (~35 Module)
│   │   ├── middleware/     # Express Middleware (Auth, Audit)
│   │   ├── services/       # Business Logic (Discord Bot, Bonus, Calendar)
│   │   └── types/          # TypeScript Types
│   ├── dist/               # Kompiliertes JavaScript
│   ├── prisma/             # Prisma Schema
│   ├── uploads/            # Hochgeladene Dateien (Bilder etc.)
│   ├── backups/            # Datenbank-Backups
│   └── dev.db              # SQLite Datenbank
│
├── docker-compose.dev.yml  # Docker Konfiguration fuer Frontend
├── nginx-dev.conf          # Nginx Konfiguration
└── .gitignore
```

## Performance-Optimierungen

Das System wurde fuer optimale Performance entwickelt:

- **Query-Optimierung**: Aggregierte Datenbankabfragen statt N+1 Queries
- **Debounced Live-Updates**: Dashboard-Updates werden gebuendelt (500ms)
- **Datenbank-Indizes**: Optimierte Indizes fuer haeufige Filter/Sortierungen
- **Effiziente Algorithmen**: O(n) statt O(n*m) fuer Mitgliederzaehlung

## Lizenz

MIT

## Autor

Made by Mas0n1x
