import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

const PARTITIONED_TABLES = [
  'llm_usage',
  'activity_logs',
  'chat_messages',
  'notifications',
];

@Injectable()
export class PartitionService {
  private readonly logger = new Logger(PartitionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs on the 25th of each month to create next month's partitions ahead of time.
   */
  @Cron('0 0 25 * *')
  async createNextMonthPartitions(): Promise<void> {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    const year = next.getFullYear();
    const month = String(next.getMonth() + 1).padStart(2, '0');

    const following = new Date(next);
    following.setMonth(following.getMonth() + 1);
    const toYear = following.getFullYear();
    const toMonth = String(following.getMonth() + 1).padStart(2, '0');

    for (const table of PARTITIONED_TABLES) {
      const partName = `${table}_y${year}m${month}`;
      const from = `${year}-${month}-01`;
      const to = `${toYear}-${toMonth}-01`;

      try {
        await this.prisma.$executeRawUnsafe(
          `CREATE TABLE IF NOT EXISTS "${partName}" PARTITION OF "${table}" FOR VALUES FROM ('${from}') TO ('${to}')`,
        );
        this.logger.log(`Created partition ${partName} (${from} to ${to})`);
      } catch (error: any) {
        // Partition may already exist or overlap with default — log and continue
        if (error?.message?.includes('already exists') || error?.message?.includes('overlap')) {
          this.logger.log(`Partition ${partName} already exists, skipping`);
        } else {
          this.logger.error(`Failed to create partition ${partName}: ${error.message}`);
        }
      }
    }
  }
}
