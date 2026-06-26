import { FeatureAccessService } from '../../src/common/feature-access/feature-access.service';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Proves admin settings actually PERSIST and are read back at runtime, against
 * a real migrated Postgres (the integration harness runs `prisma migrate
 * deploy`). Mirrors what AdminService.updateSettings does (an upsert into
 * site_settings) and then resolves the value through the same runtime path the
 * app uses (FeatureAccessService.getCreditCost), including from a SEPARATE
 * client so we know it survived the write — not just an in-process cache.
 */
describe('admin settings persistence (real Postgres)', () => {
  let prisma: PrismaService;
  let svc: FeatureAccessService;

  beforeAll(async () => {
    // PrismaService builds its driver adapter from DATABASE_URL at construction;
    // point it at the integration cluster the harness booted.
    process.env.DATABASE_URL = process.env.TEST_POSTGRES_URL;
    prisma = new PrismaService();
    await prisma.$connect();
    svc = new FeatureAccessService(prisma);
  });

  afterAll(async () => {
    await prisma.siteSetting.deleteMany({
      where: { key: { startsWith: 'pricing.credits.' } },
    });
    await prisma.$disconnect();
  });

  it('persists a credit-cost setting and resolves it via getCreditCost', async () => {
    // Simulate the admin "Credit costs" save (PUT /admin/settings → upsert).
    await prisma.siteSetting.upsert({
      where: { key: 'pricing.credits.deep_dive_cost' },
      update: { value: '9' },
      create: { key: 'pricing.credits.deep_dive_cost', value: '9' },
    });

    // Runtime read (what the deep-dive charge uses) returns the saved value.
    expect(await svc.getCreditCost('deep_dive', 3)).toBe(9);

    // A brand-new connection still sees it → it truly persisted to disk.
    const fresh = new PrismaService();
    await fresh.$connect();
    const row = await fresh.siteSetting.findUnique({
      where: { key: 'pricing.credits.deep_dive_cost' },
    });
    await fresh.$disconnect();
    expect(row?.value).toBe('9');
  });

  it('updates persist (upsert overwrites) and reflect immediately', async () => {
    await prisma.siteSetting.upsert({
      where: { key: 'pricing.credits.chat_cost' },
      update: { value: '5' },
      create: { key: 'pricing.credits.chat_cost', value: '5' },
    });
    expect(await svc.getCreditCost('chat', 1)).toBe(5);

    await prisma.siteSetting.upsert({
      where: { key: 'pricing.credits.chat_cost' },
      update: { value: '2' },
      create: { key: 'pricing.credits.chat_cost', value: '2' },
    });
    expect(await svc.getCreditCost('chat', 1)).toBe(2);
  });

  it('falls back to the env default when the setting is absent', async () => {
    await prisma.siteSetting.deleteMany({ where: { key: 'pricing.credits.kundli_cost' } });
    expect(await svc.getCreditCost('kundli', 2)).toBe(2);
  });
});
