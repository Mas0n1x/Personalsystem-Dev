import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPermissions() {
  try {
    console.log('Fixing permissions...');

    // Liste aller Standard-Berechtigungen
    const defaultPermissions = [
      { name: 'admin.full', description: 'Vollzugriff auf alle Funktionen', category: 'admin' },
      { name: 'users.view', description: 'Benutzer anzeigen', category: 'users' },
      { name: 'users.edit', description: 'Benutzer bearbeiten', category: 'users' },
      { name: 'users.delete', description: 'Benutzer löschen', category: 'users' },
      { name: 'employees.view', description: 'Mitarbeiter anzeigen', category: 'employees' },
      { name: 'employees.edit', description: 'Mitarbeiter bearbeiten', category: 'employees' },
      { name: 'employees.delete', description: 'Mitarbeiter entlassen', category: 'employees' },
      { name: 'audit.view', description: 'Audit-Logs anzeigen', category: 'audit' },
      { name: 'backup.manage', description: 'Backups verwalten', category: 'backup' },
      { name: 'leadership.view', description: 'Leadership-Bereich anzeigen', category: 'leadership' },
      { name: 'leadership.manage', description: 'Leadership-Bereich verwalten', category: 'leadership' },
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
      { name: 'ia.view', description: 'Interne Ermittlungen anzeigen', category: 'ia' },
      { name: 'ia.manage', description: 'Interne Ermittlungen verwalten', category: 'ia' },
      { name: 'qa.view', description: 'Unit-Reviews anzeigen', category: 'qa' },
      { name: 'qa.manage', description: 'Unit-Reviews verwalten', category: 'qa' },
      { name: 'teamlead.view', description: 'Uprank-Anträge anzeigen', category: 'teamlead' },
      { name: 'teamlead.manage', description: 'Uprank-Anträge erstellen', category: 'teamlead' },
      { name: 'management.view', description: 'Management-Bereich anzeigen', category: 'management' },
      { name: 'management.uprank', description: 'Uprank-Anträge bearbeiten', category: 'management' },
    ];

    // Alle Berechtigungen erstellen/aktualisieren
    console.log('Creating permissions...');
    for (const perm of defaultPermissions) {
      await prisma.permission.upsert({
        where: { name: perm.name },
        update: perm,
        create: perm,
      });
    }
    console.log(`Created/updated ${defaultPermissions.length} permissions`);

    // Admin-Berechtigung holen
    const adminPerm = await prisma.permission.findUnique({ where: { name: 'admin.full' } });
    console.log('Admin permission:', adminPerm);

    // Admin-Rolle erstellen/aktualisieren
    console.log('Creating/updating admin role...');
    const adminRole = await prisma.role.upsert({
      where: { name: 'admin' },
      update: {
        displayName: 'Administrator',
        color: '#ef4444',
        level: 100,
      },
      create: {
        name: 'admin',
        displayName: 'Administrator',
        color: '#ef4444',
        level: 100,
      },
    });
    console.log('Admin role:', adminRole);

    // Admin permission mit role verbinden
    await prisma.role.update({
      where: { id: adminRole.id },
      data: {
        permissions: {
          connect: { id: adminPerm.id }
        }
      }
    });
    console.log('Connected admin.full permission to admin role');

    // User mas0n1x finden
    const user = await prisma.user.findFirst({
      where: { username: 'mas0n1x' },
    });

    if (user) {
      console.log('Found user:', user.username, user.id);

      // User der Admin-Rolle zuweisen
      await prisma.user.update({
        where: { id: user.id },
        data: { roleId: adminRole.id },
      });
      console.log('Assigned admin role to user');

      // Verifizieren
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          role: {
            include: { permissions: true },
          },
        },
      });

      console.log('\n=== RESULT ===');
      console.log('User:', updatedUser.username);
      console.log('Role:', updatedUser.role?.name);
      console.log('Permissions:', updatedUser.role?.permissions.map(p => p.name));
    } else {
      console.log('User mas0n1x not found!');

      // Alle User auflisten
      const allUsers = await prisma.user.findMany({ select: { id: true, username: true } });
      console.log('Available users:', allUsers);
    }

    console.log('\n✅ Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPermissions();
