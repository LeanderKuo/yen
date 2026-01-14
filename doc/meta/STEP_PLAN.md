# Step-by-Step Execution Plan — AI Safety Risk Engine (Comments) V1

> Status: **DRAFT**  
> Last Updated: 2026-01-13  
> Owner: Site Owner  
> Audience: executor agent（照本檔逐 PR 執行；每個 PR merge 後更新本檔）  
> Mode: **Execution**（V1: comments text-only safety risk engine + Admin review/corpus/settings）  
> Spec Input: `doc/specs/proposed/safety-risk-engine-spec.md`

## Scope（IS / IS NOT）

In Scope（V1）:

- Blog / Gallery 的文字留言（`POST /api/comments`）
- 三層防禦：Layer 1 rules → Layer 2 RAG → Layer 3 LLM（OpenRouter）
- Safety corpus（slang/cases）後台維護 + embeddings（覆用既有 pipeline）
- Safety queue（HELD）後台人工審核/標註 + 快軌 promote-to-corpus

Out of Scope（由其他模組處理 / V2）:

- 一般辱罵/惡意攻擊（spam/abuse）
- 圖片分析（Gallery image）
- 進階模型訓練（LoRA、自架模型）

---

## Inputs（SSoT / constraints）

- Architecture / global constraints: `ARCHITECTURE.md`
- Implemented behavior baseline (SSoT): `doc/SPEC.md#comments`
- Security / RLS / secrets: `doc/SECURITY.md`
- Ops / DB scripts: `doc/RUNBOOK.md`（details: `doc/runbook/*`）
- Docs SRP + update matrix: `doc/GOVERNANCE.md`
- Spec (design + contracts): `doc/specs/proposed/safety-risk-engine-spec.md`
- Reusable platform specs:
  - `doc/specs/completed/embeddings-semantic-search-spec.md`
  - `doc/specs/completed/data-preprocessing-pipeline-spec.md`
  - `doc/specs/completed/embedding-queue-dispatcher-worker-spec.md`

---

## 0) TL;DR（執行順序）

1. ✅ **PR-1【P1】DB foundation + constraints**：新增 safety tables + `comment_moderation` pointers；擴充 embeddings `target_type`（已完成 2026-01-13）
2. **PR-2【P1】Embeddings pipeline support**：`EmbeddingTargetType` + target content fetcher + Edge Function allowlist（支援 `safety_*`）
3. ✅ **PR-3【P1】OpenRouter generic runner + Safety pure modules**：`runChatCompletion` + `engine/pii/prompt`（可單測）（已完成 2026-01-13）
4. ✅ **PR-4【P1】Safety IO orchestration**：RAG + LLM + settings IO + assessment persistence（Fail Closed）（已完成 2026-01-14）
5. **PR-5【P1】Integrate into `createComment()`**：依 §4.2.0（Spam → Safety）同步執行；落庫語意對齊（REJECT/HELD/APPROVE）
6. **PR-6【P1】Admin UI**：Safety queue/detail + corpus + settings；promote-to-corpus → enqueue embeddings；文件同步

---

## 1) Constraints（Non‑Negotiables）

- **Latency budget**：Safety layer 1–3 同步路徑必須在 **2000ms** 內完成；任何 timeout/unavailable → **Fail Closed → HELD**（`doc/specs/proposed/safety-risk-engine-spec.md` §2, §6）
- **PII**：任何送往外部 AI（embeddings / OpenRouter）前必須先去識別化（`ARCHITECTURE.md` + spec §2/§3）
- **Bundle boundary**：Safety/AI code 必須 server-only；public UI 不得 import admin/AI deps（`ARCHITECTURE.md`）
- **AI SDK boundaries**：
  - OpenRouter API access：只允許在 `lib/infrastructure/openrouter/**`（server-only）
  - OpenAI SDK：只允許在 `supabase/functions/**`（本功能不新增新的 OpenAI function）
