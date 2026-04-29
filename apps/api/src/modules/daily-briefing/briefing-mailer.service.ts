import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { DailyBriefingService } from './daily-briefing.service';
import { renderBriefingEmail } from './email-template';
import { createEmailProvider, EmailProvider } from './email-provider';
import { BRIEFING_QUEUE } from '../../queue/queue.constants';

export interface BriefingSettings {
  enabled: boolean;
  sendHourUtc: number;
  fromEmail: string;
  fromName: string;
}

const DEFAULTS: BriefingSettings = {
  enabled: true,
  sendHourUtc: 1, // 06:30 IST
  fromEmail: 'jyotron.astro@gmail.com',
  fromName: 'Jyotron',
};

const REPEATABLE_JOB_KEY = 'briefing-daily-fanout';

/**
 * Daily-briefing email pipeline.
 *
 * Three responsibilities, deliberately in one class so the operator
 * has one place to look:
 *
 *   1. Settings — read `notification.briefing.*` from `site_settings`
 *      and clamp to safe defaults. Read on every fan-out, so an admin
 *      can flip a knob and the next 24h sweep picks it up without a
 *      redeploy or service restart.
 *   2. Scheduling — register a BullMQ repeatable job that fires once
 *      per day at the configured UTC hour. The first registration
 *      runs at module init; subsequent restarts are idempotent
 *      because the job key is fixed.
 *   3. Sending — for each opted-in user, look up today's
 *      BriefingDelivery row, skip if one already exists (DB-side
 *      idempotency), otherwise generate the briefing, render the
 *      email, send via the provider, and persist the result.
 *
 * Failures are isolated per user: one user with a bouncing email
 * doesn't stop the rest of the fan-out.
 */
@Injectable()
export class BriefingMailerService implements OnModuleInit {
  private readonly logger = new Logger(BriefingMailerService.name);
  private readonly provider: EmailProvider = createEmailProvider();

