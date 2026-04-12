/**
 * My-Day Component Tests
 *
 * Validates the code-split PlanetaryHoursSection and translation helpers.
 */
import { describe, it, expect } from 'vitest';
import { en } from '@/i18n/en';

// ─── Translation Helpers ───────────────────────────────────────────────

describe('My-Day Translation Helpers', () => {
  let helpers: typeof import('@/app/my-day/components/translations');

  beforeAll(async () => {
    helpers = await import('@/app/my-day/components/translations');
  });

  describe('getQualityLabel', () => {
    it('should map "excellent" to the correct translation', () => {
      expect(helpers.getQualityLabel('excellent', en)).toBe(en.myDay.qualityExcellent);
    });

    it('should map "good" to the correct translation', () => {
      expect(helpers.getQualityLabel('good', en)).toBe(en.myDay.qualityGood);
    });

    it('should map "moderate" to the correct translation', () => {
      expect(helpers.getQualityLabel('moderate', en)).toBe(en.myDay.qualityModerate);
    });

    it('should map "challenging" to the correct translation', () => {
      expect(helpers.getQualityLabel('challenging', en)).toBe(en.myDay.qualityChallenging);
    });

    it('should return the key itself for unknown quality values', () => {
      expect(helpers.getQualityLabel('unknown-quality', en)).toBe('unknown-quality');
    });
  });

  describe('translatePlanet', () => {
    const planets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

    it('should translate all 7 planets', () => {
      for (const planet of planets) {
        const result = helpers.translatePlanet(planet, en);
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it('should return the key itself for unknown planets', () => {
      expect(helpers.translatePlanet('Pluto', en)).toBe('Pluto');
    });
  });

  describe('translateColor', () => {
    const colors = [
      'Ruby Red', 'Pearl White', 'Coral Red',
      'Emerald Green', 'Golden Yellow', 'Diamond White', 'Sapphire Blue',
    ];

    it('should translate all 7 colors', () => {
      for (const color of colors) {
        const result = helpers.translateColor(color, en);
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it('should return the key itself for unknown colors', () => {
      expect(helpers.translateColor('Neon Pink', en)).toBe('Neon Pink');
    });
  });

  describe('translateActivity', () => {
    it('should translate known activity strings', () => {
      const result = helpers.translateActivity('Creative work', en);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return the key itself for unknown activities', () => {
      expect(helpers.translateActivity('Unknown Activity', en)).toBe('Unknown Activity');
    });
  });
});

// ─── PlanetaryHoursSection ─────────────────────────────────────────────

describe('PlanetaryHoursSection', () => {
  it('should export the component', async () => {
    const mod = await import('@/app/my-day/components/PlanetaryHoursSection');
    expect(mod.PlanetaryHoursSection).toBeDefined();
    expect(typeof mod.PlanetaryHoursSection).toBe('function');
  });
});
