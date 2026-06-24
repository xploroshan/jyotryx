"use client";

import Link from "next/link";
import { useTranslation } from "@/i18n";

/** Friendly, localized 404 body for an unknown/expired shared-match token. */
export default function SharedMatchNotFound() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center fade-in-up">
      <h1 className="text-2xl font-bold text-surface-950 mb-2">{t.matchShare.notFoundTitle}</h1>
      <p className="text-secondary mb-6">{t.matchShare.notFoundBody}</p>
      <Link href="/matching" className="inline-block px-7 py-3 rounded-xl btn-primary text-base">
        {t.matchShare.notFoundCta}
      </Link>
    </div>
  );
}
