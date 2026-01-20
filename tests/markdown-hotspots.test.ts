/**
 * Tests for the hotspots safe markdown pipeline.
 *
 * Covers:
 * - GFM features (bold, italic, strikethrough, lists, blockquotes, code)
 * - HTML stripping (script, iframe, style, event handlers)
 * - XSS prevention (javascript:, data: URLs, event handlers)
 * - Link protocol enforcement (only https/mailto allowed)
 * - Link security attributes (target="_blank", rel="noopener noreferrer")
 * - Empty content validation
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { hotspotsMarkdownToHtml, isValidHotspotsMarkdown } from '@/lib/markdown/hotspots';

describe('hotspotsMarkdownToHtml', () => {
    describe('GFM Features', () => {
        it('renders bold text', async () => {
            const html = await hotspotsMarkdownToHtml('**bold text**');
            assert.ok(html.includes('<strong>bold text</strong>'), `Expected strong tag, got: ${html}`);
        });

        it('renders italic text', async () => {
            const html = await hotspotsMarkdownToHtml('*italic text*');
            assert.ok(html.includes('<em>italic text</em>'), `Expected em tag, got: ${html}`);
        });

        it('renders strikethrough text', async () => {
            const html = await hotspotsMarkdownToHtml('~~strikethrough~~');
            assert.ok(html.includes('<del>strikethrough</del>'), `Expected del tag, got: ${html}`);
        });

        it('renders unordered lists', async () => {
            const html = await hotspotsMarkdownToHtml('- item 1\n- item 2');
            assert.ok(html.includes('<ul>'), `Expected ul tag, got: ${html}`);
            assert.ok(html.includes('<li>'), `Expected li tags, got: ${html}`);
        });

        it('renders ordered lists', async () => {
            const html = await hotspotsMarkdownToHtml('1. first\n2. second');
            assert.ok(html.includes('<ol>'), `Expected ol tag, got: ${html}`);
            assert.ok(html.includes('<li>'), `Expected li tags, got: ${html}`);
        });

        it('renders blockquotes', async () => {
            const html = await hotspotsMarkdownToHtml('> quoted text');
            assert.ok(html.includes('<blockquote>'), `Expected blockquote tag, got: ${html}`);
        });

        it('renders inline code', async () => {
            const html = await hotspotsMarkdownToHtml('Use `code` here');
            assert.ok(html.includes('<code>code</code>'), `Expected code tag, got: ${html}`);
        });

        it('renders code blocks', async () => {
            const html = await hotspotsMarkdownToHtml('```\ncode block\n```');
            assert.ok(html.includes('<pre>'), `Expected pre tag, got: ${html}`);
            assert.ok(html.includes('<code>'), `Expected code tag, got: ${html}`);
        });

        it('renders https links with security attributes', async () => {
            const html = await hotspotsMarkdownToHtml('[link](https://example.com)');
            assert.ok(html.includes('href="https://example.com"'), `Expected href, got: ${html}`);
            assert.ok(html.includes('target="_blank"'), `Expected target="_blank", got: ${html}`);
            assert.ok(html.includes('rel="noopener noreferrer"'), `Expected rel attr, got: ${html}`);
        });

        it('renders mailto links with security attributes', async () => {
            const html = await hotspotsMarkdownToHtml('[email](mailto:test@example.com)');
            assert.ok(html.includes('href="mailto:test@example.com"'), `Expected mailto href, got: ${html}`);
            assert.ok(html.includes('target="_blank"'), `Expected target="_blank", got: ${html}`);
        });
    });

    describe('HTML Stripping', () => {
        it('strips script tags', async () => {
            const html = await hotspotsMarkdownToHtml('<script>alert("xss")</script>safe text');
            assert.ok(!html.includes('<script'), `Should not contain script tag, got: ${html}`);
            assert.ok(!html.includes('alert'), `Should not contain alert, got: ${html}`);
        });

        it('strips iframe tags', async () => {
            const html = await hotspotsMarkdownToHtml('<iframe src="evil.com"></iframe>safe');
            assert.ok(!html.includes('<iframe'), `Should not contain iframe, got: ${html}`);
            assert.ok(!html.includes('evil.com'), `Should not contain evil URL, got: ${html}`);
        });

        it('strips style tags', async () => {
            const html = await hotspotsMarkdownToHtml('<style>body{display:none}</style>visible');
            assert.ok(!html.includes('<style'), `Should not contain style tag, got: ${html}`);
            assert.ok(!html.includes('display:none'), `Should not contain CSS, got: ${html}`);
        });

        it('strips object tags', async () => {
            const html = await hotspotsMarkdownToHtml('<object data="malware.swf"></object>safe');
            assert.ok(!html.includes('<object'), `Should not contain object tag, got: ${html}`);
        });

        it('strips embed tags', async () => {
            const html = await hotspotsMarkdownToHtml('<embed src="malware.swf">safe');
            assert.ok(!html.includes('<embed'), `Should not contain embed tag, got: ${html}`);
        });

        it('strips form elements', async () => {
            const html = await hotspotsMarkdownToHtml('<form><input type="text"><button>Submit</button></form>safe');
            assert.ok(!html.includes('<form'), `Should not contain form, got: ${html}`);
            assert.ok(!html.includes('<input'), `Should not contain input, got: ${html}`);
            assert.ok(!html.includes('<button'), `Should not contain button, got: ${html}`);
        });

        it('strips arbitrary HTML tags', async () => {
            const html = await hotspotsMarkdownToHtml('<div class="evil"><span onclick="hack()">text</span></div>');
            assert.ok(!html.includes('<div'), `Should not contain div, got: ${html}`);
            assert.ok(!html.includes('onclick'), `Should not contain onclick, got: ${html}`);
        });

        it('strips event handler attributes', async () => {
            const html = await hotspotsMarkdownToHtml('<p onclick="alert(1)">text</p>');
            assert.ok(!html.includes('onclick'), `Should not contain onclick, got: ${html}`);
        });
    });

    describe('XSS Prevention', () => {
        it('strips javascript: URLs in links', async () => {
            const html = await hotspotsMarkdownToHtml('[click me](javascript:alert(1))');
            assert.ok(!html.includes('javascript:'), `Should not contain javascript:, got: ${html}`);
            // The link text should remain but not as a link
            assert.ok(html.includes('click me'), `Should keep link text, got: ${html}`);
        });

        it('strips data: URLs in links', async () => {
            const html = await hotspotsMarkdownToHtml('[click](data:text/html,<script>alert(1)</script>)');
            assert.ok(!html.includes('data:'), `Should not contain data:, got: ${html}`);
        });

        it('strips http: URLs (only https allowed)', async () => {
            const html = await hotspotsMarkdownToHtml('[insecure](http://example.com)');
            assert.ok(!html.includes('href="http://'), `Should not contain http:// href, got: ${html}`);
            // Text should remain
            assert.ok(html.includes('insecure'), `Should keep link text, got: ${html}`);
        });

        it('strips vbscript: URLs', async () => {
            const html = await hotspotsMarkdownToHtml('[click](vbscript:msgbox("xss"))');
            assert.ok(!html.includes('vbscript:'), `Should not contain vbscript:, got: ${html}`);
        });

        it('handles mixed case protocol bypass attempts', async () => {
            const html = await hotspotsMarkdownToHtml('[click](JaVaScRiPt:alert(1))');
            assert.ok(!html.toLowerCase().includes('javascript:'), `Should not contain javascript:, got: ${html}`);
        });

        it('handles protocol with spaces bypass attempts', async () => {
            const html = await hotspotsMarkdownToHtml('[click](java\nscript:alert(1))');
            // The malformed URL should be stripped or rendered harmlessly
            assert.ok(!html.includes('href="java'), `Should not create dangerous href, got: ${html}`);
        });

        it('prevents SVG/onload XSS', async () => {
            const html = await hotspotsMarkdownToHtml('<svg onload="alert(1)">');
            assert.ok(!html.includes('<svg'), `Should not contain svg, got: ${html}`);
            assert.ok(!html.includes('onload'), `Should not contain onload, got: ${html}`);
        });

        it('prevents img/onerror XSS', async () => {
            const html = await hotspotsMarkdownToHtml('<img src="x" onerror="alert(1)">');
            assert.ok(!html.includes('<img'), `Should not contain img tag, got: ${html}`);
            assert.ok(!html.includes('onerror'), `Should not contain onerror, got: ${html}`);
        });
    });

    describe('Link Security Attributes', () => {
        it('adds target="_blank" to https links', async () => {
            const html = await hotspotsMarkdownToHtml('[外部連結](https://example.com)');
            assert.ok(html.includes('target="_blank"'), `Should have target="_blank", got: ${html}`);
        });

        it('adds rel="noopener noreferrer" to https links', async () => {
            const html = await hotspotsMarkdownToHtml('[外部連結](https://example.com)');
            assert.ok(html.includes('rel="noopener noreferrer"'), `Should have rel attr, got: ${html}`);
        });

        it('adds security attributes to mailto links', async () => {
            const html = await hotspotsMarkdownToHtml('[聯絡我們](mailto:contact@example.com)');
            assert.ok(html.includes('target="_blank"'), `Should have target="_blank", got: ${html}`);
            assert.ok(html.includes('rel="noopener noreferrer"'), `Should have rel attr, got: ${html}`);
        });

        it('handles multiple links correctly', async () => {
            const html = await hotspotsMarkdownToHtml('[link1](https://a.com) and [link2](https://b.com)');
            const targetCount = (html.match(/target="_blank"/g) || []).length;
            assert.strictEqual(targetCount, 2, `Should have 2 target attrs, got: ${html}`);
        });
    });

    describe('Edge Cases', () => {
        it('handles empty string', async () => {
            const html = await hotspotsMarkdownToHtml('');
            assert.strictEqual(html, '', 'Empty string should return empty');
        });

        it('handles null-like input', async () => {
            // @ts-expect-error Testing runtime behavior with invalid input
            const html = await hotspotsMarkdownToHtml(null);
            assert.strictEqual(html, '', 'Null should return empty');
        });

        it('handles undefined input', async () => {
            // @ts-expect-error Testing runtime behavior with invalid input
            const html = await hotspotsMarkdownToHtml(undefined);
            assert.strictEqual(html, '', 'Undefined should return empty');
        });

        it('handles whitespace-only input', async () => {
            const html = await hotspotsMarkdownToHtml('   \n\t  ');
            assert.ok(html.trim() === '' || !html.replace(/<[^>]*>/g, '').trim(), 'Whitespace should result in empty content');
        });

        it('preserves Chinese characters', async () => {
            const html = await hotspotsMarkdownToHtml('**油畫媒材** - 這是一個*測試*');
            assert.ok(html.includes('油畫媒材'), `Should preserve Chinese, got: ${html}`);
            assert.ok(html.includes('測試'), `Should preserve Chinese, got: ${html}`);
        });

        it('handles complex nested markdown', async () => {
            const md = `
**粗體** 和 *斜體*

- 列表項目 1
- 列表項目 2
  - 巢狀項目

> 引用文字

[安全連結](https://example.com)
      `;
            const html = await hotspotsMarkdownToHtml(md);
            assert.ok(html.includes('<strong>'), `Should have strong, got: ${html}`);
            assert.ok(html.includes('<em>'), `Should have em, got: ${html}`);
            assert.ok(html.includes('<ul>'), `Should have ul, got: ${html}`);
            assert.ok(html.includes('<blockquote>'), `Should have blockquote, got: ${html}`);
            assert.ok(html.includes('href="https://example.com"'), `Should have safe link, got: ${html}`);
        });
    });
});

describe('isValidHotspotsMarkdown', () => {
    it('returns true for valid markdown with text content', async () => {
        const isValid = await isValidHotspotsMarkdown('這是有效的內容');
        assert.strictEqual(isValid, true);
    });

    it('returns true for markdown with formatting', async () => {
        const isValid = await isValidHotspotsMarkdown('**粗體文字**');
        assert.strictEqual(isValid, true);
    });

    it('returns false for empty string', async () => {
        const isValid = await isValidHotspotsMarkdown('');
        assert.strictEqual(isValid, false);
    });

    it('returns false for whitespace-only string', async () => {
        const isValid = await isValidHotspotsMarkdown('   \n\t  ');
        assert.strictEqual(isValid, false);
    });

    it('returns false for null input', async () => {
        // @ts-expect-error Testing runtime behavior
        const isValid = await isValidHotspotsMarkdown(null);
        assert.strictEqual(isValid, false);
    });

    it('returns false for content that is entirely stripped', async () => {
        // Only dangerous content that gets completely removed
        const isValid = await isValidHotspotsMarkdown('<script>alert(1)</script>');
        assert.strictEqual(isValid, false);
    });

    it('returns true for content with safe link', async () => {
        const isValid = await isValidHotspotsMarkdown('[連結文字](https://example.com)');
        assert.strictEqual(isValid, true);
    });

    it('returns true when dangerous content is mixed with real content', async () => {
        // Note: Raw HTML blocks in markdown can consume adjacent text on the same line.
        // Using paragraph separation ensures valid content is preserved after stripping.
        const isValid = await isValidHotspotsMarkdown('有效的內容\n\n<script>bad</script>');
        assert.strictEqual(isValid, true);
    });
});
