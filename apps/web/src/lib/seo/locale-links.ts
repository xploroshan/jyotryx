/**
 * Client-safe helpers for linking between the English root tree and the
 * /<locale>/… tree. Pure data + string logic only (no server-api import) so
 * the LanguageSwitcher can use it without dragging server modules into the
 * client bundle.
 */
import {
  LANDING_LOCALES,
  PANCHANG_LOCALES,
  PREFIXED_LOCALES,
  type Locale,
} from "@/i18n/locales";
import { LOCALIZED_PATHS } from "./feature-pages";
import { listSignSlugs } from "./zodiac";
import { listCitySlugs } from "./cities";

/** Display metadata for every supported locale (shared by switcher + link row). */
export const LOCALE_LABELS: { code: Locale; label: string; native: string }[] = [
  { code: "en", label: "EN", native: "English" },
  { code: "hi", label: "हि", native: "हिन्दी" },
  { code: "ta", label: "த", native: "தமிழ்" },
  { code: "te", label: "తె", native: "తెలుగు" },
  { code: "bn", label: "বা", native: "বাংলা" },
  { code: "mr", label: "म", native: "मराठी" },
  { code: "gu", label: "ગુ", native: "ગુજરાતી" },
  { code: "kn", label: "ಕ", native: "ಕನ್ನಡ" },
  { code: "ml", label: "മ", native: "മലയാളം" },
  { code: "pa", label: "ਪੰ", native: "ਪੰਜਾਬੀ" },
  { code: "or", label: "ଓ", native: "ଓଡ଼ିଆ" },
  { code: "as", label: "অ", native: "অসমীয়া" },
];

const PERIODS = new Set(["weekly", "monthly", "yearly"]);
const SIGN_SLUGS = new Set(listSignSlugs());
const CITY_SLUGS = new Set(listCitySlugs());

/** Relative href for `path` in `locale` (English lives at the root). */
export function relativeLocaleHref(locale: Locale, path: string): string {
  if (locale === "en") return path === "" ? "/" : path;
  return `/${locale}${path === "/" ? "" : path}`;
}

/** Strip a leading /<locale> prefix, returning the locale-less base path. */
export function stripLocalePrefix(pathname: string): string {
  const parts = pathname.split("/");
  if (PREFIXED_LOCALES.includes(parts[1] as Locale)) {
    const rest = `/${parts.slice(2).join("/")}`;
    return rest === "/" ? "/" : rest.replace(/\/$/, "");
  }
  return pathname === "" ? "/" : pathname;
}

/**
 * The equivalent of `pathname` in `code`'s tree, or null when no such route
 * exists (e.g. /reports has no /hi variant — callers keep their store-only
 * behavior for that case rather than teleporting the user to the locale home).
 *
 * Route existence mirrors the app tree exactly:
 *  - LOCALIZED_PATHS (feature pages + home) exist in every prefixed locale;
 *  - /horoscope/[sign](/[period]) exist for LANDING_LOCALES;
 *  - /panchang/[city] exist for PANCHANG_LOCALES;
 *  - everything else is root-only.
 */
export function switchHref(code: Locale, pathname: string): string | null {
  const base = stripLocalePrefix(pathname);
  if (code === "en") return base;

  if (LOCALIZED_PATHS.includes(base)) return relativeLocaleHref(code, base);

  const seg = base.split("/").filter(Boolean);
  if (
    seg[0] === "horoscope" &&
    seg.length >= 2 &&
    SIGN_SLUGS.has(seg[1]) &&
    (seg.length === 2 || (seg.length === 3 && PERIODS.has(seg[2]))) &&
    LANDING_LOCALES.includes(code)
  ) {
    return relativeLocaleHref(code, base);
  }
  if (
    seg[0] === "panchang" &&
    seg.length === 2 &&
    CITY_SLUGS.has(seg[1]) &&
    PANCHANG_LOCALES.includes(code)
  ) {
    return relativeLocaleHref(code, base);
  }
  return null;
}
