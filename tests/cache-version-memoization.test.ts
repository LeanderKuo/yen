/**
 * Cache Version Memoization Test
 *
 * Verifies that getGlobalCacheVersionCached uses unstable_cache properly
 * and that incrementGlobalCacheVersion revalidates the cache tag.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = process.cwd();

test('cache-io exports getGlobalCacheVersionCached', () => {
    // Verify the module structure - getGlobalCacheVersionCached should be exported
    const cacheIoPath = path.join(repoRoot, 'lib', 'system', 'cache-io.ts');
    const source = fs.readFileSync(cacheIoPath, 'utf8');

    // Check that getGlobalCacheVersionCached is exported
    assert.ok(
        source.includes('export const getGlobalCacheVersionCached'),
        'getGlobalCacheVersionCached should be exported from cache-io.ts'
    );

    // Check it uses unstable_cache with proper tags
    assert.ok(
        source.includes("tags: ['global-system', 'cache-version']"),
        'getGlobalCacheVersionCached should use cache-version tag'
    );

    // Check it has a short TTL (5 seconds)
    assert.ok(
        source.includes('revalidate: 5'),
        'getGlobalCacheVersionCached should have 5 second TTL'
    );
});

test('wrapper.ts uses getGlobalCacheVersionCached instead of getGlobalCacheVersion', () => {
    const wrapperPath = path.join(repoRoot, 'lib', 'cache', 'wrapper.ts');
    const source = fs.readFileSync(wrapperPath, 'utf8');

    // Check that wrapper imports the cached version
    assert.ok(
        source.includes("import { getGlobalCacheVersionCached } from '@/lib/system/cache-io'"),
        'wrapper.ts should import getGlobalCacheVersionCached'
    );

    // Check that it doesn't import the non-cached version
    assert.ok(
        !source.includes("import { getGlobalCacheVersion } from '@/lib/system/cache-io'"),
        'wrapper.ts should NOT import the non-cached getGlobalCacheVersion'
    );

    // Check that getCacheVersionSafe calls the cached version
    assert.ok(
        source.includes('await getGlobalCacheVersionCached()'),
        'getCacheVersionSafe should call getGlobalCacheVersionCached'
    );
});

test('incrementGlobalCacheVersion invalidates cache-version tag', () => {
    const cacheIoPath = path.join(repoRoot, 'lib', 'system', 'cache-io.ts');
    const source = fs.readFileSync(cacheIoPath, 'utf8');

    // Check that incrementGlobalCacheVersion revalidates the cache-version tag
    const revalidateCount = (source.match(/revalidateTag\('cache-version'/g) || []).length;
    assert.ok(
        revalidateCount >= 2,
        `incrementGlobalCacheVersion should call revalidateTag('cache-version') in both code paths (found ${revalidateCount})`
    );

    // Check that revalidateTag is imported
    assert.ok(
        source.includes("import { unstable_cache, revalidateTag } from 'next/cache'"),
        'cache-io.ts should import revalidateTag from next/cache'
    );
});
