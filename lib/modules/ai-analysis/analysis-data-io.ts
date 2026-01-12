/**
 * AI Analysis Data Collection Facade
 *
 * Unified entry point for fetching data for AI analysis.
 * Orchestrates individual fetchers and applies final deidentification.
 *
 * @module lib/modules/ai-analysis/analysis-data-io
 * @see uiux_refactor.md §6.2.2 - Data collection layer
 * @see doc/specs/completed/AI_ANALYSIS_v2.md §5 - Data privacy
 */

import 'server-only';

import type { AnalysisDataType, AnalysisFilters } from '@/lib/types/ai-analysis';
import { COST_THRESHOLDS } from '@/lib/types/ai-analysis';
import {
  deidentifyData,
  seededPrioritizedSample,
  type SamplingResult,
} from '@/lib/modules/ai-analysis/analysis-pure';

// Import individual fetchers
import {
  fetchCommentsForAnalysis,
  type CommentAnalysisShape,
} from './analysis-comments-io';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of fetching analysis data.
 * Maps each requested data type to its AI-safe data array.
 */
export interface AnalysisDataset {
  comments?: CommentAnalysisShape[];
}

/**
 * Record format for sending to LLM.
 * All data is flattened to Record<string, unknown>[] for uniform processing.
 */
export type AnalysisDataRecord = Record<string, unknown>;

// =============================================================================
// Re-exports for convenience
// =============================================================================

export {
  fetchCommentsForAnalysis,
  type CommentAnalysisShape,
};

// =============================================================================
// Facade Functions
// =============================================================================

/**
 * Fetch all requested data types for AI analysis.
 * This is the recommended entry point for analysis data retrieval.
 *
 * Features:
 * - Fetches only requested data types (selective loading)
 * - Applies filters to all queries
 * - Returns structured dataset with typed arrays
 *
 * @param dataTypes - Array of data types to fetch
 * @param filters - Optional filters to apply
 * @returns Promise<AnalysisDataset> with requested data
 */
export async function fetchAnalysisData(
  dataTypes: AnalysisDataType[],
  filters?: AnalysisFilters
): Promise<AnalysisDataset> {
  const result: AnalysisDataset = {};

  // Fetch each requested data type in parallel
  const fetchPromises: Promise<void>[] = [];

  if (dataTypes.includes('comments')) {
    fetchPromises.push(
      fetchCommentsForAnalysis(filters).then((data) => {
        result.comments = data;
      })
    );
  }

  await Promise.all(fetchPromises);

  return result;
}

/**
 * Fetch analysis data and flatten to Record<string, unknown>[] for LLM.
 * Applies final deidentification as safety layer.
 *
 * @param dataTypes - Array of data types to fetch
 * @param filters - Optional filters to apply
 * @returns Promise<AnalysisDataRecord[]> flattened and deidentified data
 */
export async function fetchAnalysisDataFlattened(
  dataTypes: AnalysisDataType[],
  filters?: AnalysisFilters
): Promise<AnalysisDataRecord[]> {
  const dataset = await fetchAnalysisData(dataTypes, filters);

  // Flatten all data types into single array with type marker
  const flattened: AnalysisDataRecord[] = [];

  if (dataset.comments) {
    flattened.push(
      ...dataset.comments.map((c) => ({ ...c, _dataType: 'comments' }))
    );
  }

  // Apply final deidentification as safety layer
  // (Individual fetchers already exclude PII, but this is belt-and-suspenders)
  return deidentifyData(flattened);
}

/**
 * Get record counts for each data type (for cost estimation before fetch).
 *
 * @param dataTypes - Array of data types to count
 * @param filters - Optional filters to apply
 * @returns Promise<Record<AnalysisDataType, number>> counts per type
 */
export async function getAnalysisDataCounts(
  dataTypes: AnalysisDataType[],
  filters?: AnalysisFilters
): Promise<Record<AnalysisDataType, number>> {
  // For now, fetch the data and count - could be optimized with COUNT queries
  const dataset = await fetchAnalysisData(dataTypes, filters);

  return {
    comments: dataset.comments?.length ?? 0,
  };
}

// =============================================================================
// Sampling-Aware Data Fetch (Phase 6+)
// =============================================================================

/**
 * Result type for sampling-aware data fetch.
 */
export interface FetchWithSamplingResult {
  /** Fetched data (possibly sampled) */
  data: AnalysisDataRecord[];
  /** Sampling metadata */
  sampling: SamplingResult<AnalysisDataRecord>;
}

// Re-export SamplingResult for convenience
export type { SamplingResult };

/**
 * Fetch analysis data with automatic sampling when over threshold.
 * Uses deterministic seeded sampling for reproducibility.
 *
 * @param dataTypes - Array of data types to fetch
 * @param filters - Optional filters to apply
 * @param seed - String seed for deterministic sampling (e.g., reportId)
 * @returns Promise with data and sampling metadata
 */
export async function fetchAnalysisDataWithSampling(
  dataTypes: AnalysisDataType[],
  filters: AnalysisFilters | undefined,
  seed: string
): Promise<FetchWithSamplingResult> {
  // Fetch all data first
  const allData = await fetchAnalysisDataFlattened(dataTypes, filters);

  // Check if sampling is needed
  const maxCount = COST_THRESHOLDS.FORCE_SAMPLING_THRESHOLD;

  if (allData.length <= maxCount) {
    // No sampling needed
    const sampling: SamplingResult<AnalysisDataRecord> = {
      data: allData,
      originalCount: allData.length,
      sampledCount: allData.length,
      highPriorityKept: 0,
      wasSampled: false,
    };

    return { data: allData, sampling };
  }

  // Apply deterministic sampling
  const sampling = seededPrioritizedSample(
    allData,
    maxCount,
    seed,
    '_dataType', // type field
    'created_at' // date field for recency
  );

  return { data: sampling.data, sampling };
}
