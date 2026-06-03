# 規格導覽索引

提供給移植者與審閱者使用的交叉參考表。每一列都把
語言／評估的章節，連結到定義它的 ADR 以及驗證它的
符合性 fixture。當你想回答「關於 X 的具有約束力的條文在哪裡？」
而不想用 grep 翻找時，請查閱本表。

fixture 欄只列出編號最小的 fixture；完整的 ADR ↔ fixture
對照矩陣請見 [`coverage.md`](/zh-TW/conformance/coverage)。

| 介面 | 規格章節 | 主管 ADR | 範例 fixture |
|---|---|---|---|
| 範本區塊 `{{ ... }}` | language.md "Template Blocks" | — | 001 |
| 來源欄 `[Col]` | language.md "Source Columns" | — | 001, 002 |
| 帶來源前綴的方括號 `Source[Col]` | language.md "Source Columns"；evaluation.md "External Data Sources" | ADR-0012 | 069, 070, 071 |
| 字面值（字串／數字／布林） | language.md "Literals" | — | 011, 012 |
| 運算子（`=`、`!=`、`>`、`<`、`>=`、`<=`、`+`、`-`、`*`、`/`、`&`） | language.md "Operators" | ADR-0009 | 058, 059, 061 |
| 比較演算法 | language.md "Comparison Algorithm" | ADR-0009、ADR-0017 | 059–064, 087, 088 |
| 正規字串形式 | language.md "Canonical String Form" | ADR-0009、ADR-0017 | 061–063, 087 |
| `IF()` | language.md "IF" | ADR-0008 | 055–058 |
| `IFEMPTY()` | language.md "IFEMPTY" | ADR-0007 | 050, 051 |
| `XLOOKUP()` | language.md "XLOOKUP" | ADR-0013 | 074–078 |
| 彙總函式（`SUM`／`COUNT`／`AVERAGE`／`MIN`／`MAX`） | language.md "Aggregates" | ADR-0007、ADR-0012 | 052, 070, 091 |
| `ROUND()` ／ `ABS()` | language.md "Numeric Functions" | — | 005, 016 |
| `TEXT()` | language.md "Text Formatting" | — | 011, 012, 016 |
| `ROW()` | language.md "Row and Date Functions" | — | 037 |
| `TODAY()` | language.md "Row and Date Functions" | ADR-0001 | 023 |
| `@filter` | language.md "Filter" | ADR-0007（成員性）、ADR-0009（比較） | 003, 035, 054 |
| `@sort` | language.md "Sort" | ADR-0009、ADR-0016 | 036, 083, 084 |
| `@top` | language.md "Top" | — | 036 |
| `@repeat right` | language.md "Repeat Right" | — | 004 |
| `@source` | language.md "Source"；evaluation.md "External Data Sources" | ADR-0012 | 071, 072 |
| `@join` | language.md "Join"；evaluation.md "External Data Sources" | ADR-0014 | 079–082 |
| 群組鍵 | language.md "Group Keys" | ADR-0016 | 015, 085, 086 |
| 空值 | evaluation.md "Empty Values" | ADR-0007 | 050–054 |
| 真假性（truthiness） | evaluation.md（交叉參考） | ADR-0008 | 055–058 |
| 保留工作表（dunder） | evaluation.md "Reserved Sheets" | ADR-0011 | 094 |
| `__config__` | evaluation.md "Template Configuration" | ADR-0011 | 多數 |
| `__inputs__` | evaluation.md "Inputs" | ADR-0010、ADR-0011 | 065–068 |
| `__sources__` | evaluation.md "External Data Sources" | ADR-0011、ADR-0012 | 069–073 |
| `__lists__` | evaluation.md "List Sheets" | ADR-0007、ADR-0011 | 053, 054 |
| 來源值模型 | evaluation.md "Source Value Model" | ADR-0017 | 087–090 |
| 來源資料模型（零列、表頭讀取） | evaluation.md "Source Data Model" | — | 028–031 |
| 儲存格文字擷取 | evaluation.md "Cell Text Extraction" | — | 013, 014 |
| 單一運算式儲存格／numFmt 強制轉型 | evaluation.md "Single-Expression Cells" | ADR-0003 | 008–010 |
| 輸出檔名 | evaluation.md "Output Filenames" | ADR-0002 | 006, 007, 019, 020 |
| 錯誤（目錄） | evaluation.md "Errors" | ADR-0015 | 017–022, 067, 072–082, 091 |
| 資源上限 | evaluation.md "Resource Limits" | — | （由實作自訂；無 fixture） |
| 渲染階段 | evaluation.md "Render Phases" | — | 002 |
| 排序 | evaluation.md "Ordering" | ADR-0016 | 083–086 |
| Stage 2 OOXML 正規化 | conformance/runner-protocol.md "Stage 2" | ADR-0006 | 024–027, 093 |
| 動態符合性斷言 | conformance/runner-protocol.md "Dynamic" | ADR-0005 | 023 |
| Excel 版本相容性 | （資訊性） | ADR-0022 | （無 fixture；屬編寫指引） |
| 運算子強制轉型 + Excel 預設原則 | language.md "Arithmetic" | ADR-0023 | 100, 101 |
| 函式引數個數（規範性表格） | language.md "Functions" 引數個數表 | ADR-0024 | 102, 103 |
| 除以零 → `#DIV/0!` 錯誤儲存格 | language.md "Arithmetic" | ADR-0025 | 106 |
| 多個 `@filter` 以 AND 組合 | language.md "Filter" | （無 ADR；規格條文） | 104 |
| `{{ }}` 內空白無意義 | language.md "Template Blocks" | （無 ADR；規格條文） | 105 |
| 空值生命週期（儲存格 + 群組鍵） | evaluation.md "Source Data Model" + "Output Filenames" | ADR-0026 | 107, 108 |
| 保留欄名 + 指令驗證 | evaluation.md "Source Data Model" + "Directives" | ADR-0027 | 109, 110, 111 |
| 字面值語法限制（字串 + 數字） | language.md "Literals" | ADR-0028 | 112, 113 |
| 指令組合 + 來源邊界語意 | evaluation.md "External Data Sources" + "Source Data Model" | ADR-0029 | 114, 115, 116, 117 |
| Unicode 正規化（不套用） | language.md "Comparison Algorithm" | ADR-0030 | 118 |
| 輸出檔名衝突視為錯誤 | evaluation.md "Output Filenames" | ADR-0031 | 119 |
| 邊角上限與活頁簿原樣透通 | evaluation.md "Source Data Model" + "Cell Evaluation" | ADR-0032 | 120 |

