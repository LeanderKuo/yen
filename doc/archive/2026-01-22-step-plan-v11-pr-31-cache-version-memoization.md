# 2026-01-22 - Step Plan V11（Perf/Scalability）— PR-31（Archive）

> Status: COMPLETE ✅ (Archived snapshot; active plan lives in `../meta/STEP_PLAN.md`)  
> Date: 2026-01-22  
> Scope: PR-31 only (cache version lookup memoization)

---

### PR-31 — Perf/Scalability：`cachedQuery` cache version lookup 去 DB 讀取次數降到短 TTL ✅ COMPLETED

> 問題：public SSR 一個 request 會呼叫多個 `*Cached()`，若每次都去 DB 讀 `system_settings.cache_version`，在高併發下會放大 DB QPS。

1. Evidence
   - `rg -n "getGlobalCacheVersionCached|getCacheVersionSafe" lib/system/cache-io.ts lib/cache/wrapper.ts tests/cache-version-memoization.test.ts -S`
2. Fix summary（as implemented）
   - `lib/system/cache-io.ts`
     - 新增 `getGlobalCacheVersionCached`：`unstable_cache` + `revalidate: 5` + tags：`global-system`, `cache-version`
     - `incrementGlobalCacheVersion()` 在兩個 code paths 都呼叫 `revalidateTag('cache-version')`
   - `lib/cache/wrapper.ts`
     - `getCacheVersionSafe()` 改用 `getGlobalCacheVersionCached()`（保留 build/static fallback）
   - `tests/cache-version-memoization.test.ts`
     - Guardrail test：檢查 cached export、TTL、tag、wrapper import/usage
3. DoD ✅
   - `npm test` ✅
   - `npm run lint` ✅
   - `npm run type-check` ✅

