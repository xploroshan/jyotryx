"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useI18nStore } from "@/i18n";
import { isLocale } from "@/i18n/locales";

/**
 * Keeps the document's <html lang> attribute in sync with the active locale.
 * The root layout is a server component that hard-codes lang="en"; without
 * this, the other 11 languages would be announced as English by screen
 * readers and mis-detected by search engines.
 *
 * On a localized `/<locale>/…` route the URL is authoritative (it's where
 * the server-rendered translated content came from); elsewhere we fall back
 * to the client locale store. Renders nothing.
 */
export default function HtmlLangSync() {
  const storeLocale = useI18nStore((s) => s.locale);
  const pathname = usePathname();
  useEffect(() => {
    const seg = pathname?.split("/")[1];
    const lang = isLocale(seg) && seg !== "en" ? seg : storeLocale;
    if (lang && typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [pathname, storeLocale]);
  return null;
}
