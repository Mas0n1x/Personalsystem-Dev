import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupPermissions() {
  try {
    console.log('🔧 Setting up all system permissions...\n');

    const defaultPermissions = [
      { name: 'admin.full', description: 'Vollzugriff auf alle Funktionen', category: 'admin' },
      { name: 'users.view', description: 'Benutzer anzeigen', category: 'users' },
      { name: 'users.edit', description: 'Benutzer bearbeiten', category: 'users' },
      { name: 'users.delete', description: 'Benutzer löschen', category: 'users' },
      { name: 'employees.view', description: 'Mitarbeiter anzeigen', category: 'employees' },
      { name: 'employees.edit', description: 'Mitarbeiter bearbeiten', category: 'employees' },
      { name: 'employees.rank', description: 'Mitarbeiter upranken/downranken', category: 'employees' },
      { name: 'employees.delete', description: 'Mitarbeiter entlassen', category: 'employees' },
      { name: 'audit.view', description: 'Audit-Logs anzeigen', category: 'audit' },
      { name: 'backup.manage', description: 'Backups verwalten', category: 'backup' },
      { name: 'leadership.view', description: 'Leadership-Bereich anzeigen', category: 'leadership' },
      { name: 'leadership.manage', description: 'Leadership-Bereich verwalten', category: 'leadership' },
      { name: 'leadership.tasks', description: 'Leadership-Aufgaben anzeigen und verwalten', category: 'leadership' },
      { name: 'treasury.view', description: 'Kasse anzeigen', category: 'treasury' },
      { name: 'treasury.manage', description: 'Kasse verwalten', category: 'treasury' },
      { name: 'sanctions.view', description: 'Sanktionen anzeigen', category: 'sanctions' },
      { name: 'sanctions.manage', description: 'Sanktionen verwalten', category: 'sanctions' },
      { name: 'evidence.view', description: 'Asservate anzeigen', category: 'evidence' },
      { name: 'evidence.manage', description: 'Asservate verwalten', category: 'evidence' },
      { name: 'tuning.view', description: 'Tuning-Rechnungen anzeigen', category: 'tuning' },
      { name: 'tuning.manage', description: 'Tuning-Rechnungen verwalten', category: 'tuning' },
      { name: 'robbery.view', description: 'Räube anzeigen', category: 'robbery' },
      { name: 'robbery.create', description: 'Räube erstellen', category: 'robbery' },
      { name: 'robbery.manage', description: 'Räube verwalten', category: 'robbery' },
      { name: 'calendar.view', description: 'Kalender anzeigen', category: 'calendar' },
      { name: 'calendar.manage', description: 'Termine verwalten', category: 'calendar' },
      { name: 'blacklist.view', description: 'Blacklist anzeigen', category: 'blacklist' },
      { name: 'blacklist.manage', description: 'Blacklist verwalten', category: 'blacklist' },
      { name: 'uprank.view', description: 'Uprank-Sperren anzeigen', category: 'uprank' },
      { name: 'uprank.manage', description: 'Uprank-Sperren verwalten', category: 'uprank' },
      { name: 'hr.view', description: 'Bewerbungen anzeigen', category: 'hr' },
      { name: 'hr.manage', description: 'Bewerbungen verwalten', category: 'hr' },
      { name: 'detectives.view', description: 'Ermittlungsakten anzeigen', category: 'detectives' },
      { name: 'detectives.manage', description: 'Ermittlungsakten verwalten', category: 'detectives' },
      { name: 'academy.view', description: 'Schulungen anzeigen', category: 'academy' },
      { name: 'academy.manage', description: 'Schulungen verwalten', category: 'academy' },
      { name: 'academy.teach', description: 'Schulungen durchführen', category: 'academy' },
      { name: 'ia.view', description: 'Interne Ermittlungen anzeigen', category: 'ia' },
      { name: 'ia.manage', description: 'Interne Ermittlungen verwalten', category: 'ia' },
      { name: 'ia.investigate', description: 'Ermittlungen durchführen', category: 'ia' },
      { name: 'qa.view', description: 'Unit-Reviews anzeigen', category: 'qa' },
      { name: 'qa.manage', description: 'Unit-Reviews verwalten', category: 'qa' },
      { name: 'teamlead.view', description: 'Uprank-Anträge anzeigen', category: 'teamlead' },
      { name: 'teamlead.manage', description: 'Uprank-Anträge erstellen', category: 'teamlead' },
      { name: 'management.view', description: 'Management-Bereich anzeigen', category: 'management' },
      { name: 'management.uprank', description: 'Uprank-Anträge bearbeiten', category: 'management' },
      { name: 'bonus.view', description: 'Sonderzahlungen anzeigen', category: 'bonus' },
      { name: 'bonus.manage', description: 'Sonderzahlungen verwalten', category: 'bonus' },
      { name: 'bonus.pay', description: 'Sonderzahlungen auszahlen', category: 'bonus' },
      { name: 'admin.settings', description: 'System-Einstellungen verwalten', category: 'admin' },
      { name: 'announcements.view', description: 'Ankündigungen anzeigen', category: 'announcements' },
      { name: 'announcements.create', description: 'Ankündigungen erstellen', category: 'announcements' },
      { name: 'announcements.publish', description: 'Ankündigungen veröffentlichen', category: 'announcements' },
    ];

    console.log(`📝 Creating/updating ${defaultPermissions.length} permissions...\n`);

    // Create/update all permissions in a transaction
    await prisma.$transaction(
      defaultPermissions.map((perm) =>
        prisma.permission.upsert({
          where: { name: perm.name },
          update: perm,
          create: perm,
        })
      )
    );

    console.log('✅ All permissions created/updated!');

    // Now add leadership.view to Officer roles (Level 2-4)
    const leadershipViewPerm = await prisma.permission.findUnique({
      where: { name: 'leadership.view' }
    });

    const officerRoles = await prisma.role.findMany({
      where: {
        discordRoleId: { not: null },
        level: { gte: 2, lte: 4 }
      },
      include: { permissions: true }
    });

    console.log(`\n🔧 Adding leadership.view to ${officerRoles.length} Officer role(s)...\n`);

    for (const role of officerRoles) {
      const hasLeadership = role.permissions.some(p => p.name === 'leadership.view');
      if (!hasLeadership) {
        await prisma.role.update({
          where: { id: role.id },
          data: {
            permissions: {
              connect: { id: leadershipViewPerm!.id }
            }
          }
        });
        console.log(`  ✅ Added to: ${role.displayName} (Level ${role.level})`);
      } else {
        console.log(`  ⏭️  Skipped: ${role.displayName} (already has permission)`);
      }
    }

    console.log('\n✅ Setup complete!');
    console.log('💡 Officers now have access to Leadership. Users need to re-login.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupPermissions();
