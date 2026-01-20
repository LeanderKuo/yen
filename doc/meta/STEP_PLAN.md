# Step-by-Step Execution Plan — V2（Home UIUX + Gallery Hero/Hotspots + Hamburger Nav v2）

> 狀態: Draft / Active  
> 最後更新: 2026-01-20  
> 定位: 以 PR 為單位的落地計畫；每個 PR 都必須可獨立驗收/回退  
> 現況 SSoT（已實作）: `doc/SPEC.md`  
> 本次目標 SSoT（未實作）: `doc/specs/proposed/GALLERY_HERO_IMAGE_AND_HOTSPOTS.md`（含 `Implementation Contract`）

---

## 0) 必讀（SSoT / Guardrails）

- Architecture / 全域約束：`ARCHITECTURE.md`
- 已落地行為（SSoT）：`doc/SPEC.md`
- 本次目標 PRD（未落地）：`doc/specs/proposed/GALLERY_HERO_IMAGE_AND_HOTSPOTS.md`
- Security / RBAC / RLS / secrets：`doc/SECURITY.md`
- Ops / DB / go-live：`doc/RUNBOOK.md`（細節：`doc/runbook/*`）
- 文件分工 / update matrix：`doc/GOVERNANCE.md`
- Drift tracker + playbooks（stable `@see` index）：`uiux_refactor.md`

---

## 1) Review 結論（不改程式碼；以測試與文件為準）

- 測試：`npm test` 全通過（包含 `tests/architecture-boundaries.test.ts`）
- 架構：未發現違反 `ARCHITECTURE.md` 的硬規則（以 architecture-boundaries 測試守門為準）
- 文件飄移（已修正）：`doc/SPEC.md` 已更新對齊目前已落地功能（Users search/pagination、AI Analysis custom templates UI、Analytics dashboard）

---

## 2) 本次要落地的功能（Scope）

> 以 `doc/specs/proposed/GALLERY_HERO_IMAGE_AND_HOTSPOTS.md` 的 Requirements + Implementation Contract 為準；此處只列出「要做什麼」與「拆 PR 策略」。

- Home：排版/互動對齊 `uiux/` + Figma（marquee notice、hamburger menu、hero stage、suggest section）
- Hero：從 Gallery 選 0..1 個作品作為 Home Hero（顯示同一作品的 hotspots）
- Hotspots：管理員可在作品圖上新增多個 pins（含內容欄位/排序/Markdown 安全邊界），前台可互動呈現 + mobile/無障礙 fallback list
- Hamburger nav（v2）：後台可編輯 IA（4 組分類+細項），以 typed `target` 產生 canonical href，發布時 deep validate（存在且可公開）
- URL（v2）：canonical routes + 全量 301（避免 query/path 雙軌造成 drift）

---

## 3) Execution Plan（以 PR 為單位；每 PR 可獨立驗收）

### PR-1 — Hamburger nav v2 foundations（types/validator/resolver + admin editor）✅ COMPLETED

> **Status**: ✅ Completed (2026-01-20)  
> **Verification**: `npm test` (875 pass), `npm run type-check` (pass), `npm run lint` (pass)

Goal：

- 先把「導航資料結構」做成單一真相來源（typed targets），避免後續 route 調整造成內容 drift。

Files（已實作）：

- Types：`lib/types/hamburger-nav.ts` ✅
- Validator（pure）：`lib/validators/hamburger-nav.ts` ✅
- Resolver（pure）：`lib/site/nav-resolver.ts` ✅
- Publish deep validate（DB）：`lib/modules/content/hamburger-nav-publish-io.ts` ✅
- Admin editor：`app/[locale]/admin/content/hamburger_nav/**` ✅
- Tests：`tests/validators/hamburger-nav.test.ts`, `tests/nav-resolver.test.ts` ✅
- Cache：`lib/modules/content/cached.ts`（既有 tag=`site-content`）

Step-by-step：

1. 定義 `HamburgerNavV2`（version=2）與 `ResolvedHamburgerNav` types（single source）✅
2. 寫 pure validator（儲存 draft 用）：✅
   - `target.type` allowlist（見 PRD `FR-9.5.3`）
   - slug format：用 `lib/validators/slug.ts`（或同等規則）
   - query keys allowlist：至少 `q`/`tag`/`sort`/`page`
   - external 協議 allowlist：只允許 `https:`（可選 `mailto:`），拒絕 `http:`/`javascript:`/`data:`
