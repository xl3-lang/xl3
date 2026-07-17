# XTL 语言

:::note
本简体中文版本仅供阅读辅助。规范的正典是[英文原版](https://xl3.io/spec/language),如有规范性解释差异以英文为准。
:::

本文档定义 XTL 0.1 模板语言的表面。这里的写法对模板作者与实现而言均为规范性的。

`{{ ... }}` 模板块内容的形式语法见 [`grammar.ebnf`](https://github.com/jinyoung4478/xl3/blob/main/spec/grammar.ebnf) —— 这是面向移植者与工具方的非规范性辅助材料。术语定义见 [`glossary.md`](/zh-CN/spec/glossary)。

## 模板块（Template Blocks）

模板表达式写在双花括号之间：

```text
{{ expression }}
```

紧贴 `{{` 与 `}}` 内侧的空白无关紧要 —— 解析器会在规范化之前去除首尾空白。下列写法等价：

```text
{{ [name] }}
{{[name]}}
{{    [name]    }}
{{
  [name]
}}
```

运算符两侧的空白（例如 `{{ [a] + [b] }}` 与 `{{ [a]+[b] }}`）同样无关紧要。字符串字面量内部的空白被保留（`"hello world"` 保留其中的空格）。

内部内容为空（`{{ }}` 或仅空白）的模板块属于解析错误，依 ADR-0021（`xl3/parser/empty-block`）。

模板块由 `{{` 开启，并由单元格文本顺序中**第一个**后续的 `}}` 关闭。分隔符扫描器不感知字符串字面量：位于 `"..."` 字面量内部的 `}}` 仍会关闭模板块（ADR-0051）。如果作者需要在值中出现字面意义的 `}}`，则把它放入 `__config__[key]`，再通过 `{{ __config__[key] }}` 引用。当表达式正文的 `"` 个数为奇数（字面量不闭合，几乎总是由内嵌的分隔符造成）时，抛出 `xl3/parser/unbalanced-literal`。

## 数据块（Data Blocks）

工作表上的*数据块*是引擎在渲染源行时展开的矩形。它有两个维度：

- **行范围** `[r_start..r_end]` —— 连续行的最大区间，其中每一行都包含至少一个*数据行单元格*（其 `{{ ... }}` 正文在聚合函数之外引用至少一个 `[Column]` 的单元格）。两个数据行之间出现非数据行（没有 `[Column]` 引用）会关闭该块。
- **列范围** `[c_start..c_end]` —— 该块行范围内所有带任意 `{{ ... }}` 表达式的单元格的 bounding box，并**向外扩展穿过相邻的非空单元格**。紧邻 marker 单元格的原生 Excel 公式（`{ formula: "..." }`）或静态值在块内。被完全空列隔开的非空单元格在块外。

矩形内的单元格是 *block cells*。同一工作表上位于矩形外的单元格是 *outside cells*（ADR-0066）。

**每张工作表一个块（0.x）。** 在 XTL 0.x 中，一张工作表最多有一个数据块。如果解析器发现两个或更多断开的 `[Column]` 数据行单元格 cluster，则在解析时抛出 `xl3/expression/bracket-outside-block`，并标识第二个 cluster 的起始行。multi-block 支持（通过显式 `@block` directive 消除边界歧义）延后至未来 ADR。

**块展开语义**（渲染侧；规范见 `evaluation.md` 的 "Render Phases"）：

- block cells 会被克隆到展开后的行中 —— 每 `(r_end - r_start + 1)` 个模板行对应一条记录。
- 行号 `r < r_start` 的 outside cells 保持在原位置（块上方的 header / configuration 行）。
- 行号 `r >= r_start` 的 outside cells 即使 splice 为块展开插入行，也保持在原始行 `r`。它们**不会**下移（**NOT**）。其公式文本按字面保留。
- 位于内部列且行号 `r > r_end` 的单元格（即 footer-row 场景：与数据相同的列中存在 "Total" 标签和 footer 公式）会下移 `(N - 1) × (r_end - r_start + 1)` 行，落在展开后的数据块下方。

这种不对称 —— 块下方的内部列单元格会移动，而同一行上的外部列单元格不会移动 —— 是有意设计的。它支持常见的“侧边汇总表”模式（位于主数据块右侧或左侧、独立于主块的并行报表区域），而不要求作者声明单独工作表。

如果作者希望一个标签/公式对一起移动（例如 A4='footer'，B4=LOWER(A4)），则把两个单元格都放在块的列范围内。如果 marker 单元格刚好没有覆盖到 B（例如只有 A2 有 marker），则 B 在块外，不会跟随 A 移动；解决方法是在 B2 添加一个 marker（即便是 `{{ "" }}` 这样的 trivial literal expression 也可以），或者在未来版本可用时使用显式 `@block A:B` 形式。

## 源列（Source Columns）

源列通过方括号语法引用：

```text
{{ [Customer] }}
{{ [Customer Name] }}
{{ [Units Per Case] }}
```

`[` 与 `]` 之间的文本是去除首尾空白后的精确源列名。列名可以（**MAY**）包含空格、字母、数字以及除 `]` 与换行符之外的标点。

像 `{{ Customer }}` 这样的裸名字在单元格中并不是源列引用。裸名字保留给工作表与文件分组键使用。

按 ADR-0054，模板块内部的裸标识符按以下顺序解析，未能解析则抛出 `xl3/expression/unknown-name`：

| 上下文 | 解析顺序 |
|---|---|
| `output_file_pattern` | 文件分组键 → `__inputs__[name]` → `__config__[name]` |
| 工作表名模式 | 工作表分组键 → `__inputs__[name]` → `__config__[name]` |
| 数据单元格 | 所在文件分组键 → 所在工作表分组键 → `__inputs__[name]` → `__config__[name]`（布尔字面量 `TRUE`/`FALSE` 仍会先以字面量形式解析，再进入此链） |

数据单元格中的裸标识符**不会**解析到源列;作者必须（**MUST**）使用显式的 `[Column]` 形式进行列引用。在数据单元格中保留这条短链解析,是为了当 `output_file_pattern` 为 `{{ [Region] }}.xlsx` 的工作表内出现 `{{ Region }}` 时,能按预期读取当前活动分组的值。

## 字面量（Literals）

XTL 0.1 支持：

```text
"text"
123
123.45
-123
```

### 字符串字面量（依 ADR-0028）

由一对匹配的 `"` 界定。**没有转义序列** —— 反斜杠按字面透传;0.x 版本中没有规范性的方式在字符串字面量内嵌入 `"`。如果作者需要在某个值中出现 `"`,则把它放入 `__config__` 的作者自定义键中（单元格内容可以是任意字符）,然后通过 `{{ __config__[key] }}` 引用。

引号不匹配或重复（`"a"b"`、`"a` 等）的行为属于实现自定义;可移植的模板始终对每个字面量使用恰好一对匹配的引号。

### 数字字面量（依 ADR-0028）

十进制数字,可选带前导 `-` 表示取负。允许形状：`5`、`-5`、`3.14`、`-3.14`、`0`。Unicode 减号 `U+2212` **不**被识别为符号位（依 ADR-0009 修订）。

**XTL 0.x 不支持对非字面量表达式使用一元运算符。** 以下全部抛出 `xl3/eval/unsupported-syntax`：

- `+5`、`+[col]`（一元加）
- `--5`、`-(0 - 5)`（双重取负）
- `-[col]`、`-(expr)`、`-__config__[k]`（对非字面量的一元减）

列取负的替代写法：写作 `(0 - [col])` 或 `[col] * -1`。

## 运算符（Operators）

### 算术 —— `+`、`-`、`*`、`/`

两侧操作数必须（**MUST**）能强制转换为有限数字。强制转换规则依 ADR-0023：

| 操作数类型 | 强制转换结果 |
|---|---|
| Number（有限） | 自身 |
| Boolean | 1（TRUE）/ 0（FALSE） |
| 空值（依 [空值](/zh-CN/spec/evaluation#empty-values)） | 0 |
| 可解析为有限数字的字符串 | 解析后的数字 |
| 不能解析为数字的字符串 | 错误 `xl3/eval/operand-coercion` |
| Date | 错误 |
| 其他任何类型 | 错误 |

字符串解析依 ADR-0009 与 ADR-0023：先去空白,再 `Number()`,不得产生 `NaN`。逗号视为千位分隔符（`"1,234"` 解析为 `1234`）;字面量中不允许科学计数法;不允许前导 `+`。Unicode 减号 `U+2212` 不是符号字符（依 ADR-0009 修订）。

依 ADR-0064,字符串→数字的强制转换（与字面量解析不同）接受以下形状：

| 形状 | 是否接受 | 示例 |
|---|---|---|
| 十进制整数 | 是 | `"42"`、`"-42"` |
| 十进制小数 | 是 | `"3.14"`、`"-3.14"` |
| 千位分隔 | 是 | `"1,234"`、`"-1,234.56"` |
| 科学计数法 | 是 | `"1e5"`、`"-1.5e-3"`、`"1.5E10"` |
| 十六进制前缀 `0x`/`0X` | 否 —— 错误 `xl3/eval/operand-coercion` | `"0x10"` |
| 二进制前缀 `0b`/`0B` | 否 | `"0b101"` |
| 八进制前缀 `0o`/`0O` | 否 | `"0o17"` |
| 前导 `+` | 否 | `"+5"` |
| Unicode 减号 `U+2212` 前缀 | 否 | `"−5"` |
| 产生 `±Infinity` | 否 | `"Infinity"`、IEEE 754 溢出 |
| 尾部带非数字字符 | 否 | `"5px"`、`"5 abc"` |
| 多行字符串 | 否 | 字符串内部含 LF |

字面量解析（严格）与字符串强制转换（宽松）的非对称性是有意设计的：字面量是作者书写的;而被强制转换的字符串来自数据（CSV 导出、财务系统）,科学计数法或十六进制在那里自然出现。

```text
{{ [price] * [quantity] }}
{{ [total] / 10 }}
{{ [a] + [b] }}
{{ [a] - [b] }}
```

示例：

| 表达式 | 结果 |
|---|---|
| `1 + 2` | 3 |
| `"10" + 5` | 15 |
| `"1,234" + 1` | 1235 |
| `TRUE + 1` | 2 |
| `[empty-cell] + 5` | 5 |
| `"abc" + 5` | 错误 |

除以零会产生 Excel 的 `#DIV/0!` 错误单元格（依 ADR-0025）。数值单表达式单元格渲染为值为 `#DIV/0!` 的真实 Excel 错误单元格;在文本格式单元格、混合文本单元格内,或在 `&` 拼接中,在对应位置代入字符串 `"#DIV/0!"`。如果该错误值在同一单元格表达式内继续流向其他算术运算符（例如 `(1/0) + 5`）,它无法强制转换为有限数字,按上表抛出 `xl3/eval/operand-coercion`。

六个**源端**的 Excel 错误哨兵 —— `#N/A`、`#VALUE!`、`#REF!`、`#NAME?`、`#NUM!`、`#NULL!` —— 在读取源时按 ADR-0017 视为空值。依 ADR-0053,它们在混合文本与 `&` 拼接的位置上贡献 `""`,在数字/日期格式的单表达式单元格中则抛出 `xl3/cell/numfmt-coercion`。`#DIV/0!` 是引擎自身在 XTL 求值期间唯一会产出的哨兵;它遵循上述规则。如果作者想为源端哨兵显示可见的"缺失"标记,可用 `IFEMPTY([col], "missing")` 包裹列引用。

### 字符串拼接 —— `&`

每个操作数按规范字符串形式（见[比较与字符串强制转换](#comparison-and-string-coercion)）转为字符串,然后依次拼接。永远成功,不会出现类型错误。

```text
{{ [item] & " (" & [size] & ")" }}
```

### 比较 —— `=`、`!=`、`>`、`<`、`>=`、`<=`

用于 `IF()` 与 `@filter`。遵循[比较与字符串强制转换](#comparison-and-string-coercion)中定义的算法。类型不一致时回退至规范字符串形式的码点序;不会产生强制转换错误。

```text
=
!=
>
<
>=
<=
```

## 比较与字符串强制转换 {#comparison-and-string-coercion}

比较运算符（`=`、`!=`、`>`、`<`、`>=`、`<=`）与 `&` 拼接运算符共享同一套强制转换模型。`IF()` 条件与 `@filter` 指令都使用这里定义的比较算法。`@sort` 也使用同一算法。

### 规范字符串形式（Canonical String Form）

某值的规范字符串形式为：

- 空值（依[空值](/zh-CN/spec/evaluation#empty-values)）是空字符串 `""`。
- 布尔值：`TRUE` 或 `FALSE`（大写）。
- 有限数字：能唯一标识该值的最短十进制表示,使用 `.` 作为小数分隔符;对量级在 `[1e-6, 1e21)` 范围内的数字不使用科学计数法。整数省略尾随小数点。匹配 ECMA-262 §6.1.6.1.13。
- 字符串：自身。
- 日期：当时间分量恰为零点（`00:00:00`）时为 `YYYY-MM-DD`;否则为 `YYYY-MM-DDTHH:mm:ss`。（由 ADR-0017 定义;先前由 ADR-0009 推迟。）

  日期分量必须（**MUST**）以 UTC 读取。Excel 单元格以无时区的序列号存储日期,ExcelJS 等库会以"以 UTC 为锚点"的 `Date` 对象返回它们;使用本地时区的访问器（`getFullYear`、`getMonth`、`getDate`）会在非 UTC 主机上引入差一天的漂移。需要时区感知日期的宿主（例如,"今天的首尔时间"这种文件名词法）应当在渲染器之外计算,然后通过 `__inputs__` 或 `__config__` 传入。

非有限数字（`NaN`、`Infinity`、`-Infinity`）一定不会（**MUST NOT**）由规范一致的操作产生。如果它们出现了,会被字符串化为 `""`。

### 比较算法 {#comparison-algorithm}

比较运算符依次应用如下规则：

1. 如果两侧操作数都为空,它们相等。`=` 为真;`!=` 为假;`>` 与 `<` 为假;`>=` 与 `<=` 为真。
2. 如果只有一侧为空,`=` 为假,`!=` 为真。在排序场景中,空值小于任何非空值。
3. 如果两侧都是数字,或都是经"先去空白,再 `Number()`,不得产生 `NaN`"能解析为有限数字的字符串,则按数值比较。数值比较使用 IEEE 754 相等性;因此 `0.1 + 0.2` 并不等于 `0.3`。需要容差的模板必须（**MUST**）通过 `ROUND()` 显式四舍五入。
4. 如果两侧都是布尔值,以 `false` 在 `true` 之前的顺序按值比较。
5. 如果两侧都是日期,按底层时间戳比较。这覆盖了一侧为零点的 `YYYY-MM-DD`、另一侧为日期时间的情形 —— 否则两者的规范字符串就会不同。
6. 否则,按规范字符串形式以 Unicode 码点序比较。**不应用**区域感知的排序规则。**也不应用 Unicode 规范化**（ADR-0030）—— NFC `한`（U+D55C）与 NFD `한`（U+1112 U+1161 U+11AB）渲染结果相同,但作为字符串比较时被视为不同。混合形式的数据需由作者在上游规范化。

### `&` 拼接

`&` 把每个操作数按规范字符串形式字符串化,并依序拼接。`&` 的结果始终是字符串。

## 函数（Functions）

函数名大小写不敏感。规范以大写书写。

每个面向用户的函数都有规范性的元数（arity，见 ADR-0024）。参数个数错误的调用会在解析 / 规范化阶段抛出 `xl3/eval/arity-mismatch`,**早于**任何操作数求值。

| 函数 | 参数数 | 说明 |
|---|---|---|
| `IF` | 3 | 条件、真值、假值 |
| `IFEMPTY` | 2 | 值、回退值（别名：`IFBLANK`） |
| `ROUND` | 2 | 值、位数 |
| `ABS` | 1 | 值 |
| `TEXT` | 2 | 值、格式 |
| `ROW` | 0 | 当前数据块内的行号 |
| `TODAY` | 0 | UTC 日期 |
| `YEAR` | 1 | 日期的 4 位年份（UTC）—— ADR-0019 修订 |
| `MONTH` | 1 | 日期的 1-12 月份（UTC）—— ADR-0019 修订 |
| `DAY` | 1 | 日期的 1-31 日（UTC）—— ADR-0019 修订 |
| `EOMONTH` | 2 | 自某日期起 `N` 个月所在月的最后一天（UTC 零点）—— ADR-0019 修订 |
| `EDATE` | 2 | 自某日期起 `N` 个月、日数夹取（UTC 零点）—— ADR-0019 修订 |
| `DATEDIF` | 3 | 两个日期之间完整 `"Y"`/`"M"`/`"D"` 单位的整数计数（当起始 > 结束时为负）—— ADR-0019 修订 |
| `HYPERLINK` | 2 | url、label —— 生成可点击单元格 —— ADR-0039 |
| `UPPER` | 1 | 字符串中字母转大写 —— ADR-0044 |
| `LOWER` | 1 | 字符串中字母转小写 —— ADR-0044 |
| `TRIM` | 1 | 去除首尾空白（保留内部）—— ADR-0044 |
| `IFERROR` | 2 | 值、回退值 —— 当值为错误单元格标记时返回回退值 —— ADR-0044 |
| `IFS` | 偶数 ≥ 2 | (条件, 值) 对;返回第一个真值分支;若全无匹配抛 `xl3/eval/no-match` —— ADR-0044 |
| `DATE` | 3 | 年、1 起始的月、日 —— UTC 零点 —— ADR-0044 |
| `ISBLANK` | 1 | 当值依 ADR-0007 为空时返回 true;是 IFEMPTY 谓词的别名 —— ADR-0047 |
| `XLOOKUP` | 3 或 4 | value、lookup-array、return-array、[fallback] |
| `SUM` | 1 | 列引用 |
| `AVERAGE`（别名 `AVG`） | 1 | 列引用 |
| `MIN` | 1 | 列引用 |
| `MAX` | 1 | 列引用 |
| `COUNT` | 0 或 1 | 0 = 数据块行数;1 = 列的非空值计数 |
| `CONCAT` | 1+ | 可变参数;`&` 的另一写法 |

### IF

```text
{{ IF([quantity] > 100, "bulk", "normal") }}
```

当条件为**真值**时返回第二个参数,否则返回第三个参数。

某值是**真值**,除非它是以下之一：

- 布尔 `false`。
- 数字 `0`。
- 依[空值](/zh-CN/spec/evaluation#empty-values)为空的值 —— 缺失、`""` 或仅由空白构成的字符串。

字符串 `"0"` 与 `"false"` 没有特殊处理。任何含非空白内容的字符串始终为真值,包括字符串化的标志值 `"0"` 或 `"false"`。如果模板需要解释这种标志,必须（**MUST**）显式比较,例如 `IF([flag] = "1", …)`。

比较表达式求值为布尔值,在比较成立时为真值。

### IFEMPTY

```text
{{ IFEMPTY([memo], "-") }}
```

当第一个参数依[空值](/zh-CN/spec/evaluation#empty-values)为空时,返回第二个参数。否则返回第一个参数。

### XLOOKUP

```text
{{ XLOOKUP([Account], Customers[Account], Customers[Name]) }}
{{ XLOOKUP([Account], Customers[Account], Customers[Name], "(unknown)") }}
```

在 `lookup_array` 中查找 `lookup_value`,并返回 `return_array` 中对应的值。两个数组必须（**MUST**）是带源前缀的方括号引用（如 `Customers[Account]`）,且必须（**MUST**）来自同一个源。

函数按工作簿顺序遍历源的各行,并返回第一个其 `lookup_array` 列依[比较算法](#comparison-algorithm)等于 `lookup_value` 的行。如果没有匹配行：

- 如果提供了第四个参数,返回该参数。
- 否则视为错误。

XTL 0.1 仅支持精确匹配 —— 没有通配符、近似匹配或反向搜索。

依 ADR-0060,`lookup_value`（第一个参数）与可选的 `fallback`（第四个参数）都是完整的 XTL 表达式。它们可以（**MAY**）是字面量、裸方括号、带源前缀的方括号、函数调用,或者由上述组合而成的复合表达式。其中任一位置上的 `Source[Column]` 引用都受活动源规则（ADR-0012）约束：仅当 `Source` 是周围数据块的活动源时,它解析为当前行;否则抛出 `xl3/source/row-cross-block`。数组参数的约束（同源、不允许裸方括号）仅适用于 `lookup_array` 与 `return_array`。

### 聚合（Aggregates）

聚合作用于当前已渲染的行集。

```text
{{ SUM([total]) }}
{{ COUNT() }}
{{ COUNT([customer]) }}
{{ AVERAGE([price]) }}
{{ MIN([date]) }}
{{ MAX([date]) }}
```

`COUNT()` 统计行数。`COUNT([field])` 统计 `[field]` 值依[空值](/zh-CN/spec/evaluation#empty-values)非空的行数。

依 ADR-0059,`SUM`、`AVERAGE`（及其 `AVG` 别名）、`MIN`、`MAX`,以及单参数形式的 `COUNT` 的单个参数必须（**MUST**）是形如 `[Column]` 或 `Source[Column]` 的列引用。任何其他形状（字面量、表达式、函数调用）抛出 `xl3/eval/bad-aggregate-arg`。如果作者需要按行计算的聚合,可在上游增加辅助列,或在另外的单元格中按行计算。

### 数值函数

```text
{{ ROUND([amount], 0) }}
{{ ABS([delta]) }}
```

`ROUND(value, places)` 把值四舍五入到给定的小数位数。舍入方式为"半数向远离零方向取整",与 Excel 的 `ROUND()` 一致（例如 `ROUND(2.5, 0)` 为 `3`,`ROUND(-2.5, 0)` 为 `-3`）。

### 文本格式化

```text
{{ TEXT([date], "YYYY-MM-DD") }}
{{ TEXT([amount], "#,##0") }}
```

对于下列受支持的格式,`TEXT()` 返回字符串。如果希望输出仍是数字或日期值,请使用模板单元格的数字 / 日期格式。

XTL 0.1 定义如下最小 `TEXT()` 格式子集：

| 类别 | 词法单元 / 格式 | 含义 |
|---|---|---|
| 日期/时间 | `YYYY`、`YY`、`MM`、`DD`、`dd`、`HH`、`hh`、`mm`、`ss` | 补零的日历字段（`YYYY` 与 `YY` 除外）。`DD` 与 `dd` 都表示月内第几日。 |
| 数字 | `0` | 四舍五入到整数,无分组。 |
| 数字 | `#,##0` | 四舍五入到整数,以 `,` 作千位分组。 |
| 数字 | `0.00` | 固定两位小数,无分组。 |
| 数字 | `#,##0.00` | 固定两位小数,以 `,` 作千位分组。 |

数值 `TEXT()` 的舍入采用与 `ROUND()` 相同的"半数向远离零方向"规则。

不在上表范围内的格式属于 XTL 0.1 的扩展。实现可以（**MAY**）接受附加格式,但其确切输出属于实现自定义,在核心一致性之外。可移植模板必须（**MUST**）只使用上表中的格式。

### 行号与日期函数

```text
{{ ROW() }}
{{ TODAY() }}
{{ TEXT(TODAY(), "YYYY-MM-DD") }}
```

`ROW()` 返回当前重复块内 1 起始的行号。在重复块之外调用 `ROW()` 是错误。`TODAY()` 在渲染时返回 UTC 日期。实现必须（**MUST NOT**）不得使用宿主运行时的本地时区;需要本地化日期的模板应当在源工作簿中计算它,或通过 `__config__` 以作者自定义值传入。

## 指令（Directives）

指令以模板表达式书写,通常位于数据块上方的行中。

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

指令名与排序方向大小写不敏感。

### `@block` —— 显式数据块声明

依 ADR-0067，`@block` 允许作者显式声明数据块的 geometry。可识别三种形式：

```text
@block                  — bare；列范围从 {{...}} marker 自动检测
@block <col-range>      — 显式列范围，例如 A:D
@block <full-rect>      — 显式行 × 列矩形，例如 A2:D7
```

`@block` directive 单元格所在行**严格位于**该块第一行之上。无参数时，块的列范围是该 directive 下方 `{{ ... }}` marker 单元格的 bounding box（依 ADR-0066 列范围检测）。带 `A:D` 这样的 col-range 参数时，列范围为显式，行范围自动检测。带 `A2:D7` 这样的完整矩形时，行范围与列范围均为显式；该矩形必须（**MUST**）包含至少一个 marker cell，否则抛出 `xl3/block/empty-table`。

同一工作表上的两个 `@block` 矩形不得（**MUST NOT**）重叠（任意行 × 列交集都会抛出 `xl3/block/overlap`）。

**块检测模式**（ADR-0068，strict）：一张工作表要么有 *zero* 个 `@block` directive（implicit mode —— 应用 ADR-0066 的 single-block cluster detection；多个 disconnected cluster 抛出 `xl3/expression/bracket-outside-block`），要么有一个或多个 `@block` directive（explicit mode —— 所有 `[Column]` marker cells 必须（**MUST**）位于某个 `@block` 矩形内；orphan marker 抛出同一错误码）。

**多重数据块工作表中的 directive 作用域**（ADR-0069）：所有其他 directive —— `@filter`、`@sort`、`@top`、`@source`、`@join`、`@group`、`@repeat` —— 通过 **proximity** 绑定到某个特定 block：

> 令 directive `D` 位于 `(r_D, c_D)`。它绑定到数据块 `B`，条件是 (1) `r_D < B.startRow`，(2) `B.colStart ≤ c_D ≤ B.colEnd`，且 (3) 在满足 (1) 与 (2) 的 block 中，`B.startRow - r_D` 最小。如果没有 block 满足 (1) 与 (2)，该 directive 抛出 `xl3/directive/orphan`。

该规则在单块工作表上会正确退化：候选只有一个，因此 closest-block-below 检查是平凡的。

块内的 `ROW()` 返回该块的迭代索引（每条记录 1 起始）；不属于任何块的 `ROW()` 单元格会抛出 `xl3/expression/row-outside-block`。

### Filter

```text
@filter [field] operator value
```

运算符：

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

`in` 与 `!in` 要求形如 `__lists__[<name>]` 的列表引用（依 ADR-0011）,其中 `<name>` 是保留 `__lists__` 工作表内的列标题。已废弃的旧式 `_<name>` 列表工作表写法已退役。

**多个 `@filter` 指令以 AND 组合。** 一行只有在每个 `@filter` 谓词都满足时才通过该块。XTL 0.1 中没有 `OR` 形式;需要析取的模板可用 `__lists__[…]` 成员判定过滤器组合,或在上游预先过滤源。

```text
{{ @filter [Region] = "Seoul" }}
{{ @filter [Amount] > 10000 }}
```

只有当两个条件都成立时该行才通过。

### Sort

```text
@sort [field] asc
@sort [field] desc
```

当方向省略时,采用 `asc`。

`@sort` 是**稳定的**。排序键相等的行保留其源中的相对顺序。当存在多个 `@sort` 指令时,**第一个**指令为主排序键,后续指令按出现顺序作为次级比较键。源顺序为最终决胜键（与 Excel "排序方式 … 然后再 …" 以及 SQL `ORDER BY a, b` 一致）。

### Top

```text
@top 10
```

在过滤与排序之后保留前 N 行。依 ADR-0055,N 必须（**MUST**）是正整数（≥ 1）。`@top 0`、`@top -5` 与 `@top 05`（前导零）属于解析错误,抛出 `xl3/directive/invalid-syntax`。

### Repeat Right

```text
@repeat right
@repeat right 3
```

将检测到的数据块横向重复。可选的数字是每条重复记录占用的列数;当省略时,列数为 `1`。依 ADR-0055,列数必须（**MUST**）是正整数（≥ 1）;`@repeat right 0` 与 `@repeat right -3` 抛出 `xl3/directive/invalid-syntax`。

### Source

```text
@source <SourceName>
```

将外层数据块的作用域绑定到 `__sources__` 中声明的具名源（依 ADR-0012）。块内,方括号简写 `[Column]` 解析到该活动源的当前行,而对 `Source[Column]` 的聚合照常工作。若无 `@source`,活动源是 `__config__` 中配置的默认 `source_sheet`。

显式形式 `@source default` 合法,等同于省略该指令（ADR-0065）。源名参数大小写敏感:`@source DEFAULT` 抛出 `xl3/source/undeclared`,因为没有 `__sources__` 行声明该名字。

引用未声明的源是错误。引用未在源标头中声明的列是错误（`xl3/source/unknown-column`）;静默回退到空值会掩盖打字错误。

### Join

```text
@join <JoinedSource> on <JoinedSource>[<key>] = <PrimarySource>[<key>]
```

将 `@source` 块的每个主行与来自 `<JoinedSource>` 的第一个匹配行配对（依 ADR-0014,内连接语义,首个匹配）。未匹配的主行被丢弃。块内,`<PrimarySource>[Column]` 与裸 `[Column]` 解析到主行;`<JoinedSource>[Column]` 解析到配对的连接行。多个 `@join` 子句、左连接语义以及多行匹配不在 XTL 0.1 范围内。

`on` 子句两侧都必须（**MUST**）是带源前缀的方括号引用;一侧必须（**MUST**）命名 `<JoinedSource>`,另一侧命名 `<PrimarySource>`。任一源未在 `__sources__` 中声明,或 `on` 子句格式不正确,均为错误。

### Group + Subtotal

```text
@group [Key1], [Key2], …, [KeyN]
```

`@group` 将活动行集分为 N 级嵌套分组,以便在单个数据块内交错地发出 `@subtotal`（ADR-0038）。分组识别采用 ADR-0009 的规范字符串相等性规则;分组顺序为 `@filter` 与 `@sort` 应用**之后**的首见顺序（`@group` 本身不重排）。

一个数据块最多可以（**MAY**）包含一个 `@group`。不带键列表的 `@group` 抛出 `xl3/group/missing-key`。`@group` 与 `@repeat right` 不兼容（`xl3/directive/invalid-syntax`）。

`@subtotal` 行包含一个或多个 `{{ @subtotal <aggregate> }}` 表达式。每个小计行绑定到一个分组嵌套层级 —— 源顺序中**第一个** `@subtotal` 行绑定到最内层键（`[KeyN]`）,下一个绑定到 `[KeyN-1]`,以此向外。最外层的 `@subtotal` 在数据块结束时触发一次（即"用最外层小计当作总计"模式）。

支持的聚合体 —— 其他任何形式都抛出 `xl3/subtotal/bad-aggregate`：

- `SUM(<column-ref>)`
- `COUNT()` 或 `COUNT(<column-ref>)`
- `AVERAGE(<column-ref>)`
- `MIN(<column-ref>)`
- `MAX(<column-ref>)`

复合表达式（`SUM([A]) - SUM([B])`、`IF(...)` 等）已延后。聚合内部的列引用沿用别处的 `[Column]` / `Source[Column]` 形式;ADR-0038 §"Aggregate scoping" 的规范作用域规则适用 —— 聚合在当前组的行集上运算,而非整块。

依 ADR-0058,一个 `@subtotal` 行可以（**MAY**）在不同单元格中包含任意数量的 `{{ @subtotal <aggregate> }}` 表达式。它们共享该行的单一嵌套层级绑定（由行顺序推断的层级）,并对同一分组行集进行求值。允许在同一小计行混合聚合种类（`SUM` + `COUNT` + `AVERAGE`）和列引用。

`@subtotal` 行还可以（**MAY**）携带字面文本单元格、静态公式,以及不引用当前行列的其他 `{{ ... }}` 表达式（在组边界处没有"当前行"）。在聚合之外引用当前行的列,会抛出 `xl3/expression/unknown-name` 类错误。

空分组 —— 所有数据行都为空（ADR-0007）—— 会被跳过。

```text
{{ @sort [Region] }}
{{ @sort [Customer] }}
{{ @group [Region], [Customer] }}
{{ [Region] }} | {{ [Customer] }} | {{ [Amount] }}
"Customer subtotal" |                 | {{ @subtotal SUM([Amount]) }}
"Region subtotal"   |                 | {{ @subtotal SUM([Amount]) }}
```

错误：

- `xl3/group/missing-key` —— `@group` 不带键列表。
- `xl3/subtotal/outside-group` —— `@subtotal` 单元格出现在没有 `@group` 的块中,或 `@subtotal` 行数多于 `@group` 键数。
- `xl3/subtotal/bad-aggregate` —— `@subtotal` 体不在 `SUM`、`COUNT`、`AVERAGE`、`MIN`、`MAX` 之中,或其参数不是被允许形式的列引用。

## 分组键（Group Keys）

工作表名使用裸分组键,因为 Excel 工作表名不能含有 `[` 或 `]`：

```text
{{ Customer }}
```

文件名模式既可以使用裸分组键,也可以使用带方括号的源列：

```text
{{ Customer }}_report.xlsx
{{ [Customer] }}_report.xlsx
{{ TEXT(TODAY(), "YYYY-MM-DD") }}_report.xlsx
```
