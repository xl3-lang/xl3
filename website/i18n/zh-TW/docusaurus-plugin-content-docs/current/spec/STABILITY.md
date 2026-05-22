# XTL 穩定性政策

## 目前狀態

XTL 目前版本為 **0.1**。參考實作以
`@jinyoung4478/xl3@0.1.0` 發布於 npm。1.0 的切版被刻意延後，
直到累積足夠的外部驗證為止——至少要有第二個語言移植版通過
符合性語料庫，並且有一位實際採用的生產用戶。在這之前，
0.x 各次要版本之間可能會出現破壞性變更，並 **應**（**SHOULD**）
在受影響的 ADR 內加以記載。

1.0 將凍結的契約其實已經草擬完成（見下方「邁向 1.0 的路徑」）；
之所以延後，是因為對外部訊號的要求，而不是規格還沒寫好。

## 0.x 期間

- 規格的破壞性變更會在受影響的 ADR 中記錄，並在下一次次要版本釋出前反映到符合性語料庫。
- 參考實作（npm 上的 `xl3`）的 API 自身遵循 SemVer；規格層級的破壞性變更會使規格次要版本遞增。
- 實作應宣告自己對齊的規格版本（例如 `XTL 0.2 partial`、`XTL 0.3 full`）。

## 1.0 之後

- 規格凍結，僅接受向下相容的演進。
- 規格上的破壞性變更需要走 XTL 2.0 流程，含公開討論與遷移指南。
- 參考實作嚴格遵循 SemVer。

## 邁向 1.0 的路徑

1.0 切版會封存 XTL 的第一份可移植性契約。意圖是：在凍結後的
fixture 語料庫上，任何符合規格的實作，不論在何種主機時區、地區設定
或位元順序下，都應產出完全相同的輸出（Stage 1）與完全相同的
正規 OOXML（Stage 2）。

### 公開 API 介面（xl3 參考實作）

TypeScript 參考實作會在 1.0 時凍結下列 13 個執行階段
匯出。新增匯出屬向下相容；移除或重新命名其中任何一個都
只能在 2.0 進行。

**轉換的進入點**

- `convert(template, source, options?) → Promise<OutputFile[]>`
- `preview(template, source, options?) → Promise<PreviewResult>`
- `readTemplateInputs(template) → Promise<InputSpec[]>`
- `analyze(template) → Promise<ParsedTemplate>`
- `analyzeModel(template) → Promise<TemplateModel>`
- `packageZip(files) → Promise<Blob>`

**較低階的輔助函式**

- `readConfigSheet(workbook) → ConfigResult`
- `writeConfigSheet(workbook, meta) → void`
- `readInputsSheet(workbook, configVars?) → InputSpec[]`（依
  ADR-0050，在 0.6.0 新增了可選的 `configVars` 參數；以單一
  參數呼叫仍然有效）
- `batchMatch(...)`——檔案模式比對輔助函式
- `toTemplateModel(parsed) → TemplateModel`

**錯誤輔助函式（ADR-0015）**

- `xtlError(code, message) → XtlError`
- `isXtlError(value) → boolean`

**穩定的型別重新匯出**——在 1.0 時凍結：
`TemplateMeta`、`TemplateModel`、`OutputFile`、`PreviewResult`、
`PreviewSource`、`PreviewFile`、`PreviewSheet`、`ConvertOptions`、
`InputSpec`、`InputType`、`SourceSpec`、`XtlError`、`XtlErrorCode`、
`XtlWarning`、`XtlWarningCode`。

**實驗性的型別重新匯出**（ROADMAP G22）——為工具鏈而匯出，
但其外觀 **可能**（**MAY**）在次要版本之間變動：
`ParsedTemplate`、`SheetTemplate`、`TemplateVariable`、`DataBlock`、
`Directive`、`FilterDirective`、`FilterOp`、`SortDirective`、
`TopDirective`、`RepeatDirective`、`SourceDirective`、
`JoinDirective`。

