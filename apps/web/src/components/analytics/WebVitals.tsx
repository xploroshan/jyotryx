"use client";

import { useReportWebVitals } from "next/web-vitals";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

/**
 * Forwards Core Web Vitals (LCP, INP, CLS, FCP, TTFB) to the analytics sinks
 * so real-user load performance is monitored in the field — previously these
 * were never captured. CLS is sent ×1000 as an integer (analytics dislikes
 * tiny floats); other metrics are rounded ms. SSR-safe: track() no-ops without
 * a window, and this component renders nothing.
 */
export default function WebVitals() {
  const pathname = usePathname();

  useReportWebVitals((metric) => {
    const value =
      metric.name === "CLS" ? Math.round(metric.value * 1000) : Math.round(metric.value);
    track("web_vitals", {
      metric: metric.name,
      value,
      rating: (metric as { rating?: string }).rating ?? "",
      path: pathname,
    });
  });

  return null;
}
