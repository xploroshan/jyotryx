"use client";

import React, { useState } from "react";

const zodiacSigns = [
  { id: "aries", name: "Aries", symbol: "\u2648", date: "Mar 21 - Apr 19", element: "Fire" },
  { id: "taurus", name: "Taurus", symbol: "\u2649", date: "Apr 20 - May 20", element: "Earth" },
  { id: "gemini", name: "Gemini", symbol: "\u264A", date: "May 21 - Jun 20", element: "Air" },
  { id: "cancer", name: "Cancer", symbol: "\u264B", date: "Jun 21 - Jul 22", element: "Water" },
  { id: "leo", name: "Leo", symbol: "\u264C", date: "Jul 23 - Aug 22", element: "Fire" },
  { id: "virgo", name: "Virgo", symbol: "\u264D", date: "Aug 23 - Sep 22", element: "Earth" },
  { id: "libra", name: "Libra", symbol: "\u264E", date: "Sep 23 - Oct 22", element: "Air" },
  { id: "scorpio", name: "Scorpio", symbol: "\u264F", date: "Oct 23 - Nov 21", element: "Water" },
  { id: "sagittarius", name: "Sagittarius", symbol: "\u2650", date: "Nov 22 - Dec 21", element: "Fire" },
  { id: "capricorn", name: "Capricorn", symbol: "\u2651", date: "Dec 22 - Jan 19", element: "Earth" },
  { id: "aquarius", name: "Aquarius", symbol: "\u2652", date: "Jan 20 - Feb 18", element: "Air" },
  { id: "pisces", name: "Pisces", symbol: "\u2653", date: "Feb 19 - Mar 20", element: "Water" },
];

const periods = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

const mockHoroscope: Record<string, { overview: string; love: string; career: string; health: string; lucky: { number: string; color: string; time: string } }> = {
  daily: {
    overview: "Today brings a surge of creative energy that can transform your approach to ongoing projects. The Moon's transit through your 5th house enhances your artistic sensibilities and romantic inclinations. You may find yourself drawn to new ideas and innovative solutions. The alignment of Venus and Jupiter suggests that social interactions will be particularly rewarding. Trust your instincts when making decisions, as your intuition is especially sharp right now.",
    love: "Romance is highlighted today with Venus forming a harmonious aspect to your sign. Singles may encounter an intriguing connection through a creative or social event. For those in relationships, this is an excellent time to plan a special evening or express your feelings openly. Communication flows easily, making it a perfect day for heart-to-heart conversations.",
    career: "Professional matters take a positive turn as Mercury aligns with Jupiter in your career sector. New opportunities for growth and advancement may present themselves. Your communication skills are enhanced, making this ideal for presentations, negotiations, or important meetings. A mentor or senior colleague may offer valuable guidance.",
    health: "Your energy levels are balanced today. Focus on creative outlets as a form of stress relief. A walk in nature or a yoga session can help center your mind. Pay attention to your diet and stay hydrated. The evening is favorable for meditation or journaling to process the day's experiences.",
    lucky: { number: "7, 14, 21", color: "Purple", time: "2:00 PM - 4:00 PM" },
  },
  weekly: {
    overview: "This week marks a significant turning point as several planetary alignments converge to create opportunities for personal and professional growth. The first half of the week is ideal for initiating new projects, while the latter days are better suited for reflection and planning. Mid-week brings an important revelation that could change your perspective on a long-standing matter.",
    love: "Relationship dynamics shift positively this week. Monday and Tuesday are excellent for romantic gestures. Wednesday may bring a minor disagreement, but it resolves quickly. The weekend is perfect for deepening emotional bonds and enjoying quality time together.",
    career: "Career momentum builds steadily throughout the week. Look for unexpected opportunities on Tuesday or Wednesday. Financial decisions made this week are well-starred, particularly around Thursday. Collaborative projects receive favorable cosmic energy.",
    health: "Focus on establishing a consistent routine this week. Monday is great for starting a new health regimen. Mid-week may bring minor fatigue - ensure adequate rest. The weekend offers excellent recuperative energy.",
    lucky: { number: "3, 11, 28", color: "Gold", time: "Thursday morning" },
  },
  monthly: {
    overview: "This month brings a powerful shift as the Sun moves through a transformative sector of your chart. The first two weeks emphasize personal development and self-discovery. A Full Moon mid-month illuminates your relationship sector, bringing clarity to partnerships. The final week is excellent for financial planning and setting long-term goals. Mars energizes your ambition sector, giving you the drive to pursue bold objectives.",
    love: "Love takes center stage this month, especially around the Full Moon period. New relationships started now have strong potential for longevity. Existing partnerships benefit from honest communication and shared goals. The last week brings romantic surprises.",
    career: "Professional life sees major developments. The first week is ideal for launching initiatives. Networking events mid-month open unexpected doors. Financial gains are likely in the third week. End the month by consolidating your achievements and planning ahead.",
    health: "Overall vitality improves as the month progresses. The New Moon period is perfect for detox and cleansing routines. Incorporate more outdoor activities during the second week. Stress levels may rise mid-month - practice mindfulness techniques.",
    lucky: { number: "5, 18, 31", color: "Emerald Green", time: "15th of the month" },
  },
  yearly: {
    overview: "2026 is a year of transformation and growth for your sign. Jupiter's transit through your wealth sector promises financial improvements and new income sources. Saturn continues its disciplining influence on your communication style, helping you become more precise and effective. The eclipses in March and September mark pivotal moments for career and personal evolution. The second half of the year is particularly strong for achieving long-held ambitions.",
    love: "The year starts with Venus blessing your love life through April. Summer brings a period of introspection about relationship needs. Autumn is the most romantic period, with potential for significant commitments. December brings warmth and celebration to partnerships.",
    career: "Career highlights arrive in April-May and September-October. A job change or promotion is likely in the first half. Creative fields are especially favored. The year ends with strong foundations laid for future success. International opportunities may arise mid-year.",
    health: "Focus on building sustainable health habits in Q1. Energy peaks during summer months. Autumn requires attention to stress management. End the year with a wellness retreat or renewed commitment to self-care. Overall, a year of improving health consciousness.",
    lucky: { number: "8, 22, 36", color: "Royal Blue", time: "September" },
  },
};

