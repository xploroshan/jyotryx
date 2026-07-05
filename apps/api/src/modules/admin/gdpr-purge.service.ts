import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Handles GDPR-related data purge for partitioned tables.
 *
 * When tables are partitioned, FK cascading is removed (Postgres limitation).
 * This service ensures user data is cleaned from:
 *   - llm_usage (userId)
 *   - chat_messages (via sessionId -> chat_sessions.userId)
 *   - notifications (userId)
 *   - activity_logs (anonymize entityLabel, keep for audit trail)
 */
@Injectable()
export class GdprPurgeService {
  private readonly logger = new Logger(GdprPurgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Purge all user data from partitioned tables before the user row is deleted.
   * Called from AdminService.deleteUser().
   */
  async purgeUserData(userId: string): Promise<void> {
    this.logger.log(`GDPR purge: removing data for user ${userId}`);

    const results = await Promise.allSettled([
      this.prisma.$executeRaw`
        DELETE FROM "llm_usage" WHERE "userId" = ${userId}::uuid
      `,
      this.prisma.$executeRaw`
        DELETE FROM "chat_messages"
        WHERE "sessionId" IN (
          SELECT id FROM "chat_sessions" WHERE "userId" = ${userId}::uuid
        )
      `,
      this.prisma.$executeRaw`
        DELETE FROM "notifications" WHERE "userId" = ${userId}::uuid
      `,
      // Activity logs: anonymize rather than delete (audit trail)
      this.prisma.$executeRaw`
        UPDATE "activity_logs"
        SET "entityLabel" = '[deleted]'
        WHERE "entityId" = ${userId}::uuid AND "entityType" = 'User'
      `,
    ]);

    const tables = ['llm_usage', 'chat_messages', 'notifications', 'activity_logs'];
    const failed: string[] = [];
    for (const [i, result] of results.entries()) {
      if (result.status === 'rejected') {
        this.logger.error(`GDPR purge failed for ${tables[i]}: ${result.reason}`);
        failed.push(tables[i]);
      }
    }

    if (failed.length > 0) {
      // Surface the failure so the caller does NOT delete the user row and mark
      // the request 'fulfilled' while PII may still remain — the request stays
      // pending and can be retried (the daily orphan sweep is a backstop, not a
      // guarantee of completeness).
      throw new Error(`GDPR purge incomplete for user ${userId}: ${failed.join(', ')}`);
    }

    this.logger.log(`GDPR purge completed for user ${userId}`);
  }

  /**
   * Daily scheduled sweep to find and remove orphaned rows in partitioned
   * tables where the referenced userId no longer exists in the users table.
   * Runs at 03:00 daily.
   */
  @Cron('0 0 3 * * *')
  async scheduledGdprSweep(): Promise<void> {
    this.logger.log('GDPR orphan sweep starting');

    try {
      // llm_usage orphans
      const llmResult = await this.prisma.$executeRaw`
        DELETE FROM "llm_usage"
        WHERE "userId" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "users" WHERE "users"."id" = "llm_usage"."userId"
          )
      `;
      this.logger.log(`GDPR sweep: llm_usage — ${llmResult} orphaned rows removed`);

      // notifications orphans
      const notifResult = await this.prisma.$executeRaw`
        DELETE FROM "notifications"
        WHERE NOT EXISTS (
          SELECT 1 FROM "users" WHERE "users"."id" = "notifications"."userId"
        )
      `;
      this.logger.log(`GDPR sweep: notifications — ${notifResult} orphaned rows removed`);

      // chat_messages orphans (via chat_sessions)
      const chatResult = await this.prisma.$executeRaw`
        DELETE FROM "chat_messages"
        WHERE NOT EXISTS (
          SELECT 1 FROM "chat_sessions"
          WHERE "chat_sessions"."id" = "chat_messages"."sessionId"
        )
      `;
      this.logger.log(`GDPR sweep: chat_messages — ${chatResult} orphaned rows removed`);

      // activity_logs: anonymize orphaned entries
      const auditResult = await this.prisma.$executeRaw`
        UPDATE "activity_logs"
        SET "entityLabel" = '[deleted]'
        WHERE "entityType" = 'User'
          AND "entityLabel" != '[deleted]'
          AND NOT EXISTS (
            SELECT 1 FROM "users" WHERE "users"."id" = "activity_logs"."entityId"
          )
      `;
      this.logger.log(`GDPR sweep: activity_logs — ${auditResult} entries anonymized`);
    } catch (error: any) {
      this.logger.error(`GDPR sweep failed: ${error.message}`);
    }
  }
}
