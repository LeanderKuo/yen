/**
 * Comment Write IO
 *
 * Write operations for comments (create, update, delete).
 * Uses authenticated Supabase client for protected operations.
 *
 * @module lib/modules/comment/comments-write-io
 * @see ARCHITECTURE.md §3.4 - IO module splitting
 * @see doc/specs/proposed/safety-risk-engine-spec.md §4.2.0 - Spam → Safety pipeline
 */

import 'server-only';

import { createClient } from '@/lib/infrastructure/supabase/server';
import { checkForSpam, type SpamCheckParams } from '@/lib/spam/io';
import { sanitizeContent } from '@/lib/security/sanitize';
import { insertCommentModeration } from '@/lib/modules/comment/admin-io';
import { transformComment, type Comment as _Comment, type CommentResult } from '@/lib/modules/comment/mappers';
import type { CommentTargetType } from '@/lib/types/comments';

export interface CreateCommentParams {
  /** Target type for polymorphic comments */
  targetType: CommentTargetType;
  /** Target ID (post ID or gallery item ID) */
  targetId: string;
  userId: string;
  userDisplayName: string;
  userAvatarUrl?: string;
  userEmail: string;
  content: string;
  parentId?: string;
  userAgent: string;
  headers: Headers;
  permalink: string;
  honeypotValue?: string;
  recaptchaToken?: string;
}

export interface InsertCommentWithModerationParams {
  targetType: CommentTargetType;
  targetId: string;
  userId: string;
  userDisplayName: string;
  userAvatarUrl?: string;
  userEmail: string;
  content: string;
  parentId?: string;
  isSpam: boolean;
  isApproved: boolean;
  ipHash: string;
  spamScore?: number | null;
  spamReason?: string | null;
  linkCount: number;
}

/**
 * Insert a comment row and its moderation record.
 * Does not run spam/safety checks — callers own those pipelines.
 */
export async function insertCommentWithModeration(
  params: InsertCommentWithModerationParams
): Promise<{ success: true; comment: _Comment } | { success: false; error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('comments')
    .insert({
      target_type: params.targetType,
      target_id: params.targetId,
      user_id: params.userId,
      user_display_name: params.userDisplayName,
      user_avatar_url: params.userAvatarUrl || null,
      content: params.content,
      parent_id: params.parentId || null,
      is_spam: params.isSpam,
      is_approved: params.isApproved,
    })
    .select()
    .single();

  if (error) {
    console.error('[insertCommentWithModeration] Failed to insert comment:', error);
    return { success: false, error: error.message };
  }

  const moderationResult = await insertCommentModeration({
    comment_id: data.id,
    user_email: params.userEmail,
    ip_hash: params.ipHash,
    spam_score: params.spamScore ?? null,
    spam_reason: params.spamReason ?? null,
    link_count: params.linkCount,
  });

  if (!moderationResult.success) {
    console.error('[insertCommentWithModeration] Failed to insert moderation record:', moderationResult.error);
  }

  return { success: true, comment: transformComment(data) };
}

/**
 * Create a new comment
 *
 * Pipeline order per spec §4.2.0:
 * 1. Spam check (local → external)
 * 2. Insert comment with appropriate is_approved status
 * 3. Persist moderation record
 *
 * Note: Safety Risk Engine integration is a cross-domain use case and is handled
 * outside `lib/modules/comment/*` to preserve module isolation (ARCHITECTURE.md Appendix A).
 */
export async function createComment(params: CreateCommentParams): Promise<CommentResult> {
  // ==========================================================================
  // Phase 1: Spam Check Pipeline
  // ==========================================================================
  const spamCheckParams: SpamCheckParams = {
    content: params.content,
    userDisplayName: params.userDisplayName,
    userEmail: params.userEmail,
    targetType: params.targetType,
    targetId: params.targetId,
    userId: params.userId,
    userAgent: params.userAgent,
    headers: params.headers,
    permalink: params.permalink,
    honeypotValue: params.honeypotValue,
    recaptchaToken: params.recaptchaToken,
  };

  const spamResult = await checkForSpam(spamCheckParams);

  // Handle spam rejection
  if (spamResult.decision === 'reject') {
    return {
      success: false,
      decision: 'reject',
      error: 'Comment rejected',
      message: 'Your comment could not be submitted. Please try again.',
    };
  }

  // Handle rate limiting
  if (spamResult.decision === 'rate_limited') {
    return {
      success: false,
      decision: 'rate_limited',
      error: 'Rate limited',
      message: 'You are commenting too frequently. Please wait a moment and try again.',
    };
  }

  // ==========================================================================
  // Phase 2: Insert Comment
  // ==========================================================================
  const insertResult = await insertCommentWithModeration({
    targetType: params.targetType,
    targetId: params.targetId,
    userId: params.userId,
    userDisplayName: params.userDisplayName,
    userAvatarUrl: params.userAvatarUrl,
    userEmail: params.userEmail,
    content: spamResult.content,
    parentId: params.parentId,
    isSpam: spamResult.isSpam,
    isApproved: spamResult.isApproved,
    ipHash: spamResult.ipHash,
    spamScore: spamResult.spamScore ?? null,
    spamReason: spamResult.spamReason ?? null,
    linkCount: spamResult.linkCount,
  });

  if (!insertResult.success) {
    return {
      success: false,
      error: insertResult.error,
      message: 'Failed to submit comment. Please try again.',
    };
  }

  const comment = insertResult.comment;

  // ==========================================================================
  // Phase 3: Build Response
  // ==========================================================================
  let message = 'Comment posted successfully!';
  const responseDecision = spamResult.decision;

  if (spamResult.decision === 'pending') {
    message = 'Your comment has been submitted and is awaiting moderation.';
  } else if (spamResult.decision === 'spam') {
    message = 'Your comment has been submitted for review.';
  }

  return {
    success: true,
    comment,
    decision: responseDecision,
    message,
  };
}

/**
 * Update a comment (user can only update their own)
 */
export async function updateComment(
  commentId: string,
  userId: string,
  content: string
): Promise<CommentResult> {
  const supabase = await createClient();

  // Sanitize content
  const sanitized = sanitizeContent(content);

  if (sanitized.rejected) {
    return {
      success: false,
      error: 'Invalid content',
      message: sanitized.rejectReason,
    };
  }

  const { data, error } = await supabase
    .from('comments')
    .update({
      content: sanitized.content,
      // P0-6: link_count now in comment_moderation table, not updated here
      updated_at: new Date().toISOString(),
    })
    .eq('id', commentId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update comment:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to update comment.',
    };
  }

  return {
    success: true,
    comment: transformComment(data),
    message: 'Comment updated successfully!',
  };
}

/**
 * Delete a comment (user can only delete their own)
 */
export async function deleteComment(commentId: string, userId: string): Promise<CommentResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to delete comment:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to delete comment.',
    };
  }

  return {
    success: true,
    message: 'Comment deleted successfully!',
  };
}