- **IO boundaries**：API routes 保持薄（parse/validate → call `lib/**` → return）；IO modules 必須 `import 'server-only';`（`ARCHITECTURE.md`）
- **Modules isolation**：`lib/modules/*` 禁止跨模組依賴（Safety module 不得直接 import `lib/modules/comment/**` 以外的 domain；只依賴 `infrastructure/`、`types/`、`validators/`、`utils/`）

---

## PR-1 — DB foundation（Safety tables + pointers + embeddings target_type）【P1】

### Goal

- 讓 Safety 引擎具備「可落庫、可稽核、可後台查詢」的資料基礎，但**不改 runtime 行為**（只加 schema）。

### Scope

- 新增（spec §9）：
  - `public.safety_corpus_items`（slang/case；draft→active→deprecated）
  - `public.safety_settings`（singleton；feature toggle/model/timeout/threshold/messages）
  - `public.comment_safety_assessments`（歷史/可稽核）
- 擴充（spec §9.4）：
  - `public.comment_moderation`：新增 `safety_latest_*` pointers/summary 欄位
- 擴充（spec §9.5）：
  - `public.embeddings.target_type` CHECK constraint（新增 `safety_slang` / `safety_case`）
  - `public.embedding_queue.target_type` CHECK constraint（同步新增）

### Expected file touches

- `supabase/02_add/19_safety_risk_engine.sql` (new)
- `supabase/01_drop/19_safety_risk_engine.sql` (new)
- `supabase/02_add/13_embeddings.sql`（更新 target_type CHECK constraints；必要時 DROP/ADD CONSTRAINT）
- `supabase/02_add/02_comments.sql`（`comment_moderation` 增欄；必要時 index）
- `supabase/COMBINED_ADD.sql`
- `supabase/COMBINED_DROP.sql`
- `supabase/COMBINED_GRANTS.sql`（若此 repo 以此為 GRANT SSoT）
- `supabase/COMBINED_SEED.sql`（新增 `safety_settings` default row；可選：初始 safety corpus seed）
- `scripts/db.mjs`（可選：新增 `safety_risk_engine` feature entry，或把 safety SQL 納入 comments/embedding feature）

### Steps（按順序；每步驟都要可驗證）

1. 新增 `supabase/02_add/19_safety_risk_engine.sql`：
   - `CREATE TABLE IF NOT EXISTS public.safety_corpus_items (...)`
     - 欄位建議：`id uuid PK`, `kind ('slang'|'case')`, `status ('draft'|'active'|'deprecated')`, `label text`, `content text`, `created_by/updated_by uuid?`, `created_at/updated_at`
     - **active 才允許被 RAG 使用**（RAG 查詢需 filter status）
   - `CREATE TABLE IF NOT EXISTS public.safety_settings (...)`
     - singleton：`id int primary key check (id=1)` 或 `id int primary key` + seed `id=1`
     - 包含：`is_enabled`, `model_id`, `timeout_ms`, `risk_threshold`, `held_message`, `rejected_message`,（可選）`layer1_blocklist jsonb`
   - `CREATE TABLE IF NOT EXISTS public.comment_safety_assessments (...)`
     - 欄位至少覆蓋 spec §5.2（layer1_hit, rag context, provider/model_id, ai_risk_level/confidence/reason, human_label/reviewed_by）
