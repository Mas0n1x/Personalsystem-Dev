import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const payments = await prisma.bonusPayment.findMany({
    take: 10,
    include: {
      employee: {
        include: {
          user: {
            select: { displayName: true, username: true }
          }
        }
      },
      config: {
        select: { displayName: true }
      }
    }
  });

  console.log('Bonus Payments:', payments.length);
  console.log(JSON.stringify(payments, null, 2));
}

main().finally(() => prisma.$disconnect());
