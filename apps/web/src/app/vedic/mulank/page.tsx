'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { WEB_TRADITIONS } from '@/lib/traditions';
import EditorialHero from '@/components/editorial/EditorialHero';
import { TraditionGlyph } from '@/components/icons';

// ── API shape (mirrors apps/api .../numerology/mulank.ts MulankReading) ──────

type CompatRating = 'best' | 'friend' | 'neutral' | 'challenging';

interface NumberProfile {
  number: number;
  planet: string;
  sanskritPlanet: string;
  element: string;
  polarity: string;
  title: string;
  essence: string;
  personality: string;
  strengths: string[];
  weaknesses: string[];
  careers: string[];
  luckyDays: string[];
  luckyColors: string[];
  gemstone: string;
  altGemstone: string;
  metal: string;
  deity: string;
  mantra: string;
  direction: string;
  bodyFocus: string;
  healthNote: string;
  remedies: string[];
}

interface CalcStep {
  expression: string;
  value: number;
  master?: number;
  digits: number[];
}

interface CompatibilityEntry {
  number: number;
  planet: string;
  rating: CompatRating;
  note: string;
}

interface MulankReading {
  hasBirthDetails: true;
  dateOfBirth: string;
  day: number;
  month: number;
  year: number;
  mulank: number;
  bhagyank: number;
  mulankMaster?: number;
  bhagyankMaster?: number;
  calculation: { mulank: CalcStep; bhagyank: CalcStep };
  mulankProfile: NumberProfile;
  bhagyankProfile: NumberProfile;
  innerHarmony: { rating: CompatRating; note: string };
  compatibility: CompatibilityEntry[];
  bestMatches: number[];
  friendlyMatches: number[];
  neutralMatches: number[];
  challengingMatches: number[];
  luckyNumbers: number[];
  summary: string;
}

type MulankResponse = MulankReading | { hasBirthDetails: false };

// ── small presentational helpers ─────────────────────────────────────────────

const CARD = 'rounded-2xl bg-[rgba(255,252,245,0.70)] border border-[rgba(12,8,5,0.08)]';
const RULE = 'text-[11px] uppercase tracking-widest text-primary-400 font-medium';

const RATING_CLASS: Record<CompatRating, string> = {
  best: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  friend: 'bg-accent-500/15 text-accent-700 border-accent-500/30',
  neutral: 'bg-[rgba(12,8,5,0.05)] text-secondary border-[rgba(12,8,5,0.12)]',
  challenging: 'bg-red-500/10 text-red-700 border-red-500/25',
};

function Pills({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it, i) => (
        <span
          key={i}
          className="text-xs px-3 py-1 rounded-full bg-[rgba(255,252,245,0.85)] border border-[rgba(12,8,5,0.10)] text-secondary"
        >
          {it}
        </span>
      ))}
    </div>
  );
}

function Attr({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-[rgba(12,8,5,0.06)] last:border-0">
      <span className="text-[12px] text-[rgba(12,8,5,0.50)] shrink-0">{label}</span>
      <span className="text-sm text-surface-950 text-right font-medium">{value}</span>
    </div>
  );
}

function NumberBadge({ value, planet, title, caption }: { value: number; planet: string; title: string; caption: string }) {
  return (
    <div className={`${CARD} p-6 sm:p-7 flex items-center gap-5`}>
      <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-400/30 to-primary-500/20 border border-amber-500/30 flex items-center justify-center">
        <span className="text-3xl sm:text-4xl font-display font-semibold text-surface-950">{value}</span>
      </div>
      <div className="min-w-0">
        <div className="text-base sm:text-lg font-semibold text-surface-950">{title}</div>
        <div className="text-sm text-primary-500 font-medium">{planet}</div>
        <p className="text-xs text-[rgba(12,8,5,0.55)] mt-1 leading-relaxed">{caption}</p>
      </div>
    </div>
  );
}

