# Step-by-Step Execution Plan — V2（Home UIUX + Gallery Hero/Hotspots + Hamburger Nav v2）

> 狀態: Active（Drift repair plan；本檔只寫「修復方案/步驟」，不在此直接改程式碼）  
> 最後更新: 2026-01-21 (PR-8 完成)  
> 現況 SSoT（已實作行為）: `doc/SPEC.md`  
> 目標 PRD（約束/合約）: `doc/specs/proposed/GALLERY_HERO_IMAGE_AND_HOTSPOTS.md`（Implementation Contract）

---

## 0) 必讀（SSoT / Guardrails）

- Architecture / 全域約束：`ARCHITECTURE.md`
- 已落地行為（SSoT）：`doc/SPEC.md`
- 目標 PRD（contract）：`doc/specs/proposed/GALLERY_HERO_IMAGE_AND_HOTSPOTS.md`
- Security / RBAC / RLS / secrets：`doc/SECURITY.md`
- Ops / DB / go-live：`doc/RUNBOOK.md`（細節：`doc/runbook/*`）
- 文件分工 / update matrix：`doc/GOVERNANCE.md`
- Drift tracker + playbooks（stable `@see` index）：`uiux_refactor.md`

---

## 1) Repo 現況（以工具輸出為準；2026-01-21）

- `npm test`：1003 pass（含 `tests/architecture-boundaries.test.ts`）
- `npm run type-check`：pass（`tsconfig.typecheck.json`；exclude `uiux/` + `.next/**`）
- `npm run lint`：pass（0 errors；0 warnings）
- `npm run build`：若未設 `NEXT_PUBLIC_SITE_URL`，production collect phase 會 fail-fast（設計如此；見 `lib/site/site-url.ts` 與 `doc/runbook/deployment.md`）

---

## 2) Drift / Clean-code 問題清單（含風險與對應修復 PR）

### Drift-1：v2 canonical URL 策略未「全量落地」（SEO / 一致性 / redirect chain）

- 現況（摘要）：
  - v2 canonical routes 已存在：Blog `/blog/posts/*`、`/blog/categories/*`；Gallery `/gallery/items/*`、`/gallery/categories/*`。
  - 但仍有多處使用 v1/legacy 形態（造成額外 301、或直接形成雙軌內容）：
    - Blog list 仍支援 `?category=`，且卡片/related/similar 仍產出 `/blog/<category>/<slug>`（依賴 301 才到 `/blog/posts/<slug>`）。
    - Gallery list 仍支援 `?category=`；且 `/gallery/<category>` 仍是可公開的實頁（與 `/gallery/categories/<slug>` 形成重複內容）。
    - 多個 Gallery internal links 仍產出 `/gallery/<category>/<slug>`（依賴 301 才到 `/gallery/items/<category>/<slug>`）。
- 風險：
  - SEO：同內容多網址、canonical 漂移、crawl budget 浪費、redirect chain 增加 LCP/TTFB。
  - Contract drift：與 PRD §E「只承認 v2 canonical，全部 301」不一致；Hamburger nav v2 的 typed targets 也無法成為唯一入口。
- 修復：PR-6（v2 canonical 全量 enforce + internal links 清理 + legacy 301）

### Drift-2：`hamburger_nav` publish deep validate 的 Blog table 名稱與 DB SSoT 不一致（高風險）

- 現況：
  - `app/[locale]/admin/content/[section]/actions.ts` publish 已接上 `deepValidateHamburgerNav()`。
  - 但 `lib/modules/content/hamburger-nav-publish-io.ts` 針對 Blog target 查詢 `blog_posts` / `blog_categories`，
    而 DB SSoT（`supabase/02_add/01_main.sql` / `supabase/COMBINED_ADD.sql`）與 Blog module 使用的是 `posts` / `categories`。
- 風險：
  - 只要 nav 內有 Blog targets，publish 會回傳 DB error 或永遠 fail（造成後台「無法發布」或錯誤 gate）。
  - 與 PRD §C「publish deep validate」合約衝突（合約要求可用、且錯誤可定位）。
- 修復：PR-7（修正 table mapping + 補齊深度驗證測試）

### Clean-1：Lint warnings（低風險，但會干擾 signal）

