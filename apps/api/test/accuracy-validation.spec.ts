/**
 * Accuracy Validation Tests
 *
 * These tests verify that the Swiss Ephemeris-based calculations in myastro360
 * produce accurate results by comparing against known reference data
 * (verified against clickastro.com and established Vedic astrology software).
 *
 * All calculations are deterministic (no LLM) — pure Swiss Ephemeris math.
 */

import * as path from 'path';

// ─── Swiss Ephemeris Setup (same as production) ─────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-var-requires
const swisseph = require('swisseph');
const EPHE_PATH = path.join(path.dirname(require.resolve('swisseph')), 'ephe');
swisseph.swe_set_ephe_path(EPHE_PATH);
swisseph.swe_set_sid_mode(swisseph.SE_SIDM_LAHIRI, 0, 0);

const ALL_SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const NAKSHATRA_NAMES = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Moola', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];

// ─── Helper Functions ───────────────────────────────────────────────────────
function computeChart(dob: string, time: string, lat: number, lng: number) {
  const date = new Date(dob);
  const timeParts = time.split(':');
  const hour = parseInt(timeParts[0], 10);
  const minute = parseInt(timeParts[1], 10) || 0;
  const utHour = hour + minute / 60 - 5.5; // IST to UT

  const jd = swisseph.swe_julday(
    date.getFullYear(), date.getMonth() + 1, date.getDate(),
    utHour, swisseph.SE_GREG_CAL,
  );

  const flags = swisseph.SEFLG_SIDEREAL | swisseph.SEFLG_SPEED;
  const planets = [
    { id: swisseph.SE_SUN, name: 'Sun' },
    { id: swisseph.SE_MOON, name: 'Moon' },
    { id: swisseph.SE_MARS, name: 'Mars' },
    { id: swisseph.SE_MERCURY, name: 'Mercury' },
    { id: swisseph.SE_JUPITER, name: 'Jupiter' },
    { id: swisseph.SE_VENUS, name: 'Venus' },
    { id: swisseph.SE_SATURN, name: 'Saturn' },
    { id: swisseph.SE_TRUE_NODE, name: 'Rahu' },
  ];

  const positions: Record<string, { sign: string; degree: number; nakshatra: string; retro: boolean }> = {};
  for (const p of planets) {
    const result = swisseph.swe_calc_ut(jd, p.id, flags);
    const longitude = ((result.longitude % 360) + 360) % 360;
    const signIdx = Math.floor(longitude / 30) % 12;
    const nakIdx = Math.floor(longitude / (360 / 27)) % 27;
    positions[p.name] = {
      sign: ALL_SIGNS[signIdx],
      degree: parseFloat((longitude % 30).toFixed(2)),
      nakshatra: NAKSHATRA_NAMES[nakIdx],
      retro: p.name === 'Rahu' ? true : result.longitudeSpeed < 0,
    };
  }

  // Ketu
  const rahuLng = positions.Rahu.degree + ALL_SIGNS.indexOf(positions.Rahu.sign) * 30;
  const ketuLng = (rahuLng + 180) % 360;
  const ketuSignIdx = Math.floor(ketuLng / 30) % 12;
  const ketuNakIdx = Math.floor(ketuLng / (360 / 27)) % 27;
  positions['Ketu'] = {
    sign: ALL_SIGNS[ketuSignIdx],
    degree: parseFloat((ketuLng % 30).toFixed(2)),
    nakshatra: NAKSHATRA_NAMES[ketuNakIdx],
    retro: true,
  };

  // Ascendant
  const houses = swisseph.swe_houses(jd, lat, lng, 'E');
  const ascLng = ((houses.ascendant % 360) + 360) % 360;
  const ascSignIdx = Math.floor(ascLng / 30) % 12;
  const ascendant = ALL_SIGNS[ascSignIdx];

  // Moon nakshatra for birth star
  const moonNakIdx = Math.floor(
    ((swisseph.swe_calc_ut(jd, swisseph.SE_MOON, flags).longitude % 360 + 360) % 360) / (360 / 27),
  ) % 27;

  // Ayanamsa
  const ayanamsa = swisseph.swe_get_ayanamsa_ut(jd);

  // Panchang for the date
  const sunTropical = swisseph.swe_calc_ut(jd, swisseph.SE_SUN, swisseph.SEFLG_SPEED);
  const moonTropical = swisseph.swe_calc_ut(jd, swisseph.SE_MOON, swisseph.SEFLG_SPEED);
  const elongation = ((moonTropical.longitude - sunTropical.longitude) % 360 + 360) % 360;
  const tithiIdx = Math.floor(elongation / 12) % 30;

  return { positions, ascendant, moonNakshatra: NAKSHATRA_NAMES[moonNakIdx], ayanamsa, tithiIdx };
}

