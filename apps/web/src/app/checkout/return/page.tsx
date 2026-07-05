"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore, useAuthHydrated } from "@/lib/store";
import { api } from "@/lib/api";
import { useTranslation } from "@/i18n";

/**
 * Cashfree return-URL handler. Used when checkout does a full-page redirect
 * (e.g. a UPI app-switch on mobile) instead of the in-page `_modal` flow, so
 * React state from the checkout page is gone.
 *
 * Cashfree substitutes `{order_id}` into the return_url; we also pass `pid`
 * (the product id) so we can route to the right success destination. For
 * subscriptions the return_url carries `subscriptionId` — Premium is granted
 * by the webhook, so here we just bounce the user onward.
 *
 * The grant itself is idempotent and server-authoritative: calling
 * /payments/verify here is safe even if the webhook already granted.
 */

/** Map a productId back to its post-purchase destination. */
function successRedirectFor(pid: string | null): string {
  if (!pid) return "/chat";
  if (pid.startsWith("credits")) return "/chat";
  // The palmistry *reading* (palm_reading → PALMISTRY entitlement) unlocks on
  // /palmistry. The palm *report* (report_palm → REPORT_PALM entitlement) is a
  // Report and must route to /reports so it auto-generates there — sending it to
  // /palmistry left the paid report ungenerated and demanded a different
  // entitlement. So only palm_reading maps to /palmistry; report_* falls through.
  if (pid === "palm_reading") return "/palmistry?unlocked=1";
  if (pid.startsWith("report_")) {
    const rt = pid.replace(/^report_/, "").toUpperCase();
    return `/reports?unlocked=${rt}`;
  }
  return "/chat";
}

function ReturnInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useTranslation();
  const hydrated = useAuthHydrated();
  const { isAuthenticated, accessToken } = useAuthStore();
  const [failed, setFailed] = useState(false);
  // Guard against React 18 double-invoke / re-renders firing verify twice.
  const ran = useRef(false);

  const orderId = params.get("orderId");
  const subscriptionId = params.get("subscriptionId");
  const pid = params.get("pid");

  useEffect(() => {
    if (!hydrated) return;
    if (ran.current) return;
    ran.current = true;

    if (!isAuthenticated) {
      router.replace("/auth?mode=login");
      return;
    }

    // Subscription authorization return — Premium is granted by the webhook;
    // send the user to chat where Premium state will reflect once it lands.
    if (subscriptionId && !orderId) {
      router.replace("/chat");
      return;
    }

    if (!orderId) {
      setFailed(true);
      return;
    }

    api
      .post<{ verified: boolean }>(
        "/payments/verify",
        { orderId },
        { token: accessToken! },
      )
      .then((res) => {
        if (res.verified) {
          router.replace(successRedirectFor(pid));
        } else {
          // Not settled yet — the webhook may still complete it; show a soft
          // message rather than implying failure.
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
  }, [hydrated, isAuthenticated, orderId, subscriptionId, pid, accessToken, router]);

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center fade-in-up">
      {failed ? (
        <div className="surface-card p-8">
          <p className="text-sm text-[rgba(12,8,5,0.72)] mb-4">{t.common.error}</p>
          <button
            onClick={() => router.push("/pricing")}
            className="btn-secondary px-4 py-2 rounded-lg text-sm"
          >
            {t.common.back}
          </button>
        </div>
      ) : (
        <p className="text-sm text-[rgba(12,8,5,0.66)]">{t.common.processing}</p>
      )}
    </div>
  );
}

export default function CheckoutReturnPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <p className="text-sm text-[rgba(12,8,5,0.66)]">{t.common.loading}</p>
        </div>
      }
    >
      <ReturnInner />
    </Suspense>
  );
}
