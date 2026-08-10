/**
 * Keyword tier tokenisation — the fallback beneath pgvector.
 *
 * Regression origin: `extractKeywords` and the query tokeniser both used
 * `/[^\w\s]/g`. `\w` is ASCII-only, so a query written in any of the 11
 * supported Indic scripts was stripped to an empty string, `queryWords`
 * came out empty, and `keywordSearch` returned `[]` before touching the
 * database. Keyword search was dead for 11 of 12 locales, and because
 * vector search ran first and usually returned *something*, nothing ever
 * surfaced the failure.
 */
import { extractKeywords, tokenizeQuery } from '../src/knowledge/keywords.util';

// One real query per supported Indic locale, plus English as the control.
const QUERIES: Array<[locale: string, query: string]> = [
  ['en', 'what is mangal dosha'],
  ['hi', 'मंगल दोष क्या है'],
  ['ta', 'செவ்வாய் தோஷம் என்றால் என்ன'],
  ['te', 'మంగళ దోషం అంటే ఏమిటి'],
  ['bn', 'মঙ্গল দোষ কি'],
  ['mr', 'मंगळ दोष म्हणजे काय'],
  ['gu', 'મંગળ દોષ શું છે'],
  ['kn', 'ಮಂಗಳ ದೋಷ ಎಂದರೇನು'],
  ['ml', 'ചൊവ്വ ദോഷം എന്താണ്'],
  ['pa', 'ਮੰਗਲ ਦੋਸ਼ ਕੀ ਹੈ'],
  ['or', 'ମଙ୍ଗଳ ଦୋଷ କଣ'],
  ['as', 'মঙ্গল দোষ কি'],
];

describe('tokenizeQuery', () => {
  it.each(QUERIES)('produces tokens for %s (was empty for every non-Latin script)', (_locale, query) => {
    const tokens = tokenizeQuery(query);
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.every((t) => t.trim().length > 0)).toBe(true);
  });

  it('strips punctuation without destroying the script', () => {
    expect(tokenizeQuery('मंगल, दोष! क्या?')).toEqual(expect.arrayContaining(['मंगल', 'दोष']));
    expect(tokenizeQuery('Saturn: in the 7th house!')).toEqual(
      expect.arrayContaining(['saturn', 'the', '7th', 'house']),
    );
  });

  it('keeps digits (house numbers, dasha years are real query terms)', () => {
    expect(tokenizeQuery('7th house 2027')).toEqual(expect.arrayContaining(['7th', 'house', '2027']));
  });

  it('lowercases and dedupes', () => {
    expect(tokenizeQuery('Mars mars MARS')).toEqual(['mars']);
  });

  it('returns [] for input with no letters or digits', () => {
    expect(tokenizeQuery('!!! ... ???')).toEqual([]);
    expect(tokenizeQuery('   ')).toEqual([]);
  });

  it('does NOT drop stop-words (a short query would tokenise to nothing)', () => {
    // "what is the 7th house" is mostly stop-words; removing them here would
    // empty the token list and silently disable the keyword tier.
    expect(tokenizeQuery('what is the 7th house').length).toBeGreaterThan(2);
  });
});

describe('extractKeywords', () => {
  it('indexes Indic text (stored keywords were empty for 11 locales)', () => {
    const keywords = extractKeywords('मंगल दोष विवाह में देरी का कारण बन सकता है');
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords).toEqual(expect.arrayContaining(['मंगल', 'दोष']));
  });

  it('drops English stop-words but keeps meaningful terms', () => {
    const keywords = extractKeywords('The Sun is the ruler of the sign Leo');
    expect(keywords).toEqual(expect.arrayContaining(['sun', 'ruler', 'sign', 'leo']));
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('is');
  });

  it('dedupes and caps at 30', () => {
    const keywords = extractKeywords(
      Array.from({ length: 80 }, (_, i) => `word${i}`).join(' '),
    );
    expect(keywords.length).toBe(30);
    expect(new Set(keywords).size).toBe(30);
  });

  it('is consistent with tokenizeQuery — stored keywords are matchable', () => {
    // The contract that makes keyword search work at all: a term indexed from
    // a document must be produced by the tokeniser when a user types it.
    for (const text of ['मंगल दोष', 'Saturn retrograde', 'ಮಂಗಳ ದೋಷ']) {
      const stored = extractKeywords(text);
      const queried = tokenizeQuery(text);
      const overlap = stored.filter((k) => queried.includes(k));
      expect(overlap.length).toBeGreaterThan(0);
    }
  });
});
