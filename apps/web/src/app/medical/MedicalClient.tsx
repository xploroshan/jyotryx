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
import { useTranslation } from '@/i18n';
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

export default function MedicalDashboardPage() {
  const { t } = useTranslation();
  const d = t.dashboards.medical;
  const user = useAuthStore((s) => s.user);
  const sign = user?.dateOfBirth ? westernSunSign(user.dateOfBirth) : null;
  const todaySign = westernSunSignToday();
  const firstName = greetingName(user);
  const bodyPart = sign ? SIGN_BODY_PART[sign.name] : null;

  const humourByElement: Record<string, { humour: string; note: string }> = {
    Fire:  { humour: d.humourCholeric, note: d.humourCholericNote },
    Earth: { humour: d.humourMelancholic, note: d.humourMelancholicNote },
    Air:   { humour: d.humourSanguine, note: d.humourSanguineNote },
    Water: { humour: d.humourPhlegmatic, note: d.humourPhlegmaticNote },
  };
  const humour = sign ? humourByElement[sign.element] : null;

  const headline = firstName
    ? d.heroTitle.replace('{name}', firstName)
    : d.heroTitleGuest;

  const metaLine = user?.dateOfBirth
    ? new Date(user.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      + (user.placeOfBirth ? ` · ${user.placeOfBirth}` : '')
    : undefined;

  const chips = sign
    ? [
        { label: d.sunChip.replace('{sign}', sign.name), tone: 'text-emerald-300' },
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
              eyebrow={sign ? d.yourConstitutionEyebrow : d.ataGlanceEyebrow}
              title={sign ? d.bodyHumourSeasonTitle : d.melothesiaTitle}
              tone="text-emerald-700"
            />

            {sign && bodyPart && humour ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <FactCard
                  eyebrow={d.sunRulesEyebrow}
                  headline={bodyPart.split(',')[0]}
                  subline={bodyPart}
                  note={d.sunRulesNote}
                  accent="emerald"
                />
                <FactCard
                  eyebrow={d.humourEyebrow}
                  headline={humour.humour}
                  subline={d.elementSuffix.replace('{element}', sign.element)}
                  note={humour.note}
                  accent="amber"
                />
                {todaySign && (
                  <FactCard
                    eyebrow={d.todaysTransitEyebrow}
                    headline={SIGN_BODY_PART[todaySign.name].split(',')[0]}
                    subline={d.sunInSuffix.replace('{sign}', todaySign.name)}
                    note={d.todaysTransitNote}
                    accent="rose"
                  />
                )}
                <FactCard
                  eyebrow={d.practiceEyebrow}
                  headline={d.decumbitureChartHeadline}
                  subline={d.decumbitureChartSubline}
                  note={d.decumbitureChartNote}
                  accent="violet"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <FactCard
                  eyebrow={d.melothesiaEyebrow}
                  headline={d.zodiacBodyHeadline}
                  note={d.zodiacBodyNote}
                  accent="emerald"
                />
                <FactCard
                  eyebrow={d.decumbitureEyebrow}
                  headline={d.fallingSickHeadline}
                  note={d.fallingSickNote}
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
