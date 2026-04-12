/**
 * Backfill stats_daily table from earliest user to yesterday.
 * Usage: npx ts-node scripts/backfill-stats.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { StatsService } from '../src/stats/stats.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const statsService = app.get(StatsService);
  const prisma = app.get(PrismaService);

  // Find earliest user createdAt
  const earliest = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });

  if (!earliest) {
    console.log('No users found, nothing to backfill.');
    await app.close();
    return;
  }

  const start = new Date(earliest.createdAt);
  start.setHours(0, 0, 0, 0);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  let current = new Date(start);
  let count = 0;

  while (current <= yesterday) {
    await statsService.computeAndStoreDailyStats(new Date(current));
    count++;
    if (count % 30 === 0) {
      console.log(`Processed ${count} days (up to ${current.toISOString().slice(0, 10)})`);
    }
    current.setDate(current.getDate() + 1);
  }

  console.log(`Backfill complete: ${count} days processed.`);
  await app.close();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
