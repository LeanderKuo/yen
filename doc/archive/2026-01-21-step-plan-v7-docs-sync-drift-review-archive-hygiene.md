# 2026-01-21 - Step Plan V7（Docs Sync：Drift review + Archive hygiene）(Archive)

> Date: 2026-01-21  
> Status: COMPLETE ✅ (Archived snapshot; active plan lives in `../meta/STEP_PLAN.md`)  
> Scope: docs-only drift sync + archive hygiene (not SSoT)  
> Implemented behavior (SSoT): `../SPEC.md`  
> Constraints: `../../ARCHITECTURE.md`

## Summary

- What shipped: 同步 `uiux_refactor.md` §4 drift 狀態、更新 `doc/STATUS.md`、補齊 docs links + 產生 archive index
- Why archive: `doc/meta/STEP_PLAN.md` 只保留 active drift / 下一步；完成後一律移到 `doc/archive/*`
- Repo verification (2026-01-21): `npm test`（1083 pass）, `npm run lint`, `npm run type-check`, `npm run lint:md-links` 全通過

## Archived Snapshot（verbatim）

# Step-by-Step Execution Plan — V7（Docs Sync：Drift review + Archive hygiene）

> 狀態: Active（Drift repair plan；本檔只寫「修復方案/步驟」，不在此直接改程式碼）  
> 最後更新: 2026-01-21  
> 現況 SSoT（已實作行為）: `doc/SPEC.md`  
> 目標 PRD（約束/合約）: `doc/specs/proposed/GALLERY_HERO_IMAGE_AND_HOTSPOTS.md`（Implementation Contract）  
> Repo 驗證（2026-01-21）：`npm test`（1083 pass）, `npm run lint`, `npm run type-check` 全通過  
> 歷史完成紀錄（snapshots；已完成的一律只留 archive）：
>
> - V2 snapshot（PR-9..PR-12）：`doc/archive/2026-01-21-step-plan-v2-home-uiux-gallery-hotspots-hamburger-nav.md`
> - V3 snapshot（PR-13..PR-16）：`doc/archive/2026-01-21-step-plan-v3-home-uiux-gallery-hero-hotspots-hamburger-nav.md`
> - V4 snapshot（PR-17..PR-18）：`doc/archive/2026-01-21-step-plan-v4-seo-hotspots-clean.md`
> - V5 snapshot（PR-19..PR-21）：`doc/archive/2026-01-21-step-plan-v5-drift-hardening-site-url-cta-settings-cleanup.md`
> - V6 snapshot（PR-22..PR-25）：`doc/archive/2026-01-21-step-plan-v6-architecture-hardening-io-boundaries-io-module-split.md`

---

## 0) 必讀（SSoT / Guardrails）

- Architecture / 全域約束：`ARCHITECTURE.md`
- 已落地行為（SSoT）：`doc/SPEC.md`
- 目標 PRD（contract）：`doc/specs/proposed/GALLERY_HERO_IMAGE_AND_HOTSPOTS.md`
- Security / RBAC / RLS / secrets：`doc/SECURITY.md`
- Ops / DB / go-live：`doc/RUNBOOK.md`（細節：`doc/runbook/*`）
- AI / OpenRouter ops：`doc/runbook/ai-analysis.md`
- 文件分工 / update matrix：`doc/GOVERNANCE.md`
- Drift tracker + playbooks（stable `@see` index）：`uiux_refactor.md`

---

## 1) Drift / Clean-code 問題清單（Active）

> 本節只列「尚未修復」的飄移/技術債；已完成項一律歸檔到 `doc/archive/*`。

### Drift-Docs-1：`uiux_refactor.md` §4 的 drift 狀態未同步（已修復仍標示 ACTIVE）

- Evidence：
  - `uiux_refactor.md` §4 item 14/15 仍為 `[ACTIVE]`（但實作已落地）
  - Fix 依據：`doc/archive/2026-01-21-step-plan-v5-drift-hardening-site-url-cta-settings-cleanup.md`（PR-19, PR-20）
  - Code evidence：
    - `lib/infrastructure/openrouter/openrouter-chat-io.ts` 已 import `SITE_URL`（不直接讀 `NEXT_PUBLIC_SITE_URL`）
    - `components/home/HomePageV2.tsx` 已做 external URL allowlist（invalid → 不 render）
- Violates：`doc/GOVERNANCE.md`（文件同步；避免「文件 vs 現況」飄移）
- Impact：drift tracker 誤報 → 影響後續修復優先序、增加不必要的回歸檢查成本

### Drift-Docs-2：`doc/STATUS.md` 未同步近期落地狀態（Last Updated 停留舊日期）

- Evidence：`doc/STATUS.md` header `Last Updated` = 2026-01-17（落後 `doc/SPEC.md`/`ARCHITECTURE.md`）
- Impact：Owner dashboard 與 SSoT 不一致，易誤判「已做/未做」與 drift 狀態

---

## 2) Execution Plan（Active；以 PR 為單位；每 PR 可獨立驗收/回退）

### PR-26 — Docs：同步 drift tracker（uiux_refactor §4）+ Owner dashboard

目標：把「文件狀態」重新對齊 `doc/SPEC.md` 與 repo 現況，避免 docs 自身 drift。

Steps：

1. 更新 `uiux_refactor.md` §4 item 14/15 狀態：`[ACTIVE]` → `[ARCHIVED ✅]`（**不得改號**）
   - item 14：補連結到 `doc/archive/2026-01-21-step-plan-v5-drift-hardening-site-url-cta-settings-cleanup.md`（PR-19）+ `tests/site-url-single-source.test.ts` + `ARCHITECTURE.md` §3.11
   - item 15：補連結到 `doc/archive/2026-01-21-step-plan-v5-drift-hardening-site-url-cta-settings-cleanup.md`（PR-20）+ `tests/validators/external-url.test.ts` + `doc/specs/proposed/GALLERY_HERO_IMAGE_AND_HOTSPOTS.md`（FR-11.1）
2. 更新 `doc/STATUS.md`
   - `Last Updated` 改為 2026-01-21
   - Drift 區塊：明確標示「目前無 ACTIVE drift（以 uiux_refactor §4 為準）」
   - Next 區塊：僅保留 ROADMAP 的未完成項（避免把已落地內容重複列成 pending）
3. 文件索引與連結驗證
   - `npm run docs:generate-indexes`（更新 `doc/archive/README.md`、`doc/specs/README.md`）
   - `npm run lint:md-links`（檢查 markdown links + anchors）

DoD：

- `uiux_refactor.md` §4 無 `[ACTIVE]` 誤報（除非真的有 drift）
- `doc/STATUS.md` 與 `doc/SPEC.md`、`ARCHITECTURE.md` 日期與敘述一致
- `npm run lint:md-links` 通過

---

## 3) 每 PR 驗證清單（不可省略）

- `npm test`
- `npm run lint`
- `npm run type-check`
- Docs：`npm run docs:generate-indexes`, `npm run lint:md-links`
- `npm run build`（routes/SEO/redirect 相關 PR 必跑；先確認 `.env.local` 已設 `NEXT_PUBLIC_SITE_URL` + Supabase public env）