每個實驗性型別都帶有 `@experimental` JSDoc 標籤。持有上述任一
物件的宿主 **應**（**SHOULD**）以 `kind` 進行分派（針對指令），
或把整個外觀視為不透明；若依賴特定欄位組合，則 **應**（**SHOULD**）
釘住特定的 xl3 次要版本。對多數工具鏈需求而言，可序列化、變動較慢
的替代方案是 `TemplateModel`（由 `analyzeModel` 回傳）。

`src/__tests__/api-surface.test.ts` 的快照測試會釘住執行階段匯出
清單，並在未經宣告的變動時讓 CI 失敗。新增匯出必須刻意更新
快照，並同步寫入 CHANGELOG 條目。

### 1.0 凍結的內容

下列 ADR 所涵蓋的介面，屬於 1.0 契約的一部分。破壞性變更
需要切出 XTL 2.0。

- ADR-0001 — `TODAY()` UTC 語意
- ADR-0002 — 輸出檔名清理
- ADR-0003 — 由 numFmt 驅動的強制轉型
- ADR-0005 — 動態符合性斷言協定
- ADR-0006 — Stage 2 正規 OOXML 比較（規則 1-8 加上列出落差項目的
  修訂）
- ADR-0007 — 空值判定式
- ADR-0008 — 真假性規則
- ADR-0009 + ADR-0017 — 比較演算法與來源值模型（兩者
  合在一起視為單一契約）
- ADR-0010 + ADR-0011 — 執行階段輸入與保留工作表命名
- ADR-0012 — 多來源資料模型
- ADR-0013 — XLOOKUP 跨來源查找
- ADR-0014 — `@join` 區塊層級配對（單一內部合併、
  決定性首筆相符）
- ADR-0015 — 結構化錯誤回報（`xl3/...` 代碼 + 英文
  符合性訊息）
- ADR-0016 — 排序與排序穩定性
- ADR-0033 — 合併儲存格的來源表頭
- ADR-0035 — 資料列合併儲存格廣播
- ADR-0036 — 範本特性保留矩陣
- ADR-0038 — `@group` + `@subtotal` 指令（交錯排放小計）
- ADR-0039 — `HYPERLINK` 儲存格輸出
- ADR-0040 — 保留矩陣修訂（大綱層級已交付；
  CF/DV 範圍 PE 待 0.6.1 處理）
- ADR-0041 — 多行儲存格文字契約
- ADR-0044 — 函式批次（UPPER、LOWER、TRIM、IFERROR、IFS、DATE）
- ADR-0046 — 儲存格公式保留（OOXML 元素契約）
- ADR-0047 — `ISBLANK` 作為 `IFEMPTY` 別名
- ADR-0050 — `__inputs__` 的 `default`／`label`／`description`／`options`
  視為 XTL 範本
- ADR-0051 — `{{ ... }}` 區塊分隔邊界 + 不成對字面值偵測
- ADR-0052 — 單一運算式 vs. 混合文字儲存格的分類（先 trim 再做錨定
  匹配；相鄰區塊一律視為混合文字）
- ADR-0053 — 混合文字情境下 Excel 錯誤標記的傳播
- ADR-0054 — 儲存格／檔案／工作表樣式中的裸名稱
  （簡寫解析 + `xl3/expression/unknown-name`）
- ADR-0055 — `@top` ／ `@repeat right` 的正整數語法
- ADR-0056 — `__config__[system-key]` 讀取政策
- ADR-0057 — `@filter in/!in` 以外場合拒絕使用 `__lists__[name]`
- ADR-0058 — `@subtotal` 列組成（同列層級綁定）
- ADR-0059 — 彙總函式引數形狀（僅接受欄參考）
- ADR-0060 — `XLOOKUP` 值／後備引數規則（後備採延遲求值）
- ADR-0061 — 來源名稱 vs. 函式名稱的詞法消歧
  （保留 ADR-0024 擴充原樣透通）
- ADR-0062 — `__inputs__` `default = ""` 語意
- ADR-0063 — `__inputs__` `options` 以豎線分隔的規則
- ADR-0064 — 字串→數字強制轉型的範圍（接受科學記號；
  hex／binary／octal 拒絕）
