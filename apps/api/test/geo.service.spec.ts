import { GeoService } from '../src/modules/geo/geo.service';

// Minimal Photon GeoJSON feature builder.
function feature(name: string, lon: number, lat: number, extra: Record<string, unknown> = {}) {
  return {
    geometry: { coordinates: [lon, lat] },
    properties: { name, osm_key: 'place', osm_value: 'city', country: 'India', state: 'Maharashtra', countrycode: 'in', ...extra },
  };
}

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  return jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
  } as any);
}

describe('GeoService', () => {
  let cache: { get: jest.Mock; set: jest.Mock };
  let service: GeoService;

  beforeEach(() => {
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
    service = new GeoService(cache as any);
    jest.restoreAllMocks();
  });

  it('returns [] for a too-short query without calling the upstream', async () => {
    const spy = jest.spyOn(global, 'fetch' as any);
    expect(await service.search('m')).toEqual([]);
    expect(await service.search('  ')).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('normalizes Photon features to {name,label,lat,lng}', async () => {
    mockFetchOnce({ features: [feature('Mumbai', 72.8777, 19.076)] });
    const r = await service.search('mumbai');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      name: 'Mumbai',
      label: 'Mumbai, Maharashtra, India',
      lat: 19.076,
      lng: 72.8777,
      country: 'India',
      state: 'Maharashtra',
      countryCode: 'IN',
    });
  });

  it('drops non-place features (streets, shops)', async () => {
    mockFetchOnce({
      features: [
        feature('Mumbai', 72.8777, 19.076),
        feature('Some Street', 72.9, 19.1, { osm_key: 'highway', osm_value: 'residential' }),
        feature('Corner Shop', 72.8, 19.0, { osm_key: 'shop', osm_value: 'convenience' }),
      ],
    });
    const r = await service.search('mumbai');
    expect(r.map((x) => x.name)).toEqual(['Mumbai']);
  });

  it('dedupes the same place returned under several OSM records', async () => {
    mockFetchOnce({
      features: [
        feature('Pune', 73.8567, 18.5204),
        feature('Pune', 73.857, 18.5206, { osm_value: 'administrative', osm_key: 'boundary' }),
      ],
    });
    const r = await service.search('pune');
    expect(r).toHaveLength(1);
  });

  it('honors the limit', async () => {
    const many = Array.from({ length: 10 }, (_, i) => feature(`City${i}`, 70 + i, 10 + i));
    mockFetchOnce({ features: many });
    const r = await service.search('city', 3);
    expect(r).toHaveLength(3);
  });

  it('returns [] (never throws) on an upstream error', async () => {
    mockFetchOnce({}, false, 503);
    expect(await service.search('mumbai')).toEqual([]);
  });

  it('returns [] (never throws) when fetch rejects (timeout/network)', async () => {
    jest.spyOn(global, 'fetch' as any).mockRejectedValueOnce(new Error('aborted'));
    expect(await service.search('mumbai')).toEqual([]);
  });

  it('serves a cache hit without calling the upstream', async () => {
    const cachedList = [{ name: 'Delhi', label: 'Delhi, India', lat: 28.6, lng: 77.2, country: 'India', state: null, countryCode: 'IN' }];
    cache.get.mockResolvedValueOnce(cachedList);
    const spy = jest.spyOn(global, 'fetch' as any);
    const r = await service.search('delhi');
    expect(r).toEqual(cachedList);
    expect(spy).not.toHaveBeenCalled();
  });

  it('caches the normalized result (including empty) after an upstream call', async () => {
    mockFetchOnce({ features: [] });
    await service.search('zzzznotaplace');
    expect(cache.set).toHaveBeenCalledWith(expect.stringContaining('geo:search:'), [], expect.any(Number));
  });

  it('still returns results when the cache READ throws (Redis down) — never a 500', async () => {
    cache.get.mockRejectedValueOnce(new Error('redis down'));
    mockFetchOnce({ features: [feature('Mumbai', 72.8777, 19.076)] });
    const r = await service.search('mumbai');
    expect(r.map((x) => x.name)).toEqual(['Mumbai']);
  });

  it('still returns results when the cache WRITE throws (Redis down)', async () => {
    cache.set.mockRejectedValueOnce(new Error('redis down'));
    mockFetchOnce({ features: [feature('Mumbai', 72.8777, 19.076)] });
    const r = await service.search('mumbai');
    expect(r).toHaveLength(1);
  });
});
