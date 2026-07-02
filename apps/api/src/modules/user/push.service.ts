import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as admin from 'firebase-admin';
import { PrismaService } from '../../prisma/prisma.service';

/** FCM error codes that mean the token is dead and must be pruned. */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export interface PushMessage {
  title: string;
  body: string;
  /** Router path the app opens on tap (e.g. `/(tabs)`, `/feature/horoscope`). */
  url?: string;
}

/**
 * FCM push delivery + device-token registry (plan §8.4/§9).
 *
 * Sends through the firebase-admin DEFAULT app (initialized by AuthService at
 * bootstrap from FIREBASE_SERVICE_ACCOUNT_JSON); a self-sufficient init guard
 * covers orderings where this service constructs first. Without Firebase
 * credentials the service is in mock mode: registration still works (tokens
 * are stored for later), sends are skipped.
 *
 * The daily-briefing nudge runs on an hourly cron, gated behind the
 * `notification.briefing.push_enabled` SiteSetting (default OFF), sending at
 * `notification.briefing.push_hour_utc` (default 3 ≈ 08:30 IST). Per-user
 * daily dedup reuses BriefingDelivery with channel 'push' — the same
 * unique-constraint idempotency as the email mailer.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.initFirebaseIfNeeded();
  }

  private initFirebaseIfNeeded(): void {
    if (admin.apps.length) return;
    const raw = this.configService.get<string>('firebase.serviceAccountJson');
    if (!raw) {
      this.logger.warn('Firebase credentials not configured — push in mock mode');
      return;
    }
    try {
      // Same quote-stripping as AuthService (Render double-wraps env values).
      const cleaned = raw.trim().replace(/^['"]|['"]$/g, '');
      const parsed = JSON.parse(cleaned);
      admin.initializeApp({ credential: admin.credential.cert(parsed) });
      this.logger.log('Firebase initialized by PushService');
    } catch (error) {
      this.logger.error(`Firebase init failed: ${(error as Error).message}`);
    }
  }

  private messagingAvailable(): boolean {
    return admin.apps.length > 0;
  }

  // ── Token registry ────────────────────────────────────────────────────

  async registerToken(
    userId: string,
    token: string,
    platform: 'android' | 'ios' = 'android',
  ): Promise<{ registered: boolean }> {
    // Token is globally unique: upserting reassigns a token to whoever is
    // signed in on the device now (shared-device handoff).
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
    return { registered: true };
  }

  async unregisterToken(userId: string, token: string): Promise<{ removed: boolean }> {
    // Scoped to the owner so one user can't unregister another's device.
    const { count } = await this.prisma.pushToken.deleteMany({ where: { token, userId } });
    return { removed: count > 0 };
  }

  // ── Delivery ──────────────────────────────────────────────────────────

  /** Send to every device a user has registered; prunes dead tokens. */
  async sendToUser(userId: string, message: PushMessage): Promise<{ sent: number }> {
    if (!this.messagingAvailable()) return { sent: 0 };
    const rows = await this.prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (rows.length === 0) return { sent: 0 };

    const tokens = rows.map((r: { token: string }) => r.token);
    try {
      const res = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title: message.title, body: message.body },
        data: { url: message.url ?? '/(tabs)' },
        android: { priority: 'high' },
      });

      const dead: string[] = [];
      res.responses.forEach((r, i) => {
        const code = (r.error as { code?: string } | undefined)?.code;
        if (!r.success && code && DEAD_TOKEN_CODES.has(code)) dead.push(tokens[i]!);
      });
      if (dead.length) {
        await this.prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
      }
      return { sent: res.successCount };
    } catch (error) {
      this.logger.warn(`push send failed for ${userId}: ${(error as Error).message}`);
      return { sent: 0 };
    }
  }

  // ── Daily-briefing nudge ──────────────────────────────────────────────

  /** Hourly tick; fans out only on the configured hour with the flag on.
   *  ScheduleModule is registered app-wide (see payment-reconcile). */
  @Cron('0 5 * * * *')
  async hourlyPushTick(): Promise<void> {
    try {
      await this.runDailyBriefingPush();
    } catch (error) {
      this.logger.error(`daily push tick failed: ${(error as Error).message}`);
    }
  }

  async runDailyBriefingPush(now = new Date()): Promise<{ sent: number; skipped: number }> {
    const settings = await this.prisma.siteSetting.findMany({
      where: { key: { in: ['notification.briefing.push_enabled', 'notification.briefing.push_hour_utc'] } },
    });
    const map: Record<string, string> = {};
    for (const row of settings) map[row.key] = row.value;

    if (map['notification.briefing.push_enabled'] !== 'true') return { sent: 0, skipped: 0 };
    const configured = parseInt(map['notification.briefing.push_hour_utc'] ?? '', 10);
    const sendHour = Number.isFinite(configured) && configured >= 0 && configured <= 23 ? configured : 3;
    if (now.getUTCHours() !== sendHour) return { sent: 0, skipped: 0 };
    if (!this.messagingAvailable()) return { sent: 0, skipped: 0 };

    const sendDate = new Date(now.toISOString().slice(0, 10));
    // Users with at least one registered device, batched defensively.
    const users = await this.prisma.pushToken.findMany({
      distinct: ['userId'],
      select: { userId: true },
      take: 500,
    });

    let sent = 0;
    let skipped = 0;
    for (const { userId } of users) {
      try {
        // Same DB-side idempotency as the email mailer: one push per user per
        // local send-date, enforced by the (userId, sendDate, channel) unique.
        await this.prisma.briefingDelivery.create({
          data: { userId, sendDate, channel: 'push', status: 'SENT' },
        });
      } catch (error: any) {
        if (error?.code === 'P2002') {
          skipped++;
          continue; // already pushed today
        }
        throw error;
      }
      const res = await this.sendToUser(userId, {
        title: 'Your daily briefing is ready ✨',
        body: "See what the sky holds for you today.",
        url: '/(tabs)',
      });
      sent += res.sent;
    }
    if (sent > 0) this.logger.log(`daily briefing push: ${sent} sent, ${skipped} deduped`);
    return { sent, skipped };
  }
}
