/**
 * Blog Import Validators (Pure)
 *
 * Validation functions for blog post and category import data.
 * Uses lib/validators/slug.ts for slug validation (Single Source).
 *
 * @see doc/specs/completed/IMPORT_EXPORT.md §4
 */

import { isValidSlug } from '@/lib/validators/slug';
import {
  type ValidationResult,
  validResult,
  invalidResult,
  invalidResults,
} from '@/lib/validators/api-common';
import type {
  ParsedBlogPost,
  ParsedBlogCategory,
  BlogPostImportData,
  BlogCategoryImportData,
} from '@/lib/types/import-export';

// =============================================================================
// Constants
// =============================================================================

/** Valid visibility values */
const VALID_VISIBILITIES = ['draft', 'private', 'public'] as const;
type Visibility = (typeof VALID_VISIBILITIES)[number];

// =============================================================================
// Visibility Validator
// =============================================================================

/**
 * Validate visibility field value.
 *
 * @param value - The value to validate
 * @returns True if valid visibility
 */
export function isValidVisibility(value: unknown): value is Visibility {
  return (
    typeof value === 'string' &&
    VALID_VISIBILITIES.includes(value as Visibility)
  );
}

/**
 * Validate visibility with result.
 *
 * @param value - The visibility value
 * @returns ValidationResult
 */
export function validateVisibility(value: string): ValidationResult<Visibility> {
  if (!isValidVisibility(value)) {
    return invalidResult(
      `可見性（visibility）不正確：「${value}」。允許值：${VALID_VISIBILITIES.join(', ')}`
    );
  }
  return validResult(value);
}

// =============================================================================
// Blog Post Validators
// =============================================================================

/**
 * Validate blog post slug.
 * Reuses the single-source slug validator.
 *
 * @param slug - The slug to validate
 * @returns True if valid
 */
export function validateBlogPostSlug(slug: string): boolean {
  return isValidSlug(slug);
}

/**
 * Validate parsed blog post data for import.
 *
 * @param data - The parsed blog post data
 * @returns ValidationResult with import-ready data or errors
 */
export function validateBlogPostData(
  data: ParsedBlogPost
): ValidationResult<BlogPostImportData> {
  const errors: Record<string, string> = {};

  const title = (data.frontmatter.title_zh ?? data.frontmatter.title_en ?? '').trim();
  const content = (data.content_zh ?? data.content_en ?? '').trim();
  const excerpt = (data.frontmatter.excerpt_zh ?? data.frontmatter.excerpt_en ?? '').trim();
  const coverImageUrl = (
    data.frontmatter.cover_image_url_zh ?? data.frontmatter.cover_image_url_en ?? ''
  ).trim();
  const coverImageAlt = (
    data.frontmatter.cover_image_alt_zh ?? data.frontmatter.cover_image_alt_en ?? ''
  ).trim();

  // Validate slug
  if (!data.frontmatter.slug) {
    errors.slug = 'Slug 為必填';
  } else if (!isValidSlug(data.frontmatter.slug)) {
    errors.slug = 'Slug 格式不正確';
  }

  // Validate category
  if (!data.frontmatter.category) {
    errors.category = '分類 slug 為必填';
  } else if (!isValidSlug(data.frontmatter.category)) {
    errors.category = '分類 slug 格式不正確';
  }

  // Validate visibility
  if (!isValidVisibility(data.frontmatter.visibility)) {
    errors.visibility = `可見性（visibility）不正確。允許值：${VALID_VISIBILITIES.join(', ')}`;
  }

  // Validate title/content (single-language)
  if (!title) {
    errors.title_en = '標題為必填';
  }

  if (!content) {
    errors.content_en = '內容為必填';
  }

  // If cover image exists, alt text is required (SEO/accessibility)
  if (coverImageUrl && !coverImageAlt) {
    errors.cover_image_alt_en = '封面圖片描述（Alt 文字）為必填';
  }

  // Return errors if any
  if (Object.keys(errors).length > 0) {
    return invalidResults<BlogPostImportData>(errors);
  }

  // Build import data
  const importData: BlogPostImportData = {
    slug: data.frontmatter.slug,
    category_slug: data.frontmatter.category,
    visibility: data.frontmatter.visibility,
    created_at: data.frontmatter.created_at,
    // Single-language: mirror into legacy en/zh fields
    title_en: title,
    title_zh: title,
    content_en: content,
    content_zh: content,
    excerpt_en: excerpt || null,
    excerpt_zh: excerpt || null,
    cover_image_url_en: coverImageUrl || null,
    cover_image_url_zh: coverImageUrl || null,
    cover_image_alt_en: coverImageAlt || null,
    cover_image_alt_zh: coverImageAlt || null,
  };

  return validResult(importData);
}

// =============================================================================
// Blog Category Validators
// =============================================================================

/**
 * Validate parsed blog category data for import.
 *
 * @param data - The parsed blog category data
 * @returns ValidationResult with import-ready data or errors
 */
export function validateBlogCategoryData(
  data: ParsedBlogCategory
): ValidationResult<BlogCategoryImportData> {
  const errors: Record<string, string> = {};

  const nameZh = (data.name_zh ?? '').trim();
  const nameEn = (data.name_en ?? '').trim();
  const canonicalName = nameZh || nameEn;

  // Validate slug
  if (!data.slug) {
    errors.slug = 'Slug 為必填';
  } else if (!isValidSlug(data.slug)) {
    errors.slug = 'Slug 格式不正確';
  }

  // Validate name (single-language)
  if (!canonicalName) {
    errors.name_zh = '名稱為必填';
  }

  // Return errors if any
  if (Object.keys(errors).length > 0) {
    return invalidResults<BlogCategoryImportData>(errors);
  }

  // Build import data
  const importData: BlogCategoryImportData = {
    slug: data.slug,
    // Single-language: mirror into legacy en/zh fields
    name_en: canonicalName,
    name_zh: canonicalName,
  };

  return validResult(importData);
}

/**
 * Validate an array of categories.
 *
 * @param categories - Array of parsed categories
 * @returns Object with valid categories and errors by index
 */
export function validateBlogCategoriesArray(categories: ParsedBlogCategory[]): {
  valid: BlogCategoryImportData[];
  errors: Array<{ index: number; errors: Record<string, string> }>;
} {
  const valid: BlogCategoryImportData[] = [];
  const errors: Array<{ index: number; errors: Record<string, string> }> = [];

  for (let i = 0; i < categories.length; i++) {
    const result = validateBlogCategoryData(categories[i]);
    if (result.valid && result.data) {
      valid.push(result.data);
    } else if (result.errors) {
      errors.push({ index: i, errors: result.errors });
    }
  }

  return { valid, errors };
}

/**
 * Check for duplicate slugs in category array.
 *
 * @param categories - Array of parsed categories
 * @returns Array of duplicate slugs found
 */
export function findDuplicateCategorySlugs(
  categories: ParsedBlogCategory[]
): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const category of categories) {
    if (seen.has(category.slug)) {
      if (!duplicates.includes(category.slug)) {
        duplicates.push(category.slug);
      }
    } else {
      seen.add(category.slug);
    }
  }

  return duplicates;
}