2. 更新 `public.comment_moderation`（在 `supabase/02_add/02_comments.sql` 或 `19_*.sql` 以 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`）：
   - `safety_latest_assessment_id uuid null`
   - `safety_latest_decision text null`（`APPROVED|HELD|REJECTED`）
   - `safety_latest_risk_level text null`（`High|Safe`）
   - `safety_latest_confidence numeric null`（0–1）
   - 加 index：`idx_comment_moderation_safety_decision`（queue filters）
3. 更新 `public.embeddings` / `public.embedding_queue` target_type CHECK：
   - `ALTER TABLE ... DROP CONSTRAINT IF EXISTS embeddings_target_type_check;`
   - `ALTER TABLE ... ADD CONSTRAINT embeddings_target_type_check CHECK (target_type IN (..., 'safety_slang','safety_case'));`
   - 同步 `embedding_queue_target_type_check`
4. RLS/GRANT（Admin-only）
   - `safety_*` tables：policy pattern 參考 `comment_moderation`（JWT role owner/editor）
   - `comment_safety_assessments`：INSERT 會由 server/service_role 執行（comment submit path），仍建議保留 admin read/update（human label）
5. Seed（最小可用）
   - `safety_settings` 建立 `id=1` 預設 row（enabled=false 起步也可；但需避免 null 分支）
6. 更新 combined SQL（確保 `npm run db:reset` 可一鍵建庫）
7. DB verify queries（寫進 PR 描述並在本機/preview DB 跑過）：
   - `select * from public.safety_settings where id=1;`
   - `select column_name from information_schema.columns where table_name='comment_moderation' and column_name like 'safety_%';`
   - `select distinct target_type from public.embedding_queue;`（確認 CHECK constraint 接受 safety types）

### Verification

- `npm run db:reset`（本機/preview；確保 add/drop/seed 無錯）
- `npm run type-check`（若 TS types/validators 尚未改，這步可延後到 PR-2）

### Docs updates（per `doc/GOVERNANCE.md`）

- `doc/SECURITY.md`：新增 `safety_*` tables RLS/RBAC 說明（合併到 PR-6 亦可，但不要漏）
- `doc/RUNBOOK.md` / `doc/runbook/database-ops.md`：若新增 safety feature entry 或變更 db scripts 行為，需同步

### Rollback

- revert 本 PR；或在 DB 端執行 `supabase/01_drop/19_safety_risk_engine.sql`（若已部署）

---

## PR-2 — Embeddings pipeline support（safety corpus target types end-to-end）【P1】

### Goal

- 讓 `safety_corpus_items` 能覆用既有 preprocessing + embedding queue + embeddings table，不另造輪子（spec §3 第二層、§7、§9.5）。

### Scope

- TS types/validators 擴充 `EmbeddingTargetType`：新增 `safety_slang` / `safety_case`
- `lib/modules/embedding/embedding-target-content-io.ts`：能 fetch safety corpus raw content
- `supabase/functions/generate-embedding`：targetType allowlist 擴充（store=true 用於 corpus embeddings）
-（必要時）embedding batch/stats/monitoring modules：處理新增 target types

### Expected file touches

- `lib/types/embedding.ts`
- `lib/validators/embedding.ts`
- `lib/modules/embedding/embedding-target-content-io.ts`
- `lib/modules/embedding/embedding-batch-io.ts`（`Record<EmbeddingTargetType,...>` mapping）
- `supabase/functions/generate-embedding/index.ts`
- `tests/embedding/**`（新增/調整 unit tests）

### Steps

1. 更新 `lib/types/embedding.ts`
   - `EmbeddingTargetType` 加入 `safety_slang` / `safety_case`
   - `EmbeddingStats` / batch stats 若以 enum keys 為 SSOT，需同步加入 safety keys（或明確排除並註記）
2. 更新 `lib/validators/embedding.ts`
   - allowlist 同步（避免 runtime 接收非法 targetType）
3. 更新 `lib/modules/embedding/embedding-target-content-io.ts`
   - 新增 fetcher：`getSafetyCorpusItemContent(targetId)`
     - 來源：`public.safety_corpus_items`
     - 僅允許 `status='active'`（避免把 draft/deprecated 送去 embedding）
     - context: `targetType='safety_*'`, `targetId`, `parentTitle` 可用 `label`
4. 更新 `supabase/functions/generate-embedding/index.ts`
   - `targetType` allowlist 加入 `safety_slang` / `safety_case`
   -（若 type narrowing 需要）更新 `EmbeddingRequest.targetType` union
5. 測試
   - 新增 `tests/embedding/safety-corpus-target-content.test.ts`（或放在既有 embedding tests）
     - 驗證：`getTargetContent('safety_slang', id)` 在 stubbed DB 回傳正確 rawContent/context
   - 跑 `npm test`（確保 architecture guardrails 沒被破壞）

### Verification

- `npm test`
- `npm run type-check`
- `rg -n \"safety_slang|safety_case\" lib supabase/functions -S`（確認 type/allowlist/target content 都已覆蓋）

### Docs updates（per `doc/GOVERNANCE.md`）

- `doc/specs/proposed/safety-risk-engine-spec.md`：若實作與 spec 欄位/命名有調整，更新 spec（heading 保持穩定）

### Rollback

- revert 本 PR

---

## PR-3 — OpenRouter generic runner + Safety pure modules（layer1 + PII + prompt/parse）【P1】✅ 已完成 2026-01-13

### Goal

- 依 spec §0(6A)：OpenRouter 基礎設施提供通用 runner；Safety domain 只做 prompt/parse。
- 建立 Safety 引擎的 pure 核心（可單測、可快速迭代）。

### Scope

- `lib/infrastructure/openrouter/**`：新增 `runChatCompletion`（可配置 timeout/model/temperature/max_tokens）
- `lib/modules/safety-risk-engine/*`（pure）：
  - `engine.ts`（Layer 1 rules + decision skeleton）
  - `pii.ts`（free-text 去識別化）
  - `prompt.ts`（prompt 組裝 + JSON parse/validate）
- 單元測試：engine/pii/prompt parse

### Expected file touches

- `lib/infrastructure/openrouter/openrouter-chat-io.ts` (new) 或擴充 `openrouter-run-io.ts`
- `lib/infrastructure/openrouter/index.ts`
- `lib/modules/safety-risk-engine/engine.ts` (new)
- `lib/modules/safety-risk-engine/pii.ts` (new)
- `lib/modules/safety-risk-engine/prompt.ts` (new)
- `lib/types/safety-risk-engine.ts` (new; domain types)
- `tests/safety-risk-engine/**` (new)

### Steps

1. 新增 `runChatCompletion`（server-only）
   - 輸入：`messages`, `model`, `timeoutMs`, `temperature`, `maxTokens`…
   - 輸出：`content`, `usage`, `model`（不要耦合到 AI Analysis 的 markdown contract）
   - timeout 用 `AbortController`（Safety 會用更短 timeout）
2. 建立 domain types（`lib/types/safety-risk-engine.ts`）
   - `SafetyDecision = 'APPROVED'|'HELD'|'REJECTED'`
   - `SafetyRiskLevel = 'High'|'Safe'`
   - `SafetyAssessmentDraft`（對齊 spec §5.2；後續會落庫）
3. `pii.ts`（pure）
   - 最小 V1：redact email/phone/address-like patterns + URLs（不追求完美，但必須「先去識別化再送 AI」）
   - 回傳：`{ text: string; redactions: Array<{ type; valueHash?; }> }`（可選）
4. `prompt.ts`（pure）
   - 組 prompt：system + user，強制「僅回 JSON」
   - parse：容忍 model 包裹 ```json ...```；抽出 JSON 並 validate（risk_level/confidence/reason）
5. `engine.ts`（pure）
   - Layer 1：高置信度 rules（可先 hardcode 少量 patterns；blocklist 之後再移到 DB settings）
   - Decision policy：低信心/錯誤 → HELD（Fail Closed）
6. Tests
   - `tests/safety-risk-engine/pii.test.ts`
   - `tests/safety-risk-engine/prompt-parse.test.ts`
   - `tests/safety-risk-engine/engine.test.ts`

### Verification

- `npm test`
- `npm run type-check`
- `rg -n \"openrouter\" lib/modules/safety-risk-engine -S` → 0 hits（domain 不直接打 OpenRouter；只能經 infrastructure runner）

### Docs updates（per `doc/GOVERNANCE.md`）

- `ARCHITECTURE.md`：若新增 OpenRouter runner 作為 canonical API，需要補一行出口（可選；但要避免 drift）

### Rollback

- revert 本 PR（純新增/擴充；不影響 runtime 行為）

---

## PR-4 — Safety IO orchestration（RAG + LLM + settings IO + assessment persistence）【P1】✅ 已完成 2026-01-14

### Goal

- 落地 spec §3（Layer 2/3）與 §6（failure modes），提供一個「可在 `createComment()` 內同步呼叫」的 server-only orchestrator。

### Scope

- `rag-io.ts`：用 `lib/modules/embedding/embedding-search-io.ts` semantic search，targetTypes 限制在 `safety_*`
- `llm-io.ts`：呼叫 `runChatCompletion`，套用 strict timeout（從 `safety_settings` 讀）
- `settings-io.ts`：讀取 singleton `safety_settings`
- `admin-io.ts`（或 `assessments-io.ts`）：寫入 `comment_safety_assessments` + 更新 `comment_moderation.safety_latest_*`（service_role）

### Expected file touches

- `lib/modules/safety-risk-engine/rag-io.ts` (new)
- `lib/modules/safety-risk-engine/llm-io.ts` (new)
- `lib/modules/safety-risk-engine/settings-io.ts` (new)
- `lib/modules/safety-risk-engine/admin-io.ts` (new)
- `tests/safety-risk-engine/**`（IO 層測試可用 mock）

### Steps

1. `settings-io.ts`（server-only）
   - `getSafetySettings()`：讀 `public.safety_settings where id=1`
   - 預設值策略：任何欄位 null → fallback（避免 runtime 分支爆炸）
2. `rag-io.ts`（server-only）
   - 輸入：去識別化後的 comment text
   - `semanticSearch({ query, targetTypes: ['safety_slang','safety_case'], limit: 3, threshold: ... })`
   - 取回 targetIds 後，從 `safety_corpus_items` 拉 `label/content/kind`（僅 active）
   - 產出 `layer2Context[] = { text, label, score }`
   - Failure mode：RPC/embedding 失敗 → 回空 context（讓 layer3 仍可跑）
3. `llm-io.ts`（server-only）
   - 組 prompt：`prompt.ts` + layer2Context + deidentified comment
   - timeout：`min(safety_settings.timeout_ms, 1500)`（確保總 budget）
   - parse：`prompt.ts` 的 JSON parser；parse fail → HELD
4. `admin-io.ts`（server-only）
   - `insertCommentSafetyAssessment(...)`：寫入 `comment_safety_assessments`
   - `updateCommentModerationSafetyPointer(commentId, assessmentId, decision, riskLevel, confidence)`：更新 latest pointers
   - 寫入需使用 `createAdminClient()`（因 comment submit path 不是 admin JWT）
5. Tests（最小）
   - mock `semanticSearch` 回傳固定 results，確保 `rag-io` 組 context 正確
   - mock `runChatCompletion` 回傳固定 JSON，確保 `llm-io` parse/timeout 路徑

### Verification

- `npm test`
- `npm run type-check`
- `rg --files-without-match \"import 'server-only';\" lib/modules/safety-risk-engine --glob \"**/*-io.ts\"` → 0 hits

