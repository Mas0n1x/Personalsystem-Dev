-- Migration: User.roleId (1:n) zu User.roles (n:m)
-- Dieses Script migriert die bestehenden Benutzer-Rollen zur neuen Many-to-Many Beziehung

-- 1. Erstelle die neue Zwischentabelle für die n:m Beziehung
CREATE TABLE IF NOT EXISTS "_RoleToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "roles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2. Erstelle Unique Index für die Zwischentabelle
CREATE UNIQUE INDEX IF NOT EXISTS "_RoleToUser_AB_unique" ON "_RoleToUser"("A", "B");

-- 3. Erstelle Index für B-Spalte
CREATE INDEX IF NOT EXISTS "_RoleToUser_B_index" ON "_RoleToUser"("B");

-- 4. Migriere existierende roleId-Daten in die Zwischentabelle
INSERT OR IGNORE INTO "_RoleToUser" ("A", "B")
SELECT roleId, id FROM users WHERE roleId IS NOT NULL;

-- 5. Erstelle neue users-Tabelle ohne roleId
CREATE TABLE "users_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "avatar" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- 6. Kopiere Daten (ohne roleId)
INSERT INTO users_new (id, discordId, username, displayName, avatar, email, isActive, lastLogin, createdAt, updatedAt)
SELECT id, discordId, username, displayName, avatar, email, isActive, lastLogin, createdAt, updatedAt FROM users;

-- 7. Lösche alte Tabelle
DROP TABLE users;

-- 8. Benenne neue Tabelle um
ALTER TABLE users_new RENAME TO users;

-- 9. Erstelle Indizes neu
CREATE UNIQUE INDEX "users_discordId_key" ON "users"("discordId");

-- Fertig!