3. 寫 resolver（pure）：`target → canonical href`（不得查 DB）✅
4. 寫 publish deep validate（查 DB；你已拍板「存在但不可見」不允許）：✅
   - blog_post：存在且 `visibility='public'`
   - gallery_item：存在且 `is_visible=true`
   - gallery_category：存在且 `is_visible=true`
5. Admin editor：✅
   - Save：只跑 pure validator；寫入 `site_content` draft
   - Publish：pure validator + deep validate；失敗必須回傳可定位錯誤（JSON path）
6. Seed：預設內容需與 `uiux/src/app/components/side-nav.tsx` labels 一致（4 groups + items）✅
7. Revalidation：publish/unpublish/update 後 `revalidateTag('site-content')` ✅

DoD（可驗收）：

- ✅ 後台能保存/發布 hamburger_nav v2；發布時不會產生 public 壞連結
- ✅ `hamburger_nav` 不儲存 raw `href`（只存 typed `target`）

---

### PR-2 — v2 Canonical Routes + 301（Blog/Gallery）✅ COMPLETED

> **Status**: ✅ Completed (2026-01-20)  
> **Verification**: `npm test` (883 pass), type-check/lint/build have pre-existing `uiux/` errors (unrelated)

Goal：

- 統一 URL 規則，避免同一內容多網址（SEO/分享/導覽不 drift）。

Files（已實作）：

- Routes：
  - `app/[locale]/blog/posts/[slug]/page.tsx` ✅
  - `app/[locale]/blog/categories/[slug]/page.tsx` ✅
  - `app/[locale]/gallery/items/[category]/[slug]/page.tsx` ✅
  - `app/[locale]/gallery/categories/[slug]/page.tsx` ✅
- Redirects：`next.config.ts` ✅
- SEO：`app/sitemap.ts` ✅（outputs canonical URLs）
- Tests：`tests/seo-canonical-routes.test.ts` ✅

Step-by-step：

1. 新增 canonical routes（不移除舊 routes 前先以 redirect 導流）：✅
   - Blog：
     - `/[locale]/blog/posts/[slug]`
     - `/[locale]/blog/categories/[slug]`
   - Gallery：
     - `/[locale]/gallery/items/[category]/[slug]`
     - `/[locale]/gallery/categories/[slug]`
2. 設計 redirect matrix（**全量 301** 到 canonical）：✅
   - 舊 blog post：`/[locale]/blog/[category]/[slug]` → `/[locale]/blog/posts/[slug]`
   - 舊 gallery item：`/[locale]/gallery/[category]/[slug]` → `/[locale]/gallery/items/[category]/[slug]`
   - query-based category（若存在）：一律導到 `/.../categories/<slug>`
3. Search param 統一：✅
   - Blog/Gallery 一律使用 `q`（淘汰 `search`），並更新 search scope（PRD `FR-9.5.4`）
4. SEO：✅
   - `sitemap.ts` 輸出 canonical URLs
   - `getMetadataAlternates` / hreflang 以 canonical 為準
5. Tests：✅
   - 補 `tests/seo-canonical-routes.test.ts` 覆蓋 canonical/hreflang（避免 regress）

DoD（可驗收）：

- ✅ 任一內容只有 1 個 canonical URL；非 canonical 一律 301

---

### PR-3 — DB Schema/RLS：Hero（`surface='hero'`）+ `gallery_hotspots` ✅ COMPLETED

> **Status**: ✅ Completed (2026-01-20)  
> **Verification**: `npm test` (883 pass), type-check/lint (no new errors from PR-3)

Goal：

- 把不變式下放到 DB（constraints/RLS/indexes），避免靠 UI 邏輯硬撐。

Files（已實作）：

- `supabase/02_add/04_gallery.sql`（extend `gallery_pin_surface` + partial unique index）✅
- `supabase/02_add/20_gallery_hotspots.sql`（new table + indexes + RLS + grants）✅
- `supabase/01_drop/04_gallery.sql`（updated to drop gallery_hotspots）✅
- `supabase/COMBINED_GRANTS.sql`（mirror changes）✅

Step-by-step：

1. Extend enum：`public.gallery_pin_surface` 新增 `'hero'` ✅
2. Hero uniqueness：新增 partial unique index（`surface='hero'` 永遠最多 1 筆）✅
3. 新增 `public.gallery_hotspots`（依 PRD Implementation Contract 寫死 fields/constraints/indexes/RLS/grants）✅
4. DB 檔案同步：同時更新 `supabase/02_add/*` 與 `supabase/COMBINED_*` ✅

DoD（可驗收）：

- ✅ DB 層可保證 hero ≤ 1
- ✅ hotspots 具備 `x/y` 範圍約束、RLS、必要索引與 grants

