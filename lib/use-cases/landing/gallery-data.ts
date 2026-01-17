/**
 * Landing × Gallery composition (server-only).
 *
 * Cross-domain orchestration is intentionally kept outside `lib/modules/*`
 * to preserve module isolation (ARCHITECTURE.md Appendix A).
 */

import 'server-only';

import type { LandingSection, GalleryContent } from '@/lib/types/landing';
import type { GalleryItem } from '@/lib/types/gallery';
import {
  getVisibleGalleryItemsByCategoryId,
  getVisibleGalleryItemsBySurface,
} from '@/lib/modules/gallery/io';

const DEFAULT_GALLERY_LIMIT = 12;

function getGalleryLimit(section: LandingSection): number {
  const content = (section.content_en || section.content_zh) as GalleryContent | null;
  if (content && typeof content.limit === 'number' && content.limit >= 1 && content.limit <= 12) {
    return content.limit;
  }
  return DEFAULT_GALLERY_LIMIT;
}

/**
 * Fetch gallery data for all gallery-type landing sections.
 *
 * For each section that needs gallery data (section_type === 'gallery' or section_key === 'product_design'),
 * this function fetches the appropriate gallery items based on either:
 * - gallery_category_id: Items from a specific category
 * - gallery_surface: Featured pins from 'home' or 'gallery' surface
 *
 * @returns Record mapping section ID to array of gallery items
 */
export async function fetchGalleryDataForSections(
  sections: LandingSection[]
): Promise<Record<string, GalleryItem[]>> {
  const gallerySections = sections.filter(
    (s) => s.section_type === 'gallery' || s.section_key === 'product_design'
  );

  if (gallerySections.length === 0) {
    return {};
  }

  const results = await Promise.all(
    gallerySections.map(async (section) => {
      const limit = getGalleryLimit(section);

      let items: GalleryItem[] = [];

      if (section.gallery_category_id) {
        items = await getVisibleGalleryItemsByCategoryId(section.gallery_category_id, limit);
      } else if (section.gallery_surface) {
        items = await getVisibleGalleryItemsBySurface(section.gallery_surface, limit);
      }

      return { sectionId: section.id, items };
    })
  );

  const resultMap: Record<string, GalleryItem[]> = {};
  for (const { sectionId, items } of results) {
    resultMap[sectionId] = items;
  }

  return resultMap;
}

