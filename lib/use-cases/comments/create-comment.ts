/**
 * Comment submission use case (Spam → Safety → Persist).
 *
 * Cross-domain orchestration is intentionally kept outside `lib/modules/*`
 * to preserve module isolation (ARCHITECTURE.md Appendix A).
 */

import 'server-only';

import { checkForSpam, type SpamCheckParams } from '@/lib/spam/io';
import {
  insertCommentWithModeration,
  type CreateCommentParams,
} from '@/lib/modules/comment/comments-write-io';
import type { CommentResult } from '@/lib/modules/comment/mappers';
import { persistSafetyAssessment } from '@/lib/modules/safety-risk-engine/admin-io';
import { isSafetyEngineEnabled } from '@/lib/modules/safety-risk-engine/settings-io';
import { runSafetyCheck, type SafetyCheckResult } from '@/lib/modules/safety-risk-engine/safety-check-io';

export async function createCommentWithSafety(params: CreateCommentParams): Promise<CommentResult> {
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
  // Phase 3: Insert Comment + Moderation
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
    isApproved: finalIsApproved,
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

  // Persist safety assessment if safety check was run
  if (safetyResult?.assessmentDraft) {
    const assessmentId = await persistSafetyAssessment(comment.id, safetyResult.assessmentDraft);
    if (!assessmentId) {
      // Log but don't fail - Fail Closed means comment stays as HELD
      console.error('[createCommentWithSafety] Failed to persist safety assessment, comment remains HELD');
    }
  }

  // ==========================================================================
  // Phase 4: Build Response
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

