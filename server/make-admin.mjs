import { PrismaClient } from '@prisma/client';
import readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function makeAdmin() {
  try {
    // 1. Alle User anzeigen
    const users = await prisma.user.findMany({
      include: {
        roles: true,
        employee: true
      }
    });

    if (users.length === 0) {
      console.log('\n❌ Keine User gefunden!');
      console.log('Bitte logge dich zuerst mit Discord ein, um einen User-Account zu erstellen.');
      console.log('Öffne: http://localhost:5173\n');
      return;
    }

    console.log('\n📋 Verfügbare User:\n');
    users.forEach((user, index) => {
      const hasAdminRole = user.roles.some(r => r.name === 'admin');
      const adminBadge = hasAdminRole ? ' [ADMIN]' : '';
      console.log(`${index + 1}. ${user.username} (Discord ID: ${user.discordId})${adminBadge}`);
      if (user.employee) {
        console.log(`   └─ Badge: ${user.employee.badgeNumber || 'N/A'}, Rank: ${user.employee.rank}`);
      }
    });

    // 2. User auswählen
    const answer = await question('\nWelchen User möchtest du zum Admin machen? (Nummer eingeben): ');
    const userIndex = parseInt(answer) - 1;

    if (userIndex < 0 || userIndex >= users.length) {
      console.log('❌ Ungültige Auswahl!');
      return;
    }

    const selectedUser = users[userIndex];
    console.log(`\n✅ Ausgewählter User: ${selectedUser.username}`);

    // 3. Admin-Rolle finden oder erstellen
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
    } else {
      console.log('✅ Admin-Rolle gefunden');
    }

    // 4. User zur Admin-Rolle hinzufügen
    const userHasAdminRole = selectedUser.roles.some(r => r.id === adminRole.id);

    if (userHasAdminRole) {
      console.log(`\n⚠️  ${selectedUser.username} hat bereits Admin-Rechte!`);
    } else {
      await prisma.user.update({
        where: { id: selectedUser.id },
        data: {
          roles: {
            connect: { id: adminRole.id }
          }
        }
      });
      console.log(`\n✅ ${selectedUser.username} wurde zum Admin gemacht!`);
    }

    console.log('\n🎉 Fertig! Lade die Webseite neu, um die Änderungen zu sehen.\n');

  } catch (error) {
    console.error('❌ Fehler:', error.message);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

makeAdmin();
