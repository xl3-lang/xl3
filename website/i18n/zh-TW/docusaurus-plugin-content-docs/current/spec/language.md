# XTL 語言

:::note
本繁體中文版本僅供閱讀輔助。規格的正典為[英文原版](https://xl3.io/spec/language)，若規範性解讀有差異，以英文為準。
:::

本文件定義 XTL 0.1 範本語言的外顯介面。此處的記法對範本作者與實作者而言皆為規範性。

`{{ ... }}` 範本區塊內容的形式文法位於
[`grammar.ebnf`](./grammar.ebnf)——為移植者與工具鏈提供的非規範性
輔助材料。術語定義位於 [`glossary.md`](./glossary.md)。

## 範本區塊

範本運算式寫在兩對大括號內：

```text
{{ expression }}
```

緊鄰 `{{` 與 `}}` 內側的空白並不重要——解析器會在正規化之前
修剪前後空白。以下幾種寫法是等價的：

```text
{{ [name] }}
{{[name]}}
{{    [name]    }}
{{
  [name]
}}
```

運算子間距內的空白（例如 `{{ [a] + [b] }}` 對比
`{{ [a]+[b] }}`）同樣不重要。字串字面值內部的空白則會
保留（`"hello world"` 中間的空白會被保留）。

範本區塊的內部內容為空（`{{ }}` 或僅含空白）會引發解析錯誤，
依 ADR-0021（`xl3/parser/empty-block`）。

範本區塊由 `{{` 開啟，並由儲存格文字順序中**第一個**後續出現的
`}}` 關閉。分隔符掃描器**不**理解字串字面值：`"..."` 字面值內
的 `}}` 會關閉區塊（ADR-0051）。需要在值中放入字面 `}}` 的作者，
應把它放進 `__config__[key]` 並透過 `{{ __config__[key] }}` 參考。
若運算式本體的 `"` 計數為奇數（不平衡的字面值，幾乎都是因為內嵌
了分隔符），會引發 `xl3/parser/unbalanced-literal`。

## 資料區塊

工作表上的 *資料區塊* 是引擎在渲染來源列時展開的矩形。它有兩個維度：

- **列範圍** `[r_start..r_end]`——連續列的最大範圍，其中每一列都包含至少一個 *資料列儲存格*（其 `{{ ... }}` 本體在彙總函式之外參考至少一個 `[Column]` 的儲存格）。兩個資料列之間若有非資料列（沒有 `[Column]` 參考）即會關閉區塊。
- **欄範圍** `[c_start..c_end]`——區塊列範圍內所有含任意 `{{ ... }}` 運算式儲存格的 bounding box，並**向外延伸穿過相鄰的非空儲存格**。緊鄰 marker 儲存格的原生 Excel 公式（`{ formula: "..." }`）或靜態值位於區塊內。被全空欄隔開的非空儲存格則位於區塊外。

矩形內的儲存格是 *block cells*。同一工作表上位於矩形外的儲存格是 *outside cells*（ADR-0066）。

**每張工作表單一區塊（0.x）。** 在 XTL 0.x 中，一張工作表最多有一個資料區塊。如果解析器偵測到兩個以上彼此斷開的 `[Column]` 資料列儲存格 cluster，會在解析階段引發 `xl3/expression/bracket-outside-block`，並指出第二個 cluster 的起始列。multi-block 支援（以明確 `@block` directive 消除邊界歧義）延後到未來 ADR。

**區塊展開語意**（渲染端；規範位於 `evaluation.md` 的 "Render Phases"）：

- block cells 會被複製到展開後的列——每 `(r_end - r_start + 1)` 個範本列對應一筆記錄。
- 列 `r < r_start` 的 outside cells 會留在原始位置（區塊上方的 header / configuration 列）。
- 列 `r >= r_start` 的 outside cells 即使 splice 為區塊展開插入列，仍保留在原始列 `r`。它們**不會**向下位移（**NOT**）。其公式文字會逐字保留。
- 位於內部欄且列 `r > r_end` 的儲存格（也就是 footer-row 情境：與資料相同欄中有 "Total" 標籤與 footer 公式）會向下位移 `(N - 1) × (r_end - r_start + 1)` 列，落在展開後的資料區塊下方。

這種不對稱——區塊下方的內部欄儲存格會位移，而同列的外部欄儲存格不位移——是刻意設計。它支援常見的「側邊彙總表」模式（在主要資料區塊右側或左側、獨立於區塊的平行報表區域），而不要求作者宣告另一張工作表。

若作者希望標籤／公式成對一起位移（例如 A4='footer'、B4=LOWER(A4)），就把兩個儲存格都放在區塊的欄範圍內。如果 marker 儲存格剛好沒有到 B（例如只有 A2 有 marker），B 就在外部，不會跟著 A 位移；解法是在 B2 加上一個 marker（即使是 `{{ "" }}` 這樣的 trivial literal expression 也可以），或在未來版本可用時使用明確的 `@block A:B` 形式。

## 來源欄

來源欄以方括號語法參考：

```text
{{ [Customer] }}
{{ [Customer Name] }}
{{ [Units Per Case] }}
```

`[` 與 `]` 之間的文字為來源欄名稱，會先修剪前後空白。欄名稱
**可以**（**MAY**）包含空白、字母、數字以及除了 `]` 與換行
以外的標點。

像 `{{ Customer }}` 這種裸名稱在儲存格中**不是**來源欄參考。
裸名稱保留給工作表與檔案群組鍵使用。

依 ADR-0054，範本區塊內的裸識別字依下列順序解析，若解析失敗
則引發 `xl3/expression/unknown-name`：

| 上下文 | 解析順序 |
|---|---|
| `output_file_pattern` | 檔案群組鍵 → `__inputs__[name]` → `__config__[name]` |
| 工作表名稱樣式 | 工作表群組鍵 → `__inputs__[name]` → `__config__[name]` |
| 資料儲存格 | 外層檔案群組鍵 → 外層工作表群組鍵 → `__inputs__[name]` → `__config__[name]`（布林字面值 `TRUE`／`FALSE` 仍會先以字面值身份解析，再進入此鏈） |

資料儲存格中的裸識別字**不會**解析為來源欄；作者**必須**（**MUST**）
明確使用 `[Column]` 形式來參考欄位。資料儲存格中的簡寫解析鏈
之所以存在，是為了讓 `{{ Region }}` 在 `output_file_pattern`
為 `{{ [Region] }}.xlsx` 的工作表中能讀到目前作用群組的值。

## 字面值

XTL 0.1 支援：

```text
"text"
123
123.45
-123
```

### 字串字面值（依 ADR-0028）

由一對相符的 `"` 包夾。**沒有跳脫序列**——反斜線會原樣傳遞；
在 0.x 中沒有規範的方式可以在字串字面值內嵌入 `"`。需要在
值中放入 `"` 的作者，應把它放進 `__config__` 作者鍵
（儲存格內容可以是任意字元），並透過 `{{ __config__[key] }}` 參考。

不平衡或重複的引號（`"a"b"`、`"a` 等）屬於實作定義；可攜的
範本對每個字面值都精確使用一對相符的引號。

### 數字字面值（依 ADR-0028）

十進位數字，前面可選擇加上 `-` 表示負號。允許的形式：
`5`、`-5`、`3.14`、`-3.14`、`0`。Unicode 減號 `U+2212` **不會**
被視為正負號（依 ADR-0009 修訂）。

**XTL 0.x 不支援對非字面值運算式套用一元運算子。** 下列各式
皆會引發 `xl3/eval/unsupported-syntax`：

- `+5`、`+[col]`（一元加號）
- `--5`、`-(0 - 5)`（雙重負號）
- `-[col]`、`-(expr)`、`-__config__[k]`（套在非字面值上的
  一元減號）

欄位取負的解法：寫成 `(0 - [col])` 或 `[col] * -1`。

## 運算子

### 算術——`+`、`-`、`*`、`/`

兩個運算元都**必須**（**MUST**）強制轉型為有限數字。強制轉型
規則依 ADR-0023：

| 運算元型別 | 轉型後的值 |
|---|---|
| 數字（有限） | 自身 |
| 布林 | 1（TRUE）／ 0（FALSE） |
| 空值（依 [空值](./evaluation.md#empty-values)） | 0 |
| 可解析為有限數字的字串 | 解析後的數字 |
| 無法解析為數字的字串 | 錯誤 `xl3/eval/operand-coercion` |
| 日期 | 錯誤 |
| 其他任何型別 | 錯誤 |

字串解析依 ADR-0009 與 ADR-0023：先 trim、再以 `Number()` 解析
（不能產生 `NaN`）。逗號視為千位分隔符（`"1,234"` 解析為 `1234`）；
字面值不支援科學記號；不允許前導 `+`。Unicode 減號 `U+2212` 不是
正負號字元（依 ADR-0009 修訂）。

依 ADR-0064，字串→數字的強制轉型（與字面值解析有別）接受下列形式：

| 形式 | 接受？ | 範例 |
|---|---|---|
| 十進位整數 | 是 | `"42"`、`"-42"` |
| 十進位小數 | 是 | `"3.14"`、`"-3.14"` |
| 千位分隔符 | 是 | `"1,234"`、`"-1,234.56"` |
| 科學記號 | 是 | `"1e5"`、`"-1.5e-3"`、`"1.5E10"` |
| 十六進位前綴 `0x`／`0X` | 否——錯誤 `xl3/eval/operand-coercion` | `"0x10"` |
| 二進位前綴 `0b`／`0B` | 否 | `"0b101"` |
| 八進位前綴 `0o`／`0O` | 否 | `"0o17"` |
| 前導 `+` | 否 | `"+5"` |
| Unicode 減號 `U+2212` 前綴 | 否 | `"−5"` |
| 產生 `±Infinity` | 否 | `"Infinity"`、IEEE 754 溢位 |
| 尾端帶非數字字元 | 否 | `"5px"`、`"5 abc"` |
| 多行字串 | 否 | 內含 LF 的字串 |

字面值解析（嚴格）與字串強制轉型（寬鬆）兩者的不對稱性是
刻意設計：字面值由作者編寫，而被強制轉型的字串來自資料
（CSV 匯出、財務系統），其中科學記號或十六進位記號自然會出現。

```text
{{ [price] * [quantity] }}
{{ [total] / 10 }}
{{ [a] + [b] }}
{{ [a] - [b] }}
```

範例：

| 運算式 | 結果 |
|---|---|
| `1 + 2` | 3 |
| `"10" + 5` | 15 |
| `"1,234" + 1` | 1235 |
| `TRUE + 1` | 2 |
| `[empty-cell] + 5` | 5 |
| `"abc" + 5` | 錯誤 |

除以零會產生 Excel 的 `#DIV/0!` 錯誤儲存格（依 ADR-0025）。
單一運算式且數字格式的儲存格會渲染為值為 `#DIV/0!` 的真實
Excel 錯誤儲存格；在文字格式儲存格、混合文字儲存格，或 `&`
串接內，則會在該位置代入字串 `"#DIV/0!"`。若該錯誤值流入
同一儲存格運算式中的後續算術運算（例如 `(1/0) + 5`），它
無法強制轉型為有限數字，並依上表引發
`xl3/eval/operand-coercion`。

六種**來源端**的 Excel 錯誤標記——`#N/A`、`#VALUE!`、`#REF!`、
`#NAME?`、`#NUM!`、`#NULL!`——從來源讀取時依 ADR-0017 視為空值。
依 ADR-0053，它們在混合文字與 `&` 串接位置貢獻 `""`，且在
單一運算式且採用數字／日期格式的儲存格中引發
`xl3/cell/numfmt-coercion`。`#DIV/0!` 是引擎本身在 XTL 求值
過程中唯一會產生的標記；它遵循上述規則。若作者想為來源端
標記顯示一個明顯的「缺失」標示，可用
`IFEMPTY([col], "missing")` 包住欄參考。

### 字串串接——`&`

每個運算元會透過正規字串形式（見
[比較與字串強制轉型](#comparison-and-string-coercion)）轉成字串，
再依序串接結果。`&` 永遠成功；不會發生型別錯誤。

```text
{{ [item] & " (" & [size] & ")" }}
```

### 比較——`=`、`!=`、`>`、`<`、`>=`、`<=`

用於 `IF()` 與 `@filter`。遵循
[比較與字串強制轉型](#comparison-and-string-coercion) 中的演算法。
混合型別會退化為正規字串形式的碼點順序比較；不會發生強制轉型錯誤。

```text
=
!=
>
<
>=
<=
```

## 比較與字串強制轉型

比較運算子（`=`、`!=`、`>`、`<`、`>=`、`<=`）與 `&` 串接
運算子共用同一套強制轉型模型。`IF()` 的條件與 `@filter` 指令
都使用此處定義的比較演算法。`@sort` 亦使用同樣的演算法。

### 正規字串形式

值的正規字串形式為：

- 空值（依 [空值](./evaluation.md#empty-values)）為空字串 `""`。
- 布林：`TRUE` 或 `FALSE`（大寫）。
- 有限數字：能唯一識別該值的最短十進位表示法，以 `.` 作為
  小數點，且在 `[1e-6, 1e21)` 範圍內的量級不使用科學記號。
  整數會省略結尾的小數點。對應 ECMA-262 §6.1.6.1.13。
- 字串：字串本身。
- 日期：當時間部分恰為午夜（`00:00:00`）時為 `YYYY-MM-DD`；
  否則為 `YYYY-MM-DDTHH:mm:ss`。（由 ADR-0017 定義；先前
  在 ADR-0009 中延後處理。）

  日期欄位**必須**（**MUST**）以 UTC 讀取。Excel 儲存格儲存
  的是不帶時區資訊的序列日期，而 ExcelJS 等程式庫會將其
  以 UTC 為基準的 `Date` 物件回傳；使用本地時區存取器
  （`getFullYear`、`getMonth`、`getDate`）會在任何非 UTC 主機
  上導致差一日的飄移。需要帶時區資訊的日期（例如「首爾的今天」
  這類檔名 token）的宿主，應在渲染器之外計算後，透過
  `__inputs__` 或 `__config__` 傳入。

非有限數字（`NaN`、`Infinity`、`-Infinity`）**不應該**（**MUST NOT**）
由符合規格的運算產生。若真的出現，則轉成字串為 `""`。

### 比較演算法

比較運算子依序套用：

1. 若兩個運算元都是空值，則視為相等。`=` 為真；`!=` 為假；
   `>` 與 `<` 為假；`>=` 與 `<=` 為真。
2. 若恰好其中一個運算元為空值，`=` 為假、`!=` 為真。在排序
   上，空值小於任何非空值。
3. 若兩個運算元都是數字，或都是可透過「trim、再以 `Number()`
   解析且不產生 `NaN`」解析為有限數字的字串，則進行數值比較。
   數值比較使用 IEEE 754 相等性；因此 `0.1 + 0.2` 並不等於
   `0.3`。需要容忍誤差的範本**必須**（**MUST**）透過 `ROUND()`
   明確四捨五入。
4. 若兩個運算元都是布林，依值比較，`false` 排在 `true` 之前。
5. 若兩個運算元都是日期，依其底層時間戳比較。這涵蓋了一邊是
   午夜的 `YYYY-MM-DD`、另一邊是含時間的 datetime 的情況——
   否則它們會被比較成不同的正規字串。
6. 否則，依正規字串形式以 Unicode 碼點順序比較。**不**套用
   區域感知的排序規則。**也不**套用 Unicode 正規化
   （ADR-0030）——NFC `한`（U+D55C）與 NFD `한`
   （U+1112 U+1161 U+11AB）渲染外觀相同，但比較時視為不同字串。
   資料中混用不同形式的作者請在上游正規化。

### `&` 串接

`&` 將每個運算元轉成正規字串形式，再依序串接結果。`&` 的
結果一律是字串。

## 函式

函式名稱不分大小寫。規格以大寫書寫。

每個面向使用者的函式都有規範的引數個數（見 ADR-0024）。引數
個數錯誤的呼叫會在解析／正規化階段（早於任何運算元求值）引發
`xl3/eval/arity-mismatch`。

| 函式 | 引數 | 備註 |
|---|---|---|
| `IF` | 3 | 條件、true 值、false 值 |
| `IFEMPTY` | 2 | 值、後備值（別名：`IFBLANK`） |
| `ROUND` | 2 | 值、小數位 |
| `ABS` | 1 | 值 |
| `TEXT` | 2 | 值、格式 |
| `ROW` | 0 | 目前資料區塊中的列索引 |
| `TODAY` | 0 | UTC 日期 |
| `YEAR` | 1 | 日期的四位數年份（UTC）——ADR-0019 修訂 |
| `MONTH` | 1 | 日期的月份 1–12（UTC）——ADR-0019 修訂 |
| `DAY` | 1 | 日期的當月日 1–31（UTC）——ADR-0019 修訂 |
| `EOMONTH` | 2 | 距某日期 `N` 個月後的月底日期（UTC 午夜）——ADR-0019 修訂 |
| `EDATE` | 2 | 距某日期 `N` 個月後、同一日（必要時截到該月最後一日）的日期（UTC 午夜）——ADR-0019 修訂 |
| `DATEDIF` | 3 | 兩日期之間完整 `"Y"`／`"M"`／`"D"` 單位的整數計數（當起始 > 結束時為負）——ADR-0019 修訂 |
| `HYPERLINK` | 2 | url、label——產生可點擊的儲存格——ADR-0039 |
| `UPPER` | 1 | 將字串中的字母轉為大寫——ADR-0044 |
| `LOWER` | 1 | 將字串中的字母轉為小寫——ADR-0044 |
| `TRIM` | 1 | 修剪前後空白（內部空白保留）——ADR-0044 |
| `IFERROR` | 2 | 值、後備值——當值為錯誤儲存格標記時回傳後備值——ADR-0044 |
| `IFS` | 偶數 ≥ 2 | （cond、value）成對；回傳第一個真值分支；若無符合則 `xl3/eval/no-match`——ADR-0044 |
| `DATE` | 3 | 年、1 為起點的月份、日——UTC 午夜——ADR-0044 |
| `ISBLANK` | 1 | 若值依 ADR-0007 為空則為真；為 IFEMPTY 判定式的別名——ADR-0047 |
| `XLOOKUP` | 3 或 4 | 值、查找陣列、回傳陣列、[後備值] |
| `SUM` | 1 | 欄參考 |
| `AVERAGE`（別名 `AVG`） | 1 | 欄參考 |
| `MIN` | 1 | 欄參考 |
| `MAX` | 1 | 欄參考 |
| `COUNT` | 0 或 1 | 0 = 區塊列數；1 = 該欄的非空計數 |
| `CONCAT` | 1+ | 可變引數；`&` 的替代寫法 |

### IF

```text
{{ IF([quantity] > 100, "bulk", "normal") }}
```

當條件為**真值**時回傳第二個引數，否則回傳第三個引數。

值為**真值**，除非它是下列之一：

- 布林 `false`。
- 數字 `0`。
- 依 [空值](./evaluation.md#empty-values) 為空的值——缺失、`""`，
  或僅含空白的字串。

字串 `"0"` 或 `"false"` **沒有**任何特殊處理。內容非空白
的字串永遠是真值，包含字串型旗標值如 `"0"` 或 `"false"`。
需要解讀這類旗標的範本**必須**（**MUST**）明確比較，例如
`IF([flag] = "1", …)`。

比較運算式求值為布林，當比較成立時為真值。

### IFEMPTY

```text
{{ IFEMPTY([memo], "-") }}
```

當第一個引數依 [空值](./evaluation.md#empty-values) 為空時回傳
第二個引數。否則回傳第一個引數。

### XLOOKUP

```text
{{ XLOOKUP([Account], Customers[Account], Customers[Name]) }}
{{ XLOOKUP([Account], Customers[Account], Customers[Name], "(unknown)") }}
```

在 `lookup_array` 中查找 `lookup_value`，並回傳 `return_array`
中對應的值。陣列引數**必須**（**MUST**）為帶來源前綴的方括號
參考（例如 `Customers[Account]`），且**必須**（**MUST**）來自
同一個來源。

函式會依活頁簿順序走訪該來源的列，回傳第一個 `lookup_array`
欄等於 `lookup_value` 的列（依 [比較演算法](#comparison-algorithm)）。
若沒有任何列符合：

- 若有提供第四個引數，回傳它。
- 否則為錯誤。

XTL 0.1 僅支援精確比對——不支援萬用字元、近似比對或反向查找。

依 ADR-0060，`lookup_value`（第一個引數）與選用的 `fallback`
（第四個引數）是完整的 XTL 運算式。它們**可以**（**MAY**）是
字面值、裸方括號、帶來源前綴的方括號、函式呼叫，或複合運算式。
這兩個位置中的 `Source[Column]` 參考受作用中來源規則（ADR-0012）
約束：只有當 `Source` 是外圍區塊的作用中來源時，它才解析為目前列；
否則引發 `xl3/source/row-cross-block`。陣列引數的限制（同來源、
不可使用裸方括號）僅套用於 `lookup_array` 與 `return_array`。

### 彙總函式

彙總函式作用於目前已渲染的列集合。

```text
{{ SUM([total]) }}
{{ COUNT() }}
{{ COUNT([customer]) }}
{{ AVERAGE([price]) }}
{{ MIN([date]) }}
{{ MAX([date]) }}
```

`COUNT()` 計算列數。`COUNT([field])` 計算 `[field]` 值依
[空值](./evaluation.md#empty-values) 為非空的列數。

依 ADR-0059，`SUM`、`AVERAGE`（及其 `AVG` 別名）、`MIN`、
`MAX`，以及 1 個引數形式的 `COUNT` 的單一引數**必須**（**MUST**）
為 `[Column]` 或 `Source[Column]` 形式的欄參考。其他任何形式
（字面值、運算式、函式呼叫）皆引發 `xl3/eval/bad-aggregate-arg`。
需要逐列計算彙總的作者可在上游加入輔助欄位，或在另一個
儲存格中計算逐列的值。

### 數值函式

```text
{{ ROUND([amount], 0) }}
{{ ABS([delta]) }}
```

`ROUND(value, places)` 將值四捨五入到指定的小數位數。
四捨五入採「離零方向」（half-away-from-zero），對應 Excel 的
`ROUND()`（例如 `ROUND(2.5, 0)` 為 `3`、`ROUND(-2.5, 0)` 為 `-3`）。

### 文字格式化

```text
{{ TEXT([date], "YYYY-MM-DD") }}
{{ TEXT([amount], "#,##0") }}
```

對下列支援的格式，`TEXT()` 回傳字串。若輸出需保持為數字或日期值，
請使用範本儲存格的數字／日期格式。

XTL 0.1 定義下列最小的 `TEXT()` 格式子集：

| 種類 | Token／格式 | 意義 |
|---|---|---|
| 日期／時間 | `YYYY`、`YY`、`MM`、`DD`、`dd`、`HH`、`hh`、`mm`、`ss` | 補零的日曆欄位，`YYYY` 與 `YY` 除外。`DD` 與 `dd` 都是當月日。 |
| 數字 | `0` | 不分組的四捨五入整數。 |
| 數字 | `#,##0` | 以 `,` 為千位分隔符的四捨五入整數。 |
| 數字 | `0.00` | 固定兩位小數、不分組。 |
| 數字 | `#,##0.00` | 固定兩位小數、以 `,` 為千位分隔符。 |

數字 `TEXT()` 的四捨五入採與 `ROUND()` 相同的「離零方向」規則。

此表以外的格式在 XTL 0.1 中為擴充。實作**可以**（**MAY**）接受
額外格式，但其精確輸出屬實作定義，不在核心符合性範圍內。可攜
範本**必須**（**MUST**）僅使用上表中的格式。

### 列與日期函式

```text
{{ ROW() }}
{{ TODAY() }}
{{ TEXT(TODAY(), "YYYY-MM-DD") }}
```

`ROW()` 回傳目前 repeat 區塊內以 1 為起點的列索引。在 repeat
區塊之外呼叫 `ROW()` 為錯誤。`TODAY()` 回傳渲染時的 UTC 日期。
實作**不可**（**MUST NOT**）使用主機執行階段的本地時區；需要
特定區域日期的範本應在來源活頁簿中計算，或透過 `__config__`
以作者自訂值傳入。

## 指令

指令以範本運算式形式書寫，通常位於資料區塊上方相鄰的列中。

```text
{{ @filter [Status] = "Open" }}
{{ @filter [Customer] in __lists__[IncludedCustomers] }}
{{ @filter [Category] !in __lists__[ExcludedCategories] }}
{{ @sort [total] desc }}
{{ @group [Region], [Customer] }}
{{ @top 10 }}
{{ @repeat right 3 }}
{{ @source Renewals }}
{{ @join Customers on Customers[Account] = Renewals[Account] }}
{{ @block A:D }}
```

指令名稱與排序方向不分大小寫。

### `@block`——明確資料區塊宣告

依 ADR-0067，`@block` 讓作者能明確宣告資料區塊的 geometry。可辨識三種形式：

```text
@block                  — bare；欄範圍由 {{...}} marker 自動偵測
@block <col-range>      — 明確欄範圍，例如 A:D
@block <full-rect>      — 明確列 × 欄矩形，例如 A2:D7
```

`@block` directive 儲存格位於一個**嚴格高於**區塊第一列的列中。沒有引數時，區塊欄範圍是 directive 下方 `{{ ... }}` marker 儲存格的 bounding box（依 ADR-0066 欄範圍偵測）。使用 `A:D` 這種 col-range 引數時，欄範圍明確，列範圍自動偵測。使用 `A2:D7` 這種完整矩形時，列範圍與欄範圍都明確；該矩形**必須**（**MUST**）包含至少一個 marker cell，否則引發 `xl3/block/empty-table`。

同一工作表上的兩個 `@block` 矩形**不得**（**MUST NOT**）重疊（任何列 × 欄交集都會引發 `xl3/block/overlap`）。

**區塊偵測模式**（ADR-0068，strict）：一張工作表要嘛有 *zero* 個 `@block` directive（implicit mode——套用 ADR-0066 single-block cluster detection；多個 disconnected cluster 會引發 `xl3/expression/bracket-outside-block`），要嘛有一個或多個 `@block` directive（explicit mode——所有 `[Column]` marker cells **必須**（**MUST**）位於某個 `@block` 矩形內；orphan marker 引發相同錯誤碼）。

**多重資料區塊工作表中的 directive 範圍**（ADR-0069）：所有其他 directive——`@filter`、`@sort`、`@top`、`@source`、`@join`、`@group`、`@repeat`——都透過 **proximity** 綁定到特定區塊：

> 令 directive `D` 位於 `(r_D, c_D)`。它綁定到資料區塊 `B`，條件為 (1) `r_D < B.startRow`，(2) `B.colStart ≤ c_D ≤ B.colEnd`，且 (3) 在滿足 (1) 與 (2) 的區塊中，`B.startRow - r_D` 最小。若沒有區塊滿足 (1) 與 (2)，該 directive 引發 `xl3/directive/orphan`。

此規則在單一區塊工作表上會正確退化：候選只有一個，因此 closest-block-below 檢查是平凡的。

區塊內的 `ROW()` 回傳該區塊的 iteration index（每筆記錄 1 起始）；不屬於任何區塊的 `ROW()` 儲存格會引發 `xl3/expression/row-outside-block`。

### Filter

```text
@filter [field] operator value
```

運算子：

```text
=
!=
>
<
>=
<=
in
!in
```

`in` 與 `!in` 需要 `__lists__[<name>]` 形式的清單參考
（依 ADR-0011），其中 `<name>` 是保留 `__lists__` 工作表中
的欄標題。舊版的 `_<name>` 清單工作表形式已淘汰。

**多個 `@filter` 指令以 AND 組合。** 一列只在每個 `@filter`
判定式都成立時才通過區塊。XTL 0.1 沒有 `OR` 形式；需要選言的
範本應以 `__lists__[…]` 成員性篩選來組合各選項，或在上游
預先篩選來源。

```text
{{ @filter [Region] = "Seoul" }}
{{ @filter [Amount] > 10000 }}
```

只有兩個條件都成立時，該列才會通過。

### Sort

```text
@sort [field] asc
@sort [field] desc
```

省略方向時，預設使用 `asc`。

`@sort` 為**穩定**排序。排序鍵相等的列保留原始來源順序。
多個 `@sort` 指令存在時，**第一個**指令為主排序鍵，後續指令
依出現順序作為平手鍵。來源順序為最終的平手鍵（對應 Excel 的
「依……排序，再依……排序」與 SQL 的 `ORDER BY a, b`）。

### Top

```text
@top 10
```

在篩選與排序之後保留前 N 列。依 ADR-0055，N **必須**（**MUST**）
為正整數（≥ 1）。`@top 0`、`@top -5`、`@top 05`（前導零）皆為
解析錯誤，引發 `xl3/directive/invalid-syntax`。

### Repeat Right

```text
@repeat right
@repeat right 3
```

將偵測到的資料區塊水平展開。可選的數字為每筆記錄佔的欄寬；
省略時欄寬為 `1`。依 ADR-0055，欄寬**必須**（**MUST**）為
正整數（≥ 1）；`@repeat right 0` 與 `@repeat right -3` 會引發
`xl3/directive/invalid-syntax`。

### Source

```text
@source <SourceName>
```

將外圍資料區塊的作用範圍限定為 `__sources__` 中宣告的具名來源
（依 ADR-0012）。在區塊內，方括號簡寫 `[Column]` 解析為作用中
來源的當前列，而對 `Source[Column]` 的彙總依然如常運作。在沒有
`@source` 的情況下，作用中來源為 `__config__` 設定的預設
`source_sheet`。

明確寫法 `@source default` 是合法的，且等同於省略該指令
（ADR-0065）。來源名稱引數區分大小寫：`@source DEFAULT` 會
引發 `xl3/source/undeclared`，因為 `__sources__` 中沒有任何一列
宣告該名稱。

參考未宣告的來源為錯誤。參考未在來源 headers 中宣告的欄為錯誤
（`xl3/source/unknown-column`）；靜默地落為空值會掩蓋拼字錯誤。

### Join

```text
@join <JoinedSource> on <JoinedSource>[<key>] = <PrimarySource>[<key>]
```

將 `@source` 區塊每一個主來源的列，與 `<JoinedSource>` 中
第一個符合的列配對（依 ADR-0014，內連結語意、第一個符合）。
未配對到的主來源列會被丟棄。在區塊內，`<PrimarySource>[Column]`
與裸 `[Column]` 解析為主來源的列；`<JoinedSource>[Column]` 解析
為配對到的 joined 列。多個 `@join` 子句、左連結語意、與多列
比對皆不在 XTL 0.1 範圍內。

`on` 子句兩側都**必須**（**MUST**）為帶來源前綴的方括號參考；
一側**必須**（**MUST**）指名 `<JoinedSource>`、另一側為
`<PrimarySource>`。任一來源未在 `__sources__` 中宣告，或 `on`
子句格式錯誤，皆為錯誤。

### Group + Subtotal

```text
@group [Key1], [Key2], …, [KeyN]
```

`@group` 將作用中的列集合切分為 N 層巢狀群組，用於在單一資料
區塊內穿插發出 `@subtotal`（ADR-0038）。群組身分依 ADR-0009
正規字串形式的相等規則；群組順序為 `@filter` 與 `@sort` 套用
**之後**的遇見順序（`@group` 本身不會重新排序）。

一個資料區塊**最多**（**MAY**）包含一個 `@group`。沒有鍵清單的
`@group` 會引發 `xl3/group/missing-key`。`@group` 與
`@repeat right` 不相容（`xl3/directive/invalid-syntax`）。

`@subtotal` 列含一個或多個 `{{ @subtotal <aggregate> }}` 運算式。
每個 subtotal 列綁定到一層群組的巢狀層級——來源順序中**第一個**
`@subtotal` 列綁定到最內層的鍵（`[KeyN]`），下一個綁定到
`[KeyN-1]`，依此類推往外。最外層的 `@subtotal` 在資料區塊結尾
觸發一次（即「以最外層 subtotal 表示總計」的樣式）。

支援的彙總本體——其他任何形式都會引發
`xl3/subtotal/bad-aggregate`：

- `SUM(<column-ref>)`
- `COUNT()` 或 `COUNT(<column-ref>)`
- `AVERAGE(<column-ref>)`
- `MIN(<column-ref>)`
- `MAX(<column-ref>)`

複合運算式（`SUM([A]) - SUM([B])`、`IF(...)` 等）暫不支援。
彙總內的欄參考遵循與他處相同的 `[Column]` ／ `Source[Column]`
形式；ADR-0038 §「Aggregate scoping」中的範圍規則仍適用——
彙總作用於目前群組的列集合，而非整個區塊。

依 ADR-0058，一個 `@subtotal` 列**可以**（**MAY**）在不同
儲存格中包含任意數量的 `{{ @subtotal <aggregate> }}` 運算式。
它們全部共用該列單一的巢狀層級綁定（由列順序推得），並在
每次發出時都對相同的群組列集合求值。同一 subtotal 列上混用
彙總種類（`SUM` + `COUNT` + `AVERAGE`）與欄參考是允許的。

`@subtotal` 列**也可以**（**MAY**）包含字面文字儲存格、靜態
公式，以及其他**不**參考當前列欄位的 `{{ ... }}` 運算式
（在群組邊界沒有「當前列」）。在彙總之外參考當前列的欄會
引發 `xl3/expression/unknown-name` 類別的錯誤。

空群組——所有資料列都為空（ADR-0007）——會被跳過。

```text
{{ @sort [Region] }}
{{ @sort [Customer] }}
{{ @group [Region], [Customer] }}
{{ [Region] }} | {{ [Customer] }} | {{ [Amount] }}
"Customer subtotal" |                 | {{ @subtotal SUM([Amount]) }}
"Region subtotal"   |                 | {{ @subtotal SUM([Amount]) }}
```

錯誤：

- `xl3/group/missing-key`——`@group` 沒有鍵清單。
- `xl3/subtotal/outside-group`——`@subtotal` 儲存格出現在沒有
  `@group` 的區塊中，或 `@subtotal` 列數多於 `@group` 鍵數。
- `xl3/subtotal/bad-aggregate`——`@subtotal` 本體不是
  `SUM`、`COUNT`、`AVERAGE`、`MIN`、`MAX` 之一，或其引數不是
  允許形式的欄參考。

## 群組鍵

工作表名稱使用裸群組鍵，因為 Excel 工作表名稱不能包含 `[` 或 `]`：

```text
{{ Customer }}
```

檔案樣式可使用裸群組鍵或括號內的來源欄：

```text
{{ Customer }}_report.xlsx
{{ [Customer] }}_report.xlsx
{{ TEXT(TODAY(), "YYYY-MM-DD") }}_report.xlsx
```
