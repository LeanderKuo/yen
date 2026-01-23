# 2026-01-22 - Step Plan V9（Perf）— PR-29（Archive）

> Status: COMPLETE ✅ (Archived snapshot; active plan lives in `../meta/STEP_PLAN.md`)  
> Date: 2026-01-22  
> Scope: PR-29 only (copied from `doc/meta/STEP_PLAN.md` before V10 cleanup)

---

### PR-29 — Perf/Consistency：API routes 的 feature gate 改用 cached（減少 DB 壓力）✅ COMPLETED

1. Evidence
   - `rg -n "@/lib/features/io" app/api -S`
2. Violates
   - `ARCHITECTURE.md` §7（Feature visibility 與 SEO：feature_settings + cached reads）
3. Fix steps
   - `app/api/gallery/items/route.ts`
     - `import { isGalleryEnabled } from '@/lib/features/io'` → `import { isGalleryEnabledCached } from '@/lib/features/cached'`
     - `await isGalleryEnabled()` → `await isGalleryEnabledCached()`（介面一致；保持 404 行為不變）
   - `app/api/reactions/route.ts`
     - 同上（只對 `targetType === 'gallery_item'` 的 gate）
   - ~~（可選）把 feature gate cache tag 納入 write-side revalidate（admin 切換 feature 時 `revalidateTag('features')`）~~（已有）
4. DoD ✅
   - `rg -n "@/lib/features/io" app/api -S` → 0 hits ✅
   - `npm test` (1112 pass) ✅, `npm run lint` ✅, `npm run type-check` ✅

