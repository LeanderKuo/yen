/**
 * Hamburger Nav Publish IO Tests
 *
 * Tests to verify that deep validation uses correct database table names.
 * These tests inspect the source code to prevent regressions where wrong
 * table names (e.g., 'blog_posts' instead of 'posts') cause publish failures.
 *
 * @see lib/modules/content/hamburger-nav-publish-io.ts
 * @see doc/meta/STEP_PLAN.md (PR-7)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Tests run with `cwd` = repo root (set by `scripts/test.mjs`)
const repoRoot = process.cwd();
const publishIoPath = path.join(
    repoRoot,
    'lib',
    'modules',
    'content',
    'hamburger-nav-publish-io.ts'
);

describe('hamburger-nav-publish-io table names', () => {
    const source = fs.readFileSync(publishIoPath, 'utf8');

    describe('Blog post validation', () => {
        it('uses "posts" table (not "blog_posts")', () => {
            // Correct: .from('posts')
            assert.ok(
                source.includes(".from('posts')"),
                'Expected validateBlogPost to use .from(\'posts\') - DB SSoT table name'
            );
        });

        it('does not use wrong table name "blog_posts"', () => {
            // Regression guard: should not use 'blog_posts'
            assert.equal(
                source.includes(".from('blog_posts')"),
                false,
                'validateBlogPost should NOT use .from(\'blog_posts\') - wrong table name'
            );
        });
    });

    describe('Blog category validation', () => {
        it('uses "categories" table (not "blog_categories")', () => {
            // Correct: .from('categories')
            assert.ok(
                source.includes(".from('categories')"),
                'Expected validateBlogCategory to use .from(\'categories\') - DB SSoT table name'
            );
        });

        it('does not use wrong table name "blog_categories"', () => {
            // Regression guard: should not use 'blog_categories'
            assert.equal(
                source.includes(".from('blog_categories')"),
                false,
                'validateBlogCategory should NOT use .from(\'blog_categories\') - wrong table name'
            );
        });
    });

    describe('Gallery validation (reference)', () => {
        it('uses "gallery_categories" table', () => {
            // Gallery tables have the correct names (with prefix)
            assert.ok(
                source.includes(".from('gallery_categories')"),
                'Expected validateGalleryCategory to use .from(\'gallery_categories\')'
            );
        });

        it('uses "gallery_items" table', () => {
            assert.ok(
                source.includes(".from('gallery_items')"),
                'Expected validateGalleryItem to use .from(\'gallery_items\')'
            );
        });
    });

    describe('Error path localization', () => {
        it('includes path in error structure', () => {
            // Verify error structure includes path for UI localization
            assert.ok(
                source.includes('path,'),
                'Error structure should include path field for UI localization'
            );
            assert.ok(
                source.includes('targetType:'),
                'Error structure should include targetType field'
            );
            assert.ok(
                source.includes('targetSlug:'),
                'Error structure should include targetSlug field'
            );
        });

        it('generates correct path format for nav items', () => {
            // Verify path format: groups[i].items[j].target
            assert.ok(
                source.includes('`groups[${gi}].items[${ii}].target`'),
                'Path should be formatted as groups[i].items[j].target'
            );
        });
    });
});
