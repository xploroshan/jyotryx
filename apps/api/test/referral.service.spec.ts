/**
 * ReferralService — covers:
 *   - admin settings parsing (boolean coercion, clamp, defaults)
 *   - share-URL formatting
 *   - generated-code shape (length, alphabet, no confusing chars)
 *   - signup-time activation: happy path, disabled program, cap reached,
 *     unknown code, self-referral
 *   - admin stats aggregation (Premium-days = activated × bonus × 2)
 *
 * The Prisma client is mocked because these are unit tests; integration
 * tests live in `test/integration/` and exercise the real DB.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ReferralService,
  __test__ as helpers,
} from '../src/modules/referral/referral.service';
import { PrismaService } from '../src/prisma/prisma.service';

type AnyPrisma = any;

function makePrismaMock(overrides: Partial<AnyPrisma> = {}): AnyPrisma {
  const transaction = (jest as any)
    .fn()
    .mockImplementation(async (work: any) => {
      // The service passes `async (tx) => { ... }`; provide a tx that
      // delegates back to the same prisma mock so the helpers (subscription
      // create/update, user update, referral create) land on the spies the
      // tests inspect.
      return work(prisma);
    });

  const prisma: AnyPrisma = {
    siteSetting: {
      findMany: (jest as any).fn().mockResolvedValue([]),
    },
    user: {
      findUnique: (jest as any).fn().mockResolvedValue(null),
      update: (jest as any)
        .fn()
        .mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'u', ...data, referralCode: data?.referralCode ?? 'X' }),
        ),
    },
    referral: {
      count: (jest as any).fn().mockResolvedValue(0),
      findUnique: (jest as any).fn().mockResolvedValue(null),
      findMany: (jest as any).fn().mockResolvedValue([]),
      groupBy: (jest as any).fn().mockResolvedValue([]),
      aggregate: (jest as any).fn().mockResolvedValue({ _sum: { bonusDays: 0 } }),
      create: (jest as any)
        .fn()
        .mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'r1', ...data, createdAt: new Date() }),
        ),
    },
    subscription: {
      findFirst: (jest as any).fn().mockResolvedValue(null),
      create: (jest as any)
        .fn()
        .mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'sub-' + Math.random().toString(16).slice(2), ...data }),
        ),
      update: (jest as any)
        .fn()
        .mockImplementation(({ where }: any) => Promise.resolve({ id: where.id })),
    },
    $transaction: transaction,
  };
  return Object.assign(prisma, overrides);
}

async function buildService(prisma: AnyPrisma): Promise<ReferralService> {
  const mod: TestingModule = await Test.createTestingModule({
    providers: [
      ReferralService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return mod.get(ReferralService);
}

describe('ReferralService helpers', () => {
  it('parseBoolean accepts every common truthy/falsy form', () => {
    expect(helpers.parseBoolean('true', false)).toBe(true);
    expect(helpers.parseBoolean('TRUE', false)).toBe(true);
    expect(helpers.parseBoolean('1', false)).toBe(true);
    expect(helpers.parseBoolean('yes', false)).toBe(true);
    expect(helpers.parseBoolean('on', false)).toBe(true);
    expect(helpers.parseBoolean('false', true)).toBe(false);
    expect(helpers.parseBoolean('0', true)).toBe(false);
    expect(helpers.parseBoolean('off', true)).toBe(false);
    expect(helpers.parseBoolean('garbage', true)).toBe(true);
    expect(helpers.parseBoolean(undefined, false)).toBe(false);
  });

  it('clampInt clamps and falls back on garbage', () => {
    expect(helpers.clampInt('30', 7, 1, 365)).toBe(30);
    expect(helpers.clampInt('99999', 7, 1, 365)).toBe(365);
    expect(helpers.clampInt('-5', 7, 1, 365)).toBe(1);
    expect(helpers.clampInt('NaN', 7, 1, 365)).toBe(7);
    expect(helpers.clampInt('', 7, 1, 365)).toBe(7);
    expect(helpers.clampInt(undefined, 7, 1, 365)).toBe(7);
  });

  it('buildShareUrl strips trailing slashes and URL-encodes the code', () => {
    expect(helpers.buildShareUrl('https://www.myastro360.com', 'ABC123')).toBe(
      'https://www.myastro360.com/auth?ref=ABC123',
    );
    expect(helpers.buildShareUrl('https://www.myastro360.com/', 'ABC')).toBe(
      'https://www.myastro360.com/auth?ref=ABC',
    );
    expect(helpers.buildShareUrl('https://x.com', 'A B')).toBe(
      'https://x.com/auth?ref=A%20B',
    );
  });

  it('generateCode produces a fixed-length code with no confusable chars', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = helpers.generateCode();
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[A-Z2-9]+$/); // no 0/O/1/I
      expect(code).not.toMatch(/[01OI]/);
    }
  });
});

describe('ReferralService.getSettings', () => {
  it('returns defaults when site_settings is empty', async () => {
    const prisma = makePrismaMock();
    const svc = await buildService(prisma);
    const s = await svc.getSettings();
    expect(s).toEqual({ enabled: true, bonusDays: 30, maxPerReferrer: 10 });
  });

  it('reads admin overrides and clamps wild values', async () => {
    const prisma = makePrismaMock();
    (prisma.siteSetting.findMany as any).mockResolvedValue([
      { key: 'referral.enabled', value: 'false' },
      { key: 'referral.bonus_days', value: '15' },
      { key: 'referral.max_per_referrer', value: '99999' }, // clamped
    ]);
    const svc = await buildService(prisma);
    const s = await svc.getSettings();
    expect(s.enabled).toBe(false);
    expect(s.bonusDays).toBe(15);
    expect(s.maxPerReferrer).toBe(100); // hard max
  });
});

describe('ReferralService.activateAtSignup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when no code is provided', async () => {
    const prisma = makePrismaMock();
    const svc = await buildService(prisma);
    await svc.activateAtSignup('referee-1', null);
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it('does nothing when the code is unknown', async () => {
    const prisma = makePrismaMock();
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const svc = await buildService(prisma);
    await svc.activateAtSignup('referee-1', 'BOGUS123');
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it('refuses self-referral', async () => {
    const prisma = makePrismaMock();
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'referee-1',
      email: 'self@x.com',
    });
    const svc = await buildService(prisma);
    await svc.activateAtSignup('referee-1', 'SELF1234');
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it('records REJECTED when the program is disabled', async () => {
    const prisma = makePrismaMock();
    (prisma.siteSetting.findMany as any).mockResolvedValue([
      { key: 'referral.enabled', value: 'false' },
      { key: 'referral.bonus_days', value: '30' },
    ]);
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'referrer-1',
      email: 'r@x.com',
    });

    const svc = await buildService(prisma);
    await svc.activateAtSignup('referee-1', 'CODE0001');

    const calls = (prisma.referral.create as any).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0].data.status).toBe('REJECTED');
    expect(calls[0][0].data.rejectedReason).toBe('program_disabled');
    // No subscription should have been created/extended.
    expect(prisma.subscription.create).not.toHaveBeenCalled();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('records REJECTED with cap_reached when referrer exhausted slots', async () => {
    const prisma = makePrismaMock();
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'referrer-1',
      email: 'r@x.com',
    });
    (prisma.referral.count as any).mockResolvedValue(10);

    const svc = await buildService(prisma);
    await svc.activateAtSignup('referee-1', 'CODE0001');

    const calls = (prisma.referral.create as any).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0].data.status).toBe('REJECTED');
    expect(calls[0][0].data.rejectedReason).toBe('cap_reached');
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('grants Premium subs to BOTH sides on a happy-path activation', async () => {
    const prisma = makePrismaMock();
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'referrer-1',
      email: 'r@x.com',
    });
    (prisma.subscription.findFirst as any).mockResolvedValue(null);

    const svc = await buildService(prisma);
    await svc.activateAtSignup('referee-1', 'CODE0001');

    // Two new subscriptions created (one per side).
    expect(prisma.subscription.create).toHaveBeenCalledTimes(2);
    const creates = (prisma.subscription.create as any).mock.calls.map((c: any) => c[0].data);
    for (const data of creates) {
      expect(data.plan).toBe('MONTHLY');
      expect(data.status).toBe('ACTIVE');
      expect(data.source).toBe('REFERRAL');
      const ms = (data.endDate as Date).getTime() - (data.startDate as Date).getTime();
      // 30 days ± a couple of seconds for clock skew within the test.
      expect(Math.abs(ms - 30 * 24 * 60 * 60 * 1000)).toBeLessThan(5_000);
    }

    // Both users were promoted to PREMIUM.
    const userUpdates = (prisma.user.update as any).mock.calls.map((c: any) => c[0]);
    const roles = userUpdates.map((u: any) => u.data?.role).filter(Boolean);
    expect(roles).toContain('PREMIUM');
    expect(roles.filter((r: string) => r === 'PREMIUM')).toHaveLength(2);

    // Exactly one ACTIVATED referral row.
    const refCalls = (prisma.referral.create as any).mock.calls.map((c: any) => c[0].data);
    expect(refCalls).toHaveLength(1);
    expect(refCalls[0].status).toBe('ACTIVATED');
    expect(refCalls[0].bonusDays).toBe(30);
    expect(refCalls[0].activatedAt).toBeInstanceOf(Date);
  });

  it('extends an existing future-dated ACTIVE sub instead of creating a new one', async () => {
    const prisma = makePrismaMock();
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'referrer-1',
      email: 'r@x.com',
    });
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    (prisma.subscription.findFirst as any).mockResolvedValue({
      id: 'sub-existing',
      userId: 'referrer-1',
      status: 'ACTIVE',
      plan: 'MONTHLY',
      endDate: future,
      source: 'PAID',
    });

    const svc = await buildService(prisma);
    await svc.activateAtSignup('referee-1', 'CODE0001');

    // First call uses update (referrer's existing sub). Referee has no
    // existing sub (findFirst still returns 'sub-existing' in this stub —
    // both sides hit the same mock — so both ride the update path; that's
    // fine as long as we verify the update was called and the endDate was
    // extended from the *future* base, not from now).
    expect(prisma.subscription.update).toHaveBeenCalled();
    const firstUpdate = (prisma.subscription.update as any).mock.calls[0][0];
    const newEnd: Date = firstUpdate.data.endDate;
    const expected = new Date(future.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(Math.abs(newEnd.getTime() - expected.getTime())).toBeLessThan(5_000);
    // The original 'PAID' source is preserved (not clobbered to REFERRAL).
    expect(firstUpdate.data.source).toBe('PAID');
  });
});

describe('ReferralService.getAdminStats', () => {
  it('returns 2× bonus for activated referrals (both sides)', async () => {
    const prisma = makePrismaMock();
    (prisma.referral.groupBy as any).mockResolvedValue([
      { status: 'ACTIVATED', _count: { _all: 4 } },
      { status: 'REJECTED', _count: { _all: 1 } },
    ]);
    (prisma.referral.aggregate as any).mockResolvedValue({ _sum: { bonusDays: 4 * 30 } });
    (prisma.referral.findMany as any).mockResolvedValue([
      { referrerId: 'a' },
      { referrerId: 'b' },
    ]);

    const svc = await buildService(prisma);
    const s = await svc.getAdminStats();
    expect(s.totalActivated).toBe(4);
    expect(s.totalRejected).toBe(1);
    // 4 activated × 30 days × 2 sides
    expect(s.bonusDaysGranted).toBe(240);
    expect(s.distinctReferrers).toBe(2);
  });
});
