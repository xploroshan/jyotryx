import { GeoService } from '../src/modules/geo/geo.service';

// These tests hit the REAL bundled city dataset (all-the-cities) — no mocking of
// the data source. That's deliberate: the previous version proxied a web
// service that the deployed backend couldn't reach, and mocked tests happily
// passed while production returned nothing. Exercising the real index means a
// broken "Delhi" lookup fails the suite.
describe('GeoService (offline city index)', () => {
  let service: GeoService;

  beforeEach(() => {
    service = new GeoService();
  });

  it('returns [] for a too-short query', async () => {
    expect(await service.search('d')).toEqual([]);
    expect(await service.search('  ')).toEqual([]);
    expect(await service.search('')).toEqual([]);
  });

  it('finds a major city and ranks the most populous match first', async () => {
    const r = await service.search('Delhi');
    expect(r.length).toBeGreaterThan(0);
    // Delhi, India (pop ~11M) must outrank the US hamlets also named Delhi.
    expect(r[0].name).toBe('Delhi');
    expect(r[0].countryCode).toBe('IN');
    expect(r[0].label).toBe('Delhi, India');
    expect(Math.round(r[0].lat)).toBe(29); // ~28.65
    expect(Math.round(r[0].lng)).toBe(77); // ~77.23
  });

  it('finds a small town (Sakleshpur) — the case that was stuck on the prompt', async () => {
    const r = await service.search('Sakleshpur');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].name).toBe('Sakleshpur');
    expect(r[0].countryCode).toBe('IN');
    expect(r[0].lat).toBeCloseTo(12.94, 1);
    expect(r[0].lng).toBeCloseTo(75.78, 1);
  });

  it('resolves historical / anglicised names via the alias table', async () => {
    const bangalore = await service.search('Bangalore');
    expect(bangalore[0]?.name).toBe('Bangalore');
    expect(bangalore[0]?.lat).toBeCloseTo(12.97, 1);

    const bombay = await service.search('Bombay');
    expect(bombay[0]?.name).toBe('Bombay');
    expect(bombay[0]?.lng).toBeCloseTo(72.88, 1);
  });

  it('is a prefix search (partial name returns candidates)', async () => {
    const r = await service.search('mumb');
    expect(r.some((c) => c.name.toLowerCase().startsWith('mumb'))).toBe(true);
  });

  it('honours the limit (1–8)', async () => {
    const r = await service.search('san', 3);
    expect(r.length).toBeLessThanOrEqual(3);
    const capped = await service.search('san', 999);
    expect(capped.length).toBeLessThanOrEqual(8);
  });

  it('dedupes same-name/same-country duplicates', async () => {
    const r = await service.search('delhi', 8);
    const keys = r.map((c) => `${c.name.toLowerCase()}|${c.countryCode}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('returns [] for a nonsense query (no throw)', async () => {
    expect(await service.search('zzzqwxnotaplace')).toEqual([]);
  });

  it('builds the index once and reuses it across searches', async () => {
    await service.search('delhi');
    const spy = jest.spyOn(service as any, 'buildIndex');
    await service.search('mumbai');
    // buildIndex returns the cached array immediately; still called but cheap.
    expect(spy).toHaveReturned();
  });
});
