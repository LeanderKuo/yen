/**
 * Tests for the untrusted markdown pipeline.
 *
 * Covers:
 * - XSS prevention (script tags, javascript: URLs, data: URLs, event handlers)
 * - Link protocol enforcement (only https/mailto allowed)
 * - Link security attributes (target="_blank", rel="noopener noreferrer")
 * - GFM features (bold, italic, strikethrough, lists, blockquotes, code, headings)
 * - Edge cases (empty content, null input)
 *
 * @see lib/markdown/untrusted.ts
 * @see ARCHITECTURE.md §2 (Markdown trust boundaries)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { untrustedMarkdownToHtml } from '@/lib/markdown/untrusted';

describe('untrustedMarkdownToHtml', () => {
    describe('XSS Prevention', () => {
        it('strips script tags', async () => {
            const html = await untrustedMarkdownToHtml(
                '<script>alert(1)</script>safe text'
            );
            assert.ok(
                !html.includes('<script'),
                `Should not contain script tag, got: ${html}`
            );
            assert.ok(
                !html.includes('alert'),
                `Should not contain alert, got: ${html}`
            );
        });

        it('strips javascript: URLs in links', async () => {
            const html = await untrustedMarkdownToHtml(
                '[click me](javascript:alert(1))'
            );
            assert.ok(
                !html.includes('javascript:'),
                `Should not contain javascript:, got: ${html}`
            );
            // The link text should remain but not as a link
            assert.ok(
                html.includes('click me'),
                `Should keep link text, got: ${html}`
            );
        });

        it('strips data: URLs in links', async () => {
            const html = await untrustedMarkdownToHtml(
                '[click](data:text/html,<script>alert(1)</script>)'
            );
            assert.ok(
                !html.includes('data:'),
                `Should not contain data:, got: ${html}`
            );
        });

        it('strips http: URLs (only https allowed)', async () => {
            const html = await untrustedMarkdownToHtml(
                '[insecure](http://example.com)'
            );
            assert.ok(
                !html.includes('href="http://'),
                `Should not contain http:// href, got: ${html}`
            );
            // Text should remain
            assert.ok(
                html.includes('insecure'),
                `Should keep link text, got: ${html}`
            );
        });

        it('strips vbscript: URLs', async () => {
            const html = await untrustedMarkdownToHtml(
                '[click](vbscript:msgbox("xss"))'
            );
            assert.ok(
                !html.includes('vbscript:'),
                `Should not contain vbscript:, got: ${html}`
            );
        });

        it('handles mixed case protocol bypass attempts', async () => {
            const html = await untrustedMarkdownToHtml(
                '[click](JaVaScRiPt:alert(1))'
            );
            assert.ok(
                !html.toLowerCase().includes('javascript:'),
                `Should not contain javascript:, got: ${html}`
            );
        });

        it('strips iframe tags', async () => {
            const html = await untrustedMarkdownToHtml(
                '<iframe src="evil.com"></iframe>safe'
            );
            assert.ok(
                !html.includes('<iframe'),
                `Should not contain iframe, got: ${html}`
            );
        });

        it('strips style tags', async () => {
            const html = await untrustedMarkdownToHtml(
                '<style>body{display:none}</style>visible'
            );
            assert.ok(
                !html.includes('<style'),
                `Should not contain style tag, got: ${html}`
            );
        });

        it('strips event handler attributes', async () => {
            const html = await untrustedMarkdownToHtml(
                '<p onclick="alert(1)">text</p>'
            );
            assert.ok(
                !html.includes('onclick'),
                `Should not contain onclick, got: ${html}`
            );
        });

        it('prevents img/onerror XSS', async () => {
            const html = await untrustedMarkdownToHtml(
                '<img src="x" onerror="alert(1)">'
            );
            assert.ok(
                !html.includes('<img'),
                `Should not contain img tag, got: ${html}`
            );
            assert.ok(
                !html.includes('onerror'),
                `Should not contain onerror, got: ${html}`
            );
        });
    });

    describe('Link Security Attributes', () => {
        it('adds target="_blank" to https links', async () => {
            const html = await untrustedMarkdownToHtml('[link](https://example.com)');
            assert.ok(
                html.includes('href="https://example.com"'),
                `Expected href, got: ${html}`
            );
            assert.ok(
                html.includes('target="_blank"'),
                `Should have target="_blank", got: ${html}`
            );
        });

        it('adds rel="noopener noreferrer" to https links', async () => {
            const html = await untrustedMarkdownToHtml('[link](https://example.com)');
            assert.ok(
                html.includes('rel="noopener noreferrer"'),
                `Should have rel attr, got: ${html}`
            );
        });

        it('adds security attributes to mailto links', async () => {
            const html = await untrustedMarkdownToHtml(
                '[email](mailto:test@example.com)'
            );
            assert.ok(
                html.includes('href="mailto:test@example.com"'),
                `Expected mailto href, got: ${html}`
            );
            assert.ok(
                html.includes('target="_blank"'),
                `Should have target="_blank", got: ${html}`
            );
        });

        it('handles multiple links correctly', async () => {
            const html = await untrustedMarkdownToHtml(
                '[link1](https://a.com) and [link2](https://b.com)'
            );
            const targetCount = (html.match(/target="_blank"/g) || []).length;
            assert.strictEqual(
                targetCount,
                2,
                `Should have 2 target attrs, got: ${html}`
            );
        });
    });

    describe('GFM Features', () => {
        it('renders headings', async () => {
            const html = await untrustedMarkdownToHtml('# Title\n## Subtitle');
            assert.ok(html.includes('<h1>'), `Expected h1 tag, got: ${html}`);
            assert.ok(html.includes('<h2>'), `Expected h2 tag, got: ${html}`);
        });

        it('renders bold text', async () => {
            const html = await untrustedMarkdownToHtml('**bold text**');
            assert.ok(
                html.includes('<strong>bold text</strong>'),
                `Expected strong tag, got: ${html}`
            );
        });

        it('renders italic text', async () => {
            const html = await untrustedMarkdownToHtml('*italic text*');
            assert.ok(
                html.includes('<em>italic text</em>'),
                `Expected em tag, got: ${html}`
            );
        });

        it('renders strikethrough text', async () => {
            const html = await untrustedMarkdownToHtml('~~strikethrough~~');
            assert.ok(
                html.includes('<del>strikethrough</del>'),
                `Expected del tag, got: ${html}`
            );
        });

        it('renders unordered lists', async () => {
            const html = await untrustedMarkdownToHtml('- item 1\n- item 2');
            assert.ok(html.includes('<ul>'), `Expected ul tag, got: ${html}`);
            assert.ok(html.includes('<li>'), `Expected li tags, got: ${html}`);
        });

        it('renders ordered lists', async () => {
            const html = await untrustedMarkdownToHtml('1. first\n2. second');
            assert.ok(html.includes('<ol>'), `Expected ol tag, got: ${html}`);
            assert.ok(html.includes('<li>'), `Expected li tags, got: ${html}`);
        });

        it('renders blockquotes', async () => {
            const html = await untrustedMarkdownToHtml('> quoted text');
            assert.ok(
                html.includes('<blockquote>'),
                `Expected blockquote tag, got: ${html}`
            );
        });

        it('renders inline code', async () => {
            const html = await untrustedMarkdownToHtml('Use `code` here');
            assert.ok(
                html.includes('<code>code</code>'),
                `Expected code tag, got: ${html}`
            );
        });

        it('renders code blocks', async () => {
            const html = await untrustedMarkdownToHtml('```\ncode block\n```');
            assert.ok(html.includes('<pre>'), `Expected pre tag, got: ${html}`);
            assert.ok(html.includes('<code>'), `Expected code tag, got: ${html}`);
        });

        it('renders tables', async () => {
            const html = await untrustedMarkdownToHtml(
                '| Header |\n|--------|\n| Cell |'
            );
            assert.ok(html.includes('<table>'), `Expected table tag, got: ${html}`);
            assert.ok(html.includes('<th>'), `Expected th tag, got: ${html}`);
            assert.ok(html.includes('<td>'), `Expected td tag, got: ${html}`);
        });
    });

    describe('Edge Cases', () => {
        it('handles empty string', async () => {
            const html = await untrustedMarkdownToHtml('');
            assert.strictEqual(html, '', 'Empty string should return empty');
        });

        it('handles null-like input', async () => {
            // @ts-expect-error Testing runtime behavior with invalid input
            const html = await untrustedMarkdownToHtml(null);
            assert.strictEqual(html, '', 'Null should return empty');
        });

        it('handles undefined input', async () => {
            // @ts-expect-error Testing runtime behavior with invalid input
            const html = await untrustedMarkdownToHtml(undefined);
            assert.strictEqual(html, '', 'Undefined should return empty');
        });

        it('preserves Chinese characters', async () => {
            const html = await untrustedMarkdownToHtml('**AI 分析報告** - 這是一個*測試*');
            assert.ok(
                html.includes('AI 分析報告'),
                `Should preserve Chinese, got: ${html}`
            );
            assert.ok(html.includes('測試'), `Should preserve Chinese, got: ${html}`);
        });

        it('handles complex nested markdown', async () => {
            const md = `
# 報告標題

**粗體** 和 *斜體*

- 列表項目 1
- 列表項目 2
  - 巢狀項目

> 引用文字

[安全連結](https://example.com)
      `;
            const html = await untrustedMarkdownToHtml(md);
            assert.ok(html.includes('<h1>'), `Should have h1, got: ${html}`);
            assert.ok(html.includes('<strong>'), `Should have strong, got: ${html}`);
            assert.ok(html.includes('<em>'), `Should have em, got: ${html}`);
            assert.ok(html.includes('<ul>'), `Should have ul, got: ${html}`);
            assert.ok(
                html.includes('<blockquote>'),
                `Should have blockquote, got: ${html}`
            );
            assert.ok(
                html.includes('href="https://example.com"'),
                `Should have safe link, got: ${html}`
            );
        });
    });
});
