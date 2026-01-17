# Import/Export (Admin-only) — Technical Spec

> Status: Stable  
> Last Updated: 2026-01-12  
> Note: this is the canonical technical spec; design rationale lives in `IMPORT_EXPORT.md`.

Links:

- Implemented behavior (SSoT): `../../SPEC.md#importexport-admin-only`
- PRD / design rationale: `IMPORT_EXPORT.md`

---

## 1. 資料類型總覽

| 資料類型                | Export | Import | 格式     | CSV | UI 位置                         |
| ----------------------- | ------ | ------ | -------- | --- | ------------------------------- |
| Blog Posts              | ✓      | ✓      | Markdown | ✗   | `/admin/posts` + 編輯頁         |
| Blog Categories         | ✓      | ✓      | JSON     | ✗   | `/admin/categories`             |
| Gallery Items           | ✓      | ✓      | JSON     | ✗   | `/admin/gallery`                |
| Gallery Categories      | ✓      | ✓      | JSON     | ✗   | `/admin/gallery/categories`     |
| Site Content            | ✓      | ✓      | JSON     | ✗   | `/admin/content`                |
| Landing Sections        | ✓      | ✓      | JSON     | ✗   | `/admin/landing`                |
| Comments                | ✓      | ✗      | JSON     | ✓   | `/admin/comments`               |

**CSV 格式說明**：

- ✓ CSV：扁平結構、常需 Excel 分析（例如留言審核/回饋整理）
- ✗ CSV：巢狀結構或長文本（文章內容、描述、網站設定）
- CSV 僅支援匯出，不支援匯入

> Implementation note（2026-01-12）：目前 bulk 匯入/匯出入口集中於 `/admin/import-export`；Job History 目前僅涵蓋 Comments 的 `export*WithJob`（可重下載/刪除），Blog/Gallery/Content/Landing 仍為直接下載（signed URL）匯出。

---

## 2. 格式規格

> 單一語言（zh）專案：匯入時 `*_en` 欄位可省略；系統會優先採用 `*_zh`（若無則 fallback `*_en`），並將結果鏡像寫入 legacy 欄位（`*_en` / `*_zh` 同值）。

### 2.1 Blog Posts（Markdown）

**用途**：內容編輯、版本控制（Git）、靜態網站遷移

**單檔格式**（YAML frontmatter + 單一內容）：

```markdown
---
slug: my-first-post
category: tech
visibility: public
created_at: 2025-01-01T00:00:00Z
title_en: My First Post
title_zh: 我的第一篇文章
excerpt_en: A short summary...
excerpt_zh: 簡短摘要...
cover_image_url_en: https://res.cloudinary.com/...
cover_image_url_zh: https://res.cloudinary.com/...
cover_image_alt_en: Description of image
cover_image_alt_zh: 圖片描述
---

# 我的第一篇文章

中文內容在這裡...
```

**批量匯出結構**（.zip）：

```
blog_posts_2025-12-27.zip
├── tech/
│   ├── my-first-post.md
│   └── another-post.md
└── lifestyle/
    └── travel-guide.md
```

**匯入邏輯**：

1. 解析 frontmatter 取得 metadata
2. 內容支援 legacy markers（`<!-- lang: zh -->` / `<!-- lang: en -->`）：若同時存在則優先取 zh；若無 markers 則整份視為內容
3. 用 `category` slug 查找對應的 `category_id`
4. 若 category 不存在 → 報錯

---

### 2.2 Blog Categories（JSON）

```json
{
  "exportedAt": "2025-12-27T10:00:00Z",
  "type": "blog_categories",
  "data": [
    {
      "slug": "tech",
      "name_en": "Technology",
      "name_zh": "科技"
    },
    {
      "slug": "lifestyle",
      "name_en": "Lifestyle",
      "name_zh": "生活"
    }
  ]
}
```

---

### 2.3 Gallery Items（JSON）

```json
{
  "exportedAt": "2025-12-27T10:00:00Z",
  "type": "gallery_items",
  "data": [
    {
      "slug": "sunset-photo",
      "category": "nature",
      "title_en": "Sunset",
      "title_zh": "夕陽",
      "description_en": "A beautiful sunset",
      "description_zh": "美麗的夕陽",
      "image_url": "https://res.cloudinary.com/...",
      "image_alt_en": "Sunset over the ocean",
      "image_alt_zh": "海上夕陽",
      "material_en": "Oil on canvas",
      "material_zh": "油畫",
      "tags_en": ["nature", "sunset"],
      "tags_zh": ["自然", "夕陽"],
      "is_visible": true
    }
  ]
}
```

