'use client';

import { useTranslation, type Locale } from '@/i18n';

const locales: { code: Locale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हि' },
];

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="flex items-center rounded-lg border divider bg-white/[0.03] overflow-hidden">
      {locales.map((l) => (
        <button
          key={l.code}
          onClick={() => setLocale(l.code)}
          className={`px-2.5 py-1 text-xs font-medium transition-colors ${
            locale === l.code
              ? 'bg-primary-600/20 text-primary-400'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
