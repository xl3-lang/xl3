# xl3

> Excel 轉換,在 Excel 之中,以 Excel 語法完成。
> 把反覆出現的 Excel 轉換規則,留在工作簿範本裡。

**狀態:** alpha · XTL spec 0.1 (draft) · 1.0 之前可能出現 breaking change

xl3 在技術層面已逐漸成熟,但作為專案仍處於形成期:單一維護者、目前尚無
正式上線的參考案例、治理規範剛剛文件化。Audit pass 已關閉所有 silent-fallthrough
路徑 (66 個 ADR、139 個 fixture,全部 green),語言表面已穩定到足以讓
early adopter 嘗試。**現階段最有價值的貢獻,就是實際使用後的回饋** —
1.0 的 blocker 請見 [ROADMAP.md](./ROADMAP.md),決策方式請見
[GOVERNANCE.md](./GOVERNANCE.md)。

**0.6.0 → 0.7.0 重點變更**(2026 年 5 月):一次 15 個 ADR(ADR-0051..0065)
的整合,關閉了所有殘餘的「同一份範本形狀可能被解讀成兩種,或靜默通過」
的語法衝突點。對使用者影響最明顯的是**聚合函式參數形狀限制**(ADR-0059)
— `SUM`、`AVERAGE`、`MIN`、`MAX` 與 1-arg `COUNT` 現在只接受單一欄位
參照(`[Column]` 或 `Source[Column]`),像 `SUM([數量] * [單價])` 這種
逐列算式會在解析階段被 `xl3/eval/bad-aggregate-arg` 拒絕。建議在來源資料
新增輔助欄,或在頁尾儲存格直接寫原生 Excel 的 `=SUMPRODUCT(...)` —
詳見 [Cookbook 03](./docs/guides/03-aggregates.md) 與
[Cookbook 16](./docs/guides/16-xtl-vs-excel-formula.md)。0.7.0 同時釘住
的其他行為包括:字串字面值分隔界線(0051)、混合文字錯誤 sentinel 的
傳播(0053)、儲存格情境下的 bare-name 解析(0054)、`@subtotal` 列
構成(0058)、`XLOOKUP` value 參數規則(0060)、`__inputs__` 的
default / options 拆分規則(0062、0063),以及字串轉數字的強制轉型
範圍(0064)。

**0.5.x → 0.6.0**(2026 年 5 月稍早):來源工作簿的**合併儲存格標題**
原生支援(ADR-0033)— 這是台灣與華語區廠商表單(對帳單、結算單、
採購單)常見的格式。資料列的合併儲存格會把主值 broadcast 到從屬儲存格
(ADR-0035)。新增涵蓋圖片、條件式格式設定、名稱定義、凍結窗格、工作表
保護、資料驗證與儲存格註解的正規保留矩陣(ADR-0036)。0.6.0 加入
**`@group` / `@subtotal`** 指令,可以在同一個資料區塊內穿插每客戶 /
每月的小計列(ADR-0038)— 這是 B2B 對帳單最典型的形狀。`__inputs__`
的 default、label、description、options 儲存格現在會被當成 XTL 範本,
在受限的環境中求值,所以宿主介面不會再原樣顯示 `{{ TODAY() }}`
(ADR-0050)。

**範疇(ADR-0043)。** XTL 的函式表面刻意比 Excel 來得小。原則是:一個
函式只有在它的值必須**在工作簿寫出之前**就確定時,才會放進 XTL — 例如
`@filter`、`@sort`、`@group`、`@subtotal`、source 聚合、檔名 / 工作表
命名 pattern、或 `__inputs__` 預設值。任何 Excel 可以在開啟工作簿時
計算的東西(顯示格式、儲存格內運算、型別判斷),都應放在儲存格公式裡,
xl3 會原封不動保留。並列對照請見
[Cookbook 16](./docs/guides/16-xtl-vs-excel-formula.md)。

