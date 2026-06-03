# xl3

> **AI 生成 Excel 報表的確定性執行引擎。**
> LLM 撰寫範本,xl3 渲染工作簿 —— 同一份範本、
> 同一份資料,每次都產生同樣的位元組。

**狀態:** alpha · XTL spec 0.1 (draft) · 1.0 之前可能出現 breaking change

xl3 是一個小型的 TypeScript 引擎,把兩份 `.xlsx` 檔案 ——
**範本**(工作流程契約)與**原始資料** —— 轉換成一份完成、
格式化好的工作簿。範本本身就是一份 `.xlsx`,直接在 Excel 裡用熟悉的
公式撰寫,再加上一個小巧的內嵌運算式語言(XTL),用來表達那些必須
*在工作簿寫出之前*就確定的東西:篩選、分組、聚合、檔名 pattern。

當範本是由 LLM(Claude、GPT、Gemini、Cursor、Codex 等)生成、編輯或
審查時,xl3 特別合用 —— 你會希望**執行**這一層保持確定、可檢視、可
驗證,而不是「AI 在猜輸出儲存格該長什麼樣」。

[English](./README.md) · [한국어](./README.ko.md) · [日本語](./README.ja.md) · [简体中文](./README.zh-CN.md) · **繁體中文** · [Español](./README.es.md) · [Website](https://xl3.io) · [Spec](./spec) · [LLM authoring guide](./docs/llm-template-authoring.md) · [Implementations](./IMPLEMENTATIONS.md) · [Roadmap](./ROADMAP.md) · [Governance](./GOVERNANCE.md)

---

## 分工:模型撰寫,執行引擎渲染

```text
  ┌──────────────────────────┐         ┌──────────────────────────┐
  │   LLM (Claude / GPT /    │         │         xl3              │
  │   Gemini / Cursor / …)   │         │  (確定性執行引擎)        │
  │                          │         │                          │
  │   自然語言敘述           │         │   template.xlsx          │
  │   + 樣本報表        ───► │  輸出   │   + raw.xlsx             │
  │                          │         │   → result.xlsx          │
  │   「按地區的月結報表,    │         │                          │
  │    含各區小計」          │         │   相同輸入               │
  │                          │         │   → 永遠輸出相同位元組   │
  └──────────────────────────┘         └──────────────────────────┘
       創造性、隨機性                       穩定、可重現
```

LLM 擅長從一句 prompt 加一份樣本草擬報表形狀,卻不擅長產生兩次完全
一致的 `.xlsx`、保留儲存格樣式,或遵守「這欄一律以 SUM 聚合」這類規則。
xl3 就是來補這一塊:模型只負責一次性吐出 `.xlsx` 範本;之後每一次渲染
都是 `(template, data, inputs)` 的純函數。

這套分工正是
[`docs/llm-template-authoring.md`](./docs/llm-template-authoring.md)、
154 個 fixture 的 conformance 語料庫,以及刻意維持精簡的 XTL 表面所
設計的方向。

## 快速範例

範本可以同時包含一般 Excel 內容、`__config__` 與 xl3 運算式:

| `__config__` key | 值 |
|---|---|
| `source_sheet` | `原始資料` |
| `source_table` | `1` |
| `output_file_pattern` | `客戶-續約報告.xlsx` |

| 儲存格 | 範本值 |
|---|---|
| A5 | `{{ [客戶] }}` |
| B5 | `{{ [地區] }}` |
| C5 | `{{ [續約金額] }}` |
| E5 | `{{ IF([續約金額] > 10000, "優先", "普通") }}` |

若資料工作簿如下:

| 客戶 | 地區 | 續約金額 | 負責人 |
|---|---|---:|---|
| 台灣物流 | 台北 | 18400 | 怡君 |
| 高雄貝塔 | 高雄 | 7200 | 俊宏 |

xl3 會輸出:

| 客戶 | 地區 | 續約金額 | 負責人 | 等級 |
|---|---|---:|---|---|
| 台灣物流 | 台北 | 18400 | 怡君 | 優先 |
| 高雄貝塔 | 高雄 | 7200 | 俊宏 | 普通 |

……範本裡的數值格式、填滿、框線、合併標題、頁尾列都會原封不動保留。
輸出是一份能直接用 Excel、Numbers 或 Google Sheets 打開的 `.xlsx`,
不需要任何轉檔。

語言草案請見 [`spec/`](./spec);實作中立的 fixture corpus 與 runner
protocol 請見 [`conformance/`](./conformance)。

## 為什麼執行引擎必須無聊

一句話講完:**LLM 吐出來的任何 Excel,都離一個壞 token 只差一步就會壞掉。**
儲存格公式會漂移,合併會偏一列,貨幣符號可能變成字面上的 `$` 而不是
數值格式。xl3 的工作,就是讓那份範本的*執行*變得可預測,讓模型只需要
*一次*正確。

具體來說:

- **小而可審計的 XTL 表面(ADR-0043)。** 一個函式只有在它的值必須
  **在工作簿寫出之前**就確定時,才會放進 XTL。其他通通寫在普通的
  Excel 儲存格公式裡,讓 Excel 在開啟時自己算。語言越小,LLM 要學的
  表面就越小,要驗證的表面也越小。並列對照請見
  [Cookbook 16](./docs/guides/16-xtl-vs-excel-formula.md)。
- **Conformance 語料庫。** 154 個 fixture,跨 70 個 ADR,全部 green。
  這就是 LLM 生成的範本在碰到正式資料*之前*可以對照的測試床。
- **一份規格,一份實作。** [`spec/`](./spec) 把 XTL 規格獨立於這份
  TypeScript 參考實作之外。歡迎其他語言的移植;語料庫就是契約。
- **沒有巨集、沒有廠商雲端。** 範本就是一份普通的 `.xlsx`。你可以 diff
  它、在 PR 中審查、也可以交給一位從沒聽過 xl3 的人類審閱者。

這些特性讓 xl3 即使**沒有 LLM 在迴圈裡**也仍然好用 —— 營運人員與
分析師可以直接讀、直接改範本,因為運算式用的就是他們每天在用的 `IF`、
`SUM` 與欄位參照。AI 是楔子;人類可讀性才是長尾。

## 跟其他做法的比較

| 取向 | 擅長的場景 | 在 AI 驅動的 Excel 上的取捨 |
|---|---|---|
| **xl3** | LLM 撰寫 Excel 報表流程裡的執行那一半。模型一次寫出範本,xl3 每次都確定性地渲染。 | Alpha 階段;單一維護者;XTL 表面刻意維持精簡,1.0 之前仍在演進。 |
| 直接 LLM → xlsx(function-call 到試算表 SDK) | 快速探索性草稿、一次性圖表。 | 每次渲染都非確定;即使 temperature 設 0,樣式、數值格式、合計也會在執行之間漂移。 |
| SheetJS / ExcelJS / openpyxl | 低階工作簿生成。 | 模型必須學會整個 SDK 表面,並在每次渲染時重新吐出;「範本」是應用程式程式碼,不是可攜的檔案。 |
| Power Query / Office Scripts / Power Automate | Microsoft 365 內的工作流程、資料整形、動作自動化。 | 綁定特定租戶;工作流程規則不會跟著工作簿走。 |
| JXLS / xltpl / jsreport xlsx recipe | 從類似試算表的範本進行伺服器端報表生成。 | 實用,但早於 LLM-as-author 模型;範本 DSL 較龐大,並非為模型可生成而設計。 |
| 文件生成 SaaS(Plumsail、Conga、Formstack) | 受託管的文件流程、整合、簽核、寄送。 | 規則住在廠商服務裡,不是住在你可以交給 LLM 編輯的可攜式工作簿內。 |

## 安裝

```bash
npm install @jinyoung4478/xl3
```

## 使用方法

```ts
import { convert } from '@jinyoung4478/xl3';

const templateBuffer = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
const dataBuffer = await fetch('./data.xlsx').then((r) => r.arrayBuffer());

const outputs = await convert(templateBuffer, dataBuffer);
// outputs: OutputFile[] — 依範本中的 grouping 規則輸出一份或多份 .xlsx
```

可在瀏覽器與 Node(≥20.12)中執行。

### 透過 `<script>` 直接在瀏覽器使用(不需 bundler)

對於不使用 bundler 的專案,xl3 提供自帶相依的 IIFE bundle,直接在
`window.xl3` 上提供 API:

```html
<script src="https://cdn.jsdelivr.net/npm/@jinyoung4478/xl3@0.8.0/dist/xl3.bundle.iife.min.js"></script>
<script>
  const tpl = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
  const data = await fetch('./data.xlsx').then((r) => r.arrayBuffer());
  const outputs = await xl3.convert(tpl, data);
</script>
```

Bundle 大小約 1 MB(minified,gzip 約 300 KB)。ExcelJS 與 JSZip 已內含,
不需要額外相依。

也可以直接到 [xl3.io](https://xl3.io) 試用瀏覽器流程:照原樣執行內附的
範例檔、下載原始 / 範本工作簿來研究,或是換成自己的檔案再跑一次。

### Excel 版本相容性

xl3 透過 OOXML 讀取 `.xlsx` 檔案,設計上大致與 Excel 版本無關 — 它讀取
快取的公式結果、以 UTC 正規化日期,並忽略儲存格值層級之外的 OOXML
序列化差異。完整矩陣請見
[ADR-0022](./spec/decisions/0022-excel-version-compatibility.md);簡要
原則是:所有動態值都用 XTL 的 `{{ ... }}` 語法、避免在資料區塊裡塞圖表 /
樞紐分析表 / 原生公式,以及整個組織統一使用一種日期系統(1900)。

範本透過隱藏的 `__config__` 工作表挑選原始資料的來源表:

| Key | 範例 | 意義 |
|---|---|---|
| `source_sheet` | `原始資料` | 來源工作表名稱,或以 `*` 結尾的前綴 pattern |
| `source_table` | `1` | 第 1 列是欄位名稱,以下為資料 |
| `source_table` | `A1:D` | A1-D1 為欄位名稱,以下為資料 |
| `source_table` | `A1:D200` | A1-D1 為欄位名稱,A2-D200 為資料 |

常見情況(來源檔的第 N 列是欄位名稱)用 `source_table = N` 即可。當表格
從非首欄開始,或需要限制結束列時,才使用範圍寫法。

### 保留工作表

範本使用四個前後加上 dunder 的保留工作表(依 ADR-0011):

| 工作表 | 用途 |
|---|---|
| `__config__` | 範本作者定義的設定與值字典;以 `{{ __config__[name] }}` 存取 |
| `__inputs__` | 每次執行時由宿主傳入的值(ADR-0010);以 `name`/`type`/`default`/`label`/`description`/`options` 欄位宣告 |
| `__sources__` | 預設 `source_sheet` 之外、額外命名的資料來源(ADR-0012);以 `name`/`sheet`/`table`/`description` 欄位宣告 |
| `__lists__` | 供 `@filter [field] in __lists__[name]` 等指令使用的成員清單 |

作者自建的工作表若命名符合 `^__[a-z]+__$`,屬於保留命名,會在解析階段
被拒絕。

### 多重資料來源

除了預設的 `source_sheet`,範本還可以在 `__sources__` 內宣告命名的
資料來源,並以 Excel 的結構化參照(structured-ref)形式使用:

```text
{{ Customers[Account] }}
{{ SUM(Renewals[Amount]) }}
{{ XLOOKUP([Account], Customers[Account], Customers[Name]) }}
```

`@source <Name>` 會把資料區塊的預設來源切換成 `<Name>`,讓單純的
`[Column]` 簡寫也以 `<Name>` 為基準解析。`@join` 則用 key 把主來源的列
跟第二個來源的列配對(inner-join,取首次匹配)。完整指令語法請見
[`spec/language.md`](./spec/language.md)。

### Runtime 輸入值

需要在執行時提供值的範本(例如目標月份、客戶篩選、標籤),在
`__inputs__` 中宣告,然後由宿主在呼叫 `convert(...)` 時傳入:

```ts
await convert(templateBuffer, dataBuffer, {
  inputs: { month: '2026-05', region: '台北' },
});
```

這些輸入值會流入儲存格(`{{ __inputs__[month] }}`)、檔名 pattern,
以及群組 key 之中。

## 範例

[`examples/`](./examples) 中收錄了四份貼近實務形狀的範本:基本續約報告、
依地區拆分工作表的清單過濾、含 runtime 輸入的多來源 join,以及示範
`@group` + `@subtotal` 依分類顯示小計的咖啡店週報。可用
`npm run examples:build && npm run examples:run` 執行。

## Guides

[`docs/guides/`](./docs/guides) 收錄了常見工作流程的短小複製貼上食譜。
共 18 則食譜,涵蓋入門、條件式、聚合、檔案 / 工作表分組、runtime 輸入、
join、`XLOOKUP`、排序 / Top-N、樣式設定、多行文字、空值、錯誤處理、
`__config__` 值、指令組合、XTL vs Excel 公式、範本撰寫期的顯示,以及
`@group` / `@subtotal`。

## Spec

XTL 規格是語言中立的,放在 [`spec/`](./spec)。本 repo 提供 TypeScript
的參考實作。歡迎其他語言的移植 — 詳見
[IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md)。

Conformance 語料庫可在本地直接執行:

```bash
npm run conformance
node dist/bin/conformance.js --fixture-dir=conformance/fixtures --comparison-stage=2
```

最近一次參考實作執行結果的摘要,連同任何投放在
[`conformance/reports/`](./conformance/reports/) 下的外部移植回報,都會
匯總在 [`conformance/DASHBOARD.md`](./conformance/DASHBOARD.md)。可以用
`npm run conformance:dashboard` 重新產生。

## 專案結構

- `spec/` — 正規的 XTL 語言草案。
- `conformance/` — 實作中立的 fixture 語料庫與 runner protocol。
- `src/` — TypeScript 參考實作。

規格是事實的來源。Conformance fixture 把規格行為固定成可執行的形態。
參考實作是有用的工具,但本身並非規範。

## 授權

- Code(`src/`、`conformance/`):[MIT](./LICENSE)
- XTL spec(`spec/`):[CC-BY-4.0](./spec/LICENSE)

---

Microsoft 與 Excel 為 Microsoft Corporation 的商標。xl3 與 Microsoft
無任何關聯。Office Open XML 格式(`.xlsx`)是以 ISO/IEC 29500 公開的
標準。
