import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/lib/seo/server-api';

/**
 * /robots.txt
 *
 * Crawl everything user-facing. Disallow only:
 *   - the admin console (would 404 to non-admins anyway, but no point
 *     paying a crawl request to find that out)
 *   - the auth tab and reset-password (transient pages with no SEO value)
 *   - /checkout (authenticated, transactional — nothing to index)
 *   - /profile (per-user, behind auth)
 *   - anything under /api (handled by the API host, but a defensive
 *     disallow keeps misconfigured crawlers from hammering it through
 *     a Vercel-side rewrite if one is ever added)
 *
 * We ALSO list the major AI / answer-engine crawlers explicitly. They are
 * already covered by the `*` rule, but naming them documents intent and
 * makes it a one-line change to throttle or block any single one later
 * without touching the catch-all. Being crawlable by these is what gets
 * the brand surfaced inside ChatGPT, Claude, Perplexity, and Google's AI
 * Overviews / Gemini grounding.
 */
const COMMON_DISALLOW = ['/admin', '/admin/', '/auth', '/reset-password', '/checkout', '/api/', '/profile'];

// Answer-engine + training crawlers we explicitly welcome.
const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', // OpenAI
  'ClaudeBot', 'Claude-User', 'anthropic-ai', // Anthropic
  'PerplexityBot', 'Perplexity-User', // Perplexity
  'Google-Extended', // Gemini / Vertex grounding
  'Applebot-Extended', // Apple Intelligence
  'Amazonbot', 'Bytespider', 'CCBot', // Alexa, TikTok, Common Crawl
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: COMMON_DISALLOW,
      },
      {
        userAgent: AI_CRAWLERS,
        allow: '/',
        disallow: COMMON_DISALLOW,
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
