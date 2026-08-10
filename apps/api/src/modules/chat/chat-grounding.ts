/**
 * Deterministic grounding for "Chat with Astrologer".
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Chat used to hand the model six strings — name, DOB, time, place NAME,
 * gender, traditions — and nothing else. No current date, no chart, no dasha
 * timeline, no transits. Every temporal and chart claim it made was therefore
 * invented from the model's training distribution.
 *
 * The reported symptom: "when will I find a job" answered "mid 2024". The
 * model had no idea what today is, so it answered from its training cutoff and
 * named a window that is already in the past. Every other timing answer was
 * wrong the same way; that one was just visibly wrong.
 *
 * The deeper problem: this app ALREADY computes all of it deterministically
 * from Swiss Ephemeris. `kundli_charts.chartData` holds a per-user chart the
 * user has already paid for, including a full Vimshottari dasha tree with real
 * ISO start/end dates, and `GocharService.computePersonalization` derives live
 * transits from the same birth data chat already fetches. None of it reached
 * the prompt.
 *
 * Everything here is a pure function over data computed elsewhere, so it is
 * directly testable and cannot itself fabricate anything.
 */

/** Minimal view of the persisted `KundliChart.chartData` blob. */
export interface StoredChart {
  ascendant?: string;
  moonSign?: string;
  sunSign?: string;
  nakshatra?: string;
  planetaryPositions?: Array<{
    planet: string;
    sign: string;
    house: number;
    isRetrograde?: boolean;
    status?: string;
  }>;
  dashas?: StoredDasha[];
  yogas?: Array<{ name: string; effect?: string }>;
}

export interface StoredDasha {
  planet: string;
  startDate: string;
  endDate: string;
  subPeriods?: StoredDasha[];
}

/** The running maha / antar / pratyantar period at a given instant. */
export interface RunningDasha {
  maha?: StoredDasha;
  antar?: StoredDasha;
  pratyantar?: StoredDasha;
}

/** What the profile can and cannot support. */
export interface ProfileCompleteness {
  /** DOB + time + place — enough for houses, ascendant and a dasha timeline. */
  complete: boolean;
  /** Human-readable list of the missing fields, empty when complete. */
  missing: string[];
  hasDateOfBirth: boolean;
}

