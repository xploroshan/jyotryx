"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Renders the global chrome (Navbar, TraditionRail, FeatureChips, Footer)
 * for every route EXCEPT preview surfaces like /styleguide. Lets us
 * preview design overhauls without legacy chrome bleeding into the
 * frame. Keep the bare-route list small and explicit.
 */
const BARE_ROUTES = ["/styleguide"];

export function ConditionalLayoutShell({
  topChrome,
  bottomChrome,
  children,
}: {
  topChrome: ReactNode;
  bottomChrome: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const bare = BARE_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  return (
    <>
      {!bare && topChrome}
      <main
        // min-h-screen reserves a viewport of height so the footer always
        // starts BELOW the fold. Client-only/Suspense content (e.g. kundli's
        // fallback={null}, the ssr:false BentoSummary) renders after first
        // paint and grows `main`; without the reservation that pushed the
        // in-viewport footer down and registered a large layout shift (CLS).
        className={`flex-1 min-h-screen focus:outline-none ${bare ? "" : "pt-14"}`}
        tabIndex={-1}
      >
        {children}
      </main>
      {!bare && bottomChrome}
    </>
  );
}
