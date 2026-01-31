import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRoles() {
  try {
    console.log('Checking rank roles and permissions...\n');

    // Check if leadership.view permission exists
    const leadershipPerm = await prisma.permission.findUnique({
      where: { name: 'leadership.view' }
    });

    if (!leadershipPerm) {
      console.log('❌ leadership.view permission not found!');
      return;
    }

    console.log('✅ leadership.view permission found\n');

    // Get all Discord-based roles
    const roles = await prisma.role.findMany({
      where: { discordRoleId: { not: null } },
      include: { permissions: true },
      orderBy: { level: 'asc' }
    });

    console.log(`Found ${roles.length} Discord-based roles:\n`);

    roles.forEach(role => {
      const hasLeadership = role.permissions.some(p => p.name === 'leadership.view');
      const icon = hasLeadership ? '✅' : (role.level >= 2 ? '❌' : '  ');
      console.log(`${icon} Level ${role.level}: ${role.displayName}`);
      if (role.permissions.length > 0) {
        console.log(`     Permissions: ${role.permissions.map(p => p.name).join(', ')}`);
      }
    });

    console.log('\n✅ = Has leadership.view');
    console.log('❌ = Should have leadership.view (Level >= 2) but doesn\'t');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRoles();
