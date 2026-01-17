/**
 * Cached landing × gallery composition.
 *
 * This wraps cross-domain orchestration with `cachedQuery` so public SSR can
 * reuse results without importing cross-module dependencies inside `lib/modules/*`.
 */

import { cachedQuery } from '@/lib/cache/wrapper';
import type { LandingSection } from '@/lib/types/landing';
import type { GalleryItem } from '@/lib/types/gallery';
import { fetchGalleryDataForSections } from './gallery-data';

const CACHE_REVALIDATE_SECONDS = 60;

export const fetchGalleryDataForSectionsCached = cachedQuery(
  async (sections: LandingSection[]): Promise<Record<string, GalleryItem[]>> =>
    fetchGalleryDataForSections(sections),
  ['landing-gallery-data'],
  ['landing-sections', 'gallery'],
  CACHE_REVALIDATE_SECONDS
);

