import { PrismaClient, Role, AuthProvider } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin@jyotryx2024', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@jyotryx.com' },
    update: {},
    create: {
      email: 'admin@jyotryx.com',
      name: 'Jyotryx Admin',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      credits: 9999,
      provider: AuthProvider.LOCAL,
      preferredLanguage: 'en',
    },
  });
  console.log(`Admin user created: ${admin.email} (${admin.id})`);

  // Create a demo user
  const demoPassword = await bcrypt.hash('demo@1234', 10);
  const demo = await prisma.user.upsert({
    where: { email: 'demo@jyotryx.com' },
    update: {},
    create: {
      email: 'demo@jyotryx.com',
      name: 'Demo User',
      passwordHash: demoPassword,
      role: Role.USER,
      credits: 10,
      provider: AuthProvider.LOCAL,
      preferredLanguage: 'en',
    },
  });
  console.log(`Demo user created: ${demo.email} (${demo.id})`);

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
