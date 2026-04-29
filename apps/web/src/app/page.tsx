"use client";

import { useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useAuthStore } from "@/lib/store";
import { useTranslation } from "@/i18n";
import { Stagger } from "@/components/ui/PageTransition";
import HeroSun from "@/components/home/HeroSun";
import TraditionMarquee from "@/components/home/TraditionMarquee";
import Orb3D from "@/components/ui/Orb3D";

const BentoSummary = dynamic(() => import("@/components/home/BentoSummary"), {
  ssr: false,
});

/**
 * Splits a string into per-character motion spans for the hero headline.
 * Whitespace is preserved as a non-breaking space so the layout never
 * collapses mid-word; the actual text content of the heading remains
 * intact for screen readers via aria-label on the parent <h1>.
 */
function CharReveal({ text, baseDelay = 0 }: { text: string; baseDelay?: number }) {
  const reduce = useReducedMotion();
  const chars = Array.from(text);
  if (reduce) return <>{text}</>;
  return (
    <>
      {chars.map((c, i) => (
        <motion.span
          key={`${c}-${i}`}
          initial={{ y: 28, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            duration: 0.55,
            ease: [0.22, 1, 0.36, 1],
            delay: baseDelay + i * 0.025,
          }}
          className="inline-block whitespace-pre"
          aria-hidden
        >
          {c === " " ? " " : c}
        </motion.span>
      ))}
    </>
  );
}

export default function HomePage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { t } = useTranslation();
  const reduce = useReducedMotion();

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
          <div
            className="absolute top-[-10%] right-[-15%] w-[80%] h-[90%] rounded-full opacity-70"
            style={{
              background:
                "radial-gradient(circle, rgba(255,182,39,0.28) 0%, rgba(255,77,0,0.18) 40%, transparent 72%)",
              animation: reduce ? undefined : "mesh-drift 22s ease-in-out infinite",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 pt-12 sm:pt-16 lg:pt-24 pb-16 sm:pb-24">
          <div className="grid grid-cols-12 gap-y-10 lg:gap-x-8 items-center">
            {/* Headline column — sits FIRST on every viewport so the
                value prop never falls below the fold on mobile. The
                orb follows on small screens. */}
            <div className="col-span-12 lg:col-span-7 order-1">
              <p className="font-display italic text-[15px] sm:text-base text-primary-700 mb-6 sm:mb-8 tracking-wide">
                — {t.home.badge}
              </p>

              <h1
                aria-label={`${t.home.heroTitle} ${t.home.heroHighlight}`}
                className="font-display font-semibold text-surface-900 leading-[0.92] tracking-[-0.02em] mb-8"
                style={{ fontSize: "clamp(56px, 9vw, 144px)" }}
              >
                <span className="block">
                  <CharReveal text={t.home.heroTitle.replace(/[,.]?\s*$/, "")} />
                </span>
                <motion.span
                  initial={reduce ? false : { y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{
                    duration: 0.7,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.45,
                  }}
                  className="serif-italic accent-underline text-gradient-sunrise inline-block mt-1"
                >
                  {t.home.heroHighlight}
                </motion.span>
              </h1>

              <motion.p
                initial={reduce ? false : { y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.7 }}
                className="text-secondary text-[17px] sm:text-lg max-w-xl leading-relaxed mb-10"
              >
                {t.home.heroDescription}
              </motion.p>

              <motion.div
                initial={reduce ? false : { y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.85 }}
                className="flex flex-wrap items-center gap-6 sm:gap-8"
              >
                <CtaPrimary href="/chat" label={t.home.startConsultation} />
                <Link
                  href="/palmistry"
                  className="group inline-flex items-center gap-2 text-[15px] font-semibold text-surface-900 hover:text-primary-600 transition-colors focus-ring rounded"
                >
                  {t.home.tryPalmReading}
                  <span
                    aria-hidden
                    className="inline-block transition-transform duration-300 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
              </motion.div>
            </div>

            {/* Orb column — bleeds past the right gutter at lg+. On mobile
                the orb is shrunk and centered below the headline. */}
            <div className="col-span-12 lg:col-span-5 order-2 relative">
              <motion.div
                initial={reduce ? false : { scale: 0.85, opacity: 0 }}
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
          <Stagger.Container className="mt-16 sm:mt-20 grid grid-cols-2 sm:grid-cols-4 border-t border-surface-900/[0.08]">
            {stats.map((stat, i) => (
              <Stagger.Item
                key={stat.label}
                className={`flex items-baseline gap-3 py-5 ${
                  i > 0 ? "sm:border-l border-surface-900/[0.08]" : ""
                } ${i > 0 ? "sm:pl-6" : ""}`}
              >
                <span className="font-display font-semibold text-surface-900 text-3xl sm:text-4xl tabular-nums leading-none">
                  {stat.value}
                </span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-surface-900/55">
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

      {/* ── Closing CTA ── */}
      <section className="relative py-24 sm:py-32 px-5 sm:px-8 overflow-hidden">
        {/* Quiet sun echo top-right — ties the closing back to the hero.
            Hidden on small screens where it would crash into the headline. */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-8 right-6 sm:right-10 opacity-90 hidden md:block"
        >
          <Orb3D
            size={96}
            fromClass="from-sun-300/80"
            viaClass="via-primary-500/40"
            toClass="to-transparent"
          />
        </div>

        <div className="relative mx-auto max-w-3xl text-center">
          <h2
            className="font-display font-semibold text-surface-900 mb-6 tracking-[-0.01em] leading-[1.02]"
            style={{ fontSize: "clamp(40px, 6vw, 80px)" }}
          >
            {t.home.ctaTitle}{" "}
            <span className="serif-italic accent-underline text-gradient-sunrise">
              {t.home.ctaHighlight}
            </span>
            ?
          </h2>
          <p className="text-base sm:text-lg text-secondary mb-10 max-w-xl mx-auto leading-relaxed">
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
          <p className="text-[12px] font-medium text-primary-700 uppercase tracking-[0.22em] mb-4">
            {eyebrow}
          </p>
          <h2
            className="font-display font-semibold text-surface-900 tracking-[-0.01em] leading-[1.0]"
            style={{ fontSize: "clamp(36px, 5vw, 72px)" }}
          >
            <span className="serif-italic accent-underline text-gradient-sunrise">Jyotron</span>{" "}
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
                className="group relative rounded-2xl bg-surface-50 border border-surface-900/[0.08] shadow-warm-sm pt-16 px-7 pb-7 hover:-translate-y-1 hover:shadow-warm-lg hover:border-surface-900/[0.14] transition-all duration-300"
              >
                {/* Hollow editorial numeral — breaks out of the card top-left.
                    The transparent fill + webkit-text-stroke gives the
                    architectural look without needing a background image. */}
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
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-surface-900 mb-3 leading-tight relative z-10">
                  {item.title}
                </h3>
                <p className="text-sm text-secondary leading-relaxed relative z-10">{item.desc}</p>
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
