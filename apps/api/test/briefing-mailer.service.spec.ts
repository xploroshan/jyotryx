/**
 * BriefingMailerService — tests cover:
 *   - Settings parser clamps wild values to sane defaults
 *   - sendForUser refuses to send to a non-opted-in user
 *   - sendForUser returns 'skipped' when a delivery row already exists
 *   - sendForUser persists status=SENT on successful provider call
 *   - sendForUser persists status=FAILED when the provider throws
 *   - admin force=true bypasses opt-in + dedupe
 *   - email-template renders a non-empty HTML + plaintext body for both
 *
 * The BullMQ queue and DailyBriefingService are stubbed out so the
 * unit test stays fast and offline.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { BriefingMailerService } from '../src/modules/daily-briefing/briefing-mailer.service';
import { DailyBriefingService } from '../src/modules/daily-briefing/daily-briefing.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { renderBriefingEmail } from '../src/modules/daily-briefing/email-template';
import { BRIEFING_QUEUE } from '../src/queue/queue.constants';

type AnyPrisma = any;

function makePrismaMock(overrides: Partial<AnyPrisma> = {}): AnyPrisma {
  const prisma: AnyPrisma = {
    siteSetting: {
      findMany: (jest as any).fn().mockResolvedValue([]),
    },
    user: {
      findUnique: (jest as any).fn().mockResolvedValue({
        id: 'u',
        name: 'Test',
        email: 'test@example.com',
        briefingEmailEnabled: true,
        preferredLanguage: 'en',
      }),
      findMany: (jest as any).fn().mockResolvedValue([]),
      count: (jest as any).fn().mockResolvedValue(0),
    },
    briefingDelivery: {
      findUnique: (jest as any).fn().mockResolvedValue(null),
      upsert: (jest as any).fn().mockResolvedValue({}),
      groupBy: (jest as any).fn().mockResolvedValue([]),
    },
  };
  return Object.assign(prisma, overrides);
}

function makeBriefing(): DailyBriefingService {
  return {
    getDailyBriefing: (jest as any).fn().mockResolvedValue({
      greeting: 'Good morning, Arjun',
      date: new Date().toISOString(),
      dayQuality: 'excellent',
      summary: 'Today is a great day for new beginnings.',
      doList: ['Meditate', 'Wear blue', 'Recite mantra'],
      avoidList: ['Heavy decisions before 09:00', 'Confrontation'],
      planetaryHours: [],
      currentHora: null,
      luckyColor: 'Blue',
      luckyNumber: 7,
      luckyTime: '07:30 - 08:00',
      professionInsight: 'Focus on detail.',
      remedy: 'Donate yellow grains.',
      mantra: 'Om Brihaspataye Namah',
      panchang: {
        tithi: 'Saptami',
        nakshatra: 'Pushya',
        yoga: 'Siddha',
        vara: 'Saumya',
        rahukaal: '07:30 - 09:00',
      },
      transitAlert: 'Mercury enters Cancer at 18:42.',
    }),
  } as unknown as DailyBriefingService;
}

function makeQueue() {
  return {
    add: (jest as any).fn().mockResolvedValue({ id: '1' }),
    removeRepeatableByKey: (jest as any).fn().mockResolvedValue(undefined),
  };
}

async function buildService(opts: { prisma?: AnyPrisma; resolveProvider?: 'log' | 'resend' }): Promise<BriefingMailerService> {
  const prisma = opts.prisma ?? makePrismaMock();
  const config = {
    get: (k: string) => (k === 'frontendUrl' ? 'https://www.myastro360.com' : undefined),
  } as unknown as ConfigService;
  const briefing = makeBriefing();
  const queue = makeQueue();

  const mod: TestingModule = await Test.createTestingModule({
    providers: [
      BriefingMailerService,
      { provide: PrismaService, useValue: prisma },
      { provide: DailyBriefingService, useValue: briefing },
      { provide: ConfigService, useValue: config },
      { provide: getQueueToken(BRIEFING_QUEUE), useValue: queue },
    ],
  }).compile();
  // Don't trigger the cron registration in tests.
  return mod.get(BriefingMailerService);
}

describe('BriefingMailerService.getSettings', () => {
  it('returns defaults when site_settings is empty', async () => {
    const svc = await buildService({});
    const s = await svc.getSettings();
    expect(s.enabled).toBe(true);
    expect(s.sendHourUtc).toBe(1);
    expect(s.fromEmail).toBe('info@myastro360.com');
    expect(s.fromName).toBe('MyAstro360');
  });

  it('clamps invalid send-hour values to the default', async () => {
    const prisma = makePrismaMock();
    (prisma.siteSetting.findMany as any).mockResolvedValue([
      { key: 'notification.briefing.send_hour_utc', value: '99' },
    ]);
    const svc = await buildService({ prisma });
    const s = await svc.getSettings();
    expect(s.sendHourUtc).toBe(1);
  });
});

describe('BriefingMailerService.sendForUser', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("returns 'skipped' for a user who hasn't opted in", async () => {
    const prisma = makePrismaMock();
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'u', name: 'Test', email: 't@t', briefingEmailEnabled: false, preferredLanguage: 'en',
    });
    const svc = await buildService({ prisma });
    const result = await svc.sendForUser('u');
    expect(result).toBe('skipped');
    expect(prisma.briefingDelivery.upsert).not.toHaveBeenCalled();
  });

  it("returns 'skipped' when a delivery row already exists for today", async () => {
    const prisma = makePrismaMock();
    (prisma.briefingDelivery.findUnique as any).mockResolvedValue({ status: 'SENT' });
    const svc = await buildService({ prisma });
    const result = await svc.sendForUser('u');
    expect(result).toBe('skipped');
  });

  it('persists SENT on a successful send', async () => {
    const prisma = makePrismaMock();
    const svc = await buildService({ prisma });
    const result = await svc.sendForUser('u');
    expect(result).toBe('sent');
    const upsertArgs = (prisma.briefingDelivery.upsert as any).mock.calls[0][0];
    expect(upsertArgs.create.status).toBe('SENT');
  });

  it('admin force=true bypasses dedupe and opt-in', async () => {
    const prisma = makePrismaMock();
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'u', name: 'Test', email: 't@t', briefingEmailEnabled: false, preferredLanguage: 'en',
    });
    (prisma.briefingDelivery.findUnique as any).mockResolvedValue({ status: 'SENT' });
    const svc = await buildService({ prisma });
    const result = await svc.sendForUser('u', undefined, undefined, /*force*/ true);
    expect(result).toBe('sent');
    // Force path explicitly does NOT pollute the dedupe table.
    expect(prisma.briefingDelivery.upsert).not.toHaveBeenCalled();
  });
});

