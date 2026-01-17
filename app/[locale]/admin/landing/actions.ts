'use server';

/**
 * Landing Section Admin Actions
 *
 * Server actions for landing section management with cache revalidation.
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import {
  createLandingSection as createSection,
  updateLandingSection as updateSection,
  deleteLandingSection as deleteSection,
  getNextAvailableCustomKey,
  updateSectionSortOrders,
} from '@/lib/modules/landing/admin-io';
import type { LandingSectionInput, LandingSectionType } from '@/lib/types/landing';

/**
 * Revalidate all landing-related caches
 */
function revalidateLandingCaches() {
  // Invalidate cached landing section data
  revalidateTag('landing-sections', { expire: 0 });
  
  // Single-language site (zh)
  revalidatePath('/zh');
  revalidatePath('/sitemap.xml');
}

/**
 * Toggle section visibility
 */
export async function toggleSectionVisibility(
  sectionKey: string,
  isVisible: boolean
): Promise<{ success: boolean; error?: string }> {
  const result = await updateSection(sectionKey, { is_visible: isVisible });
  
  if (result.success) {
    revalidateLandingCaches();
  }
  
  return { success: result.success, error: result.error };
}

/**
 * Update section sort order
 */
export async function updateSectionOrder(
  sectionKey: string,
  sortOrder: number
): Promise<{ success: boolean; error?: string }> {
  const result = await updateSection(sectionKey, { sort_order: sortOrder });
  
  if (result.success) {
    revalidateLandingCaches();
  }
  
  return { success: result.success, error: result.error };
}

/**
 * Batch update section sort orders
 */
export async function batchUpdateSortOrders(
  updates: Array<{ section_key: string; sort_order: number }>
): Promise<{ success: boolean; error?: string }> {
  const result = await updateSectionSortOrders(updates);
  
  if (result.success) {
    revalidateLandingCaches();
  }
  
  return { success: result.success, error: result.error };
}

/**
 * Create a new custom section
 */
export async function createCustomSection(input: {
  section_type: LandingSectionType;
  title_zh?: string;
}): Promise<{ success: boolean; sectionKey?: string; error?: string }> {
  // Get next available custom key
  const nextKey = await getNextAvailableCustomKey();
  
  if (!nextKey) {
    return { success: false, error: '自訂區塊已達上限（10）' };
  }
  
  const titleZh = input.title_zh || '新區塊';
  const sectionInput: LandingSectionInput = {
    section_key: nextKey,
    section_type: input.section_type,
    // DB schema still has title_en/title_zh; keep them identical for single-language site.
    title_en: titleZh,
    title_zh: titleZh,
    is_visible: false, // Start hidden
  };
  
  const result = await createSection(sectionInput);
  
  if (result.success) {
    revalidateLandingCaches();
    return { success: true, sectionKey: nextKey };
  }
  
  return { success: false, error: result.error };
}

/**
 * Update a section
 */
export async function updateSectionAction(
  sectionKey: string,
  input: LandingSectionInput
): Promise<{ success: boolean; error?: string }> {
  const result = await updateSection(sectionKey, input);
  
  if (result.success) {
    revalidateLandingCaches();
  }
  
  return { success: result.success, error: result.error };
}

/**
 * Delete a custom section
 */
export async function deleteSectionAction(
  sectionKey: string
): Promise<{ success: boolean; error?: string }> {
  const result = await deleteSection(sectionKey);
  
  if (result.success) {
    revalidateLandingCaches();
  }
  
  return { success: result.success, error: result.error };
}
