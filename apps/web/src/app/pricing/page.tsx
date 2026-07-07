import { pageMetadata } from "@/lib/seo/page-metadata";
import { HUB_PAGES } from "@/lib/seo/feature-pages";
import { fetchPricing } from "@/lib/seo/server-api";
import { jsonLdHtml } from "@/lib/seo/json-ld";
import PricingClient from "./PricingClient";

/**
 * Server wrapper for /pricing.
 *
 * The page was fully client-side: no metadata, and the Service/Offer JSON-LD
 * was injected only after a client XHR resolved — invisible to crawlers and
 * capable of emitting hardcoded fallback prices on API failure. The server
 * wrapper owns metadata + JSON-LD (emitted ONLY when live settings are in
 * hand — never from fallbacks) and seeds the client with the same settings
 * so the plan cards are in the initial HTML.
 */

export const metadata = pageMetadata({
  path: "/pricing",
  ...HUB_PAGES["/pricing"],
});

export default async function PricingPage() {
  const settings = await fetchPricing();

  const pricingEnabled = settings?.["feature.pricing_page_enabled"] === "true";
  const creditsEnabled = settings?.["feature.credits_enabled"] !== "false";

  // Mirror PricingClient's buildPlans/buildCreditPacks price parsing (same
  // defaults, applied only to a SUCCESSFUL settings response — an absent key
  // is operator shorthand for the default, whereas a failed fetch means we
  // know nothing and must not publish prices).
  const offerJsonLd =
    settings && pricingEnabled
      ? {
          "@context": "https://schema.org",
          "@type": "Service",
          name: "MyAstro360 Vedic Astrology",
          serviceType: "Online astrology consultation",
          provider: { "@type": "Organization", name: "MyAstro360" },
          offers: [
            {
              "@type": "Offer",
              name: "Annual plan",
              price: parseInt(settings["pricing.annual.price"] || "4999", 10),
              priceCurrency: "INR",
              category: "Subscription",
            },
            {
              "@type": "Offer",
              name: "Monthly plan",
              price: parseInt(settings["pricing.monthly.price"] || "499", 10),
              priceCurrency: "INR",
              category: "Subscription",
            },
            ...(creditsEnabled
              ? ([
                  ["starter", "50", "99"],
                  ["popular", "150", "249"],
                  ["pro", "500", "699"],
                ] as const).map(([id, credits, price]) => ({
                  "@type": "Offer",
                  name: `${settings[`pricing.credits.${id}.credits`] || credits} credits`,
                  price: parseInt(settings[`pricing.credits.${id}.price`] || price, 10),
                  priceCurrency: "INR",
                  category: "Credit pack",
                }))
              : []),
          ],
        }
      : null;

  return (
    <>
      {offerJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(offerJsonLd) }}
        />
      )}
      <PricingClient initialPricing={settings} />
    </>
  );
}
