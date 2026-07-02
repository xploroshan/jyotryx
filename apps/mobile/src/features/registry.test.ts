import { VEDIC_FEATURES, getVedicFeature } from './registry';

// Vedic features (P2 built 15; P4 adds chat + palmistry → the full 17).
const EXPECTED = [
  'kundli',
  'dasha',
  'dosha',
  'divisional',
  'kp-astrology',
  'matching',
  'horoscope',
  'panchang',
  'muhurat',
  'cosmic-calendar',
  'decision-room',
  'numerology',
  'mulank',
  'tarot',
  'vastu',
  'chat',
  'palmistry',
];

describe('Vedic feature registry', () => {
  it('wires every P2 feature with a builder, result renderer, and gate', () => {
    for (const slug of EXPECTED) {
      const f = getVedicFeature(slug);
      expect(f).not.toBeNull();
      expect(typeof f!.build).toBe('function');
      expect(f!.Result).toBeTruthy();
      expect(['free', 'credit', 'entitlement', 'premium']).toContain(f!.gate);
    }
    expect(Object.keys(VEDIC_FEATURES).sort()).toEqual([...EXPECTED].sort());
  });

  it('numerology conditional fields switch by mode', () => {
    const f = getVedicFeature('numerology')!;
    const nameField = f.fields.find((x) => x.key === 'name')!;
    const brandField = f.fields.find((x) => x.key === 'brandName')!;
    expect(nameField.showIf!({ mode: 'name' })).toBe(true);
    expect(nameField.showIf!({ mode: 'brand' })).toBe(false);
    expect(brandField.showIf!({ mode: 'brand' })).toBe(true);
  });

  it('profile-only features carry no input fields but auto-run', () => {
    for (const slug of ['dasha', 'dosha', 'mulank', 'panchang']) {
      const f = getVedicFeature(slug)!;
      expect(f.fields.length).toBe(0);
      expect(f.autoRun).toBe(true);
    }
  });

  it('features requiring birth profile are the profile-driven ones', () => {
    expect(getVedicFeature('dasha')!.requiresBirthProfile).toBe(true);
    expect(getVedicFeature('dosha')!.requiresBirthProfile).toBe(true);
    expect(getVedicFeature('mulank')!.requiresBirthProfile).toBe(true);
    // Kundli collects birth details in-form, so it must NOT hard-require profile.
    expect(getVedicFeature('kundli')!.requiresBirthProfile).toBeFalsy();
  });
});
