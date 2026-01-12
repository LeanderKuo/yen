# Step-by-Step Execution Plan — Scope Reduction (Remove Shop/Payments)

> Status: **COMPLETE**  
> Last Updated: 2026-01-12  
> Owner: Site Owner  
> Audience: executor agent（照本檔逐 PR 執行；每個 PR merge 後更新本檔）  
> Mode: **Execution**（本次目標是「去範圍 / 移除不用的 domain」，避免維護成本與 drift）  
> Scope（keep / in-scope）:
>
> - blog / comments / gallery
> - embedding / rag / data preprocessing
> - sentry
> - seo
> - user description（使用者資料/描述）
>
> Out of Scope（remove / delete）:
>
> - shop（products/cart/orders/coupons/members/admin shop pages）
> - pay/payments（Stripe/LINE Pay/ECPay webhooks + payment configs + checkout initiation stubs）
>
> Guardrail:
>
> - **沒提到的先不要刪掉**：本次只移除 shop/payments 相關程式與文件；其他未提及的功能先保留（即使目前看起來用不到）。

---

## 0) TL;DR（執行順序）

1. **PR-1【P1】Remove public shop**：刪除 `/${locale}/shop/*` 與 cart API；移除 Header/Footer/sitemap 的 shop 連結
2. **PR-2【P1】Remove admin shop**：刪除 `/admin/shop/*`；移除 AdminSidebar shop 導覽；移除 user detail 的「訂單」區塊
3. **PR-3【P1】Remove shop/payment modules**：刪除 `lib/modules/shop/*`、`lib/types/shop.ts`、webhooks、inventory-cleanup cron
4. **PR-4【P1】Remove product domain from embedding/preprocessing/AI analysis**：因為 product 屬於 shop；移除 product targetType + 相關 worker/edge functions
5. **PR-5【P1】Remove shop/payment Supabase SQL**：刪除 `supabase/*shop*.sql`，同步更新 `COMBINED_*.sql` + `scripts/db.mjs`
6. **PR-6【P1】Docs/Test cleanup**：更新 README/ARCHITECTURE/doc/* 與測試，確保無 shop/payments 殘留引用

---

## PR-1 — Remove public shop（routes + UI + nav + sitemap）【P1】

### Goal

- 公開站點不再提供 Shop（/shop、cart、checkout、product pages）。

### Delete（files / routes）

- `app/[locale]/shop/layout.tsx`
- `app/[locale]/shop/page.tsx`
- `app/[locale]/shop/cart/page.tsx`
- `app/[locale]/shop/checkout/page.tsx`
- `app/[locale]/shop/checkout/checkout-action.ts`
- `app/[locale]/shop/[category]/page.tsx`
- `app/[locale]/shop/[category]/[slug]/layout.tsx`
- `app/[locale]/shop/[category]/[slug]/page.tsx`
- `components/shop/CartContent.tsx`
- `components/shop/CheckoutForm.tsx`
- `components/shop/SimilarProducts.tsx`
- `hooks/useCart.ts`
- `hooks/useCartProductData.ts`
- `app/api/cart/items/route.ts`

### Update（code）

- `components/Header.tsx`：移除 shop 導覽項目（含 `NavContent.shop` / `isShopEnabledCached`）
- `components/Footer.tsx`：移除 shop 導覽項目
- `app/sitemap.ts`：移除 shop static page 與 shop sitemap entries
- `lib/features/*`：移除 shop feature key 與 cached helper（避免殘留 feature gate）

### Verification

- `rg -n \"\\/shop|@/lib/modules/shop|qnl-shop-cart\" app components lib hooks -S` → 0 hits（非 archive/doc）
- `npm run type-check`

### Rollback

- revert 本 PR

---

## PR-2 — Remove admin shop（routes + sidebar + user orders UI）【P1】

### Goal

- 後台不再出現 Shop 相關管理頁（Products/Orders/Coupons/Members/Payments/Settings）。

### Delete（files / routes）

- `app/[locale]/admin/shop/**`（整個資料夾）
- `components/admin/shop/**`（整個資料夾）
- `app/[locale]/admin/users/[id]/components/UserOrdersTable.tsx`（若僅用於 shop 訂單）
- `lib/modules/user/user-orders-io.ts`（cross-domain wrapper 依賴 shop）

### Update（code）

- `components/admin/common/AdminSidebar.tsx`：移除 shop entry
- `components/admin/common/AdminTabs.tsx`：移除 shop tabs/註解（若存在）
- `app/[locale]/admin/users/[id]/page.tsx` + `UserDetailClient.tsx`：移除 orders data fetch + UI 區塊

### Verification

- `rg -n \"admin\\/shop|\\bShop\\b\" app components -S`（確認無路由/連結殘留）
- `npm run type-check`

---

## PR-3 — Remove shop/payment modules（server modules + webhooks + cron）【P1】

### Delete（code modules）

- `lib/modules/shop/**`
- `lib/types/shop.ts`
- `lib/infrastructure/stripe/index.ts`（shim re-export shop payment modules）
- `app/api/webhooks/**`（stripe/linepay/ecpay）
- `app/api/cron/inventory-cleanup/route.ts`
- `tests/shop/**` + `tests/shop-*.test.ts`（variants/pricing/order-status/payment-config）

### Update（code）

- 移除所有 `@/lib/modules/shop/*` imports（routes/actions/components/tests）
- 若有 shop-only types：從 `lib/types/*` 移除或改成 domain-neutral

### Verification

- `rg -n \"@/lib/modules/shop|lib/types/shop\" app components lib tests -S` → 0 hits
- `npm test`

---

## PR-4 — Remove product domain from embedding/preprocessing/AI analysis【P1】

> 因為 `product` 屬於 shop domain；移除 shop 後，embedding/preprocessing/AI analysis 不應再處理 product。

### Update（types）

- `lib/types/embedding.ts`
  - 刪除 `EmbeddingTargetType` 內的 `'product'`
  - 刪除 `SimilarItemTargetType` 內的 `'product'`
  - 刪除 `EmbeddingStats.products`、`ProductEmbeddingData` 等 product 專用 types

### Update（embedding modules）

- `lib/modules/embedding/embedding-target-content-io.ts`：移除 `getProductContent()` 與 `case 'product'`
- `lib/modules/embedding/embedding-batch-io.ts`：移除 products 初始化與 stats
- `lib/modules/embedding/embedding-search-io.ts`：預設 targetTypes 移除 `'product'`
- `lib/modules/embedding/similar-items-worker-io.ts`：移除 products 流程與回傳欄位
- `lib/modules/embedding/similar-items-public-io.ts`：刪除 `getResolvedSimilarProducts()` / `ResolvedSimilarProduct`
- `app/api/cron/similar-items/route.ts`：回傳 payload 移除 `products`

### Update（preprocessing）

- `lib/modules/preprocessing/*`：移除 product configs（chunking/quality）
- `lib/validators/preprocessing-config.ts`：移除預設 product config
- `app/[locale]/admin/(data)/preprocessing/*`：UI 移除 product 選項

### Update（Edge Functions / workers）

- `supabase/functions/generate-embedding/index.ts`：targetType allowlist 移除 product
- `supabase/functions/judge-preprocessing/index.ts`：targetType allowlist 移除 product
- `app/api/worker/embedding-queue/route.ts`：VALID_TARGET_TYPES 移除 product

### Update（AI analysis, shop-related data sources）

- `lib/modules/ai-analysis/analysis-data-mappers.ts`：刪除 `mapProductToAnalysisShape` / `mapOrderToAnalysisShape` / `mapMemberToAnalysisShape`
- `lib/modules/ai-analysis/analysis-products-io.ts` / `analysis-orders-io.ts` / `analysis-members-io.ts`：刪除（若僅服務 shop）
- `lib/modules/ai-analysis/analysis-rag-io.ts`：targetTypes 移除 `'product'`
- `tests/ai-analysis/analysis-data-mappers.test.ts`：移除 products/orders/members 測試，保留 comments mapper 測試

### Verification

- `rg -n \"'product'\" lib app supabase tests -S --glob '!doc/**'` → only allowed hits（如 literal strings in UI copy should be removed too）
- `npm test`
- `npm run type-check`

---

## PR-5 — Remove shop/payment Supabase SQL + DB scripts【P1】

### Delete（SQL）

- `supabase/01_drop/07_shop.sql`
- `supabase/02_add/07_shop.sql`
- `supabase/02_add/08_shop_functions.sql`
- `supabase/03_seed/03_shop.sql`

### Update（SQL + scripts）

- `supabase/COMBINED_ADD.sql` / `supabase/COMBINED_DROP.sql` / `supabase/COMBINED_SEED.sql` / `supabase/COMBINED_GRANTS.sql`：移除 shop/payments 相關段落
- `supabase/02_add/06_feature_settings.sql` + `supabase/03_seed/04_features_landing.sql`：移除 shop feature row/註解
- `scripts/db.mjs`：移除 `shop` feature entry + usage notes
- `supabase/README.sql`：移除 shop 的目錄/依賴/執行說明

### Verification

- `node scripts/db.mjs list` 不再列出 `shop`
- `node scripts/db.mjs add --feature shop` 應回報 unknown feature（預期）

---

## PR-6 — Docs/Test cleanup（remove shop/payments references）【P1】

### Update docs (SSoT + navigation)

- `README.md`：移除 Shop feature 介紹
- `ARCHITECTURE.md`：移除 Shop/Payment constraints、移除 canonical 結構中的 shop/stripe
- `doc/RUNBOOK.md`：移除 Payments entry（或改為 archived link）
- `doc/ROADMAP.md` / `doc/STATUS.md` / `doc/specs/README.md`：移除 payments 相關項目
- `doc/SPEC.md` / `doc/SECURITY.md`：移除 shop/payments 相關描述

### Delete docs (shop/payments only)

- `doc/runbook/payments.md`
- `doc/specs/proposed/payments-initiation-spec.md`

### Update tests

- `tests/architecture-boundaries.test.ts`：移除 shop allowlist 與 “shop boundaries” 段落
- `tests/validators/page-views.test.ts`：移除 `/shop/*` 測試樣本
- `tests/theme-resolve.test.ts`：移除 shop scope 的期待值（若 ThemeScopeKey 同步移除 shop）

### Verification

- `npm run docs:generate-indexes`
- `npm run lint:md-links`
- `npm run docs:check-indexes`
- `rg -n \"\\bshop\\b|payment|stripe|linepay|ecpay\" doc -S --glob '!doc/archive/**'` → only intentional historical mentions (should be near 0)

---

## Deferred (2026-01-11): Architecture & Docs Alignment Gate (`lib/` + Supabase)

## Inputs（SSoT）

- Architecture / constraints: `../../ARCHITECTURE.md`
- Implemented behavior (SSoT): `../SPEC.md`
- Security / RLS / secrets: `../SECURITY.md`
- Ops / verification: `../RUNBOOK.md`（details: `../runbook/*`）
- Docs SRP + update matrix: `../GOVERNANCE.md`
- Drift tracker + playbooks（stable `@see`）: `../../uiux_refactor.md`

## Historical / Archived References（不要再當成 active plan）

- Prior admin i18n + lib Phase 2 execution record: `../archive/2026-01-04-step-plan-admin-i18n-lib-refactor.md`
- `lib/modules/*` migration execution record: `../archive/2026-01-04-lib-modules-migration-step-plan.md`
- Old uiux_refactor full snapshot: `../archive/2025-12-31-uiux-refactor-archive.md`

---

## 0) TL;DR（執行順序）

1. **PR-1【P1】Docs + comments path normalization**：`ARCHITECTURE.md` / `doc/SPEC.md` / `doc/SECURITY.md` / `uiux_refactor.md` + 少量 in-code comments，全面改成 canonical paths
2. **PR-2【P1】Guardrails alignment**：更新 `tests/architecture-boundaries.test.ts` 的 allowlist/說明/錯誤訊息，使其反映現況與規範
3. **PR-3【P2】(Optional) lib root cleanup**：若要把剩餘 cross-cutting domains 也納入 `modules/` / `utils/`，先做 dependency map 再拆 PR（避免破壞「modules 禁止跨依賴」）

---

## Target `lib/` Structure（canonical）

> Canonical 入口點：外部服務集中於 `infrastructure/`；業務模組集中於 `modules/`；validators/utils/types 為跨模組可重用層。

```
lib/
├── infrastructure/        ← 外部服務（集中）
│   ├── supabase/
│   ├── openrouter/
│   ├── cloudinary/
│   ├── stripe/
│   ├── akismet/
│   └── sentry/
│
├── modules/               ← 業務模組
│   ├── shop/
│   │   ├── io.ts         ← 只用 infrastructure
│   │   ├── pure.ts       ← 純函式（可拆成 *-pure.ts）
│   │   └── types.ts      ← module-local types（共用仍放 lib/types）
│   ├── blog/
│   └── gallery/
│
├── validators/            ← 純函式（跨模組共用）
├── utils/                 ← 純函式（跨模組共用）
└── types/                 ← 共用型別（跨模組共用）
```

---

## 1) Constraints（Non‑Negotiables）

- **Server-first / bundle boundary**：不得為了搬路徑或修 drift 把 page/layout 濫改成 client component（see `../../ARCHITECTURE.md`）。
- **Supabase client boundary**：
  - Browser client：只在 client components 使用 `lib/infrastructure/supabase/client.ts`
  - Server (cookie) client：只在 server components/actions/routes 使用 `lib/infrastructure/supabase/server.ts`
  - Anon client（public cached reads）：只在 server-only IO/cached modules 使用 `lib/infrastructure/supabase/anon.ts`
  - Service role：admin/system writes 只允許在 `*-io.ts` 且 `import 'server-only';`（測試守門：`tests/architecture-boundaries.test.ts`）
- **SEO / URL single source**：`NEXT_PUBLIC_SITE_URL` 只能由 `lib/site/site-url.ts` 讀取（see `../../ARCHITECTURE.md` §3.11）。
- **Docs SRP**：現況（what exists now）在 `doc/SPEC.md`；drift playbook 在 `uiux_refactor.md`；本檔是可執行的拆 PR 計畫。

---

## 2) Drift Findings（2026-01-11）

> 目標：把「文件 / 測試守門員 / 註解」全部對齊到已落地的 canonical paths，避免下一輪開發時用錯入口或誤判規則。

1. **Docs drift**：`ARCHITECTURE.md` / `doc/SPEC.md` / `doc/SECURITY.md` / `uiux_refactor.md` 仍殘留 legacy 路徑敘述（例如 `lib/supabase/*`, `lib/shop/*`, `lib/ai-analysis/*`），但實際程式已收斂到 `lib/infrastructure/*` + `lib/modules/*`。
2. **Guardrail drift**：`tests/architecture-boundaries.test.ts` 仍存在舊路徑 allowlist / 錯誤訊息（例如 `lib/supabase/`, `lib/ai-analysis/`, `lib/import-export/`），降低守門員可維護性與可讀性。
3. **Comment drift**：少數檔案的 header comment / `@see` 仍指向已不存在路徑（例：`app/api/upload-signature/route.ts`, `lib/modules/landing/*`）。

---

## PR-1 — Docs + comments path normalization【P1】

### Goal

- 文件與註解只使用 canonical paths；讀者不需要猜「哪個才是入口」。

### Scope

- **只改路徑與描述**（docs + comments）；不改 runtime 行為、不改 DB/RLS、不改 UI 文案。

### Steps（按順序；每步驟都要可驗證）

1. 先抓證據（保留 rg output 作為 PR 描述的一部分）：
   - `rg -n "lib/supabase|@/lib/supabase" ARCHITECTURE.md doc/SPEC.md doc/SECURITY.md uiux_refactor.md app lib tests -S --glob '!doc/archive/**'`
   - `rg -n "lib/(shop|gallery|comment|landing|reports|auth|user|import-export|ai-analysis|embedding|preprocessing)/" ARCHITECTURE.md doc/SPEC.md doc/SECURITY.md uiux_refactor.md -S --glob '!doc/archive/**'`
2. 更新 docs（逐檔修；不要用全域 replace 亂改到 archive）：
   - `../../ARCHITECTURE.md`：
     - `lib/<domain>/...` → `lib/modules/<domain>/...`（針對已搬到 modules 的 domain）
     - `lib/supabase/*` / `@/lib/supabase/*` → `lib/infrastructure/supabase/*` / `@/lib/infrastructure/supabase/*`
     - OpenRouter allowlist：由 `lib/ai-analysis/**` 改為 `lib/infrastructure/openrouter/**`（server-only）
     - 更新 Phase 註記：Phase 2 已完成（shim 不存在）
   - `../SPEC.md`：
     - Module Inventory / Data Intelligence module tables：統一成 `lib/modules/*`（與現況一致）
   - `../SECURITY.md`：
     - Supabase client selection table 與 AI SDK allowlist 路徑對齊現況
   - `../../uiux_refactor.md`：
     - 只保留未完成 drift（若無 open drift，保留空集合狀態即可）
     - grep checklist / playbooks 的 canonical paths 對齊現況
3. 更新 in-code comments / `@see`（只改註解，不改行為）：
   - `app/api/upload-signature/route.ts`
   - `lib/modules/landing/io.ts`
   - `lib/modules/landing/admin-io.ts`
4. 文件一致性驗證（必做）：
   - 重新跑 Step 1 的兩個 `rg` 指令，確認:
     - `lib/supabase` / `@/lib/supabase` 在非 archive 區域為 **0 hits**
     - 已搬到 `lib/modules/*` 的 domains，不再出現 `lib/<domain>/...` 的敘述

### Rollback

- revert 本 PR（docs/comments only）

---

## PR-2 — Guardrails alignment【P1】

### Goal

- `tests/architecture-boundaries.test.ts` 的規則/allowlist/訊息全部對齊 canonical paths，避免下一輪開發時「測試說 A、程式做 B」。

### Steps

1. 更新 `tests/architecture-boundaries.test.ts`：
   - `lib/supabase/` → `lib/infrastructure/supabase/`（skip/allowlist/註解/訊息）
   - OpenRouter allowlist（若仍存在）：`lib/ai-analysis/` → `lib/infrastructure/openrouter/`
   - Import/Export path wording：`lib/import-export/` → `lib/modules/import-export/`
   - Auth path wording：`lib/auth/` → `lib/modules/auth/`
2. 跑測試與靜態檢查（必做）：
   - `npm test`
   - `npm run type-check`
   - `npm run lint`

### Rollback

- revert 本 PR（tests only）

---

## PR-3 — (Optional) lib root cleanup【P2】

> 只有在「確定要把剩餘 cross-cutting domains 也收進 modules/utils」才做；否則跳過（避免破壞既有依賴規則）。

### Pre-check（不可省略）

1. 先建立 dependency map（釐清誰依賴誰）：
   - `rg -n "@/lib/(seo|site|cache|features|spam|security|rerank|analytics|queue|reactions)" app components lib -S`
2. 釐清依賴規則調整方案（兩選一，先寫進 `../../ARCHITECTURE.md` 再動 code）：
   - A) 保留 `lib/<domain>/` 作為 cross-cutting（允許被多個 modules 使用）
   - B) 移入 `lib/utils/`（僅限純函式）或 `lib/infrastructure/`（外部 API access）並禁止 modules 互相 import

---

## Gate Checklist（每次合併前）

- `npm test` / `npm run type-check` / `npm run lint` 全部通過
- `rg -n "lib/supabase|@/lib/supabase" app components lib tests -S` → **0 hits**
- `rg --files-without-match "import 'server-only';" lib --glob "**/io.ts" --glob "**/*-io.ts"` → **0 hits**

