import { Injectable, Logger } from '@nestjs/common';
import { LlmCacheService } from '../../llm/llm-cache.service';
import { KbService } from '../../knowledge/kb.service';
import { getLocaleInstruction } from '../../common/locale';
import { InterpretationDomain } from './dto/interpret.dto';

export interface InterpretationResult {
  /** One or two warm sentences: the headline takeaway in plain words. */
  summary: string;
  /** 3-5 short, concrete bullet points ("what this means for you"). */
  points: string[];
  /** 1-2 practical, encouraging next steps. */
  guidance: string;
  /** Fixed advisory note. */
  disclaimer: string;
}

const DISCLAIMER =
  'This is supportive guidance to help you reflect — not a substitute for professional medical, legal, or financial advice.';

// Human-readable label per domain, used in the user prompt.
const DOMAIN_LABEL: Record<InterpretationDomain, string> = {
  kundli: 'Vedic birth chart (Kundli)',
  dosha: 'dosha (astrological affliction) analysis',
  matching: 'Kundli matching / compatibility',
  numerology: 'numerology',
  palmistry: 'palm reading',
  panchang: "today's Panchang (Hindu almanac)",
  horoscope: 'horoscope',
  dasha: 'Vimshottari dasha (planetary periods)',
  divisional: 'divisional chart',
  kp: 'KP (Krishnamurti Paddhati) chart',
  'western-natal': 'Western natal chart',
  transits: 'current planetary transits',
  bazi: 'BaZi (Four Pillars) chart',
  vastu: 'Vastu assessment',
  muhurat: 'muhurat (auspicious timing) result',
  decision: 'activity timing decision',
  'cosmic-calendar': 'cosmic calendar day-quality result',
  'chinese-zodiac': 'Chinese zodiac result',
  medical: 'medical astrology (body-zodiac) result',
  synastry: 'relationship synastry (compatibility) result',
  general: 'astrology result',
};

@Injectable()
export class InterpretationService {
  private readonly logger = new Logger(InterpretationService.name);
  // Cap the serialized payload so prompts stay small/cheap regardless of how
  // much the caller sends.
  private static readonly MAX_PAYLOAD_CHARS = 6000;

  constructor(
    private readonly llmCache: LlmCacheService,
    private readonly kb: KbService,
  ) {}

  async interpret(params: {
    domain: InterpretationDomain;
    payload: Record<string, unknown>;
    locale?: string;
    userId?: string | null;
  }): Promise<InterpretationResult> {
    const { domain, payload, locale, userId } = params;

    // KB-first: domains the placement library covers are assembled straight from
    // the Knowledge Base — deterministic, instant, zero LLM cost. The KB path
    // only fires when the requested locale is an EXACT KB match (see tryKb), so
    // a locale without a translation yet keeps the localized LLM path below —
    // no regression, and each locale flips to KB automatically once backfilled.
    const fromKb = await this.tryKb(domain, payload, locale);
    if (fromKb) return fromKb;

    const system = this.buildSystemPrompt(domain, locale);
    const user =
      `Here is the ${DOMAIN_LABEL[domain] ?? 'astrology'} result as JSON. ` +
      `Explain, in simple everyday language, what it means for this person:\n\n` +
      this.compactPayload(payload);

    try {
      // With jsonMode the LLM layer returns the ALREADY-PARSED object
      // ({summary, points, guidance}) — or null if the model output wasn't
      // valid JSON / all providers failed. (Not a {content} wrapper.)
      const res = await this.llmCache.cachedChatCompletion({
        feature: `interpretation:${domain}`,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.6,
        maxTokens: 700,
        jsonMode: true,
        userId: userId ?? null,
      });
      const parsed = this.coerce(res);
      if (parsed) return parsed;
      this.logger.warn(`interpret(${domain}): empty/unusable LLM output, using fallback`);
    } catch (e) {
      this.logger.warn(`interpret(${domain}) failed: ${(e as Error).message}`);
    }
    return this.fallback(domain);
  }