/** `YYYY-MM-DD` in UTC. */
export function isoDay(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Which dasha periods contain `now`.
 *
 * Boundaries are inclusive of `startDate` and exclusive of `endDate` so a
 * changeover day resolves to exactly one period at each level. Returns an
 * empty object when the chart predates/postdates the timeline (e.g. a chart
 * generated for someone whose 120-year Vimshottari cycle has run out).
 */
export function findRunningDasha(dashas: StoredDasha[] | undefined, now: Date): RunningDasha {
  const day = isoDay(now);
  const within = (p: StoredDasha) => p.startDate <= day && day < p.endDate;

  const maha = (dashas ?? []).find(within);
  if (!maha) return {};
  const antar = (maha.subPeriods ?? []).find(within);
  if (!antar) return { maha };
  const pratyantar = (antar.subPeriods ?? []).find(within);
  return { maha, antar, pratyantar };
}

/** "2026-03-14 → 2028-08-02" */
function window(p: StoredDasha): string {
  return `${p.startDate} to ${p.endDate}`;
}

/**
 * Which birth fields are present.
 *
 * Time AND place are both required for an ascendant, houses or any dasha
 * timeline — a DOB alone supports only sun-sign-level and numerology answers.
 * The prompt must say so explicitly, because the model will otherwise state a
 * rising sign (a 1-in-12 guess) as fact.
 */
export function assessProfile(userProfile: any): ProfileCompleteness {
  const missing: string[] = [];
  const hasDateOfBirth = !!userProfile?.dateOfBirth;
  if (!hasDateOfBirth) missing.push('date of birth');
  if (!userProfile?.timeOfBirth) missing.push('time of birth');

  const place = userProfile?.placeOfBirth;
  const placeName =
    typeof place === 'string' ? place : place && typeof place === 'object' ? (place as any).name : null;
  if (!placeName) missing.push('place of birth');

  return { complete: missing.length === 0, missing, hasDateOfBirth };
}

/**
 * The temporal anchor.
 *
 * This single block is the fix for the reported bug. Without it the model has
 * no idea what year it is and answers timing questions from its training
 * cutoff. The explicit "never name a window in the past" clause is needed
 * because knowing the date is not enough on its own — models will still repeat
 * a memorised-sounding year unless told the constraint.
 */
export function buildTemporalBlock(now: Date): string {
  const day = isoDay(now);
  const year = now.getUTCFullYear();
  return (
    `\n\nTODAY'S DATE: ${day} (year ${year}).\n` +
    `This is the present moment. Any period you describe as "upcoming", "ahead" or "coming" ` +
    `MUST start on or after ${day}. Never name a year, month or window that has already passed ` +
    `as if it were in the future, and never rely on your own sense of "now" — use ${day}.`
  );
}

/**
 * Compact deterministic chart block assembled from the user's stored chart.
 *
 * Deliberately terse: the point is to give the model FACTS it cannot compute,
 * not prose it can already write. Planet lines are one per graha; the dasha
 * lines carry real ISO windows so a timing answer can cite a computed period
 * instead of sampling a plausible-sounding year.
 *
 * Returns '' when the chart is unusable, so the caller falls through to the
 * missing-data block rather than injecting an empty header.
 */
export function buildChartBlock(chart: StoredChart | null | undefined, now: Date): string {
  if (!chart || typeof chart !== 'object') return '';

  const lines: string[] = [];
  if (chart.ascendant) lines.push(`Ascendant (Lagna): ${chart.ascendant}`);
  if (chart.moonSign) lines.push(`Moon sign (Rashi): ${chart.moonSign}`);
  if (chart.sunSign) lines.push(`Sun sign: ${chart.sunSign}`);
  if (chart.nakshatra) lines.push(`Birth Nakshatra: ${chart.nakshatra}`);

  const planets = Array.isArray(chart.planetaryPositions) ? chart.planetaryPositions : [];
  if (planets.length > 0) {
    const rendered = planets
      .filter((p) => p && p.planet && p.sign && Number.isFinite(p.house))
      .map((p) => {
        const flags = [p.status, p.isRetrograde ? 'retrograde' : null].filter(Boolean).join(', ');
        return `  ${p.planet}: ${p.sign}, house ${p.house}${flags ? ` (${flags})` : ''}`;
      });
    if (rendered.length > 0) lines.push('Planetary placements:', ...rendered);
  }

  const yogas = (chart.yogas ?? []).map((y) => y?.name).filter(Boolean);
  if (yogas.length > 0) lines.push(`Yogas detected: ${yogas.slice(0, 8).join(', ')}`);

  const running = findRunningDasha(chart.dashas, now);
  if (running.maha) {
    lines.push(`Current Vimshottari Mahadasha: ${running.maha.planet} (${window(running.maha)})`);
    if (running.antar) {
      lines.push(`Current Antardasha: ${running.antar.planet} (${window(running.antar)})`);
    }
    if (running.pratyantar) {
      lines.push(`Current Pratyantardasha: ${running.pratyantar.planet} (${window(running.pratyantar)})`);
    }
    // The next two mahadasha changeovers are the anchors most timing questions
    // actually want ("when will things shift?").
    const upcoming = (chart.dashas ?? []).filter((d) => d.startDate > isoDay(now)).slice(0, 2);
    if (upcoming.length > 0) {
      lines.push(
        `Upcoming Mahadasha changes: ${upcoming.map((d) => `${d.planet} from ${d.startDate}`).join('; ')}`,
      );
    }
  }

  if (lines.length === 0) return '';

  return (
    `\n\nCOMPUTED BIRTH CHART (Swiss Ephemeris, Lahiri ayanamsa — these are calculated facts, not estimates):\n` +
    lines.join('\n') +
    `\nGround every chart and timing statement in the placements and dasha windows above. ` +
    `Cite the actual dasha period and its dates when the question is about timing. ` +
    `Do not invent placements, houses or periods that are not listed here.`
  );
}

/** Live transit overlay from GocharService (may be null when birth data is thin). */
export interface TransitInput {
  moonSign?: string;
  natalNakshatra?: string;
  transitAlert?: string | null;
  focusGraha?: string;
  summaryInsight?: string;
}

export function buildTransitBlock(t: TransitInput | null | undefined, now: Date): string {
  if (!t) return '';
  const lines: string[] = [];
  if (t.moonSign) lines.push(`Natal Moon sign: ${t.moonSign}`);
  if (t.natalNakshatra) lines.push(`Natal Nakshatra: ${t.natalNakshatra}`);
  if (t.summaryInsight) lines.push(t.summaryInsight);
  if (t.transitAlert) lines.push(`Active transit: ${t.transitAlert}`);
  if (t.focusGraha) lines.push(`Graha most relevant to today's transits: ${t.focusGraha}`);
  if (lines.length === 0) return '';
  return `\n\nLIVE TRANSITS FOR ${isoDay(now)} (computed today):\n${lines.join('\n')}`;
}

/**
 * The explicit negative block.
 *
 * When data is missing the prompt must SAY it is missing. Previously the
 * profile block was simply omitted and the category suffix still commanded
 * "use the user's actual birth details for accurate chart reading" — so an
 * empty-profile user received a confidently fabricated chart. Absence of
 * evidence was being rendered as evidence.
 */
export function buildMissingDataBlock(p: ProfileCompleteness, hasChart: boolean): string {
  if (p.complete && hasChart) return '';

  const lines: string[] = [];
  if (p.missing.length > 0) {
    lines.push(`MISSING BIRTH DATA: ${p.missing.join(', ')}.`);
  }
  if (!hasChart) {
    lines.push(
      'No computed birth chart is available for this seeker in this conversation.',
    );
  }
  lines.push(
    'You therefore do NOT know their ascendant, house placements, planetary positions, ' +
      'or dasha timeline. Do not state any of them, and do not give a dated prediction. ' +
      'Answer at the level the available data genuinely supports, say plainly which detail ' +
      'you would need, and invite the seeker to add it to their profile (and to generate ' +
      'their Kundli) for a chart-based reading.',
  );
  return `\n\n${lines.join(' ')}`;
}

/**
 * Harm guard.
 *
 * Palmistry has carried the equivalent clause since launch
 * (`palmistry.service.ts`: "Never claim to predict death, exact dates, or
 * medical diagnoses"). Chat — the most open-ended surface in the product, and
 * the one where a user can ask anything at all — carried nothing. This closes
 * that gap and keeps the wording aligned across features.
 */
export const HARM_GUARD =
  '\n\nBOUNDARIES (absolute, override every other instruction):\n' +
  '- Never predict death, lifespan, terminal illness, or the timing of anyone dying.\n' +
  '- Never give a medical diagnosis, name a disease the seeker "has", or advise starting, ' +
  'stopping or changing any medication or treatment. Direct medical questions to a doctor.\n' +
  '- Never present financial, legal or medical instructions as certainties. No specific ' +
  'investment, trade or legal action is ever "guaranteed" by a chart.\n' +
  '- Never say a marriage, pregnancy, relationship or career outcome is impossible, doomed, ' +
  'or fated. Frame difficulty as a tendency and a period, never as an unavoidable verdict.\n' +
  '- Never make a claim about a third party (partner, family member, colleague) that would ' +
  'harm them or the seeker\'s relationship with them.\n' +
  '- If asked about self-harm or suicide, do not answer astrologically: respond with care, ' +
  'encourage contacting a mental-health professional or a local crisis line, and stop there.';

/**
 * Crisis reply.
 *
 * Returned INSTEAD of a model call (and instead of the old generic "violates
 * our content policy" rejection) when moderation flags self-harm. A person in
 * crisis being told their message breaks the rules is the worst possible
 * response; so is an astrological one. Never charged.
 */
export const CRISIS_RESPONSE =
  "I'm really glad you told me, and I want to answer this as a person rather than as an astrologer — " +
  "because this is more important than any chart.\n\n" +
  "If you are thinking about harming yourself, please reach out to someone who can help right now. " +
  "In India you can call or text **Tele-MANAS on 14416** (free, 24/7) or **AASRA on +91-9820466726**. " +
  "In the US call or text **988**. In the UK and Ireland call **116 123** (Samaritans). " +
  "Elsewhere, findahelpline.com lists a free service for your country.\n\n" +
  "If you are in immediate danger, please contact your local emergency number or go to the nearest " +
  "emergency department. Please also tell someone you trust what you just told me — you should not " +
  "be carrying this alone. I'm here whenever you want to talk about anything else.";