- 現況：`npm run lint` 0 errors 但有 11 warnings（多為 unused imports / unused vars）。
- 風險：容易掩蓋真正 regression；也會造成 PR review noise。
- 修復：PR-8（可選：逐一清掉 warnings；不影響行為）

---

## 3) Execution Plan（以 PR 為單位；每 PR 可獨立驗收/回退）

### PR-6 — v2 canonical 全量 enforce（Blog/Gallery）+ legacy 301（SEO / 一致性）✅ COMPLETED

Goal：符合 PRD §E「只承認 v2 canonical URLs」與 `ARCHITECTURE.md` 的 SEO/一致性原則：

- v2 canonical 成為唯一對外 URL
- v1 / query-based / legacy 形態全部 301
- public internal links 一律產出 canonical（不要依賴 redirect）

#### PR-6A：Blog（category query → path；post links → v2）

Files（必改）：

- `app/[locale]/blog/page.tsx`
- `components/blog/BlogCategorySidebar.tsx`
- `components/blog/RelatedPosts.tsx`
- `components/blog/SimilarPosts.tsx`
- （掃描）`rg "/blog/\\$\\{" components app -S`

Step-by-step：

1. Blog list canonicalization（server）：
   - 在 `app/[locale]/blog/page.tsx` 讀到 `searchParams.category` 時，直接 301 redirect 到 `/${locale}/blog/categories/${categorySlug}`。
   - redirect 時保留 allowlist query：`q`、`sort`（不要帶 `category`，避免雙軌）。
2. Blog list internal links 全量改成 canonical：
   - `app/[locale]/blog/page.tsx` 內卡片 `postUrl` 改成 `/${locale}/blog/posts/${post.slug}`（移除 `/blog/${categorySlug}/${post.slug}`）。
3. Category Sidebar 的 URL builder 改成 typed/canonical：
   - `components/blog/BlogCategorySidebar.tsx`：
     - 全部文章：`/${locale}/blog`（保留 `q` / `sort`）
     - 單一分類：`/${locale}/blog/categories/${slug}`（保留 `q` / `sort`）
     - 不再產出 `?category=...`
4. Related/Similar posts links 改成 canonical：
   - `components/blog/RelatedPosts.tsx` / `components/blog/SimilarPosts.tsx`：
     - 連結改成 `/${locale}/blog/posts/${post.slug}`（不要依賴 category segment / 301）。
5. Redirect matrix（legacy query）：
   - 新增 canonicalization：
     - `/zh/blog?category=<slug>` → `/zh/blog/categories/<slug>`（保留 allowlist query：`q` / `sort`）
   - 建議集中在 `middleware.ts`（可以完整保留 query；並可共用到 Gallery 的 reserved segments case）。

DoD：

- Blog category filter 不再使用 `?category=`（直接 301 到 `/blog/categories/*`）
- Blog list/related/similar 的所有 internal links 為 `/blog/posts/*`
- 不存在「同一篇文章兩個 public URL」的情況（除 redirect）

#### PR-6B：Gallery（category query → path；/gallery/<category> → 301；item links → v2）

Files（必改）：

- `app/[locale]/gallery/page.tsx`
- `app/[locale]/gallery/[category]/page.tsx`（改成 redirect-only 或移除）
- `components/gallery/GalleryCard.tsx`
- `components/gallery/SimilarGalleryItems.tsx`
- `components/sections/GallerySection.tsx`
- （掃描）`rg "/gallery/\\$\\{" components app -S`

Step-by-step：

1. Gallery list canonicalization（server）：
   - 在 `app/[locale]/gallery/page.tsx` 讀到 `searchParams.category` 時，直接 301 redirect 到 `/${locale}/gallery/categories/${categorySlug}`。
   - redirect 時保留 allowlist query：`q`、`tag`、`sort`（不要帶 `category`，避免雙軌）。
2. Gallery category v1 route 關閉雙軌：
   - `app/[locale]/gallery/[category]/page.tsx` 改成 **redirect-only**：
     - `/${locale}/gallery/${categorySlug}` → `/${locale}/gallery/categories/${categorySlug}`（保留 allowlist query）
   - 或直接刪除整個 v1 route（前提：redirect matrix 完整；`npm run build` + runtime 驗證）。
3. Gallery internal links 全量改成 canonical：
   - `components/gallery/GalleryCard.tsx`：href 改成 `/${locale}/gallery/items/${categorySlug}/${item.slug}`
   - `components/gallery/SimilarGalleryItems.tsx`：同上
   - `components/sections/GallerySection.tsx`：同上
