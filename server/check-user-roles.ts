import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserRoles() {
  try {
    console.log('Checking users with rank roles and leadership access...\n');

    // Get all users with roles
    const users = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            discordRoleId: { not: null }
          }
        }
      },
      include: {
        roles: {
          where: { discordRoleId: { not: null } },
          include: { permissions: { where: { name: 'leadership.view' } } }
        },
        employee: {
          select: { rank: true, rankLevel: true }
        }
      },
      orderBy: { username: 'asc' }
    });

    console.log(`Found ${users.length} users with Discord-based roles\n`);

    let officersWithAccess = 0;
    let officersWithoutAccess = 0;

    users.forEach(user => {
      const rankRole = user.roles[0]; // Primary rank role
      if (!rankRole) return;

      const hasLeadership = rankRole.permissions.length > 0;
      const shouldHaveLeadership = rankRole.level >= 2;

      if (shouldHaveLeadership) {
        if (hasLeadership) {
          console.log(`✅ ${user.username} - ${rankRole.displayName} (Level ${rankRole.level}) - Can access Leadership`);
          officersWithAccess++;
        } else {
          console.log(`❌ ${user.username} - ${rankRole.displayName} (Level ${rankRole.level}) - Missing leadership.view!`);
          officersWithoutAccess++;
        }
      }
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Officers with leadership access: ${officersWithAccess}`);
    console.log(`❌ Officers without leadership access: ${officersWithoutAccess}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserRoles();
