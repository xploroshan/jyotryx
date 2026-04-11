describe('integration harness smoke', () => {
  it('globalSetup exported coordinates for redis, postgres, pgbouncer', () => {
    expect(process.env.TEST_REDIS_HOST).toBeDefined();
    expect(Number(process.env.TEST_REDIS_PORT)).toBeGreaterThan(0);
    expect(process.env.TEST_POSTGRES_URL).toMatch(/^postgresql:\/\//);
    expect(process.env.TEST_PGBOUNCER_URL).toMatch(/^postgresql:\/\//);
  });
});
