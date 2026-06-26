import {
  buildMitigationPlan,
  haversineKm,
  KNOWN_CONDITIONS,
  PLANET_REMEDIES,
  type MitigationModality,
} from '../src/modules/astrology/mitigation';

describe('mitigation engine', () => {
  const NON_TEMPLE: MitigationModality[] = [
    'food',
    'activity',
    'charity',
    'fasting',
    'gemstone',
    'mantra',
    'rudraksha',
  ];

  it('every known condition yields a usable plan with temples + all modalities', () => {
    for (const issue of KNOWN_CONDITIONS) {
      const plan = buildMitigationPlan(issue);
      expect(plan).not.toBeNull();
      if (!plan) continue;
      expect(plan.issue).toBe(issue);
      expect(plan.label.length).toBeGreaterThan(0);
      expect(plan.overview.length).toBeGreaterThan(0);
      expect(plan.disclaimer).toMatch(/astrologer/i);
      // Temples present and well-formed.
      expect(plan.temples.length).toBeGreaterThan(0);
      for (const t of plan.temples) {
        expect(typeof t.name).toBe('string');
        expect(Number.isFinite(t.lat)).toBe(true);
        expect(Number.isFinite(t.lng)).toBe(true);
      }
      // Every non-temple modality is represented.
      const modalities = new Set(plan.groups.map((g) => g.modality));
      for (const m of NON_TEMPLE) {
        expect(modalities.has(m)).toBe(true);
      }
      // Every item is non-empty.
      for (const g of plan.groups) {
        expect(g.items.length).toBeGreaterThan(0);
        for (const it of g.items) {
          expect(it.title.trim().length).toBeGreaterThan(0);
          expect(it.detail.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('the gemstone group always carries a safety caution', () => {
    const plan = buildMitigationPlan('sade_sati');
    const gem = plan?.groups.find((g) => g.modality === 'gemstone');
    expect(gem).toBeDefined();
    expect(gem?.items[0].caution).toBeTruthy();
  });

  it('Saturn conditions reuse the Saturn remedy library', () => {
    const sade = buildMitigationPlan('sade_sati');
    expect(sade?.planet).toBe('Saturn');
    const gem = sade?.groups.find((g) => g.modality === 'gemstone');
    expect(gem?.items[0].title).toBe(PLANET_REMEDIES.Saturn.gemstone.title);
  });

  it('folds condition rituals into the activity group', () => {
    const plan = buildMitigationPlan('pitra');
    const activity = plan?.groups.find((g) => g.modality === 'activity');
    expect(activity).toBeDefined();
    // The Pitra ritual (Pind Daan / Tarpan) is prepended.
    expect(activity?.items.some((i) => /tarpan|pind daan/i.test(i.detail))).toBe(true);
  });

  it('normalises aliases (manglik -> mangal, kaalsarp -> kaal_sarp)', () => {
    expect(buildMitigationPlan('manglik')?.issue).toBe('mangal');
    expect(buildMitigationPlan('Mangal Dosha')?.issue).toBe('mangal');
    expect(buildMitigationPlan('kaalsarp')?.issue).toBe('kaal_sarp');
  });

  it('composes a generic plan for a bare/weak planet', () => {
    const weak = buildMitigationPlan('weak_jupiter');
    expect(weak).not.toBeNull();
    expect(weak?.planet).toBe('Jupiter');
    expect(weak?.temples.length).toBeGreaterThan(0);
    const bare = buildMitigationPlan('saturn');
    expect(bare?.planet).toBe('Saturn');
  });

  it('returns null for an unknown issue', () => {
    expect(buildMitigationPlan('not_a_real_issue')).toBeNull();
    expect(buildMitigationPlan('')).toBeNull();
  });

  it('ranks temples nearest-first when coordinates are supplied', () => {
    // Bengaluru — southern temples should sort ahead of northern ones.
    const plan = buildMitigationPlan('sade_sati', { lat: 12.9716, lng: 77.5946 });
    expect(plan).not.toBeNull();
    const dists = plan!.temples.map((t) => t.distanceKm);
    expect(dists.every((d) => typeof d === 'number')).toBe(true);
    const sorted = [...dists].sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(dists).toEqual(sorted);
  });

  it('haversine returns ~0 for identical points and a sane distance otherwise', () => {
    expect(haversineKm({ lat: 19, lng: 73 }, { lat: 19, lng: 73 })).toBeCloseTo(0, 5);
    // Ujjain -> Nashik is roughly 350-450 km.
    const d = haversineKm({ lat: 23.1828, lng: 75.7682 }, { lat: 19.9333, lng: 73.53 });
    expect(d).toBeGreaterThan(300);
    expect(d).toBeLessThan(500);
  });
});
