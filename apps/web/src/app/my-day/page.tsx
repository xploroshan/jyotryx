"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useTranslation } from "@/i18n";
import type { TranslationKeys } from "@/i18n";

interface PlanetaryHour {
  planet: string;
  startTime: string;
  endTime: string;
  activities: string[];
  avoid: string[];
  isCurrent: boolean;
}

interface DailyBriefing {
  greeting: string;
  date: string;
  dayQuality: "excellent" | "good" | "moderate" | "challenging";
  summary: string;
  doList: string[];
  avoidList: string[];
  planetaryHours: PlanetaryHour[];
  currentHora: PlanetaryHour | null;
  luckyColor: string;
  luckyNumber: number;
  luckyTime: string;
  professionInsight: string;
  remedy: string;
  mantra: string;
  panchang: {
    tithi: string;
    nakshatra: string;
    yoga: string;
    vara: string;
    rahukaal: string;
  };
  transitAlert: string | null;
}

const QUALITY_STYLES = {
  excellent: { emoji: "\u2728", color: "text-emerald-400", ring: "ring-emerald-500/30", bg: "bg-emerald-500/10", bar: "bg-emerald-400", glow: "shadow-emerald-500/20", pct: 100 },
  good: { emoji: "\u2600\ufe0f", color: "text-sky-400", ring: "ring-sky-500/30", bg: "bg-sky-500/10", bar: "bg-sky-400", glow: "shadow-sky-500/20", pct: 75 },
  moderate: { emoji: "\u2696\ufe0f", color: "text-amber-400", ring: "ring-amber-500/30", bg: "bg-amber-500/10", bar: "bg-amber-400", glow: "shadow-amber-500/20", pct: 50 },
  challenging: { emoji: "\ud83c\udf19", color: "text-orange-400", ring: "ring-orange-500/30", bg: "bg-orange-500/10", bar: "bg-orange-400", glow: "shadow-orange-500/20", pct: 25 },
};

