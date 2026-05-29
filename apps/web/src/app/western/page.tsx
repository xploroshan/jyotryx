'use client';

/**
 * Western tradition landing — editorial personal dashboard.
 *
 * Shows the visitor's tropical sun sign (computed deterministically
 * from DOB, no /astrology/kundli credit charged) alongside its
 * element / mode / ruler and the sign the sun is in today.
 */

import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/i18n';
import { greetingName } from '@/lib/displayName';
import { westernSunSign, westernSunSignToday } from '@/lib/astro/signs';
import TraditionDashboard, {
  SectionHead,
  FactCard,
} from '@/components/tradition/TraditionDashboard';

const ELEMENT_ACCENT: Record<string, 'red' | 'amber' | 'sky' | 'indigo'> = {
  Fire: 'red', Earth: 'amber', Air: 'sky', Water: 'indigo',
};

export default function WesternDashboardPage() {
  const { t } = useTranslation();
  const d = t.dashboards.western;
  const user = useAuthStore((s) => s.user);
  const sign = user?.dateOfBirth ? westernSunSign(user.dateOfBirth) : null;
  const todaySign = westernSunSignToday();
  const firstName = greetingName(user);

  const elementNote: Record<string, string> = {
    Fire: d.elementFireNote, Earth: d.elementEarthNote,
    Air: d.elementAirNote, Water: d.elementWaterNote,
  };
  const modeNote: Record<string, string> = {
    Cardinal: d.modeCardinalNote, Fixed: d.modeFixedNote, Mutable: d.modeMutableNote,
  };

  const headline = firstName
    ? d.heroTitle.replace('{name}', firstName)
    : d.heroTitleGuest;

  const metaLine = user?.dateOfBirth
    ? new Date(user.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      + (user.placeOfBirth ? ` · ${user.placeOfBirth}` : '')
    : undefined;

  const chips = sign
    ? [
        { label: d.sunChip.replace('{sign}', sign.name), tone: 'text-sky-300' },
        { label: d.elementChip.replace('{element}', sign.element), tone: 'text-white/85' },
        { label: d.modeChip.replace('{mode}', sign.mode), tone: 'text-white/85' },
      ]
    : undefined;

  return (
    <TraditionDashboard
      traditionId="WESTERN"
      headline={headline}
      metaLine={metaLine}
      chips={chips}
      personalContent={
        <section className="border-b border-[rgba(26,20,16,0.10)]">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-12">
            <SectionHead
              eyebrow={sign ? d.yourSunSignEyebrow : t.dashboards.common.todaysSky}
              title={sign ? d.fourCornersTitle : d.sunRightNowTitle}
              tone="text-sky-700"
            />

            {sign ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <FactCard
                  eyebrow={d.sunTropicalEyebrow}
                  headline={sign.name}
                  subline={`${d.rulerPrefix} ${sign.ruler}`}
                  note={d.sunNote}
                  accent="sky"
                />
                <FactCard
                  eyebrow={d.elementEyebrow}
                  headline={sign.element}
                  note={elementNote[sign.element]}
                  accent={ELEMENT_ACCENT[sign.element]}
                />
                <FactCard
                  eyebrow={d.modalityEyebrow}
                  headline={sign.mode}
                  note={modeNote[sign.mode]}
                  accent="violet"
                />
                {todaySign && (
                  <FactCard
                    eyebrow={d.sunTodayEyebrow}
                    headline={todaySign.name}
                    subline={`${todaySign.element} · ${todaySign.mode}`}
                    note={d.seasonFlavor.replace('{flavor}', elementNote[todaySign.element].split('—')[0].trim())}
                    accent="amber"
                  />
                )}
              </div>
            ) : todaySign ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <FactCard
                  eyebrow={d.sunTodayEyebrow}
                  headline={todaySign.name}
                  subline={`${todaySign.element} · ${todaySign.mode}`}
                  note={elementNote[todaySign.element]}
                  accent="amber"
                />
                <FactCard
                  eyebrow={t.dashboards.common.addBirthEyebrow}
                  headline={d.seeYourChart}
                  subline={d.sunElementModeRuler}
                  note={d.addBirthNote}
                  accent="sky"
                />
              </div>
            ) : null}
          </div>
        </section>
      }
    />
  );
}
