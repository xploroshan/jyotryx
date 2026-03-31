import { PrismaClient, Role, AuthProvider } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PLANET_DATA } from '../src/knowledge/seed-data/planets';
import { SIGN_DATA } from '../src/knowledge/seed-data/signs';
import { HOUSE_DATA } from '../src/knowledge/seed-data/houses';
import { NAKSHATRA_DATA } from '../src/knowledge/seed-data/nakshatras';
import { YOGA_DATA } from '../src/knowledge/seed-data/yogas';
import { DOSHA_DATA } from '../src/knowledge/seed-data/doshas';
import { MATCHING_DATA } from '../src/knowledge/seed-data/matching';
import { REMEDY_DATA } from '../src/knowledge/seed-data/remedies';
import { PANCHANG_DATA } from '../src/knowledge/seed-data/panchang';
import { PALMISTRY_DATA } from '../src/knowledge/seed-data/palmistry';
import { MUHURAT_DATA } from '../src/knowledge/seed-data/muhurat';
import { DIVISIONAL_CHART_DATA } from '../src/knowledge/seed-data/divisional-charts';

const prisma = new PrismaClient();

const STOP_WORDS = new Set([
  'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'a', 'an',
  'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'this', 'that', 'these', 'those', 'it',
  'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your',
  'he', 'she', 'his', 'her', 'not', 'no', 'nor', 'if', 'then',
  'than', 'when', 'where', 'which', 'who', 'whom', 'how', 'what',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'only', 'very', 'also', 'just', 'about',
]);

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return [...new Set(words)].slice(0, 30);
}

async function seedKnowledge() {
  const existingCount = await prisma.knowledgeDocument.count();
  if (existingCount > 0) {
    console.log(`Knowledge base already has ${existingCount} documents, skipping seed.`);
    return;
  }

  const allData = [
    ...PLANET_DATA,
    ...SIGN_DATA,
    ...HOUSE_DATA,
    ...NAKSHATRA_DATA,
    ...YOGA_DATA,
    ...DOSHA_DATA,
    ...MATCHING_DATA,
    ...REMEDY_DATA,
    ...PANCHANG_DATA,
    ...PALMISTRY_DATA,
    ...MUHURAT_DATA,
    ...DIVISIONAL_CHART_DATA,
  ];

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

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin@jyotron2024', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@jyotron.com' },
    update: {},
    create: {
      email: 'admin@jyotron.com',
      name: 'Jyotron Admin',
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
    where: { email: 'demo@jyotron.com' },
    update: {},
    create: {
      email: 'demo@jyotron.com',
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
