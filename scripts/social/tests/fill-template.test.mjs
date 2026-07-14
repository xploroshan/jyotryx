/**
 * Unit tests for fillTemplate (scripts/social/lib/render.mjs).
 * Run: npm run social:test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { fillTemplate } from '../lib/render.mjs';

test('fillTemplate: {{key}} HTML-escapes & < > " and \'', () => {
  const out = fillTemplate('<p>{{v}}</p>', { v: `Tom & Jerry <b>"quoted"</b> 'single'` });
  assert.equal(
    out,
    '<p>Tom &amp; Jerry &lt;b&gt;&quot;quoted&quot;&lt;/b&gt; &#39;single&#39;</p>',
  );
});

test('fillTemplate: each special character escapes individually', () => {
  assert.equal(fillTemplate('{{v}}', { v: '&' }), '&amp;');
  assert.equal(fillTemplate('{{v}}', { v: '<' }), '&lt;');
  assert.equal(fillTemplate('{{v}}', { v: '>' }), '&gt;');
  assert.equal(fillTemplate('{{v}}', { v: '"' }), '&quot;');
  assert.equal(fillTemplate('{{v}}', { v: "'" }), '&#39;');
});

test('fillTemplate: {{{key}}} passes raw HTML through unescaped', () => {
  const html = '<p class="x">a &amp; b</p>';
  assert.equal(fillTemplate('<div>{{{body}}}</div>', { body: html }), `<div>${html}</div>`);
});

test('fillTemplate: raw and escaped tokens for the same key coexist', () => {
  const out = fillTemplate('{{{v}}}|{{v}}', { v: '<i>' });
  assert.equal(out, '<i>|&lt;i&gt;');
});

test('fillTemplate: missing keys become empty strings (both token forms)', () => {
  assert.equal(fillTemplate('a{{missing}}b{{{also_missing}}}c', {}), 'abc');
  assert.equal(fillTemplate('a{{missing}}b', { other: 'x' }), 'ab');
});

test('fillTemplate: null/undefined values become empty strings', () => {
  assert.equal(fillTemplate('a{{v}}b{{{w}}}c', { v: null, w: undefined }), 'abc');
});

test('fillTemplate: numeric values are coerced to strings', () => {
  assert.equal(fillTemplate('{{n}} of {{total}}', { n: 2, total: 5 }), '2 of 5');
  assert.equal(fillTemplate('{{zero}}', { zero: 0 }), '0', 'zero must not be blanked');
  assert.equal(fillTemplate('{{{f}}}', { f: 3.5 }), '3.5');
});

test('fillTemplate: whitespace inside tokens is tolerated', () => {
  assert.equal(fillTemplate('{{ v }} / {{{ w }}}', { v: '&', w: '<b>' }), '&amp; / <b>');
});
