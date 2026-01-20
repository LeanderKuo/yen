/**
 * Gallery Hotspots IO
 *
 * Database operations for gallery hotspots (public reads).
 * Uses anonymous Supabase client for caching-safe public reads.
 *
 * Ordering rules (per PRD Implementation Contract):
 * - Auto mode (all sort_order NULL): ORDER BY y ASC, x ASC, created_at ASC
 * - Manual mode (all sort_order NOT NULL): ORDER BY sort_order ASC, created_at ASC
 *
 * @module lib/modules/gallery/gallery-hotspots-io
 * @see ARCHITECTURE.md §3.4 - IO module splitting
 * @see doc/specs/proposed/GALLERY_HERO_IMAGE_AND_HOTSPOTS.md - Implementation Contract
 */

import 'server-only';

import { createAnonClient } from '@/lib/infrastructure/supabase/anon';
import type { GalleryHotspotPublic } from '@/lib/types/gallery';

/**
 * Get visible hotspots for a gallery item
 *
 * Returns only visible hotspots for visible items (RLS enforced).
 * Ordering follows PRD contract: auto (y→x) or manual (sort_order).
 */
export async function getHotspotsByItemId(
    itemId: string
): Promise<GalleryHotspotPublic[]> {
    const supabase = createAnonClient();

    // First, check if item exists and is visible
    const { data: item } = await supabase
        .from('gallery_items')
        .select('id')
        .eq('id', itemId)
        .eq('is_visible', true)
        .single();

    if (!item) {
        return [];
    }

    // Fetch all visible hotspots for the item
    const { data: hotspots, error } = await supabase
        .from('gallery_hotspots')
        .select('id, x, y, media, preview, symbolism, description_md, read_more_url, sort_order, created_at')
        .eq('item_id', itemId)
        .eq('is_visible', true);

    if (error) {
        console.error('Error fetching gallery hotspots:', error);
        return [];
    }

    if (!hotspots || hotspots.length === 0) {
        return [];
    }

    // Determine ordering mode: auto vs manual
    // Auto mode: ALL sort_order are NULL
    // Manual mode: ALL sort_order are NOT NULL
    const hasManualOrder = hotspots.every((h) => h.sort_order !== null);

    // Sort based on mode
    const sorted = [...hotspots].sort((a, b) => {
        if (hasManualOrder) {
            // Manual mode: sort by sort_order, then created_at
            const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
            if (orderDiff !== 0) return orderDiff;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        } else {
            // Auto mode: sort by y, then x, then created_at
            const yDiff = a.y - b.y;
            if (Math.abs(yDiff) > 0.001) return yDiff;
            const xDiff = a.x - b.x;
            if (Math.abs(xDiff) > 0.001) return xDiff;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
    });

    // Map to public DTO (exclude sort_order and created_at)
    return sorted.map((h) => ({
        id: h.id,
        x: h.x,
        y: h.y,
        media: h.media,
        preview: h.preview,
        symbolism: h.symbolism,
        description_md: h.description_md,
        read_more_url: h.read_more_url,
    }));
}
