import type { MetadataRoute } from 'next';
import { allSitemapEntries } from '@/lib/seo/sitemap-entries';

/**
 * Dynamic sitemap.xml — Next auto-serves this from /sitemap.xml.
 *
 * All inclusion rules live in src/lib/seo/sitemap-entries.ts (unit-tested):
 * content-gated localized URLs (thin locales are de-listed until their
 * translations land, then re-appear automatically), tradition tool pages,
 * and honest per-group lastModified dates instead of a request-time stamp.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return allSitemapEntries();
}
