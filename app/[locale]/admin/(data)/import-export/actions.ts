'use server';

/**
 * Import/Export Server Actions
 * @see doc/specs/completed/IMPORT_EXPORT.md
 * @see uiux_refactor.md §6.1.2 Phase 1 C, §6.1.3 Phase 2+
 *
 * Server actions for bulk data import/export operations.
 * RBAC: Export = owner/editor; Import = owner only (PRD §6.1)
 */

import { revalidateTag, revalidatePath } from 'next/cache';
import { getAdminRole } from '@/lib/modules/auth';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { exportBlogBundle, type BlogExportResult } from '@/lib/modules/import-export/export-blog-io';
import {
  previewBlogImport,
  applyBlogImport,
  type BlogImportPreview,
  type BlogImportResult,
} from '@/lib/modules/import-export/import-blog-io';

// Phase 2: Gallery
import {
  exportGalleryItemsBundle,
  exportGalleryCategoriesBundle,
} from '@/lib/modules/import-export/export-gallery-io';
import {
  previewGalleryItemsImport,
  applyGalleryItemsImport,
  previewGalleryCategoriesImport,
  applyGalleryCategoriesImport,
} from '@/lib/modules/import-export/import-gallery-io';

// Phase 3: Content
import {
  exportSiteContentBundle,
  exportLandingSectionsBundle,
} from '@/lib/modules/import-export/export-content-io';
import {
  previewSiteContentImport,
  applySiteContentImport,
  previewLandingSectionsImport,
  applyLandingSectionsImport,
} from '@/lib/modules/import-export/import-content-io';

// Phase 3: Comments (export-only)
import {
  exportCommentsBundle,
  type CommentsExportFormat,
} from '@/lib/modules/import-export/export-comments-io';

/** Export format type alias for actions */
export type ExportFormat = 'json' | 'csv';

// =============================================================================
// Types
// =============================================================================

/** Export blog action result */
export interface ExportBlogActionResult {
  success: boolean;
  downloadUrl?: string;
  stats?: {
    postsCount: number;
    categoriesCount: number;
    bundleSizeBytes: number;
  };
  error?: string;
}

/** Import preview action result */
export interface ImportPreviewActionResult {
  success: boolean;
  preview?: BlogImportPreview;
  error?: string;
}

/** Import apply action result */
export interface ImportApplyActionResult {
  success: boolean;
  result?: BlogImportResult;
  error?: string;
}

/** Generic export action result */
export interface GenericExportResult {
  success: boolean;
  downloadUrl?: string;
  stats?: {
    count: number;
    bundleSizeBytes: number;
  };
  error?: string;
}

/** Generic import preview result */
export interface GenericImportPreviewResult {
  success: boolean;
  preview?: {
    total: number;
    valid: number;
    items: Array<{ slug: string; valid: boolean; errors?: Record<string, string> }>;
  };
  error?: string;
}

/** Generic import apply result */
export interface GenericImportApplyResult {
  success: boolean;
  imported?: number;
  errors?: Array<{ slug: string; error: string }>;
  error?: string;
}

// =============================================================================
// RBAC Helpers
// =============================================================================

/** Require owner role (for Import operations) */
async function requireOwner(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const role = await getAdminRole(supabase);
  if (role !== 'owner') {
    throw new Error('Permission denied: owner only');
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }
  return { userId: user.id };
}

/** Require editor or owner role (for Export operations) */
async function requireEditorOrOwner(): Promise<void> {
  const supabase = await createClient();
  const role = await getAdminRole(supabase);
  if (role !== 'owner' && role !== 'editor') {
    throw new Error('Permission denied: admin only');
  }
}

// =============================================================================
// Export Actions (owner/editor allowed)
// =============================================================================

/**
 * Export blog posts and categories as a downloadable ZIP bundle.
 *
 * @returns Export result with download URL
 */
