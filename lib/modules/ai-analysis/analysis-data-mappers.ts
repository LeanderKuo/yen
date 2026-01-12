/**
 * AI Analysis Data Shape Mappers (Pure Functions)
 *
 * Pure transformation functions for mapping DB rows to AI-safe shapes.
 * These functions contain no IO operations and are safe for testing.
 *
 * @module lib/modules/ai-analysis/analysis-data-mappers
 * @see uiux_refactor.md §6.2.2 - Data collection layer
 * @see doc/specs/completed/AI_ANALYSIS_v2.md §5 - Data privacy
 */

import type { CommentTargetType } from '@/lib/types/comments';

// =============================================================================
// Comment Types and Mapper
// =============================================================================

/**
 * Comment data shape for AI analysis.
 * Contains only fields safe and useful for analysis.
 * user_id, ip_hash, user_email are excluded for privacy.
 */
export interface CommentAnalysisShape {
  id: string;
  targetType: CommentTargetType;
  targetId: string;
  hasParent: boolean;
  content: string;
  contentLength: number;
  likeCount: number;
  isApproved: boolean;
  createdAt: string;
}

export interface CommentRowForAnalysis {
  id: string;
  target_type: CommentTargetType;
  target_id: string;
  parent_id: string | null;
  content: string;
  like_count: number;
  is_approved: boolean;
  created_at: string;
}

/**
 * Map raw comment row to AI-safe shape.
 * Pure function for easy testing.
 *
 * @param comment - Raw comment row (sensitive fields already excluded from select)
 * @returns AI-safe comment shape
 */
export function mapCommentToAnalysisShape(
  comment: CommentRowForAnalysis
): CommentAnalysisShape {
  return {
    id: comment.id,
    targetType: comment.target_type,
    targetId: comment.target_id,
    hasParent: comment.parent_id !== null,
    content: comment.content,
    contentLength: comment.content?.length ?? 0,
    likeCount: comment.like_count,
    isApproved: comment.is_approved,
    createdAt: comment.created_at,
  };
}
