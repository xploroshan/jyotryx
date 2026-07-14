/**
 * Copy resolution for the myastro360 Instagram engine.
 *
 * The queue (marketing/social/queue/queue.json) normally carries hand-written,
 * reviewed copy — that always wins. Only when an entry arrives without usable
 * copy AND an ANTHROPIC_API_KEY is available do we generate copy via the
 * Anthropic Messages API, under the brand-voice constraints from
 * marketing/social/social-playbook.md.
 *
 * Node 20+ ESM, zero dependencies (global fetch).
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `You are the content writer for @myastro360, a Vedic astrology platform whose positioning is "computed, not copied — astrology that shows its work".

Brand voice (hard rules, never break them):
- NO fear-selling: never threaten doom, curses, or urgency; never push remedies through anxiety.
- NO fabricated data: never invent panchang values, statistics, dates, or quotes. If a live value belongs in the copy, leave a {token} placeholder ({tithi}, {nakshatra}, {rahu_kaal}, {sunrise}, {sunset}, {city}, {date_label}) instead of a number.
- Every claim must trace to a concrete chart factor (a placement, a house, an angle, a division) — name the mechanism.
- Frame everything as interpretation, not fact: charts describe tendencies and traditions, never verdicts or physics.
- Warm, precise, myth-busting tone. The call to action is always "link in bio".

Output format (strict): respond with EXACTLY ONE JSON object and nothing else — no prose, no markdown fences. Shape:
{
  "headline": string,            // hook, <= 90 chars
  "eyebrow": string,             // short uppercase kicker, e.g. "MINI-LESSON · HOUSES"
  "body": string,                // 2-3 short paragraphs separated by \\n\\n
  "factor_line": string,         // the single chart factor the post traces to
  "caption": string,             // full IG caption incl. a final hashtag block, CTA "link in bio"
  "hashtags": string[],          // 10-14 tags, no leading '#'
  "slides": [                    // ONLY for carousel templates: 4-6 slides
    { "headline": string, "body": string }
  ]
}
Omit "slides" for single-image templates.`;

/**
 * Build the user-turn topic brief from a queue entry.
 * @param {object} entry
 */
function topicBrief(entry) {
  const wantsSlides = /carousel/i.test(entry.template || '');
  const lines = [
    `Write the Instagram copy for one post.`,
    `Pillar: ${entry.pillar || 'general'}`,
    `Template: ${entry.template || 'single image'} (${wantsSlides ? 'carousel — include "slides"' : 'single image — omit "slides"'})`,
    `Topic: ${entry.topic || entry.id}`,
  ];
  if (entry.learnSlug) lines.push(`Related learn article slug: ${entry.learnSlug}`);
  if (entry.city?.name) {
    lines.push(
      `City: ${entry.city.name}. This is a live-data post — use {token} placeholders ` +
      `for panchang values, never concrete numbers.`,
    );
  }
  return lines.join('\n');
}

/**
 * Extract the single JSON object from a model response, tolerating markdown
 * code fences and stray prose around it.
 * @param {string} text
 * @returns {object}
 */
export function parseJsonObject(text) {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidate = fenced[1].trim();
  if (!candidate.startsWith('{')) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) {
      throw new Error('resolveCopy: no JSON object found in model response');
    }
    candidate = candidate.slice(start, end + 1);
  }
  return JSON.parse(candidate);
}

/** Validate the generated copy has everything downstream rendering needs. */
export function validateCopy(copy, entry) {
  const problems = [];
  for (const field of ['headline', 'caption']) {
    if (typeof copy?.[field] !== 'string' || copy[field].trim() === '') {
      problems.push(`missing/empty "${field}"`);
    }
  }
  if (/carousel/i.test(entry.template || '')) {
    if (!Array.isArray(copy?.slides) || copy.slides.length < 2) {
      problems.push('carousel template requires "slides" (>= 2)');
    }
  }
  // Never-fabricate rule: a live post (daily-sky, or any city-bound entry) must
  // keep its panchang values as {tokens} for downstream substitution — it must
  // NEVER hard-code concrete numbers (a fabricated tithi/nakshatra/rahu-kaal).
  // Require at least one live {token} and reject any literal clock time (HH:MM),
  // which would only appear if a rahu-kaal/sunrise/sunset value had been baked in.
  const isLive = entry?.template === 'daily-sky' || Boolean(entry?.city?.name);
  if (isLive) {
    const caption = typeof copy?.caption === 'string' ? copy.caption : '';
    const liveTokens = ['{tithi}', '{nakshatra}', '{rahu_kaal}', '{sunrise}', '{sunset}'];
    const keepsToken = liveTokens.some((tok) => caption.includes(tok));
    const hasLiteralTime = /\b\d{1,2}:\d{2}\b/.test(caption);
    if (!keepsToken || hasLiteralTime) {
      problems.push('live entry caption must retain panchang {tokens} (never hard-code values)');
    }
  }
  if (problems.length > 0) {
    throw new Error(`resolveCopy: generated copy invalid: ${problems.join('; ')}`);
  }
}

/**
 * Resolve the copy for a queue entry.
 *
 * - Entry already carries reviewed copy (headline + caption) -> returned as-is.
 * - Otherwise, if generation is enabled (default: ANTHROPIC_API_KEY present),
 *   generate copy with the Anthropic Messages API. Throws on API/parse/
 *   validation failure so callers can log the reason.
 * - Otherwise -> null (caller skips the day; nothing is ever fabricated).
 *
 * @param {object} entry - queue entry ({ id, pillar, template, topic, ... }).
 * @param {object} [opts]
 * @param {boolean} [opts.generate]
 * @returns {Promise<object|null>} copy object or null.
 */
export async function resolveCopy(
  entry,
  { generate = process.env.ANTHROPIC_API_KEY ? true : false } = {},
) {
  if (entry?.copy?.headline && entry?.copy?.caption) return entry.copy;
  if (!generate) return null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('resolveCopy: generation requested but ANTHROPIC_API_KEY is unset');

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-5',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: topicBrief(entry) }],
    }),
    // Bound the call so a hung generation can't stall the daily run forever.
    signal: AbortSignal.timeout(Number(process.env.ANTHROPIC_TIMEOUT_MS) || 30000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`resolveCopy: Anthropic API HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = (data?.content ?? [])
    .filter((block) => block?.type === 'text')
    .map((block) => block.text)
    .join('');
  if (!text) throw new Error('resolveCopy: Anthropic API returned no text content');

  const copy = parseJsonObject(text);
  validateCopy(copy, entry);
  return copy;
}
