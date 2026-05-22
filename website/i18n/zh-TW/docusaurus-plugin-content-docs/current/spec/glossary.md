# 詞彙表

XTL 規格文件、ADR 與符合性 fixture 中出現的術語。
若某個定義引用另一份文件中的章節，那一節才是規範性的；
本頁僅作為摘要材料。

## A

### Active source
作用中來源。資料區塊內部以裸方括號形式（`[Column]`）參考的
欄位所解析的具名來源。由 `@source` 指令設定，或在缺少該指令時，
由 `__config__` 中宣告的 `source_sheet` 預設來源接手。
（見 ADR-0012、evaluation.md "External Data Sources"。）

### Aggregate function
彙總函式。引數是欄參考、結果是跨多列的單一純量的函式：
`SUM`、`AVERAGE`、`AVG`、`MIN`、`MAX`、`COUNT`。帶來源前綴的
彙總（`SUM(Source[col])`）作用於該來源的完整列集合；裸彙總
（`SUM([col])`）則作用於作用中區塊已篩選的列。
（見 ADR-0012、language.md "Aggregates"。）

## B

### Block
區塊。見 *data block*（資料區塊）。

### Bracket field
方括號欄位。形如 `[Column]` 的欄參考。在資料區塊內，解析為
作用中來源目前列的對應欄位。在資料區塊之外使用則屬於語法錯誤。
（見 language.md "Source Columns"。）

## C

### Canonical string form
正規字串形式。用於 `&` 串接、清單成員性檢查，以及比較
演算法字串後備的值之決定性字串表示。空 → `""`；布林 → `TRUE`／`FALSE`
（大寫）；有限數字 → ECMAScript 最短可往返形式；
字串 → 自身；日期 → `YYYY-MM-DD` 或 `YYYY-MM-DDTHH:mm:ss`（UTC）。
（見 ADR-0009、ADR-0017、language.md "Canonical String Form"。）

### Conformance corpus
符合性語料庫。位於 `conformance/fixtures/` 下的 fixture
目錄集合，每個目錄包含 `template.xlsx`、`data.xlsx`、
可選的 `expected.xlsx`，以及 `meta.yaml`。語料庫就是可執行的
契約：規格文字若與通過的 fixture 抵觸，文字失效。
（見 conformance/runner-protocol.md。）

## D

### Data block
資料區塊。範本工作表中一段連續的列範圍，會在渲染階段為每一筆
相符的來源列展開一次。渲染器透過尋找含有裸 `[Column]` 參考的
儲存格來偵測這類區塊；範圍可由 `@source`、`@filter`、`@sort`、
`@top`、`@repeat right` 與 `@join` 等指令調整。
（見 evaluation.md "Render Phases"。）

### Default source
預設來源。從 `__config__.source_sheet` 所指向的活頁簿載入的隱含
來源。在資料區塊中若沒有 `@source` 指令，它就是作用中來源。內部
名稱：`default`。作者通常不會明寫 `@source default`。

### Directive
指令。其內容以 `@` 開頭的範本區塊。指令會修改其所在的資料區塊。
XTL 0.1 的指令集：`@filter`、`@sort`、`@top`、`@repeat right`、
`@source`、`@join`。（見 language.md "Directives"。）

### Dunder (sheet)
雙底線工作表。名稱符合 `^__[a-z]+__$` 樣式的保留工作表——也就是被
雙底線包住者。已宣告的四張雙底線工作表為 `__config__`、`__inputs__`、
`__sources__`、`__lists__`。作者自行建立、名稱符合此樣式的工作表會
在解析階段被拒絕。（見 ADR-0011。）

## E

### Empty value
空值。值為缺失（`null`／`undefined`）、空字串，或僅由 Unicode
空白字元組成的字串。數字（包含 `0`）、布林（包含 `false`）以及
日期 **永遠不會** 為空，與其值無關。
（見 ADR-0007、evaluation.md "Empty Values"。）

### Excel error sentinel
Excel 錯誤標記。值為 `#N/A`、`#VALUE!`、`#DIV/0!` 等的儲存格。
依 ADR-0017 視為空。實作 **可以**（**MAY**）在遇到時發出警告。

### Expression
運算式。`{{ ... }}` 範本區塊內的內容。可以是字面值、函式呼叫、
方括號參考、保留工作表參考，或任意以運算子串接的組合。
（正式語法見 spec/grammar.ebnf。）

## F

### File group
檔案群組。依 `__config__.output_file_pattern` 中宣告的群組鍵
切分而成的來源列群組。每個群組會產出一個 `.xlsx`。依來源
自然列順序、以首見順序排放（依 ADR-0016）。