### Docs updates（per `doc/GOVERNANCE.md`）

- `doc/SECURITY.md`：補 `comment_safety_assessments`/`safety_*` 的 RLS（若 PR-1 沒寫）

### Rollback

- revert 本 PR

---

## PR-5 — Integrate into comments pipeline（Spam → Safety; persist + fail-closed）【P1】

### Goal

- 依 spec §4.2.0：在 `createComment()` 內落地「Spam local → Spam external → Safety」順序。
- 對齊落庫語意（spec §4.2.0）：`REJECTED`（不落庫）、`HELD`（落庫但不可公開）、`APPROVED`（可公開）。

### Scope

- `lib/modules/comment/comments-write-io.ts`：在 spam allow 且 candidateToPublish 時同步跑 Safety
- `lib/spam/engine.ts` / `lib/spam/spam-check-io.ts`：對齊 spec 4B 的 degraded/unavailable 行為（特別是 reCAPTCHA misconfigured）
- `comment_moderation`：寫入 safety latest pointers
- Public API response：保持 P0-6（不回傳任何 safety assessment 細節）

### Expected file touches

- `lib/modules/comment/comments-write-io.ts`
- `lib/spam/engine.ts`
- `lib/spam/spam-check-io.ts`
- `lib/types/comments.ts`（若需要擴充 decision/message contract）
- `tests/spam-engine.test.ts`（補 external unavailable/degraded case）
- `tests/**`（必要時補 integration-ish unit tests）

