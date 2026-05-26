'use client';

/**
 * Hellenistic tradition landing — editorial personal dashboard.
 *
 * Shows the visitor's tropical sun sign and the house they're
 * profecting through this year (deterministic from DOB age). The
 * profected house determines the "Lord of the Year" — the planet
 * to watch for the year's flavour.
 */

import { useAuthStore } from '@/lib/store';
import { westernSunSign, profectionForAge } from '@/lib/astro/signs';
import TraditionDashboard, {
  SectionHead,
  FactCard,
} from '@/components/tradition/TraditionDashboard';

const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
  'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];

export default function HellenisticDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const sign = user?.dateOfBirth ? westernSunSign(user.dateOfBirth) : null;
  const profection = user?.dateOfBirth ? profectionForAge(user.dateOfBirth) : null;
  const firstName = user?.name?.split(' ')[0];

  const headline = firstName
    ? `${firstName}, the {em}${profection ? ORDINAL[profection.house] + ' house' : 'ancient art'}{/em} year`
    : `Your {em}Hellenistic chart{/em}`;

  const metaLine = user?.dateOfBirth
    ? new Date(user.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      + (user.placeOfBirth ? ` · ${user.placeOfBirth}` : '')
    : undefined;

  const chips = sign
    ? [
        { label: `${sign.name} Sun`, tone: 'text-violet-300' },
        profection ? { label: `Age ${profection.age}`, tone: 'text-white/85' } : null,
        profection ? { label: `${ORDINAL[profection.house]} house year`, tone: 'text-white/85' } : null,
      ].filter(Boolean) as { label: string; tone: string }[]
    : undefined;

  return (
    <TraditionDashboard
      traditionId="HELLENISTIC"
      headline={headline}
      metaLine={metaLine}
      chips={chips}
      personalContent={
        <section className="border-b border-[rgba(26,20,16,0.10)]">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-12">
            <SectionHead
              eyebrow={sign ? 'Your year' : 'Hellenistic at a glance'}
              title={sign ? 'Where the year lives' : 'Time-lord astrology'}
              tone="text-violet-700"
            />

            {sign && profection ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <FactCard
                  eyebrow="Profected house"
                  headline={`${capitalize(ORDINAL[profection.house])} (${profection.house})`}
                  subline={profection.topic}
                  note="The lord of this house becomes the year's headline planet — where the story focuses."
                  accent="violet"
                />
                <FactCard
                  eyebrow="Age"
                  headline={String(profection.age)}
                  subline="Years since you arrived"
                  note="Profection moves clockwise one house each birthday — twelve-year cycles."
                  accent="indigo"
                />
                <FactCard
                  eyebrow="Sun (tropical)"
                  headline={sign.name}
                  subline={`Ruler: ${sign.ruler}`}
                  note="The sect, the daimon, the daily light you live under."
                  accent="amber"
                />
                <FactCard
                  eyebrow="Element"
                  headline={sign.element}
                  subline={`${sign.mode} modality`}
                  note="Triplicity lords rule the day-sect and night-sect of this element."
                  accent="emerald"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <FactCard
                  eyebrow="Annual profections"
                  headline="A house a year"
                  note="Each birthday the locus moves one house clockwise from the Ascendant. The new house lord becomes the year's planet to watch."
                  accent="violet"
                />
                <FactCard
                  eyebrow="Zodiacal releasing"
                  headline="Chapters of life"
                  note="Vettius Valens's technique for finding the peak years of your career, partnerships, and pivots."
                  accent="indigo"
                />
              </div>
            )}
          </div>
        </section>
      }
    />
  );
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
