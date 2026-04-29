"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/lib/store";
import { useTranslation } from "@/i18n";
import { Stagger } from "@/components/ui/PageTransition";

const BentoSummary = dynamic(() => import("@/components/home/BentoSummary"), {
  ssr: false,
});

export default function HomePage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { t } = useTranslation();

  const stats = [
    { label: t.home.available, value: "24/7" },
    { label: t.home.multiLanguage, value: "12" },
    { label: t.home.accuracy, value: "100%" },
    { label: t.home.users, value: "100K+" },
  ];

  return (
    <div>
      {/* ── Hero ── */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
        {/* Mesh gradient background */}
        <div className="absolute inset-0" aria-hidden>
          <div
            className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full opacity-60"
            style={{
              background: 'radial-gradient(circle, rgba(255,77,0,0.22) 0%, transparent 70%)',
              animation: 'mesh-drift 20s ease-in-out infinite',
            }}
          />
          <div
            className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full opacity-55"
            style={{
              background: 'radial-gradient(circle, rgba(255,122,64,0.18) 0%, transparent 70%)',
              animation: 'mesh-drift 25s ease-in-out infinite reverse',
            }}
          />
          <div
            className="absolute top-[30%] right-[20%] w-[40%] h-[40%] rounded-full opacity-50"
            style={{
              background: 'radial-gradient(circle, rgba(255,160,122,0.16) 0%, transparent 70%)',
              animation: 'mesh-drift 18s ease-in-out infinite 3s',
            }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-5 sm:px-8 text-center fade-in-up">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-900/[0.05] border border-surface-900/[0.08] text-[13px] text-surface-900/50 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {t.home.badge}
          </div>

          {/* Headline — Apple-style large type */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-surface-900 mb-6 leading-[1.05]">
            {t.home.heroTitle}
            <br />
            <span className="text-gradient">{t.home.heroHighlight}</span>
          </h1>

          <p className="text-lg sm:text-xl text-surface-900/65 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t.home.heroDescription}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
            <Link
              href="/chat"
              className="px-8 py-3.5 btn-primary rounded-full text-[15px] font-medium shadow-[0_0_24px_-4px_rgba(255,77,0,0.55)]"
            >
              {t.home.startConsultation}
            </Link>
            <Link
              href="/palmistry"
              className="px-8 py-3.5 btn-secondary rounded-full text-[15px]"
            >
              {t.home.tryPalmReading}
            </Link>
          </div>

          {/* Stats row */}
          <Stagger.Container className="flex justify-center gap-8 sm:gap-12">
            {stats.map((stat) => (
              <Stagger.Item key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-surface-900">{stat.value}</div>
                <div className="text-[11px] sm:text-xs text-surface-900/30 mt-1 uppercase tracking-wider">
                  {stat.label}
                </div>
              </Stagger.Item>
            ))}
          </Stagger.Container>
        </div>
      </section>

      {/* ── Bento summary ── */}
      <BentoSummary />

      {/* ── How it works ── */}
      <section className="py-24 sm:py-32 px-5 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <p className="text-[13px] font-medium text-primary-600 uppercase tracking-widest mb-3">
              How it works
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-surface-900 tracking-tight">
              {t.home.howItWorksTitle} <span className="text-gradient">Jyotron</span>{" "}
              {t.home.howItWorks}
            </h2>
          </div>

          <Stagger.Container className="grid md:grid-cols-3 gap-6">
            {[
              { step: "01", title: t.home.step01Title, desc: t.home.step01Desc },
              { step: "02", title: t.home.step02Title, desc: t.home.step02Desc },
              { step: "03", title: t.home.step03Title, desc: t.home.step03Desc },
            ].map((item) => (
              <Stagger.Item
                key={item.step}
                className="group relative rounded-2xl bg-surface-900/[0.02] border border-surface-900/[0.06] p-8 hover:bg-surface-900/[0.04] hover:border-surface-900/[0.1] hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="text-5xl font-bold text-surface-900/[0.04] mb-4 group-hover:text-primary-500/10 transition-colors">
                  {item.step}
                </div>
                <h3 className="text-base font-semibold text-surface-900 mb-3">{item.title}</h3>
                <p className="text-sm text-surface-900/65 leading-relaxed">{item.desc}</p>
              </Stagger.Item>
            ))}
          </Stagger.Container>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 sm:py-32 px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-surface-900 mb-5 tracking-tight">
            {t.home.ctaTitle}{" "}
            <span className="text-gradient">{t.home.ctaHighlight}</span>?
          </h2>
          <p className="text-base text-surface-900/65 mb-10 max-w-xl mx-auto">
            {isAuthenticated ? t.home.ctaLoggedIn : t.home.ctaLoggedOut}
          </p>
          <Link
            href={isAuthenticated ? "/my-day" : "/auth?mode=signup"}
            className="inline-block px-10 py-4 btn-primary rounded-full text-[15px] font-medium shadow-[0_0_24px_-4px_rgba(255,77,0,0.55)]"
          >
            {isAuthenticated ? t.home.ctaButtonLoggedIn : t.home.ctaButtonLoggedOut}
          </Link>
        </div>
      </section>
    </div>
  );
}
