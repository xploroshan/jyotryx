"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useScrollProgress } from "@/lib/motion";
import { useAuthStore } from "@/lib/store";
import { useTranslation } from "@/i18n";
import { usePricingConfig } from "@/lib/usePricingConfig";
import { Stagger } from "@/components/ui/PageTransition";
import HeroSun from "@/components/home/HeroSun";
import { WEB_TRADITIONS, TRADITION_IDS, TRADITION_BADGE_COLORS } from "@/lib/traditions";
import { TraditionGlyph } from "@/components/icons";

const BentoSummary = dynamic(() => import("@/components/home/BentoSummary"), {
  ssr: false,
});

/** Resolve a dotted i18n path (e.g. "traditionsUi.vedic.tagline") off the
 *  translation object. Used for the tradition showcase, whose labels live in
 *  the localized traditionsUi.* tree — so every card is fully localized. */
function readLabel(t: unknown, path: string, fallback = ""): string {
  const parts = path.split(".");
  let node: unknown = t;
  for (const p of parts) {
    if (node && typeof node === "object" && p in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[p];
    } else return fallback;
  }
  return typeof node === "string" ? node : fallback;
}

/**
 * Renders a highlight phrase with the .accent-underline scoped to the brand
 * name "MyAstro360" only. Each fragment carries its own gradient because
 * `text-gradient-sunrise` clips background to text — putting it on a parent
 * leaves the children with `color: transparent` and no gradient of their own.
 * Brand string is locale-stable; if a translation drops it the whole phrase
 * still renders with the gradient and no underline. The gradient + display
 * weight carries the emphasis in every script (no Latin-only italic relied on).
 */
function renderHighlight(text: string) {
  const BRAND = "MyAstro360";
  if (!text.includes(BRAND)) {
    return <span className="text-gradient-sunrise">{text}</span>;
  }
  const parts = text.split(BRAND);
  const out: React.ReactNode[] = [];
  parts.forEach((p, i) => {
    if (p) {
      const leading = i < parts.length - 1 ? p.replace(/\s+$/, "") : p;
      if (leading) {
        out.push(
          <span key={`p-${i}`} className="text-gradient-sunrise">
            {leading}
          </span>,
        );
      }
    }
    if (i < parts.length - 1) {
      out.push(
        <span
          key={`b-${i}`}
          className="block text-gradient-sunrise accent-underline mt-3 sm:mt-4 pt-[0.08em] leading-[1.05]"
        >
          {BRAND}
        </span>,
      );
    }
  });
  return <>{out}</>;
}

