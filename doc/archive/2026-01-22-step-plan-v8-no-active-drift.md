# 2026-01-22 - Step Plan V8（No Active Drift；Ready for next drift）(Archive)

> Date: 2026-01-22  
> Status: COMPLETE ✅ (Archived snapshot; active plan lives in `../meta/STEP_PLAN.md`)  
> Scope: snapshot of V8 meta plan before new drift items were added  
> Implemented behavior (SSoT): `../SPEC.md`  
> Constraints: `../../ARCHITECTURE.md`

## Summary

- Why archive: `doc/meta/STEP_PLAN.md` 只保留 active drift / 下一步；過往版本一律移到 `doc/archive/*`
- What changed next: V9 開始追蹤新 drift（AI report markdown sanitize / feature gate cached / docs sync）

## Archived Snapshot（verbatim）

# Step-by-Step Execution Plan — V8（No Active Drift；Ready for next drift）

> 狀態: Active（Drift repair plan；本檔只寫「修復方案/步驟」，不在此直接改程式碼）  
> 最後更新: 2026-01-21  
> 現況 SSoT（已實作行為）: `doc/SPEC.md`  
> 目標 PRD（約束/合約）: `doc/specs/proposed/GALLERY_HERO_IMAGE_AND_HOTSPOTS.md`（Implementation Contract）  
> Repo 驗證（2026-01-21）：`npm test`（1083 pass）, `npm run lint`, `npm run type-check`, `npm run lint:md-links` 全通過  
> 歷史完成紀錄（snapshots；已完成的一律只留 archive）：
>
> - V2 snapshot（PR-9..PR-12）：`doc/archive/2026-01-21-step-plan-v2-home-uiux-gallery-hotspots-hamburger-nav.md`
> - V3 snapshot（PR-13..PR-16）：`doc/archive/2026-01-21-step-plan-v3-home-uiux-gallery-hero-hotspots-hamburger-nav.md`
> - V4 snapshot（PR-17..PR-18）：`doc/archive/2026-01-21-step-plan-v4-seo-hotspots-clean.md`
> - V5 snapshot（PR-19..PR-21）：`doc/archive/2026-01-21-step-plan-v5-drift-hardening-site-url-cta-settings-cleanup.md`
> - V6 snapshot（PR-22..PR-25）：`doc/archive/2026-01-21-step-plan-v6-architecture-hardening-io-boundaries-io-module-split.md`
> - V7 snapshot（PR-26）：`doc/archive/2026-01-21-step-plan-v7-docs-sync-drift-review-archive-hygiene.md`

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

- None（2026-01-21）：Open drift items 以 `uiux_refactor.md` §4 為準。

---

## 2) Execution Plan（Active；以 PR 為單位；每 PR 可獨立驗收/回退）

> 當發現新 drift 時（docs/code mismatch），請先照 `uiux_refactor.md` §2/§3 做快速確認，再在本節新增可拆 PR 的落地步驟。

新增 PR item 的最小格式（**務必寫死到檔名/函式/指令；避免模糊**）：

1. Title：`PR-XX — <Domain>：<1 句話描述 drift 修復>`
2. Evidence（必填）：列出 `rg` 指令與命中的檔案路徑（至少 1 個）
3. Violates（必填）：引用 `ARCHITECTURE.md`/`doc/SPEC.md`/對應 PRD 的章節或 anchor
4. Fix steps（必填）：
   - 明確列出要新增/修改的檔案路徑（逐一列出）
   - 明確列出要移除的舊呼叫點（逐一列出）
   - 若涉及 cache/SEO：明確列出要補的 `revalidateTag`/`revalidatePath` 與 canonical/redirect 行為
5. DoD（必填）：
   - `npm test`, `npm run lint`, `npm run type-check`
   - 針對 drift 的 grep 應為 0 命中（列出指令）
6. Post-merge（必填）：
   - 更新 `uiux_refactor.md` §4 item 狀態（不得改號）
   - 把本檔的已完成 PR steps 移到 `doc/archive/<date>-step-plan-vX-*.md`
   - `npm run docs:generate-indexes` + `npm run lint:md-links`

---

## 3) 每 PR 驗證清單（不可省略）

- `npm test`
- `npm run lint`
- `npm run type-check`
- Docs：`npm run docs:generate-indexes`, `npm run lint:md-links`
- `npm run build`（routes/SEO/redirect 相關 PR 必跑；先確認 `.env.local` 已設 `NEXT_PUBLIC_SITE_URL` + Supabase public env）