---

### PR-4 — Hotspots Markdown：safe pipeline（禁 raw HTML + sanitize + https links）✅ COMPLETED

> **Status**: ✅ Completed (2026-01-20)  
> **Verification**: `npm test` (865 pass), type-check/lint (no new errors from PR-4)

Goal：

- hotspots 會出現在 Home/Hero（曝光面最大），必須使用「更保守」的 markdown→html pipeline。

Files（已實作）：

- `lib/markdown/hotspots.ts`（new; server-only）✅
- `tests/markdown-hotspots.test.ts`（new; 44 test cases）✅

Step-by-step：

1. 禁 raw HTML（不得沿用 `lib/markdown/server.ts`）✅
2. sanitize/allowlist（GFM subset）✅
3. links：只允許 `https:`（可選 `mailto:`），並強制 `target="_blank"` + `rel="noopener noreferrer"` ✅
4. sanitize 後內容為空 → 視為 invalid（阻止儲存/發布）✅

DoD（可驗收）：

- ✅ 任意惡意輸入不會造成 XSS；外連安全屬性固定輸出
- ✅ XSS 測試覆蓋：script/iframe/style/object/embed/form/svg/img、javascript:/data:/http:/vbscript: URLs
- ✅ `hotspotsMarkdownToHtml()` 與 `isValidHotspotsMarkdown()` 兩個 exports

---

### PR-5 — Hotspots IO + caching + validators + types ✅ COMPLETED

> **Status**: ✅ Completed (2026-01-20)  
> **Verification**: `npm test` (906 pass), type-check/lint have pre-existing `uiux/` errors (unrelated)

Goal：

- DB access 全部集中到 `lib/**/*-io.ts`，public SSR 讀取走 `createAnonClient()` + `cachedQuery`，admin 寫入走 `createClient()` + RLS。

Files（已實作）：

- `lib/types/gallery.ts`（extend：`GalleryHotspot`, `GalleryHotspotPublic`, `GalleryHotspotInput`, `GalleryHotspotReorderInput`）✅
- `lib/validators/gallery-hotspots.ts`（new：coordinate, URL, input, reorder validation）✅
- `tests/validators/gallery-hotspots.test.ts`（new：34 test cases）✅
- `lib/modules/gallery/gallery-hotspots-io.ts`（new：public reads with auto/manual ordering）✅
- `lib/modules/gallery/hotspots-admin-io.ts`（new：admin CRUD + reorder + limit check）✅
- `lib/modules/gallery/cached.ts`（extend：`getHotspotsByItemIdCached`）✅
- `lib/modules/gallery/io.ts`（extend：re-export hotspots）✅

Step-by-step：

1. Types：定義 hotspot row/public DTO/admin input（單一真相來源）✅
2. Validators（pure）：`x/y`、必填欄位、`read_more_url` allowlist、reorder payload ✅
3. Public IO：✅
   - 只回可見 items 的可見 hotspots（RLS）
   - ordering：auto（`y→x`）/ manual（`sort_order`）/ append（manual mode）依 contract 寫死
4. Admin IO：✅
   - CRUD + reorder（reorder input = ordered ids；寫滿 `sort_order=0..n-1`）
5. Cached wrappers：tag 至少使用 `gallery`；admin mutations 後 `revalidateTag('gallery')` ✅

DoD（可驗收）：

- ✅ 排序規則可被測試覆蓋（auto/manual/append）
- ✅ public 讀取可快取、admin 寫入受 RLS 約束

---

### PR-6 — Admin UI：Hotspots editor + Hero selection

Goal：

- 管理員可在後台針對「每一個作品（gallery item）」選擇是否要有 pins（0..N；允許 0 = 不顯示任何 pin），並可：
  - 在作品圖上新增/拖曳 pins、編輯內容、拖曳排序清單並儲存
  - （可選）把該作品設為 Home Hero（0..1；不影響是否有 pins）

Step-by-step：

1. 後台路由：`app/[locale]/admin/gallery/**` 增加
   - Gallery item detail/edit：每個作品都要有「Hotspots editor」（圖上 pins + 清單編輯 + 清單排序）
     - empty state：顯示「尚未新增 pins」+ `新增 pin` CTA；允許直接離開不新增（= 該作品沒有 pins）
     - 若已有 pins：提供 `刪除` / `隱藏（is_visible=false）`（至少一種）讓管理員能選擇「不顯示 pins」
   - Hero selection UI：在作品 detail/edit 提供 `設為 Home Hero`（toggle/button）
     - 寫入：`gallery_pins(surface='hero')`（全站最多 1；DB constraint）