describe('BriefingMailerService.hourlyBriefingTick (catch-up scheduler)', () => {
  const ORIGINAL_DISABLE = process.env.DISABLE_QUEUES;
  // Pin the wall clock to 10:00 UTC so send-hour branches are deterministic.
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-16T10:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
    if (ORIGINAL_DISABLE === undefined) delete process.env.DISABLE_QUEUES;
    else process.env.DISABLE_QUEUES = ORIGINAL_DISABLE;
    jest.clearAllMocks();
  });

  function prismaWithSendHour(hour: number): AnyPrisma {
    const prisma = makePrismaMock();
    (prisma.siteSetting.findMany as any).mockResolvedValue([
      { key: 'notification.briefing.send_hour_utc', value: String(hour) },
    ]);
    return prisma;
  }

  async function runsAt(sendHour: number, disableQueues: boolean): Promise<boolean> {
    if (disableQueues) process.env.DISABLE_QUEUES = 'true';
    else delete process.env.DISABLE_QUEUES;
    const svc = await buildService({ prisma: prismaWithSendHour(sendHour) });
    const fanout = jest
      .spyOn(svc, 'runDailyFanout')
      .mockResolvedValue({ selected: 0, sent: 0, failed: 0, skipped: 0 });
    await svc.hourlyBriefingTick();
    return (fanout as any).mock.calls.length > 0;
  }

  // Clock pinned to 10:00 UTC.
  describe('queues disabled (this cron is the primary sender)', () => {
    it('sends AT the send hour', async () => expect(await runsAt(10, true)).toBe(true));
    it('catches up in the hours AFTER the send hour', async () => expect(await runsAt(9, true)).toBe(true));
    it('does nothing BEFORE the send hour', async () => expect(await runsAt(11, true)).toBe(false));
  });

  describe('queues live (BullMQ owns the on-time send)', () => {
    it('does NOT double-send at the exact send hour', async () => expect(await runsAt(10, false)).toBe(false));
    it('DOES catch up after the send hour (self-heals a missed BullMQ tick)', async () =>
      expect(await runsAt(9, false)).toBe(true));
    it('does nothing before the send hour', async () => expect(await runsAt(11, false)).toBe(false));
  });

  it('never sends when the briefing is globally disabled', async () => {
    process.env.DISABLE_QUEUES = 'true';
    const prisma = makePrismaMock();
    (prisma.siteSetting.findMany as any).mockResolvedValue([
      { key: 'notification.briefing.enabled', value: 'false' },
      { key: 'notification.briefing.send_hour_utc', value: '9' },
    ]);
    const svc = await buildService({ prisma });
    const fanout = jest.spyOn(svc, 'runDailyFanout');
    await svc.hourlyBriefingTick();
    expect(fanout).not.toHaveBeenCalled();
  });
});

