import { PANCHANG_LOCALES, type Locale } from "@/i18n/locales";

/**
 * Long-form template content for the LOCALIZED /​<locale>/panchang/[city]
 * pages. The audit flagged those 300 pages as thin near-duplicates (data
 * table only); this module carries the explainer + FAQ template that turns
 * them into real landing pages, translated ONCE PER LOCALE (the city name is
 * interpolated via the {city} token — the surrounding prose is static).
 *
 * Mirrors the FEATURE_CONTENT / FEATURE_CONTENT_LOCALE pattern: adding a new
 * locale section here automatically (a) renders the long-form on that
 * locale's city pages and (b) re-adds the locale's 51 city URLs to the
 * sitemap — see PANCHANG_SITEMAP_LOCALES below and sitemap-entries.ts. A
 * locale absent here stays live (200, self-canonical, hreflang) but is not
 * advertised in the sitemap until its translation lands.
 */

export interface PanchangCityFaq {
  q: string;
  a: string;
}

export interface PanchangCityContent {
  /** Intro paragraphs. */
  intro: string[];
  inauspiciousHeading: string;
  inauspiciousBody: string;
  computedHeading: string;
  computedBody: string;
  faqHeading: string;
  faqs: PanchangCityFaq[];
}

/** Replace the {city} token with the localized city name. */
export function interpolateCity<T extends string | string[] | PanchangCityFaq[]>(
  value: T,
  cityName: string,
): T {
  if (typeof value === "string") return value.replaceAll("{city}", cityName) as T;
  if (Array.isArray(value) && typeof value[0] === "string") {
    return (value as string[]).map((s) => s.replaceAll("{city}", cityName)) as T;
  }
  return (value as PanchangCityFaq[]).map((f) => ({
    q: f.q.replaceAll("{city}", cityName),
    a: f.a.replaceAll("{city}", cityName),
  })) as T;
}

export const PANCHANG_CITY_CONTENT_LOCALE: Partial<Record<Locale, PanchangCityContent>> = {
  hi: {
    intro: [
      "पंचांग हिन्दू कैलेंडर है, जो हर दिन के पाँच अंगों — तिथि, नक्षत्र, योग, करण और वार — की गणना करता है। {city} के लिए ये मान शहर के सटीक अक्षांश-देशांतर से स्विस एफ़ेमेरिस द्वारा निकाले जाते हैं, इसलिए विवाह, गृह-प्रवेश या नामकरण जैसे शुभ मुहूर्त के लिए इन पर भरोसा किया जा सकता है।",
      "सूर्योदय, सूर्यास्त, तिथि और राहु काल का समय हर शहर में अलग होता है — चंद्रमा और सूर्य {city} के स्थानीय क्षितिज को अलग समय पर पार करते हैं। इसलिए राष्ट्रीय पंचांग की तुलना में {city} का स्थानीय पंचांग कुछ मिनट से लेकर घंटों तक भिन्न हो सकता है।",
    ],
    inauspiciousHeading: "राहु काल, गुलिक काल और यमघंट काल",
    inauspiciousBody:
      "ये तीनों अशुभ माने जाने वाले छोटे समय-खंड हैं, जिनमें परंपरा के अनुसार कोई नया कार्य — जैसे अनुबंध पर हस्ताक्षर, यात्रा की शुरुआत या शुभ संस्कार — आरंभ करने से बचा जाता है। पहले से चल रहे कार्यों पर इनका प्रभाव नहीं माना जाता; केवल नए कार्य की पहली घड़ी इन खिड़कियों से बाहर रखी जाती है।",
    computedHeading: "{city} का पंचांग कैसे निकाला जाता है",
    computedBody:
      "MyAstro360 स्विस एफ़ेमेरिस (वही खगोलीय इंजन जो पेशेवर ज्योतिषी उपयोग करते हैं) और प्रामाणिक लाहिरी अयनांश का उपयोग करता है। सूर्योदय-सूर्यास्त {city} के वास्तविक निर्देशांक के अनुसार गणना किए जाते हैं, मानक मध्याह्न रेखा के अनुसार नहीं — इसलिए समय मिनट तक सटीक रहता है।",
    faqHeading: "{city} पंचांग — अक्सर पूछे जाने वाले प्रश्न",
    faqs: [
      {
        q: "{city} का पंचांग राष्ट्रीय पंचांग से अलग क्यों होता है?",
        a: "तिथि, नक्षत्र, सूर्योदय और सूर्यास्त का समय स्थान के अनुसार बदलता है। {city} के निर्देशांक पर ये खगोलीय घटनाएँ अलग घड़ी-समय पर होती हैं, इसलिए यहाँ दिखाए गए मान {city} के लिए स्थानीय और सटीक हैं।",
      },
      {
        q: "यह पंचांग कितनी बार अपडेट होता है?",
        a: "हर स्थानीय दिन में एक बार। अगली सुबह पेज दोबारा खोलें — {city} का नए दिन का पंचांग अपने आप दिखेगा।",
      },
      {
        q: "गणना किस पद्धति से होती है?",
        a: "सभी ग्रह-स्थितियाँ स्विस एफ़ेमेरिस से और नाक्षत्रिक मान लाहिरी अयनांश से निकाले जाते हैं। एक ही तिथि के लिए गणना दोहराने पर परिणाम हमेशा समान रहते हैं।",
      },
    ],
  },
};

/**
 * Locales whose /​<locale>/panchang/[city] pages are sitemap-listed: English
 * (root pages) + every locale with a translated long-form template above.
 * Restricted to PANCHANG_LOCALES because only those locales have routes.
 */
export const PANCHANG_SITEMAP_LOCALES: Locale[] = PANCHANG_LOCALES.filter(
  (l) => l === "en" || PANCHANG_CITY_CONTENT_LOCALE[l] !== undefined,
);
