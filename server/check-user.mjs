import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findFirst({
    where: { username: 'mas0n1x' },
    include: {
      role: {
        include: { permissions: true },
      },
    },
  });

  console.log('User data:');
  console.log(JSON.stringify(user, null, 2));

  // Check if role exists separately
  if (user?.roleId) {
    const role = await prisma.role.findUnique({
      where: { id: user.roleId },
      include: { permissions: true },
    });
    console.log('\nRole found by roleId:');
    console.log(JSON.stringify(role, null, 2));
  } else {
    console.log('\nNo roleId set on user!');
  }

  // Check all roles
  const allRoles = await prisma.role.findMany({
    include: { permissions: true, _count: { select: { users: true } } },
  });
  console.log('\nAll roles:');
  console.log(JSON.stringify(allRoles, null, 2));

  await prisma.$disconnect();
}

checkUser();
