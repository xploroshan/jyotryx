/**
 * Feature-gating helper — the client-side mirror of the API's
 * `feature-access.service.ts`. The API remains the source of truth; this is
 * only for pre-flight UX (show a paywall before firing a request the backend
 * would reject).
 *
 * Default policies are F/C/E/P, but access is RUNTIME-CONFIGURABLE: SiteSettings
 * can flip `freeMode` on, disable subscriptions, or re-price credits, and
 * per-user entitlements unlock E-gated features. Never hard-code a gate in a
 * screen — resolve it through {@link resolveAccess}.
 */

export type FeatureGate =
  | 'free' // F — always available
  | 'credit' // C — costs credits per use
  | 'entitlement' // E — one-time unlock (report / palmistry)
  | 'premium'; // P — requires an active subscription

export interface GatingConfig {
  /** SiteSettings `feature.free_mode` — everything is free while true. */
  freeMode: boolean;
  /** SiteSettings `feature.subscriptions_enabled`. */
  subscriptionsEnabled: boolean;
  /** Per-feature credit cost (SiteSettings `pricing.credits.*`), keyed by feature slug. */
  creditCosts: Record<string, number>;
}

export interface UserAccess {
  credits: number;
  isPremium: boolean;
  /** Entitlement keys the user owns (e.g. `report:career`, `palmistry`). */
  entitlements: string[];
}

export type AccessDecision =
  | { allowed: true; reason: 'free' | 'freeMode' | 'entitled' | 'premium' | 'hasCredits' }
  | { allowed: false; reason: 'needCredits' | 'needEntitlement' | 'needPremium'; costCredits?: number };

/**
 * Resolve whether a user may use a feature right now, given the runtime
 * gating config and the user's balance/entitlements.
 */
export function resolveAccess(
  gate: FeatureGate,
  featureKey: string,
  config: GatingConfig,
  user: UserAccess,
): AccessDecision {
  if (gate === 'free' || config.freeMode) {
    return { allowed: true, reason: gate === 'free' ? 'free' : 'freeMode' };
  }

  switch (gate) {
    case 'entitlement':
      return user.entitlements.includes(featureKey)
        ? { allowed: true, reason: 'entitled' }
        : { allowed: false, reason: 'needEntitlement' };

    case 'premium':
      if (!config.subscriptionsEnabled) {
        // Subs disabled → fall back to treating it as a credit feature.
        return resolveCredit(featureKey, config, user);
      }
      return user.isPremium
        ? { allowed: true, reason: 'premium' }
        : { allowed: false, reason: 'needPremium' };

    case 'credit':
    default:
      return resolveCredit(featureKey, config, user);
  }
}

function resolveCredit(featureKey: string, config: GatingConfig, user: UserAccess): AccessDecision {
  const cost = config.creditCosts[featureKey] ?? 1;
  if (user.isPremium) return { allowed: true, reason: 'premium' };
  return user.credits >= cost
    ? { allowed: true, reason: 'hasCredits' }
    : { allowed: false, reason: 'needCredits', costCredits: cost };
}
