/**
 * Feature Settings Type Definitions
 *
 * Types for the centralized feature visibility system.
 * Features: blog, gallery (all disabled by default)
 */

export type FeatureKey = 'blog' | 'gallery';

export interface FeatureSetting {
  feature_key: FeatureKey;
  is_enabled: boolean;
  display_order: number;
  description_en: string | null;
  description_zh: string | null;
  updated_at: string;
}

export interface FeatureSettingInput {
  is_enabled: boolean;
}

/**
 * Feature metadata for admin UI
 */
export const FEATURE_METADATA: Record<
  FeatureKey,
  { icon: string; labelEn: string; labelZh: string }
> = {
  blog: {
    icon: '📝',
    labelEn: 'Blog',
    labelZh: '部落格',
  },
  gallery: {
    icon: '🖼️',
    labelEn: 'Gallery',
    labelZh: '畫廊',
  },
};