---

### 2.4 Gallery Categories（JSON）

```json
{
  "exportedAt": "2025-12-27T10:00:00Z",
  "type": "gallery_categories",
  "data": [
    {
      "slug": "nature",
      "name_en": "Nature",
      "name_zh": "自然",
      "sort_order": 1,
      "is_visible": true
    }
  ]
}
```

---

### 2.5 Site Content（JSON）

```json
{
  "exportedAt": "2025-12-27T10:00:00Z",
  "type": "site_content",
  "data": [
    {
      "section_key": "hero",
      "is_published": true,
      "content_en": {
        "title": "Welcome",
        "subtitle": "Your journey starts here"
      },
      "content_zh": {
        "title": "歡迎",
        "subtitle": "您的旅程從這裡開始"
      }
    }
  ]
}
```

---

### 2.6 Landing Sections（JSON）

```json
{
  "exportedAt": "2025-12-27T10:00:00Z",
  "type": "landing_sections",
  "data": [
    {
      "section_key": "hero",
      "section_type": "text_image",
      "sort_order": 1,
      "is_visible": true,
      "title_en": "Welcome",
      "title_zh": "歡迎",
      "subtitle_en": "Your journey starts here",
      "subtitle_zh": "您的旅程從這裡開始",
      "content_en": {
        "body": "Markdown content...",
        "image_url": "https://...",
        "image_position": "right"
      },
      "content_zh": {
        "body": "Markdown 內容...",
        "image_url": "https://...",
        "image_position": "right"
      }
    }
  ]
}
```

---

### 2.7 Comments（JSON，唯讀匯出）

**target_type 支援**：`post` | `gallery_item`

```json
{
  "exportedAt": "2025-12-27T10:00:00Z",
  "type": "comments",
  "includeSensitive": false,
  "data": [
    {
      "target_type": "post", // or "gallery_item"
      "target_slug": "my-first-post",
      "user_display_name": "John",
      "content": "Great post!",
      "is_approved": true,
      "like_count": 5,
      "created_at": "2025-12-27T10:00:00Z",
      "replies": [
        {
          "user_display_name": "Jane",
          "content": "Thanks!",
          "created_at": "2025-12-27T11:00:00Z"
        }
      ]
    }
  ]
}
```

**敏感欄位**（`includeSensitive: true` 時才包含）：

- `user_email`
- `ip_hash`
- `spam_score`
- `spam_reason`

---

## 3. UI 規劃

### 3.1 Blog

**Posts 列表頁** (`/admin/posts`)：

```
[+ New Post]  [↑ Import Posts]  [↓ Export Posts]
```

| 按鈕               | 功能                           |
| ------------------ | ------------------------------ |
| `[↑ Import Posts]` | 上傳 `.zip`（多個 `.md` 檔案） |
| `[↓ Export Posts]` | 下載 `.zip`（所有 posts）      |

**文章編輯頁** (`/admin/posts/[id]/edit`)：

```
Edit Post                    [↑ Import .md]  [↓ Export .md]
```

**新增文章頁** (`/admin/posts/new`)：

```
New Post                                [↑ Import from .md]
```

**Categories 頁面** (`/admin/categories`)：

```
[+ New Category]  [↑ Import]  [↓ Export]
```

---

### 3.2 Gallery

**Items 頁面** (`/admin/gallery`)：

```
[+ New Item]  [↑ Import Items]  [↓ Export Items]
```

**Categories 頁面** (`/admin/gallery/categories`)：

```
[+ New Category]  [↑ Import]  [↓ Export]
```

---

### 3.3 Website

**Site Content 頁面** (`/admin/content`)：

```
[↑ Import]  [↓ Export]
```

**Landing Sections 頁面** (`/admin/landing`)：

```
[↑ Import]  [↓ Export]
```

---

### 3.4 Comments

**Comments 頁面** (`/admin/comments`)：

```
[↓ Export]
  ☐ Include sensitive data (email, IP, spam info)
```

---

### 3.5 入口並存策略

