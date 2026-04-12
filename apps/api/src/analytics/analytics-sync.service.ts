import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaReadReplicaService } from '../prisma/prisma-read-replica.service';
import { ConfigService } from '@nestjs/config';

const WATERMARK_KEY = 'analytics.llm_sync.last_at';
const BATCH_SIZE = 10_000;

/**
 * Syncs llm_usage rows from Postgres to the configured analytics backend.
 *
 * Uses a high-water-mark (stored in site_settings) to track the last synced
 * timestamp. Idempotent — safe to replay.
 *
 * Currently a no-op when CLICKHOUSE_URL is not configured.
 */
@Injectable()
export class AnalyticsSyncService {
  private readonly logger = new Logger(AnalyticsSyncService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly readPrisma: PrismaReadReplicaService,
    private readonly config: ConfigService,
  ) {
    this.enabled = !!this.config.get<string>('analytics.clickhouseUrl');
    if (!this.enabled) {
      this.logger.log('Analytics sync disabled (CLICKHOUSE_URL not set)');
    }
  }

  /**
   * Runs every hour to batch-sync new llm_usage rows to the analytics backend.
   */
  @Cron('0 0 * * * *')
  async syncLlmUsage(): Promise<void> {
    if (!this.enabled) return;

    try {
      const watermark = await this.getWatermark();
      const rows = await (this.readPrisma as any).llmUsage.findMany({
        where: watermark ? { createdAt: { gt: watermark } } : {},
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
      });

      if (rows.length === 0) {
        this.logger.debug('No new llm_usage rows to sync');
        return;
      }

      // TODO: Insert rows into ClickHouse when the real client is wired in.
      // For now, just advance the watermark.
      this.logger.log(`Analytics sync: ${rows.length} rows ready for ClickHouse (stub — skipping insert)`);

      const lastCreatedAt = rows[rows.length - 1].createdAt;
      await this.setWatermark(lastCreatedAt);
    } catch (error: any) {
      this.logger.error(`Analytics sync failed: ${error.message}`);
    }
  }

  private async getWatermark(): Promise<Date | null> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: WATERMARK_KEY },
    });
    return row ? new Date(row.value) : null;
  }

  private async setWatermark(date: Date): Promise<void> {
    await this.prisma.siteSetting.upsert({
      where: { key: WATERMARK_KEY },
      update: { value: date.toISOString() },
      create: { key: WATERMARK_KEY, value: date.toISOString() },
    });
  }
}
