'use server';

import { createClient } from '@/lib/infrastructure/supabase/server';
import { requireSiteAdmin } from '@/lib/modules/auth/admin-guard';
import {
    getSafetyQueueItems,
    getSafetyAssessmentDetail,
    labelSafetyAssessment,
    approveSafetyComment,
    rejectSafetyComment,
    promoteToCorpus,
} from '@/lib/modules/safety-risk-engine/admin-io';
import type {
    SafetyQueueItem,
    SafetyQueueFilters,
    SafetyAssessmentDetail,
    SafetyHumanLabel,
    SafetyCorpusKind,
} from '@/lib/types/safety-risk-engine';

async function checkAdmin() {
    const supabase = await createClient();
    const guard = await requireSiteAdmin(supabase);
    if (!guard.ok) {
        throw new Error(guard.errorCode);
    }
    return { id: guard.userId };
}

// =============================================================================
// Queue Actions
// =============================================================================

/**
 * Fetch safety queue items with filters.
 */
export async function fetchSafetyQueueAction(
    filters: SafetyQueueFilters = {}
): Promise<{ items: SafetyQueueItem[]; total: number }> {
    await checkAdmin();
    return getSafetyQueueItems(filters);
}

/**
 * Fetch safety assessment detail by ID.
 */
export async function fetchSafetyAssessmentAction(
    assessmentId: string
): Promise<SafetyAssessmentDetail | null> {
    await checkAdmin();
    return getSafetyAssessmentDetail(assessmentId);
}

// =============================================================================
// Review Actions
// =============================================================================

/**
 * Label a safety assessment (human feedback).
 */
export async function labelAssessmentAction(
    assessmentId: string,
    label: SafetyHumanLabel
): Promise<{ success: boolean }> {
    const user = await checkAdmin();
    const success = await labelSafetyAssessment(assessmentId, label, user.id);
    return { success };
}

/**
 * Approve a HELD comment.
 */
export async function approveCommentAction(
    commentId: string
): Promise<{ success: boolean }> {
    await checkAdmin();
    const success = await approveSafetyComment(commentId);
    return { success };
}

/**
 * Reject (delete) a HELD comment.
 */
export async function rejectCommentAction(
    commentId: string
): Promise<{ success: boolean }> {
    await checkAdmin();
    const success = await rejectSafetyComment(commentId);
    return { success };
}

/**
 * Promote text snippet to safety corpus.
 */
export async function promoteToCorpusAction(data: {
    text: string;
    label: string;
    kind: SafetyCorpusKind;
    activate?: boolean;
}): Promise<{ success: boolean; itemId?: string }> {
    const user = await checkAdmin();
    const itemId = await promoteToCorpus(data, user.id);
    return { success: !!itemId, itemId: itemId ?? undefined };
}
