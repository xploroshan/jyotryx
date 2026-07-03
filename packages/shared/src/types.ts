/**
 * Shared DTO types — the shapes exchanged with the API. Kept in sync with
 * `apps/api` DTOs and mirrored from `apps/web/src/lib/store.ts` (User). These
 * are consumed by both web and mobile clients.
 */

import type { TraditionId } from './traditions';

/** The 12 supported UI locales (en + 11 Indian languages). */
export const SUPPORTED_LOCALES = [
  'en',
  'hi',
  'ta',
  'te',
  'bn',
  'mr',
  'gu',
  'kn',
  'ml',
  'pa',
  'or',
  'as',
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export interface User {
  id: string;
  name: string;
  /** Informal name used to address the user across the app. */
  nickname?: string | null;
  email: string;
  phone?: string | null;
  credits: number;
  role: string;
  preferredLanguage?: string;
  astrologyTraditions: string[];
  primaryTradition?: string | null;
  profileComplete: boolean;
  dateOfBirth?: string | null;
  timeOfBirth?: string | null;
  placeOfBirth?: string | null;
  gender?: string | null;
}

export interface BirthDetails {
  dateOfBirth?: string | null;
  timeOfBirth?: string | null;
  placeOfBirth?: string | null;
  gender?: string | null;
}

/** Token bundle as the API returns it — NESTED under `tokens` in auth
 *  responses (`auth.service.ts` AuthResponse), not flat. `expiresIn` is a
 *  duration string like `"1d"`. */
export interface AuthTokensPayload {
  accessToken: string;
  refreshToken: string;
  expiresIn?: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokensPayload;
}

/** POST /auth/otp/send response. `expiresIn` is SECONDS; `devOtp` is present
 *  only outside production (OTP_EXPOSE_IN_RESPONSE). */
export interface OtpSendResponse {
  message: string;
  expiresIn: number;
  devOtp?: string;
}

/** GET /referral/me */
export interface ReferralStatus {
  enabled: boolean;
  bonusDays: number;
  code: string;
  shareUrl: string;
  totalReferrals: number;
  activatedReferrals: number;
  pendingReferrals: number;
  rejectedReferrals: number;
  maxPerReferrer: number;
  remainingSlots: number;
  recent: {
    refereeName: string;
    refereeEmail: string;
    bonusDays: number;
    status: string;
    activatedAt: string | null;
    createdAt: string;
  }[];
}

/** GET/PUT /briefing/preferences */
export interface BriefingPreferences {
  briefingEmailEnabled: boolean;
}

export interface CreditsResponse {
  credits: number;
}

/** `/users/me` may return the store policy that drives anti-steering UI (§8). */
export interface StorePolicy {
  /** ISO country code; India (`IN`) forbids in-app links to web checkout. */
  region?: string;
  /** Whether in-app deep-links to web checkout are permitted. */
  allowWebCheckoutLink?: boolean;
}

export interface PricingTier {
  id: string;
  label: string;
  credits?: number;
  amount: number;
  currency: string;
}

export interface PricingResponse {
  credits: PricingTier[];
  subscriptions: PricingTier[];
  currency: string;
  storePolicy?: StorePolicy;
}

export type PaymentProvider = 'cashfree' | 'google_play' | 'apple_iap';

export interface DailyBriefing {
  date: string;
  summary: string;
  tradition?: TraditionId;
  [key: string]: unknown;
}
