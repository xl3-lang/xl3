---
slug: /guides
sidebar_label: '概覽'
pagination_label: '概覽'
---

# XTL 指南

針對常見報表工作流程，提供可直接複製貼上的精簡食譜。每篇食譜都是一頁短短的 Markdown，包含情境、範本儲存格與預期結果。

這些指南補強了既有的兩個資料來源：

- **[`examples/`](https://github.com/jinyoung4478/xl3/tree/main/examples/)** 內含四個可執行範本，以端對端方式展示組合後的形態。挑一個複製當作起點即可。中文範例可參考 `04-cafe-weekly-report`。
- **[`spec/language.md`](../spec/language.md)** 是各函式與指示子的正式參考（英文）。當食譜未涵蓋你的情境時，回頭翻它。

這裡的食譜優先「展示 X 的最小範本」而非「完全擬真的生產級範本」 — 目標是當你還記得形態、卻一時想不起語法時，能快速查到。

## 食譜列表

| # | 食譜 | 學習重點 |
|---|---|---|
| 01 | [5 分鐘上手](./01-getting-started.md) | 範本 + 資料 → 結果。替換與 `__config__`。 |
| 02 | [條件式儲存格](./02-conditional-cells.md) | `IF`、`IFEMPTY`、比較運算子、真值判定。 |
| 03 | [列的彙總](./03-aggregates.md) | `SUM`、`COUNT`、`AVERAGE`、`MIN`、`MAX` — 區塊內 vs 整個來源。 |
| 04 | [每個群組一個檔案](./04-file-per-group.md) | 透過 `output_file_pattern` 做檔案分組。 |
| 05 | [每個群組一個工作表](./05-sheet-per-group.md) | 工作表分組 + 清單式篩選。 |
| 06 | [執行時輸入](./06-runtime-inputs.md) | 為每次執行供應值（月份、地區等）的 `__inputs__`。 |
| 07 | [多來源 + `@join`](./07-multi-source-join.md) | `__sources__`、`@source`、`@join`。 |
| 08 | [`XLOOKUP`](./08-xlookup.md) | 跨來源查找。 |
| 09 | [排序與前 N 名](./09-sort-and-top.md) | `@sort`（穩定排序）、`@top`、多鍵排序。 |
| 10 | [樣式與品牌化](./10-styling-and-branding.md) | `tabColor`、合併儲存格、`numFmt`、`TEXT()`。 |
| 11 | [`TEXT()` 格式化](./11-text-formatting.md) | 貨幣、日期、百分比。`numFmt` 與 `TEXT()` 的選用時機。 |
| 12 | [深入處理空值](./12-empty-values.md) | `IFEMPTY`、空值 vs 零的陷阱、`(blank)`、稀疏資料的彙總。 |
| 13 | [宿主端的錯誤處理](./13-error-handling.md) | 捕捉 `XtlError`、錯誤碼目錄、用於快速失敗的 `preview()`。 |
| 14 | [當作值字典用的 `__config__`](./14-config-values.md) | 作者自訂鍵、型別感知、`__config__` vs `__inputs__`。 |
| 15 | [組合指示子](./15-directive-composition.md) | 執行順序、多個 `@filter` 以 AND 合併、禁用的組合。 |
| 16 | [XTL 函式 vs Excel 公式](./16-xtl-vs-excel-formula.md) | `{{ ... }}` 與 `=...` 儲存格公式如何分工。ADR-0043 的 render-time / open-time 界線。 |
| 17 | [編寫範本時看到的畫面](./17-template-authoring-display.md) | 編輯範本時 Excel 顯示的樣子（錯誤、佔位符），為何這是預期，以及儀表板的 `IFERROR` 包裝慣例。 |
| 18 | [`@group` 與 `@subtotal`](./18-group-and-subtotal.md) | 在單一資料區塊裡插入每組小計列（ADR-0038） — 單層、巢狀、用最外層 @subtotal 做總計。 |

## 如何閱讀食譜

每篇食譜的結構都相同：

1. **情境** — 操作員想達成的目標，一句話帶過。
2. **`__config__`** — 需要哪些鍵。
3. **範本儲存格** — 達成目標所需的最小儲存格集合。
4. **資料** — 小小的輸入表格。
5. **結果** — `convert()` 回傳的內容。
6. **備註** — 需留意之處，以及想深入了解時可參考的規格指引。

## 寫法慣例

- 儲存格採 Excel 慣用的 `A1` 標記法，而不是 `[row, col]`。
- `__config__` 的值在文中為簡潔起見寫成 `key = value`，但實際的 `template.xlsx` 中會落在兩個欄位（`A: key`、`B: value`）。
- 原始資料以 Markdown 表格顯示讓食譜保持簡短。實際的 `data.xlsx` 會把那些列放在和 `source_sheet` 同名的工作表裡。

## 親自跑跑看食譜

指南中的食譜以文件為主 — 並非每篇都附帶可執行的 `.xlsx` 一組。若想實際試試：

1. 開啟 Excel，建立一份新的活頁簿。
2. 加上 `__config__` 工作表，填入食譜中列出的鍵。
3. 加上和 `source_sheet` 同名的資料工作表。
4. 加上範本工作表，並把食譜中的儲存格填進去。
5. 存成 `template.xlsx`，資料另存成 `data.xlsx`。
6. 執行 `convert(templateBuffer, dataBuffer)`（請見 [README](/readme#usage)）。

或更快的做法：直接複製其中一個 [可執行範例](https://github.com/jinyoung4478/xl3/tree/main/examples/)，再依需求調整。