export async function exportBlog(): Promise<ExportBlogActionResult> {
  try {
    await requireEditorOrOwner();

    const result: BlogExportResult = await exportBlogBundle();

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      downloadUrl: result.downloadUrl,
      stats: result.stats,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Import Actions (owner only)
// =============================================================================

/**
 * Preview a blog import bundle without applying changes.
 * Validates the uploaded ZIP and returns a summary of what would be imported.
 *
 * @param formData - FormData containing the uploaded file
 * @returns Preview result with validation details
 */
export async function previewBlogImportAction(
  formData: FormData
): Promise<ImportPreviewActionResult> {
  try {
    await requireOwner();

    const file = formData.get('file') as File | null;
    if (!file) {
      return { success: false, error: 'No file uploaded' };
    }

    // Validate file type
    if (!file.name.endsWith('.zip')) {
      return { success: false, error: 'Invalid file type. Please upload a ZIP file.' };
    }

    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();

    // Run preview (dry run)
    const preview = await previewBlogImport(buffer);

    return { success: true, preview };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Apply a blog import bundle to the database.
 *
 * @param formData - FormData containing the uploaded file
 * @returns Import result with counts and errors
 */
export async function applyBlogImportAction(
  formData: FormData
): Promise<ImportApplyActionResult> {
  try {
    const { userId } = await requireOwner();

    const file = formData.get('file') as File | null;
    if (!file) {
      return { success: false, error: 'No file uploaded' };
    }

    // Validate file type
    if (!file.name.endsWith('.zip')) {
      return { success: false, error: 'Invalid file type. Please upload a ZIP file.' };
    }

    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();

    // Apply import
    const result = await applyBlogImport(buffer, userId);

    // Revalidate caches on success
    if (result.success || result.postsImported > 0 || result.categoriesImported > 0) {
      revalidateTag('blog', { expire: 0 });
      revalidatePath('/sitemap.xml');
    }

    return { success: true, result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Phase 2: Gallery Actions
// =============================================================================

/** Export gallery items */
export async function exportGalleryItems(): Promise<GenericExportResult> {
  try {
    await requireEditorOrOwner();
    const result = await exportGalleryItemsBundle();
    if (!result.success) return { success: false, error: result.error };
    return {
      success: true,
      downloadUrl: result.downloadUrl,
      stats: result.stats ? { count: result.stats.itemsCount, bundleSizeBytes: result.stats.bundleSizeBytes } : undefined,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/** Export gallery categories */
export async function exportGalleryCategories(): Promise<GenericExportResult> {
  try {
    await requireEditorOrOwner();
    const result = await exportGalleryCategoriesBundle();
    if (!result.success) return { success: false, error: result.error };
    return {
      success: true,
      downloadUrl: result.downloadUrl,
      stats: result.stats ? { count: result.stats.categoriesCount, bundleSizeBytes: result.stats.bundleSizeBytes } : undefined,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/** Preview gallery items import */
export async function previewGalleryItemsImportAction(
  formData: FormData
): Promise<GenericImportPreviewResult> {
  try {
    await requireOwner();
    const file = formData.get('file') as File | null;
    if (!file) return { success: false, error: 'No file uploaded' };
    if (!file.name.endsWith('.json')) return { success: false, error: 'Please upload a JSON file.' };
    const text = await file.text();
    const result = await previewGalleryItemsImport(text);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, preview: result.items };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/** Apply gallery items import */
export async function applyGalleryItemsImportAction(
  formData: FormData
): Promise<GenericImportApplyResult> {
  try {
    await requireOwner();
    const file = formData.get('file') as File | null;
    if (!file) return { success: false, error: 'No file uploaded' };
    const text = await file.text();
    const result = await applyGalleryItemsImport(text);
    if (result.itemsImported > 0) revalidateTag('gallery', { expire: 0 });
    return { success: result.success, imported: result.itemsImported, errors: result.errors };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/** Preview gallery categories import */
export async function previewGalleryCategoriesImportAction(
  formData: FormData
): Promise<GenericImportPreviewResult> {
  try {
    await requireOwner();
    const file = formData.get('file') as File | null;
    if (!file) return { success: false, error: 'No file uploaded' };
    if (!file.name.endsWith('.json')) return { success: false, error: 'Please upload a JSON file.' };
    const text = await file.text();
    const result = await previewGalleryCategoriesImport(text);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, preview: result.items };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/** Apply gallery categories import */
export async function applyGalleryCategoriesImportAction(
  formData: FormData
): Promise<GenericImportApplyResult> {
  try {
    await requireOwner();
    const file = formData.get('file') as File | null;
    if (!file) return { success: false, error: 'No file uploaded' };
    const text = await file.text();
    const result = await applyGalleryCategoriesImport(text);
    if (result.categoriesImported > 0) revalidateTag('gallery', { expire: 0 });
    return { success: result.success, imported: result.categoriesImported, errors: result.errors };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// =============================================================================
// Phase 3: Content Actions
// =============================================================================

/** Export site content */
export async function exportSiteContent(): Promise<GenericExportResult> {
  try {
    await requireEditorOrOwner();
    const result = await exportSiteContentBundle();
    if (!result.success) return { success: false, error: result.error };
    return { success: true, downloadUrl: result.downloadUrl, stats: result.stats };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/** Export landing sections */
export async function exportLandingSections(): Promise<GenericExportResult> {
  try {
    await requireEditorOrOwner();
    const result = await exportLandingSectionsBundle();
    if (!result.success) return { success: false, error: result.error };
    return { success: true, downloadUrl: result.downloadUrl, stats: result.stats };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/** Preview site content import */
export async function previewSiteContentImportAction(
  formData: FormData
): Promise<GenericImportPreviewResult> {
  try {
    await requireOwner();
    const file = formData.get('file') as File | null;
    if (!file) return { success: false, error: 'No file uploaded' };
    if (!file.name.endsWith('.json')) return { success: false, error: 'Please upload a JSON file.' };
    const text = await file.text();
    const result = await previewSiteContentImport(text);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, preview: result.items };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/** Apply site content import */
export async function applySiteContentImportAction(
  formData: FormData
): Promise<GenericImportApplyResult> {
  try {
    await requireOwner();
    const file = formData.get('file') as File | null;
    if (!file) return { success: false, error: 'No file uploaded' };
    const text = await file.text();
    const result = await applySiteContentImport(text);
    if (result.imported > 0) revalidateTag('content', { expire: 0 });
    return { success: result.success, imported: result.imported, errors: result.errors };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/** Preview landing sections import */
export async function previewLandingSectionsImportAction(
  formData: FormData
): Promise<GenericImportPreviewResult> {
  try {
    await requireOwner();
    const file = formData.get('file') as File | null;
    if (!file) return { success: false, error: 'No file uploaded' };
    if (!file.name.endsWith('.json')) return { success: false, error: 'Please upload a JSON file.' };
    const text = await file.text();
    const result = await previewLandingSectionsImport(text);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, preview: result.items };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/** Apply landing sections import */
export async function applyLandingSectionsImportAction(
  formData: FormData
): Promise<GenericImportApplyResult> {
  try {
    await requireOwner();
    const file = formData.get('file') as File | null;
    if (!file) return { success: false, error: 'No file uploaded' };
    const text = await file.text();
    const result = await applyLandingSectionsImport(text);
    if (result.imported > 0) revalidateTag('landing', { expire: 0 });
    return { success: result.success, imported: result.imported, errors: result.errors };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// =============================================================================
// Phase 3: Comments Actions (export-only)
// =============================================================================

/** Export comments with format support (export-only) */
export async function exportComments(
  options: { format?: CommentsExportFormat; includeSensitive?: boolean } = {}
): Promise<GenericExportResult> {
  try {
    await requireEditorOrOwner();
    const result = await exportCommentsBundle({
      format: options.format ?? 'json',
      includeSensitive: options.includeSensitive,
    });
    if (!result.success) return { success: false, error: result.error };
    return { success: true, downloadUrl: result.downloadUrl, stats: result.stats };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// =============================================================================
// Job History Actions
// =============================================================================

import {
  listJobs,
  createJobDownloadUrl,
  deleteJob,
  createJob,
  markJobProcessing,
  markJobCompleted,
  markJobFailed,
  writeAuditLog,
} from '@/lib/modules/import-export/jobs-io';
import type {
  ImportExportJobListItem,
} from '@/lib/types/import-export';

/** Storage bucket constant */
const EXPORTS_BUCKET = 'exports';

/** Result type for job list action */
export interface JobListActionResult {
  success: boolean;
  jobs?: ImportExportJobListItem[];
  error?: string;
}

/** Result type for re-download action */
export interface RedownloadActionResult {
  success: boolean;
  downloadUrl?: string;
  error?: string;
}

/** Result type for delete action */
export interface DeleteJobActionResult {
  success: boolean;
  error?: string;
}

/** Helper to get current user info */
async function getCurrentUser(): Promise<{ userId: string; email: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }
  return { userId: user.id, email: user.email ?? '' };
}

/**
 * List recent import/export jobs.
 * Used to display job history in the UI.
 */
export async function listJobsAction(
  options: { limit?: number; kind?: 'import' | 'export'; entity?: string } = {}
): Promise<JobListActionResult> {
  try {
    await requireEditorOrOwner();
    const jobs = await listJobs({
      limit: options.limit ?? 20,
      kind: options.kind,
      entity: options.entity,
    });
    return { success: true, jobs };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Re-download a completed job by generating a new signed URL.
 * Called when user wants to re-download an expired export.
 */
export async function redownloadJobAction(jobId: string): Promise<RedownloadActionResult> {
  try {
    await requireEditorOrOwner();
    const downloadUrl = await createJobDownloadUrl(jobId);
    if (!downloadUrl) {
      return { success: false, error: 'Job not found or not completed' };
    }
    return { success: true, downloadUrl };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a job from history (owner only).
 * Also deletes the associated storage file if exists.
 */
export async function deleteJobAction(jobId: string): Promise<DeleteJobActionResult> {
  try {
    await requireOwner();
    const { email } = await getCurrentUser();
    await deleteJob(jobId);
    await writeAuditLog('delete_job', jobId, email, { action: 'delete' });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Export with Job Tracking
// =============================================================================

/**
 * Export comments with job tracking.
 */
export async function exportCommentsWithJob(
  options: { format?: CommentsExportFormat; includeSensitive?: boolean } = {}
): Promise<GenericExportResult & { jobId?: string }> {
  const format = options.format ?? 'json';
  let jobId: string | undefined;

  try {
    await requireEditorOrOwner();
    const { userId, email } = await getCurrentUser();

    jobId = await createJob({
      kind: 'export',
      entity: 'comments',
      format,
      requested_by: userId,
      metadata: { includeSensitive: options.includeSensitive ?? false },
    });
    await markJobProcessing(jobId);

    const result = await exportCommentsBundle({
      format: format as CommentsExportFormat,
      includeSensitive: options.includeSensitive,
    });

    if (!result.success) {
      await markJobFailed(jobId, result.error ?? 'Export failed');
      return { success: false, error: result.error, jobId };
    }

    // Note: exportCommentsBundle already uploads to storage with timestamp path.
    // For full job tracking, we'd need to refactor to use job-based paths.
    // For now, just record the job completion.
    await markJobCompleted(jobId, {
      storage_bucket: EXPORTS_BUCKET,
      storage_path: 'comments-export', // Placeholder - actual path is in the signed URL
      size_bytes: result.stats?.bundleSizeBytes ?? 0,
      row_count: result.stats?.count ?? 0,
    });

    await writeAuditLog('export', jobId, email, {
      entity: 'comments',
      format,
      rowCount: result.stats?.count ?? 0,
    });

    return {
      success: true,
      downloadUrl: result.downloadUrl,
      stats: result.stats,
      jobId,
    };
  } catch (error) {
    if (jobId) await markJobFailed(jobId, error instanceof Error ? error.message : 'Unknown error');
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', jobId };
  }
}