### Steps

1. 調整 spam engine（對齊 spec §4.2.0）
   - reCAPTCHA **token missing**：維持 `pending`（防繞過；spec 明確要求）
   - reCAPTCHA **secret missing / request_failed**：視為 `unavailable`（不應單獨導致 pending）
   - external checks **全部不可用**才 `pending`（若 Akismet 可用則允許 degraded 繼續）
   - 將上述邏輯寫成 pure decision（加測試，避免回歸）
2. 更新 `createComment()`（核心整合點）
   - 現況：先 `checkForSpam()` → insert comment（is_approved/is_spam）→ insert `comment_moderation`
   - 新流程（只在 candidateToPublish=true 時跑 Safety）：
     1) `checkForSpam()`（保持既有）
     2) 若 spamResult.decision !== 'allow' → 直接走既有 insert（pending/spam），**不跑 Safety**
     3) 若 spamResult.decision === 'allow'：
        - Layer 1（pure）：若命中 → `HELD` 或 `REJECTED`（依 settings/預設保守）
        - Layer 2/3：`pii.ts` → `rag-io.ts` → `llm-io.ts`
        - 若 `REJECTED`：return `{ success:false, decision:'reject', ... }`（**不插入 comments**）
        - 若 `HELD`：insert comment with `is_approved=false`（確保不公開）
        - 若 `APPROVED`：insert comment with `is_approved=true`
     4) 無論 HELD/APPROVED：都寫入 `comment_moderation`（既有 spam fields）+ safety pointers（assessment + summary）
