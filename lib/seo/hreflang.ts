/**
 * SEO Utilities - hreflang and Language Alternates
 * 
 * Single-language (zh-Hant) helpers for canonical URLs and Metadata.alternates.
 * 
 * Pure module: Uses centralized locale constants from lib/i18n/locales.ts
 */

import { LOCALES, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales';
import { SITE_URL } from '@/lib/site/site-url';

// Re-export for backwards compatibility
export { LOCALES, DEFAULT_LOCALE, type Locale, SITE_URL };

export interface AlternateLanguage {
  hreflang: string;
  href: string;
}

/**
 * Generate alternate language URLs for a given path (single-language: zh-Hant only).
 * @param pathname - The path without locale prefix (e.g., '/blog/technology/my-post')
 * @returns Array of alternate language objects with hreflang and href
 */
export function getAlternateLanguages(
  pathname: string,
  _includeXDefault: boolean = true
): AlternateLanguage[] {
  // Ensure pathname starts with /
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

  return [
    {
      hreflang: 'zh-Hant',
      href: `${SITE_URL}/zh${normalizedPath}`,
    },
  ];
}

/**
 * Generate Next.js Metadata alternates object
 * Used in generateMetadata for canonical URL generation
 * @param pathname - The path without locale prefix
 * @returns Object compatible with Next.js Metadata.alternates
 */
export function getMetadataAlternates(pathname: string, locale: string = DEFAULT_LOCALE) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  
  return {
    canonical: `${SITE_URL}/${locale}${normalizedPath}`,
    languages: { 'zh-Hant': `${SITE_URL}/zh${normalizedPath}` },
  };
}

/**
 * Get the canonical URL for a page
 * @param locale - Current locale
 * @param pathname - Path without locale prefix
 * @returns Full canonical URL
 */
export function getCanonicalUrl(locale: string, pathname: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${SITE_URL}/${locale}${normalizedPath}`;
}
