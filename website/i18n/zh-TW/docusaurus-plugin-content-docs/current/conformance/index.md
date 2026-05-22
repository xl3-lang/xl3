# XTL 符合性套件

此目錄存放 **符合性語料庫**——也就是任何 XTL 實作要主張符合性時都必須通過的測試案例（fixture）集合。語料庫是 XTL 行為的可執行定義。

## 目錄結構

```
conformance/
├── README.md            ← 本檔案
├── AUTHORING.md         ← 如何新增 fixture（避開「以 JS 為真」的陷阱）
├── runner-protocol.md   ← 實作端應如何執行整套套件
└── fixtures/
    └── <NNN>-<slug>/
        ├── template.xlsx
        ├── data.xlsx
        ├── expected.xlsx        ← 正規的預期輸出（單檔案情境）
        ├── expected/            ← 或是一整個目錄的檔案（多檔案或零輸出情境）
        │   └── *.xlsx
        ├── no expected output   ← 給 expected_error fixture 使用
        ├── no static expected   ← 給 expected_dynamic fixture 使用
        └── meta.yaml            ← 描述、規格章節參照、標籤
```

## 「通過」的定義

對於靜態輸出的 fixture：當實作在輸入 `template.xlsx` 與 `data.xlsx` 後，所產生的輸出與 `expected.xlsx`（或 `expected/` 目錄的內容）一致時，即視為通過。階段 1 執行器 **MAY** 比對較高層的工作表/儲存格值。階段 2 執行器則在對 OOXML zip 進行 **正規化（canonical normalization）** 後，比對位元組層級等價的活頁簿內容：

- zip 內的檔案依名稱排序
- XML 以決定性的正規形式序列化
- 文字 run 之間的空白被保留
- 產生器中繼資料被剝除（creator、modifiedBy、lastModified）

關於比對階段與正規化規則，請見 [`runner-protocol.md`](./runner-protocol.md)。

對於錯誤 fixture：當實作回報的錯誤訊息包含該 fixture 的 `expected_error` 文字時，即視為通過。錯誤 fixture 不包含 `expected.xlsx`，也沒有 `expected/` 目錄。

對於動態 fixture：當實作的輸出符合 `meta.yaml` 中 `expected_dynamic` 所宣告的動態斷言時，即視為通過。動態 fixture 不包含 `expected.xlsx`，也沒有 `expected/` 目錄。

## 版本管理

每個 fixture 目錄的 `meta.yaml` 都會宣告其所需的最低規格版本（`spec_version: 0.1`）。實作會回報自己對齊的規格版本，套件再依此篩選 fixture。

靜態輸出 fixture **MAY** 另外宣告 `comparison_stage`。該欄位預設為 `1`；需要正規 OOXML 比對的 fixture 則宣告 `comparison_stage: 2`。

## Fixture 中繼資料

語料庫使用的 `meta.yaml` 欄位如下：

| 欄位 | 必填 | 適用對象 | 意義 |
|---|---:|---|---|
| `description` | 是 | 全部 fixture | fixture 所宣告的一行式契約。 |
| `spec_section` | 是 | 全部 fixture | 定義此行為的規格或 ADR 章節。 |
| `spec_version` | 是 | 全部 fixture | 此 fixture 所要求的最低 XTL 版本。 |
| `tags` | 是 | 全部 fixture | 用於報告與聚焦執行的可篩選分類。 |
| `verified_by` | 否 | 全部 fixture | 獨立的撰寫驗證方式，例如 `hand` 或 `manual-script`。 |
| `expected_warnings` | 否 | 全部 fixture | 實作應發出的穩定警告子字串。 |
| `expected_error` | 否 | 錯誤 fixture | 穩定的錯誤子字串；省略靜態預期輸出。 |
| `expected_dynamic` | 否 | 動態 fixture | 動態斷言種類；目前為 `utc_today`。 |
| `dynamic_cells` | 與 `expected_dynamic` 同列 | 動態 fixture | 由執行器計算的工作表/儲存格/格式斷言。 |
| `comparison_stage` | 否 | 靜態輸出 fixture | 最低比對階段；預設為 `1`，OOXML 敏感檢查請設為 `2`。 |
| `skip_reason` | 否 | 全部 fixture | 暫時略過已知失效 fixture 的原因。 |

`expected_error` 與 `expected_dynamic` 互斥。靜態輸出 fixture 使用 `expected.xlsx` 或 `expected/`；空的 `expected/` 目錄代表零個輸出檔。錯誤 fixture 與動態 fixture 均省略靜態預期輸出。

