import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function grantAdmin(discordId) {
  try {
    if (!discordId) {
      console.log('\n❌ Bitte Discord ID angeben!');
      console.log('Usage: node grant-admin.mjs <discord-id>');
      console.log('Beispiel: node grant-admin.mjs 388425445793857559\n');
      return;
    }

    // 1. User finden
    const user = await prisma.user.findUnique({
      where: { discordId },
      include: {
        roles: true,
        employee: true
      }
    });

    if (!user) {
      console.log(`\n❌ User mit Discord ID "${discordId}" nicht gefunden!`);
      console.log('Bitte zuerst mit Discord einloggen: http://localhost:5173\n');
      return;
    }

    console.log(`\n✅ User gefunden: ${user.username}`);
    if (user.employee) {
      console.log(`   Badge: ${user.employee.badgeNumber}, Rank: ${user.employee.rank}`);
    }

    // 2. Admin-Rolle finden oder erstellen
    let adminRole = await prisma.role.findUnique({
      where: { name: 'admin' },
      include: { permissions: true }
    });

    if (!adminRole) {
      console.log('\n📝 Erstelle Admin-Rolle...');

      // Admin-Permission erstellen oder finden
      let adminPermission = await prisma.permission.findUnique({
        where: { name: 'admin.full' }
      });

      if (!adminPermission) {
        adminPermission = await prisma.permission.create({
          data: {
            name: 'admin.full',
            description: 'Vollständiger Admin-Zugriff',
            category: 'admin'
          }
        });
        console.log('✅ Admin-Permission erstellt');
      }

      // Admin-Rolle erstellen
      adminRole = await prisma.role.create({
        data: {
          name: 'admin',
          displayName: 'Administrator',
          color: '#DC2626',
          level: 999,
          permissions: {
            connect: { id: adminPermission.id }
          }
        }
      });
      console.log('✅ Admin-Rolle erstellt');
    }

    // 3. Prüfen ob User bereits Admin ist
    const hasAdminRole = user.roles.some(r => r.id === adminRole.id);

    if (hasAdminRole) {
      console.log(`\n⚠️  ${user.username} hat bereits Admin-Rechte!\n`);
    } else {
      // User zur Admin-Rolle hinzufügen
      await prisma.user.update({
        where: { id: user.id },
        data: {
          roles: {
            connect: { id: adminRole.id }
          }
        }
      });
      console.log(`\n🎉 ${user.username} wurde zum Admin gemacht!`);
      console.log('Lade die Webseite neu, um die Änderungen zu sehen.\n');
    }

  } catch (error) {
    console.error('❌ Fehler:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Discord ID aus Command-Line Argument holen
const discordId = process.argv[2];
grantAdmin(discordId);
