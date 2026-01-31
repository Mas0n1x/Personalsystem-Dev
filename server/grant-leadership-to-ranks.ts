import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Alle Ränge die Leadership-Zugriff bekommen sollen (ab Officer I aufwärts)
const LEADERSHIP_RANKS = [
  'Officer I',
  'Officer II',
  'Officer III',
  'Senior Officer',
  'Corporal',
  'Sergeant I',
  'Sergeant II',
  'Lieutenant I',
  'Lieutenant II',
  'Captain',
  'Commander',
  'Deputy Chief',
  'Assistant Chief',
  'Chief of Police',
];

async function grantLeadershipAccess() {
  try {
    console.log('🔍 Checking roles and assigning leadership.view to all Officers+...\n');

    // Get leadership.view permission
    const leadershipViewPerm = await prisma.permission.findUnique({
      where: { name: 'leadership.view' }
    });

    if (!leadershipViewPerm) {
      console.error('❌ leadership.view permission not found! Run setup-permissions.ts first.');
      return;
    }

    console.log('✅ Found leadership.view permission:', leadershipViewPerm.id, '\n');

    // Get all Discord roles
    const allRoles = await prisma.role.findMany({
      where: { discordRoleId: { not: null } },
      include: { permissions: true },
      orderBy: { level: 'asc' }
    });

    console.log(`📋 Found ${allRoles.length} Discord roles\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let notEligibleCount = 0;

    for (const role of allRoles) {
      const hasLeadership = role.permissions.some(p => p.name === 'leadership.view');
      const shouldHaveLeadership = LEADERSHIP_RANKS.includes(role.displayName);

      if (shouldHaveLeadership) {
        if (hasLeadership) {
          console.log(`  ⏭️  ${role.displayName} - already has leadership.view`);
          skippedCount++;
        } else {
          await prisma.role.update({
            where: { id: role.id },
            data: {
              permissions: {
                connect: { id: leadershipViewPerm.id }
              }
            }
          });
          console.log(`  ✅ ${role.displayName} - granted leadership.view`);
          updatedCount++;
        }
      } else {
        console.log(`  ❌ ${role.displayName} - not eligible (Recruit or other role)`);
        notEligibleCount++;
      }
    }

    console.log('\n='.repeat(60));
    console.log(`✅ Updated: ${updatedCount} role(s)`);
    console.log(`⏭️  Already had: ${skippedCount} role(s)`);
    console.log(`❌ Not eligible: ${notEligibleCount} role(s)`);
    console.log('='.repeat(60));
    console.log('\n💡 Users need to re-login to get the updated permissions.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

grantLeadershipAccess();
