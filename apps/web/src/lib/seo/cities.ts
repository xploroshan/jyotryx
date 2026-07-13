/**
 * Top 50 Indian cities by population (Census 2011 + post-census municipal
 * estimates) with the lat/lng each location-aware feature needs.
 *
 * Why this list and not something pulled from an API:
 *   1. SEO landing pages are static — at build time we need a fixed set
 *      so `generateStaticParams` can pre-render them and the sitemap
 *      can list them.
 *   2. The list is small enough to hand-curate with confidence and
 *      large enough to cover ~70% of long-tail city-name searches.
 *   3. Adding a new city is a one-line PR; no external dependency.
 *
 * `slug` is the URL-safe lowercase form ("new-delhi"). We pre-compute
 * it so the slug is stable even if a translation later changes the
 * displayed name (e.g. "Bengaluru" vs "Bangalore").
 *
 * `timezone` is included for forward compatibility with muhurat
 * landing pages — every city in India is on Asia/Kolkata, but we keep
 * the field so when we expand to neighbouring regions (Nepal, Sri
 * Lanka, the Gulf NRI corridor) the schema doesn't change.
 */
export interface SeoCity {
  slug: string;
  name: string;
  /** Localised display name in the supported SEO locales (see SUPPORTED_SEO_LOCALES). */
  i18n: { en: string; hi: string; bn: string; kn: string; ta: string; te: string; ml: string };
  state: string;
  lat: number;
  lng: number;
  timezone: string;
  /** Census-era population, used to sort the directory pages. */
  population: number;
}

