import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
export class PartitionService implements OnModuleInit {
  private readonly logger = new Logger(PartitionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * On boot, ensure the CURRENT and NEXT month partitions exist before any
   * write. A missed monthly cron or a fresh deploy would otherwise route writes
   * into the DEFAULT partition, which then blocks creating that month's real
   * partition (overlap) and silently breaks retention. Also alarms on any
   * non-empty default partition.
   */
  async onModuleInit(): Promise<void> {
    try {
      const now = new Date();
      const next = new Date(now);
      next.setMonth(next.getMonth() + 1);
      await this.ensurePartitionsForMonth(now);
      await this.ensurePartitionsForMonth(next);
      await this.checkDefaultPartitions();
    } catch (err: any) {
      this.logger.error(`Partition bootstrap failed: ${err?.message ?? err}`);
    }
  }

  /**
   * Runs on the 25th of each month to create next month's partitions ahead of time.
   */
  @Cron('0 0 25 * *')
  async createNextMonthPartitions(): Promise<void> {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    await this.ensurePartitionsForMonth(next);
  }

  /** Idempotently create every partitioned table's partition for `when`'s month. */
  private async ensurePartitionsForMonth(when: Date): Promise<void> {
    const year = when.getFullYear();
    const month = String(when.getMonth() + 1).padStart(2, '0');

    const following = new Date(when);
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
      } catch (error: any) {
        if (error?.message?.includes('already exists')) {
          // Fine — partition already present.
        } else if (error?.message?.includes('overlap')) {
          // The DEFAULT partition already holds rows in this range, so Postgres
          // refuses to create the month partition. This is the trap: rows are
          // stuck in default and retention can't prune them. Alarm loudly so an
          // operator can detach/migrate the default partition.
          this.logger.error(
            `Partition ${partName} OVERLAPS the default partition — rows for ${from}..${to} are stuck in "${table}_default" and won't be pruned. Manual detach/migrate required.`,
          );
        } else {
          this.logger.error(`Failed to create partition ${partName}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Alarm if any partitioned table's DEFAULT partition holds rows — that means
   * a month's real partition was missing and writes overflowed into default,
   * which retention never prunes (the partition grows unbounded).
   */
  private async checkDefaultPartitions(): Promise<void> {
    for (const table of PARTITIONED_TABLES) {
      try {
        const defaults = await this.prisma.$queryRawUnsafe<Array<{ relname: string }>>(
          `SELECT c.relname
             FROM pg_inherits i
             JOIN pg_class c ON c.oid = i.inhrelid
             JOIN pg_class p ON p.oid = i.inhparent
            WHERE p.relname = $1
              AND pg_get_expr(c.relpartbound, c.oid) = 'DEFAULT'`,
          table,
        );
        for (const { relname } of defaults) {
          // relname is catalog-derived (not user input) — safe to interpolate.
          const rows = await this.prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
            `SELECT count(*)::bigint AS n FROM "${relname}"`,
          );
          const n = Number(rows[0]?.n ?? 0);
          if (n > 0) {
            this.logger.error(
              `Partition ALARM: default partition "${relname}" holds ${n} rows — a monthly partition is missing/stuck and these rows won't be pruned by retention. Investigate.`,
            );
          }
        }
      } catch (error: any) {
        this.logger.warn(`Default-partition check failed for ${table}: ${error.message}`);
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
