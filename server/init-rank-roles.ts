import { PrismaClient } from '@prisma/client';
import { getAllRankRoles } from './src/services/discordBot.js';

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

async function initRankRoles() {
  try {
    console.log('🔍 Fetching Discord rank roles...\\n');

    // Get all rank roles from Discord
    const discordRoles = getAllRankRoles();

    if (discordRoles.length === 0) {
      console.log('❌ No rank roles found on Discord! Make sure the Discord bot is connected.');
      return;
    }

    console.log(`Found ${discordRoles.length} rank roles on Discord\\n`);

    // Get leadership.view permission
    const leadershipViewPerm = await prisma.permission.findUnique({
      where: { name: 'leadership.view' }
    });

    if (!leadershipViewPerm) {
      console.error('❌ leadership.view permission not found! Run setup-permissions.ts first.');
      return;
    }

    console.log('✅ Found leadership.view permission\\n');

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const discordRole of discordRoles) {
      const shouldHaveLeadership = LEADERSHIP_RANKS.includes(discordRole.rank);

      // Check if role already exists in database
      const existingRole = await prisma.role.findFirst({
        where: { discordRoleId: discordRole.id }
      });

      if (existingRole) {
        console.log(`  ⏭️  ${discordRole.rank} (Level ${discordRole.level}) - already exists`);
        skipped++;
      } else {
        // Create new role
        const permissionIds = shouldHaveLeadership ? [leadershipViewPerm.id] : [];

        await prisma.role.create({
          data: {
            name: discordRole.rank.replace(/\\s+/g, '_').toUpperCase(),
            displayName: discordRole.rank,
            level: discordRole.level,
            discordRoleId: discordRole.id,
            permissions: permissionIds.length > 0 ? {
              connect: permissionIds.map(id => ({ id }))
            } : undefined
          }
        });

        const leadershipStatus = shouldHaveLeadership ? '+ leadership.view' : '';
        console.log(`  ✅ Created ${discordRole.rank} (Level ${discordRole.level}) ${leadershipStatus}`);
        created++;
      }
    }

    console.log('\\n' + '='.repeat(60));
    console.log(`✅ Created: ${created} role(s)`);
    console.log(`⏭️  Already existed: ${skipped} role(s)`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initRankRoles();
