import { spawnSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Integration test: Phase 0 wiring of Prisma through pgBouncer, plus
 * the GIN index on `knowledge_documents.keywords` that replaced the
 * seq-scan hot path for keyword search.
 *
 * The global setup spins up a Postgres + pgBouncer pair with a tight
 * pool (default_pool_size=5) so tests can exercise pool contention.
 */
describe('Prisma → pgBouncer', () => {
  let prismaDirect: PrismaClient;
  let prismaPooled: PrismaClient;

  beforeAll(async () => {
    prismaDirect = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.TEST_POSTGRES_URL! }),
    });
    prismaPooled = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.TEST_PGBOUNCER_URL! }),
    });
    await prismaDirect.$connect();
    await prismaPooled.$connect();
  });

  afterAll(async () => {
    await prismaDirect.$disconnect();
    await prismaPooled.$disconnect();
  });

  it('connects through pgBouncer and executes trivial queries', async () => {
    const rows = await prismaPooled.$queryRaw<Array<{ one: number }>>`SELECT 1 AS one`;
    expect(rows[0].one).toBe(1);
  });

  it('handles concurrent queries under the tight (5-conn) pool without errors', async () => {
    // Fan out 40 concurrent queries against a pool of 5. pgBouncer
    // should queue them and each one should still succeed.
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) => prismaPooled.$queryRaw<Array<{ n: number }>>`SELECT ${i}::int AS n`),
    );
    const values = results.flat().map((r) => r.n);
    expect(values.sort((a, b) => a - b)).toEqual(Array.from({ length: 40 }, (_, i) => i));
  });

  it('exposes pgBouncer admin console (SHOW LISTS) on the same port', () => {
    // pgBouncer ships a synthetic `pgbouncer` database that responds
    // to admin commands. Shell out to psql (already on PATH from the
    // postgresql-client package) since we don't want to introduce a
    // raw `pg` dependency just for this one assertion.
    const result = spawnSync(
      'psql',
      [
        '-h', process.env.TEST_PGBOUNCER_HOST!,
        '-p', String(process.env.TEST_PGBOUNCER_PORT),
        '-U', process.env.TEST_POSTGRES_USER!,
        '-d', 'pgbouncer',
        '-t',               // tuples-only
        '-A',               // unaligned
        '-c', 'SHOW LISTS;',
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, PGPASSWORD: process.env.TEST_POSTGRES_PASSWORD },
      },
    );
    expect(result.status).toBe(0);
    const output = result.stdout;
    // SHOW LISTS returns rows like `databases|1`, `pools|1`, etc.
    expect(output).toMatch(/databases\|/);
    expect(output).toMatch(/pools\|/);
  });
});

describe('GIN index on knowledge_documents.keywords', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.TEST_POSTGRES_URL! }),
    });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.knowledgeDocument.deleteMany({});
  });

  it('migration created the GIN index', async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'knowledge_documents'
        AND indexname = 'knowledge_documents_keywords_gin'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toMatch(/USING gin/i);
    expect(rows[0].indexdef).toMatch(/keywords/i);
  });

  it('keyword contains-query returns matching rows (correctness)', async () => {
    await prisma.knowledgeDocument.createMany({
      data: [
        { text: 'Mars in the 7th house', category: 'kundli', keywords: ['mars', '7th-house', 'dosha'] },
        { text: 'Moon phases explained', category: 'panchang', keywords: ['moon', 'tithi'] },
        { text: 'Mars transits', category: 'horoscope', keywords: ['mars', 'transit'] },
      ],
    });

    const rows = await prisma.$queryRaw<Array<{ id: string; text: string }>>`
      SELECT id, text
      FROM knowledge_documents
      WHERE keywords @> ARRAY['mars']
      ORDER BY text
    `;
    expect(rows.map((r) => r.text)).toEqual([
      'Mars in the 7th house',
      'Mars transits',
    ]);
  });

  it('the GIN index is usable by an array-contains query', async () => {
    // Insert enough rows that the planner has stats to work with, then
    // disable seq scans to force the index path. This validates that
    // the index is *usable* (correct operator class, correct column,
    // PostgreSQL recognizes it for `@>` queries) — which is what the
    // Phase 0 migration was meant to guarantee. Cost-based planner
    // decisions on production-sized tables are out of scope here.
    const data = Array.from({ length: 300 }, (_, i) => ({
      text: `Doc ${i}`,
      category: 'bulk',
      keywords: [`kw-${i % 50}`, `shared-${i % 5}`],
    }));
    await prisma.knowledgeDocument.createMany({ data });
    await prisma.$executeRawUnsafe('ANALYZE knowledge_documents');

    // With seq scans disabled, the planner MUST use the GIN index if
    // the index is compatible with the predicate. Use an interactive
    // transaction so SET LOCAL and EXPLAIN share the same connection.
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off');
      return tx.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(
        `EXPLAIN (FORMAT TEXT) SELECT id FROM knowledge_documents WHERE keywords @> ARRAY['kw-7']`,
      );
    });
    const plan = rows.map((r) => r['QUERY PLAN']).join('\n').toLowerCase();
    expect(plan).toMatch(/knowledge_documents_keywords_gin/);
    expect(plan).not.toMatch(/seq\s+scan\s+on\s+knowledge_documents\b/);

    // Also verify the query actually returns the right rows via the
    // index — correctness on top of the plan shape.
    const results = await prisma.knowledgeDocument.findMany({
      where: { keywords: { has: 'kw-7' } },
    });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => expect(r.keywords).toContain('kw-7'));
  });
});
