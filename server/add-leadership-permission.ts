import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addLeadershipPermission() {
  try {
    console.log('🔍 Checking existing roles and permissions...\n');

    // Get leadership.view permission
    const leadershipViewPerm = await prisma.permission.findUnique({
      where: { name: 'leadership.view' }
    });

    if (!leadershipViewPerm) {
      console.error('❌ leadership.view permission not found!');
      return;
    }

    console.log('✅ Found leadership.view permission:', leadershipViewPerm.id);

    // Get all Discord roles (Rang-Rollen)
    const allRoles = await prisma.role.findMany({
      where: { discordRoleId: { not: null } },
      include: { permissions: true },
      orderBy: { level: 'asc' }
    });

    console.log(`\n📋 Found ${allRoles.length} Discord roles:\n`);

    for (const role of allRoles) {
      const hasLeadership = role.permissions.some(p => p.name === 'leadership.view');
      console.log(`  - ${role.displayName} (Level ${role.level}): ${hasLeadership ? '✅ has' : '❌ missing'} leadership.view`);
    }

    // Find Officer roles (Level 2-4: Officer I, Officer II, Officer III)
    const officerRoles = allRoles.filter(role =>
      role.level >= 2 && role.level <= 4 &&
      !role.permissions.some(p => p.name === 'leadership.view')
    );

    if (officerRoles.length === 0) {
      console.log('\n✅ All Officer roles already have leadership.view permission!');
      return;
    }

    console.log(`\n🔧 Adding leadership.view to ${officerRoles.length} Officer role(s)...\n`);

    // Add leadership.view permission to Officer roles
    for (const role of officerRoles) {
      await prisma.role.update({
        where: { id: role.id },
        data: {
          permissions: {
            connect: { id: leadershipViewPerm.id }
          }
        }
      });
      console.log(`  ✅ Added to: ${role.displayName}`);
    }

    console.log('\n✅ Done! Officer roles now have access to Leadership.');
    console.log('\n💡 Users need to re-login to get the new permissions.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addLeadershipPermission();
