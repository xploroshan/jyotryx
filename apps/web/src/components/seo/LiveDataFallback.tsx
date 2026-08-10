import { liveDataDisabled } from "@/lib/seo/server-api";

/**
 * Placeholder shown where a live data block (panchang timings / horoscope
 * forecast) would be when its payload is null.
 *
 * TWO different situations produce a null payload and they must NOT read
 * the same way:
 *
 *  1. Transient upstream failure — the API blipped. "…being prepared,
 *     please refresh in a moment" is accurate: the block really does come
 *     back on the next revalidation. Keep that copy.
 *
 *  2. DISABLE_LIVE_DATA=true — a deliberate, indefinite operator choice
 *     (backend scaled down to save money). Here "refresh in a moment"
 *     would be a lie that never resolves, and a permanent
 *     "data unavailable" notice is exactly the thin-content signal we do
 *     not want crawlers indexing on hundreds of city/sign pages. So render
 *     NOTHING — the rest of the page is static, complete and valuable on
 *     its own, and a first-time visitor simply sees a page without that
 *     section rather than an apology.
 */
export function LiveDataFallback({
  message,
  variant = "text",
}: {
  /** Copy used ONLY for a transient failure. */
  message: string;
  /** "card" matches the panchang surface-card block; "text" a plain line. */
  variant?: "text" | "card";
}) {
  if (liveDataDisabled()) return null;

  if (variant === "card") {
    return (
      <section className="surface-card p-6 mb-6 text-sm text-[rgba(12,8,5,0.72)]">
        {message}
      </section>
    );
  }
  return <p className="text-sm text-[rgba(12,8,5,0.72)]">{message}</p>;
}

export default LiveDataFallback;
