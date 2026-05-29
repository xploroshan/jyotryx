"use client";

import { useEffect } from "react";
import { useI18nStore } from "@/i18n";

/**
 * Keeps the document's <html lang> attribute in sync with the active
 * locale. The root layout is a server component that hard-codes
 * lang="en"; without this, switching to any of the other 11 languages
 * leaves screen readers announcing English pronunciation and misreports
 * the page language to search engines. Renders nothing.
 */
export default function HtmlLangSync() {
  const locale = useI18nStore((s) => s.locale);
  useEffect(() => {
    if (locale && typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);
  return null;
}
