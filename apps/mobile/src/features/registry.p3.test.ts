import { getFeature } from './index';
import type { TraditionId } from '@myastro360/shared';

const P3: Record<Exclude<TraditionId, 'VEDIC'>, string[]> = {
  WESTERN: ['natal', 'transits', 'synastry'],
  CHINESE: ['bazi', 'zodiac', 'flying-stars'],
  HELLENISTIC: ['natal', 'profections', 'zodiacal-releasing'],
  HORARY: ['ask', 'history'],
  MEDICAL: ['decumbiture', 'body-zodiac'],
};

describe('P3 tradition registries', () => {
  it('wires every P3 feature via getFeature', () => {
    for (const [tradition, slugs] of Object.entries(P3) as [TraditionId, string[]][]) {
      for (const slug of slugs) {
        const f = getFeature(tradition, slug);
        expect(f).not.toBeNull();
        expect(typeof f!.build).toBe('function');
        expect(f!.Result).toBeTruthy();
      }
    }
  });

  it('cross-tradition slug collisions resolve per tradition (natal)', () => {
    // "natal" exists in both Western and Hellenistic and must differ.
    expect(getFeature('WESTERN', 'natal')!.title).toBe('Western Natal');
    expect(getFeature('HELLENISTIC', 'natal')!.title).toBe('Hellenistic Natal');
  });

  it('horary history is a custom (client-side) screen; ask persists via onSuccess', () => {
    expect(getFeature('HORARY', 'history')!.custom).toBeTruthy();
    expect(typeof getFeature('HORARY', 'ask')!.onSuccess).toBe('function');
  });

  it('profile-driven P3 features auto-run and require the birth profile', () => {
    for (const [t, slug] of [
      ['WESTERN', 'transits'],
      ['HELLENISTIC', 'zodiacal-releasing'],
    ] as [TraditionId, string][]) {
      const f = getFeature(t, slug)!;
      expect(f.autoRun).toBe(true);
      expect(f.requiresBirthProfile).toBe(true);
      expect(f.fields.length).toBe(0);
    }
  });

  it('returns null for an unknown feature', () => {
    expect(getFeature('MEDICAL', 'nope')).toBeNull();
  });
});
