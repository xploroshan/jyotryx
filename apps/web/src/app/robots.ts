import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/lib/seo/server-api';

/**
 * /robots.txt
 *
 * Crawl everything user-facing. Disallow only:
 *   - the admin console (would 404 to non-admins anyway, but no point
 *     paying a crawl request to find that out)
 *   - the auth tab and reset-password (transient pages with no SEO value)
 *   - anything under /api (handled by the API host, but a defensive
 *     disallow keeps misconfigured crawlers from hammering it through
 *     a Vercel-side rewrite if one is ever added)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/auth', '/reset-password', '/api/', '/profile'],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
