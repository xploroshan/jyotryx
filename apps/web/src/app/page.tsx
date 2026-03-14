import Link from "next/link";

const features = [
  {
    title: "AI Astrologer Chat",
    description: "Get instant answers about career, love, health, and finance from specialized AI astrologers trained on Vedic astrology.",
    href: "/chat",
    icon: "💬",
    gradient: "from-primary-500 to-pink-500",
  },
  {
    title: "Palmistry Reading",
    description: "Upload your palm photo and get an AI-powered analysis of your life line, heart line, fate line, and more.",
    href: "/palmistry",
    icon: "🤚",
    gradient: "from-accent-500 to-orange-500",
  },
  {
    title: "Kundli Generator",
    description: "Generate your complete birth chart with planetary positions, Dasha periods, Yogas, and house analysis.",
    href: "/kundli",
    icon: "🪐",
    gradient: "from-mystic-500 to-blue-500",
  },
  {
    title: "Daily Horoscope",
    description: "Personalized daily, weekly, monthly, and yearly horoscopes based on your zodiac sign and birth chart.",
    href: "/horoscope",
    icon: "⭐",
    gradient: "from-yellow-500 to-accent-500",
  },
  {
    title: "Kundli Matching",
    description: "Check marriage compatibility with Ashtakoota Guna Milan, Manglik Dosha check, and detailed analysis.",
    href: "/matching",
    icon: "💞",
    gradient: "from-red-500 to-primary-500",
  },
  {
    title: "Muhurat Finder",
    description: "Find the most auspicious dates and times for marriage, business, travel, property, and ceremonies.",
    href: "/muhurat",
    icon: "📅",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    title: "Daily Panchang",
    description: "Complete Hindu calendar with Tithi, Nakshatra, Yoga, Karana, Rahu Kaal, and auspicious timings.",
    href: "/panchang",
    icon: "🕉️",
    gradient: "from-amber-500 to-yellow-500",
  },
  {
    title: "Dosha Analysis",
    description: "Detect Kaal Sarp, Manglik, Pitru, Shani, and Grahan Dosha with personalized remedies.",
    href: "/kundli",
    icon: "🔮",
    gradient: "from-violet-500 to-mystic-500",
  },
];

const stats = [
  { label: "AI Consultations", value: "24/7" },
  { label: "Response Time", value: "<2s" },
  { label: "Accuracy Rate", value: "95%" },
  { label: "Happy Users", value: "100K+" },
];

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-900/20 via-gray-950 to-gray-950" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-mystic-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-gray-300 mb-8">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            AI-Powered Astrology Platform
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold mb-6">
            Your Stars, <span className="text-gradient">Decoded by AI</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Get instant, personalized astrology consultations with AI astrologers.
            Palmistry, Kundli, horoscopes, compatibility matching, and spiritual
            guidance — available 24/7.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/chat"
              className="px-8 py-4 bg-gradient-to-r from-primary-600 to-mystic-600 text-white rounded-xl text-lg font-semibold hover:from-primary-500 hover:to-mystic-500 transition-all glow"
            >
              Chat with AI Astrologer
            </Link>
            <Link
              href="/palmistry"
              className="px-8 py-4 glass text-white rounded-xl text-lg font-semibold hover:bg-white/10 transition-all"
            >
              Try Palm Reading
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="glass-card p-4">
                <div className="text-2xl font-bold text-gradient">{stat.value}</div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
              Everything You Need for <span className="text-gradient">Spiritual Guidance</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Powered by advanced AI trained on Vedic astrology, palmistry, and numerology knowledge bases.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <Link key={feature.title} href={feature.href} className="group glass-card p-6 hover:bg-white/10 transition-all">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} mb-4 text-2xl`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-gradient transition-all">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-400">{feature.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 bg-gradient-to-b from-gray-950 via-primary-950/20 to-gray-950">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
              How <span className="text-gradient">Jyotryx</span> Works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Create Profile", desc: "Enter your birth details — date, time, and place of birth for accurate astrological calculations." },
              { step: "02", title: "Ask Your Question", desc: "Chat with specialized AI astrologers or use features like Kundli, palmistry, and horoscopes." },
              { step: "03", title: "Get AI Insights", desc: "Receive instant, personalized predictions and remedies based on Vedic astrology principles." },
            ].map((item) => (
              <div key={item.step} className="glass-card p-8 text-center">
                <div className="text-4xl font-bold text-gradient mb-4">{item.step}</div>
                <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                <p className="text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-6">
            Ready to Discover Your <span className="text-gradient">Cosmic Path</span>?
          </h2>
          <p className="text-gray-400 mb-10 text-lg">
            Join thousands of users getting daily AI-powered astrology insights. Start with 3 free questions today.
          </p>
          <Link
            href="/auth?mode=signup"
            className="inline-block px-10 py-4 bg-gradient-to-r from-primary-600 to-mystic-600 text-white rounded-xl text-lg font-semibold hover:from-primary-500 hover:to-mystic-500 transition-all glow"
          >
            Get Started Free
          </Link>
        </div>
      </section>
    </div>
  );
}
