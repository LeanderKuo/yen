import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SITE_URL,
  getAlternateLanguages,
  getCanonicalUrl,
  getMetadataAlternates,
} from '../lib/seo/hreflang';

test('getAlternateLanguages generates zh-Hant only (single-language)', () => {
  const alternates = getAlternateLanguages('/blog');
  assert.equal(alternates.length, 1);
  assert.deepEqual(alternates, [
    { hreflang: 'zh-Hant', href: `${SITE_URL}/zh/blog` },
  ]);
});

test('getCanonicalUrl builds canonical URL', () => {
  assert.equal(getCanonicalUrl('zh', 'privacy'), `${SITE_URL}/zh/privacy`);
});

test('getMetadataAlternates returns canonical and language map', () => {
  const alternates = getMetadataAlternates('/contact', 'zh');
  assert.equal(alternates.canonical, `${SITE_URL}/zh/contact`);
  assert.deepEqual(alternates.languages, {
    'zh-Hant': `${SITE_URL}/zh/contact`,
  });
});

test('all generated URLs start with SITE_URL', () => {
  // Verify no hardcoded domains leak through
  const alternates = getAlternateLanguages('/test-path');
  for (const alt of alternates) {
    assert.ok(
      alt.href.startsWith(SITE_URL),
      `Expected href to start with ${SITE_URL}, got ${alt.href}`
    );
  }

  const metadata = getMetadataAlternates('/test-path');
  assert.ok(metadata.canonical.startsWith(SITE_URL));
  assert.ok(metadata.languages['zh-Hant'].startsWith(SITE_URL));
});
