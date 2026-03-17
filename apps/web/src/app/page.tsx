import Link from "next/link";

const features = [
  {
    title: "Astrologer Chat",
    description: "Get instant career, love, health, and finance guidance from expert astrologers trained on Vedic principles.",
    href: "/chat",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
      </svg>
    ),
  },
  {
    title: "Palmistry Reading",
    description: "Upload your palm photo for detailed analysis of life, heart, head, and fate lines with expert interpretations.",
    href: "/palmistry",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.05 4.575a1.575 1.575 0 1 0-3.15 0v3m3.15-3v-1.5a1.575 1.575 0 0 1 3.15 0v1.5m-3.15 0 .075 5.925m3.075.75V4.575m0 0a1.575 1.575 0 0 1 3.15 0V15M6.9 7.575a1.575 1.575 0 1 0-3.15 0v8.175a6.75 6.75 0 0 0 6.75 6.75h2.018a5.25 5.25 0 0 0 3.712-1.538l1.732-1.732a5.25 5.25 0 0 0 1.538-3.712l.003-2.024a.668.668 0 0 0-.67-.668 1.667 1.667 0 0 0-1.597 1.188l-.523 1.82" />
      </svg>
    ),
  },
  {
    title: "Kundli Generator",
    description: "Generate complete birth charts with planetary positions, Dasha periods, Yogas, and twelve-house analysis.",
    href: "/kundli",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
      </svg>
    ),
  },
  {
    title: "Daily Horoscope",
    description: "Personalized daily, weekly, monthly, and yearly horoscopes for all twelve zodiac signs.",
    href: "/horoscope",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
      </svg>
    ),
  },
  {
    title: "Kundli Matching",
    description: "Ashtakoota Guna Milan with compatibility scores, Manglik check, and detailed partner analysis.",
    href: "/matching",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
      </svg>
    ),
  },
  {
    title: "Muhurat Finder",
    description: "Find auspicious dates and times for marriage, business, travel, property, and ceremonies.",
    href: "/muhurat",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    title: "Daily Panchang",
    description: "Complete Hindu calendar with Tithi, Nakshatra, Yoga, Karana, Rahu Kaal, and timings.",
    href: "/panchang",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    title: "Dosha Analysis",
    description: "Detect Kaal Sarp, Manglik, Pitru, Shani, and Grahan Dosha with personalized remedies.",
    href: "/kundli",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
  },
];

const stats = [
  { label: "Available", value: "24/7" },
  { label: "Response", value: "<2s" },
  { label: "Accuracy", value: "95%" },
  { label: "Users", value: "100K+" },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[88vh] flex items-center justify-center overflow-hidden">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary-900/10 via-surface-950 to-surface-950" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-600/[0.04] rounded-full blur-[120px]" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border divider bg-white/[0.03] text-xs text-white/50 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Vedic Astrology Platform
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
            Your stars,{" "}
            <span className="text-gradient">decoded by Jyotron</span>
          </h1>

          <p className="text-base sm:text-lg text-white/40 max-w-xl mx-auto mb-10 leading-relaxed">
            Instant, personalized Vedic astrology consultations. Kundli, palmistry, horoscopes, compatibility, and spiritual guidance — available 24/7.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
            <Link href="/chat" className="px-6 py-3 btn-primary rounded-xl text-sm">
              Start Consultation
            </Link>
            <Link href="/palmistry" className="px-6 py-3 btn-secondary rounded-xl text-sm">
              Try Palm Reading
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-xl font-bold text-white">{stat.value}</div>
                <div className="text-[11px] text-white/30 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
              Everything you need for{" "}
              <span className="text-gradient">spiritual guidance</span>
            </h2>
            <p className="text-sm text-white/40 max-w-lg mx-auto">
              Expert Vedic astrology, palmistry, and numerology guidance.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature) => (
              <Link
                key={feature.title}
                href={feature.href}
                className="group surface-card-hover p-5"
              >
                <div className="w-9 h-9 rounded-lg bg-primary-600/10 text-primary-400 flex items-center justify-center mb-4 group-hover:bg-primary-600/20 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-sm font-semibold text-white mb-1.5">
                  {feature.title}
                </h3>
                <p className="text-xs text-white/35 leading-relaxed">{feature.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 border-t divider">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
              How <span className="text-gradient">Jyotron</span> works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Create your profile", desc: "Enter birth details — date, time, and place for accurate calculations." },
              { step: "02", title: "Ask your question", desc: "Chat with expert astrologers or use Kundli, palmistry, and horoscope tools." },
              { step: "03", title: "Get insights", desc: "Receive instant, personalized predictions and remedies based on Vedic principles." },
            ].map((item) => (
              <div key={item.step} className="surface-card p-6">
                <div className="text-xs font-mono font-semibold text-primary-400 mb-3">{item.step}</div>
                <h3 className="text-sm font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-xs text-white/35 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 border-t divider">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 tracking-tight">
            Ready to explore your{" "}
            <span className="text-gradient">cosmic path</span>?
          </h2>
          <p className="text-sm text-white/40 mb-8">
            Join thousands getting daily astrology insights. Start with 3 free consultations.
          </p>
          <Link href="/auth?mode=signup" className="inline-block px-8 py-3 btn-primary rounded-xl text-sm">
            Get Started Free
          </Link>
        </div>
      </section>
    </div>
  );
}