## Fixture 目錄

XTL 0.1 啟動版語料庫目前包含下列 fixture：

| ID | Fixture | 契約 |
|---|---|---|
| 001 | `bracket-substitution` | 單一中括號的來源欄位運算式，會為每一筆來源資料列輸出一列。 |
| 002 | `if-function` | `IF(condition, then, else)` 會在目前資料列內評估比較運算。 |
| 003 | `list-sheet-filter` | `@filter [field] in _ListSheet` 保留符合的列，並從輸出移除清單工作表。 |
| 004 | `repeat-right-default` | `@repeat right` 未明示數量時，預設 `colSpan = 1`。 |
| 005 | `round-half-away-from-zero` | `ROUND()` 採用 Excel 風格的「四捨五入遠離零」規則。 |
| 006 | `filename-forbidden-chars` | 禁用的檔名字元會被替換為 `_`。 |
| 007 | `filename-reserved-name` | Windows 保留裝置基底檔名會加上單一結尾 `_`。 |
| 008 | `numfmt-numeric-string-coercion` | 數值範本格式會將數值型字串強制轉換為數字。 |
| 009 | `numfmt-date-string-coercion` | 日期範本格式會將類日期字串強制轉換為日期值。 |
| 010 | `numfmt-text-format-coercion` | 文字格式 `@` 會將單一運算式值強制轉換為字串。 |
| 011 | `text-date-format` | `TEXT(date, "YYYY-MM-DD")` 以 XTL 日期記號回傳字串。 |
| 012 | `text-number-format` | `TEXT(number, format)` 支援 XTL 0.1 數值格式的最小子集。 |
| 013 | `rich-text-template-expression` | 富文字範本儲存格在運算式偵測前，會先把各 text run 串接起來解析。 |
| 014 | `source-formula-cached-result` | 來源公式儲存格使用快取結果，XTL 不會重新計算。 |
| 015 | `source-sheet-prefix-first-match` | `source_sheet` 前綴樣式會選擇活頁簿順序中第一個符合的工作表。 |
| 016 | `text-number-negative-rounding` | 數值 `TEXT()` 格式對負數 `.5` 邊界採用「四捨五入遠離零」。 |
| 017 | `source-sheet-prefix-no-match-error` | 找不到符合的 `source_sheet` 前綴時，回報穩定錯誤。 |
| 018 | `source-formula-missing-cached-result-error` | 來源公式儲存格若沒有快取結果，回報穩定錯誤。 |
| 019 | `filename-empty-basename-error` | 檔名清理會對空白基底檔名回報錯誤。 |
| 020 | `filename-length-overflow-error` | 檔名清理會對超過 255 位元組限制者回報錯誤。 |
| 021 | `numfmt-number-coercion-error` | 數值範本格式於強制轉換失敗時回報錯誤。 |
| 022 | `numfmt-date-coercion-error` | 日期範本格式於強制轉換失敗時回報錯誤。 |
| 023 | `today-utc-dynamic` | `TODAY()` 透過動態斷言渲染執行器啟動當下的 UTC 日期。 |
| 024 | `stage2-merge-preservation` | 階段 2 比對驗證資料展開區塊下方的合併範圍被保留。 |
| 025 | `stage2-style-numfmt-preservation` | 階段 2 比對驗證渲染儲存格保留範本的樣式與 numFmt。 |
| 026 | `stage2-splice-merge-style-preservation` | 階段 2 比對驗證列展開後，位移的合併與帶樣式/數值格式的渲染儲存格皆被保留。 |
| 027 | `stage2-cross-writer-canonicalization` | 階段 2 比對驗證已知的 OOXML 書寫器差異，能正規化為相同的活頁簿內容。 |
| 028 | `source-table-row-shorthand` | `source_table = N` 選擇第 `N` 列作為來源欄名，並從其下方讀取資料。 |
| 029 | `source-table-open-range` | `source_table = B3:D` 選擇欄區間，並向下讀至所用列尾。 |
| 030 | `source-table-finite-range` | `source_table = B3:D4` 在宣告的結束列就停止讀取。 |
| 031 | `source-table-zero-data-range` | `source_table = B3:D3` 有效，會產生零個來源資料列。 |
| 032 | `source-table-empty-column-name-error` | 所選範圍內若出現空白來源欄名，回報穩定錯誤。 |
| 033 | `source-table-duplicate-column-name-error` | 重複的來源欄名回報穩定錯誤。 |
| 034 | `source-table-invalid-selector-error` | 像是第零列這類無效選擇器，回報穩定錯誤。 |
| 035 | `source-table-rich-text-header` | 富文字的來源欄名儲存格會先串接，再進行 source_table 解析。 |
| 036 | `source-table-formula-header` | 公式型來源欄名儲存格使用快取結果。 |
| 037 | `source-table-formula-header-missing-cache-error` | 沒有快取結果的公式型來源欄名儲存格，回報穩定錯誤。 |
| 038 | `source-sheet-exact-match-beats-prefix` | `source_sheet` 完全相符優先於前綴樣式。 |
| 039 | `source-sheet-default-first-worksheet` | 若省略 `source_sheet`，採用活頁簿順序中的第一個工作表。 |
| 040 | `list-sheet-hidden-states-removed` | 隱藏與深度隱藏的清單工作表，依然會從輸出活頁簿中移除。 |
| 041 | `row-function-inside-repeat-block` | `ROW()` 在 repeat 區塊內回傳目前渲染資料列的 1-起始索引。 |
| 042 | `row-function-outside-repeat-block-error` | 在 repeat 區塊外呼叫 `ROW()` 會回報穩定錯誤。 |
| 043 | `ifempty-function` | `IFEMPTY()` 對空值回傳替代值，對非空值原樣放行。 |
| 044 | `sort-and-top-order` | `@sort` 先於 `@top` 執行，因此前 N 列來自已排序的集合。 |
| 045 | `list-sheet-not-in-filter` | `@filter ... !in _Sheet` 保留值不在清單工作表中的列，並從輸出移除該清單工作表。 |
| 046 | `count-field-non-empty` | `COUNT([field])` 對目前的列集合計算非空值。 |
| 047 | `aggregate-functions` | 核心彙總函式作用於目前渲染的列集合。 |
| 048 | `if-and-comparison-boundaries` | 比較運算子驅動 `IF()` 與 `@filter` 在零邊界附近的行為。 |
| 049 | `filename-sanitization-warning` | 對已渲染檔名進行清理時，會發出警告但不改變輸出語意。 |
| 050 | `empty-ifempty-whitespace-only` | 依 ADR-0007，IFEMPTY 將純空白字串視為空值。 |
| 051 | `empty-ifempty-zero-not-empty` | 依 ADR-0007，IFEMPTY 保留數字 0；數字永遠不是空值。 |
| 052 | `empty-count-field-whitespace-zero-false` | 依 ADR-0007，COUNT([field]) 計算非空值——空白為空，0 與 FALSE 視為非空。 |
| 053 | `empty-row-skip-whitespace-only` | 依 ADR-0007，所有儲存格皆為空的來源列被跳過，包含純空白儲存格。 |
| 054 | `empty-list-membership` | 清單工作表讀取時會丟棄空白項目；依 ADR-0007，空白來源值永遠不會符合 `@filter ... in _Sheet`。 |
| 055 | `if-truthy-zero-and-empty` | 依 ADR-0008，IF 將 0 與空值視為假；非零數字、非空字串與 TRUE 視為真。 |
| 056 | `if-truthy-string-zero-not-special` | `IF("0", …)` 與 `IF("false", …)` 走真值分支——對於字串型旗標沒有特例。 |
| 057 | `if-truthy-boolean` | 依 ADR-0008，布林型來源儲存格直接驅動 IF 的真值判斷。 |
| 058 | `if-comparison-result` | 依 ADR-0008，比較運算式的布林結果直接驅動 IF 的真值判斷。 |
| 059 | `compare-numeric-string-vs-number` | 依 ADR-0009，比較時會在共用的 `compareValues` 下解析數字與數值字串。 |
| 060 | `compare-string-codepoint-order` | 依 ADR-0009，字串退回比較採 Unicode 碼點順序——不做語系感知排序。 |
| 061 | `concat-canonical-form` | 依 ADR-0009，`&` 將運算元以正規字串形式字串化（布林大寫、整數不帶小數）。 |
| 062 | `concat-empty-stringifies-to-empty` | 依 ADR-0009，`&` 對空運算元貢獻空字串。 |
| 063 | `compare-empty-vs-value` | 依 ADR-0009 規則 1 與 2，兩個空運算元視為相等；其中一個為空時 `=` 為假。 |
| 064 | `compare-unicode-minus-not-numeric` | 含 Unicode 減號（U+2212）的字串不會被解析為數字；依 ADR-0009 落到正規字串退回比較。 |
| 065 | `input-text-default-applied` | 當宿主省略值時，`_inputs` 文字輸入的預設值會填入（ADR-0010）。 |
| 066 | `input-text-host-supplied` | 宿主提供的輸入值會流入儲存格、工作表名稱與輸出檔名樣式（ADR-0010）。 |
| 067 | `input-missing-required-error` | 必填的 `_inputs` 宣告（無預設值）若宿主省略，視為錯誤（ADR-0010）。 |
| 068 | `input-select-host-supplied` | `select` 輸入接受位於宣告管線分隔選項中的宿主值（ADR-0010）。 |
| 069 | `source-multi-declaration` | 依 ADR-0012，`__sources__` 工作表宣告額外的具名來源；對其的彙總會作用在其完整列集合上。 |
| 070 | `source-aggregate-cross-source` | 依 ADR-0012，對具名來源的 COUNT/MIN/MAX 作用在其完整列集合上。 |
| 071 | `source-directive-active` | 依 ADR-0012，`@source SourceName` 為資料區塊定範圍；其內 `[Column]` 解析至該來源。 |
| 072 | `source-undeclared-error` | 依 ADR-0012，`@source` 參照未在 `__sources__` 宣告的來源是解析期錯誤。 |
| 073 | `source-row-cross-error` | 依 ADR-0012，列層級參照非作用中來源的欄位是錯誤。 |
| 074 | `xlookup-basic` | 依 ADR-0013，3-參數 XLOOKUP 對第一個 lookup-array 相符的列，回傳其 return-array 欄。 |
| 075 | `xlookup-fallback` | 依 ADR-0013，4-參數 XLOOKUP 在無相符列時回傳退回值。 |
| 076 | `xlookup-no-match-error` | 依 ADR-0013，無退回值的 3-參數 XLOOKUP 找不到相符列時回報錯誤。 |
| 077 | `xlookup-source-mismatch-error` | 依 ADR-0013，XLOOKUP 第 2 與第 3 個引數必須參照同一個來源。 |
| 078 | `xlookup-bare-bracket-error` | 依 ADR-0013，XLOOKUP 的第 2 / 第 3 個引數需為帶來源前綴的中括號參照。 |
| 079 | `join-basic-inner` | 依 ADR-0014，`@join` 將每筆主要列與第一個相符的被聯結列配對。 |
| 080 | `join-no-match-dropped` | 依 ADR-0014，`@join` 採內部聯結語意——沒有相符的主要列會被丟棄。 |
| 081 | `join-undeclared-source-error` | 依 ADR-0014，`@join` 參照未在 `__sources__` 宣告的來源是解析期錯誤。 |
| 082 | `join-bad-on-clause-error` | 依 ADR-0014，`@join` 的 on 子句須同時參照被聯結來源與該區塊的主要來源。 |
| 083 | `sort-stable-equal-keys` | 依 ADR-0016，`@sort` 是穩定的——鍵值相同的列保留來源順序。 |
| 084 | `sort-multi-stable-priority` | 依 ADR-0016，多個 `@sort` 指示子套用時，首個為主鍵，後續作為次序鍵。 |
| 085 | `file-group-first-seen-order` | 依 ADR-0016，檔案群組依來源列的首次出現順序輸出。 |
| 086 | `sheet-group-first-seen-order` | 依 ADR-0016，檔案內的工作表群組依首次出現順序輸出。 |
| 087 | `date-canonical-string-concat` | 依 ADR-0017，日期在 `&` 中產生 YYYY-MM-DD（午夜）或 YYYY-MM-DDTHH:mm:ss。 |
| 088 | `date-comparison-equality` | 依 ADR-0017，日期值透過正規字串形式與字串篩選值比較。 |
| 089 | `error-sentinel-empty` | 依 ADR-0017，Excel 錯誤儲存格（`#N/A`、`#VALUE!`、…）讀取時視為空值。 |
| 090 | `percentage-numeric-flow` | 依 ADR-0017，百分比格式儲存格以其底層數字流動（50% → 0.5）。 |

## 狀態

XTL 0.1 語料庫處於 **啟動狀態**。新增 fixture 時，**SHOULD** 只針對已在 [`spec/README.md`](../spec/README.md) 中明文敘述的行為，沿用 CommonMark 等標準專案的相同模式：散文定義規則，fixture 把規則變得可執行，實作則回報自己通過了哪些 fixture。

參考實作不會把自己的行為視為規範。當 fixture 與實作不一致時，依 [`spec/README.md`](../spec/README.md) 中的規格優先順序，更新實作或更新 fixture。

XTL 0.1 核心行為的 fixture 會避開實作自訂的擴充，例如 [`spec/language.md`](../spec/language.md) 最低表格之外的 `TEXT()` 格式。
