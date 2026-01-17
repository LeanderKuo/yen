'use client';

/**
 * Section Editor Client Component
 *
 * Provides UI for editing landing section properties.
 * Respects preset section restrictions per ARCHITECTURE.md spec.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LandingSection, LandingSectionType } from '@/lib/types/landing';
import type { GalleryCategory } from '@/lib/types/gallery';
import { SECTION_TYPES, PRESET_SECTION_KEYS } from '@/lib/modules/landing/constants';
import { updateSectionAction } from '../actions';

interface Props {
  section: LandingSection;
  categories: GalleryCategory[];
  locale: string;
}

// Sections where only sort_order can be edited (content managed elsewhere)
const SORT_ONLY = ['hero', 'contact'];
// Sections where title/subtitle + sort/visibility can be edited
const TITLE_EDITABLE = ['services', 'portfolio', 'product_design'];
// Sections that can edit visibility but not content
const REDIRECT_FOR_CONTENT = ['about', 'platforms'];

export default function SectionEditorClient({ section, categories, locale }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const _isPreset = PRESET_SECTION_KEYS.includes(section.section_key as typeof PRESET_SECTION_KEYS[number]);
  const isCustom = section.section_key.startsWith('custom_');
  const isSortOnly = SORT_ONLY.includes(section.section_key);
  const isTitleEditable = TITLE_EDITABLE.includes(section.section_key);
  const isRedirectForContent = REDIRECT_FOR_CONTENT.includes(section.section_key);
  const isGalleryType = section.section_type === 'gallery';

  // Form state
  const [sortOrder, setSortOrder] = useState(section.sort_order);
  const [isVisible, setIsVisible] = useState(section.is_visible);
  const [titleZh, setTitleZh] = useState(section.title_zh || '');
  const [subtitleZh, setSubtitleZh] = useState(section.subtitle_zh || '');
  const [sectionType, setSectionType] = useState<LandingSectionType>(section.section_type);
  const [galleryCategoryId, setGalleryCategoryId] = useState(section.gallery_category_id || '');
  const [gallerySurface, setGallerySurface] = useState<'home' | 'gallery' | ''>(section.gallery_surface || '');
  const [galleryLimit, setGalleryLimit] = useState(
    (section.content_zh as { limit?: number })?.limit || 12
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const input: Record<string, unknown> = {
        sort_order: sortOrder,
        is_visible: isVisible,
      };

      // Add fields based on section type
      if (isTitleEditable || isCustom) {
        input.title_zh = titleZh;
        input.subtitle_zh = subtitleZh;
        // Mirror to legacy en fields
        input.title_en = titleZh;
        input.subtitle_en = subtitleZh;
      }

      if (isCustom) {
        input.section_type = sectionType;
      }

      // Gallery integration
      if (isGalleryType || sectionType === 'gallery') {
        input.gallery_category_id = galleryCategoryId || null;
        input.gallery_surface = gallerySurface || null;
        input.content_en = { limit: galleryLimit };
        input.content_zh = { limit: galleryLimit };
      }

      const result = await updateSectionAction(section.section_key, input);
      
      if (result.success) {
        setSuccess(true);
        router.refresh();
      } else {
        setError(result.error || '儲存失敗');
      }
    });
  };

  const labels = {
    title: '編輯區塊',
    back: '← 返回列表',
    sectionKey: '區塊 Key',
    sortOrder: '排序順序',
    visible: '顯示',
    titleZh: '標題',
    subtitleZh: '副標題',
    type: '區塊類型',
    gallerySource: '圖庫來源',
    galleryLimit: '顯示數量',
    useCategory: '使用分類',
    useFeatured: '使用精選',
    save: '儲存',
    saving: '儲存中...',
    saved: '已儲存！',
    contentNote: '此區塊的內容在 Content 管理頁面編輯。',
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link 
        href={`/${locale}/admin/landing`}
        className="text-primary hover:underline mb-4 inline-block"
      >
        {labels.back}
      </Link>

      <h1 className="text-2xl font-bold text-foreground mb-6">
        {labels.title}: {section.section_key}
      </h1>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg">{labels.saved}</div>
      )}

      {(isRedirectForContent || isSortOnly) && (
        <div className="mb-6 p-4 bg-amber-50 text-amber-800 rounded-lg text-sm">
          {labels.contentNote}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-surface p-6 rounded-xl border border-border-light">
        {/* Section Key (read-only) */}
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">
            {labels.sectionKey}
          </label>
          <input
            type="text"
            value={section.section_key}
            disabled
            className="w-full px-3 py-2 border border-border-light rounded-lg bg-surface-secondary text-secondary"
          />
        </div>

        {/* Sort Order */}
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">
            {labels.sortOrder}
          </label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary bg-background"
          />
        </div>

        {/* Visibility (not for hero/contact) */}
        {!isSortOnly && (
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="visible"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
              className="w-4 h-4 text-primary rounded"
            />
            <label htmlFor="visible" className="text-sm font-medium text-foreground">
              {labels.visible}
            </label>
          </div>
        )}

        {/* Title/Subtitle (for title-editable and custom) */}
        {(isTitleEditable || isCustom) && (
          <>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                {labels.titleZh}
              </label>
              <input
                type="text"
                value={titleZh}
                onChange={(e) => setTitleZh(e.target.value)}
                className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary bg-background"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                {labels.subtitleZh}
              </label>
              <input
                type="text"
                value={subtitleZh}
                onChange={(e) => setSubtitleZh(e.target.value)}
                className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary bg-background"
              />
            </div>
          </>
        )}

        {/* Section Type (custom only) */}
        {isCustom && (
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              {labels.type}
            </label>
            <select
              value={sectionType}
              onChange={(e) => setSectionType(e.target.value as LandingSectionType)}
              className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary bg-background"
            >
              {SECTION_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        )}

        {/* Gallery configuration (for gallery type) */}
        {(isGalleryType || sectionType === 'gallery') && (
          <>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                {labels.gallerySource}
              </label>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-secondary">{labels.useCategory}</label>
                  <select
                    value={galleryCategoryId}
                    onChange={(e) => {
                      setGalleryCategoryId(e.target.value);
                      if (e.target.value) setGallerySurface('');
                    }}
                    className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary bg-background mt-1"
                  >
                    <option value="">-- 不使用分類 --</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name_zh}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-secondary">{labels.useFeatured}</label>
                  <select
                    value={gallerySurface}
                    onChange={(e) => {
                      setGallerySurface(e.target.value as 'home' | 'gallery' | '');
                      if (e.target.value) setGalleryCategoryId('');
                    }}
                    className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary bg-background mt-1"
                  >
                    <option value="">-- 不使用精選 --</option>
                    <option value="home">首頁</option>
                    <option value="gallery">畫廊</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                {labels.galleryLimit} (1-12)
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={galleryLimit}
                onChange={(e) => setGalleryLimit(parseInt(e.target.value) || 12)}
                className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary bg-background"
              />
            </div>
          </>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {isPending ? labels.saving : labels.save}
        </button>
      </form>
    </div>
  );
}
