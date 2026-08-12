import { PrismaClient } from '@prisma/client';
import { upsertUserByEmail } from '@sinal/db';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME ?? 'Admin';

  if (!email || !password) {
    console.log(
      'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping bootstrap admin creation. ' +
        'Set both in .env to create the first login (see .env.example).',
    );
    return;
  }

  const user = await upsertUserByEmail(prisma, { email, name, password, role: 'ADMIN' });
  console.log(`Bootstrap admin ready: ${user.email} (role=${user.role})`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