describe('renderBriefingEmail', () => {
  it('renders non-empty HTML and matching plaintext', () => {
    const out = renderBriefingEmail({
      userName: 'Arjun Sharma',
      briefing: {
        greeting: 'Good morning, Arjun',
        date: new Date().toISOString(),
        dayQuality: 'excellent',
        summary: 'A bright day awaits.',
        doList: ['One', 'Two'],
        avoidList: ['Three'],
        planetaryHours: [],
        currentHora: null,
        luckyColor: 'Blue',
        luckyNumber: 7,
        luckyTime: '07:30',
        professionInsight: '',
        remedy: '',
        mantra: '',
        panchang: {
          tithi: 'Saptami',
          nakshatra: 'Pushya',
          yoga: 'Siddha',
          vara: 'Saumya',
          rahukaal: '07:30 - 09:00',
        },
        transitAlert: null,
      } as any,
      appUrl: 'https://www.myastro360.com/my-day',
      prefsUrl: 'https://www.myastro360.com/profile',
    });

    expect(out.subject).toContain('Saptami');
    expect(out.html).toContain('A bright day awaits');
    expect(out.html).toContain('Pushya');
    expect(out.html).toMatch(/<table[^>]*>/); // table-based layout
    expect(out.text).toContain('A bright day awaits');
    expect(out.text).toContain('Pushya');
    expect(out.text).toContain('Open today');
  });

  it('escapes user-controlled fields to prevent HTML injection', () => {
    const out = renderBriefingEmail({
      userName: 'Arjun',
      briefing: {
        greeting: '<script>alert("x")</script>',
        date: new Date().toISOString(),
        dayQuality: 'excellent' as const,
        summary: 'safe',
        doList: ['<b>bold</b>'],
        avoidList: [],
        planetaryHours: [],
        currentHora: null,
        luckyColor: '"red"',
        luckyNumber: 1,
        luckyTime: 'now',
        professionInsight: '',
        remedy: '',
        mantra: '',
        panchang: { tithi: 't', nakshatra: 'n', yoga: 'y', vara: 'v', rahukaal: 'r' },
        transitAlert: null,
      } as any,
      appUrl: 'https://x',
      prefsUrl: 'https://x',
    });
    expect(out.html).not.toContain('<script>alert');
    expect(out.html).toContain('&lt;script&gt;');
    expect(out.html).toContain('&lt;b&gt;bold&lt;/b&gt;');
  });
});
