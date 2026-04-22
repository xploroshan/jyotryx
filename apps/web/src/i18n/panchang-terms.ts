/**
 * Localized lookup tables for Panchang terms (tithis, nakshatras, yogas,
 * varas, pakshas), planet names, and color names.
 *
 * The backend returns canonical English strings for these fields because
 * they're technical Sanskrit terms that the offline engine also emits. The
 * frontend is responsible for rendering them in the user's script. We keep
 * these lookups separate from the main locale files so adding a new term
 * doesn't force an edit across 12 files — missing keys fall back to the
 * English input string, which matches previous behaviour.
 */
import type { Locale } from './index';

export type PanchangLocaleMap = {
  nakshatras?: Record<string, string>;
  tithis?: Record<string, string>;
  yogas?: Record<string, string>;
  varas?: Record<string, string>;
  paksha?: Record<string, string>;
  planets?: Record<string, string>;
  colors?: Record<string, string>;
  // Nakshatra quality phrases the backend embeds in the daily summary
  // (e.g. "Dhanishta Nakshatra brings prosperous and rhythmic energy").
  // Keyed by the exact English phrase for longest-first substring
  // replacement in `translateSummary`.
  nakshatraQualities?: Record<string, string>;
};

const HI: PanchangLocaleMap = {
  nakshatras: {
    Ashwini: 'अश्विनी', Bharani: 'भरणी', Krittika: 'कृत्तिका', Rohini: 'रोहिणी',
    Mrigashira: 'मृगशिरा', Ardra: 'आर्द्रा', Punarvasu: 'पुनर्वसु', Pushya: 'पुष्य',
    Ashlesha: 'आश्लेषा', Magha: 'मघा',
    'Purva Phalguni': 'पूर्व फाल्गुनी', 'Uttara Phalguni': 'उत्तर फाल्गुनी',
    Hasta: 'हस्त', Chitra: 'चित्रा', Swati: 'स्वाति', Vishakha: 'विशाखा',
    Anuradha: 'अनुराधा', Jyeshtha: 'ज्येष्ठा', Mula: 'मूल',
    'Purva Ashadha': 'पूर्वाषाढ़ा', 'Uttara Ashadha': 'उत्तराषाढ़ा',
    Shravana: 'श्रवण', Dhanishta: 'धनिष्ठा', Shatabhisha: 'शतभिषा',
    'Purva Bhadrapada': 'पूर्व भाद्रपद', 'Uttara Bhadrapada': 'उत्तर भाद्रपद',
    Revati: 'रेवती',
  },
  tithis: {
    Pratipada: 'प्रतिपदा', Dwitiya: 'द्वितीया', Tritiya: 'तृतीया',
    Chaturthi: 'चतुर्थी', Panchami: 'पंचमी', Shashthi: 'षष्ठी',
    Saptami: 'सप्तमी', Ashtami: 'अष्टमी', Navami: 'नवमी', Dashami: 'दशमी',
    Ekadashi: 'एकादशी', Dwadashi: 'द्वादशी', Trayodashi: 'त्रयोदशी',
    Chaturdashi: 'चतुर्दशी', Purnima: 'पूर्णिमा', Amavasya: 'अमावस्या',
  },
  yogas: {
    Vishkambha: 'विष्कम्भ', Priti: 'प्रीति', Ayushman: 'आयुष्मान',
    Saubhagya: 'सौभाग्य', Shobhana: 'शोभन', Atiganda: 'अतिगण्ड',
    Sukarman: 'सुकर्मा', Dhriti: 'धृति', Shula: 'शूल', Ganda: 'गण्ड',
    Vriddhi: 'वृद्धि', Dhruva: 'ध्रुव', Vyaghata: 'व्याघात',
    Harshana: 'हर्षण', Vajra: 'वज्र', Siddhi: 'सिद्धि', Vyatipata: 'व्यतीपात',
    Variyan: 'वरीयान्', Parigha: 'परिघ', Shiva: 'शिव', Siddha: 'सिद्ध',
    Sadhya: 'साध्य', Shubha: 'शुभ', Shukla: 'शुक्ल', Brahma: 'ब्रह्म',
    Indra: 'इन्द्र', Vaidhriti: 'वैधृति',
  },
  varas: {
    Ravivaar: 'रविवार', Somvaar: 'सोमवार', Mangalvaar: 'मंगलवार',
    Budhvaar: 'बुधवार', Guruvaar: 'गुरुवार', Shukravaar: 'शुक्रवार',
    Shanivaar: 'शनिवार',
    Sunday: 'रविवार', Monday: 'सोमवार', Tuesday: 'मंगलवार',
    Wednesday: 'बुधवार', Thursday: 'गुरुवार', Friday: 'शुक्रवार',
    Saturday: 'शनिवार',
  },
  paksha: {
    Shukla: 'शुक्ल', Krishna: 'कृष्ण',
    'Shukla Paksha': 'शुक्ल पक्ष', 'Krishna Paksha': 'कृष्ण पक्ष',
  },
  planets: {
    Sun: 'सूर्य', Moon: 'चंद्र', Mars: 'मंगल', Mercury: 'बुध',
    Jupiter: 'बृहस्पति', Venus: 'शुक्र', Saturn: 'शनि',
    Rahu: 'राहु', Ketu: 'केतु',
  },
  colors: {
    'Ruby Red': 'रूबी लाल', 'Pearl White': 'मोती सफेद',
    'Coral Red': 'मूंगा लाल', 'Emerald Green': 'पन्ना हरा',
    'Golden Yellow': 'सुनहरा पीला', 'Diamond White': 'हीरा सफेद',
    'Sapphire Blue': 'नीलम नीला', 'Dark Blue': 'गहरा नीला',
    Gold: 'सुनहरा', Orange: 'नारंगी', White: 'सफेद', Silver: 'चांदी',
    Yellow: 'पीला', Purple: 'बैंगनी', Blue: 'नीला', Grey: 'ग्रे',
    Green: 'हरा', Pink: 'गुलाबी', Violet: 'बैंगनी', Black: 'काला',
    Red: 'लाल', Saffron: 'केसरिया',
  },
  // These mirror the 27-entry table in apps/api getNakshatraQuality().
  // Update both together when a phrase changes.
  nakshatraQualities: {
    'swift and healing': 'तीव्र और उपचारात्मक',
    'transformative': 'परिवर्तनकारी',
    'purifying and sharp': 'शुद्धिकारक और तीक्ष्ण',
    'creative and nurturing': 'रचनात्मक और पोषक',
    'curious and seeking': 'जिज्ञासु और खोजी',
    'intense and cleansing': 'तीव्र और शुद्धिकारक',
    'renewing and optimistic': 'नवीनीकारक और आशावादी',
    'nourishing and auspicious': 'पोषक और शुभ',
    'mystical and introspective': 'रहस्यमय और आत्मनिरीक्षी',
    'regal and ancestral': 'राजसी और पैतृक',
    'pleasurable and creative': 'सुखद और रचनात्मक',
    'generous and supportive': 'उदार और सहायक',
    'skillful and productive': 'कुशल और उत्पादक',
    'artistic and brilliant': 'कलात्मक और तेजस्वी',
    'independent and adaptable': 'स्वतंत्र और अनुकूलनीय',
    'determined and goal-oriented': 'दृढ़ और लक्ष्य-केंद्रित',
    'devotional and friendly': 'भक्तिपूर्ण और मैत्रीपूर्ण',
    'protective and senior': 'संरक्षक और ज्येष्ठ',
    'foundational and transformative': 'मौलिक और परिवर्तनकारी',
    'invincible and confident': 'अजेय और आत्मविश्वासी',
    'victorious and universal': 'विजयी और सार्वभौमिक',
    'learning and listening': 'सीखने और सुनने वाली',
    'prosperous and rhythmic': 'समृद्ध और लयबद्ध',
    'healing and mysterious': 'उपचारात्मक और रहस्यमय',
    'fierce and passionate': 'उग्र और भावुक',
    'wise and deep': 'बुद्धिमान और गहरी',
    'prosperous and completing': 'समृद्ध और पूर्णकारक',
    balanced: 'संतुलित',
  },
};