  /**
   * KB-assembled interpretation — the "placement library" path. Returns a fully
   * formed result for domains the KB covers, or null to fall through to the LLM.
   *
   * Uses renderStatus().matched: the KB result is only used when the requested
   * locale is an exact KB hit (English is always authored; other locales arrive
   * via kb:backfill). For a locale not yet translated, matched is false and we
   * return null so the localized LLM path runs — no English leaking into a
   * non-English UI. Extend with one `case` per placement table.
   */
  private async tryKb(
    domain: InterpretationDomain,
    payload: Record<string, unknown>,
    locale?: string,
  ): Promise<InterpretationResult | null> {
    try {
      if (domain === 'dasha') {
        // A mahadasha maps to exactly one ruling planet → one KbDashaImpact row.
        const lord = this.str(payload.currentMahadasha);
        if (!lord) return null;
        return this.assemble(this.kb.renderStatus(await this.kb.getDashaImpact(lord), locale));
      }
      if (domain === 'matching') {
        // Compatibility is tier-driven: map the ashtakoota percentage to a band.
        const pct = this.matchPercentage(payload);
        if (pct == null) return null;
        const tier = pct >= 70 ? 'excellent' : pct >= 55 ? 'good' : pct >= 40 ? 'average' : 'low';
        return this.assemble(this.kb.renderStatus(await this.kb.getMatchingTier(tier), locale));
      }
      if (domain === 'kundli') {
        return this.assembleKundli(payload, locale);
      }
    } catch (e) {
      // Never let a KB hiccup break interpretation — fall through to the LLM.
      this.logger.warn(`interpret(${domain}) KB path failed: ${(e as Error).message}`);
    }
    return null;
  }

  /**
   * Turn a locale-rendered KB row whose payload IS an interpretation body
   * ({summary, points, guidance}) into a result. Returns null — so the caller
   * falls through to the LLM — when the locale wasn't an exact match or the row
   * is unusable. `renderStatus(...).matched` is the no-regression gate: an
   * untranslated locale yields matched=false and keeps the localized LLM path.
   */
  private assemble(status: { value: unknown; matched: boolean } | null): InterpretationResult | null {
    if (!status?.matched) return null;
    const p = (status.value ?? {}) as { summary?: unknown; points?: unknown; guidance?: unknown };
    const summary = this.str(p.summary);
    const points = Array.isArray(p.points)
      ? p.points.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : [];
    if (!summary || points.length === 0) return null;
    return {
      summary,
      points,
      guidance: typeof p.guidance === 'string' ? p.guidance : '',
      disclaimer: DISCLAIMER,
    };
  }

  /**
   * Assemble a kundli reading from the KB: an ascendant headline (KbSignTrait)
   * plus one concise insight per planet placement (KbPlanetInHouse), enriched
   * with the current mahadasha. Gated on the ascendant trait matching the
   * requested locale — if it doesn't (locale not yet backfilled), returns null
   * so the localized LLM path runs. Each placement/dasha point is added only
   * when its own row matches, so no English leaks into a translated reading.
   */
  private async assembleKundli(
    payload: Record<string, unknown>,
    locale?: string,
  ): Promise<InterpretationResult | null> {
    const asc = this.str(payload.ascendant);
    if (!asc) return null;
    const signSt = this.kb.renderStatus(await this.kb.getSignTrait(asc), locale);
    if (!signSt?.matched) return null;
    const trait = signSt.value as { summary?: unknown; guidance?: unknown };
    const summary = this.str(trait.summary);
    if (!summary) return null;

    const points: string[] = [];
    const planets = Array.isArray(payload.planets) ? payload.planets : [];
    for (const raw of planets) {
      if (points.length >= 6) break;
      const p = (raw ?? {}) as { planet?: unknown; house?: unknown };
      const planet = this.str(p.planet);
      const house = typeof p.house === 'number' ? p.house : null;
      if (!planet || house == null || house < 1 || house > 12) continue;
      const st = this.kb.renderStatus(await this.kb.getPlanetInHouse(`${planet}:${house}`), locale);
      if (st?.matched) {
        const text = this.str((st.value as { text?: unknown }).text);
        if (text) points.push(text);
      }
    }

    // Enrich with the current mahadasha as a "current period" note, if present.
    const lord = this.str(payload.currentMahadasha);
    if (lord && points.length < 7) {
      const ds = this.kb.renderStatus(await this.kb.getDashaImpact(lord), locale);
      if (ds?.matched) {
        const dsum = this.str((ds.value as { summary?: unknown }).summary);
        if (dsum) points.push(dsum);
      }
    }

    if (points.length === 0) return null;
    return { summary, points, guidance: this.str(trait.guidance) ?? '', disclaimer: DISCLAIMER };
  }

