-- ============================================
-- ADD: Safety Risk Engine Tables
-- ============================================
-- 
-- Version: 1.0
-- Last Updated: 2026-01-13
--
-- Tables:
-- - safety_corpus_items: RAG corpus SSOT (slang/cases)
-- - safety_settings: Singleton configuration
-- - comment_safety_assessments: Audit history
--
-- Dependencies:
-- - 01_main.sql (auth.users reference)
-- - 02_comments.sql (comments.id FK)
--
-- @see doc/specs/proposed/safety-risk-engine-spec.md §9
-- @see doc/meta/STEP_PLAN.md PR-1
--
-- ============================================


-- ============================================
-- PART 1: safety_corpus_items (RAG Corpus SSOT)
-- ============================================
--
-- Manages slang dictionary and historical cases for RAG.
-- Status flow: draft → active → deprecated
-- Only 'active' records are used by RAG queries.
--
-- ============================================

CREATE TABLE IF NOT EXISTS public.safety_corpus_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('slang', 'case')),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'deprecated')),
  label TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_safety_corpus_items_status 
  ON public.safety_corpus_items(status);
CREATE INDEX IF NOT EXISTS idx_safety_corpus_items_kind_status 
  ON public.safety_corpus_items(kind, status);
CREATE INDEX IF NOT EXISTS idx_safety_corpus_items_created 
  ON public.safety_corpus_items(created_at DESC);


-- ============================================
-- PART 2: safety_settings (Singleton Configuration)
-- ============================================
--
-- Centralized settings for safety risk engine.
-- Singleton pattern: id=1 is the only valid row.
--
-- ============================================

CREATE TABLE IF NOT EXISTS public.safety_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  model_id TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini',
  timeout_ms INTEGER NOT NULL DEFAULT 1500,
  risk_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.70,
  held_message TEXT NOT NULL DEFAULT 'Your comment is being reviewed.',
  rejected_message TEXT NOT NULL DEFAULT 'Your comment could not be posted.',
  layer1_blocklist JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);


-- ============================================
-- PART 3: comment_safety_assessments (Audit History)
-- ============================================
--
-- Stores complete safety assessment records for auditing.
-- Each comment may have multiple assessments over time.
-- Latest assessment is referenced by comment_moderation.safety_latest_assessment_id
--
-- @see safety-risk-engine-spec.md §5.2
--
-- ============================================

CREATE TABLE IF NOT EXISTS public.comment_safety_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  decision VARCHAR(20) NOT NULL CHECK (decision IN ('APPROVED', 'HELD', 'REJECTED')),

  -- Layer 1: Keyword/Rule hit
  layer1_hit TEXT,

  -- Layer 2: RAG context (top-k matches)
  layer2_context JSONB DEFAULT '[]'::jsonb,

  -- Layer 3: LLM output
  provider VARCHAR(50) DEFAULT 'openrouter',
  model_id TEXT,
  ai_risk_level VARCHAR(10) CHECK (ai_risk_level IS NULL OR ai_risk_level IN ('High', 'Safe')),
  confidence NUMERIC(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  ai_reason TEXT,
  latency_ms INTEGER,

  -- Feedback loop (human review)
  human_label VARCHAR(30) CHECK (human_label IS NULL OR human_label IN (
    'True_Positive', 'False_Positive', 'True_Negative', 'False_Negative'
  )),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ
);

