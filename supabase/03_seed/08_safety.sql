-- ============================================
-- SEED: Safety Risk Engine Default Data
-- ============================================
-- 
-- Version: 1.0
-- Last Updated: 2026-01-13
--
-- Inserts default safety_settings singleton row.
--
-- @see doc/specs/proposed/safety-risk-engine-spec.md
--
-- ============================================


-- ============================================
-- Default safety_settings (singleton id=1)
-- ============================================
--
-- is_enabled: false (start disabled, manually enable)
-- model_id: openai/gpt-4o-mini (cost-effective default)
-- timeout_ms: 1500ms (within 2000ms latency budget)
-- risk_threshold: 0.70 (moderate sensitivity)
--
-- ============================================

INSERT INTO public.safety_settings (
  id,
  is_enabled,
  model_id,
  timeout_ms,
  risk_threshold,
  held_message,
  rejected_message,
  layer1_blocklist
)
VALUES (
  1,
  false,
  'openai/gpt-4o-mini',
  1500,
  0.70,
  'Your comment is being reviewed and will appear shortly.',
  'Your comment could not be posted. Please try again later.',
  '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;


-- ============================================
-- 完成 DONE
-- ============================================
