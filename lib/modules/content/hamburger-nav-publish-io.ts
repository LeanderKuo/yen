/**
 * Hamburger Nav Publish IO
 *
 * Deep validation for hamburger nav publish.
 * Queries the database to verify all internal targets exist and are public.
 *
 * @module lib/modules/content/hamburger-nav-publish-io
 * @see doc/specs/proposed/GALLERY_HERO_IMAGE_AND_HOTSPOTS.md (Implementation Contract C)
 */

import 'server-only';

import { createClient } from '@/lib/infrastructure/supabase/server';
import type {
    HamburgerNavV2,
    NavTarget,
    NavDeepValidationError,
    NavDeepValidationResult,
} from '@/lib/types/hamburger-nav';

// =============================================================================
// Database Validation Functions
// =============================================================================

/**
 * Check if a blog post exists and is public
 */
async function validateBlogPost(
    postSlug: string,
    path: string
): Promise<NavDeepValidationError | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('posts')
        .select('id, visibility')
        .eq('slug', postSlug)
        .maybeSingle();

    if (error) {
        return {
            path,
            message: `Database error: ${error.message}`,
            targetType: 'blog_post',
            targetSlug: postSlug,
        };
    }

    if (!data) {
        return {
            path,
            message: `Blog post "${postSlug}" does not exist`,
            targetType: 'blog_post',
            targetSlug: postSlug,
        };
    }

    if (data.visibility !== 'public') {
        return {
            path,
            message: `Blog post "${postSlug}" is not public (visibility: ${data.visibility})`,
            targetType: 'blog_post',
            targetSlug: postSlug,
        };
    }

    return null;
}

/**
 * Check if a blog category exists
 */
async function validateBlogCategory(
    categorySlug: string,
    path: string
): Promise<NavDeepValidationError | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', categorySlug)
        .maybeSingle();

    if (error) {
        return {
            path,
            message: `Database error: ${error.message}`,
            targetType: 'blog_category',
            targetSlug: categorySlug,
        };
    }

    if (!data) {
        return {
            path,
            message: `Blog category "${categorySlug}" does not exist`,
            targetType: 'blog_category',
            targetSlug: categorySlug,
        };
    }

    return null;
}

/**
 * Check if a gallery item exists and is visible
 */
async function validateGalleryItem(
    categorySlug: string,
    itemSlug: string,
    path: string
): Promise<NavDeepValidationError | null> {
    const supabase = await createClient();

    // First check category
    const { data: category, error: catError } = await supabase
        .from('gallery_categories')
        .select('id, is_visible')
        .eq('slug', categorySlug)
        .maybeSingle();

    if (catError) {
        return {
            path,
            message: `Database error: ${catError.message}`,
            targetType: 'gallery_item',
            targetSlug: `${categorySlug}/${itemSlug}`,
        };
    }

    if (!category) {
        return {
            path,
            message: `Gallery category "${categorySlug}" does not exist`,
            targetType: 'gallery_item',
            targetSlug: `${categorySlug}/${itemSlug}`,
        };
    }

    if (!category.is_visible) {
        return {
            path,
            message: `Gallery category "${categorySlug}" is not visible`,
            targetType: 'gallery_item',
            targetSlug: `${categorySlug}/${itemSlug}`,
        };
    }

    // Then check item
    const { data: item, error: itemError } = await supabase
        .from('gallery_items')
        .select('id, is_visible')
        .eq('slug', itemSlug)
        .eq('category_id', category.id)
        .maybeSingle();

    if (itemError) {
        return {
            path,
            message: `Database error: ${itemError.message}`,
            targetType: 'gallery_item',
            targetSlug: `${categorySlug}/${itemSlug}`,
        };
    }

    if (!item) {
        return {
            path,
            message: `Gallery item "${itemSlug}" does not exist in category "${categorySlug}"`,
            targetType: 'gallery_item',
            targetSlug: `${categorySlug}/${itemSlug}`,
        };
    }

    if (!item.is_visible) {
        return {
            path,
            message: `Gallery item "${itemSlug}" is not visible`,
            targetType: 'gallery_item',
            targetSlug: `${categorySlug}/${itemSlug}`,
        };
    }

    return null;
}

/**
 * Check if a gallery category exists and is visible
 */
async function validateGalleryCategory(
    categorySlug: string,
    path: string
): Promise<NavDeepValidationError | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('gallery_categories')
        .select('id, is_visible')
        .eq('slug', categorySlug)
        .maybeSingle();

    if (error) {
        return {
            path,
            message: `Database error: ${error.message}`,
            targetType: 'gallery_category',
            targetSlug: categorySlug,
        };
    }

    if (!data) {
        return {
            path,
            message: `Gallery category "${categorySlug}" does not exist`,
            targetType: 'gallery_category',
            targetSlug: categorySlug,
        };
    }

    if (!data.is_visible) {
        return {
            path,
            message: `Gallery category "${categorySlug}" is not visible`,
            targetType: 'gallery_category',
            targetSlug: categorySlug,
        };
    }

    return null;
}

/**
 * Validate a single target (deep validation)
 */
async function validateTarget(
    target: NavTarget,
    path: string
): Promise<NavDeepValidationError | null> {
    switch (target.type) {
        case 'blog_post':
            return validateBlogPost(target.postSlug, path);

        case 'blog_category':
            return validateBlogCategory(target.categorySlug, path);

        case 'gallery_item':
            return validateGalleryItem(target.categorySlug, target.itemSlug, path);

        case 'gallery_category':
            return validateGalleryCategory(target.categorySlug, path);

        // These don't need DB validation
        case 'blog_index':
        case 'gallery_index':
        case 'page':
        case 'anchor':
        case 'external':
            return null;

        default: {
            const _exhaustive: never = target;
            return null;
        }
    }
}

// =============================================================================
// Main Deep Validation Function
// =============================================================================

/**
 * Deep validate hamburger nav for publish
 *
 * Verifies all internal targets point to existing, public content.
 * This should be called before publishing the nav.
 *
 * @param nav - The hamburger nav v2 structure to validate
 * @returns Validation result with any errors found
 */
export async function deepValidateHamburgerNav(
    nav: HamburgerNavV2
): Promise<NavDeepValidationResult> {
    const errors: NavDeepValidationError[] = [];

    // Validate all targets in parallel (with concurrency limit)
    const validationPromises: Promise<NavDeepValidationError | null>[] = [];

    for (let gi = 0; gi < nav.groups.length; gi++) {
        const group = nav.groups[gi];
        for (let ii = 0; ii < group.items.length; ii++) {
            const item = group.items[ii];
            const path = `groups[${gi}].items[${ii}].target`;
            validationPromises.push(validateTarget(item.target, path));
        }
    }

    const results = await Promise.all(validationPromises);

    for (const result of results) {
        if (result) {
            errors.push(result);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
