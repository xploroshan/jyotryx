/**
 * ExperimentService — tests cover:
 *   - hash bucket determinism (same key → same variant always)
 *   - weight ramp (0/100 → everyone in one arm; 50/50 → roughly even)
 *   - parser helpers (boolean, weight clamp)
 *   - assign() returns existing assignment unchanged
 *   - assign() persists a new row when seen for the first time
 *   - assign() short-circuits to "control" when the experiment is off
 *   - recordConversion only updates rows whose convertedAt is null
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ExperimentService,
  __test__ as helpers,
} from '../src/modules/experiment/experiment.service';
import { PrismaService } from '../src/prisma/prisma.service';

type AnyPrisma = any;

function makePrismaMock(overrides: Partial<AnyPrisma> = {}): AnyPrisma {
  const prisma: AnyPrisma = {
    siteSetting: {
      findMany: (jest as any).fn().mockResolvedValue([]),
    },
    experimentAssignment: {
      findUnique: (jest as any).fn().mockResolvedValue(null),
      create: (jest as any).fn().mockImplementation(async ({ data }: any) => data),
      updateMany: (jest as any).fn().mockResolvedValue({ count: 1 }),
      groupBy: (jest as any).fn().mockResolvedValue([]),
    },
  };
  return Object.assign(prisma, overrides);
}

async function buildService(prisma: AnyPrisma): Promise<ExperimentService> {
  const mod: TestingModule = await Test.createTestingModule({
    providers: [
      ExperimentService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return mod.get(ExperimentService);
}

describe('ExperimentService helpers', () => {
  it('parseBool accepts every common form', () => {
    expect(helpers.parseBool('true', false)).toBe(true);
    expect(helpers.parseBool('false', true)).toBe(false);
    expect(helpers.parseBool('1', false)).toBe(true);
    expect(helpers.parseBool('0', true)).toBe(false);
    expect(helpers.parseBool(undefined, true)).toBe(true);
    expect(helpers.parseBool('garbage', false)).toBe(false);
  });

  it('clampWeight clamps to 0..100 and falls back on garbage', () => {
    expect(helpers.clampWeight('50', 0)).toBe(50);
    expect(helpers.clampWeight('999', 0)).toBe(100);
    expect(helpers.clampWeight('-5', 0)).toBe(0);
    expect(helpers.clampWeight('NaN', 7)).toBe(7);
    expect(helpers.clampWeight('', 7)).toBe(7);
    expect(helpers.clampWeight(undefined, 7)).toBe(7);
  });

  it('hashBucket is deterministic for the same seed', () => {
    expect(helpers.hashBucket('abc', 100)).toBe(helpers.hashBucket('abc', 100));
    // Different seeds produce different buckets across the population.
    const seen = new Set<number>();
    for (let i = 0; i < 50; i += 1) seen.add(helpers.hashBucket(`u-${i}`, 1000));
    expect(seen.size).toBeGreaterThan(40); // not collapsing to a few values
  });

  it('pickVariant respects 0/100 weights (everyone in one arm)', () => {
    for (let i = 0; i < 30; i += 1) {
      const v = helpers.pickVariant('e', `key-${i}`, { control: 0, first_free: 100 });
      expect(v).toBe('first_free');
    }
    for (let i = 0; i < 30; i += 1) {
      const v = helpers.pickVariant('e', `key-${i}`, { control: 100, first_free: 0 });
      expect(v).toBe('control');
    }
  });

  it('pickVariant produces roughly even split at 50/50', () => {
    const counts = { control: 0, first_free: 0 };
    for (let i = 0; i < 2000; i += 1) {
      const v = helpers.pickVariant('paywall_v1', `user-${i}`, { control: 50, first_free: 50 });
      counts[v] += 1;
    }
    // Allow a wide tolerance — sha-256 + 4-byte prefix is plenty random
    // for 2k samples to land within ±10% of 50/50, but tests don't
    // need to be that strict.
    const ratio = counts.control / (counts.control + counts.first_free);
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });
});

describe('ExperimentService.assignPaywall', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns control without persisting when the experiment is disabled', async () => {
    const prisma = makePrismaMock();
    (prisma.siteSetting.findMany as any).mockResolvedValue([
      { key: 'paywall.experiment_enabled', value: 'false' },
    ]);
    const svc = await buildService(prisma);

    const result = await svc.assignPaywall('u:abc');
    expect(result).toEqual({ experiment: 'paywall_v1', variant: 'control', created: false });
    expect(prisma.experimentAssignment.create).not.toHaveBeenCalled();
  });

  it('returns the existing assignment for a known key', async () => {
    const prisma = makePrismaMock();
    (prisma.experimentAssignment.findUnique as any).mockResolvedValue({ variant: 'first_free' });
    const svc = await buildService(prisma);

    const result = await svc.assignPaywall('u:returning');
    expect(result.variant).toBe('first_free');
    expect(result.created).toBe(false);
    expect(prisma.experimentAssignment.create).not.toHaveBeenCalled();
  });

  it('persists a new assignment for a previously-unseen key', async () => {
    const prisma = makePrismaMock();
    const svc = await buildService(prisma);

    const result = await svc.assignPaywall('u:fresh', { isAuthenticated: true, userId: 'u' });
    expect(result.created).toBe(true);
    expect(prisma.experimentAssignment.create).toHaveBeenCalledTimes(1);
    const data = (prisma.experimentAssignment.create as any).mock.calls[0][0].data;
    expect(['control', 'first_free']).toContain(data.variant);
    expect(data.isAuthenticated).toBe(true);
    expect(data.userId).toBe('u');
  });

  it('handles a unique-violation race by re-reading the existing row', async () => {
    const prisma = makePrismaMock();
    (prisma.experimentAssignment.create as any).mockRejectedValueOnce({ code: 'P2002' });
    (prisma.experimentAssignment.findUnique as any)
      .mockResolvedValueOnce(null) // first lookup before the failed create
      .mockResolvedValueOnce({ variant: 'first_free' }); // re-read after the race

    const svc = await buildService(prisma);
    const result = await svc.assignPaywall('u:race');
    expect(result.variant).toBe('first_free');
    expect(result.created).toBe(false);
  });
});

describe('ExperimentService.recordConversion', () => {
  it('only updates rows whose convertedAt is null', async () => {
    const prisma = makePrismaMock();
    const svc = await buildService(prisma);

    await svc.recordConversion('u:1', 'signup');
    const where = (prisma.experimentAssignment.updateMany as any).mock.calls[0][0].where;
    expect(where.convertedAt).toBeNull();
    expect(where.experiment).toBe('paywall_v1');
  });

  it('returns updated:false when no row matched', async () => {
    const prisma = makePrismaMock();
    (prisma.experimentAssignment.updateMany as any).mockResolvedValue({ count: 0 });
    const svc = await buildService(prisma);

    const result = await svc.recordConversion('u:already-converted', 'signup');
    expect(result.updated).toBe(false);
  });
});

describe('ExperimentService.getStats', () => {
  it('returns per-variant assignments + conversions with CVR rounded to 2dp', async () => {
    const prisma = makePrismaMock();
    (prisma.experimentAssignment.groupBy as any)
      .mockResolvedValueOnce([
        // assignments
        { variant: 'control', _count: { _all: 100 } },
        { variant: 'first_free', _count: { _all: 100 } },
      ])
      .mockResolvedValueOnce([
        // conversions
        { variant: 'control', _count: { _all: 12 } },
        { variant: 'first_free', _count: { _all: 17 } },
      ]);
    const svc = await buildService(prisma);

    const stats = await svc.getStats();
    expect(stats.totalAssignments).toBe(200);
    expect(stats.totalConversions).toBe(29);

    const control = stats.variants.find((v) => v.variant === 'control')!;
    const firstFree = stats.variants.find((v) => v.variant === 'first_free')!;
    expect(control.conversionRate).toBe(12);
    expect(firstFree.conversionRate).toBe(17);
  });
});