  constructor(
    private readonly prisma: PrismaService,
    private readonly briefing: DailyBriefingService,
    private readonly config: ConfigService,
    @InjectQueue(BRIEFING_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Register the repeatable cron only once; BullMQ deduplicates by
    // (job name, repeat options), so multiple replicas calling this on
    // boot is safe.
    try {
      const settings = await this.getSettings();
      // Cron with a single-hour window — `0 H * * *`. Re-registering
      // the same job key with a new pattern updates it cleanly.
      await this.queue.removeRepeatableByKey?.(`__default__:::${REPEATABLE_JOB_KEY}::0 ${settings.sendHourUtc} * * *`);
      await this.queue.add(
        REPEATABLE_JOB_KEY,
        { kind: 'fanout' },
        {
          repeat: { pattern: `0 ${settings.sendHourUtc} * * *`, tz: 'UTC' },
          jobId: REPEATABLE_JOB_KEY,
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      );
      this.logger.log(
        `Daily briefing scheduler armed for ${String(settings.sendHourUtc).padStart(2, '0')}:00 UTC.`,
      );
    } catch (err) {
      // Don't crash the API on scheduler-init issues — the per-user
      // send path is still reachable from /admin/briefing/send-test.
      this.logger.warn(`Briefing scheduler init failed: ${(err as Error)?.message ?? err}`);
    }
  }

  // ─── Settings ──────────────────────────────────────────────────────────

  async getSettings(): Promise<BriefingSettings> {
    const rows = await this.prisma.siteSetting.findMany({
      where: { key: { startsWith: 'notification.briefing.' } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    const sendHour = parseInt(map['notification.briefing.send_hour_utc'] ?? '', 10);
    return {
      enabled: parseBool(map['notification.briefing.enabled'], DEFAULTS.enabled),
      sendHourUtc:
        Number.isFinite(sendHour) && sendHour >= 0 && sendHour <= 23
          ? sendHour
          : DEFAULTS.sendHourUtc,
      fromEmail: map['notification.briefing.from_email'] || DEFAULTS.fromEmail,
      fromName: map['notification.briefing.from_name'] || DEFAULTS.fromName,
    };
  }

  // ─── Fan-out ───────────────────────────────────────────────────────────

  /**
   * Called from the BullMQ processor on the daily cron tick. Returns
   * counters so the admin Activity log can record what happened.
   */
  async runDailyFanout(): Promise<{
    selected: number;
    sent: number;
    failed: number;
    skipped: number;
  }> {
    const settings = await this.getSettings();
    if (!settings.enabled) {
      this.logger.log('Daily briefing fan-out skipped — `notification.briefing.enabled` is false.');
      return { selected: 0, sent: 0, failed: 0, skipped: 0 };
    }

    const recipients = await this.prisma.user.findMany({
      where: { briefingEmailEnabled: true },
      select: { id: true, name: true, email: true, preferredLanguage: true },
    });

    const today = startOfUtcDate(new Date());
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const user of recipients) {
      try {
        const result = await this.sendForUser(user.id, today, settings);
        if (result === 'sent') sent += 1;
        else if (result === 'skipped') skipped += 1;
      } catch (err) {
        failed += 1;
        this.logger.warn(
          `Briefing fan-out: failed for user=${user.email}: ${(err as Error)?.message ?? err}`,
        );
      }
    }
    this.logger.log(
      `Briefing fan-out complete: selected=${recipients.length} sent=${sent} skipped=${skipped} failed=${failed}.`,
    );
    return { selected: recipients.length, sent, failed, skipped };
  }

  /**
   * Send today's briefing to one user, idempotently. Used both by the
   * fan-out loop and by the admin "send test" button.
   *
   * `force=true` (admin test) bypasses the DB-side dedupe and the
   * opt-in check so the operator can validate the template against
   * their own account without flipping their preferences.
   */
  async sendForUser(
    userId: string,
    sendDate: Date = startOfUtcDate(new Date()),
    settingsOverride?: BriefingSettings,
    force = false,
  ): Promise<'sent' | 'skipped'> {
    const settings = settingsOverride ?? (await this.getSettings());
    const dateOnly = startOfUtcDate(sendDate);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        briefingEmailEnabled: true,
        preferredLanguage: true,
      },
    });
    if (!user) throw new Error(`User ${userId} not found`);
    if (!force && !user.briefingEmailEnabled) return 'skipped';

    // DB-side idempotency: insert with status=SENT only after the send
    // succeeds; the unique index on (userId, sendDate, channel) means a
    // second worker for the same day can't double-send.
    if (!force) {
      const existing = await this.prisma.briefingDelivery.findUnique({
        where: {
          userId_sendDate_channel: {
            userId: user.id,
            sendDate: dateOnly,
            channel: 'email',
          },
        },
        select: { status: true },
      });
      if (existing) return 'skipped';
    }

    let briefing;
    try {
      briefing = await this.briefing.getDailyBriefing(user.id, user.preferredLanguage);
    } catch (err) {
      await this.recordDelivery(user.id, dateOnly, 'FAILED', null, 'briefing_fetch');
      throw err;
    }

    const appUrl = `${this.frontendUrl()}/my-day`;
    const prefsUrl = `${this.frontendUrl()}/profile?tab=notifications`;
    const rendered = renderBriefingEmail({
      userName: user.name,
      briefing,
      appUrl,
      prefsUrl,
    });

    let providerId = '';
    try {
      const result = await this.provider.send({
        to: user.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        fromEmail: settings.fromEmail,
        fromName: settings.fromName,
        idempotencyKey: `briefing:${user.id}:${dateOnly.toISOString().slice(0, 10)}`,
      });
      providerId = result.providerId;
    } catch (err) {
      await this.recordDelivery(user.id, dateOnly, 'FAILED', null, providerErrorCode(err));
      throw err;
    }

    if (force) {
      // Don't pollute the dedupe table with admin tests.
      this.logger.log(`Admin-triggered briefing sent to ${user.email}`);
      return 'sent';
    }

    await this.recordDelivery(user.id, dateOnly, 'SENT', providerId);
    return 'sent';
  }

  // ─── Bulk opt-in (admin one-shot) ──────────────────────────────────────

  /**
   * Flip every currently-disabled user to opted-in. The product policy
   * is that the briefing is on by default; this lever exists so the
   * operator can re-enroll opted-out users in bulk after a policy
   * change or a feature relaunch.
   *
   * Returns the number of rows affected so the admin UI can confirm
   * "X users are now subscribed" instead of asking the operator to
   * trust that something happened.
   */
  async enableForAllDisabled(): Promise<{ updated: number }> {
    const result = await this.prisma.user.updateMany({
      where: { briefingEmailEnabled: false },
      data: { briefingEmailEnabled: true },
    });
    this.logger.log(
      `Admin: enabled briefing for ${result.count} previously-disabled users.`,
    );
    return { updated: result.count };
  }

  // ─── Admin stats ───────────────────────────────────────────────────────

  async getAdminStats(): Promise<{
    optedInUsers: number;
    sentLast7d: number;
    failedLast7d: number;
    todayStatus: { sent: number; failed: number; skipped: number };
    settings: BriefingSettings;
    provider: 'resend' | 'log';
  }> {
    const settings = await this.getSettings();
    const today = startOfUtcDate(new Date());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [optedIn, last7d, todayRows] = await Promise.all([
      this.prisma.user.count({ where: { briefingEmailEnabled: true } }),
      this.prisma.briefingDelivery.groupBy({
        by: ['status'],
        where: { createdAt: { gte: weekAgo } },
        _count: { _all: true },
      }),
      this.prisma.briefingDelivery.groupBy({
        by: ['status'],
        where: { sendDate: today },
        _count: { _all: true },
      }),
    ]);

    const last7Counts: Record<string, number> = {};
    for (const r of last7d) last7Counts[r.status as string] = (r._count as any)?._all ?? 0;
    const todayCounts: Record<string, number> = { sent: 0, failed: 0, skipped: 0 };
    for (const r of todayRows) {
      const k = (r.status as string).toLowerCase();
      if (k in todayCounts) todayCounts[k] = (r._count as any)?._all ?? 0;
    }

    return {
      optedInUsers: optedIn,
      sentLast7d: last7Counts['SENT'] ?? 0,
      failedLast7d: last7Counts['FAILED'] ?? 0,
      todayStatus: todayCounts as { sent: number; failed: number; skipped: number },
      settings,
      provider: this.provider.kind,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private async recordDelivery(
    userId: string,
    sendDate: Date,
    status: 'SENT' | 'FAILED' | 'SKIPPED',
    providerId: string | null,
    errorCode: string | null = null,
  ): Promise<void> {
    await this.prisma.briefingDelivery.upsert({
      where: {
        userId_sendDate_channel: { userId, sendDate, channel: 'email' },
      },
      create: {
        userId,
        sendDate,
        channel: 'email',
        status,
        providerId: providerId || null,
        errorCode,
      },
      update: { status, providerId: providerId || null, errorCode },
    });
  }

  private frontendUrl(): string {
    return (this.config.get<string>('frontendUrl') || 'https://www.jyotron.com').replace(/\/+$/, '');
  }
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === null) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  return fallback;
}

function startOfUtcDate(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

function providerErrorCode(err: unknown): string {
  const msg = String((err as Error)?.message ?? err);
  // Pull out the leading provider tag — e.g. "Resend 422: invalid email"
  // → "resend_422". Anything we can't parse becomes "unknown".
  const m = /^([A-Za-z]+)\s+(\d{3})/.exec(msg);
  if (m) return `${m[1].toLowerCase()}_${m[2]}`;
  return 'unknown';
}