### Filter
篩選。以判定式從資料區塊中濾除列的指令。兩種形式：
`@filter [field] op value` 與
`@filter [field] in __lists__[name]`（或 `!in`）。

## G

### Group key
群組鍵。其相異值會把來源列分組的欄。當該欄出現在
`output_file_pattern` 中，會切出檔案群組；當它出現在工作表
名稱範本中，則切出工作表群組。

## I

### Informational ADR
資訊性 ADR。狀態為 `informational` 的 ADR——屬文件、稽核或流程
材料，並不約束實作行為。（範例見 ADR-0004；狀態分類見
0000-template.md。）

### Input
輸入。在 `__inputs__` 內宣告、由宿主透過 `convert(...)` 的
`inputs` 選項提供的執行階段值。會依宣告的 `type` 進行強制轉型
（text、number、date、select）。（見 ADR-0010。）

## J

### Join
合併。`@join` 指令會把作用中來源的每一列，與第二來源中第一筆
依鍵相符的列配對。XTL 0.1 採內部合併語意，並有決定性的首筆相符
排序。（見 ADR-0014。）

## L

### List sheet
清單工作表。`__lists__` 中的欄，其值構成
`@filter ... in __lists__[name]` 的成員性集合。
（見 ADR-0011、evaluation.md "List Sheets"。）

## N

### Named source
具名來源。在 `__sources__` 中以明確名稱宣告的來源。可在任何允許
帶來源前綴方括號的地方以 `Name[Column]` 形式參考。預設來源在這
個意義上 **不算** 「具名」。

## P

### Primary source
主要來源。在 `@join` 區塊中即為作用中來源——由其列驅動迭代。
被合併進來的來源則透過 `JoinedSource[Column]` 參考提供配對欄。

## R

### Reserved sheet
保留工作表。`__config__`、`__inputs__`、`__sources__`、
`__lists__` 之一。它們的名稱與行為由 ADR-0011 定義。作者建立、
符合雙底線樣式的工作表都會被視為保留（並被拒絕），無論是否符合
這四個已宣告的名稱。保留工作表不會出現在輸出活頁簿中。

### Reserved-sheet reference
保留工作表參考。形如 `__sheet__[key]` 的範本運算式，會在保留
工作表的鍵值表中查找 `key`。在 `__config__`、`__inputs__`、
`__lists__` 中皆為合法；形如 `__sources__[name]` 則屬錯誤
（`xl3/sources/not-a-dictionary`），因為 `__sources__` 是宣告
工作表而非值字典。

## S

### Sheet group
工作表群組。依工作表名稱範本中的鍵切分而成的來源列群組。每個
群組會在所屬檔案中產出一個輸出工作表。依首見順序排放
（依 ADR-0016）。

### Single-expression cell
單一運算式儲存格。範本內容恰好是一個 `{{ expression }}` 而沒有
其他東西的儲存格。當該儲存格的數字格式相容時，這類儲存格會保留
來源值的型別（日期維持日期、數字維持數字）。
（見 ADR-0003、evaluation.md "Single-Expression Cells"。）

### Source
來源。引擎用來提供列資料、所讀取的工作表（或工作表 + 表格範圍）。
預設來源來自 `__config__.source_sheet`；具名來源則在 `__sources__`
中宣告。（見 ADR-0012。）

### Source-prefixed bracket
帶來源前綴的方括號。形如 `Source[Column]` 的參考，其中 `Source`
為已宣告的來源名稱。在 `@source` 區塊中解析為該來源目前列的對應欄；
在靜態情境下，則作為彙總或 `XLOOKUP` 對該來源完整列集合的輸入。
（見 ADR-0012。）

## T

### Template block
範本區塊。`{{ ... }}` 語法，用於在 Excel 儲存格值內劃出一段 XTL
運算式或指令。（見 language.md "Template Blocks"。）

### Truthy / falsy
真值／假值。值是真值，除非它是空（依 ADR-0007）、布林 `false`，
或數值 `0`。字串 `"0"` 與 `"false"` 是真值，因為它們是非空字串。
（見 ADR-0008。）

## X

### XLOOKUP
XLOOKUP 函式。在某個來源中尋找第一筆查找欄等於指定值的列，並回傳該列
中某一欄的值。基本三引數形式對齊 Excel 的簽章，並可加上選用後備值。
萬用字元、近似比對與反向查找模式不在 XTL 0.1 的範圍內。
（見 ADR-0013、language.md "XLOOKUP"。）

### XTL
Excel Template Language。由 `spec/` 所定義的語言。與實作無關；
xl3 是 TypeScript 參考實作。
