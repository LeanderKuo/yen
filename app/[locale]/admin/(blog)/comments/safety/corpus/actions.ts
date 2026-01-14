'use server';

import { createClient } from '@/lib/infrastructure/supabase/server';
import { requireSiteAdmin } from '@/lib/modules/auth/admin-guard';
import {
    getSafetyCorpusItems,
    createSafetyCorpusItem,
    updateSafetyCorpusItem,
    updateSafetyCorpusStatus,
    deleteSafetyCorpusItem,
} from '@/lib/modules/safety-risk-engine/admin-io';
import type { SafetyCorpusItem, SafetyCorpusKind, SafetyCorpusStatus } from '@/lib/types/safety-risk-engine';

async function checkAdmin() {
    const supabase = await createClient();
    const guard = await requireSiteAdmin(supabase);
    if (!guard.ok) {
        throw new Error(guard.errorCode);
    }
    return { id: guard.userId };
}

/**
 * Fetch corpus items with optional filtering.
 */
export async function fetchCorpusItemsAction(
    filters: { kind?: SafetyCorpusKind; status?: SafetyCorpusStatus; search?: string } = {}
): Promise<SafetyCorpusItem[]> {
    await checkAdmin();
    return getSafetyCorpusItems(filters);
}

/**
 * Create a new corpus item.
 */
export async function createCorpusItemAction(data: {
    kind: SafetyCorpusKind;
    label: string;
    content: string;
}): Promise<{ success: boolean; itemId?: string }> {
    const user = await checkAdmin();
    const itemId = await createSafetyCorpusItem(data, user.id);
    return { success: !!itemId, itemId: itemId ?? undefined };
}

/**
 * Update a corpus item.
 */
export async function updateCorpusItemAction(
    id: string,
    data: { label?: string; content?: string }
): Promise<{ success: boolean }> {
    const user = await checkAdmin();
    const success = await updateSafetyCorpusItem(id, data, user.id);
    return { success };
}

/**
 * Update corpus item status.
 */
export async function updateCorpusStatusAction(
    id: string,
    status: SafetyCorpusStatus
): Promise<{ success: boolean }> {
    const user = await checkAdmin();
    const success = await updateSafetyCorpusStatus(id, status, user.id);
    return { success };
}

/**
 * Delete a corpus item.
 */
export async function deleteCorpusItemAction(
    id: string
): Promise<{ success: boolean }> {
    await checkAdmin();
    const success = await deleteSafetyCorpusItem(id);
    return { success };
}
