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

// Safety Risk Engine imports
import { runSafetyCheck, type SafetyCheckResult } from '@/lib/modules/safety-risk-engine/safety-check-io';
import { isSafetyEngineEnabled } from '@/lib/modules/safety-risk-engine/settings-io';
import { persistSafetyAssessment } from '@/lib/modules/safety-risk-engine/admin-io';

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

/**
 * Create a new comment
 *
 * Pipeline order per spec §4.2.0:
 * 1. Spam check (local → external)
 * 2. Safety check (Layer 1-3) only if spam decision is 'allow'
 * 3. Insert comment with appropriate is_approved status
 * 4. Persist moderation and safety assessment records
 */
export async function createComment(params: CreateCommentParams): Promise<CommentResult> {
  const supabase = await createClient();

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
  // Phase 2: Safety Check Pipeline (only if spam allows)
  // ==========================================================================
  let safetyResult: SafetyCheckResult | null = null;
  let finalIsApproved = spamResult.isApproved;

  // Only run safety check if spam allows AND candidateToPublish
  if (spamResult.decision === 'allow') {
    const safetyEnabled = await isSafetyEngineEnabled();

    if (safetyEnabled) {
      safetyResult = await runSafetyCheck(spamResult.content);

      // REJECTED: Do not store comment at all
      if (safetyResult.decision === 'REJECTED') {
        return {
          success: false,
          decision: 'reject',
          safetyDecision: 'REJECTED',
          error: 'Content rejected by safety check',
          message: safetyResult.message,
        };
      }

      // Override is_approved based on safety decision
      // HELD: is_approved=false (not visible to public)
      // APPROVED: is_approved=true (visible to public)
      finalIsApproved = safetyResult.isApproved;
    }
  }

  // ==========================================================================
  // Phase 3: Insert Comment
  // ==========================================================================
  const { data, error } = await supabase
    .from('comments')
    .insert({
      target_type: params.targetType,
      target_id: params.targetId,
      user_id: params.userId,
      user_display_name: params.userDisplayName,
      user_avatar_url: params.userAvatarUrl || null,
      content: spamResult.content, // Use sanitized content
      parent_id: params.parentId || null,
      is_spam: spamResult.isSpam,
      is_approved: finalIsApproved,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create comment:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to submit comment. Please try again.',
    };
  }

  // ==========================================================================
  // Phase 4: Persist Moderation & Safety Assessment
  // ==========================================================================
  const moderationResult = await insertCommentModeration({
    comment_id: data.id,
    user_email: params.userEmail,
    ip_hash: spamResult.ipHash,
    spam_score: spamResult.spamScore || null,
    spam_reason: spamResult.spamReason || null,
    link_count: spamResult.linkCount,
  });

  if (!moderationResult.success) {
    console.error('Failed to create comment moderation record:', moderationResult.error);
  }

  // Persist safety assessment if safety check was run
  if (safetyResult?.assessmentDraft) {
    const assessmentId = await persistSafetyAssessment(data.id, safetyResult.assessmentDraft);
    if (!assessmentId) {
      // Log but don't fail - Fail Closed means comment stays as HELD
      console.error('Failed to persist safety assessment, comment remains HELD');
    }
  }

  const comment = transformComment(data);

  // ==========================================================================
  // Phase 5: Build Response
  // ==========================================================================
  let message = 'Comment posted successfully!';
  let responseDecision = spamResult.decision;

  // Safety HELD takes precedence in messaging
  if (safetyResult?.decision === 'HELD') {
    message = safetyResult.message;
    responseDecision = 'pending'; // Map to pending for public API
  } else if (spamResult.decision === 'pending') {
    message = 'Your comment has been submitted and is awaiting moderation.';
  } else if (spamResult.decision === 'spam') {
    message = 'Your comment has been submitted for review.';
  }

  return {
    success: true,
    comment,
    decision: responseDecision,
    safetyDecision: safetyResult?.decision,
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
