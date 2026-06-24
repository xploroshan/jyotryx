import {
  buildTransitAlert,
  computeChandraBala,
  computeJupiterTransit,
  computeSadeSati,
  computeTaraBala,
  houseFromMoon,
  nakshatraIndexFromLongitude,
  personalizedDayQuality,
  personalizedLuckyColor,
  personalizedLuckyNumber,
  signIndexFromLongitude,
} from '../src/modules/daily-briefing/gochar.util';

describe('gochar.util', () => {
  describe('position helpers', () => {
    it('maps longitudes to sign indices', () => {
      expect(signIndexFromLongitude(0)).toBe(0); // Aries
      expect(signIndexFromLongitude(95)).toBe(3); // Cancer (90–120)
      expect(signIndexFromLongitude(359.9)).toBe(11); // Pisces
      expect(signIndexFromLongitude(-30)).toBe(11); // wraps
    });

    it('maps longitudes to nakshatra indices (27)', () => {
      expect(nakshatraIndexFromLongitude(0)).toBe(0);
      expect(nakshatraIndexFromLongitude(13.33)).toBe(0);
      expect(nakshatraIndexFromLongitude(13.34)).toBe(1);
      expect(nakshatraIndexFromLongitude(359.99)).toBe(26);
    });

    it('counts houses from the natal Moon (1-based, inclusive)', () => {
      expect(houseFromMoon(3, 3)).toBe(1); // same sign
      expect(houseFromMoon(4, 3)).toBe(2);
      expect(houseFromMoon(2, 3)).toBe(12); // wraps behind
    });
  });

  describe('computeSadeSati', () => {
    const moon = 3; // natal Moon in Cancer
    it('flags the rising phase when Saturn is 12th from Moon', () => {
      expect(computeSadeSati(2, moon)).toEqual({ active: true, type: 'sadeSati', phase: 'rising' });
    });
    it('flags the peak phase when Saturn is on the Moon', () => {
      expect(computeSadeSati(3, moon)).toEqual({ active: true, type: 'sadeSati', phase: 'peak' });
    });
    it('flags the setting phase when Saturn is 2nd from Moon', () => {
      expect(computeSadeSati(4, moon)).toEqual({ active: true, type: 'sadeSati', phase: 'setting' });
    });
    it('flags Dhaiya in the 4th and 8th', () => {
      expect(computeSadeSati(6, moon).type).toBe('dhaiya'); // 4th
      expect(computeSadeSati(10, moon).type).toBe('dhaiya'); // 8th
    });
    it('is inactive elsewhere', () => {
      expect(computeSadeSati(8, moon)).toEqual({ active: false, type: 'none', phase: 'none' });
    });
  });

  describe('computeTaraBala', () => {
    it('returns Janma (unfavorable) on the same nakshatra', () => {
      const r = computeTaraBala(5, 5);
      expect(r.index).toBe(1);
      expect(r.name).toBe('Janma');
      expect(r.favorable).toBe(false);
    });
    it('returns Sampat (favorable) one nakshatra ahead', () => {
      const r = computeTaraBala(6, 5);
      expect(r.index).toBe(2);
      expect(r.favorable).toBe(true);
    });
    it('cycles every 9 nakshatras', () => {
      expect(computeTaraBala((5 + 9) % 27, 5).index).toBe(1);
    });
  });

  describe('computeChandraBala / computeJupiterTransit', () => {
    it('rates Moon transit in 1,3,6,7,10,11 as favorable', () => {
      const moon = 0;
      expect(computeChandraBala(0, moon).favorable).toBe(true); // 1st
      expect(computeChandraBala(1, moon).favorable).toBe(false); // 2nd
      expect(computeChandraBala(5, moon).favorable).toBe(true); // 6th
    });
    it('rates Jupiter transit in 2,5,7,9,11 as favorable', () => {
      const moon = 0;
      expect(computeJupiterTransit(1, moon).favorable).toBe(true); // 2nd
      expect(computeJupiterTransit(0, moon).favorable).toBe(false); // 1st
      expect(computeJupiterTransit(4, moon).favorable).toBe(true); // 5th
    });
  });

  describe('personalizedDayQuality', () => {
    const good = { favorable: true };
    const bad = { favorable: false };
    const noSat = { active: false, type: 'none' as const, phase: 'none' as const };

    it('rates everything-favorable as excellent', () => {
      const q = personalizedDayQuality('moderate', {
        tara: { index: 2, name: 'Sampat', favorable: true },
        chandra: good,
        jupiter: good,
        sadeSati: noSat,
      });
      expect(q).toBe('excellent');
    });

    it('drags quality down during Sade Sati peak', () => {
      const q = personalizedDayQuality('moderate', {
        tara: { index: 3, name: 'Vipat', favorable: false },
        chandra: bad,
        jupiter: bad,
        sadeSati: { active: true, type: 'sadeSati', phase: 'peak' },
      });
      expect(q).toBe('challenging');
    });

    it('does not penalise the neutral Janma tara', () => {
      const withJanma = personalizedDayQuality('moderate', {
        tara: { index: 1, name: 'Janma', favorable: false },
        chandra: good,
        jupiter: bad,
        sadeSati: noSat,
      });
      const withVipat = personalizedDayQuality('moderate', {
        tara: { index: 3, name: 'Vipat', favorable: false },
        chandra: good,
        jupiter: bad,
        sadeSati: noSat,
      });
      // Janma (neutral) should score at least as high as Vipat (penalised).
      const order = { challenging: 0, moderate: 1, good: 2, excellent: 3 };
      expect(order[withJanma]).toBeGreaterThanOrEqual(order[withVipat]);
    });
  });

  describe('lucky attributes are personal', () => {
    it('reduces birth day-of-month to a 1-9 psychic number', () => {
      expect(personalizedLuckyNumber(1)).toBe(1);
      expect(personalizedLuckyNumber(28)).toBe(1); // 2+8 -> 10 -> 1 (mod 9)
      expect(personalizedLuckyNumber(9)).toBe(9);
      expect(personalizedLuckyNumber(18)).toBe(9); // multiple of 9 stays 9
    });
    it('derives lucky colour from the natal Moon-sign lord', () => {
      // Cancer (idx 3) is ruled by the Moon -> Pearl White.
      expect(personalizedLuckyColor(3)).toBe('Pearl White');
      // Aries (idx 0) ruled by Mars -> Coral Red.
      expect(personalizedLuckyColor(0)).toBe('Coral Red');
    });
  });

  describe('buildTransitAlert', () => {
    const tara = { index: 2, name: 'Sampat', favorable: true };
    it('leads with Sade Sati when active', () => {
      const text = buildTransitAlert({
        moonSign: 'Cancer',
        sadeSati: { active: true, type: 'sadeSati', phase: 'peak' },
        jupiter: { house: 5, favorable: true },
        tara,
      });
      expect(text).toContain('Sade Sati');
      expect(text).toContain('Cancer');
    });
    it('mentions Jupiter when no Saturn affliction', () => {
      const text = buildTransitAlert({
        moonSign: 'Leo',
        sadeSati: { active: false, type: 'none', phase: 'none' },
        jupiter: { house: 5, favorable: true },
        tara,
      });
      expect(text).toContain('Jupiter');
    });
  });
});
