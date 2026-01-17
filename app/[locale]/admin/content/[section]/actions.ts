'use server';

/**
 * Server action for saving site content
 * 
 * Uses lib/content.ts functions for updating and toggling publish.
 * Handles cache invalidation with revalidatePath.
 */

import { updateSiteContent, togglePublishSiteContent } from '@/lib/modules/content/io';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { revalidatePath, revalidateTag } from 'next/cache';

interface SaveResult {
  success: boolean;
  error?: string;
}

/**
 * Save site content (single-language zh; mirror to content_en for legacy)
 */
export async function saveSiteContent(
  sectionKey: string,
  content: Record<string, unknown>,
  locale: string
): Promise<SaveResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: '尚未登入' };
    }
    
    // DB schema still has content_en/content_zh; keep them identical for single-language site.
    const result = await updateSiteContent(sectionKey, content, content, user.id);
    
    if (!result) {
      return { success: false, error: '儲存內容失敗' };
    }
    
    // Invalidate cached site content (Header/Footer/Home rely on unstable_cache tags)
    revalidateTag('site-content', { expire: 0 });

    // Revalidate paths
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/admin/content`);
    revalidatePath(`/${locale}/admin/content/${sectionKey}`);
    
    // Gallery-specific revalidation
    if (sectionKey === 'gallery') {
      revalidatePath(`/${locale}/gallery`);
      revalidatePath('/sitemap.xml');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error saving site content:', error);
    return { success: false, error: '發生未預期的錯誤' };
  }
}

/**
 * Publish site content section
 */
export async function publishSiteContent(
  sectionKey: string,
  locale: string
): Promise<SaveResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: '尚未登入' };
    }
    
    const result = await togglePublishSiteContent(sectionKey, true, user.id);
    
    if (!result) {
      return { success: false, error: '發布失敗' };
    }
    
    // Invalidate cached site content (Header/Footer/Home rely on unstable_cache tags)
    revalidateTag('site-content', { expire: 0 });

    // Revalidate paths
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/admin/content`);
    revalidatePath(`/${locale}/admin/content/${sectionKey}`);
    
    // Gallery-specific revalidation
    if (sectionKey === 'gallery') {
      revalidatePath(`/${locale}/gallery`);
      revalidatePath('/sitemap.xml');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error publishing site content:', error);
    return { success: false, error: '發生未預期的錯誤' };
  }
}

/**
 * Unpublish site content section
 */
export async function unpublishSiteContent(
  sectionKey: string,
  locale: string
): Promise<SaveResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: '尚未登入' };
    }
    
    const result = await togglePublishSiteContent(sectionKey, false, user.id);
    
    if (!result) {
      return { success: false, error: '取消發布失敗' };
    }
    
    // Invalidate cached site content (Header/Footer/Home rely on unstable_cache tags)
    revalidateTag('site-content', { expire: 0 });

    // Revalidate paths
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/admin/content`);
    revalidatePath(`/${locale}/admin/content/${sectionKey}`);
    
    // Gallery-specific revalidation
    if (sectionKey === 'gallery') {
      revalidatePath(`/${locale}/gallery`);
      revalidatePath('/sitemap.xml');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error unpublishing site content:', error);
    return { success: false, error: '發生未預期的錯誤' };
  }
}
