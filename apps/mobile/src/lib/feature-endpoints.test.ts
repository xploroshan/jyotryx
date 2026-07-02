import { resolveAccess, TRADITION_LIST } from '@myastro360/shared';
import { resolveFeatureEndpoint } from './feature-endpoints';

describe('feature-endpoints map', () => {
  it('maps every registry feature to a verified endpoint', () => {
    for (const tradition of TRADITION_LIST) {
      for (const feature of tradition.features) {
        const ep = resolveFeatureEndpoint(tradition.id, feature.slug);
        expect(ep).not.toBeNull();
        expect(ep?.path.length).toBeGreaterThan(0);
      }
    }
  });

  it('reuses the kundli endpoint for Dasha and Hellenistic Natal', () => {
    expect(resolveFeatureEndpoint('VEDIC', 'dasha')?.path).toBe('/astrology/kundli');
    expect(resolveFeatureEndpoint('HELLENISTIC', 'natal')?.path).toBe('/astrology/kundli');
  });

  it('marks Horary history as client-side (no API)', () => {
    expect(resolveFeatureEndpoint('HORARY', 'history')?.method).toBe('CLIENT');
  });
});

describe('gating', () => {
  const config = { freeMode: false, subscriptionsEnabled: true, creditCosts: { kundli: 2 } };

  it('allows free features regardless of balance', () => {
    const d = resolveAccess('free', 'horoscope', config, { credits: 0, isPremium: false, entitlements: [] });
    expect(d.allowed).toBe(true);
  });

  it('blocks a credit feature when the balance is short', () => {
    const d = resolveAccess('credit', 'kundli', config, { credits: 1, isPremium: false, entitlements: [] });
    expect(d).toEqual({ allowed: false, reason: 'needCredits', costCredits: 2 });
  });

  it('honours freeMode from SiteSettings', () => {
    const d = resolveAccess('credit', 'kundli', { ...config, freeMode: true }, {
      credits: 0,
      isPremium: false,
      entitlements: [],
    });
    expect(d.allowed).toBe(true);
  });
});