export const SEO_CITIES: SeoCity[] = [
  { slug: 'mumbai',          name: 'Mumbai',          i18n: { en: 'Mumbai',          hi: 'मुंबई', bn: 'মুম্বই', kn: 'ಮುಂಬೈ', ta: 'மும்பை', te: 'ముంబై', ml: 'മുംബൈ' },         state: 'Maharashtra',     lat: 19.0760, lng: 72.8777, timezone: 'Asia/Kolkata', population: 12442373 },
  { slug: 'delhi',           name: 'Delhi',           i18n: { en: 'Delhi',           hi: 'दिल्ली', bn: 'দিল্লি', kn: 'ದೆಹಲಿ', ta: 'டெல்லி', te: 'ఢిల్లీ', ml: 'ഡൽഹി' },         state: 'Delhi',           lat: 28.6139, lng: 77.2090, timezone: 'Asia/Kolkata', population: 11034555 },
  { slug: 'bangalore',       name: 'Bangalore',       i18n: { en: 'Bangalore',       hi: 'बेंगलुरु', bn: 'বেঙ্গালুরু', kn: 'ಬೆಂಗಳೂರು', ta: 'பெங்களூரு', te: 'బెంగళూరు', ml: 'ബെംഗളൂരു' },        state: 'Karnataka',       lat: 12.9716, lng: 77.5946, timezone: 'Asia/Kolkata', population:  8443675 },
  { slug: 'hyderabad',       name: 'Hyderabad',       i18n: { en: 'Hyderabad',       hi: 'हैदराबाद', bn: 'হায়দরাবাদ', kn: 'ಹೈದರಾಬಾದ್', ta: 'ஹைதராபாத்', te: 'హైదరాబాద్', ml: 'ഹൈദരാബാദ്' },       state: 'Telangana',       lat: 17.3850, lng: 78.4867, timezone: 'Asia/Kolkata', population:  6993262 },
  { slug: 'ahmedabad',       name: 'Ahmedabad',       i18n: { en: 'Ahmedabad',       hi: 'अहमदाबाद', bn: 'আহমেদাবাদ', kn: 'ಅಹಮದಾಬಾದ್', ta: 'அகமதாபாத்', te: 'అహ్మదాబాద్', ml: 'അഹമ്മദാബാദ്' },       state: 'Gujarat',         lat: 23.0225, lng: 72.5714, timezone: 'Asia/Kolkata', population:  5570585 },
  { slug: 'chennai',         name: 'Chennai',         i18n: { en: 'Chennai',         hi: 'चेन्नई', bn: 'চেন্নাই', kn: 'ಚೆನ್ನೈ', ta: 'சென்னை', te: 'చెన్నై', ml: 'ചെന്നൈ' },           state: 'Tamil Nadu',      lat: 13.0827, lng: 80.2707, timezone: 'Asia/Kolkata', population:  4646732 },
  { slug: 'kolkata',         name: 'Kolkata',         i18n: { en: 'Kolkata',         hi: 'कोलकाता', bn: 'কলকাতা', kn: 'ಕೋಲ್ಕತಾ', ta: 'கொல்கத்தா', te: 'కోల్‌కతా', ml: 'കൊൽക്കത്ത' },        state: 'West Bengal',     lat: 22.5726, lng: 88.3639, timezone: 'Asia/Kolkata', population:  4496694 },
  { slug: 'surat',           name: 'Surat',           i18n: { en: 'Surat',           hi: 'सूरत', bn: 'সুরাট', kn: 'ಸೂರತ್', ta: 'சூரத்', te: 'సూరత్', ml: 'സൂറത്ത്' },           state: 'Gujarat',         lat: 21.1702, lng: 72.8311, timezone: 'Asia/Kolkata', population:  4467797 },
  { slug: 'pune',            name: 'Pune',            i18n: { en: 'Pune',            hi: 'पुणे', bn: 'পুনে', kn: 'ಪುಣೆ', ta: 'புனே', te: 'పుణె', ml: 'പുണെ' },            state: 'Maharashtra',     lat: 18.5204, lng: 73.8567, timezone: 'Asia/Kolkata', population:  3124458 },
  { slug: 'jaipur',          name: 'Jaipur',          i18n: { en: 'Jaipur',          hi: 'जयपुर', bn: 'জয়পুর', kn: 'ಜೈಪುರ', ta: 'ஜெய்பூர்', te: 'జైపూర్', ml: 'ജയ്പൂർ' },          state: 'Rajasthan',       lat: 26.9124, lng: 75.7873, timezone: 'Asia/Kolkata', population:  3046163 },
  { slug: 'lucknow',         name: 'Lucknow',         i18n: { en: 'Lucknow',         hi: 'लखनऊ', bn: 'লখনউ', kn: 'ಲಕ್ನೋ', ta: 'லக்னோ', te: 'లక్నో', ml: 'ലഖ്‌നൗ' },           state: 'Uttar Pradesh',   lat: 26.8467, lng: 80.9462, timezone: 'Asia/Kolkata', population:  2817105 },
  { slug: 'kanpur',          name: 'Kanpur',          i18n: { en: 'Kanpur',          hi: 'कानपुर', bn: 'কানপুর', kn: 'ಕಾನ್ಪುರ', ta: 'கான்பூர்', te: 'కాన్పూర్', ml: 'കാൺപൂർ' },         state: 'Uttar Pradesh',   lat: 26.4499, lng: 80.3319, timezone: 'Asia/Kolkata', population:  2767031 },
  { slug: 'nagpur',          name: 'Nagpur',          i18n: { en: 'Nagpur',          hi: 'नागपुर', bn: 'নাগপুর', kn: 'ನಾಗಪುರ', ta: 'நாக்பூர்', te: 'నాగపూర్', ml: 'നാഗ്പൂർ' },         state: 'Maharashtra',     lat: 21.1458, lng: 79.0882, timezone: 'Asia/Kolkata', population:  2405421 },
  { slug: 'indore',          name: 'Indore',          i18n: { en: 'Indore',          hi: 'इंदौर', bn: 'ইন্দোর', kn: 'ಇಂದೋರ್', ta: 'இந்தோர்', te: 'ఇండోర్', ml: 'ഇൻഡോർ' },           state: 'Madhya Pradesh',  lat: 22.7196, lng: 75.8577, timezone: 'Asia/Kolkata', population:  1964086 },
  { slug: 'thane',           name: 'Thane',           i18n: { en: 'Thane',           hi: 'ठाणे', bn: 'থানে', kn: 'ಥಾಣೆ', ta: 'தானே', te: 'థానే', ml: 'താനെ' },            state: 'Maharashtra',     lat: 19.2183, lng: 72.9781, timezone: 'Asia/Kolkata', population:  1841488 },
  { slug: 'bhopal',          name: 'Bhopal',          i18n: { en: 'Bhopal',          hi: 'भोपाल', bn: 'ভোপাল', kn: 'ಭೋಪಾಲ್', ta: 'போபால்', te: 'భోపాల్', ml: 'ഭോപ്പാൽ' },          state: 'Madhya Pradesh',  lat: 23.2599, lng: 77.4126, timezone: 'Asia/Kolkata', population:  1798218 },
  { slug: 'visakhapatnam',   name: 'Visakhapatnam',   i18n: { en: 'Visakhapatnam',   hi: 'विशाखापत्तनम', bn: 'বিশাখাপত্তনম', kn: 'ವಿಶಾಖಪಟ್ಟಣಂ', ta: 'விசாகப்பட்டினம்', te: 'విశాఖపట్నం', ml: 'വിശാഖപട്ടണം' },     state: 'Andhra Pradesh',  lat: 17.6868, lng: 83.2185, timezone: 'Asia/Kolkata', population:  1730320 },
  { slug: 'patna',           name: 'Patna',           i18n: { en: 'Patna',           hi: 'पटना', bn: 'পাটনা', kn: 'ಪಟ್ನಾ', ta: 'பட்னா', te: 'పాట్నా', ml: 'പട്ന' },           state: 'Bihar',           lat: 25.5941, lng: 85.1376, timezone: 'Asia/Kolkata', population:  1684222 },
  { slug: 'vadodara',        name: 'Vadodara',        i18n: { en: 'Vadodara',        hi: 'वड़ोदरा', bn: 'ভদোদরা', kn: 'ವಡೋದರಾ', ta: 'வதோதரா', te: 'వడోదర', ml: 'വഡോദര' },        state: 'Gujarat',         lat: 22.3072, lng: 73.1812, timezone: 'Asia/Kolkata', population:  1666703 },
  { slug: 'ghaziabad',       name: 'Ghaziabad',       i18n: { en: 'Ghaziabad',       hi: 'गाज़ियाबाद', bn: 'গাজিয়াবাদ', kn: 'ಗಾಜಿಯಾಬಾದ್', ta: 'காசியாபாத்', te: 'ఘజియాబాద్', ml: 'ഗാസിയാബാദ്' },     state: 'Uttar Pradesh',   lat: 28.6692, lng: 77.4538, timezone: 'Asia/Kolkata', population:  1648643 },
  { slug: 'ludhiana',        name: 'Ludhiana',        i18n: { en: 'Ludhiana',        hi: 'लुधियाना', bn: 'লুধিয়ানা', kn: 'ಲುಧಿಯಾನಾ', ta: 'லூதியானா', te: 'లూధియానా', ml: 'ലുധിയാന' },        state: 'Punjab',          lat: 30.9010, lng: 75.8573, timezone: 'Asia/Kolkata', population:  1618879 },
  { slug: 'agra',            name: 'Agra',            i18n: { en: 'Agra',            hi: 'आगरा', bn: 'আগ্রা', kn: 'ಆಗ್ರಾ', ta: 'ஆக்ரா', te: 'ఆగ్రా', ml: 'ആഗ്ര' },           state: 'Uttar Pradesh',   lat: 27.1767, lng: 78.0081, timezone: 'Asia/Kolkata', population:  1585704 },
  { slug: 'nashik',          name: 'Nashik',          i18n: { en: 'Nashik',          hi: 'नासिक', bn: 'নাসিক', kn: 'ನಾಸಿಕ್', ta: 'நாசிக்', te: 'నాసిక్', ml: 'നാസിക്' },          state: 'Maharashtra',     lat: 19.9975, lng: 73.7898, timezone: 'Asia/Kolkata', population:  1486973 },
  { slug: 'faridabad',       name: 'Faridabad',       i18n: { en: 'Faridabad',       hi: 'फरीदाबाद', bn: 'ফরিদাবাদ', kn: 'ಫರಿದಾಬಾದ್', ta: 'பரிதாபாத்', te: 'ఫరీదాబాద్', ml: 'ഫരീദാബാദ്' },        state: 'Haryana',         lat: 28.4089, lng: 77.3178, timezone: 'Asia/Kolkata', population:  1414050 },
  { slug: 'meerut',          name: 'Meerut',          i18n: { en: 'Meerut',          hi: 'मेरठ', bn: 'মিরাট', kn: 'ಮೀರತ್', ta: 'மீரட்', te: 'మీరట్', ml: 'മീററ്റ്' },            state: 'Uttar Pradesh',   lat: 28.9845, lng: 77.7064, timezone: 'Asia/Kolkata', population:  1305429 },
  { slug: 'rajkot',          name: 'Rajkot',          i18n: { en: 'Rajkot',          hi: 'राजकोट', bn: 'রাজকোট', kn: 'ರಾಜಕೋಟ್', ta: 'ராஜ்கோட்', te: 'రాజ్‌కోట్', ml: 'രാജ്കോട്ട്' },         state: 'Gujarat',         lat: 22.3039, lng: 70.8022, timezone: 'Asia/Kolkata', population:  1286995 },
  { slug: 'kalyan-dombivli', name: 'Kalyan-Dombivli', i18n: { en: 'Kalyan-Dombivli', hi: 'कल्याण डोम्बिवली', bn: 'কল্যাণ-ডোম্বিভলি', kn: 'ಕಲ್ಯಾಣ್-ಡೊಂಬಿವಲಿ', ta: 'கல்யாண்-டோம்பிவலி', te: 'కల్యాణ్-డోంబివలి', ml: 'കല്യാൺ-ഡോംബിവലി' }, state: 'Maharashtra',     lat: 19.2403, lng: 73.1305, timezone: 'Asia/Kolkata', population:  1246381 },
  { slug: 'vasai-virar',     name: 'Vasai-Virar',     i18n: { en: 'Vasai-Virar',     hi: 'वसई विरार', bn: 'বসই-বিরার', kn: 'ವಸಯಿ-ವಿರಾರ್', ta: 'வசை-விரார்', te: 'వసయి-విరార్', ml: 'വസായ്-വിരാർ' },     state: 'Maharashtra',     lat: 19.4259, lng: 72.8225, timezone: 'Asia/Kolkata', population:  1221233 },
  { slug: 'varanasi',        name: 'Varanasi',        i18n: { en: 'Varanasi',        hi: 'वाराणसी', bn: 'বারাণসী', kn: 'ವಾರಾಣಸಿ', ta: 'வாரணாசி', te: 'వారాణసి', ml: 'വാരാണസി' },        state: 'Uttar Pradesh',   lat: 25.3176, lng: 82.9739, timezone: 'Asia/Kolkata', population:  1201815 },
  { slug: 'srinagar',        name: 'Srinagar',        i18n: { en: 'Srinagar',        hi: 'श्रीनगर', bn: 'শ্রীনগর', kn: 'ಶ್ರೀನಗರ', ta: 'ஸ்ரீநகர்', te: 'శ్రీనగర్', ml: 'ശ്രീനഗർ' },        state: 'Jammu and Kashmir', lat: 34.0837, lng: 74.7973, timezone: 'Asia/Kolkata', population:  1180570 },
  { slug: 'aurangabad',      name: 'Aurangabad',      i18n: { en: 'Aurangabad',      hi: 'औरंगाबाद', bn: 'আওরঙ্গাবাদ', kn: 'ಔರಂಗಾಬಾದ್', ta: 'அவுரங்காபாத்', te: 'ఔరంగాబాద్', ml: 'ഔറംഗബാദ്' },        state: 'Maharashtra',     lat: 19.8762, lng: 75.3433, timezone: 'Asia/Kolkata', population:  1175116 },
  { slug: 'dhanbad',         name: 'Dhanbad',         i18n: { en: 'Dhanbad',         hi: 'धनबाद', bn: 'ধানবাদ', kn: 'ಧನ್‌ಬಾದ್', ta: 'தன்பாத்', te: 'ధన్‌బాద్', ml: 'ധൻബാദ്' },          state: 'Jharkhand',       lat: 23.7957, lng: 86.4304, timezone: 'Asia/Kolkata', population:  1162472 },
  { slug: 'amritsar',        name: 'Amritsar',        i18n: { en: 'Amritsar',        hi: 'अमृतसर', bn: 'অমৃতসর', kn: 'ಅಮೃತಸರ', ta: 'அமிர்தசரஸ்', te: 'అమృత్‌సర్', ml: 'അമൃത്സർ' },         state: 'Punjab',          lat: 31.6340, lng: 74.8723, timezone: 'Asia/Kolkata', population:  1132383 },
  { slug: 'navi-mumbai',     name: 'Navi Mumbai',     i18n: { en: 'Navi Mumbai',     hi: 'नवी मुंबई', bn: 'নবি মুম্বই', kn: 'ನವಿ ಮುಂಬೈ', ta: 'நவி மும்பை', te: 'నవీ ముంబై', ml: 'നവി മുംബൈ' },      state: 'Maharashtra',     lat: 19.0330, lng: 73.0297, timezone: 'Asia/Kolkata', population:  1120547 },
  { slug: 'allahabad',       name: 'Prayagraj',       i18n: { en: 'Prayagraj',       hi: 'प्रयागराज', bn: 'প্রয়াগরাজ', kn: 'ಪ್ರಯಾಗ್‌ರಾಜ್', ta: 'பிரயாக்ராஜ்', te: 'ప్రయాగ్‌రాజ్', ml: 'പ്രയാഗ്‌രാജ്' },      state: 'Uttar Pradesh',   lat: 25.4358, lng: 81.8463, timezone: 'Asia/Kolkata', population:  1117094 },
  { slug: 'ranchi',          name: 'Ranchi',          i18n: { en: 'Ranchi',          hi: 'रांची', bn: 'রাঁচি', kn: 'ರಾಂಚಿ', ta: 'ராஞ்சி', te: 'రాంచీ', ml: 'റാഞ്ചി' },           state: 'Jharkhand',       lat: 23.3441, lng: 85.3096, timezone: 'Asia/Kolkata', population:  1073427 },
  { slug: 'howrah',          name: 'Howrah',          i18n: { en: 'Howrah',          hi: 'हावड़ा', bn: 'হাওড়া', kn: 'ಹೌರಾ', ta: 'ஹவ்ரா', te: 'హౌరా', ml: 'ഹൗറ' },         state: 'West Bengal',     lat: 22.5958, lng: 88.2636, timezone: 'Asia/Kolkata', population:  1072161 },
  { slug: 'coimbatore',      name: 'Coimbatore',      i18n: { en: 'Coimbatore',      hi: 'कोयंबटूर', bn: 'কোয়েম্বাটুর', kn: 'ಕೊಯಮತ್ತೂರು', ta: 'கோயம்புத்தூர்', te: 'కోయంబత్తూరు', ml: 'കോയമ്പത്തൂർ' },       state: 'Tamil Nadu',      lat: 11.0168, lng: 76.9558, timezone: 'Asia/Kolkata', population:  1061447 },
  { slug: 'jabalpur',        name: 'Jabalpur',        i18n: { en: 'Jabalpur',        hi: 'जबलपुर', bn: 'জবলপুর', kn: 'ಜಬಲ್ಪುರ', ta: 'ஜபல்பூர்', te: 'జబల్‌పూర్', ml: 'ജബൽപൂർ' },         state: 'Madhya Pradesh',  lat: 23.1815, lng: 79.9864, timezone: 'Asia/Kolkata', population:  1055525 },
  { slug: 'gwalior',         name: 'Gwalior',         i18n: { en: 'Gwalior',         hi: 'ग्वालियर', bn: 'গোয়ালিয়র', kn: 'ಗ್ವಾಲಿಯರ್', ta: 'குவாலியர்', te: 'గ్వాలియర్', ml: 'ഗ്വാളിയോർ' },        state: 'Madhya Pradesh',  lat: 26.2183, lng: 78.1828, timezone: 'Asia/Kolkata', population:  1054420 },
  { slug: 'vijayawada',      name: 'Vijayawada',      i18n: { en: 'Vijayawada',      hi: 'विजयवाड़ा', bn: 'বিজয়ওয়াড়া', kn: 'ವಿಜಯವಾಡ', ta: 'விஜயவாடா', te: 'విజయవాడ', ml: 'വിജയവാഡ' },     state: 'Andhra Pradesh',  lat: 16.5062, lng: 80.6480, timezone: 'Asia/Kolkata', population:  1048240 },
  { slug: 'jodhpur',         name: 'Jodhpur',         i18n: { en: 'Jodhpur',         hi: 'जोधपुर', bn: 'যোধপুর', kn: 'ಜೋಧಪುರ', ta: 'ஜோத்பூர்', te: 'జోధ్‌పూర్', ml: 'ജോധ്പൂർ' },         state: 'Rajasthan',       lat: 26.2389, lng: 73.0243, timezone: 'Asia/Kolkata', population:  1033918 },
  { slug: 'madurai',         name: 'Madurai',         i18n: { en: 'Madurai',         hi: 'मदुरै', bn: 'মাদুরাই', kn: 'ಮಧುರೈ', ta: 'மதுரை', te: 'మదురై', ml: 'മധുരൈ' },           state: 'Tamil Nadu',      lat:  9.9252, lng: 78.1198, timezone: 'Asia/Kolkata', population:  1017865 },
  { slug: 'raipur',          name: 'Raipur',          i18n: { en: 'Raipur',          hi: 'रायपुर', bn: 'রায়পুর', kn: 'ರಾಯಪುರ', ta: 'ராய்பூர்', te: 'రాయ్‌పూర్', ml: 'റായ്പൂർ' },          state: 'Chhattisgarh',    lat: 21.2514, lng: 81.6296, timezone: 'Asia/Kolkata', population:  1010087 },
  { slug: 'kota',            name: 'Kota',            i18n: { en: 'Kota',            hi: 'कोटा', bn: 'কোটা', kn: 'ಕೋಟಾ', ta: 'கோட்டா', te: 'కోటా', ml: 'കോട്ട' },           state: 'Rajasthan',       lat: 25.2138, lng: 75.8648, timezone: 'Asia/Kolkata', population:  1001365 },
  { slug: 'chandigarh',      name: 'Chandigarh',      i18n: { en: 'Chandigarh',      hi: 'चंडीगढ़', bn: 'চণ্ডীগড়', kn: 'ಚಂಡೀಗಢ', ta: 'சண்டிகர்', te: 'చండీగఢ్', ml: 'ചണ്ഡീഗഢ്' },        state: 'Chandigarh',      lat: 30.7333, lng: 76.7794, timezone: 'Asia/Kolkata', population:   960787 },
  { slug: 'guwahati',        name: 'Guwahati',        i18n: { en: 'Guwahati',        hi: 'गुवाहाटी', bn: 'গুয়াহাটি', kn: 'ಗುವಾಹಟಿ', ta: 'குவகாத்தி', te: 'గువాహటి', ml: 'ഗുവാഹത്തി' },       state: 'Assam',           lat: 26.1445, lng: 91.7362, timezone: 'Asia/Kolkata', population:   957352 },
  { slug: 'thiruvananthapuram', name: 'Thiruvananthapuram', i18n: { en: 'Thiruvananthapuram', hi: 'तिरुवनंतपुरम', bn: 'তিরুবনন্তপুরম', kn: 'ತಿರುವನಂತಪುರಂ', ta: 'திருவனந்தபுரம்', te: 'తిరువనంతపురం', ml: 'തിരുവനന്തപുരം' }, state: 'Kerala', lat: 8.5241, lng: 76.9366, timezone: 'Asia/Kolkata', population:   957730 },
  { slug: 'mysore',          name: 'Mysore',          i18n: { en: 'Mysore',          hi: 'मैसूर', bn: 'মাইসোর', kn: 'ಮೈಸೂರು', ta: 'மைசூரு', te: 'మైసూరు', ml: 'മൈസൂരു' },           state: 'Karnataka',       lat: 12.2958, lng: 76.6394, timezone: 'Asia/Kolkata', population:   893062 },
  { slug: 'jalandhar',       name: 'Jalandhar',       i18n: { en: 'Jalandhar',       hi: 'जालंधर', bn: 'জলন্ধর', kn: 'ಜಲಂಧರ್', ta: 'ஜலந்தர்', te: 'జలంధర్', ml: 'ജലന്ധർ' },          state: 'Punjab',          lat: 31.3260, lng: 75.5762, timezone: 'Asia/Kolkata', population:   873725 },
];

