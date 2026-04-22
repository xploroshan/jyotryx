import type { Locale, TranslationKeys } from "@/i18n";
import {
  translateNakshatra,
  translateVara,
  translatePaksha,
} from "@/i18n/panchang-terms";

export function getQualityLabel(quality: string, t: TranslationKeys): string {
  const map: Record<string, string> = {
    excellent: t.myDay.qualityExcellent,
    good: t.myDay.qualityGood,
    moderate: t.myDay.qualityModerate,
    challenging: t.myDay.qualityChallenging,
  };
  return map[quality] || quality;
}

export function translatePlanet(planet: string, t: TranslationKeys): string {
  const map: Record<string, string> = {
    Sun: t.myDay.sun, Moon: t.myDay.moon, Mars: t.myDay.mars,
    Mercury: t.myDay.mercury, Jupiter: t.myDay.jupiter,
    Venus: t.myDay.venus, Saturn: t.myDay.saturn,
  };
  return map[planet] || planet;
}

export function translateColor(color: string, t: TranslationKeys): string {
  const map: Record<string, string> = {
    'Ruby Red': t.myDay.colorRubyRed, 'Pearl White': t.myDay.colorPearlWhite,
    'Coral Red': t.myDay.colorCoralRed, 'Emerald Green': t.myDay.colorEmeraldGreen,
    'Golden Yellow': t.myDay.colorGoldenYellow, 'Diamond White': t.myDay.colorDiamondWhite,
    'Sapphire Blue': t.myDay.colorSapphireBlue,
  };
  return map[color] || color;
}

export function translateActivity(text: string, t: TranslationKeys): string {
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

export function translateRemedy(text: string, t: TranslationKeys): string {
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

function PROF_INSIGHT_MAP(t: TranslationKeys): Record<string, string> {
  return {
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
}

export function translateProfInsight(text: string, t: TranslationKeys): string {
  const map = PROF_INSIGHT_MAP(t);
  return map[text] || text;
}

export function translateTransitAlert(text: string, t: TranslationKeys): string {
  const map: Record<string, string> = {
    'Saturn Return period active — major career and life restructuring. Embrace discipline and long-term thinking.': t.myDay.transitSaturnReturn,
    'Jupiter Return cycle — expansion, growth, and new opportunities. Say yes to big possibilities.': t.myDay.transitJupiterReturn,
    'Rahu-Ketu axis shifting in your chart — expect unconventional opportunities and karmic turns this month.': t.myDay.transitRahuKetu,
  };
  return map[text] || text;
}

export function translateGreeting(greeting: string, t: TranslationKeys): string {
  const match = greeting.match(/^(Good Morning|Good Afternoon|Good Evening),\s*(.+)$/);
  if (!match) return greeting;
  const prefixMap: Record<string, string> = {
    'Good Morning': t.myDay.goodMorning,
    'Good Afternoon': t.myDay.goodAfternoon,
    'Good Evening': t.myDay.goodEvening,
  };
  return `${prefixMap[match[1]] || match[1]}, ${match[2]}`;
}

export function translateSummary(summary: string, t: TranslationKeys, locale: Locale = 'en'): string {
  let result = summary;
  const qualityMap: Record<string, string> = {
    'Stars align beautifully today — seize opportunities with confidence.': t.myDay.summaryExcellent,
    'A favorable day with positive energy supporting your endeavors.': t.myDay.summaryGood,
    'A balanced day — focus on steady progress rather than bold moves.': t.myDay.summaryModerate,
    'Navigate carefully today — patience and remedies will help you through.': t.myDay.summaryChallenging,
  };
  for (const [en, tr] of Object.entries(qualityMap)) {
    result = result.replace(en, tr);
  }

  // Replace any embedded profession-insight sentence (the backend appends one
  // to the summary) by scanning the translateProfInsight lookup table.
  for (const [en, tr] of Object.entries(PROF_INSIGHT_MAP(t))) {
    if (result.includes(en)) result = result.split(en).join(tr);
  }

  result = result.replace(/Today is/g, t.myDay.todayIs);
  result = result.replace(/ruled by/g, t.myDay.ruledBy);
  result = result.replace(/Nakshatra brings/g, t.myDay.nakshatraBrings);
  result = result.replace(/energy\./g, `${t.myDay.energy}.`);
  result = result.replace(/Current planetary hour is/g, t.myDay.currentHoraIs);
  result = result.replace(/\bhora\b/g, t.myDay.hora);

  // Vara with optional (Weekday) suffix: "Budhvaar (Wednesday)" → localized.
  result = result.replace(
    /\b(Ravivaar|Somvaar|Mangalvaar|Budhvaar|Guruvaar|Shukravaar|Shanivaar)(?:\s*\((Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\))?/g,
    (_m, a: string, b?: string) =>
      b ? translateVara(`${a} (${b})`, locale) : translateVara(a, locale),
  );
  // Bare weekday names.
  result = result.replace(
    /\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/g,
    (m) => translateVara(m, locale),
  );

  // Nakshatras.
  const nakshatraNames = [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
    'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni',
    'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha',
    'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana',
    'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
  ];
  for (const n of nakshatraNames) {
    result = result.replace(new RegExp(`\\b${n}\\b`, 'g'), translateNakshatra(n, locale));
  }

  // Paksha.
  result = result.replace(/\b(Shukla|Krishna)\s+Paksha\b/g, (m) => translatePaksha(m, locale));

  const planets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  for (const p of planets) {
    result = result.replace(new RegExp(`\\b${p}\\b`, 'g'), translatePlanet(p, t));
  }
  return result;
}
