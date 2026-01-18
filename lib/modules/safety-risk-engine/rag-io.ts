/**
 * Safety Risk Engine - RAG IO Module
 *
 * Server-only module for Layer 2 RAG search against safety corpus.
 * Uses semantic search to find relevant slang/case matches.
 *
 * @see doc/specs/completed/safety-risk-engine-spec.md §3 (Layer 2)
 * @see ARCHITECTURE.md §3.13 - IO boundaries
 */
import 'server-only';

import { createAdminClient } from '@/lib/infrastructure/supabase/admin';
import { semanticSearch } from '@/lib/embeddings';
import type { SafetyRagContext } from '@/lib/types/safety-risk-engine';

// =============================================================================
// Constants
// =============================================================================

/**
 * Default limit for RAG search results.
 */
const DEFAULT_RAG_LIMIT = 3;

/**
 * Default similarity threshold for RAG matches.
 */
const DEFAULT_RAG_THRESHOLD = 0.5;

/**
 * Target types for safety corpus search.
 */
const SAFETY_TARGET_TYPES = ['safety_slang', 'safety_case'] as const;

// =============================================================================
// Types
// =============================================================================

/**
 * Options for safety corpus search.
 */
export interface SafetyRagSearchOptions {
    /** Maximum number of results (default: 3). */
    limit?: number;

    /** Minimum similarity threshold (default: 0.5). */
    threshold?: number;
}

/**
 * Database row structure from safety_corpus_items.
 */
interface SafetyCorpusItemRow {
    id: string;
    kind: 'slang' | 'case';
    status: string;
    label: string;
    content: string;
}

// =============================================================================
// RAG Search
// =============================================================================

/**
 * Search safety corpus for relevant context.
 *
 * Performs semantic search against safety_slang and safety_case embeddings,
 * then fetches the matching corpus item details.
 *
 * @param deidentifiedText - PII-redacted text to search for
 * @param options - Search options (limit, threshold)
 * @returns Array of SafetyRagContext with matched items
 *
 * @example
 * ```typescript
 * const context = await searchSafetyCorpus('user comment text');
 * // Returns: [{ text: '...', label: '...', score: 0.85 }, ...]
 * ```
 */
export async function searchSafetyCorpus(
    deidentifiedText: string,
    options: SafetyRagSearchOptions = {}
): Promise<SafetyRagContext[]> {
    const {
        limit = DEFAULT_RAG_LIMIT,
        threshold = DEFAULT_RAG_THRESHOLD,
    } = options;

    // Return empty context if no text to search
    if (!deidentifiedText || deidentifiedText.trim().length === 0) {
        return [];
    }

    try {
        // Step 1: Semantic search against safety embeddings
        const searchResults = await semanticSearch({
            query: deidentifiedText,
            targetTypes: [...SAFETY_TARGET_TYPES],
            limit,
            threshold,
        });

        if (searchResults.length === 0) {
            return [];
        }

        // Step 2: Fetch corpus item details
        const targetIds = searchResults.map(r => r.targetId);
        const corpusItems = await fetchCorpusItems(targetIds);

        // Step 3: Combine search results with corpus details
        const contextItems: SafetyRagContext[] = [];

        for (const result of searchResults) {
            const item = corpusItems.get(result.targetId);
            if (item) {
                contextItems.push({
                    text: item.content,
                    label: item.label,
                    score: result.similarity,
                });
            }
        }

        return contextItems;
    } catch (error) {
        // Fail gracefully: return empty context on error
        // Layer 3 (LLM) can still run without RAG context
        console.error('[searchSafetyCorpus] Search failed, returning empty context:', error);
        return [];
    }
}

/**
 * Fetch corpus item details from database.
 *
 * Only returns items with status='active' to ensure deprecated
 * items are not used in RAG context.
 *
 * @param targetIds - Array of corpus item UUIDs
 * @returns Map of targetId -> SafetyCorpusItemRow
 */
async function fetchCorpusItems(
    targetIds: string[]
): Promise<Map<string, SafetyCorpusItemRow>> {
    const result = new Map<string, SafetyCorpusItemRow>();

    if (targetIds.length === 0) {
        return result;
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from('safety_corpus_items')
        .select('id, kind, status, label, content')
        .in('id', targetIds)
        .eq('status', 'active');

    if (error) {
        console.error('[fetchCorpusItems] Query error:', error);
        return result;
    }

    for (const row of (data ?? [])) {
        result.set(row.id, row as SafetyCorpusItemRow);
    }

    return result;
}