const EMPTY: PanchangLocaleMap = {};

// Locales we haven't localized yet fall through to the English input string.
// Add entries here as translations become available.
const TERMS: Partial<Record<Locale, PanchangLocaleMap>> = {
  en: EMPTY,
  hi: HI,
};

export function getPanchangTerms(locale: Locale): PanchangLocaleMap {
  return TERMS[locale] ?? EMPTY;
}

/**
 * Translate a tithi that may be prefixed with a paksha (e.g.
 * "Shukla Shashthi" → "शुक्ल षष्ठी"). Falls back to the original input.
 */
export function translateTithi(value: string, locale: Locale): string {
  const terms = getPanchangTerms(locale);
  if (!terms.tithis && !terms.paksha) return value;
  const trimmed = value.trim();
  const pakshaMatch = trimmed.match(/^(Shukla|Krishna)\s+(.+)$/);
  if (pakshaMatch) {
    const [, paksha, tithi] = pakshaMatch;
    const p = terms.paksha?.[paksha] ?? paksha;
    const tRaw = terms.tithis?.[tithi] ?? tithi;
    return `${p} ${tRaw}`;
  }
  return terms.tithis?.[trimmed] ?? trimmed;
}

export function translateNakshatra(value: string, locale: Locale): string {
  return getPanchangTerms(locale).nakshatras?.[value.trim()] ?? value;
}