export default function HomePage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { t } = useTranslation();
  const { subscriptionsEnabled } = usePricingConfig();

  const stats = [
    { label: t.home.available, value: "24/7" },
    { label: t.home.multiLanguage, value: "12" },
    { label: t.home.accuracy, value: "100%" },
    { label: t.home.users, value: "100K+" },
  ];

  return (
    <div>
      {/* ── Hero — a cosmic stage. Oversized bold headline (carries hierarchy
          through scale/weight/colour, so it holds up in every script), the sun
          orb as the focal mass, dual CTA, and an honest proof line. ── */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div
            className="mesh-drift-bg absolute top-[-14%] right-[-16%] w-[82%] h-[92%] rounded-full opacity-90"
            style={{
              background:
                "radial-gradient(circle, rgba(255,182,39,0.36) 0%, rgba(255,77,0,0.20) 38%, transparent 72%)",
            }}
          />
          <div
            className="absolute bottom-[-22%] left-[-12%] w-[56%] h-[62%] rounded-full opacity-60"
            style={{
              background:
                "radial-gradient(circle, rgba(255,122,64,0.18) 0%, rgba(255,77,0,0.08) 42%, transparent 75%)",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 pt-12 sm:pt-16 lg:pt-24 pb-16 sm:pb-24">
          <div className="grid grid-cols-12 gap-y-10 lg:gap-x-8 items-center">
            <div className="col-span-12 lg:col-span-7 order-1">
              <p className="font-display italic text-[15px] sm:text-base text-primary-600 mb-6 sm:mb-8 tracking-wide hero-rise">
                — {t.home.badge}
                {!subscriptionsEnabled && (
                  <span className="not-italic ml-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 align-middle text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                    ✨ {t.home.freeBadge}
                  </span>
                )}
              </p>

              <h1
                aria-label={`${t.home.heroTitle} ${t.home.heroHighlight}`}
                className="font-display font-semibold text-surface-950 leading-[0.96] tracking-[-0.02em] mb-8"
                style={{ fontSize: "clamp(52px, 8.5vw, 132px)" }}
              >
                <span className="block hero-rise">
                  {t.home.heroTitle.replace(/[,.]?\s*$/, "")}
                </span>
                <span className="block mt-2 sm:mt-3 hero-rise" style={{ animationDelay: "0.1s" }}>
                  {renderHighlight(t.home.heroHighlight)}
                </span>
              </h1>

              <p
                className="text-emphasis text-[17px] sm:text-lg max-w-xl leading-relaxed mb-8 hero-rise"
                style={{ animationDelay: "0.18s" }}
              >
                {t.home.heroDescription}
              </p>

              <div
                className="flex flex-wrap items-center gap-5 sm:gap-6 mb-6 hero-rise"
                style={{ animationDelay: "0.26s" }}
              >
                <CtaPrimary href="/chat" label={t.home.startConsultation} size="lg" />
                <Link
                  href="/palmistry"
                  className="group inline-flex items-center gap-2 text-[15px] font-semibold text-surface-950 hover:text-primary-600 transition-colors focus-ring rounded-full px-5 py-2.5 btn-ghost"
                >
                  {t.home.tryPalmReading}
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                </Link>
              </div>

              <p className="text-xs text-muted max-w-md hero-rise" style={{ animationDelay: "0.32s" }}>
                {t.home.heroProof}
              </p>
            </div>

            <div className="col-span-12 lg:col-span-5 order-2 relative">
              <div
                className="hero-scale-in relative mx-auto lg:translate-x-[6%] xl:translate-x-[10%]"
                style={{ width: "100%", maxWidth: "min(540px, 80vw)" }}
              >
                <HeroSun />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats proof band — oversized tabular numerals on a faint cream
          strip. Honest, verifiable figures only. ── */}
      <section className="border-y hairline bg-[rgba(255,252,245,0.45)]">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-12 sm:py-16">
          <p className="text-[12px] font-medium text-primary-600 uppercase tracking-[0.22em] mb-8 sm:mb-10 text-center">
            {t.home.statsEyebrow}
          </p>
          <Stagger.Container className="grid grid-cols-2 sm:grid-cols-4 gap-y-8 gap-x-4">
            {stats.map((s) => (
              <Stagger.Item key={s.label} className="text-center">
                <div
                  className="font-display font-semibold text-surface-950 tabular-nums leading-none"
                  style={{ fontSize: "clamp(40px, 6vw, 76px)" }}
                >
                  {s.value}
                </div>
                <div className="mt-2 text-[11px] sm:text-xs uppercase tracking-[0.18em] text-muted">
                  {s.label}
                </div>
              </Stagger.Item>
            ))}
          </Stagger.Container>
        </div>
      </section>

      {/* ── Tradition showcase — the product's USP: six systems, each a tappable
          card with its glyph, tint and localized tagline. ── */}
      <section className="px-5 sm:px-8 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <p className="text-[12px] font-medium text-primary-600 uppercase tracking-[0.22em] mb-4">
              {t.home.traditionsEyebrow}
            </p>
            <h2
              className="font-display font-semibold text-surface-950 tracking-[-0.01em] leading-[1.04] mb-5"
              style={{ fontSize: "clamp(34px, 5vw, 64px)" }}
            >
              {t.home.traditionsTitle}{" "}
              <span className="text-gradient-sunrise">{t.home.traditionsHighlight}</span>
            </h2>
            <p className="text-base text-emphasis leading-relaxed reading-measure mx-auto">
              {t.home.traditionsDesc}
            </p>
          </div>

          <Stagger.Container className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TRADITION_IDS.map((id) => {
              const cfg = WEB_TRADITIONS[id];
              const name = readLabel(t, cfg.labelKey, cfg.slug);
              const tagline = readLabel(t, cfg.taglineKey, "");
              return (
                <Stagger.Item key={id}>
                  <Link
                    href={`/${cfg.slug}`}
                    className="group flex h-full flex-col rounded-2xl surface-card-hover shadow-warm-sm p-6 focus-ring transition-transform hover:-translate-y-0.5"
                  >
                    <span
                      className={`inline-flex items-center justify-center w-11 h-11 rounded-xl border mb-4 ${TRADITION_BADGE_COLORS[id]}`}
                    >
                      <TraditionGlyph id={id} size={22} weight={1.5} />
                    </span>
                    <h3 className="font-display text-xl font-semibold text-surface-950 mb-1.5">
                      {name}
                    </h3>
                    <p className="text-sm text-emphasis leading-relaxed mb-4 grow">{tagline}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary-600">
                      {t.home.exploreTradition}
                      <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                    </span>
                  </Link>
                </Stagger.Item>
              );
            })}
          </Stagger.Container>
        </div>
      </section>

      {/* ── Bento summary ── */}
      <BentoSummary />

      {/* ── How it works ── */}
      <HowItWorks
        title={t.home.howItWorks}
        eyebrow={t.home.howItWorksTitle}
        steps={[
          { step: "01", title: t.home.step01Title, desc: t.home.step01Desc },
          { step: "02", title: t.home.step02Title, desc: t.home.step02Desc },
          { step: "03", title: t.home.step03Title, desc: t.home.step03Desc },
        ]}
      />

      {/* ── Trust — a dark cosmic band. The page's bold contrast moment: deep
          ink + a faint starfield, with the three honest brand promises in
          warm white. ── */}
      <TrustBandDark
        eyebrow={t.home.trustEyebrow}
        pillars={[
          { title: t.home.trustMeterTitle, desc: t.home.trustMeterDesc },
          { title: t.home.trustMathTitle, desc: t.home.trustMathDesc },
          { title: t.home.trustHumanTitle, desc: t.home.trustHumanDesc },
        ]}
      />

      {/* ── Closing CTA — soft sunrise wash that closes the page before the
          dark Footer anchor. ── */}
      <section className="relative py-28 sm:py-36 px-5 sm:px-8 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 30%, rgba(255,182,39,0.18) 0%, rgba(255,77,0,0.08) 45%, transparent 75%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <h2
            className="font-display font-semibold text-surface-950 mb-6 tracking-[-0.01em] leading-[1.02]"
            style={{ fontSize: "clamp(40px, 6vw, 80px)" }}
          >
            {t.home.ctaTitle}{" "}
            <span className="text-gradient-sunrise">{t.home.ctaHighlight}</span>?
          </h2>
          <p className="text-base sm:text-lg text-emphasis mb-10 max-w-xl mx-auto leading-relaxed">
            {isAuthenticated ? t.home.ctaLoggedIn : t.home.ctaLoggedOut}
          </p>
          <CtaPrimary
            href={isAuthenticated ? "/my-day" : "/auth?mode=signup"}
            label={isAuthenticated ? t.home.ctaButtonLoggedIn : t.home.ctaButtonLoggedOut}
            size="lg"
          />
        </div>
      </section>
    </div>
  );
}