4. Redirect matrix（legacy query + legacy category path）：
   - `/zh/gallery?category=<slug>` → `/zh/gallery/categories/<slug>`（保留 allowlist query）
   - `/zh/gallery/<slug>` → `/zh/gallery/categories/<slug>`（排除保留字 `items`/`categories`）
   - 建議集中在 `middleware.ts` 以避免 `next.config.ts` source pattern 跟 `/gallery/items/*`、`/gallery/categories/*` 衝突。

DoD：

- Gallery category 不再有雙軌內容（`/gallery/<slug>` 只能 301；canonical 為 `/gallery/categories/<slug>`）
- Gallery item internal links 為 `/gallery/items/<category>/<slug>`
- 舊 URL 形態（含 query-based category）都會 301 到 canonical

#### PR-6C：SEO regression tests（防再漂移）

Step-by-step：

1. 新增 tests 覆蓋 canonicalization 規則（至少要能 fail fast）：
   - Blog:
     - `/blog?category=x` → `/blog/categories/x`（保留 allowlist query）
     - internal link generators（Blog list/related/similar）不再產出 `/blog/<category>/<slug>`
   - Gallery:
     - `/gallery?category=x` → `/gallery/categories/x`（保留 allowlist query）
     - `/gallery/x` → `/gallery/categories/x`（排除 reserved segments）
     - internal link generators（GalleryCard/SimilarGalleryItems/GallerySection）不再產出 `/gallery/<category>/<slug>`
2. 驗證 sitemap 仍只輸出 v2 canonical（`app/sitemap.ts` 既有行為）。

DoD：

- 新增的測試可阻止「又引入非 canonical internal links」或「重複內容 URL」

---

### PR-7 — 修正 `hamburger_nav` deep validate（Blog tables）+ 測試補齊 ✅ COMPLETED

Goal：讓 PRD §C 的 deep validate 在真實 DB schema 下可用，並維持單一真相來源（Blog module 的表名/欄位）。

Files（必改）：

- `lib/modules/content/hamburger-nav-publish-io.ts`
- Tests（新增或補強）：`tests/*`

Step-by-step：

1. Table mapping 修正：
   - `validateBlogPost()`：
     - `.from('blog_posts')` → `.from('posts')`
     - `select` 欄位需包含 `visibility`，並以 `visibility === 'public'` 判定可公開
   - `validateBlogCategory()`：
     - `.from('blog_categories')` → `.from('categories')`
     - 以 `slug` 查詢存在性
2. Error semantics 維持不變：
   - 仍回傳 `{ path, message, targetType, targetSlug }`，確保 admin UI 能精準定位 JSON path。
3. 測試補齊（避免只靠 unit tests 的假綠燈）：
   - 以 stubbed supabase client（或 minimal adapter）驗證 `.from()` 被呼叫的 table name 正確。
   - 至少覆蓋 `blog_post` / `blog_category` 兩種 targets。
4. 驗證（本機）：
   - `npm test`
   - `npm run lint`
   - `npm run type-check`

DoD：

- `hamburger_nav` 含 Blog targets 時不會因 table name 錯誤而 publish 失敗
- deep validate 的錯誤訊息仍可定位到 `groups[i].items[j].target`

---

### PR-8 — 清掉 lint warnings（可選）✅ COMPLETED

Goal：讓 lint output 更乾淨，提升 signal/noise。

Step-by-step：

1. 逐檔處理 unused imports/vars（示例）：
   - `app/[locale]/admin/content/[section]/actions.ts`：移除未使用 types 或以 `_` 前綴符合 rule
   - `app/[locale]/blog/posts/[slug]/page.tsx`：移除未使用 `redirect` / `categorySlug`
   - `components/home/MarqueeNotice.tsx`：移除未使用 state
   - `lib/validators/hamburger-nav.ts`：移除未使用 imports
   - `tests/validators/custom-template.test.ts`：移除未使用 constants
2. `npm run lint` 確認 warnings 減少或歸零

DoD：

- `npm run lint` 0 errors，warnings 顯著下降（理想為 0）

---

## 4) 每 PR 驗證清單（不可省略）

- `npm test`
- `npm run lint`
- `npm run type-check`
- `NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build`（routes/SEO/redirect 相關 PR 必跑）