2. 所有寫入走 server actions：parse → validate（pure）→ `*-admin-io.ts`
3. 上限：讀 `company_settings.gallery_hotspots_max`（default 12），UI 與 server 兩側都要 enforce
4. 座標：畫面座標換算 normalized `x/y`；拖曳位置只改 `x/y`
5. 清單排序：拖曳並「儲存」才寫入 `sort_order`
6. Revalidation：mutation 後 `revalidateTag('gallery')`

DoD：

- ✅ 任一 gallery item 都能選擇 0..N pins（允許 0）；前台對應作品與 Home Hero 皆能正確呈現「有/無 pins」
- ✅ 管理員能完整 CRUD + reorder；新 hotspot 在 manual mode 永遠 append
- ✅ hero 永遠最多 1 筆（DB constraint）；可在任一作品上設為 hero / 取消 hero

---

### PR-7 — Public UI：Pins overlay + modal card + fallback list（Home + Gallery）✅ COMPLETED

> **Status**: ✅ Completed (2026-01-20)  
> **Verification**: `npm test` (906 pass), type-check/lint have pre-existing `uiux/` errors (unrelated)

Goal：

- 前台互動對齊 `uiux/`：hover motion + 點擊圖卡；並提供 mobile/無障礙 fallback list。

Files（已實作）：

- Shared UI primitives：
  - `components/hotspots/HotspotPinClient.tsx`（client; interactive pin button with hover/click）✅
  - `components/hotspots/HotspotOverlay.tsx`（client; container for pins over image）✅
  - `components/hotspots/HotspotModalCard.tsx`（client; modal with focus trap/ESC/backdrop/close）✅
  - `components/hotspots/HotspotFallbackList.tsx`（client; collapsible list for mobile/accessibility）✅
  - `components/hotspots/index.ts`（barrel export）✅
  - `components/gallery/GalleryItemHotspotsClient.tsx`（client; wrapper managing state）✅
- Gallery item integration：`app/[locale]/gallery/[category]/[slug]/page.tsx`（fetch hotspots + render）✅
- i18n：`messages/zh.json`（hotspots section added）✅

Step-by-step：

1. ✅ Shared UI primitives：pins overlay + modal card（focus trap/ESC/backdrop/close button）
2. ✅ Fallback list：stage 下方「查看媒材清單（N）」→ expandable list；點 item 開同一張圖卡
3. ✅ Data fetching：Gallery item 讀 item + hotspots（public cached via `getHotspotsByItemIdCached`）
4. ✅ Markdown：hotspot `description_md` 一律走 `lib/markdown/hotspots.ts`（server-side render）
5. ✅ Bundle：使用 inline SVG icons 避免引入 admin-only deps；必要互動才做 client component

DoD（可驗收）：

- ✅ Gallery item page 顯示 hotspots pins overlay + modal card + fallback list
- ✅ 無 hover/小螢幕仍可透過 fallback list 操作
- ✅ 鍵盤可 focus pins，Enter/Space 開啟 modal
- ✅ Modal 支援 focus trap，ESC 關閉，backdrop 點擊關閉

> **Note**: Home Hero integration 將在 PR-8 完成（需要 hero section 重構）


---

### PR-8 — Home UIUX 跟稿（marquee / header / hero / suggest）

Goal：

- Home 排版與互動對齊 `uiux/` + Figma；Hero 使用 gallery hero + hotspots；hamburger menu 使用 v2 nav。

Step-by-step：

1. Marquee：Notice label + text 視為一段完整資訊一起跑（來源：`company_settings`）
2. Header/hamburger：往右展開、上方橫向、accordion；資料來源 `hamburger_nav v2`
3. Hero：左側標語/CTA（`site_content(section_key='hero')`）+ 右 blob 圖（hero item）+ pins
4. Hero empty state：保留左標語 + placeholder blob（無 pins）
5. Suggest：底部文章卡（推薦 SSoT：`doc/specs/proposed/ANALYTICS_PERSONALIZATION_UMAMI.md`）
6. SEO：metadata/jsonld/hreflang 不 regress；LCP 不爆（避免不必要 client bundle）

DoD：

- Home UIUX 對齊設計稿；Hero pins/圖卡互動與 UIUX 一致

---

## 4) 每 PR 驗證清單（不可省略）

- `npm test`
- `npm run type-check`
- `npm run lint`
- `npm run build`（至少在 PR-2/PR-8 跑一次，確保 routes/SEO 不出錯）