/** Full deep-dive card for a single number profile. */
function ProfileCard({
  profile,
  labels,
  variant,
}: {
  profile: NumberProfile;
  labels: any;
  variant: 'full' | 'compact';
}) {
  return (
    <div className={`${CARD} p-6 sm:p-8 space-y-6`}>
      <div>
        <div className="flex items-center gap-3 mb-1.5">
          <span className="text-2xl font-display font-semibold text-surface-950">{profile.number}</span>
          <h3 className="text-lg font-semibold text-surface-950">{profile.title}</h3>
        </div>
        <p className="text-sm text-[rgba(12,8,5,0.60)] italic">{profile.essence}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-6">
        <Attr label={labels.rulingPlanet} value={`${profile.planet} (${profile.sanskritPlanet})`} />
        <Attr label={labels.element} value={profile.element} />
      </div>

      <div>
        <p className={`${RULE} mb-2`}>{labels.personality}</p>
        <p className="text-sm text-secondary leading-relaxed">{profile.personality}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <p className={`${RULE} mb-2`}>{labels.strengths}</p>
          <ul className="text-sm text-secondary list-disc pl-5 space-y-1">
            {profile.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
        <div>
          <p className={`${RULE} mb-2`}>{labels.weaknesses}</p>
          <ul className="text-sm text-secondary list-disc pl-5 space-y-1">
            {profile.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      </div>

      <div>
        <p className={`${RULE} mb-2`}>{labels.careers}</p>
        <Pills items={profile.careers} />
      </div>

      {variant === 'full' && (
        <>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <p className={`${RULE} mb-2`}>{labels.luckyDays}</p>
              <Pills items={profile.luckyDays} />
            </div>
            <div>
              <p className={`${RULE} mb-2`}>{labels.luckyColors}</p>
              <Pills items={profile.luckyColors} />
            </div>
          </div>

          <div className="rounded-xl bg-[rgba(255,252,245,0.80)] border border-[rgba(12,8,5,0.08)] p-5 grid sm:grid-cols-2 gap-x-8">
            <Attr label={labels.gemstone} value={profile.gemstone} />
            <Attr label={labels.altGemstone} value={profile.altGemstone} />
            <Attr label={labels.metal} value={profile.metal} />
            <Attr label={labels.direction} value={profile.direction} />
            <Attr label={labels.deity} value={profile.deity} />
            <Attr label={labels.mantra} value={profile.mantra} />
          </div>

          <div>
            <p className={`${RULE} mb-2`}>{labels.health}</p>
            <p className="text-sm text-secondary leading-relaxed">{profile.healthNote}</p>
          </div>
        </>
      )}

      <div>
        <p className={`${RULE} mb-2`}>{labels.remedies}</p>
        <ul className="text-sm text-secondary list-disc pl-5 space-y-1">
          {profile.remedies.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </div>
    </div>
  );
}

/**
 * Vedic Mulank — dedicated numerology page.
 *
 * Calls `GET /numerology/mulank`, which deterministically derives the Mulank
 * (root number, from the day of birth) and Bhagyank (destiny number, from the
 * full date) from the authenticated user's saved DOB, plus exhaustive per-number
 * meaning and 1–9 compatibility. Profiles without a DOB get a prompt to complete
 * their profile (the API returns `hasBirthDetails:false`).
 */
export default function VedicMulankPage() {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuthStore();
  const cfg = WEB_TRADITIONS.VEDIC;
  const m = (t as any).featurePages.vedicMulank;

  const [data, setData] = useState<MulankResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasBirthDetails = Boolean(user?.dateOfBirth);

  useEffect(() => {
    if (!isAuthenticated || !hasBirthDetails) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .get<MulankResponse>('/numerology/mulank')
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || t.kundli.generateFailed);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, hasBirthDetails, t.kundli.generateFailed]);

  const featureName = (t as any).traditionsUi?.vedic?.features?.mulank || 'Mulank';
  const traditionName = (t as any).traditionsUi?.vedic?.name || 'Vedic';

  const reading = data && data.hasBirthDetails ? data : null;
  const ratingLabel = (r: CompatRating): string =>
    r === 'best' ? m.ratingBest : r === 'friend' ? m.ratingFriend : r === 'neutral' ? m.ratingNeutral : m.ratingChallenging;

  return (
    <div>
      <EditorialHero
        tint="amber"
        eyebrow={`${traditionName} · ${featureName}`}
        eyebrowIcon={<TraditionGlyph id="VEDIC" size={18} weight={1.4} />}
        headline={`{em}${featureName}{/em}`}
        tagline={m.description}
      />

      <div className="mx-auto max-w-4xl px-5 sm:px-8 py-8 fade-in-up">
        <nav className="mb-5 text-sm text-[rgba(12,8,5,0.46)]">
          <Link href={`/${cfg.slug}`} className="hover:text-surface-950 transition-colors">
            {traditionName}
          </Link>{' '}
          <span className="text-[rgba(12,8,5,0.32)]">/</span>{' '}
          <span className="text-secondary">{featureName}</span>
        </nav>

        {!isAuthenticated && (
          <div className={`${CARD} p-10 text-center`}>
            <p className="text-[rgba(12,8,5,0.55)] mb-5">{t.kundli.loginRequired}</p>
            <Link href="/auth?mode=login" className="inline-block px-6 py-2.5 btn-primary rounded-full text-sm">
              {t.common.login}
            </Link>
          </div>
        )}

        {isAuthenticated && !hasBirthDetails && (
          <div className={`${CARD} p-10 text-center`}>
            <p className="text-[rgba(12,8,5,0.55)] mb-5">{m.completeProfile}</p>
            <Link href="/profile" className="inline-block px-6 py-2.5 btn-primary rounded-full text-sm">
              {m.profile}
            </Link>
          </div>
        )}

        {isAuthenticated && hasBirthDetails && loading && (
          <div className={`${CARD} p-10 text-center text-[rgba(12,8,5,0.46)] text-sm`}>{t.common.loading}</div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-6 text-center text-red-700 text-sm">
            {error}
          </div>
        )}

        {reading && (
          <div className="space-y-10">
            {/* Summary — the two anchor numbers */}
            <section className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <NumberBadge value={reading.mulank} planet={reading.mulankProfile.planet} title={m.mulankTitle} caption={m.mulankCaption} />
                <NumberBadge value={reading.bhagyank} planet={reading.bhagyankProfile.planet} title={m.bhagyankTitle} caption={m.bhagyankCaption} />
              </div>
              <p className="text-sm text-secondary leading-relaxed px-1">{reading.summary}</p>
            </section>

            {/* How it's calculated */}
            <section>
              <p className={`${RULE} mb-3`}>{m.howCalculated}</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { label: m.mulankStepLabel, step: reading.calculation.mulank, master: reading.mulankMaster },
                  { label: m.bhagyankStepLabel, step: reading.calculation.bhagyank, master: reading.bhagyankMaster },
                ].map((c, i) => (
                  <div key={i} className={`${CARD} p-5`}>
                    <p className="text-[12px] text-[rgba(12,8,5,0.55)] mb-2">{c.label}</p>
                    <p className="font-mono text-sm sm:text-base text-surface-950 break-words leading-relaxed">{c.step.expression}</p>
                    {c.master ? (
                      <p className="mt-3 text-xs text-accent-700 bg-accent-500/10 border border-accent-500/25 rounded-lg px-3 py-2">
                        {m.masterNote.replace('{n}', String(c.master))}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            {/* Inner harmony */}
            <section className={`${CARD} p-6 sm:p-7`}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className={RULE}>{m.innerHarmony}</p>
                <span className={`text-[11px] px-3 py-1 rounded-full border font-medium ${RATING_CLASS[reading.innerHarmony.rating]}`}>
                  {ratingLabel(reading.innerHarmony.rating)}
                </span>
              </div>
              <p className="text-[12px] text-[rgba(12,8,5,0.45)] mb-3">{m.innerHarmonyHint}</p>
              <p className="text-sm text-secondary leading-relaxed">{reading.innerHarmony.note}</p>
            </section>

            {/* Mulank deep-dive */}
            <section>
              <p className={`${RULE} mb-3`}>{m.mulankTitle}</p>
              <ProfileCard profile={reading.mulankProfile} labels={m} variant="full" />
            </section>

            {/* Bhagyank deep-dive (focused) */}
            {reading.bhagyank !== reading.mulank && (
              <section>
                <p className={`${RULE} mb-3`}>{m.bhagyankTitle}</p>
                <ProfileCard profile={reading.bhagyankProfile} labels={m} variant="compact" />
              </section>
            )}

            {/* Compatibility */}
            <section>
              <p className={`${RULE} mb-1`}>{m.compatibility}</p>
              <p className="text-[12px] text-[rgba(12,8,5,0.45)] mb-3">{m.compatHint}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {reading.compatibility.map((c) => (
                  <div key={c.number} className={`${CARD} p-4 flex gap-4 items-start`}>
                    <div className="shrink-0 w-11 h-11 rounded-xl bg-[rgba(255,252,245,0.85)] border border-[rgba(12,8,5,0.10)] flex items-center justify-center">
                      <span className="text-lg font-display font-semibold text-surface-950">{c.number}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-primary-500 font-medium">{c.planet}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${RATING_CLASS[c.rating]}`}>
                          {ratingLabel(c.rating)}
                        </span>
                      </div>
                      <p className="text-[12px] text-[rgba(12,8,5,0.58)] leading-relaxed">{c.note}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {reading.luckyNumbers.length > 0 && (
                  <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 font-medium">
                    {m.luckyNumbers}: {reading.luckyNumbers.join(', ')}
                  </span>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
