/**
 * Landing Section IO - Public Reads
 *
 * Server-side IO helpers for landing section database queries.
 * Uses an anonymous Supabase client (no cookies) so it can be safely used
 * by cached reads and metadata generation.
 *
 * @module lib/modules/landing/io
 * @see lib/infrastructure/supabase/anon.ts
 */

import 'server-only';
import { createAnonClient } from '@/lib/infrastructure/supabase/anon';
import type { LandingSection } from '@/lib/types/landing';

/**
 * Get all visible landing sections ordered by sort_order
 *
 * Used for rendering the public landing page.
 * Only returns sections where is_visible = true.
 */
export async function getVisibleLandingSections(): Promise<LandingSection[]> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from('landing_sections')
    .select(`
      id,
      section_key,
      section_type,
      sort_order,
      is_visible,
      title_en,
      title_zh,
      subtitle_en,
      subtitle_zh,
      content_en,
      content_zh,
      gallery_category_id,
      gallery_surface,
      created_at,
      updated_at
    `)
    .eq('is_visible', true)
    .order('sort_order');

  if (error) {
    console.error('Error fetching visible landing sections:', error);
    return [];
  }

  return (data ?? []) as LandingSection[];
}

/**
 * Get a visible landing section by section_key
 *
 * Used for generating SEO metadata or specific section lookups.
 */
export async function getVisibleLandingSectionByKey(
  sectionKey: string
): Promise<LandingSection | null> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from('landing_sections')
    .select('*')
    .eq('section_key', sectionKey)
    .eq('is_visible', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data as LandingSection;
}
