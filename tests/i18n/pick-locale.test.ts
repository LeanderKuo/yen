import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickLocaleContent } from '@/lib/i18n/pick-locale';
import type { SiteContent } from '@/lib/types/content';

describe('pickLocaleContent', () => {
  const mockContent: SiteContent = {
    id: 'test-id',
    section_key: 'nav',
    content_en: { title: 'English Title', description: 'English Desc' },
    content_zh: { title: '中文標題', description: '中文描述' },
    is_published: true,
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: null,
  };

  it('always returns content_zh (single-language)', () => {
    assert.deepEqual(pickLocaleContent(mockContent, 'zh'), {
      title: '中文標題',
      description: '中文描述',
    });
    assert.deepEqual(pickLocaleContent(mockContent, 'en'), {
      title: '中文標題',
      description: '中文描述',
    });
    assert.deepEqual(pickLocaleContent(mockContent, 'de'), {
      title: '中文標題',
      description: '中文描述',
    });
  });

  it('returns null for undefined content', () => {
    const result = pickLocaleContent<{ title: string }>(undefined, 'en');
    assert.equal(result, null);
  });
});
