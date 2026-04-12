import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

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

  /**
   * Runs daily at 02:00 to drop partitions older than DATA_RETENTION_MONTHS.
   * Aggregated data in stats_daily is preserved — only raw rows are dropped.
   */
  @Cron('0 0 2 * * *')
  async dropExpiredPartitions(): Promise<void> {
    const retentionMonths = this.configService.get<number>(
      'data.retentionMonths',
      6,
    );

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - retentionMonths);
    const cutoffYear = cutoff.getFullYear();
    const cutoffMonth = cutoff.getMonth() + 1;

    for (const table of PARTITIONED_TABLES) {
      try {
        const partitions = await this.prisma.$queryRaw<
          Array<{ relname: string }>
        >`
          SELECT c.relname
          FROM pg_inherits i
          JOIN pg_class c ON c.oid = i.inhrelid
          JOIN pg_class p ON p.oid = i.inhparent
          WHERE p.relname = ${table}
            AND c.relname LIKE ${table + '_y%'}
        `;

        for (const { relname } of partitions) {
          // Parse year/month from partition name: e.g. "llm_usage_y2025m10"
          const match = relname.match(/_y(\d{4})m(\d{2})$/);
          if (!match) continue;

          const partYear = parseInt(match[1], 10);
          const partMonth = parseInt(match[2], 10);

          if (
            partYear < cutoffYear ||
            (partYear === cutoffYear && partMonth < cutoffMonth)
          ) {
            await this.prisma.$executeRawUnsafe(
              `DROP TABLE IF EXISTS "${relname}"`,
            );
            this.logger.log(`Dropped expired partition: ${relname}`);
          }
        }
      } catch (error: any) {
        this.logger.error(
          `Failed to drop expired partitions for ${table}: ${error.message}`,
        );
      }
    }
  }
}
