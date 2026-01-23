import 'server-only';

/**
 * Safe Markdown to HTML converter for untrusted content.
 *
 * This module is designed for content from untrusted sources such as:
 * - LLM output (AI Analysis reports)
 * - Share links / public-facing content not controlled by admins
 *
 * Unlike lib/markdown/server.ts (which allows raw HTML for admin content),
 * this pipeline enforces strict sanitization to prevent XSS attacks.
 *
 * Security measures:
 * - Raw HTML is NOT allowed (allowDangerousHtml: false)
 * - Content is sanitized with a GFM subset allowlist
 * - Only https: and mailto: links are permitted
 * - All links are forced to have target="_blank" + rel="noopener noreferrer"
 *
 * @see ARCHITECTURE.md §2 (Markdown trust boundaries)
 * @see doc/SECURITY.md §5 (XSS prevention)
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import type { Element, Root, RootContent } from 'hast';
import { visit } from 'unist-util-visit';

/**
 * Allowed protocols for links in untrusted content.
 * Only https and mailto are permitted to prevent XSS via javascript:/data: URLs.
 */
const ALLOWED_PROTOCOLS = ['https', 'mailto'];

/**
 * Custom sanitization schema for untrusted markdown.
 * Uses a GFM subset allowlist - only safe formatting elements are permitted.
 */
const untrustedSchema = {
    ...defaultSchema,
    // Strip dangerous elements completely
    strip: [
        'script',
        'style',
        'iframe',
        'object',
        'embed',
        'form',
        'input',
        'button',
        'textarea',
        'select',
    ],
    // Allow safe GFM elements including headings for AI report structure
    tagNames: [
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'p',
        'br',
        'strong',
        'b',
        'em',
        'i',
        'del',
        's',
        'ul',
        'ol',
        'li',
        'blockquote',
        'a',
        'code',
        'pre',
        'hr',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
    ],
    // Restrict attributes - only href for links
    attributes: {
        ...defaultSchema.attributes,
        a: ['href'],
        '*': [],
    },
    // Only allow https and mailto protocols
    protocols: {
        ...defaultSchema.protocols,
        href: ALLOWED_PROTOCOLS,
    },
};

/**
 * Check if a URL has an allowed protocol.
 */
function hasAllowedProtocol(href: string): boolean {
    const trimmed = href.trim().toLowerCase();
    return ALLOWED_PROTOCOLS.some((protocol) =>
        trimmed.startsWith(`${protocol}:`)
    );
}

/**
 * Custom rehype plugin to secure links.
 *
 * - Strips links with disallowed protocols (http, javascript, data, etc.)
 * - Adds target="_blank" and rel="noopener noreferrer" to all remaining links
 */
function rehypeSecureLinks() {
    return (tree: Root) => {
        visit(
            tree,
            'element',
            (
                node: Element,
                index: number | undefined,
                parent: Root | Element | undefined
            ) => {
                if (node.tagName !== 'a') return;

                const href = node.properties?.href;

                // If no href or invalid protocol, unwrap the link (keep text content)
                if (!href || typeof href !== 'string' || !hasAllowedProtocol(href)) {
                    if (parent && typeof index === 'number' && 'children' in parent) {
                        // Replace the <a> with its children (text content)
                        const parentChildren = parent.children as RootContent[];
                        parentChildren.splice(
                            index,
                            1,
                            ...(node.children as RootContent[])
                        );
                    }
                    return;
                }

                // Add security attributes to valid links
                node.properties = {
                    ...node.properties,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                };
            }
        );
    };
}

/**
 * Create the unified processor for untrusted markdown.
 */
function createProcessor() {
    return unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype, { allowDangerousHtml: false }) // Explicitly disable raw HTML
        .use(rehypeSanitize, untrustedSchema)
        .use(rehypeSecureLinks)
        .use(rehypeStringify);
}

/**
 * Convert untrusted markdown to safe HTML.
 *
 * Use this function for any markdown content from untrusted sources:
 * - LLM output (AI Analysis reports)
 * - Share links / public-facing content
 * - Any content not controlled by site admins
 *
 * @param markdown - Raw markdown content from untrusted source
 * @returns Safe HTML string ready for rendering
 */
export async function untrustedMarkdownToHtml(
    markdown: string
): Promise<string> {
    if (!markdown || typeof markdown !== 'string') {
        return '';
    }

    const processor = createProcessor();
    const result = await processor.process(markdown);
    return String(result).trim();
}
