/**
 * Safety Risk Engine - PII Redaction
 *
 * Pure module for free-text PII de-identification.
 * Unlike field-based deidentification in analysis-pure.ts,
 * this module uses regex patterns to redact PII from raw text.
 *
 * Must run before sending user content to external AI services
 * (embeddings, LLM) per ARCHITECTURE.md PII constraints.
 *
 * @see ARCHITECTURE.md §2 - AI/PII constraints
 * @see doc/specs/proposed/safety-risk-engine-spec.md §2
 */

import type {
    PiiType,
    PiiRedaction,
    PiiRedactionResult,
} from '@/lib/types/safety-risk-engine';

// =============================================================================
// Constants
// =============================================================================

/**
 * Placeholder text for redacted content.
 */
const REDACTION_PLACEHOLDERS: Record<PiiType, string> = {
    email: '[EMAIL]',
    phone: '[PHONE]',
    url: '[URL]',
    address: '[ADDRESS]',
};

// =============================================================================
// Regex Patterns
// =============================================================================

/**
 * Email pattern - matches common email formats.
 * Example: user@example.com, user.name+tag@sub.domain.org
 */
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/**
 * Phone patterns - matches various phone formats.
 * - Taiwan mobile: 09XXXXXXXX, 09XX-XXX-XXX
 * - Taiwan landline: 02-XXXX-XXXX, 03-XXX-XXXX
 * - International: +886-9XX-XXX-XXX, +1-XXX-XXX-XXXX
 */
const PHONE_PATTERNS = [
    // Taiwan mobile (09XXXXXXXX)
    /\b09\d{2}[-\s]?\d{3}[-\s]?\d{3}\b/g,
    // Taiwan landline (02-XXXX-XXXX or 03-XXX-XXXX)
    /\b0[2-8][-\s]?\d{3,4}[-\s]?\d{4}\b/g,
    // International format (+XXX-XXX-XXX-XXXX)
    /\+\d{1,4}[-\s]?\d{1,4}[-\s]?\d{1,4}[-\s]?\d{1,4}\b/g,
    // Generic phone with dashes/spaces (XXX-XXX-XXXX)
    /\b\d{3}[-\s]\d{3,4}[-\s]\d{4}\b/g,
];

/**
 * URL pattern - matches http/https URLs.
 * Includes common TLDs and query parameters.
 */
const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

/**
 * Address-like patterns - matches common Taiwan/Chinese address formats.
 * Conservative approach to avoid over-matching.
 */
const ADDRESS_PATTERNS = [
    // Taiwan address: XX市/縣XX區/鄉/鎮XX路/街XX號
    /[\u4e00-\u9fff]{2,4}[市縣][\u4e00-\u9fff]{2,4}[區鄉鎮市][\u4e00-\u9fff]{2,10}[路街道巷弄][\d\-之]+號?[\u4e00-\u9fff\d]*[樓F]?/g,
    // Simplified: XX路/街XX號 (first char cannot be common prepositions)
    /[^\u5728\u5230\u5F9E\u53BB\u5F80\u81F3\u65BC\u6211\u4F60\u4ED6\u5979\u5B83\u662F\u7684][\u4e00-\u9fff]{1,7}[路街道][\d\-之]+號[\u4e00-\u9fff\d]*[樓F]?/g,
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Find all matches for a pattern and return as redactions.
 */
function findMatches(
    text: string,
    pattern: RegExp,
    type: PiiType
): PiiRedaction[] {
    const redactions: PiiRedaction[] = [];
    // Clone regex to reset lastIndex
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        redactions.push({
            type,
            start: match.index,
            end: match.index + match[0].length,
        });
    }

    return redactions;
}

/**
 * Merge overlapping redactions (prefer earlier, longer spans).
 */
function mergeRedactions(redactions: PiiRedaction[]): PiiRedaction[] {
    if (redactions.length <= 1) {
        return redactions;
    }

    // Sort by start position
    const sorted = [...redactions].sort((a, b) => a.start - b.start);
    const merged: PiiRedaction[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const last = merged[merged.length - 1];

        if (current.start <= last.end) {
            // Overlapping: extend the end and keep the earlier type
            last.end = Math.max(last.end, current.end);
        } else {
            merged.push(current);
        }
    }

    return merged;
}

/**
 * Apply redactions to text.
 */
function applyRedactions(text: string, redactions: PiiRedaction[]): string {
    if (redactions.length === 0) {
        return text;
    }

    // Sort by start position (descending to preserve indices)
    const sorted = [...redactions].sort((a, b) => b.start - a.start);
    let result = text;

    for (const redaction of sorted) {
        const placeholder = REDACTION_PLACEHOLDERS[redaction.type];
        result = result.slice(0, redaction.start) + placeholder + result.slice(redaction.end);
    }

    return result;
}

// =============================================================================
// Main API
// =============================================================================

/**
 * Redact PII from free-form text.
 *
 * Identifies and redacts:
 * - Email addresses
 * - Phone numbers (Taiwan/international formats)
 * - URLs
 * - Address-like patterns
 *
 * @param text - Input text to redact
 * @returns Object with redacted text and list of redactions
 *
 * @example
 * ```typescript
 * const result = redactPii('Contact me at test@example.com or 0912-345-678');
 * // result.text = 'Contact me at [EMAIL] or [PHONE]'
 * // result.redactions = [{ type: 'email', ... }, { type: 'phone', ... }]
 * ```
 */
export function redactPii(text: string): PiiRedactionResult {
    if (!text || typeof text !== 'string') {
        return { text: '', redactions: [] };
    }

    const allRedactions: PiiRedaction[] = [];

    // Find emails
    allRedactions.push(...findMatches(text, EMAIL_PATTERN, 'email'));

    // Find phones (multiple patterns)
    for (const pattern of PHONE_PATTERNS) {
        allRedactions.push(...findMatches(text, pattern, 'phone'));
    }

    // Find URLs
    allRedactions.push(...findMatches(text, URL_PATTERN, 'url'));

    // Find addresses (multiple patterns)
    for (const pattern of ADDRESS_PATTERNS) {
        allRedactions.push(...findMatches(text, pattern, 'address'));
    }

    // Merge overlapping redactions
    const mergedRedactions = mergeRedactions(allRedactions);

    // Apply redactions
    const redactedText = applyRedactions(text, mergedRedactions);

    return {
        text: redactedText,
        redactions: mergedRedactions,
    };
}

/**
 * Check if text contains any PII.
 *
 * @param text - Input text to check
 * @returns True if PII was detected
 */
export function containsPii(text: string): boolean {
    if (!text || typeof text !== 'string') {
        return false;
    }

    // Quick checks without full redaction
    if (EMAIL_PATTERN.test(text)) return true;
    if (URL_PATTERN.test(text)) return true;

    for (const pattern of PHONE_PATTERNS) {
        if (pattern.test(text)) return true;
    }

    for (const pattern of ADDRESS_PATTERNS) {
        if (pattern.test(text)) return true;
    }

    return false;
}
