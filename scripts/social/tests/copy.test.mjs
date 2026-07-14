/**
 * Unit tests for scripts/social/lib/copy.mjs — the pure helpers
 * parseJsonObject (model-response extraction) and validateCopy (the
 * downstream-render + never-fabricate contract). No network. Run:
 * npm run social:test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseJsonObject, validateCopy } from '../lib/copy.mjs';

// ---------------------------------------------------------------------------
// parseJsonObject
// ---------------------------------------------------------------------------

test('parseJsonObject: fenced ```json block', () => {
  const text = 'Sure!\n```json\n{ "headline": "Hi", "caption": "link in bio" }\n```\n';
  assert.deepEqual(parseJsonObject(text), { headline: 'Hi', caption: 'link in bio' });
});

test('parseJsonObject: bare fence without a json label', () => {
  const text = '```\n{ "a": 1 }\n```';
  assert.deepEqual(parseJsonObject(text), { a: 1 });
});

test('parseJsonObject: prose-wrapped object', () => {
  const text = 'Here is the copy you asked for:\n{ "headline": "H", "caption": "c" }\nHope that helps!';
  assert.deepEqual(parseJsonObject(text), { headline: 'H', caption: 'c' });
});

test('parseJsonObject: brace-embedded object (grabs outermost braces)', () => {
  const text = 'noise {"headline":"H","meta":{"nested":true},"caption":"c"} trailing noise';
  assert.deepEqual(parseJsonObject(text), {
    headline: 'H',
    meta: { nested: true },
    caption: 'c',
  });
});

test('parseJsonObject: no JSON object present throws its contract error', () => {
  assert.throws(
    () => parseJsonObject('there is absolutely no json here'),
    /no JSON object found/,
  );
});

test('parseJsonObject: malformed braces throw (SyntaxError from JSON.parse)', () => {
  assert.throws(() => parseJsonObject('{ "headline": "H", caption missing quotes }'));
});

// ---------------------------------------------------------------------------
// validateCopy — structural contract
// ---------------------------------------------------------------------------

test('validateCopy: passes for a well-formed single-image entry', () => {
  const entry = { template: 'lesson' };
  assert.doesNotThrow(() =>
    validateCopy({ headline: 'The 8th house', caption: 'link in bio' }, entry),
  );
});

test('validateCopy: missing caption is rejected', () => {
  const entry = { template: 'lesson' };
  assert.throws(
    () => validateCopy({ headline: 'H' }, entry),
    /missing\/empty "caption"/,
  );
});

test('validateCopy: empty headline is rejected', () => {
  const entry = { template: 'lesson' };
  assert.throws(
    () => validateCopy({ headline: '   ', caption: 'c' }, entry),
    /missing\/empty "headline"/,
  );
});

test('validateCopy: carousel template without slides is rejected', () => {
  const entry = { template: 'myth-bust-carousel' };
  assert.throws(
    () => validateCopy({ headline: 'H', caption: 'c' }, entry),
    /carousel template requires "slides"/,
  );
});

test('validateCopy: carousel with one slide is rejected (needs >= 2)', () => {
  const entry = { template: 'myth-bust-carousel' };
  assert.throws(
    () => validateCopy({ headline: 'H', caption: 'c', slides: [{ headline: 'a', body: 'b' }] }, entry),
    /carousel template requires "slides"/,
  );
});

test('validateCopy: carousel with two slides passes', () => {
  const entry = { template: 'myth-bust-carousel' };
  assert.doesNotThrow(() =>
    validateCopy(
      { headline: 'H', caption: 'c', slides: [{ headline: 'a', body: 'b' }, { headline: 'x', body: 'y' }] },
      entry,
    ),
  );
});

// ---------------------------------------------------------------------------
// validateCopy — never-fabricate rule for live posts
// ---------------------------------------------------------------------------

test('validateCopy: live daily-sky caption hard-coding panchang digits is rejected', () => {
  const entry = { template: 'daily-sky', city: { name: 'Mumbai' } };
  // Concrete tithi/nakshatra/rahu-kaal numbers where {tokens} belong.
  const copy = {
    headline: "Today's sky over Mumbai",
    caption: "Today over Mumbai — Shukla Ashtami, Moon in Rohini. Rahu Kaal 07:45–09:23. Link in bio.",
  };
  assert.throws(
    () => validateCopy(copy, entry),
    /live entry caption must retain panchang \{tokens\}/,
  );
});

test('validateCopy: city entry with no live {tokens} at all is rejected', () => {
  const entry = { template: 'daily-sky', city: { name: 'Delhi' } };
  const copy = {
    headline: "Today's sky over Delhi",
    caption: 'A calm reflective day over Delhi. Link in bio.',
  };
  assert.throws(
    () => validateCopy(copy, entry),
    /live entry caption must retain panchang \{tokens\}/,
  );
});

test('validateCopy: live caption retaining {tokens} passes', () => {
  const entry = { template: 'daily-sky', city: { name: 'Mumbai' } };
  const copy = {
    headline: "Today's sky over {city}",
    caption: "Today over {city} — {tithi}, Moon in {nakshatra}. Rahu Kaal: {rahu_kaal}. Link in bio.",
  };
  assert.doesNotThrow(() => validateCopy(copy, entry));
});

test('validateCopy: non-live entry may carry a literal time without rejection', () => {
  // A lesson/evergreen entry is not city-bound, so the live-token rule does not
  // apply — a literal clock time here is legitimate prose, not a fabricated panchang.
  const entry = { template: 'lesson' };
  const copy = { headline: 'Muhurat basics', caption: 'Auspicious windows shift daily. Link in bio 09:00.' };
  assert.doesNotThrow(() => validateCopy(copy, entry));
});