const planetIcons: Record<string, { symbol: string; color: string; bg: string }> = {
  Sun: { symbol: "\u2609", color: "text-amber-400", bg: "bg-amber-500/10" },
  Moon: { symbol: "\u263d", color: "text-slate-300", bg: "bg-slate-400/10" },
  Mars: { symbol: "\u2642", color: "text-red-400", bg: "bg-red-500/10" },
  Mercury: { symbol: "\u263f", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  Jupiter: { symbol: "\u2643", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  Venus: { symbol: "\u2640", color: "text-pink-400", bg: "bg-pink-500/10" },
  Saturn: { symbol: "\u2644", color: "text-indigo-400", bg: "bg-indigo-500/10" },
};

// Locale mapping for date formatting
const LOCALE_MAP: Record<string, string> = {
  en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', bn: 'bn-IN',
  mr: 'mr-IN', gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN',
  or: 'or-IN', as: 'as-IN',
};

function getQualityLabel(quality: string, t: TranslationKeys): string {
  const map: Record<string, string> = {
    excellent: t.myDay.qualityExcellent,
    good: t.myDay.qualityGood,
    moderate: t.myDay.qualityModerate,
    challenging: t.myDay.qualityChallenging,
  };
  return map[quality] || quality;
}

function translatePlanet(planet: string, t: TranslationKeys): string {
  const map: Record<string, string> = {
    Sun: t.myDay.sun, Moon: t.myDay.moon, Mars: t.myDay.mars,
    Mercury: t.myDay.mercury, Jupiter: t.myDay.jupiter,
    Venus: t.myDay.venus, Saturn: t.myDay.saturn,
  };
  return map[planet] || planet;
}

function translateColor(color: string, t: TranslationKeys): string {
  const map: Record<string, string> = {
    'Ruby Red': t.myDay.colorRubyRed, 'Pearl White': t.myDay.colorPearlWhite,
    'Coral Red': t.myDay.colorCoralRed, 'Emerald Green': t.myDay.colorEmeraldGreen,
    'Golden Yellow': t.myDay.colorGoldenYellow, 'Diamond White': t.myDay.colorDiamondWhite,
    'Sapphire Blue': t.myDay.colorSapphireBlue,
  };
  return map[color] || color;
}

function translateActivity(text: string, t: TranslationKeys): string {
  const map: Record<string, string> = {
    'Meet authority figures': t.myDay.actMeetAuthority,
    'Leadership decisions': t.myDay.actLeadershipDecisions,
    'Government work': t.myDay.actGovernmentWork,
    'Health routines': t.myDay.actHealthRoutines,
    'Presentations': t.myDay.actPresentations,
    'Creative work': t.myDay.actCreativeWork,
    'Client meetings': t.myDay.actClientMeetings,
    'Nurturing relationships': t.myDay.actNurturingRelationships,
    'Public-facing tasks': t.myDay.actPublicFacingTasks,
    'Short travel': t.myDay.actShortTravel,
    'Physical activities': t.myDay.actPhysicalActivities,
    'Debugging/problem-solving': t.myDay.actDebugging,
    'Competitive tasks': t.myDay.actCompetitiveTasks,
    'Negotiations': t.myDay.actNegotiations,
    'Property matters': t.myDay.actPropertyMatters,
    'Communication': t.myDay.actCommunication,
    'Writing': t.myDay.actWriting,
    'Coding': t.myDay.actCoding,
    'Trading': t.myDay.actTrading,
    'Learning': t.myDay.actLearning,
    'Emails': t.myDay.actEmails,
    'Data analysis': t.myDay.actDataAnalysis,
    'Teaching': t.myDay.actTeaching,
    'Mentoring': t.myDay.actMentoring,
    'Financial planning': t.myDay.actFinancialPlanning,
    'Spiritual practices': t.myDay.actSpiritualPractices,
    'Closing deals': t.myDay.actClosingDeals,
    'Investments': t.myDay.actInvestments,
    'Client relationships': t.myDay.actClientRelationships,
    'Creative campaigns': t.myDay.actCreativeCampaigns,
    'Buying/selling': t.myDay.actBuyingSelling,
    'Social media': t.myDay.actSocialMedia,
    'Design work': t.myDay.actDesignWork,
    'Networking': t.myDay.actNetworking,
    'Long-term planning': t.myDay.actLongTermPlanning,
    'Discipline tasks': t.myDay.actDisciplineTasks,
    'Refactoring code': t.myDay.actRefactoringCode,
    'Compliance work': t.myDay.actComplianceWork,
    'Auditing': t.myDay.actAuditing,
    'Research': t.myDay.actResearch,
    'Starting partnerships': t.myDay.avdStartingPartnerships,
    'Lending money': t.myDay.avdLendingMoney,
    'Risky investments': t.myDay.avdRiskyInvestments,
    'Major financial decisions': t.myDay.avdMajorFinancialDecisions,
    'Confrontations': t.myDay.avdConfrontations,
    'Surgery': t.myDay.avdSurgery,
    'Starting new partnerships': t.myDay.avdStartingNewPartnerships,
    'Signing agreements': t.myDay.avdSigningAgreements,
    'Calm discussions needed': t.myDay.avdCalmDiscussions,
    'Long-term commitments': t.myDay.avdLongTermCommitments,
    'Emotional decisions': t.myDay.avdEmotionalDecisions,
    'Property purchases': t.myDay.avdPropertyPurchases,
    'Risky speculation': t.myDay.avdRiskySpeculation,
    'Shortcuts': t.myDay.avdShortcuts,
    'Unethical actions': t.myDay.avdUnethicalActions,
    'Aggressive negotiations': t.myDay.avdAggressiveNegotiations,
    'Conflict resolution': t.myDay.avdConflictResolution,
    'Heavy physical work': t.myDay.avdHeavyPhysicalWork,
    'New beginnings': t.myDay.avdNewBeginnings,
    'Celebrations': t.myDay.avdCelebrations,
    'Impulsive decisions': t.myDay.avdImpulsiveDecisions,
    'Product launches': t.myDay.avdProductLaunches,
  };
  return map[text] || text;
}

function translateRemedy(text: string, t: TranslationKeys): string {
  const map: Record<string, string> = {
    'Offer water to the rising Sun while chanting Gayatri Mantra. Wear ruby or red clothes.': t.myDay.remedySun,
    'Drink water from a silver glass. Wear white or pearl. Practice Chandra Namaskar.': t.myDay.remedyMoon,
    'Recite Hanuman Chalisa. Donate red lentils. Wear coral or red thread.': t.myDay.remedyMars,
    'Chant Vishnu Sahasranama. Wear emerald green. Feed green vegetables to cows.': t.myDay.remedyMercury,
    'Visit a temple and offer yellow flowers. Wear yellow sapphire. Read scriptures.': t.myDay.remedyJupiter,
    'Offer white sweets to a young girl. Wear diamond or white clothes. Practice gratitude.': t.myDay.remedyVenus,
    'Light a sesame oil lamp. Donate black items. Serve the elderly. Wear blue sapphire.': t.myDay.remedySaturn,
  };
  return map[text] || text;
}

function translateProfInsight(text: string, t: TranslationKeys): string {
  const map: Record<string, string> = {
    'Strong day for architecture decisions and code reviews. Your technical leadership shines — present that proposal.': t.myDay.profSoftwareSun,
    'Creativity peaks today — ideal for UI/UX work, brainstorming features, and pair programming.': t.myDay.profSoftwareMoon,
    'High energy for debugging tough issues and performance optimization. Tackle that backlog.': t.myDay.profSoftwareMars,
    'Peak day for coding, documentation, and technical writing. Ship that PR. API integrations flow smoothly.': t.myDay.profSoftwareMercury,
    'Great for system design, learning new tech, and mentoring juniors. Think big-picture architecture.': t.myDay.profSoftwareJupiter,
    'Focus on developer experience, clean code, and collaboration. Good for team standups and demos.': t.myDay.profSoftwareVenus,
    'Ideal for refactoring, writing tests, fixing tech debt, and infrastructure work. Patience pays off.': t.myDay.profSoftwareSaturn,
    'Power day for pitching to CXOs and decision-makers. Your confidence is magnetic. Go for the close.': t.myDay.profSalesSun,
    'Build rapport today — follow-up calls, client nurturing, and relationship building yield results.': t.myDay.profSalesMoon,
    'Competitive edge is sharp. Cold calls, objection handling, and negotiation favored. Push for targets.': t.myDay.profSalesMars,
    'Perfect for proposals, presentations, and email outreach. Data-driven pitches win today.': t.myDay.profSalesMercury,
    'Ideal for closing big deals and expanding accounts. Upsell opportunities arise naturally.': t.myDay.profSalesJupiter,
    'Charm and persuasion peak. Client entertainment, networking events, and referral requests favored.': t.myDay.profSalesVenus,
    'Focus on pipeline management, CRM updates, and strategic planning. Build foundations for Q targets.': t.myDay.profSalesSaturn,
    'Brand visibility peaks. Launch campaigns, press releases, or thought leadership content today.': t.myDay.profMarketingSun,
    'Emotional storytelling resonates. Social media engagement, content creation, and community building favored.': t.myDay.profMarketingMoon,
    'Aggressive growth tactics work — paid ads, competitive positioning, launch pushes.': t.myDay.profMarketingMars,
    'Data analysis, A/B testing, copywriting, and SEO optimization flow effortlessly today.': t.myDay.profMarketingMercury,
    'Think big — brand partnerships, influencer outreach, and campaign strategy sessions.': t.myDay.profMarketingJupiter,
    'Visual content, brand aesthetics, and creative campaigns shine. Design and photo shoots favored.': t.myDay.profMarketingVenus,
    'Marketing analytics, budget reviews, and long-term strategy. Optimize existing funnels.': t.myDay.profMarketingSaturn,
    'Government and PSU stocks favored. Leadership in financial decisions. Portfolio review day.': t.myDay.profFinanceSun,
    'Market sentiment sensitive — trust your instincts but set stop-losses. FMCG/healthcare sectors active.': t.myDay.profFinanceMoon,
    'Volatile energy — pharma/defense sectors active. Short-term trades possible but manage risk tightly.': t.myDay.profFinanceMars,
    'IT/tech stocks favored. Day trading conditions good. Data-driven analysis yields profit.': t.myDay.profFinanceMercury,
    'Banking/finance sectors strong. Long-term investments and mutual fund SIPs favored. Wealth grows.': t.myDay.profFinanceJupiter,
    'Luxury/entertainment/FMCG stocks favorable. Gold purchases auspicious. Portfolio diversification day.': t.myDay.profFinanceVenus,
    'Infrastructure/real estate sectors. Avoid speculation. Stick to blue-chips and value investing.': t.myDay.profFinanceSaturn,
    'Focus on subjects requiring confidence — presentations, vivas, competitive exams. Leadership roles.': t.myDay.profStudentSun,
    'Creative subjects shine — arts, literature, languages. Group study effective today.': t.myDay.profStudentMoon,
    'Math, science, and problem-solving peak. Physical exercise boosts mental clarity.': t.myDay.profStudentMars,
    'Best day for intense study — reading, note-taking, exam prep. Memory retention is high.': t.myDay.profStudentMercury,
    'Philosophy, law, and higher learning. Seek guidance from mentors. Career planning favored.': t.myDay.profStudentJupiter,
    'Creative arts, music, design studies excel. Social connections help academically.': t.myDay.profStudentVenus,
    'Revision and practice papers. Discipline in study schedule pays off. Focus on weak subjects.': t.myDay.profStudentSaturn,
    'Government dealings, licenses, and official work favored. Lead from the front.': t.myDay.profBusinessSun,
    'Customer relationships and team morale. Marketing and public-facing business activities.': t.myDay.profBusinessMoon,
    'Expansion moves, competitive strategies, and resource acquisition. Bold decisions pay off.': t.myDay.profBusinessMars,
    'Contracts, negotiations, accounting, and business communication. Finalize deals today.': t.myDay.profBusinessMercury,
    'Business growth, bank loans, investor meetings, and strategic partnerships. Abundance flows.': t.myDay.profBusinessJupiter,
    'Brand building, customer experience, and team celebrations. Retail and service businesses thrive.': t.myDay.profBusinessVenus,
    'Compliance, legal review, and operational efficiency. Build systems that last.': t.myDay.profBusinessSaturn,
    'Administrative decisions and leadership in clinical settings. Conference presentations.': t.myDay.profHealthcareSun,
    'Patient care and empathy peak. Counseling and holistic healing approaches effective.': t.myDay.profHealthcareMoon,
    'Surgical procedures and emergency medicine favored. Physical stamina is high.': t.myDay.profHealthcareMars,
    'Diagnostics, research, and medical documentation. Learning new techniques.': t.myDay.profHealthcareMercury,
    'Teaching, publishing research, and medical ethics. Seeking advanced certifications.': t.myDay.profHealthcareJupiter,
    'Wellness programs, patient relationships, and aesthetic medicine.': t.myDay.profHealthcareVenus,
    'Long-term treatment plans, chronic care management, and procedural discipline.': t.myDay.profHealthcareSaturn,
    'Showcase your work — exhibitions, portfolio reviews, public performances.': t.myDay.profCreativeSun,
    'Raw creativity flows. Writing, composing, painting — let intuition guide you.': t.myDay.profCreativeMoon,
    'Action-oriented creativity — filmmaking, dance, physical performance art.': t.myDay.profCreativeMars,
    'Technical craft — editing, design software, writing drafts, musical arrangements.': t.myDay.profCreativeMercury,
    'Vision and inspiration. Start ambitious projects. Seek creative mentors.': t.myDay.profCreativeJupiter,
    'Peak creative day. Beauty, aesthetics, and artistic expression at their finest.': t.myDay.profCreativeVenus,
    'Craft discipline — practice, revision, and perfecting technique.': t.myDay.profCreativeSaturn,
    'Official decisions, policy matters, and public appearances favored.': t.myDay.profGovernmentSun,
    'Public engagement, welfare programs, and community outreach.': t.myDay.profGovernmentMoon,
    'Enforcement, compliance, and administrative restructuring.': t.myDay.profGovernmentMars,
    'Documentation, communication, and inter-departmental coordination.': t.myDay.profGovernmentMercury,
    'Policy planning, judicial matters, and governance improvements.': t.myDay.profGovernmentJupiter,
    'Cultural events, public relations, and diplomatic engagements.': t.myDay.profGovernmentVenus,
    'Audits, reviews, and systemic improvements. Long-term project milestones.': t.myDay.profGovernmentSaturn,
    'Take charge of your day. Leadership moments arise. Official work favored.': t.myDay.profOtherSun,
    'Nurture relationships and creative pursuits. Trust your emotional intelligence.': t.myDay.profOtherMoon,
    'Channel energy into challenging tasks. Physical activity boosts productivity.': t.myDay.profOtherMars,
    'Communication, analysis, and learning peak. Best day for emails and planning.': t.myDay.profOtherMercury,
    'Growth and expansion. Financial planning and mentorship favored.': t.myDay.profOtherJupiter,
    'Social connections, aesthetics, and collaborative work thrive.': t.myDay.profOtherVenus,
    'Discipline and long-term planning. Focus on building lasting foundations.': t.myDay.profOtherSaturn,
    'Focus on your core strengths today.': t.myDay.focusOnStrengths,
  };
  return map[text] || text;
}

function translateTransitAlert(text: string, t: TranslationKeys): string {
  const map: Record<string, string> = {
    'Saturn Return period active — major career and life restructuring. Embrace discipline and long-term thinking.': t.myDay.transitSaturnReturn,
    'Jupiter Return cycle — expansion, growth, and new opportunities. Say yes to big possibilities.': t.myDay.transitJupiterReturn,
    'Rahu-Ketu axis shifting in your chart — expect unconventional opportunities and karmic turns this month.': t.myDay.transitRahuKetu,
  };
  return map[text] || text;
}

function translateGreeting(greeting: string, t: TranslationKeys): string {
  // Greeting format: "Good Morning, Name!" — translate the prefix, keep the name
  const match = greeting.match(/^(Good Morning|Good Afternoon|Good Evening),\s*(.+)$/);
  if (!match) return greeting;
  const prefixMap: Record<string, string> = {
    'Good Morning': t.myDay.goodMorning,
    'Good Afternoon': t.myDay.goodAfternoon,
    'Good Evening': t.myDay.goodEvening,
  };
  return `${prefixMap[match[1]] || match[1]}, ${match[2]}`;
}

function translateSummary(summary: string, t: TranslationKeys): string {
  // The summary is composed of known fragments — translate each part
  let result = summary;
  // Quality descriptions
  const qualityMap: Record<string, string> = {
    'Stars align beautifully today — seize opportunities with confidence.': t.myDay.summaryExcellent,
    'A favorable day with positive energy supporting your endeavors.': t.myDay.summaryGood,
    'A balanced day — focus on steady progress rather than bold moves.': t.myDay.summaryModerate,
    'Navigate carefully today — patience and remedies will help you through.': t.myDay.summaryChallenging,
  };
  for (const [en, tr] of Object.entries(qualityMap)) {
    result = result.replace(en, tr);
  }
  // "Today is X ruled by Y" pattern
  result = result.replace(/Today is/g, t.myDay.todayIs);
  result = result.replace(/ruled by/g, t.myDay.ruledBy);
  result = result.replace(/Nakshatra brings/g, t.myDay.nakshatraBrings);
  result = result.replace(/energy\./g, `${t.myDay.energy}.`);
  result = result.replace(/Current planetary hour is/g, t.myDay.currentHoraIs);
  result = result.replace(/hora/g, t.myDay.hora);
  // Translate planet names in summary
  const planets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  for (const p of planets) {
    result = result.replace(new RegExp(`\\b${p}\\b`, 'g'), translatePlanet(p, t));
  }
  // Translate profession insight portion if embedded
  result = translateProfInsight(result, t) !== result ? translateProfInsight(result, t) : result;
  return result;
}

export default function MyDayPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { isAuthenticated, accessToken } = useAuthStore();
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllHours, setShowAllHours] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }
    fetchBriefing();
  }, [isAuthenticated]);

  const fetchBriefing = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<DailyBriefing>(`/daily-briefing?locale=${locale}`, { token: accessToken! });
      setBriefing(data);
    } catch (err: any) {
      setError(err.message || "Failed to load daily briefing");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-primary-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary-500 animate-spin" />
            <div className="absolute inset-3 rounded-full border border-accent-500/20" />
            <div className="absolute inset-3 rounded-full border border-transparent border-t-accent-400 animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
          </div>
          <p className="text-white/40 text-sm">{t.myDay.readingStars}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="surface-card p-8 text-center max-w-md">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-red-400 mb-1 text-sm font-medium">{t.myDay.somethingWrong}</p>
          <p className="text-white/40 text-xs mb-5">{error}</p>
          <button onClick={fetchBriefing} className="px-6 py-2.5 btn-primary rounded-xl text-sm">{t.myDay.tryAgain}</button>
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  const qs = QUALITY_STYLES[briefing.dayQuality];
  const currentIdx = briefing.planetaryHours.findIndex((h) => h.isCurrent);
  const visibleHours = showAllHours
    ? briefing.planetaryHours
    : briefing.planetaryHours.filter((_, i) => i >= Math.max(0, currentIdx - 1) && i <= currentIdx + 4);

  const dateLocale = LOCALE_MAP[locale] || 'en-IN';

  return (
    <div className="min-h-screen bg-surface-950">
      {/* ── Hero Section ── */}
      <div className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary-600/8 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary-500/5 rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-4 pt-8 pb-6 sm:pt-12 sm:pb-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-primary-400/80 tracking-widest uppercase mb-2">
                {new Date(briefing.date).toLocaleDateString(dateLocale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
                {translateGreeting(briefing.greeting, t)}
              </h1>
            </div>

            {/* Day Quality Badge */}
            <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl ${qs.bg} ring-1 ${qs.ring} self-start sm:self-auto`}>
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl leading-none">{qs.emoji}</span>
              </div>
              <div>
                <p className={`text-sm font-semibold ${qs.color}`}>{getQualityLabel(briefing.dayQuality, t)}</p>
                <div className="mt-1.5 w-24 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className={`h-full rounded-full ${qs.bar} transition-all duration-1000`} style={{ width: `${qs.pct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-16">
        {/* ── Summary ── */}
        <div className="relative mb-8 p-6 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.02] border border-white/[0.06]">
          <div className="absolute top-4 left-4 w-1 h-8 rounded-full bg-gradient-to-b from-primary-500 to-accent-500" />
          <p className="text-white/80 leading-relaxed pl-4 text-[15px]">{translateSummary(briefing.summary, t)}</p>
        </div>

        {/* ── Transit Alert ── */}
        {briefing.transitAlert && (
          <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-purple-500/8 to-fuchsia-500/5 border border-purple-500/15">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-purple-300 mb-1">{t.myDay.planetaryTransit}</p>
                <p className="text-sm text-purple-200/60 leading-relaxed">{translateTransitAlert(briefing.transitAlert, t)}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Do & Avoid ── */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white">{t.myDay.favorableToday}</h3>
            </div>
            <ul className="space-y-2.5">
              {briefing.doList.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white/60">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500/50 shrink-0" />
                  {translateActivity(item, t)}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white">{t.myDay.bestToAvoid}</h3>
            </div>
            <ul className="space-y-2.5">
              {briefing.avoidList.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white/60">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-500/50 shrink-0" />
                  {translateActivity(item, t)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Profession Insight ── */}
        <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-primary-600/8 to-transparent border border-primary-500/10">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-500/15 flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-primary-400 mb-1">{t.myDay.careerWork}</h3>
              <p className="text-sm text-white/60 leading-relaxed">{translateProfInsight(briefing.professionInsight, t)}</p>
            </div>
          </div>
        </div>

        {/* ── Current Hora + Lucky Stats ── */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {briefing.currentHora && (
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">{t.myDay.currentHora}</h3>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl ${planetIcons[briefing.currentHora.planet]?.bg || "bg-white/[0.06]"} flex items-center justify-center`}>
                  <span className={`text-2xl ${planetIcons[briefing.currentHora.planet]?.color || "text-white/60"}`}>
                    {planetIcons[briefing.currentHora.planet]?.symbol || "\u25cb"}
                  </span>
                </div>
                <div className="flex-1">
                  <p className={`text-lg font-bold ${planetIcons[briefing.currentHora.planet]?.color || "text-white"}`}>
                    {translatePlanet(briefing.currentHora.planet, t)}
                  </p>
                  <p className="text-xs text-white/30 mt-0.5">
                    {briefing.currentHora.startTime} – {briefing.currentHora.endTime}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/[0.06]">
                <p className="text-xs text-white/30 mb-1">{t.myDay.bestFor}</p>
                <div className="flex flex-wrap gap-1.5">
                  {briefing.currentHora.activities.map((a, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-white/[0.04] text-[11px] text-white/50">{translateActivity(a, t)}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">{t.myDay.luckyToday}</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-orange-500/20 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-400 to-orange-400" />
                </div>
                <div>
                  <p className="text-[11px] text-white/30 uppercase tracking-wider">{t.myDay.color}</p>
                  <p className="text-sm text-white font-medium">{translateColor(briefing.luckyColor, t)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center">
                  <span className="text-accent-400 font-bold text-lg">{briefing.luckyNumber}</span>
                </div>
                <div>
                  <p className="text-[11px] text-white/30 uppercase tracking-wider">{t.myDay.number}</p>
                  <p className="text-sm text-white font-medium">{briefing.luckyNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] text-white/30 uppercase tracking-wider">{t.myDay.bestTime}</p>
                  <p className="text-sm text-white font-medium">{briefing.luckyTime}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Planetary Hours Timeline ── */}
        <div className="mb-8 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">{t.myDay.planetaryHours}</h3>
            <button
              onClick={() => setShowAllHours(!showAllHours)}
              className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
            >
              {showAllHours ? t.myDay.showRelevant : t.myDay.viewAll24}
            </button>
          </div>
          <div className="space-y-1.5">
            {visibleHours.map((hour, i) => {
              const pi = planetIcons[hour.planet] || { symbol: "\u25cb", color: "text-white/60", bg: "bg-white/[0.04]" };
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    hour.isCurrent
                      ? "bg-primary-600/10 ring-1 ring-primary-500/25"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg ${pi.bg} flex items-center justify-center shrink-0`}>
                    <span className={`text-sm ${pi.color}`}>{pi.symbol}</span>
                  </div>
                  <span className={`text-sm font-medium w-16 ${pi.color}`}>{translatePlanet(hour.planet, t)}</span>
                  <span className="text-xs text-white/25 w-28 tabular-nums">
                    {hour.startTime} – {hour.endTime}
                  </span>
                  <span className="text-xs text-white/40 flex-1 hidden sm:block">
                    {hour.activities.slice(0, 2).map(a => translateActivity(a, t)).join(", ")}
                  </span>
                  {hour.isCurrent && (
                    <span className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-500/15 text-primary-300">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-50" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-400" />
                      </span>
                      <span className="text-[10px] font-semibold tracking-wide">{t.myDay.now}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Panchang ── */}
        <div className="mb-8 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">{t.myDay.todaysPanchang}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: t.myDay.tithi, value: briefing.panchang.tithi, icon: "\ud83c\udf19" },
              { label: t.myDay.nakshatraLabel, value: briefing.panchang.nakshatra, icon: "\u2b50" },
              { label: t.myDay.yoga, value: briefing.panchang.yoga, icon: "\ud83e\uddd8" },
              { label: t.myDay.day, value: briefing.panchang.vara, icon: "\ud83d\udcc5" },
              { label: t.myDay.rahuKaal, value: briefing.panchang.rahukaal, icon: "\u26a0\ufe0f" },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.04] text-center">
                <p className="text-lg mb-1">{item.icon}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{item.label}</p>
                <p className="text-xs text-white/70 font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Remedy & Mantra ── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-accent-500/8 to-transparent border border-accent-500/10">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent-500/15 flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-accent-400 mb-1.5">{t.myDay.todaysRemedy}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{translateRemedy(briefing.remedy, t)}</p>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-primary-600/8 to-accent-500/5 border border-white/[0.06] flex flex-col items-center justify-center text-center">
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">{t.myDay.todaysMantra}</h3>
            <p className="text-xl sm:text-2xl text-white/90 font-semibold leading-relaxed tracking-wide">
              {briefing.mantra}
            </p>
            <div className="mt-3 w-12 h-px bg-gradient-to-r from-transparent via-accent-500/40 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
