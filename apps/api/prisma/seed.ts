import { PrismaClient, Role, AuthProvider } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  ALL_KNOWLEDGE_SEEDS,
  extractKeywords,
} from '../src/knowledge/seed-data';
import { SEED_TABLES } from './seed-kb';

const prisma = new PrismaClient();

async function seedKnowledge() {
  const existingCount = await prisma.knowledgeDocument.count();
  if (existingCount > 0) {
    console.log(`Knowledge base already has ${existingCount} documents, skipping seed.`);
    return;
  }

  const allData = ALL_KNOWLEDGE_SEEDS;

  console.log(`Seeding ${allData.length} knowledge documents...`);

  const batchSize = 50;
  let count = 0;
  for (let i = 0; i < allData.length; i += batchSize) {
    const batch = allData.slice(i, i + batchSize);
    const data = batch.map((item) => ({
      text: item.text,
      category: item.category,
      topic: item.topic,
      source: item.source,
      keywords: extractKeywords(item.text),
    }));
    const result = await prisma.knowledgeDocument.createMany({ data });
    count += result.count;
  }

  console.log(`Knowledge base seeded with ${count} documents.`);
}

async function seedKbTables() {
  // Upsert every row from the SEED_TABLES registry. Safe to rerun — keyed
  // on (key, tradition) compound-unique, so existing rows get their
  // `i18n` refreshed and new rows are inserted. Skips tables whose Prisma
  // model isn't generated yet (e.g. migration not applied in the
  // environment running the seed) by catching the model-access error.
  for (const table of SEED_TABLES) {
    const model = (prisma as any)[table.modelName];
    if (!model || typeof model.upsert !== 'function') {
      console.warn(`SEED_TABLES: Prisma model ${table.modelName} not available, skipping.`);
      continue;
    }
    let upserted = 0;
    for (const row of table.rows) {
      try {
        await model.upsert({
          where: { [table.uniqueKey]: { key: row.key, tradition: row.tradition ?? null } },
          create: { key: row.key, tradition: row.tradition ?? null, i18n: row.i18n as any },
          update: { i18n: row.i18n as any },
        });
        upserted++;
      } catch (err) {
        console.warn(`SEED_TABLES: ${table.modelName}.${row.key} upsert failed — ${(err as Error).message}`);
      }
    }
    console.log(`SEED_TABLES: ${table.modelName} — upserted ${upserted}/${table.rows.length}`);
  }
}

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin@myastro360_2024', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@myastro360.com' },
    update: {},
    create: {
      email: 'admin@myastro360.com',
      name: 'myastro360 Admin',
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
    where: { email: 'demo@myastro360.com' },
    update: {},
    create: {
      email: 'demo@myastro360.com',
      name: 'Demo User',
      passwordHash: demoPassword,
      role: Role.USER,
      credits: 10,
      provider: AuthProvider.LOCAL,
      preferredLanguage: 'en',
    },
  });
  console.log(`Demo user created: ${demo.email} (${demo.id})`);

  // Seed knowledge base
  await seedKnowledge();

  // Seed Kb* entity tables (deterministic, i18n-backed)
  await seedKbTables();

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
