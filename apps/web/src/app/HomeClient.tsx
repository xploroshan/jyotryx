"use client";

import { useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useAuthStore } from "@/lib/store";
import { useTranslation } from "@/i18n";
import { usePricingConfig } from "@/lib/usePricingConfig";
import { Stagger } from "@/components/ui/PageTransition";
import HeroSun from "@/components/home/HeroSun";
import TraditionMarquee from "@/components/home/TraditionMarquee";
import Orb3D from "@/components/ui/Orb3D";

const BentoSummary = dynamic(() => import("@/components/home/BentoSummary"), {
  ssr: false,
});

/**
 * Renders a highlight phrase with the .accent-underline scoped to the
 * brand name "myastro360" only. Each fragment carries its own gradient
 * because `text-gradient-sunrise` clips background to text — putting it
 * on a parent leaves the children with `color: transparent` and no
 * gradient of their own (they go invisible). Brand string is locale-
 * stable; if a translation drops it for any reason the whole phrase
 * still renders with the gradient and no underline.
 */
function renderHighlight(text: string) {
  const BRAND = "myastro360";
  if (!text.includes(BRAND)) {
    return <span className="text-gradient-sunrise">{text}</span>;
  }
  // The italic Fraunces "J" has a generous ascender that gets clipped by the
  // headline above it when "myastro360" wraps onto a second line of its own.
  // To guarantee full visibility we render the brand on a forced new line
  // (display:block) with extra top spacing so the J's curl never collides
  // with the line above. The leading text fragment ("decoded by ") trims its
  // trailing space — without that trim the new-line block leaves a hanging
  // gap on the prior line.
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
  const reduce = useReducedMotion();
  // In Mode A (subscriptions off) the whole app is free — surface a "Free"
  // badge in the hero. Hidden once subscriptions are enabled.
  const { subscriptionsEnabled } = usePricingConfig();

  const stats = [
    { label: t.home.available, value: "24/7" },
    { label: t.home.multiLanguage, value: "12" },
    { label: t.home.accuracy, value: "100%" },
    { label: t.home.users, value: "100K+" },
  ];

  return (
    <div>
      {/* ── Hero — editorial-asymmetric grid ── */}
      <section className="relative overflow-hidden">
        {/* One large warm mesh blob behind the orb. We dropped the previous
            three-blob composition: a single, confident wash sells the warm
            atmosphere without competing with the sun for attention. */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          {/* Two warm washes — one behind the orb for depth, one low-left
              tying the section to the marquee strip below. Soft enough
              that black hero text still passes AAA on cream. */}
          <div
            className="absolute top-[-12%] right-[-18%] w-[85%] h-[95%] rounded-full opacity-90"
            style={{
              background:
                "radial-gradient(circle, rgba(255,182,39,0.36) 0%, rgba(255,77,0,0.22) 35%, transparent 70%)",
              animation: reduce ? undefined : "mesh-drift 22s ease-in-out infinite",
            }}
          />
          <div
            className="absolute bottom-[-20%] left-[-12%] w-[55%] h-[60%] rounded-full opacity-60"
            style={{
              background:
                "radial-gradient(circle, rgba(255,122,64,0.20) 0%, rgba(255,77,0,0.10) 40%, transparent 75%)",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 pt-12 sm:pt-16 lg:pt-24 pb-16 sm:pb-24">
          <div className="grid grid-cols-12 gap-y-10 lg:gap-x-8 items-center">
            {/* Headline column — sits FIRST on every viewport so the
                value prop never falls below the fold on mobile. The
                orb follows on small screens. */}
            <div className="col-span-12 lg:col-span-7 order-1">
              <p className="font-display italic text-[15px] sm:text-base text-primary-600 mb-6 sm:mb-8 tracking-wide">
                — {t.home.badge}
                {!subscriptionsEnabled && (
                  <span className="not-italic ml-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-0.5 align-middle text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                    ✨ 100% Free
                  </span>
                )}
              </p>

              <h1
                aria-label={`${t.home.heroTitle} ${t.home.heroHighlight}`}
                className="font-display font-semibold text-surface-950 leading-[1.0] tracking-[-0.02em] mb-8"
                style={{ fontSize: "clamp(56px, 9vw, 144px)" }}
              >
                {/* Static text + CSS slide-up (see .hero-rise): this is the LCP
                    element, so it must paint at first frame. Rendering the full
                    string (not per-character spans) also fixes Indic shaping. */}
                <span className="block leading-[0.94] hero-rise">
                  {t.home.heroTitle.replace(/[,.]?\s*$/, "")}
                </span>
                <span
                  className="serif-italic block mt-3 sm:mt-4 pb-[0.05em] leading-[1.05] hero-rise"
                  style={{ animationDelay: "0.1s" }}
                >
                  {/* The gradient lives per-fragment inside renderHighlight
                      (not on this parent) so the brand word stays visible
                      under bg-clip-text. The brand "myastro360" forces its own
                      block-level line inside renderHighlight so the italic
                      J ascender never gets clipped by the line above. */}
                  {renderHighlight(t.home.heroHighlight)}
                </span>
              </h1>

              <p
                className="text-emphasis text-[17px] sm:text-lg max-w-xl leading-relaxed mb-10 hero-rise"
                style={{ animationDelay: "0.18s" }}
              >
                {t.home.heroDescription}
              </p>

              <div
                className="flex flex-wrap items-center gap-6 sm:gap-8 hero-rise"
                style={{ animationDelay: "0.26s" }}
              >
                <CtaPrimary href="/chat" label={t.home.startConsultation} />
                <Link
                  href="/palmistry"
                  className="group inline-flex items-center gap-2 text-[15px] font-semibold text-surface-950 hover:text-primary-600 transition-colors focus-ring rounded-full px-5 py-2.5 btn-ghost"
                >
                  {t.home.tryPalmReading}
                  <span
                    aria-hidden
                    className="inline-block transition-transform duration-300 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
              </div>
            </div>

            {/* Orb column — bleeds past the right gutter at lg+. On mobile
                the orb is shrunk and centered below the headline. */}
            <div className="col-span-12 lg:col-span-5 order-2 relative">
              {/* Visible at first frame (opacity:1) so it never blocks LCP;
                  the subtle scale-in is composite-only, so no CLS. */}
              <motion.div
                initial={reduce ? false : { scale: 0.92, opacity: 1 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                className="relative mx-auto lg:translate-x-[6%] xl:translate-x-[10%]"
                style={{ width: "100%", maxWidth: "min(520px, 78vw)" }}
              >
                <HeroSun />
              </motion.div>
            </div>
          </div>

          {/* Stats — thin baseline strip, hairline dividers between items.
              Lives outside the grid so it spans full hero width regardless
              of whether the orb has bled. */}
          <Stagger.Container className="mt-16 sm:mt-20 grid grid-cols-2 sm:grid-cols-4 border-t hairline">
            {stats.map((stat, i) => (
              <Stagger.Item
                key={stat.label}
                className={`flex items-baseline gap-3 py-5 ${
                  i > 0 ? "sm:border-l hairline" : ""
                } ${i > 0 ? "sm:pl-6" : ""}`}
              >
                <span className="font-display font-semibold text-surface-950 text-3xl sm:text-4xl tabular-nums leading-none">
                  {stat.value}
                </span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-secondary">
                  {stat.label}
                </span>
              </Stagger.Item>
            ))}
          </Stagger.Container>
        </div>
      </section>

      {/* ── Tradition marquee — editorial signature strip between hero and
          authenticated bento. Decorative; labels are reachable via the
          TraditionRail in the chrome. ── */}
      <TraditionMarquee />

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

      {/* ── Closing CTA — sits on a soft sunrise wash that closes the page
          before the dark Footer anchor. Two corner orb echoes balance the
          headline rather than crowding one side. ── */}
      <section className="relative py-28 sm:py-36 px-5 sm:px-8 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 30%, rgba(255,182,39,0.18) 0%, rgba(255,77,0,0.08) 45%, transparent 75%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-10 right-6 sm:right-12 opacity-85 hidden md:block"
        >
          <Orb3D
            size={108}
            fromClass="from-sun-300/80"
            viaClass="via-primary-500/40"
            toClass="to-transparent"
          />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-12 left-6 sm:left-12 opacity-70 hidden md:block"
        >
          <Orb3D
            size={72}
            fromClass="from-primary-300/70"
            viaClass="via-sun-400/30"
            toClass="to-transparent"
          />
        </div>

        <div className="relative mx-auto max-w-3xl text-center">
          <h2
            className="font-display font-semibold text-surface-950 mb-6 tracking-[-0.01em] leading-[1.02]"
            style={{ fontSize: "clamp(40px, 6vw, 80px)" }}
          >
            {t.home.ctaTitle}{" "}
            <span className="serif-italic accent-underline text-gradient-sunrise">
              {t.home.ctaHighlight}
            </span>
            ?
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
 * How-it-works section with editorial breakout numerals (hollow, oversized,
 * crashing into the top of each card) and a hairline that draws across
 * the row as the section scrolls into view. The connector is hidden on
 * narrow viewports where the cards stack vertically.
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
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 80%", "end 60%"],
  });
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

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
            <span className="serif-italic accent-underline text-gradient-sunrise">myastro360</span>{" "}
            {title}
          </h2>
        </div>

        <div ref={ref} className="relative">
          {/* Scroll-driven hairline behind the row. Hidden on mobile where
              cards stack and the connector wouldn't make sense. */}
          <motion.div
            aria-hidden
            className="hidden md:block absolute top-[34%] left-[10%] right-[10%] h-px origin-left bg-gradient-to-r from-primary-500 via-sun-400 to-primary-500"
            style={{ scaleX: reduce ? 1 : lineScale }}
          />

          <Stagger.Container className="grid md:grid-cols-3 gap-8 md:gap-10 relative">
            {steps.map((item) => (
              <Stagger.Item
                key={item.step}
                className="group relative rounded-2xl surface-card-hover shadow-warm-sm pt-16 px-7 pb-7"
              >
                {/* Hollow editorial numeral — breaks out of the card top-left.
                    Transparent fill + webkit-text-stroke gives an architectural
                    look without needing a background image. */}
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
 * Primary CTA with a cursor-tracking glow. The radial gradient is positioned
 * via CSS variables (--mx, --my) updated on mousemove, so the glow tracks
 * the cursor without re-rendering. Falls back to a static glow on touch /
 * reduced-motion.
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
  const reduce = useReducedMotion();
  const padding = size === "lg" ? "px-9 py-4 text-[16px]" : "px-8 py-3.5 text-[15px]";

  const handleMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (reduce) return;
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
