import type { MetadataRoute } from 'next';
import { SEO_CITIES } from '@/lib/seo/cities';
import { ZODIAC_SIGNS } from '@/lib/seo/zodiac';
import { SITE_ORIGIN } from '@/lib/seo/server-api';

/**
 * Dynamic sitemap.xml.
 *
 * Three classes of URLs:
 *   1. Static marketing/feature pages (high priority, weekly cadence).
 *   2. Per-sign horoscope landing pages (12 pages, daily cadence — the
 *      forecast text changes daily even though the URL doesn't).
 *   3. Per-city panchang + kundli pages (~100 pages, daily for panchang
 *      and weekly for kundli landing).
 *
 * Next.js auto-serves this from /sitemap.xml — no manual route or file.
 */

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const base = SITE_ORIGIN;

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`,                    lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/horoscope`,           lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/panchang`,            lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/panchang/cities`,     lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/kundli`,              lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/kundli/cities`,       lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/matching`,            lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/numerology`,          lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/tarot`,               lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/palmistry`,           lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${base}/vastu`,               lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${base}/muhurat`,             lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/pricing`,             lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const signPages: MetadataRoute.Sitemap = ZODIAC_SIGNS.map((sign) => ({
    url: `${base}/horoscope/${sign.slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }));

  // Weekly / monthly / yearly horoscope pages per sign (12 × 3 = 36).
  // Each carries its own search volume and refreshes on the period's
  // natural cadence.
  const signPeriodPages: MetadataRoute.Sitemap = ZODIAC_SIGNS.flatMap((sign) =>
    (['weekly', 'monthly', 'yearly'] as const).map((period) => ({
      url: `${base}/horoscope/${sign.slug}/${period}`,
      lastModified: now,
      changeFrequency: period,
      priority: 0.75,
    })),
  );

  const panchangCityPages: MetadataRoute.Sitemap = SEO_CITIES.map((city) => ({
    url: `${base}/panchang/${city.slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  const kundliCityPages: MetadataRoute.Sitemap = SEO_CITIES.map((city) => ({
    url: `${base}/kundli/${city.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.75,
  }));

  return [...staticPages, ...signPages, ...signPeriodPages, ...panchangCityPages, ...kundliCityPages];
}