/**
 * Trust band on a deep cosmic ground — the page's one dark, dramatic moment.
 * Three honest brand promises in warm white over a faint CSS starfield (zero
 * DOM nodes — the stars are layered radial-gradients). High contrast on dark
 * clears WCAG AA comfortably.
 */
function TrustBandDark({
  eyebrow,
  pillars,
}: {
  eyebrow: string;
  pillars: { title: string; desc: string }[];
}) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "linear-gradient(160deg, #1c1207 0%, #2c1d0d 52%, #0d0904 100%)" }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 18% 28%, rgba(255,236,200,0.55), transparent), radial-gradient(1px 1px at 72% 62%, rgba(255,236,200,0.45), transparent), radial-gradient(1.5px 1.5px at 44% 82%, rgba(255,200,120,0.45), transparent), radial-gradient(1px 1px at 86% 24%, rgba(255,236,200,0.45), transparent), radial-gradient(1px 1px at 32% 54%, rgba(255,236,200,0.35), transparent), radial-gradient(1px 1px at 60% 16%, rgba(255,236,200,0.4), transparent)",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8 py-24 sm:py-32">
        <p className="text-[12px] font-medium text-amber-300/90 uppercase tracking-[0.22em] mb-12 text-center">
          {eyebrow}
        </p>
        <Stagger.Container className="grid md:grid-cols-3 gap-10 md:gap-12">
          {pillars.map((p, i) => (
            <Stagger.Item key={p.title} className="relative md:px-2">
              {i > 0 && (
                <span
                  aria-hidden
                  className="hidden md:block absolute -left-6 top-1 bottom-1 w-px bg-white/10"
                />
              )}
              <h3 className="font-display text-xl sm:text-2xl font-semibold text-surface-50 mb-3 leading-tight">
                {p.title}
              </h3>
              <p className="text-sm text-white/70 leading-relaxed">{p.desc}</p>
            </Stagger.Item>
          ))}
        </Stagger.Container>
      </div>
    </section>
  );
}

