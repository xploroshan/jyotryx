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
import { useTranslation } from '@/i18n';
import { greetingName } from '@/lib/displayName';
import { westernSunSign, profectionForAge } from '@/lib/astro/signs';
import TraditionDashboard, {
  SectionHead,
  FactCard,
} from '@/components/tradition/TraditionDashboard';

export default function HellenisticDashboardPage() {
  const { t } = useTranslation();
  const d = t.dashboards.hellenistic;
  const user = useAuthStore((s) => s.user);
  const sign = user?.dateOfBirth ? westernSunSign(user.dateOfBirth) : null;
  const profection = user?.dateOfBirth ? profectionForAge(user.dateOfBirth) : null;
  const firstName = greetingName(user);

  const ordinal = (n: number): string =>
    (d as Record<string, string>)[`ordinal${n}`] ?? '';

  const heroPhrase = profection
    ? d.heroPhraseHouse.replace('{ordinal}', ordinal(profection.house))
    : d.heroPhraseFallback;
  const headline = firstName
    ? d.heroTitle.replace('{name}', firstName).replace('{phrase}', heroPhrase)
    : d.heroTitleGuest;

  const metaLine = user?.dateOfBirth
    ? new Date(user.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      + (user.placeOfBirth ? ` · ${user.placeOfBirth}` : '')
    : undefined;

  const chips = sign
    ? [
        { label: d.sunChip.replace('{sign}', sign.name), tone: 'text-violet-300' },
        profection ? { label: d.ageChip.replace('{age}', String(profection.age)), tone: 'text-white/85' } : null,
        profection ? { label: d.houseYearChip.replace('{ordinal}', ordinal(profection.house)), tone: 'text-white/85' } : null,
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
              eyebrow={sign ? d.yourYearEyebrow : d.ataGlanceEyebrow}
              title={sign ? d.whereYearLivesTitle : d.timeLordTitle}
              tone="text-violet-700"
            />

            {sign && profection ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <FactCard
                  eyebrow={d.profectedHouseEyebrow}
                  headline={d.profectedHouseHeadline.replace('{ordinal}', capitalize(ordinal(profection.house))).replace('{house}', String(profection.house))}
                  subline={profection.topic}
                  note={d.profectedHouseNote}
                  accent="violet"
                />
                <FactCard
                  eyebrow={d.ageEyebrow}
                  headline={String(profection.age)}
                  subline={d.ageSubline}
                  note={d.ageNote}
                  accent="indigo"
                />
                <FactCard
                  eyebrow={d.sunTropicalEyebrow}
                  headline={sign.name}
                  subline={`${d.rulerPrefix} ${sign.ruler}`}
                  note={d.sunNote}
                  accent="amber"
                />
                <FactCard
                  eyebrow={d.elementEyebrow}
                  headline={sign.element}
                  subline={d.modalitySuffix.replace('{mode}', sign.mode)}
                  note={d.elementNote}
                  accent="emerald"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <FactCard
                  eyebrow={d.profectionsEyebrow}
                  headline={d.profectionsHeadline}
                  note={d.profectionsNote}
                  accent="violet"
                />
                <FactCard
                  eyebrow={d.releasingEyebrow}
                  headline={d.releasingHeadline}
                  note={d.releasingNote}
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