export function translateYoga(value: string, locale: Locale): string {
  return getPanchangTerms(locale).yogas?.[value.trim()] ?? value;
}

/**
 * Translate a vara. The offline engine emits transliterated forms like
 * "Budhvaar"; the backend sometimes appends the English day in parens
 * like "Budhvaar (Wednesday)". Both shapes are handled.
 */
export function translateVara(value: string, locale: Locale): string {
  const terms = getPanchangTerms(locale);
  if (!terms.varas) return value;
  const trimmed = value.trim();
  const parenMatch = trimmed.match(/^(.+?)\s*\((.+?)\)\s*$/);
  if (parenMatch) {
    const [, head, paren] = parenMatch;
    const h = terms.varas[head.trim()] ?? head.trim();
    const p = terms.varas[paren.trim()] ?? paren.trim();
    return h === p ? h : `${h} (${p})`;
  }
  return terms.varas[trimmed] ?? trimmed;
}

export function translatePaksha(value: string, locale: Locale): string {
  return getPanchangTerms(locale).paksha?.[value.trim()] ?? value;
}

export function translatePlanetName(value: string, locale: Locale): string {
  return getPanchangTerms(locale).planets?.[value.trim()] ?? value;
}

export function translateColorName(value: string, locale: Locale): string {
  return getPanchangTerms(locale).colors?.[value.trim()] ?? value;
}

/**
 * Replace any nakshatra-quality phrase in a longer string (e.g. the
 * daily briefing summary). Longer phrases are replaced first so that
 * e.g. "prosperous and rhythmic" doesn't get partially rewritten by a
 * shorter alternative that happens to be a prefix.
 */
export function translateNakshatraQualities(text: string, locale: Locale): string {
  const map = getPanchangTerms(locale).nakshatraQualities;
  if (!map) return text;
  const phrases = Object.keys(map).sort((a, b) => b.length - a.length);
  let out = text;
  for (const p of phrases) {
    if (out.includes(p)) out = out.split(p).join(map[p]);
  }
  return out;
}

/**
 * Localise a time range like "11:00 AM – 12:00 PM" or a rahu-kaal range
 * like "04:30 PM - 06:00 PM" into the target locale. For now we just
 * localise the AM/PM marker for Hindi; other locales keep English markers
 * until translations are contributed.
 */
const AMPM_MAP: Partial<Record<Locale, { AM: string; PM: string }>> = {
  hi: { AM: 'पूर्वाह्न', PM: 'अपराह्न' },
};

export function translateTimeRange(value: string, locale: Locale): string {
  const map = AMPM_MAP[locale];
  if (!map) return value;
  return value
    .replace(/\bAM\b/g, map.AM)
    .replace(/\bPM\b/g, map.PM);
}
