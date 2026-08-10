/**
 * Placement library (4/N) — the combination tables.
 *
 * docs/KB_LLM_DEPENDENCY_AUDIT.md named the critical gap: the KB had 22
 * tables but every one described a SINGLE entity (a planet, a sign, a
 * number). Chart interpretation lives in COMBINATIONS, so kundli, dasha,
 * divisional, KP and matching all fell through to the LLM for their meaning
 * layer. These six tables close it.
 *
 * The astrological content itself is asserted here (dignity is classical
 * fact, not taste) because a wrong exaltation would be silently wrong in
 * production — it would read perfectly fluently and simply be false.
 */
import { SEED_TABLES } from '../prisma/seed-kb';

type Row = { key: string; tradition: string | null; i18n: Record<string, any> };

function rowsFor(modelName: string): Row[] {
  const t = SEED_TABLES.find((x) => x.modelName === modelName);
  if (!t) throw new Error(`table ${modelName} not registered in SEED_TABLES`);
  return t.rows as Row[];
}

const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

describe('registration', () => {
  it.each([
    'kbHouseMeaning', 'kbPlanetInSign', 'kbYogaMeaning',
    'kbKootaMeaning', 'kbAspectMeaning', 'kbTransitAlert',
  ])('%s is registered in SEED_TABLES', (model) => {
    expect(rowsFor(model).length).toBeGreaterThan(0);
  });

  it('every placement row has a non-empty English payload', () => {
    for (const model of ['kbHouseMeaning', 'kbPlanetInSign', 'kbYogaMeaning',
      'kbKootaMeaning', 'kbAspectMeaning', 'kbTransitAlert']) {
      for (const row of rowsFor(model)) {
        expect(row.i18n.en).toBeDefined();
        expect(JSON.stringify(row.i18n.en).length).toBeGreaterThan(20);
      }
    }
  });

  it('keys are unique within every table', () => {
    for (const model of ['kbHouseMeaning', 'kbPlanetInSign', 'kbYogaMeaning',
      'kbKootaMeaning', 'kbAspectMeaning', 'kbTransitAlert']) {
      const keys = rowsFor(model).map((r) => r.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('kb_house_meaning', () => {
  const rows = rowsFor('kbHouseMeaning');

  it('covers all 12 bhavas exactly', () => {
    expect(rows.map((r) => r.key).sort((a, b) => Number(a) - Number(b)))
      .toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
  });

  it('names the defining theme of the pivotal houses', () => {
    const by = Object.fromEntries(rows.map((r) => [r.key, r.i18n.en.text as string]));
    expect(by['7']).toMatch(/marriage|partner/i);
    expect(by['10']).toMatch(/career|status/i);
    expect(by['4']).toMatch(/home|mother/i);
  });
});

describe('kb_planet_in_sign', () => {
  const rows = rowsFor('kbPlanetInSign');
  const by = Object.fromEntries(rows.map((r) => [r.key, r.i18n.en]));

  it('is the full 9 x 12 matrix (108 rows, no gaps)', () => {
    expect(rows).toHaveLength(108);
    for (const p of PLANETS) {
      for (const s of SIGNS) expect(by[`${p}:${s}`]).toBeDefined();
    }
  });

  it('records the CLASSICAL exaltations', () => {
    // Getting these wrong would read fluently and be silently false.
    const exalt: Record<string, string> = {
      Sun: 'Aries', Moon: 'Taurus', Mars: 'Capricorn', Mercury: 'Virgo',
      Jupiter: 'Cancer', Venus: 'Pisces', Saturn: 'Libra',
    };
    for (const [planet, sign] of Object.entries(exalt)) {
      expect(by[`${planet}:${sign}`].dignity).toBe('exalted');
    }
  });

  it('records the CLASSICAL debilitations (exactly opposite the exaltation)', () => {
    const debil: Record<string, string> = {
      Sun: 'Libra', Moon: 'Scorpio', Mars: 'Cancer', Mercury: 'Pisces',
      Jupiter: 'Capricorn', Venus: 'Virgo', Saturn: 'Aries',
    };
    for (const [planet, sign] of Object.entries(debil)) {
      expect(by[`${planet}:${sign}`].dignity).toBe('debilitated');
    }
    // Exaltation and debilitation must be 180 degrees apart — 6 signs.
    for (const planet of Object.keys(debil)) {
      const e = SIGNS.indexOf(Object.entries({
        Sun: 'Aries', Moon: 'Taurus', Mars: 'Capricorn', Mercury: 'Virgo',
        Jupiter: 'Cancer', Venus: 'Pisces', Saturn: 'Libra',
      }).find(([p]) => p === planet)![1]);
      const d = SIGNS.indexOf(debil[planet]);
      expect(Math.abs(e - d)).toBe(6);
    }
  });

  it('records own-sign rulership', () => {
    const own: Record<string, string[]> = {
      Sun: ['Leo'], Moon: ['Cancer'], Mars: ['Aries', 'Scorpio'],
      Mercury: ['Gemini', 'Virgo'], Jupiter: ['Sagittarius', 'Pisces'],
      Venus: ['Taurus', 'Libra'], Saturn: ['Capricorn', 'Aquarius'],
    };
    for (const [planet, signs] of Object.entries(own)) {
      for (const sign of signs) {
        // Mercury/Virgo and Venus/Pisces are exaltation AND rulership; the
        // stronger dignity wins, which is why these are asserted as a set.
        expect(['own', 'exalted']).toContain(by[`${planet}:${sign}`].dignity);
      }
    }
  });

  it('uses only the four known dignity values', () => {
    for (const row of rows) {
      expect(['exalted', 'debilitated', 'own', 'neutral']).toContain(row.i18n.en.dignity);
    }
  });

  it('every combination has distinct prose (no copy-paste filler)', () => {
    const texts = rows.map((r) => r.i18n.en.text as string);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('mentions cancellation for debilitated placements', () => {
    // Neecha bhanga is the single most consequential nuance for a debilitated
    // graha; omitting it makes the reading needlessly alarming.
    const debilitated = rows.filter((r) => r.i18n.en.dignity === 'debilitated');
    expect(debilitated.length).toBeGreaterThan(0);
    for (const row of debilitated) {
      expect(row.i18n.en.text).toMatch(/neecha bhanga|cancellation/i);
    }
  });
});

describe('kb_koota_meaning', () => {
  const rows = rowsFor('kbKootaMeaning');
  const by = Object.fromEntries(rows.map((r) => [r.key, r.i18n.en]));

  it('covers all 8 Ashtakoota factors', () => {
    expect(rows).toHaveLength(8);
    for (const k of ['varna', 'vashya', 'tara', 'yoni', 'graha_maitri', 'gana', 'bhakoot', 'nadi']) {
      expect(by[k]).toBeDefined();
    }
  });

  it('point values sum to the canonical 36', () => {
    const total = rows.reduce((n, r) => n + (r.i18n.en.maxPoints as number), 0);
    expect(total).toBe(36);
  });

  it('assigns the classical weight to each factor', () => {
    expect(by.nadi.maxPoints).toBe(8);
    expect(by.bhakoot.maxPoints).toBe(7);
    expect(by.gana.maxPoints).toBe(6);
    expect(by.varna.maxPoints).toBe(1);
  });

  it('explains the cancellations for the two doshas users actually ask about', () => {
    expect(by.nadi.lowScoreNote).toMatch(/cancel/i);
    expect(by.bhakoot.lowScoreNote).toMatch(/cancel/i);
  });

  it('every koota carries a low-score note', () => {
    for (const row of rows) {
      expect(String(row.i18n.en.lowScoreNote).length).toBeGreaterThan(30);
    }
  });
});

describe('kb_yoga_meaning', () => {
  const rows = rowsFor('kbYogaMeaning');
  const by = Object.fromEntries(rows.map((r) => [r.key, r.i18n.en]));

  it('includes all five Pancha Mahapurusha yogas', () => {
    for (const y of ['ruchaka', 'bhadra', 'hamsa', 'malavya', 'sasa']) {
      expect(by[`panch_mahapurusha_${y}`]).toBeDefined();
    }
  });

  it('includes the yogas a reading most often needs to name', () => {
    for (const y of ['gajakesari', 'raja', 'dhana', 'neecha_bhanga', 'kala_sarpa']) {
      expect(by[y]).toBeDefined();
    }
  });

  it('every yoga has both a display name and an explanation', () => {
    for (const row of rows) {
      expect(String(row.i18n.en.name).length).toBeGreaterThan(3);
      expect(String(row.i18n.en.text).length).toBeGreaterThan(40);
    }
  });
});

describe('kb_aspect_meaning', () => {
  const rows = rowsFor('kbAspectMeaning');
  const keys = rows.map((r) => r.key);

  it('covers the special drishti of Mars, Jupiter and Saturn', () => {
    // Every graha aspects the 7th; these three have extra aspects.
    expect(keys).toEqual(expect.arrayContaining(['Mars:4', 'Mars:8']));
    expect(keys).toEqual(expect.arrayContaining(['Jupiter:5', 'Jupiter:9']));
    expect(keys).toEqual(expect.arrayContaining(['Saturn:3', 'Saturn:10']));
  });

  it('covers the 7th-house aspect for every graha that has a row', () => {
    const sevenths = keys.filter((k) => k.endsWith(':7'));
    expect(sevenths.length).toBeGreaterThanOrEqual(7);
  });
});

describe('kb_transit_alert', () => {
  const rows = rowsFor('kbTransitAlert');
  const by = Object.fromEntries(rows.map((r) => [r.key, r.i18n.en]));

  it('covers the full Sade Sati cycle (12th, 1st, 2nd from the Moon)', () => {
    for (const h of [12, 1, 2]) {
      expect(by[`Saturn:${h}`]).toBeDefined();
      expect(by[`Saturn:${h}`].text).toMatch(/sade sati/i);
    }
  });

  it('covers Ashtama Shani and Ardha Kantaka', () => {
    expect(by['Saturn:8'].text).toMatch(/ashtama/i);
    expect(by['Saturn:4'].text).toMatch(/ardha kantaka|panoti/i);
  });

  it('marks the difficult Saturn transits as caution and the good ones as favourable', () => {
    for (const h of [12, 1, 2, 4, 8]) expect(by[`Saturn:${h}`].tone).toBe('caution');
    for (const h of [3, 6, 11]) expect(by[`Saturn:${h}`].tone).toBe('favourable');
  });

  it('uses only known tones', () => {
    for (const row of rows) {
      expect(['favourable', 'caution', 'mixed']).toContain(row.i18n.en.tone);
    }
  });
});