-- Indexes for queue queries
CREATE INDEX IF NOT EXISTS idx_comment_safety_assessments_comment 
  ON public.comment_safety_assessments(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_safety_assessments_decision 
  ON public.comment_safety_assessments(decision, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_safety_assessments_created 
  ON public.comment_safety_assessments(created_at DESC);


-- ============================================
-- PART 4: Extend comment_moderation (Safety Pointers)
-- ============================================
--
-- Add pointer columns for quick admin list queries.
-- Avoids joins to comment_safety_assessments for common filters.
--
-- ============================================

ALTER TABLE public.comment_moderation
  ADD COLUMN IF NOT EXISTS safety_latest_assessment_id UUID,
  ADD COLUMN IF NOT EXISTS safety_latest_decision VARCHAR(20),
  ADD COLUMN IF NOT EXISTS safety_latest_risk_level VARCHAR(10),
  ADD COLUMN IF NOT EXISTS safety_latest_confidence NUMERIC(4,3);

-- FK constraint (separate ALTER to handle IF NOT EXISTS pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_comment_moderation_safety_assessment'
    AND table_name = 'comment_moderation'
  ) THEN
    ALTER TABLE public.comment_moderation
      ADD CONSTRAINT fk_comment_moderation_safety_assessment
      FOREIGN KEY (safety_latest_assessment_id) 
      REFERENCES public.comment_safety_assessments(id) 
      ON DELETE SET NULL;
  END IF;
END $$;

-- Index for safety queue filtering
CREATE INDEX IF NOT EXISTS idx_comment_moderation_safety_decision 
  ON public.comment_moderation(safety_latest_decision);


-- ============================================
-- PART 5: Update embeddings target_type CHECK constraint
-- ============================================
--
-- Extend to include safety_slang and safety_case.
--
-- ============================================

ALTER TABLE public.embeddings 
  DROP CONSTRAINT IF EXISTS embeddings_target_type_check;
ALTER TABLE public.embeddings 
  ADD CONSTRAINT embeddings_target_type_check 
  CHECK (target_type IN ('post', 'gallery_item', 'comment', 'safety_slang', 'safety_case'));


-- ============================================
-- PART 6: Update embedding_queue target_type CHECK constraint
-- ============================================
--
-- Extend to include safety_slang and safety_case.
--
-- ============================================

ALTER TABLE public.embedding_queue 
  DROP CONSTRAINT IF EXISTS embedding_queue_target_type_check;
ALTER TABLE public.embedding_queue 
  ADD CONSTRAINT embedding_queue_target_type_check 
  CHECK (target_type IN ('post', 'gallery_item', 'comment', 'safety_slang', 'safety_case'));


-- ============================================
-- PART 7: Enable RLS
-- ============================================

ALTER TABLE public.safety_corpus_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_safety_assessments ENABLE ROW LEVEL SECURITY;


-- ============================================
-- PART 8: RLS Policies - safety_corpus_items
-- ============================================
--
-- Admin-only (Owner/Editor).
--
-- ============================================

CREATE POLICY "Admins can read safety corpus items"
  ON public.safety_corpus_items FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'editor'));

CREATE POLICY "Admins can manage safety corpus items"
  ON public.safety_corpus_items FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'editor'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'editor'));


-- ============================================
-- PART 9: RLS Policies - safety_settings
-- ============================================
--
-- Admin-only (Owner/Editor).
--
-- ============================================

CREATE POLICY "Admins can read safety settings"
  ON public.safety_settings FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'editor'));

CREATE POLICY "Admins can manage safety settings"
  ON public.safety_settings FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'editor'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'editor'));


-- ============================================
-- PART 10: RLS Policies - comment_safety_assessments
-- ============================================
--
-- Admin read (Owner/Editor).
-- INSERT/UPDATE by service_role (comment submit path).
-- Admin can UPDATE for human_label fields.
--
-- ============================================

CREATE POLICY "Admins can read safety assessments"
  ON public.comment_safety_assessments FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'editor'));

CREATE POLICY "Admins can update safety assessments"
  ON public.comment_safety_assessments FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'editor'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'editor'));


-- ============================================
-- PART 11: Grant Permissions
-- ============================================
--
-- RLS policies control WHICH rows; GRANT controls table-level access.
--
-- ============================================

-- safety_corpus_items: admin-only
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_corpus_items TO authenticated;

-- safety_settings: admin-only
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_settings TO authenticated;

-- comment_safety_assessments: admin read/update, INSERT via service_role
GRANT SELECT, UPDATE ON public.comment_safety_assessments TO authenticated;


-- ============================================
-- 完成 DONE
-- ============================================
