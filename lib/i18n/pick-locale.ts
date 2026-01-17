/**
 * Pick Locale Content Helpers
 *
 * Pure utility functions for selecting locale-specific content.
 * Single source of truth for locale branching logic.
 *
 * @module lib/i18n/pick-locale
 */

import type { SiteContent } from '@/lib/types/content';

/**
 * Pick localized content from a SiteContent row.
 * Single-language project: always selects `content_zh`.
 *
 * @param content - SiteContent row from database (or undefined)
 * @param locale - Legacy param (ignored; kept for callsite compatibility)
 * @returns Typed content object or null if content is undefined
 *
 * @example
 * const nav = pickLocaleContent<NavContent>(navContent, locale);
 */
export function pickLocaleContent<T>(
  content: SiteContent | undefined,
  _locale: string
): T | null {
  if (!content) return null;
  return content.content_zh as T;
}