const BY_SLUG = new Map(SEO_CITIES.map((c) => [c.slug, c]));

export function findCityBySlug(slug: string): SeoCity | undefined {
  return BY_SLUG.get(slug);
}

export function listCitySlugs(): string[] {
  return SEO_CITIES.map((c) => c.slug);
}

/**
 * URL-safe slug from a free-form city name. Used by the kundli generator
 * deep-link CTA: when a user lands on /kundli/mumbai we forward the city
 * label to the existing /kundli?place=Mumbai pre-fill flow.
 */
export function slugifyCityName(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export const SUPPORTED_SEO_LOCALES = ['en', 'hi', 'bn', 'kn', 'ta', 'te', 'ml'] as const;
export type SeoLocale = (typeof SUPPORTED_SEO_LOCALES)[number];

/**
 * Cities "near" a given city, for the kundli city pages' cross-link block:
 * same-state cities first (the strongest topical relation for a reader),
 * topped up with the geographically nearest others. Deterministic, excludes
 * the city itself, returns exactly `count` entries (SEO_CITIES has 51, so a
 * small count always fills).
 */
export function nearbyCities(slug: string, count = 4): SeoCity[] {
  const self = findCityBySlug(slug);
  if (!self) return [];
  const others = SEO_CITIES.filter((c) => c.slug !== self.slug);
  const dist = (c: SeoCity) => {
    const dLat = c.lat - self.lat;
    const dLng = c.lng - self.lng;
    return dLat * dLat + dLng * dLng; // squared degrees — fine for ranking
  };
  const sameState = others
    .filter((c) => c.state === self.state)
    .sort((a, b) => dist(a) - dist(b));
  const rest = others
    .filter((c) => c.state !== self.state)
    .sort((a, b) => dist(a) - dist(b));
  return [...sameState, ...rest].slice(0, count);
}

/**
 * Two well-known metros to CONTRAST a city with in copy (e.g. "the rising
 * sign in Jaipur differs from the same moment in Mumbai or Kolkata").
 * Never includes the city itself — the previous hardcoded "Mumbai or
 * Kolkata" produced "in Mumbai ... different from ... Mumbai" on Mumbai's
 * own page (a visible over-templating bug flagged in review).
 */
export function contrastCities(slug: string): [SeoCity, SeoCity] {
  const preferred = ['mumbai', 'kolkata', 'delhi', 'chennai', 'bangalore']
    .filter((s) => s !== slug)
    .map((s) => findCityBySlug(s))
    .filter((c): c is SeoCity => Boolean(c));
  return [preferred[0], preferred[1]];
}