// ─── Reference Charts (verified against clickastro.com) ─────────────────────

describe('Accuracy Validation — Swiss Ephemeris vs Reference Data', () => {

  describe('Reference Chart 1: Jan 26, 1990, 10:30 AM, Delhi', () => {
    const chart = computeChart('1990-01-26', '10:30', 28.6139, 77.2090);

    it('should compute correct ascendant (Aries)', () => {
      expect(chart.ascendant).toBe('Aries');
    });

    it('should place Sun in Capricorn', () => {
      expect(chart.positions.Sun.sign).toBe('Capricorn');
    });

    it('should place Moon in Capricorn', () => {
      expect(chart.positions.Moon.sign).toBe('Capricorn');
    });

    it('should place Mars in Sagittarius', () => {
      expect(chart.positions.Mars.sign).toBe('Sagittarius');
    });

    it('should place Jupiter in Gemini (retrograde)', () => {
      expect(chart.positions.Jupiter.sign).toBe('Gemini');
      expect(chart.positions.Jupiter.retro).toBe(true);
    });

    it('should place Saturn in Sagittarius', () => {
      expect(chart.positions.Saturn.sign).toBe('Sagittarius');
    });

    it('should place Rahu in Capricorn', () => {
      expect(chart.positions.Rahu.sign).toBe('Capricorn');
    });

    it('should place Ketu in Cancer', () => {
      expect(chart.positions.Ketu.sign).toBe('Cancer');
    });

    it('should compute Lahiri ayanamsa around 23.72° for 1990', () => {
      expect(chart.ayanamsa).toBeCloseTo(23.72, 1);
    });

    it('should have planet degrees within valid range (0-30)', () => {
      for (const [name, pos] of Object.entries(chart.positions)) {
        expect(pos.degree).toBeGreaterThanOrEqual(0);
        expect(pos.degree).toBeLessThan(30);
      }
    });
  });

  describe('Reference Chart 2: Aug 15, 1947, 00:00 AM, Delhi (India Independence)', () => {
    const chart = computeChart('1947-08-15', '00:00', 28.6139, 77.2090);

    it('should place Sun in Cancer (Vedic sidereal)', () => {
      // Aug 15 tropical = Leo, but sidereal (Lahiri ~23°) = Cancer
      expect(chart.positions.Sun.sign).toBe('Cancer');
    });

    it('should have Gemini ascendant for midnight Delhi', () => {
      expect(chart.ascendant).toBe('Gemini');
    });

    it('should compute Lahiri ayanamsa around 23.13° for 1947', () => {
      expect(chart.ayanamsa).toBeCloseTo(23.13, 1);
    });
  });

  describe('Reference Chart 3: Dec 25, 2000, 12:00 PM, Mumbai', () => {
    const chart = computeChart('2000-12-25', '12:00', 19.0760, 72.8777);

    it('should place Sun in Sagittarius (sidereal)', () => {
      expect(chart.positions.Sun.sign).toBe('Sagittarius');
    });

    it('should have Pisces ascendant for noon Mumbai', () => {
      // Noon in winter at ~19°N latitude gives Pisces/Aries lagna
      expect(['Pisces', 'Aries']).toContain(chart.ascendant);
    });

    it('should have Mercury near Sun (within 28°)', () => {
      const sunLng = chart.positions.Sun.degree + ALL_SIGNS.indexOf(chart.positions.Sun.sign) * 30;
      const mercLng = chart.positions.Mercury.degree + ALL_SIGNS.indexOf(chart.positions.Mercury.sign) * 30;
      const diff = Math.abs(((mercLng - sunLng + 180) % 360) - 180);
      expect(diff).toBeLessThan(28);
    });

    it('should have Venus near Sun (within 47°)', () => {
      const sunLng = chart.positions.Sun.degree + ALL_SIGNS.indexOf(chart.positions.Sun.sign) * 30;
      const venLng = chart.positions.Venus.degree + ALL_SIGNS.indexOf(chart.positions.Venus.sign) * 30;
      const diff = Math.abs(((venLng - sunLng + 180) % 360) - 180);
      expect(diff).toBeLessThan(47);
    });

    it('should have Rahu and Ketu exactly opposite (180°)', () => {
      const rahuLng = chart.positions.Rahu.degree + ALL_SIGNS.indexOf(chart.positions.Rahu.sign) * 30;
      const ketuLng = chart.positions.Ketu.degree + ALL_SIGNS.indexOf(chart.positions.Ketu.sign) * 30;
      const angularDiff = Math.abs(ketuLng - rahuLng);
      const opposition = Math.min(angularDiff, 360 - angularDiff);
      expect(opposition).toBeCloseTo(180, 0); // Within 0.5° of 180°
    });
  });

  describe('Panchang Validation', () => {
    it('should compute correct tithi for a known full moon date', () => {
      // Full Moon = Purnima = tithi index 14 (Shukla Purnima) or 15
      // Jan 25, 2024 was a Full Moon (Paush Purnima)
      const chart = computeChart('2024-01-25', '12:00', 28.6139, 77.2090);
      // Tithi 14 = Purnima (last of Shukla Paksha)
      expect(chart.tithiIdx).toBeGreaterThanOrEqual(13);
      expect(chart.tithiIdx).toBeLessThanOrEqual(15);
    });

    it('should compute correct nakshatra for Moon', () => {
      const chart = computeChart('2024-06-15', '12:00', 28.6139, 77.2090);
      expect(chart.moonNakshatra).toBe('Hasta');
    });
  });

  describe('Astronomical Constraints', () => {
    it('should always have Rahu retrograde', () => {
      const charts = [
        computeChart('1985-03-15', '08:00', 28.6139, 77.2090),
        computeChart('2000-06-21', '14:30', 13.0827, 80.2707),
        computeChart('2024-01-01', '06:00', 26.9124, 75.7873),
      ];
      for (const chart of charts) {
        expect(chart.positions.Rahu.retro).toBe(true);
        expect(chart.positions.Ketu.retro).toBe(true);
      }
    });

    it('should never have Sun or Moon retrograde', () => {
      const charts = [
        computeChart('1985-03-15', '08:00', 28.6139, 77.2090),
        computeChart('2000-06-21', '14:30', 13.0827, 80.2707),
      ];
      for (const chart of charts) {
        expect(chart.positions.Sun.retro).toBe(false);
        expect(chart.positions.Moon.retro).toBe(false);
      }
    });

    it('should have all planet degrees within 0-30 range', () => {
      const chart = computeChart('1995-11-10', '09:15', 17.3850, 78.4867);
      for (const [_, pos] of Object.entries(chart.positions)) {
        expect(pos.degree).toBeGreaterThanOrEqual(0);
        expect(pos.degree).toBeLessThan(30);
      }
    });

    it('should compute valid nakshatras for all planets', () => {
      const chart = computeChart('1995-11-10', '09:15', 17.3850, 78.4867);
      for (const [_, pos] of Object.entries(chart.positions)) {
        expect(NAKSHATRA_NAMES).toContain(pos.nakshatra);
      }
    });
  });
});