[English](./README.md) · [한국어](./README.ko.md) · [日本語](./README.ja.md) · [简体中文](./README.zh-CN.md) · **繁體中文** · [Español](./README.es.md) · [Website](https://xl3.io) · [Spec](./spec) · [Implementations](./IMPLEMENTATIONS.md) · [Roadmap](./ROADMAP.md) · [Governance](./GOVERNANCE.md)

> **正在用 LLM(Claude、GPT、Gemini、Codex、Cursor 等)撰寫 xl3 範本嗎?** 請先閱讀 [`docs/llm-template-authoring.md`](./docs/llm-template-authoring.md)。文中說明了 LLM 幾乎每次都會犯的一個錯誤(殘留的樣式列會污染每一份輸出),以及該如何避免。該文件保留英文 — 因為它是供 LLM 直接參照的文件,以英文維持較佳的一致性。

---

## xl3 是什麼?

xl3 把 Excel 轉換邏輯放在 **Excel 檔案內**,而不是放在程式碼裡。
非開發人員可以直接打開檔案閱讀、編輯轉換規則,因為這些規則就是用他們
每天在使用的 `IF`、`SUM`、欄位參照寫成的。開發者交付引擎;工作簿
交付業務流程。

整個架構很單純:

- 誰:不需要看程式碼的營運人員與分析師
- 做什麼:反覆出現的 Excel 轉換業務
- 怎麼做:範本工作簿、`source_table`,加上熟悉的 Excel 公式

```text
raw.xlsx        (輸入資料)
       +
template.xlsx   (轉換規則)
       ↓
result.xlsx     (完成的工作簿)
```

開發者用程式碼掌管引擎;營運團隊則透過檔案流程操作:上傳原始 Excel、
挑選核准過的範本、下載完成的工作簿。

範本是**直接在 Excel 裡撰寫**的。在 `__config__` 工作表放設定,在儲存格
裡寫 `{{ [客戶] }}` 或 `{{ IF([續約金額] > 10000, "優先", "普通") }}`
這類運算式,存檔後執行 xl3 即可。不需要巨集、不需要隱藏腳本、也不需要
任何廠商雲端服務。

範本本身就是交接資產。它可以被審查、版本控管、歸檔,然後直接交給下一位
營運人員,完全不需要他們去讀自動化程式碼。

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

輸出仍然是一份 `.xlsx` 工作簿。範本的格式設定、數值格式、合併儲存格都
屬於預期結果的一部分,而不是順便帶上的細節。

語言草案請見 [`spec/`](./spec);實作中立的 fixture corpus 與 runner
protocol 請見 [`conformance/`](./conformance)。

## 為什麼會有 xl3?

許多報表業務本來就活在試算表裡:續約報告、結算單、發票匯出、內部營運
表單。它們經常透過一次性的 Python 腳本、VBA 巨集,或是某個服務專屬的
工作流程步驟來自動化。這在初期能用,但時間久了業務規則就會散落在程式碼、
帳號設定與口耳相傳之中。

xl3 把可重複使用的引擎,跟工作簿專屬的轉換契約分開。部署、驗證、整合
留在程式碼;反覆出現的業務流程留在工作簿。

## xl3 強調的事情

- **檔案為基礎的流程。**原始 `.xlsx` 進、核可過的範本進、完成的工作簿出。
- **規則跟著工作簿走。**`__config__`、運算式、版面、輸出形狀都封存在
  `template.xlsx` 裡。
- **引擎由開發者掌管。**TypeScript API 可以直接放進瀏覽器頁面、內部
  入口網站、CLI 或服務端點。
- **Excel 仍舊是 Excel。**樣式、數值格式、工作表結構、合併儲存格都會
  保留在結果裡。
- **沒有巨集,也沒有廠商雲端。**範本的行為,就是工作簿裡明確寫下來的
  內容。

## 比較

| 取向 | 擅長的場景 | 取捨 |
|---|---|---|
| **xl3** | 打造檔案為基礎的 Excel 轉換引擎,讓營運人員上傳原始 `.xlsx`、下載完成的工作簿。業務規則留在 `template.xlsx` 內。 | Alpha 階段。XTL 表面刻意維持小範圍,仍在演進中。 |
| Python / VBA 腳本 | 貼近既有試算表的一次性快速自動化。 | 業務規則容易留在程式碼或單一維護者的記憶裡,交接與審查都比較吃力。 |
| Power Query / Office Scripts / Power Automate | Microsoft 365 內的工作流程、資料整形、動作自動化。 | 平台契合度高,但流程容易綁定到特定租戶 / 帳號 / 環境,而不是可攜的工作簿成品。 |
| SheetJS、ExcelJS、Aspose.Cells 等試算表 SDK | 低階或全功能的程式化工作簿生成。 | 開發者通常會把報表專屬規則直接寫進應用程式程式碼。 |
| JXLS、xltpl 等範本 / 報表引擎 | 從類似試算表的範本進行伺服器端報表生成。 | 實用,但通常綁定特定語言 / runtime;面向營運人員的瀏覽器流程與工作簿層級交接並非主要產品形狀。 |
| Plumsail、Formstack、Conga 等文件生成 SaaS | 受託管的文件流程、整合、簽核、寄送。 | 規則住在廠商服務裡,而不是住在你可以自架的可攜式工作簿範本內。 |
| 以 LLM 生成試算表 | 臨時的探索與草稿。 | 不適合作為反覆營運業務所需的確定性轉換契約。 |

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
<script src="https://cdn.jsdelivr.net/npm/@jinyoung4478/xl3@0.7.0/dist/xl3.bundle.iife.min.js"></script>
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
