/**
 * Verified endpoint map — every path pinned against the live NestJS
 * controllers under `apps/api/src` (all `/api`-prefixed) and the web call
 * sites. See `docs/mobile/ANDROID_APP_PLAN.md` §4 for the audit.
 *
 * Paths are RELATIVE to the API base (`https://api.myastro360.com/api`), so
 * they do NOT include the `/api` prefix. Functions build parameterised paths.
 *
 * Notes baked in from the accuracy review:
 *  - Dasha and Hellenistic Natal have no dedicated route → both reuse
 *    `POST /astrology/kundli`.
 *  - Horary history is client-side (localStorage) → NOT represented here.
 *  - Notifications has no endpoint; push-token is NEW backend work (§8).
 */

export const endpoints = {
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    otpSend: '/auth/otp/send',
    otpVerify: '/auth/otp/verify',
    google: '/auth/google',
    firebase: '/auth/firebase',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    forgotPassword: '/auth/forgot-password',
    changePassword: '/auth/change-password',
    setPassword: '/auth/set-password',
    status: '/auth/status',
  },

  user: {
    me: '/users/me',
    credits: '/users/me/credits',
    // FCM device-token registration (§8) — POST to register, POST …/delete to
    // unregister (some proxies strip DELETE bodies).
    pushToken: '/users/push-token',
    pushTokenDelete: '/users/push-token/delete',
  },

  astrology: {
    traditions: '/astrology/traditions',
    kundli: '/astrology/kundli', // also powers Dasha + Hellenistic Natal
    dosha: '/astrology/dosha',
    sadeSati: '/astrology/sade-sati',
    mitigation: (issue: string) => `/astrology/mitigation/${encodeURIComponent(issue)}`,
    matching: '/astrology/matching',
    matchingShare: '/astrology/matching/share',
    matchingShared: (token: string) => `/astrology/matching/shared/${encodeURIComponent(token)}`,
    horoscope: (sign: string) => `/astrology/horoscope/${encodeURIComponent(sign)}`,
    horoscopeMulti: (sign: string) => `/astrology/horoscope/${encodeURIComponent(sign)}/multi`,
    panchang: '/astrology/panchang',
    muhurat: '/astrology/muhurat',
    timingDecision: '/astrology/timing-decision', // Decision Room
    cosmicCalendar: '/astrology/cosmic-calendar',
    divisional: (type: string) => `/astrology/divisional/${encodeURIComponent(type)}`,
    kpChart: '/astrology/kp-chart',
    // Western
    westernNatal: '/astrology/western/natal',
    westernTransits: '/astrology/western/transits',
    westernSynastry: '/astrology/western/synastry',
    // Chinese
    bazi: '/astrology/bazi',
    chineseZodiac: (year: number | string) => `/astrology/chinese-zodiac/${year}`,
    flyingStars: '/astrology/chinese/flying-stars',
    // Hellenistic
    hellenisticProfections: '/astrology/hellenistic/profections',
    hellenisticZodiacalReleasing: '/astrology/hellenistic/zodiacal-releasing',
    // Horary (history is client-side, no endpoint)
    horaryAsk: '/astrology/horary/ask',
    // Medical
    medicalDecumbiture: '/astrology/medical/decumbiture',
    medicalBodyZodiac: '/astrology/medical/body-zodiac',
  },

  numerology: {
    name: '/numerology/name',
    brand: '/numerology/brand',
    personalYear: '/numerology/personal-year',
    mulank: '/numerology/mulank',
  },

  palmistry: {
    analyze: '/palmistry/analyze',
    status: (id: string) => `/palmistry/${encodeURIComponent(id)}/status`,
    image: (id: string) => `/palmistry/${encodeURIComponent(id)}/image`,
  },

  tarot: {
    draw: '/tarot/draw',
    history: '/tarot/history',
  },

  vastu: {
    analyze: '/vastu/analyze',
  },

  chat: {
    message: '/chat/message',
    stream: '/chat/stream',
    sessions: '/chat/sessions',
    session: (id: string) => `/chat/sessions/${encodeURIComponent(id)}`,
  },

  memory: {
    list: '/memory',
    create: '/memory',
    remove: (id: string) => `/memory/${encodeURIComponent(id)}`,
  },

  interpretation: {
    base: '/interpretation',
    deepDive: '/interpretation/deep-dive',
  },

  dailyBriefing: {
    base: '/daily-briefing',
    planetaryHours: '/daily-briefing/planetary-hours',
    offlinePack: '/daily-briefing/offline-pack',
  },

  briefingPreferences: {
    base: '/briefing/preferences',
  },

  reports: {
    generate: '/reports/generate',
    list: '/reports',
    byId: (id: string) => `/reports/${encodeURIComponent(id)}`,
    status: (id: string) => `/reports/${encodeURIComponent(id)}/status`,
  },

  payments: {
    pricing: '/payments/pricing',
    createOrder: '/payments/create-order',
    verify: '/payments/verify',
    subscribe: '/payments/subscribe',
    history: '/payments/history',
    webhook: '/payments/webhook',
    // Google Play receipt verification + RTDN (Pub/Sub push) — Rail B (§8).
    googleVerify: '/payments/google/verify',
    googleRtdn: '/payments/google/rtdn',
  },

  referral: {
    me: '/referral/me',
    preview: '/referral/preview',
  },

  experiment: {
    paywallAssign: '/experiment/paywall/assign',
    paywallLink: '/experiment/paywall/link',
    paywallConvert: '/experiment/paywall/convert',
    paywallPreview: '/experiment/paywall/preview',
  },

  health: '/health',
} as const;

export type Endpoints = typeof endpoints;
