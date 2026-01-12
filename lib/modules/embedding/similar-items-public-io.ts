/**
 * Similar Items Public IO Module
 * @see doc/specs/completed/SUPABASE_AI.md
 * @see uiux_refactor.md §6.3.2 item 3
 *
 * Server-only module to resolve similar item IDs into displayable data.
 * Uses anon client for public reads (not service role).
 */
import 'server-only';

import { createAnonClient } from '@/lib/infrastructure/supabase/anon';
import { getSimilarItemsCached, isSemanticSearchEnabledCached } from './cached';

// ─────────────────────────────────────────────────────────────────────────────
// Post Resolver
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolved similar post for UI display.
 */
export interface ResolvedSimilarPost {
  id: string;
  slug: string;
  titleEn: string;
  titleZh: string | null;
  excerptEn: string | null;
  excerptZh: string | null;
  coverImageUrl: string | null;
  category: { slug: string; nameEn: string; nameZh: string } | null;
  publishedAt: string | null;
  similarity: number;
}

/**
 * Get similar posts resolved with post details.
 * Returns empty array if feature disabled or no similar items.
 */
export async function getResolvedSimilarPosts(
  postId: string,
  limit = 4
): Promise<ResolvedSimilarPost[]> {
  // Feature gate check
  const isEnabled = await isSemanticSearchEnabledCached();
  if (!isEnabled) return [];

  // Get similar items
  const similarItems = await getSimilarItemsCached('post', postId, limit);
  if (similarItems.length === 0) return [];

  // Filter to post type only
  const postIds = similarItems
    .filter((item) => item.targetType === 'post')
    .map((item) => item.targetId);

  if (postIds.length === 0) return [];

  // Fetch post details
  const supabase = createAnonClient();
  const { data: posts } = await supabase
    .from('posts')
    .select(`
      id,
      slug,
      title_en,
      title_zh,
      excerpt_en,
      excerpt_zh,
      cover_image_url,
      cover_image_url_en,
      cover_image_url_zh,
      published_at,
      visibility,
      category:categories(slug, name_en, name_zh)
    `)
    .in('id', postIds)
    .eq('visibility', 'public');

  if (!posts || posts.length === 0) return [];

  // Map to similarity scores
  const similarityMap = new Map<string, number>();
  for (const item of similarItems) {
    similarityMap.set(item.targetId, item.similarity);
  }

  // Transform and sort by similarity
  // Note: Supabase joins on foreign keys can return array or object depending on cardinality
  return posts
    .map((p) => {
      // Handle category - may be array or object from Supabase join
      const category = Array.isArray(p.category) ? p.category[0] : p.category;
      return {
        id: p.id as string,
        slug: p.slug as string,
        titleEn: p.title_en as string,
        titleZh: p.title_zh as string | null,
        excerptEn: p.excerpt_en as string | null,
        excerptZh: p.excerpt_zh as string | null,
        coverImageUrl: (p.cover_image_url_en || p.cover_image_url_zh || p.cover_image_url) as string | null,
        category: category
          ? { slug: category.slug as string, nameEn: category.name_en as string, nameZh: category.name_zh as string }
          : null,
        publishedAt: p.published_at as string | null,
        similarity: similarityMap.get(p.id as string) ?? 0,
      };
    })
    .sort((a, b) => b.similarity - a.similarity);
}

// ─────────────────────────────────────────────────────────────────────────────
// Gallery Item Resolver
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolved similar gallery item for UI display.
 */
export interface ResolvedSimilarGalleryItem {
  id: string;
  slug: string;
  titleEn: string;
  titleZh: string;
  imageUrl: string;
  category: { slug: string; nameEn: string; nameZh: string } | null;
  similarity: number;
}

/**
 * Get similar gallery items resolved with item details.
 * Returns empty array if feature disabled or no similar items.
 */
export async function getResolvedSimilarGalleryItems(
  galleryItemId: string,
  limit = 4
): Promise<ResolvedSimilarGalleryItem[]> {
  // Feature gate check
  const isEnabled = await isSemanticSearchEnabledCached();
  if (!isEnabled) return [];

  // Get similar items
  const similarItems = await getSimilarItemsCached('gallery_item', galleryItemId, limit);
  if (similarItems.length === 0) return [];

  // Filter to gallery_item type only
  const itemIds = similarItems
    .filter((item) => item.targetType === 'gallery_item')
    .map((item) => item.targetId);

  if (itemIds.length === 0) return [];

  // Fetch gallery item details
  const supabase = createAnonClient();
  const { data: items } = await supabase
    .from('gallery_items')
    .select(`
      id,
      slug,
      title_en,
      title_zh,
      image_url,
      is_visible,
      category:gallery_categories(slug, name_en, name_zh)
    `)
    .in('id', itemIds)
    .eq('is_visible', true);

  if (!items || items.length === 0) return [];

  // Map to similarity scores
  const similarityMap = new Map<string, number>();
  for (const item of similarItems) {
    similarityMap.set(item.targetId, item.similarity);
  }

  // Transform and sort by similarity
  // Note: Supabase joins on foreign keys can return array or object depending on cardinality
  return items
    .map((item) => {
      // Handle category - may be array or object from Supabase join
      const category = Array.isArray(item.category) ? item.category[0] : item.category;
      return {
        id: item.id as string,
        slug: item.slug as string,
        titleEn: item.title_en as string,
        titleZh: item.title_zh as string,
        imageUrl: item.image_url as string,
        category: category
          ? { slug: category.slug as string, nameEn: category.name_en as string, nameZh: category.name_zh as string }
          : null,
        similarity: similarityMap.get(item.id as string) ?? 0,
      };
    })
    .sort((a, b) => b.similarity - a.similarity);
}
