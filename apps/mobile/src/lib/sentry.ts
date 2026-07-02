/**
 * Sentry init — crash + perf telemetry (plan §2, §6). DSN comes from the
 * EXPO_PUBLIC_SENTRY_DSN build env; init is a no-op when it's unset so local
 * dev and CI don't emit. Deferred slightly so it never blocks first paint.
 */
import * as Sentry from '@sentry/react-native';

export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    // Perf regressions matter here; keep a low sample rate in prod.
    enableAutoPerformanceTracing: true,
  });
}

export { Sentry };