/**
 * How-it-works section with editorial breakout numerals (hollow, oversized,
 * crashing into the top of each card) and a hairline that draws across the row
 * as the section scrolls into view.
 */
function HowItWorks({
  eyebrow,
  title,
  steps,
}: {
  eyebrow: string;
  title: string;
  steps: { step: string; title: string; desc: string }[];
}) {
  const ref = useScrollProgress<HTMLDivElement>();

  return (
    <section className="py-28 sm:py-36 px-5 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-20">
          <p className="text-[12px] font-medium text-primary-600 uppercase tracking-[0.22em] mb-4">
            {eyebrow}
          </p>
          <h2
            className="font-display font-semibold text-surface-950 tracking-[-0.01em] leading-[1.0]"
            style={{ fontSize: "clamp(36px, 5vw, 72px)" }}
          >
            <span className="text-gradient-sunrise">MyAstro360</span> {title}
          </h2>
        </div>

        <div ref={ref} className="relative">
          <div
            aria-hidden
            className="hidden md:block absolute top-[34%] left-[10%] right-[10%] h-px origin-left bg-gradient-to-r from-primary-500 via-sun-400 to-primary-500"
            style={{ transform: "scaleX(var(--scroll-progress, 1))" }}
          />

          <Stagger.Container className="grid md:grid-cols-3 gap-8 md:gap-10 relative">
            {steps.map((item) => (
              <Stagger.Item
                key={item.step}
                className="group relative rounded-2xl surface-card-hover shadow-warm-sm pt-16 px-7 pb-7"
              >
                <span
                  aria-hidden
                  className="font-display font-semibold leading-none absolute -top-6 sm:-top-8 -left-1 select-none pointer-events-none"
                  style={{
                    fontSize: "clamp(96px, 14vw, 180px)",
                    color: "transparent",
                    WebkitTextStroke: "1.5px var(--color-primary-500)",
                  }}
                >
                  {item.step}
                </span>
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-surface-950 mb-3 leading-tight relative z-10">
                  {item.title}
                </h3>
                <p className="text-sm text-emphasis leading-relaxed relative z-10">{item.desc}</p>
              </Stagger.Item>
            ))}
          </Stagger.Container>
        </div>
      </div>
    </section>
  );
}

/**
 * Primary CTA with a cursor-tracking glow positioned via CSS variables, so the
 * glow tracks the cursor without re-rendering. Falls back to a static glow on
 * touch / reduced-motion.
 */
function CtaPrimary({
  href,
  label,
  size = "md",
}: {
  href: string;
  label: string;
  size?: "md" | "lg";
}) {
  const padding = size === "lg" ? "px-9 py-4 text-[16px]" : "px-8 py-3.5 text-[15px]";

  const handleMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <Link
      href={href}
      onMouseMove={handleMove}
      className={`relative isolate inline-flex items-center justify-center font-semibold rounded-full overflow-hidden btn-primary shadow-warm-lg focus-ring ${padding}`}
      style={
        {
          "--mx": "50%",
          "--my": "50%",
        } as React.CSSProperties
      }
    >
      <span className="relative z-10">{label}</span>
      <span
        aria-hidden
        className="absolute inset-0 -z-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            "radial-gradient(220px circle at var(--mx) var(--my), rgba(255,253,250,0.32), transparent 70%)",
        }}
      />
    </Link>
  );
}
