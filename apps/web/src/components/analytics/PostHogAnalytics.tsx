import Script from "next/script";

/**
 * PostHog product analytics (funnels, retention cohorts, session insight),
 * loaded the same way as GA4 — a `next/script` snippet rather than the
 * `posthog-js` npm package. This keeps the client bundle lean and mirrors the
 * existing GoogleAnalytics pattern (no new dependency to audit or update).
 *
 * Rendered only when NEXT_PUBLIC_POSTHOG_KEY is set (see layout.tsx), so dev /
 * un-keyed environments stay analytics-free without a code change. The project
 * API host defaults to PostHog Cloud US; set NEXT_PUBLIC_POSTHOG_HOST to the EU
 * host (https://eu.i.posthog.com) or a same-origin reverse-proxy path to dodge
 * ad-blockers. `person_profiles: 'identified_only'` avoids minting a profile
 * for every anonymous crawler hit — profiles start only once we `identify()`.
 *
 * The blob below is PostHog's official loader snippet (verbatim); the project
 * key and host are interpolated via JSON.stringify so they're always
 * correctly quoted.
 */
export function PostHogAnalytics({ apiKey, host }: { apiKey: string; host: string }) {
  return (
    <Script id="posthog-init" strategy="afterInteractive">
      {`!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init(${JSON.stringify(apiKey)},{api_host:${JSON.stringify(host)},person_profiles:'identified_only'});`}
    </Script>
  );
}
