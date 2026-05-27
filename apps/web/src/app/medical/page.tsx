'use client';

/**
 * Medical (decumbiture) tradition landing — editorial dashboard.
 *
 * Each tropical sign rules a body region in classical melothesia.
 * The visitor sees their sun-sign correspondence at a glance, plus
 * a humour / element note and a primer on the two complementary
 * techniques (decumbiture for acute illness, body-zodiac for the
 * constitutional baseline).
 */

import { useAuthStore } from '@/lib/store';
import { greetingName } from '@/lib/displayName';
import {
  westernSunSign,
  westernSunSignToday,
  SIGN_BODY_PART,
} from '@/lib/astro/signs';
import TraditionDashboard, {
  SectionHead,
  FactCard,
} from '@/components/tradition/TraditionDashboard';

const HUMOUR_BY_ELEMENT: Record<string, { humour: string; note: string }> = {
  Fire:  { humour: 'Choleric', note: 'Hot and dry — sharp, swift, prone to inflammation and impatience.' },
  Earth: { humour: 'Melancholic', note: 'Cold and dry — slow, retentive, prone to stagnation and stiffness.' },
  Air:   { humour: 'Sanguine', note: 'Hot and moist — buoyant, social, prone to nervous excess.' },
  Water: { humour: 'Phlegmatic', note: 'Cold and moist — soft, receptive, prone to congestion and damp.' },
};

export default function MedicalDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const sign = user?.dateOfBirth ? westernSunSign(user.dateOfBirth) : null;
  const todaySign = westernSunSignToday();
  const firstName = greetingName(user);
  const bodyPart = sign ? SIGN_BODY_PART[sign.name] : null;
  const humour = sign ? HUMOUR_BY_ELEMENT[sign.element] : null;

  const headline = firstName
    ? `${firstName}'s {em}constitutional reading{/em}`
    : `Your {em}medical chart{/em}`;

  const metaLine = user?.dateOfBirth
    ? new Date(user.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      + (user.placeOfBirth ? ` · ${user.placeOfBirth}` : '')
    : undefined;

  const chips = sign
    ? [
        { label: `${sign.name} Sun`, tone: 'text-emerald-300' },
        humour ? { label: humour.humour, tone: 'text-white/85' } : null,
      ].filter(Boolean) as { label: string; tone: string }[]
    : undefined;

  return (
    <TraditionDashboard
      traditionId="MEDICAL"
      headline={headline}
      metaLine={metaLine}
      chips={chips}
      personalContent={
        <section className="border-b border-[rgba(26,20,16,0.10)]">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-12">
            <SectionHead
              eyebrow={sign ? 'Your constitution' : 'Medical at a glance'}
              title={sign ? 'Body, humour, season' : 'Melothesia & decumbiture'}
              tone="text-emerald-700"
            />

            {sign && bodyPart && humour ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <FactCard
                  eyebrow="Sun rules"
                  headline={bodyPart.split(',')[0]}
                  subline={bodyPart}
                  note="The body region your sun-sign governs in the classical melothesia — your vitality lives here."
                  accent="emerald"
                />
                <FactCard
                  eyebrow="Humour"
                  headline={humour.humour}
                  subline={`${sign.element} element`}
                  note={humour.note}
                  accent="amber"
                />
                {todaySign && (
                  <FactCard
                    eyebrow="Today's transit"
                    headline={SIGN_BODY_PART[todaySign.name].split(',')[0]}
                    subline={`Sun in ${todaySign.name}`}
                    note="The body region under accent today — extra care, or extra capacity, here."
                    accent="rose"
                  />
                )}
                <FactCard
                  eyebrow="Practice"
                  headline="Decumbiture chart"
                  subline="Cast for the moment illness began"
                  note="The chart of when you took to bed — read like a horary question for the body."
                  accent="violet"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <FactCard
                  eyebrow="Melothesia"
                  headline="The zodiac body"
                  note="Each sign rules a region of the body — Aries the head, Pisces the feet, with everything in between."
                  accent="emerald"
                />
                <FactCard
                  eyebrow="Decumbiture"
                  headline="The chart of falling sick"
                  note="A horary technique that reads the moment of decline to predict crisis, recovery, and best remedies."
                  accent="rose"
                />
              </div>
            )}
          </div>
        </section>
      }
    />
  );
}
