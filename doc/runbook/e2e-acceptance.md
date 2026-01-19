# E2E 驗收（本機 / Pre‑release）

> Canonical entry: `../RUNBOOK.md`  
> Last Updated: 2026-01-19  
> Audience: Owner / Dev（用來端到端驗收現況）

[Back to RUNBOOK index](../RUNBOOK.md)

本清單目標：讓你用「一條路徑」完成驗收，避免在 `SPEC / ROADMAP / RUNBOOK / ARCHITECTURE` 之間來回迷路。  
本專案尚未上線，DB 可重建（`npm run db:reset`）是預期使用方式。

---

## 0) TL;DR（最短路徑）

1. `npm install`
2. 建立 `.env.local`（至少：Supabase keys + `NEXT_PUBLIC_SITE_URL`）
3. Supabase：開專案 → 開 extension（`vector`, `pg_cron`, `vault`）→ 設定 Google OAuth
4. DB：`npm run db:reset`（需要 `SUPABASE_DB_URL` + `psql`）
5. Admin RBAC：把你的 email 寫入 `public.site_admins` → 登出再登入
6. 跑守門：`npm test && npm run type-check && npm run lint && npm run docs:check-indexes && npm run lint:md-links`
7. 跑起來：`npm run dev`（或 `npm run build && npm run start`）

---

## 1) 必要前置

- Node.js 20+（建議）
- `psql`（DB scripts 需要；見 `database-ops.md`）
- 一個 Supabase project（remote）

---

## 2) `.env.local`（最小可跑組合）

參考完整模板：`../../README.md`

最低需求（不含可選外部服務）：

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

ADMIN_ALLOWED_EMAILS=you@example.com

# DB scripts only
SUPABASE_DB_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require
```

可選（要驗收特定功能才需要）：

- Comments spam：`AKISMET_API_KEY`, reCAPTCHA keys（見 `../../README.md`）
- Safety Risk Engine（Gemini）：`GEMINI_API_KEY`（見 `doc/specs/completed/safety-risk-engine-spec.md`）
- AI Analysis：`OPENROUTER_API_KEY`（見 `doc/specs/completed/ai-analysis-spec.md` + `ai-analysis.md`）
- Preprocessing/Embeddings：`CRON_SECRET`, `WORKER_SECRET`（Next.js），以及 Supabase Edge Function Secrets（見 `embeddings-preprocessing.md`）

---

## 3) Supabase 專案設定（一次做完）

### 3.1 Extensions（Dashboard → Database → Extensions）

建議啟用：

- `vector`（必要：embeddings / safety corpus）
- `pg_cron`（若要跑 cron jobs）
- `vault`（若要在 Supabase 端存 secrets）

### 3.2 Google OAuth（必要：後台登入）

照 `deployment.md` 的「Google OAuth Setup」做一次即可（dev 用 `http://localhost:3000`）。

---

## 4) DB Reset（可重現性 / 端到端的核心）

照 `database-ops.md` 完整流程跑一次，最短指令：

```bash
npm run db:reset
```

跑完後用 `database-ops.md#verification` 的 SQL 確認：

- seed singleton/feature flags 正常
- `public.customer_profiles.short_id` 存在（避免後續 Users search / AI Analysis deep link 卡住）

---

## 5) Admin RBAC（不做會被 RLS 擋）

照 `database-ops.md#admin-rbac-setup`：

1. 先登入一次（建立 `auth.users`）
2. 在 SQL Editor 把你的 email 加入 `public.site_admins`
3. 登出再登入（刷新 JWT claims）

---

## 6) 驗收清單（按模組）

### 6.1 Public（不需任何 admin key）

- `/zh`：首頁可正常 SSR
- `/zh/blog`：列表可讀；開一篇文章可讀（SEO metadata 正常）
- `/zh/gallery`：列表可讀；點進作品頁可讀

### 6.2 Admin（需要 RBAC）

- `/<locale>/admin`：可登入並進後台（Owner/Editor）
- Features：可開關 `blog` / `gallery`（`/admin/features`）
- Theme：可編輯並預覽（不影響 public SSR）

### 6.3 Comments + Moderation（核心驗收）

- Public 留言：可在 Blog/Gallery 發留言
- Spam pipeline：開啟 reCAPTCHA 時，缺 token 會進 `pending`（防繞過）
- Safety queue：`/admin/comments/safety` 可看到 HELD items（若 safety 啟用）

### 6.4 Safety Risk Engine（可選；需要 `GEMINI_API_KEY`）

1. DB：設定 `public.safety_settings.is_enabled=true`
2. 發一則疑似高風險留言：
   - 期望：`risk_level=High_Risk/Uncertain` → 永遠 `HELD`
3. 發一則一般留言：
   - 期望：`risk_level=Safe` 且 `confidence>=threshold` → `APPROVED`；否則 `HELD`

Spec（單一真相）：`doc/specs/completed/safety-risk-engine-spec.md`

### 6.5 AI Analysis（可選；需要 `OPENROUTER_API_KEY`）

照 `ai-analysis.md`（enablement + cron）完成後：

- `/admin/(data)/ai-analysis`：可建立 report
- cron routes 可跑完 pending reports 並產出結果

### 6.6 Analytics（Page views；可選）

- 開啟 `NEXT_PUBLIC_ENABLE_PAGEVIEWS=true`（或保持預設關閉）
- 進入 public 頁面後確認 ingestion 有寫入（DB `page_view_daily`）

---

## 7) Pre‑release Guardrails（每次驗收都跑）

```bash
npm test
npm run type-check
npm run lint
npm run docs:check-indexes
npm run lint:md-links
```

（建議）也跑一次 build，避免 deploy 才爆：

```bash
npm run build
```

---

## 8) 常見卡點（快速解）

- `npm run build` 失敗：先確認 `.env.local` 有 `NEXT_PUBLIC_SITE_URL`
- Admin 看不到資料 / `violates row-level security`：RBAC 未完成或尚未重新登入（JWT 未刷新）
- DB scripts 跑不起來：`psql` 未安裝或 `SUPABASE_DB_URL` 不正確（見 `database-ops.md`）

