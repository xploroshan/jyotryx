"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/lib/store";
import { useTranslation } from "@/i18n";
import AstrologyAnimation from "@/components/ui/AstrologyAnimation";
import Orb3D from "@/components/ui/Orb3D";

// Skeleton-on-loading — so lazy-load. Renders a data-driven bento for
// authenticated users and a teaser bento for logged-out visitors.
const BentoSummary = dynamic(() => import("@/components/home/BentoSummary"), {
  ssr: false,
});

export default function HomePage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { t } = useTranslation();

  const stats = [
    { label: t.home.available, value: "24/7" },
    { label: t.home.response, value: "<2s" },
    { label: t.home.accuracy, value: "95%" },
    { label: t.home.users, value: "100K+" },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[72vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-900/10 via-surface-950 to-surface-950" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-600/[0.04] rounded-full blur-[120px]" />
        <AstrologyAnimation />

        <div className="relative z-10 mx-auto max-w-5xl px-4 flex flex-col lg:flex-row items-center gap-10 text-center lg:text-left">
          {/* Left: copy */}
          <div className="flex-1 order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-white/60 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {t.home.badge}
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
              {t.home.heroTitle}{" "}
              <span className="text-gradient">{t.home.heroHighlight}</span>
            </h1>

            <p className="text-base sm:text-lg text-white/50 max-w-xl mb-8 leading-relaxed">
              {t.home.heroDescription}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-10">
              <Link href="/chat" className="px-6 py-3 btn-primary rounded-xl text-sm">
                {t.home.startConsultation}
              </Link>
              <Link href="/palmistry" className="px-6 py-3 btn-secondary rounded-xl text-sm">
                {t.home.tryPalmReading}
              </Link>
            </div>

            <div className="grid grid-cols-4 gap-3 max-w-md mx-auto lg:mx-0">
              {stats.map((stat) => (
                <div key={stat.label} className="glass rounded-xl py-2.5 px-2 text-center">
                  <div className="text-lg font-bold text-white">{stat.value}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: 3D Orb */}
          <div className="flex-1 order-1 lg:order-2 grid place-items-center">
            <div className="relative">
              <Orb3D size={240} />
              {/* Orbiting glyphs */}
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 text-2xl"
                aria-hidden
              >
                ✨
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Bento summary — data-driven for auth users, teaser for logged out */}
      <BentoSummary />

      {/* How It Works */}
      <section className="py-20 px-4 border-t divider">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
              {t.home.howItWorksTitle} <span className="text-gradient">Jyotron</span>{" "}
              {t.home.howItWorks}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { step: "01", title: t.home.step01Title, desc: t.home.step01Desc },
              { step: "02", title: t.home.step02Title, desc: t.home.step02Desc },
              { step: "03", title: t.home.step03Title, desc: t.home.step03Desc },
            ].map((item) => (
              <div key={item.step} className="glass rounded-2xl p-6">
                <div className="text-xs font-mono font-semibold text-primary-400 mb-3">
                  {item.step}
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 border-t divider">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 tracking-tight">
            {t.home.ctaTitle}{" "}
            <span className="text-gradient">{t.home.ctaHighlight}</span>?
          </h2>
          <p className="text-sm text-white/50 mb-8">
            {isAuthenticated ? t.home.ctaLoggedIn : t.home.ctaLoggedOut}
          </p>
          <Link
            href={isAuthenticated ? "/my-day" : "/auth?mode=signup"}
            className="inline-block px-8 py-3 btn-primary rounded-xl text-sm"
          >
            {isAuthenticated ? t.home.ctaButtonLoggedIn : t.home.ctaButtonLoggedOut}
          </Link>
        </div>
      </section>
    </div>
  );
}