## 由實作自訂的邊界

XTL 0.1 刻意把這些範圍留給實作決定。兩個移植版在這裡選擇不同，
並 **不會** 讓任何一邊變得不符合規格。完整目錄請見
[ADR-0021](/zh-TW/spec/decisions/0021-implementation-defined-boundaries)。

| 範圍 | XTL 0.1 的立場 |
|---|---|
| 記憶體／串流模型 | 由實作自訂 |
| 同步 vs. 非同步 API 形式 | 由實作自訂 |
| 來源中的原生 Excel 公式 | 必須：讀取快取結果，若缺失則回報錯誤 |
| 範本中的原生 Excel 公式 | 由實作自訂（通常原樣透通） |
| 核心表格以外的 `TEXT()` 格式 | 由實作自訂的擴充 |
| 列展開時的合併儲存格保留 | 必須（資料區塊上下方）；資料區塊內部由實作自訂 |
| `__config__` 作者自訂的鍵 | 必須：可透過 `{{ __config__[key] }}` 存取 |
| 空來源（零列） | 輸出由實作自訂，不視為錯誤 |
| 名稱清理後的工作表名稱衝突 | 由實作自訂 |
| 空的範本區塊 `{{   }}` | 錯誤 |
| 輸入活頁簿中非範本、非保留的工作表 | 由實作自訂（通常原樣透通） |

## 延後處理的介面

下列項目 **不在** 1.0 範圍內。延後 ADR 解釋了原因，
以及未來規格在加入這些介面之前 **必須**（**MUST**）先處理的事項。

| 介面 | 狀態 | 延後 ADR |
|---|---|---|
| 日期運算（`EOMONTH`、`EDATE`、`DATEDIF`…） | 延後 | ADR-0019 |
| 區域感知的字串排序 | 延後 | ADR-0020 |
| 多個 `@join`、左外部合併、多列相符合併 | 延後 | ADR-0014（範圍外章節） |
| XLOOKUP 萬用字元／近似比對／反向查找 | 延後 | ADR-0013（範圍外章節） |
| 跨寫入器的 Stage 2 落差（預設屬性、色彩 hex 大小寫、命名空間前綴） | 延後 | ADR-0006 修訂 |
