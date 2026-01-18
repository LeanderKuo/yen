# TASKS（可立即拆 PR）— Steps

> Last Updated: 2026-01-17  
> Status: ACTIVE（只保留「未完成 + 可立即開始」項目）
>
> Blockers / external dependencies: `BLOCKERS.md`  
> Implemented behavior: `SPEC.md`  
> High-level backlog: `ROADMAP.md`  
> Completed records: `archive/`

本文件定位：**提供可直接拆 PR 的 step-by-step**。只寫「怎麼做」，不寫規格/約束（約束一律以 `../ARCHITECTURE.md` 為準）。

不放在本文件的內容（避免跟其他文件混淆）：

- **品質守門/修復手冊**：看 `../uiux_refactor.md`（§2 checklist、§3 playbooks）
- **現況/規格宣稱（what exists now）**：看 `SPEC.md`
- **安全規則（auth/RLS/secrets/webhooks）**：看 `SECURITY.md`
- **部署/DB ops/驗證**：看 `RUNBOOK.md`（index；細節在 `runbook/*`）
- **高階狀態/風險（what/why/status）**：看 `ROADMAP.md`
- **已完成歷史**：寫到 `archive/`（並更新 `archive/README.md`）

---

## 0. Preflight（每次 PR）

- 照 `../uiux_refactor.md` §2（tests/type-check/lint + drift quick grep）

---

## 1. Production DB alignment（P0）

目標：避免 prod/local schema/RLS/seed drift，並確保 `supabase/COMBINED_*` 可重跑。

- Canonical runbook: `runbook/database-ops.md`

Steps:

- [ ] 依 `runbook/database-ops.md` 設定 `psql` + `SUPABASE_DB_URL`
- [ ] 選擇操作：
  - 本機重建：`npm run db:reset`（drop → add → seed）
  - 生產對齊：依 runbook 的安全流程執行（避免在 prod 跑 `drop`）
- [ ] 跑完後用 runbook 的 verification queries 確認 singleton/seed/feature flags 正常
- [ ] 完成後更新：`ROADMAP.md` 對應項目的 status

---

## 2. Pre-release guardrails（P0）

目標：確保 merge/deploy 前 guardrails 不漂移（architecture + types + docs）。

- Canonical checklist: `../uiux_refactor.md` §2

Steps:

- [ ] `npm test`
- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] `npm run docs:check-indexes`
- [ ] `npm run lint:md-links`
- [ ] （建議）`npm run build`（避免 build-time regressions）
- [ ] 完成後更新：`ROADMAP.md` 對應項目的 status

---

## 3. Theme console manual verification（P0）

目標：避免 public SSR FOUC、Owner/Editor flows 漏洞或視覺 drift。

- Canonical playbook: `../uiux_refactor.md` §3.9

Steps:

- [ ] 依 playbook 跑完所有 manual verification
- [ ] 若發現 drift：補 evidence paths 到 `../uiux_refactor.md` §4，細節與修復記錄放 `archive/`
- [ ] 完成後更新：`ROADMAP.md` 對應項目的 status
