// Migration: roleId (1:n) -> roles (n:m)
// Dieses Script migriert die bestehenden User-Rollen zur neuen Many-to-Many Beziehung

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starte Migration der Benutzer-Rollen...');

  // Hole alle User mit roleId
  const usersWithRole = await prisma.$queryRaw<Array<{ id: string; roleId: string }>>`
    SELECT id, roleId FROM users WHERE roleId IS NOT NULL
  `;

  console.log(`Gefunden: ${usersWithRole.length} User mit Rollen`);

  // Erstelle die Einträge in der neuen Zwischentabelle _RoleToUser
  for (const user of usersWithRole) {
    try {
      // Prisma erstellt automatisch die Zwischentabelle _RoleToUser
      // Wir müssen sie manuell befüllen
      await prisma.$executeRaw`
        INSERT OR IGNORE INTO "_RoleToUser" ("A", "B") VALUES (${user.roleId}, ${user.id})
      `;
      console.log(`✓ User ${user.id} -> Rolle ${user.roleId}`);
    } catch (error) {
      console.error(`✗ Fehler bei User ${user.id}:`, error);
    }
  }

  console.log('Migration abgeschlossen!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
