"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-surface-950 mb-2">Something went wrong</h2>
        <p className="text-sm text-[rgba(12,8,5,0.46)] mb-3">An unexpected error occurred. Please try again.</p>
        {error?.message && (
          <p className="text-[11px] text-[rgba(12,8,5,0.40)] font-mono break-words mb-4 px-3 py-2 rounded bg-[rgba(255,252,245,0.78)]">
            {error.message}
          </p>
        )}
        {error?.digest && (
          <p className="text-[10px] text-[rgba(12,8,5,0.32)] mb-4">Ref: {error.digest}</p>
        )}
        <button onClick={reset} className="px-6 py-2.5 rounded-lg btn-primary text-sm">
          Try Again
        </button>
      </div>
    </div>
  );
}