3. assessment 落庫
   - 在 comment insert 成功後：
     - `insertCommentSafetyAssessment`（寫 `comment_safety_assessments`）
     - `updateCommentModerationSafetyPointer`（寫 latest fields）
   - 若 assessment 寫入失敗：**Fail Closed** 的可觀測策略（log + 仍維持 comment 為 `is_approved=false` 或維持 `pending`，避免漏網）
4. Public API response（`app/api/comments/route.ts`）
   - 保持 route 薄；只依 `createComment()` result 決定 HTTP status/message
   - **不得**把 `comment_safety_assessments` 內容回傳給 public
5. Tests
   - `tests/spam-engine.test.ts`：補「reCAPTCHA secret missing + Akismet ok → allow」（degraded）等 case
   - `tests/safety-risk-engine/*`：補一個 orchestrator happy-path（mock IO）

### Verification

- `npm test`
- `npm run type-check`
- `npm run lint`
- Manual smoke（dev）：
  - 提交正常留言 → allow + 立即顯示
  - 提交含明顯高風險詞 → HELD（留言不公開；admin safety queue 可見）

### Docs updates（per `doc/GOVERNANCE.md`）

- `doc/SPEC.md#comments`：更新「新增 Safety risk engine」與 `HELD` 行為（在 PR-6 一次完成亦可）

### Rollback

- revert 本 PR（回到只有 spam pipeline）

---

## PR-6 — Admin UI（Safety queue/detail + corpus + settings）+ Docs sync【P1】

### Goal

- 依 spec §8：提供 admin-only 的 Safety queue / detail / corpus / settings，讓人可以審核、標註、促進 corpus 進化。

### Scope

- 新增 routes（不要污染既有 CommentsClient bundle；以獨立子頁面載入）
  - `/[locale]/admin/(blog)/comments/safety`
  - `/[locale]/admin/(blog)/comments/safety/[commentId]`
  - `/[locale]/admin/(blog)/comments/safety/corpus`
  - `/[locale]/admin/(blog)/comments/safety/settings`
- Server actions + IO
  - queue list + filters
  - detail（assessment + context）
  - approve/reject/label
  - corpus CRUD + activate/deprecate + promote-to-corpus（enqueue embeddings）
  - settings update（threshold/model/timeout/toggle/messages）
- 文件同步（SSoT + indexes）

### Expected file touches

