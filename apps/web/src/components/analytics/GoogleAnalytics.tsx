import Script from "next/script";

/**
 * Google Analytics 4 (gtag.js), wired the App-Router way instead of pasting
 * the raw <head> snippet GA hands you — `next/script` with
 * `strategy="lazyOnload"` loads it without blocking first paint.
 *
 * GA4's Enhanced Measurement tracks client-side route changes (history
 * events) on its own, so no manual page_view firing on navigation is needed.
 *
 * Rendered only when NEXT_PUBLIC_GA_ID is set (see layout.tsx), so non-prod
 * environments stay analytics-free without a code change. The measurement ID
 * is public by design (it ships in client JS); the env var just keeps it out
 * of source and easy to swap.
 */
export function GoogleAnalytics({ gaId }: { gaId: string }) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="lazyOnload"
      />
      <Script id="ga-init" strategy="lazyOnload">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}
      </Script>
    </>
  );
}
