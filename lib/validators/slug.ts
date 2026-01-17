/**
 * Slug Validation (Pure Functions)
 *
 * Single source of truth for slug format validation across the application.
 * Used by: Blog Categories, Blog Posts, Gallery Categories, and any future modules.
 *
 * @see lib/utils/slug.ts - For slug generation (different from validation)
 * @see lib/validators/api-common.ts - For common validation patterns
 */

import { type ValidationResult, validResult, invalidResult } from './api-common';

// =============================================================================
// Constants
// =============================================================================

/**
 * Single source regex for URL-safe slug validation.
 * Format: lowercase (no uppercase letters), Unicode letters/numbers/underscore,
 * optionally separated by single hyphens.
 * Examples:
 * - Valid: "hello", "hello-world", "a1", "123"
 * - Valid (Unicode): "中文-測試", "hello世界", "foo_bar"
 * - Invalid: "Hello" (uppercase), "a--b" (double hyphen), "-abc" (leading hyphen)
 */
export const SLUG_REGEX =
  /^(?!.*\p{Lu})[\p{L}\p{N}_]+(?:-[\p{L}\p{N}_]+)*$/u;

// =============================================================================
// Validators
// =============================================================================

/**
 * Check if a string is a valid slug format.
 * @param slug - The string to validate
 * @returns true if valid slug format, false otherwise
 */
export function isValidSlug(slug: string): boolean {
  return typeof slug === 'string' && slug.length > 0 && SLUG_REGEX.test(slug);
}

/**
 * Validate slug with detailed result (following api-common.ts pattern).
 * @param input - The string to validate
 * @returns ValidationResult with trimmed slug if valid, or error message if invalid
 */
export function validateSlug(input: string): ValidationResult<string> {
  if (typeof input !== 'string') {
    return invalidResult('Slug 必須為字串');
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return invalidResult('Slug 為必填');
  }

  if (!SLUG_REGEX.test(trimmed)) {
    return invalidResult(
      'Slug 格式不正確：僅允許小寫字母、數字、底線與連字號（不可有連續連字號、前後連字號）'
    );
  }

  return validResult(trimmed);
}