export default function HoroscopePage() {
  const [selectedSign, setSelectedSign] = useState("aries");
  const [selectedPeriod, setSelectedPeriod] = useState("daily");
  const [apiPrediction, setApiPrediction] = useState<string | null>(null);

  const sign = zodiacSigns.find((s) => s.id === selectedSign)!;
  const horoscope = mockHoroscope[selectedPeriod];

  // Fetch live horoscope from API for daily period
  React.useEffect(() => {
    if (selectedPeriod === "daily") {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/astrology/horoscope/${selectedSign}`)
        .then((res) => res.json())
        .then((data) => { if (data?.prediction) setApiPrediction(data.prediction); })
        .catch(() => setApiPrediction(null));
    } else {
      setApiPrediction(null);
    }
  }, [selectedSign, selectedPeriod]);

  const elementColor = (el: string) =>
    el === "Fire" ? "text-red-400" : el === "Earth" ? "text-emerald-400" : el === "Air" ? "text-sky-400" : "text-blue-400";

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 via-gray-950 to-gray-950" />
      <div className="absolute top-32 left-1/3 w-80 h-80 bg-accent-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-32 right-1/3 w-80 h-80 bg-primary-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-gray-300 mb-4">
            <span className="text-lg">{sign.symbol}</span>
            Vedic Horoscope
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4">
            Your <span className="text-gradient">Horoscope</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Personalized predictions based on Vedic astrology and current planetary transits.
          </p>
        </div>

        {/* Zodiac Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 mb-8">
          {zodiacSigns.map((z) => (
            <button
              key={z.id}
              onClick={() => setSelectedSign(z.id)}
              className={`flex flex-col items-center py-3 px-2 rounded-xl transition-all ${
                selectedSign === z.id
                  ? "glass bg-white/10 border-primary-500/50"
                  : "hover:bg-white/5"
              }`}
            >
              <span className="text-2xl mb-1">{z.symbol}</span>
              <span className={`text-xs font-medium ${selectedSign === z.id ? "text-white" : "text-gray-400"}`}>
                {z.name}
              </span>
            </button>
          ))}
        </div>

        {/* Selected Sign Info */}
        <div className="glass-card p-6 mb-8 flex flex-col sm:flex-row items-center gap-4">
          <div className="text-5xl">{sign.symbol}</div>
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-display font-bold text-white">{sign.name}</h2>
            <div className="flex flex-wrap gap-3 mt-1 justify-center sm:justify-start">
              <span className="text-sm text-gray-400">{sign.date}</span>
              <span className={`text-sm font-medium ${elementColor(sign.element)}`}>{sign.element}</span>
            </div>
          </div>
          <div className="sm:ml-auto">
            {/* Period Tabs */}
            <div className="flex gap-1 rounded-xl bg-white/5 p-1">
              {periods.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPeriod(p.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                    selectedPeriod === p.id
                      ? "bg-gradient-to-r from-primary-600 to-mystic-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Horoscope Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Overview */}
          <div className="lg:col-span-2 glass-card p-6">
            <h3 className="text-lg font-display font-bold text-gradient mb-4">
              {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} Overview
            </h3>
            <p className="text-gray-300 leading-relaxed">{apiPrediction || horoscope.overview}</p>
          </div>

          {/* Lucky */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-display font-bold text-accent-400 mb-4">Lucky Factors</h3>
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-xs text-gray-500 mb-1">Lucky Numbers</p>
                <p className="text-white font-semibold">{horoscope.lucky.number}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-xs text-gray-500 mb-1">Lucky Color</p>
                <p className="text-white font-semibold">{horoscope.lucky.color}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-xs text-gray-500 mb-1">Auspicious Time</p>
                <p className="text-white font-semibold">{horoscope.lucky.time}</p>
              </div>
            </div>
          </div>

          {/* Love */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">💞</span>
              <h3 className="font-display font-bold text-white">Love &amp; Relationships</h3>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{horoscope.love}</p>
          </div>

          {/* Career */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">💼</span>
              <h3 className="font-display font-bold text-white">Career &amp; Finance</h3>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{horoscope.career}</p>
          </div>

          {/* Health */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🏥</span>
              <h3 className="font-display font-bold text-white">Health &amp; Wellness</h3>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{horoscope.health}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