  /** Compatibility percentage from the matching payload (0–100), or null. */
  private matchPercentage(payload: Record<string, unknown>): number | null {
    const pct = payload.percentage;
    if (typeof pct === 'number' && Number.isFinite(pct)) return pct;
    const total = payload.totalScore;
    const max = payload.maxScore;
    if (typeof total === 'number' && typeof max === 'number' && max > 0) {
      return (total / max) * 100;
    }
    return null;
  }

  private str(v: unknown): string | null {
    return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
  }

  private buildSystemPrompt(domain: InterpretationDomain, locale?: string): string {
    return (
      `You are a warm, encouraging Vedic astrology guide who explains results to a complete beginner.` +
      ` The user does NOT know astrology jargon. Read the ${DOMAIN_LABEL[domain] ?? 'result'} below and explain what it means FOR THEM in simple, everyday language.\n\n` +
      `RULES:\n` +
      `- Talk to the person directly ("you"), like a kind mentor. Be supportive and practical, never fear-mongering or fatalistic.\n` +
      `- Translate every technical term into plain meaning (e.g. "Saturn in the 3rd house" -> "you grow through patience and steady effort").\n` +
      `- Focus on what is helpful and actionable. If something is challenging, frame it as a tendency to work with, not a doom.\n` +
      `- Do NOT make definitive medical, legal, or financial predictions or guarantees.\n` +
      `- Keep it concise.\n\n` +
      `Respond ONLY with JSON of this exact shape:\n` +
      `{"summary": "1-2 sentence headline takeaway", "points": ["3 to 5 short 'what this means for you' bullets"], "guidance": "1-2 sentences of gentle, practical next steps"}` +
      getLocaleInstruction(locale)
    );
  }

  private compactPayload(payload: Record<string, unknown>): string {
    let json: string;
    try {
      json = JSON.stringify(payload);
    } catch {
      json = String(payload);
    }
    if (json.length > InterpretationService.MAX_PAYLOAD_CHARS) {
      json = json.slice(0, InterpretationService.MAX_PAYLOAD_CHARS) + '…(truncated)';
    }
    return json;
  }

  /** Shape-guard the model's parsed JSON object; return null if it doesn't fit. */
  private coerce(obj: unknown): InterpretationResult | null {
    if (!obj || typeof obj !== 'object') return null;
    const o = obj as Record<string, unknown>;
    const summary = typeof o.summary === 'string' ? o.summary.trim() : '';
    const guidance = typeof o.guidance === 'string' ? o.guidance.trim() : '';
    const points = Array.isArray(o.points)
      ? o.points.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).map((p) => p.trim())
      : [];
    if (!summary && points.length === 0) return null;
    return { summary, points, guidance, disclaimer: DISCLAIMER };
  }

  /**
   * Non-LLM fallback so the interpretation block never hard-fails (LLM down /
   * Redis cold / bad output). Generic but honest.
   */
  private fallback(domain: InterpretationDomain): InterpretationResult {
    return {
      summary: `Here is a quick read of your ${DOMAIN_LABEL[domain] ?? 'result'}.`,
      points: [
        'Each placement above describes a tendency or theme in your life, not a fixed fate.',
        'Treat the strong points as natural strengths to lean into.',
        'Treat the challenging points as areas to grow with patience and awareness.',
      ],
      guidance:
        'For a deeper, personalised reading, open a full Report or ask in Chat — our astrologer can walk you through what matters most for you.',
      disclaimer: DISCLAIMER,
    };
  }
}