| 入口                 | 說明                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| 各頁面獨立按鈕        | 單一資料類型的快速匯入/匯出（Blog/Gallery/Content/Landing/Comments） |
| `/admin/import-export` | 集中入口（含 Job History、Comments CSV 匯出、Content/Landing JSON 匯入） |

**設計原因**：

- 各頁面按鈕：方便單一資料類型的快速匯入匯出
- `/admin/import-export`：適合批量操作、需要可追蹤/可重下載的匯出

**不合併原因**：

- 日常操作（如備份單一文章分類）不需進入集中入口
- 集中入口需要更多狀態/歷史管理（Job History），不應綁定在各內容頁面

---

## 4. 匯入流程

### 4.1 標準流程

```
Step 1: 選擇/上傳檔案
        ↓
Step 2: 系統解析並驗證
        - 格式驗證
        - 欄位對應驗證
        - 關聯存在性檢查（如 category slug）
        ↓
Step 3: Dry Run 預覽
        - 顯示：新增 X 筆、更新 Y 筆、略過 Z 筆
        - 顯示：驗證警告/錯誤
        ↓
Step 4: 確認執行
        - 若有錯誤，必須修正後重新上傳
        - 若僅有警告，可選擇繼續或取消
        ↓
Step 5: 執行匯入
        - 顯示進度
        - 完成後顯示摘要
        ↓
Step 6: 觸發 Embedding 生成（若 Module C 已啟用）
        - 非同步背景執行
        - 不阻塞匯入完成通知
```

### 4.1.1 Embedding 觸發機制（Module C 整合）

當 Module C（Supabase AI）已啟用時，匯入完成後會自動觸發 embedding 生成：

| 匯入類型      | Embedding 處理          |
| ------------- | ----------------------- |
| Posts         | 非同步生成，每筆約 1 秒 |
| Gallery Items | 非同步生成，每筆約 1 秒 |
| 其他資料      | 不建立 embedding        |

**批量匯入（100 筆）預估時間**：

- 匯入本身：5-10 秒（同步完成）
- Embedding 生成：1-2 分鐘（背景完成）

> 使用者在匯入完成後即可操作，無需等待 embedding 生成。

**Phase 邊界行為**：

| 條件                            | 匯入後行為              | UI 顯示                               |
| ------------------------------- | ----------------------- | ------------------------------------- |
| Phase < 5（無 OPENAI_API_KEY）  | 跳過 embedding 生成     | 無特殊提示                            |
| Phase ≥ 5（有 OPENAI_API_KEY）  | 背景觸發 embedding 生成 | Toast: "Embedding 生成中..."          |
| Phase ≥ 5 但 embedding 生成失敗 | 記錄失敗項目            | Admin 通知: "X 筆 embedding 生成失敗" |

> 使用者可在 `/admin/embeddings` 查看狀態與重試。

**觸發機制**：

```typescript
// lib/modules/import-export/import-*-io.ts 匯入完成後
if (process.env.OPENAI_API_KEY) {
  await queueEmbeddingGeneration(importedItems);
} else {
  console.warn("OPENAI_API_KEY not set, skipping embedding generation");
}
```

**Phase 相依性**：

