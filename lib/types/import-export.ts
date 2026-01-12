/**
 * Import/Export Module Types (SSOT)
 * @see doc/specs/completed/IMPORT_EXPORT.md
 * @see uiux_refactor.md §6.1
 *
 * Types for bulk data import/export operations.
 * Covers Blog, Gallery, Content, Comments (see doc/specs/completed/IMPORT_EXPORT.md for PRD).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Job History Types (DB schema SSOT)
// ─────────────────────────────────────────────────────────────────────────────

/** Job kind */
export type ImportExportJobKind = 'import' | 'export';

/** Job status */
export type ImportExportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Job row from import_export_jobs table */
export interface ImportExportJobRow {
  id: string;
  kind: ImportExportJobKind;
  entity: string;
  format: string;
  status: ImportExportJobStatus;
  requested_by: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  size_bytes: number | null;
  row_count: number | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/** Job list item for UI (with optional download URL) */
export interface ImportExportJobListItem extends ImportExportJobRow {
  download_url?: string;
}

/** Parameters for creating a new job */
export interface CreateJobParams {
  kind: ImportExportJobKind;
  entity: string;
  format: string;
  requested_by: string;
  metadata?: Record<string, unknown>;
}

/** Parameters for marking a job as completed */
export interface CompleteJobParams {
  storage_bucket: string;
  storage_path: string;
  size_bytes: number;
  row_count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Export Types
// ─────────────────────────────────────────────────────────────────────────────

/** Supported export formats */
export type ExportFormat = 'csv' | 'json' | 'xlsx';

/** Export target entities */
export type ExportEntity =
  | 'posts'
  | 'categories'
  | 'gallery_items'
  | 'comments';

/** Export job request */
export interface ExportJobRequest {
  entity: ExportEntity;
  format: ExportFormat;
  filter?: Record<string, unknown>;
  columns?: string[];
}

/** Export job status */
export interface ExportJobStatus {
  id: string;
  entity: ExportEntity;
  format: ExportFormat;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  downloadUrl?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Import Types
// ─────────────────────────────────────────────────────────────────────────────

/** Supported import formats */
export type ImportFormat = 'csv' | 'json';

/** Import target entities */
export type ImportEntity = ExportEntity;

/** Import validation result */
export interface ImportValidationResult {
  valid: boolean;
  totalRows: number;
  validRows: number;
  errors: ImportRowError[];
  warnings: ImportRowWarning[];
}

/** Row-level import error */
export interface ImportRowError {
  row: number;
  column: string;
  value: unknown;
  message: string;
}

/** Row-level import warning */
export interface ImportRowWarning {
  row: number;
  column: string;
  value: unknown;
  message: string;
}

/** Import job request */
export interface ImportJobRequest {
  entity: ImportEntity;
  format: ImportFormat;
  data: unknown[]; // Parsed rows
  options?: {
    skipDuplicates?: boolean;
    updateExisting?: boolean;
  };
}

/** Import job status */
export interface ImportJobStatus {
  id: string;
  entity: ImportEntity;
  status: 'pending' | 'validating' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalRows: number;
  processedRows: number;
  successRows: number;
  failedRows: number;
  errors: ImportRowError[];
  createdAt: string;
  completedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Blog Export/Import Types (Phase 1)
// ─────────────────────────────────────────────────────────────────────────────

/** Blog post frontmatter fields for Markdown export */
export interface BlogPostFrontmatter {
  slug: string;
  category: string; // category slug
  visibility: 'draft' | 'private' | 'public';
  created_at: string; // ISO 8601
  title_en: string;
  title_zh?: string;
  excerpt_en?: string;
  excerpt_zh?: string;
  cover_image_url_en?: string;
  cover_image_url_zh?: string;
  cover_image_alt_en?: string;
  cover_image_alt_zh?: string;
}

/** Parsed blog post data from Markdown */
export interface ParsedBlogPost {
  frontmatter: BlogPostFrontmatter;
  content_en: string;
  content_zh?: string;
}

/** Blog post data ready for import (validated) */
export interface BlogPostImportData {
  slug: string;
  category_slug: string;
  visibility: 'draft' | 'private' | 'public';
  created_at: string;
  title_en: string;
  title_zh: string | null;
  content_en: string;
  content_zh: string | null;
  excerpt_en: string | null;
  excerpt_zh: string | null;
  cover_image_url_en: string | null;
  cover_image_url_zh: string | null;
  cover_image_alt_en: string | null;
  cover_image_alt_zh: string | null;
}

/** Blog category export data */
export interface BlogCategoryExportData {
  slug: string;
  name_en: string;
  name_zh: string;
}

/** Blog categories JSON export envelope (PRD §2.2) */
export interface BlogCategoriesExport {
  exportedAt: string; // ISO 8601
  type: 'blog_categories';
  data: BlogCategoryExportData[];
}

/** Parsed blog category from JSON import */
export interface ParsedBlogCategory {
  slug: string;
  name_en: string;
  name_zh: string;
}

/** Blog category data ready for import (validated) */
export interface BlogCategoryImportData {
  slug: string;
  name_en: string;
  name_zh: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse Result Types
// ─────────────────────────────────────────────────────────────────────────────

/** Parse result for formatters/parsers */
export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Gallery Export/Import Types (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────

/** Gallery item export data (PRD §2.3) */
export interface GalleryItemExportData {
  slug: string;
  category: string; // category slug
  title_en: string;
  title_zh: string;
  description_en: string;
  description_zh: string;
  image_url: string;
  image_alt_en: string | null;
  image_alt_zh: string | null;
  material_en: string | null;
  material_zh: string | null;
  tags_en: string[];
  tags_zh: string[];
  is_visible: boolean;
}

/** Gallery items JSON export envelope */
export interface GalleryItemsExport {
  exportedAt: string;
  type: 'gallery_items';
  data: GalleryItemExportData[];
}

/** Gallery item data ready for import (validated) */
export interface GalleryItemImportData {
  slug: string;
  category_slug: string;
  title_en: string;
  title_zh: string;
  description_en: string;
  description_zh: string;
  image_url: string;
  image_alt_en: string | null;
  image_alt_zh: string | null;
  material_en: string | null;
  material_zh: string | null;
  tags_en: string[];
  tags_zh: string[];
  is_visible: boolean;
}

/** Gallery category export data (PRD §2.4) */
export interface GalleryCategoryExportData {
  slug: string;
  name_en: string;
  name_zh: string;
  sort_order: number;
  is_visible: boolean;
}

/** Gallery categories JSON export envelope */
export interface GalleryCategoriesExport {
  exportedAt: string;
  type: 'gallery_categories';
  data: GalleryCategoryExportData[];
}

/** Gallery category data ready for import (validated) */
export interface GalleryCategoryImportData {
  slug: string;
  name_en: string;
  name_zh: string;
  sort_order: number;
  is_visible: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Site Content Export/Import Types (Phase 3)
// ─────────────────────────────────────────────────────────────────────────────

/** Site content export data (PRD §2.9) */
export interface SiteContentExportData {
  section_key: string;
  is_published: boolean;
  content_en: Record<string, unknown>;
  content_zh: Record<string, unknown>;
}

/** Site content JSON export envelope */
export interface SiteContentExport {
  exportedAt: string;
  type: 'site_content';
  data: SiteContentExportData[];
}

/** Site content data ready for import (validated) */
export interface SiteContentImportData {
  section_key: string;
  is_published: boolean;
  content_en: Record<string, unknown>;
  content_zh: Record<string, unknown>;
}

/** Landing section export data (PRD §2.10) */
export interface LandingSectionExportData {
  section_key: string;
  section_type: string;
  sort_order: number;
  is_visible: boolean;
  title_en: string | null;
  title_zh: string | null;
  subtitle_en: string | null;
  subtitle_zh: string | null;
  content_en: Record<string, unknown> | null;
  content_zh: Record<string, unknown> | null;
}

/** Landing sections JSON export envelope */
export interface LandingSectionsExport {
  exportedAt: string;
  type: 'landing_sections';
  data: LandingSectionExportData[];
}

/** Landing section data ready for import (validated) */
export interface LandingSectionImportData {
  section_key: string;
  section_type: string;
  sort_order: number;
  is_visible: boolean;
  title_en: string | null;
  title_zh: string | null;
  subtitle_en: string | null;
  subtitle_zh: string | null;
  content_en: Record<string, unknown> | null;
  content_zh: Record<string, unknown> | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Comments Export Types (Phase 3, export-only)
// ─────────────────────────────────────────────────────────────────────────────

/** Comment reply export data */
export interface CommentReplyExportData {
  user_display_name: string;
  content: string;
  created_at: string;
  // Sensitive fields (optional)
  user_email?: string;
}

/** Comment export data (PRD §2.11, export-only) */
export interface CommentExportData {
  target_type: 'post' | 'gallery_item';
  target_slug: string;
  user_display_name: string;
  content: string;
  is_approved: boolean;
  like_count: number;
  created_at: string;
  replies: CommentReplyExportData[];
  // Sensitive fields (optional)
  user_email?: string;
  ip_hash?: string;
  spam_score?: number;
  spam_reason?: string;
}

/** Comments JSON export envelope */
export interface CommentsExport {
  exportedAt: string;
  type: 'comments';
  includeSensitive: boolean;
  data: CommentExportData[];
}