- `app/[locale]/admin/(blog)/comments/safety/page.tsx` (new)
- `app/[locale]/admin/(blog)/comments/safety/SafetyQueueClient.tsx` (new)
- `app/[locale]/admin/(blog)/comments/safety/actions.ts` (new)
- `app/[locale]/admin/(blog)/comments/safety/[commentId]/page.tsx` (new)
- `app/[locale]/admin/(blog)/comments/safety/[commentId]/SafetyDetailClient.tsx` (new)
- `app/[locale]/admin/(blog)/comments/safety/corpus/page.tsx` (new)
- `app/[locale]/admin/(blog)/comments/safety/corpus/SafetyCorpusClient.tsx` (new)
- `app/[locale]/admin/(blog)/comments/safety/settings/page.tsx` (new)
- `app/[locale]/admin/(blog)/comments/safety/settings/SafetySettingsClient.tsx` (new)
- `components/admin/common/AdminSidebar.tsx`（新增 Safety link；只加 link，不 import safety client）
- `messages/en.json`, `messages/zh.json`（admin i18n）
- `lib/modules/safety-risk-engine/admin-io.ts`（擴充：queue reads + corpus/settings mutations + review actions）
- `doc/SPEC.md`, `doc/SECURITY.md`, `doc/RUNBOOK.md`
- `doc/specs/proposed/safety-risk-engine-spec.md`（status update；落地後 move to `completed/`）
- `doc/archive/<date>-safety-risk-engine-v1-implementation.md`（可選：implementation log）

### Steps

1. Admin navigation（最小變更）
   - 在 Comments 區塊加入 link：`/admin/comments/safety`（不要把 Safety components import 進既有 comments page）
2. Safety Queue
   - query：`comment_moderation.safety_latest_decision='HELD'` join `comments`
   - list row：comment snippet + target + createdAt + risk_level/confidence/reason（截斷）
   - filters：risk_level/confidence/date/targetType
3. Safety Detail
   - 顯示：原文 + layer1 hit + layer2 context（score/label/text）+ layer3 JSON（model/latency/reason）
   - actions：Approve / Reject / Label / Promote-to-corpus
4. Corpus 管理
   - CRUD：新增 slang/case（draft）
   - 狀態流轉：draft→active→deprecated
   - active 時：enqueue embeddings（`enqueueEmbedding({ targetType:'safety_*', targetId })`）
5. Settings 管理
   - singleton 表單：enable toggle / modelId / timeoutMs / threshold / held/reject messages
6. 權限
   - 所有 server actions 先 `isSiteAdmin()`；再呼叫 `lib/modules/safety-risk-engine/admin-io.ts`
7. Docs sync（必做；避免 drift）
   - `doc/SPEC.md#comments`：新增 Safety risk engine、admin routes、決策語意（REJECT/HELD/APPROVE）
   - `doc/SECURITY.md`：新增 safety tables RLS / service_role writes 的邊界
   - `doc/RUNBOOK.md`：補「Safety queue 操作」與「seed/embedding queue」相關 ops（links only）
   - spec 歸檔：落地後將 `doc/specs/proposed/safety-risk-engine-spec.md` 移到 `doc/specs/completed/` 並更新 status
8. Docs validation（必做）
   - `npm run docs:generate-indexes`
   - `npm run lint:md-links`
   - `npm run docs:check-indexes`

### Verification

- `npm test`
- `npm run type-check`
- `npm run lint`
- Admin manual checks（dev / preview）：
  - Safety queue 可列出 HELD comments
  - approve/reject 會更新 `comments.is_approved` 與 `comment_moderation.safety_latest_decision`
  - promote-to-corpus 會 enqueue embedding 並可由 embedding queue worker 產生 embeddings

### Rollback

- revert 本 PR（UI + admin actions）；DB schema 仍保留（不影響 public runtime）

---

## Gate Checklist（每次合併前）

- `npm test` / `npm run type-check` / `npm run lint` 全部通過
- `rg -n \"OPENAI_API_KEY\" app lib -S` → 0 hits（OpenAI SDK 僅存在於 `supabase/functions/**`）
- `rg -n \"openrouter\\.ai\" app components lib -S` → 只允許在 `lib/infrastructure/openrouter/**`
- `rg --files-without-match \"import 'server-only';\" lib/modules/safety-risk-engine --glob \"**/*-io.ts\"` → 0 hits