- ADR-0065 — `@source default` 顯式形式 + 來源名稱大小寫
  敏感性
- ADR-0021（群組順序修訂）— 當 `@sort` 不相符時的
  群組順序由實作自訂
- ADR-0041（表頭修訂）— 表頭儲存格換行的正規化

ADR-0043 與 ADR-0048 為 **流程規範性**——它們約束未來
ADR 作者，但不約束執行階段契約。ADR-0034 與 ADR-0049 為
資訊性。ADR-0004 為資訊性（參考實作耦合度稽核）。ADR-0037、
ADR-0042、ADR-0045 為已駁回（駁回本身即契約）。

### 1.0 不包含的內容

下列項目刻意延後處理。加入它們屬向下相容，
不需要新的規格主要版本。

- 單一區塊中多個 `@join` 指令、`@join … left` 語意、
  多列相符合併（ADR-0014 明列的範圍外清單）。
- XLOOKUP 萬用字元、近似比對與反向查找模式
  （ADR-0013 明列的範圍外清單）。
- 區域感知的字串排序。排序使用 Unicode 碼位
  順序；需要區域排序的宿主請在上游先行排序。
- 日期／日期時間運算函式（不含 `EOMONTH`、`EDATE`、
  `DATEDIF` 等）。
- ADR-0006 修訂中落差項目的跨寫入器正規化（預設屬性等價、
  色彩 hex 大小寫、命名空間前綴繫結）。
- 一份規範性的 wire format，涵蓋 ADR-0010 ／ ADR-0012 中
  宿主 API 介面以外的輸入、來源或輸出。

### 符合性基線

1.0 的符合性語料庫為標記 `spec_version: "0.1"` 之 fixture
與 1.0 切版前新增之 fixture 的聯集。整套語料庫
必須通過：

1. Stage 1 儲存格值比較。
2. 對於宣告 `comparison_stage: 2` 的 fixture，須進行 Stage 2
   正規 OOXML 比較。
3. 在至少三個時區（`UTC`、`America/New_York`、
   `Asia/Seoul`）下執行 Stage 1——參考儲存庫的 CI
   workflow 會跑這組矩陣；移植版 **應**（**SHOULD**）也比照辦理。

宣稱符合 1.0 的實作 **必須**（**MUST**）回報其在此語料庫上
的符合性執行結果，且 **不得**（**MUST NOT**）跳過任何 fixture，
除非該 fixture 所宣告的比較階段高於該執行器所支援的階段。

## 核心 vs. 擴充

規格區分：

- **核心**——符合性所要求的語言特性。在 [`README.md`](./README.md) 摘要，並由 [`language.md`](./language.md) 與 [`evaluation.md`](./evaluation.md) 正式定義。此處的破壞性變更會觸發規格版本事件。
- **擴充**——實作特定或領域特定的擴充。各實作之間 **可能**（**MAY**）不同。記錄於實作各自的 README，而非規格中。

實作 **可以**（**MAY**）加入擴充，但 **不得**（**MUST NOT**）默默改變核心語意。

例如，實作可以支援 XTL 0.1 核心表格以外的 `TEXT()` 格式。這類格式
屬於擴充：可移植的範本不應依賴它們，符合性 fixture 也不要求對它們
產出完全相同的輸出。

## 符合性語料庫版本控管

符合性語料庫版本與規格版本一同前進。於規格 0.3 新增的 fixture 會
被標示為對應版本；實作則宣告自己通過哪些 fixture，從而宣告自己
符合到哪一個規格版本。

## 棄用政策（1.0 之後）

當某項特性將在未來主要版本中移除時：

1. 該特性 **應**（**SHOULD**）在規格內被標示為 **deprecated**，
   並維持至少一個次要版本後才得移除。
2. 使用該棄用特性的符合性 fixture 會加上 `deprecated` 標籤。
3. 鼓勵實作在使用該棄用特性時發出警告。
4. 移除動作會落在下一個主要版本（例如 1.3 棄用 → 2.0 移除）。
