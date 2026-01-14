'use server';

import { createClient } from '@/lib/infrastructure/supabase/server';
import { requireSiteAdmin } from '@/lib/modules/auth/admin-guard';
import {
    getSafetyAssessmentDetail,
    labelSafetyAssessment,
    approveSafetyComment,
    rejectSafetyComment,
    promoteToCorpus,
} from '@/lib/modules/safety-risk-engine/admin-io';
import type {
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

/**
 * Fetch safety assessment detail by comment ID.
 */
export async function fetchAssessmentByCommentAction(
    commentId: string
): Promise<{ assessment: SafetyAssessmentDetail | null; comment: { content: string } | null }> {
    await checkAdmin();

    // Get latest assessment for this comment
    const { createAdminClient } = await import('@/lib/infrastructure/supabase/admin');
    const supabase = createAdminClient();

    // Fetch comment content
    const { data: comment } = await supabase
        .from('comments')
        .select('content')
        .eq('id', commentId)
        .single();

    // Fetch latest assessment via moderation pointer
    const { data: moderation } = await supabase
        .from('comment_moderation')
        .select('safety_latest_assessment_id')
        .eq('comment_id', commentId)
        .single();

    if (!moderation?.safety_latest_assessment_id) {
        return { assessment: null, comment: comment ? { content: comment.content } : null };
    }

    const assessment = await getSafetyAssessmentDetail(moderation.safety_latest_assessment_id);
    return { assessment, comment: comment ? { content: comment.content } : null };
}

/**
 * Label a safety assessment.
 */
export async function labelDetailAssessmentAction(
    assessmentId: string,
    label: SafetyHumanLabel
): Promise<{ success: boolean }> {
    const user = await checkAdmin();
    const success = await labelSafetyAssessment(assessmentId, label, user.id);
    return { success };
}

/**
 * Approve comment from detail page.
 */
export async function approveDetailCommentAction(
    commentId: string
): Promise<{ success: boolean }> {
    await checkAdmin();
    const success = await approveSafetyComment(commentId);
    return { success };
}

/**
 * Reject comment from detail page.
 */
export async function rejectDetailCommentAction(
    commentId: string
): Promise<{ success: boolean }> {
    await checkAdmin();
    const success = await rejectSafetyComment(commentId);
    return { success };
}

/**
 * Promote text to corpus from detail page.
 */
export async function promoteDetailToCorpusAction(data: {
    text: string;
    label: string;
    kind: SafetyCorpusKind;
    activate?: boolean;
}): Promise<{ success: boolean; itemId?: string }> {
    const user = await checkAdmin();
    const itemId = await promoteToCorpus(data, user.id);
    return { success: !!itemId, itemId: itemId ?? undefined };
}