- 若 `OPENAI_API_KEY` 環境變數未設定（Phase 5 未完成），匯入流程自動跳過 Embedding 觸發
- 待 Phase 5 完成並設定環境變數後，可透過「批次初始化」功能對既有資料補跑 embedding（詳見 [SUPABASE_AI.md §4.2](embeddings-semantic-search-spec.md#42-批次初始化)）

### 4.2 衝突處理策略

| 情境                                 | 預設行為               |
| ------------------------------------ | ---------------------- |
| slug 已存在                          | 更新（覆蓋）           |
| 參照不存在（如 category）            | 報錯                   |
| 欄位格式錯誤                         | 該筆略過，繼續處理其他 |
| 系統計算欄位（如 `popularity_rank`） | 忽略，由系統重新計算   |

### 4.2.1 系統計算欄位處理

匯入時以下欄位會被**忽略**，由系統重新計算：

| 欄位                   | 說明     | 重算時機               |
| ---------------------- | -------- | ---------------------- |
| `popularity_rank`      | 熱門排名 | 每日 Cron Job          |
| `embedding`            | 語意向量 | 匯入後立即（async）    |
| `created_at`           | 建立時間 | 若為新增，使用當前時間 |
| `updated_at`           | 更新時間 | 一律使用當前時間       |

> **原因**: 這些欄位由系統維護，匯入資料不應覆蓋，避免資料不一致。

---

### 4.3 Dry Run Preview（試執行預覽）

> **定義**：在實際寫入資料庫之前，先模擬執行匯入過程，讓使用者預覽會發生什麼事。

**運作流程**：

1. 系統讀取上傳的匯入檔案
2. 執行完整驗證（格式、欄位、關聯）
3. 顯示預覽結果，但**不寫入資料庫**
4. 使用者確認後才實際執行

**預覽 UI 範例**：

```
┌──────────────────────────────────────────────────────────────────────────┐
│  匯入預覽 (Dry Run)                                                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  📊 統計摘要                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  ✓ 將新增: 15 筆記錄                                                │  │
│  │  ✓ 將更新: 3 筆記錄（slug 已存在，將覆蓋）                           │  │
│  │  ⚠ 略過: 1 筆記錄（非必要錯誤）                                      │  │
│  │  ✗ 錯誤: 2 筆記錄                                                   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ⚠ 警告清單                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  • 第 8 行 "old-post.md": 將覆蓋現有文章                             │  │
│  │  • 第 12 行: cover_image_url 為空，將使用預設圖片                     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ✗ 錯誤清單（必須修正）                                                   │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  • 第 5 行 "broken-post.md": category "xyz" 不存在                   │  │
│  │  • 第 17 行 "incomplete.md": 缺少必要欄位 title_en                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  [取消]                    [忽略警告並執行]      [修正後重新上傳]          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**按鈕邏輯**：
| 狀態 | 可用按鈕 |
|------|----------|
| 無錯誤、無警告 | `[確認執行]` |
| 有警告、無錯誤 | `[忽略警告並執行]` `[取消]` |
| 有錯誤 | `[修正後重新上傳]` `[取消]`（不可直接執行）|

**好處**：

- 避免匯入錯誤資料後才發現問題
- 提前看到哪些是新增、哪些會覆蓋現有資料
- 發現格式錯誤可以先修正檔案再重新匯入
- 減少資料汙染和回滾成本

**技術實作**：

採用「純驗證模式」（Validation-only），不使用 database transaction：

1. 讀取上傳檔案
2. 解析並驗證格式
3. 查詢資料庫檢查關聯存在性（SELECT only）
4. 查詢 slug 是否已存在以判斷新增/更新
5. 彙整結果回傳前端顯示

**原因**：避免大量資料時的 transaction 開銷與 lock 問題。

---

### 4.4 錯誤恢復策略（Error Recovery）

> **決策**: 採用 DB Transaction 全部 Rollback 策略，確保資料一致性。

#### 4.4.1 錯誤恢復選項（已決定）

| 問題                             | 選項                                   | 決定   | 理由                       |
| -------------------------------- | -------------------------------------- | ------ | -------------------------- |
| **A. 匯入被中斷（網路/伺服器）** | A1. 從頭重來<br>A2. 繼續未完成的       | **A2** | 避免重複匯入已成功的項目   |
| **B. 部分失敗**                  | B1. 不保留部分成功<br>B2. 保留部分成功 | **B1** | 保持資料一致性，避免半成品 |
| **C. 回滾策略**                  | C1. 全部 Rollback<br>C2. 僅回滾失敗的  | **C1** | DB Transaction 保證        |

#### 4.4.2 實作方式

```typescript
// lib/modules/import-export/import-*-io.ts

export async function importBatch(items: ImportItem[]): Promise<ImportResult> {
  // 使用 Supabase transaction
  const { error } = await supabase.rpc("import_batch", {
    items: JSON.stringify(items),
  });

  if (error) {
    // 全部回滾，不保留部分成功
    return {
      success: false,
      error: error.message,
      processed: 0,
      total: items.length,
    };
  }

  return {
    success: true,
    processed: items.length,
    total: items.length,
  };
}
```

#### 4.4.3 中斷恢復流程

當匯入被中斷時（網路問題、伺服器錯誤）：

```
Step 1: 系統偵測到中斷
        - 記錄已處理的 items（已 commit 的 batch）
        - 記錄未處理的 items（pending batch）
        ↓
Step 2: 使用者重新上傳（或從快取恢復）
        - 系統顯示：「偵測到上次匯入中斷，是否繼續？」
        - 顯示：「已完成 X 筆，尚餘 Y 筆」
        ↓
Step 3: 使用者選擇
        - [繼續未完成的] → 從中斷點繼續
        - [從頭開始] → 清除快取，重新匯入（可能產生重複）
        ↓
Step 4: 執行
        - 若繼續：跳過已完成的 items（依 slug 判斷）
        - 若重新開始：覆蓋已存在的 items
```

#### 4.4.4 批次處理策略

為支援中斷恢復，大量匯入採用分批 commit：

| 項目                 | 設定                           |
| -------------------- | ------------------------------ |
| 批次大小             | 10 筆/batch                    |
| 每批獨立 Transaction | 是（批次間可恢復）             |
| 批次內失敗           | 該批全部回滾                   |
| 批次間失敗           | 已完成批次保留，從失敗批次繼續 |

**範例（匯入 35 筆）**：

```
Batch 1 (1-10):   ✓ Committed
Batch 2 (11-20):  ✓ Committed
Batch 3 (21-30):  ✗ 第 25 筆失敗 → Batch 3 全部回滾
                  中斷點：第 20 筆
Batch 4 (31-35):  未執行

→ 恢復時從 Batch 3 (21-30) 重新開始
```

---

## 5. 技術架構（依循 ARCHITECTURE.md）

### 5.1 模組結構

```
lib/
├── modules/
│   └── import-export/
│       ├── export-io.ts             # (server-only) export entry (blog re-export)
│       ├── import-io.ts             # (server-only) import entry (blog re-export)
│       ├── export-blog-io.ts        # Blog export (ZIP)
│       ├── import-blog-io.ts        # Blog import facade (re-export)
│       ├── import-blog-preview-io.ts# Blog import preview (ZIP)
│       ├── import-blog-apply-io.ts  # Blog import apply (ZIP)
│       ├── export-gallery-io.ts     # Gallery export
│       ├── import-gallery-io.ts     # Gallery import facade (re-export)
│       ├── import-gallery-items-io.ts      # Gallery items import (preview/apply)
│       ├── import-gallery-categories-io.ts # Gallery categories import (preview/apply)
│       ├── export-content-io.ts     # Site content + landing export
│       ├── import-content-io.ts     # Site content + landing import (preview/apply)
│       ├── export-comments-io.ts    # Comments export (export-only)
│       ├── jobs-io.ts               # Job history (import_export_jobs)
│       ├── formatters/              # (pure)
│       ├── parsers/                 # (pure)
│       └── validators/              # (pure)
└── types/
    └── import-export.ts         # Shared types
```

### 5.2 架構約束對應

| 約束（from ARCHITECTURE.md） | 本功能對應                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| IO boundaries（§3.4）        | 所有 DB 操作集中於 `lib/modules/import-export/*-io.ts`（app layer 只做 validate → call lib）                     |
| IO module size（§3.4）       | 每個 `*-io.ts` 檔案不超過 300 行（預估各檔約 80-150 行）                                                 |
| Pure modules（§4.3）         | formatters/parsers/validators 為純函式，可單測                                                           |
| Server-only（§4.5, §4.6）    | 所有 IO 檔案開頭必須 `import 'server-only';`，`gray-matter`/`jszip` 不進 public bundle                   |
| Single source of truth       | Types 定義於 `lib/types/import-export.ts`                                                                |
| **Heavy deps server-only**   | `gray-matter`, `jszip`, `papaparse`, `exceljs` 僅能存在於 `lib/modules/import-export/**`（不得進 client bundle） |

---

## 6. 安全性考量

### 6.1 權限控制

| 角色   | Export                     | Import   |
| ------ | -------------------------- | -------- |
| Owner  | ✓ 全功能                   | ✓ 全功能 |
| Editor | ✓ 僅內容類（Blog/Gallery/Content/Landing） | ✗ 禁止   |
| Public | ✗                          | ✗        |

### 6.2 敏感資料處理

**匯出時可排除的欄位**：

| 資料類型 | 敏感欄位                                                                         |
| -------- | -------------------------------------------------------------------------------- |
| Comments | `user_email`, `ip_hash`, `spam_score`, `spam_reason`                             |

### 6.3 檔案大小限制

| 格式         | 上傳限制 | 記錄數限制 |
| ------------ | -------- | ---------- |
| JSON         | 10 MB    | 100 筆     |
| Markdown.zip | 20 MB    | 100 筆     |

---

