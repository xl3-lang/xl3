# XTL 求值模型

:::note
本简体中文版本仅供阅读辅助。规范的正典是[英文原版](https://xl3.io/spec/evaluation),如有规范性解释差异以英文为准。
:::

本文档定义 XTL 实现如何读入输入并产出输出。

## 输入与输出（Inputs and Outputs）

一次 XTL 转换接受：

```text
template.xlsx
data.xlsx
```

并产出一个或多个 `.xlsx` 输出文件。

模板工作簿定义输出工作簿的形态、模板表达式、分组规则、指令与配置。源工作簿提供表格数据。

## 保留工作表（Reserved Sheets）

xl3 定义了四个保留的工作表名。任何名称匹配双下划线包裹模式 `__<name>__` 的工作表都保留供引擎使用。作者不得（**MUST NOT**）创建这种形态的工作表；其余一切都属于模板内容。

| 工作表 | 用途 |
|---|---|
| `__config__` | 单一配置对象 —— 引擎元数据 + 作者自定义值 |
| `__inputs__` | 运行时输入声明（集合；见 [输入](#输入inputs)） |
| `__sources__` | 命名外部数据源声明（集合；见 [外部数据源](#外部数据源external-data-sources)，依 ADR-0012） |
| `__lists__` | 作者自定义的成员列表（集合；见 [列表工作表](#列表工作表list-sheets)） |

从单元格表达式引用保留工作表内容时，使用 Excel 结构化引用形式 `__sheet__[key]` —— 与未来某个 ADR 中用于多源列的形式相同。旧式 `_<name>` 引用语法在本版本中已淘汰。

## 模板配置（Template Configuration）

名为 `__config__` 的隐藏工作表可以（**MAY**）提供元数据与作者自定义值。A 列存放键，B 列存放值。

| 键 | 含义 | 示例 |
|---|---|---|
| `name` | 模板显示名 | `Order summary` |
| `description` | 自由文本 | `Monthly order summary` |
| `source_sheet` | 源工作表名，或以 `*` 结尾的前缀模式 | `Orders`、`Data_*` |
| `source_table` | 源表选择器。所选范围中的第一行包含列名；下方为数据行。 | `1`、`A1:D`、`B5:H200` |
| `output_file_pattern` | 输出文件名模板 | `{{ __config__[customer] }}_report.xlsx` |
| `match_pattern` | 批量匹配模式 | `Orders*` |
| 其他任意键 | 作者自定义值 | `title = Q2 Sales` |

`source_table` 是唯一的源表选择器。

作者自定义值使用上述系统表之外的任意键。它们通过 `{{ __config__[key] }}` 从单元格引用。例如 `title = Q2 Sales` 这一行可通过 `{{ __config__[title] }}` 引用。作者不得（**MUST NOT**）将系统键名重新用作作者自定义值。

依 ADR-0056，无论 `key` 是系统槽位还是作者自定义槽位，`__config__[key]` 的读取形式都解析为该单元格的值。`{{ __config__[name] }}`、`{{ __config__[output_file_pattern] }}` 等都是合法读取。写入侧的限制（作者不能以系统键名**声明**一行）保持不变。读取未知键会抛出 `xl3/expression/unknown-name`。

需要*每次运行*取值的模板改用 `__inputs__` 工作表（见 [输入](#输入inputs)）。

## 外部数据源（External Data Sources）

模板可以（**MAY**）通过提供保留工作表 `__sources__` 来声明默认源之外的具名数据源。第 1 行是表头；之后每一行声明一个源。

| 列 | 必需 | 含义 |
|---|---|---|
| `name` | 是 | 源名。仅允许字母、数字与下划线。不得（**MUST NOT**）以 `__` 开头，也不得（**MUST NOT**）为 `default`（保留给隐式源）。 |
| `sheet` | 是 | 数据工作簿中的源工作表名，或以 `*` 结尾的前缀模式。 |
| `table` | 否 | 该工作表的源表选择器，默认为 `1`。语法与 `__config__` 中的 `source_table` 相同。 |
| `description` | 否 | 自由文本备注。 |

实现必须（**MUST**）按表头文本（大小写不敏感）识别列。

隐式的 **default** 源 —— 通过 `__config__` 中的 `source_sheet` 与 `source_table` 行声明 —— 始终命名为 `default`。它不能在 `__sources__` 中被重新声明。

### 单元格引用（Cell references）

`[Column]` 继续表示"当前活动源当前行的列"。`Source[Column]` 是命名源的结构化引用形式：

```
{{ [Account] }}                   活动源的当前行
{{ Customers[Account] }}          Customers 的当前行（仅当其为活动源时）
{{ SUM(Renewals[Amount]) }}       对 Renewals 完整行集的聚合
```

行级 `Source[Column]` 只有当 `Source` 是所在数据块的活动源时才有效。在聚合函数内部，`Source[Column]` 始终对 `Source` 的完整行集进行操作，与活动数据块无关。

### `@source` 指令

数据块可以（**MAY**）将其迭代范围限定到某个命名源：

```
{{ @source Customers }}
{{ @filter [Region] = "Seoul" }}
{{ [Account] }}
{{ [Region] }}
```

上述数据块默认按垂直方向展开 —— 每个源行渲染一行 —— 不需要显式的 `@repeat` 指令（见 [指令](#指令directives)）。

未提供 `@source` 时，活动源为 `default`。`@source` 必须（**MUST**）出现在同一数据块的 `@filter`/`@sort`/`@top` 指令之前（它决定了这些指令操作的行集）。

引用未声明的源 —— 通过 `@source <Unknown>` 或 `Unknown[Column]` —— 是错误。

### `@join` 指令

数据块可以（**MAY**）在 `@source` 之后立即添加**一个** `@join` 指令，将每一行主源与第二个源的某一行配对：

```
{{ @source Renewals }}
{{ @join Customers on Customers[Account] = Renewals[Account] }}
{{ [Account] }} | {{ Customers[Name] }} | {{ [Amount] }}
```

对于每一主源行，引擎会找到**第一**条匹配的被连接行（依 [比较算法](./language.md#comparison-algorithm)），并渲染该配对。"第一"由被连接源的自然行序定义 —— 在其 `source_table` 范围内自上而下。这是规范性的：当多条被连接行的连接键相等时，两种实现必须（**MUST**）选取同一行进行配对。

如果未找到匹配，则主源行被**丢弃**（内连接语义）。

在块内部，`[Column]` 与 `<PrimarySource>[Column]` 解析到主源行；`<JoinedSource>[Column]` 解析到配对的被连接行。在行级引用其他源仍属于错误。

XTL 0.1 范围之外：多个 `@join` 指令、左连接语义以及多行匹配。

## 输入（Inputs）

模板可以（**MAY**）通过提供名为 `__inputs__` 的保留工作表来声明运行时输入。第一行是表头；之后每一行声明一个输入。

| 列 | 必需 | 含义 |
|---|---|---|
| `name` | 是 | 输入名。仅允许由字母、数字和下划线组成。 |
| `type` | 是 | `text`、`number`、`date`、`select` 之一。 |
| `default` | 否 | 非空时，当宿主省略该输入时使用。默认值会按该输入的 `type` 解析。 |
| `label` | 否 | 面向人类的提示文本。宿主应当（**SHOULD**）将其作为表单标签。 |
| `description` | 否 | 可选的较长帮助文本。 |
| `options` | 否 | 当 `type = select` 时必需。以管道符分隔的允许值，例如 `Seoul\|Busan\|Daegu`。 |

实现必须（**MUST**）按表头文本（大小写不敏感）识别列。除上述列以外的列已保留，必须（**MUST**）被忽略。

当某行没有 `default` 时，该输入是**必需**的。宿主必须（**MUST**）为每个必需输入提供值；省略其中之一即为错误。

已解析的输入值通过 `{{ __inputs__[name] }}` 从单元格引用。例如声明为 `name = month` 的输入通过 `{{ __inputs__[month] }}` 引用。`__inputs__[name]` 解析为已解析并经强制转换的值；规范中没有在模板内部读取某输入的 `label`、`default` 或 `type` 的形式（宿主使用 `readTemplateInputs()` API）。

输入名不得（**MUST NOT**）与 `__config__` 中声明为非系统行的作者自定义值发生冲突；这在解析时即为错误。

依 ADR-0062，当 `default` 单元格 —— 在 *ADR-0050 求值之后* —— 按 ADR-0007 产出空值时，该输入即视为**必需**。"空单元格"、`default = ""`、`default = "   "`、`default = {{ "" }}` 这几种形态都坍缩为"必需"。

依 ADR-0063，`options` 单元格在求值之后按 `|` 切分；每个元素去除 Unicode 空白后，空元素被丢弃。`options = "Seoul | Busan"` 产出 `["Seoul", "Busan"]`；`options = "a||b"` 产出 `["a", "b"]`；`options = "||"` 抛出 `xl3/inputs/missing-options`。重复选项会被保留。宿主提供的 `select` 值与产出的数组按大小写敏感方式比较。

输入值从宿主提供的值进行强制转换：

- `text` —— 透传宿主字符串。非字符串的宿主值通过规范字符串形式（见 [比较与字符串强制转换](./language.md#comparison-and-string-coercion)）字符串化。
- `number` —— 按"先 trim，再 `Number()`，且不得产出 `NaN`"解析。失败为错误。
- `date` —— 按日期格式单一表达式单元格相同的规则强制转换。失败为错误。
- `select` —— 宿主值在规范字符串形式归一化后，必须（**MUST**）等于声明的某个 `options`。失败为错误。

经强制转换的输入值可以像任何其他值一样参与 `IF()`、`@filter`、`&`、比较运算和 `TEXT()`。

### 在 `default` / `label` / `description` / `options` 中的模板求值

依 ADR-0050，`default`、`label`、`description` 与 `options` 列中的单元格是 XTL 模板：连续文本加上零或多个 `{{ ... }}` 块，在读取输入时（任何源行被加载之前）求值。求值上下文被有意约束。

可用绑定：

- `__config__[key]` —— `__config__` 工作表中的作者自定义值（在 `__inputs__` 之前解析）。
- 纯标量函数：`TODAY`、`DATE`、`IF`、`IFEMPTY`、`IFS`、`IFERROR`、`UPPER`、`LOWER`、`TRIM`、`TEXT`、`YEAR`、`MONTH`、`DAY`、`EOMONTH`、`EDATE`、`DATEDIF`、`ROUND`、`ABS`。

禁止绑定（抛出稳定错误码）：

- 裸 `[Column]` 或 `Source[Column]` 引用 —— 读取输入时尚无源行上下文。错误：`xl3/inputs/forward-reference`。
- `__sources__[…]` 或 `__inputs__[name]` —— 源尚未加载；输入行是相互独立的声明。错误：`xl3/inputs/forward-reference`。
- `ROW()`、`SUM`、`COUNT`、`AVERAGE`、`MIN`、`MAX`、`XLOOKUP` —— 渲染时或依赖源数据。错误：`xl3/inputs/runtime-only-fn`。

求值后的规范字符串形式（见 ADR-0009）通过宿主 UI 作为 `InputSpec.default` / `InputSpec.label` / `InputSpec.description` 回流。对于 `options`，求值得到的字符串随后按 `|` 切分以产出数组。

对于 `default`，求值得到的字符串再按上述规则被输入的声明 `type` 强制转换。因此当 `type = date` 时，`default = {{ TODAY() }}` 在强制转换后的默认值中，会得到渲染时的 ISO 日期。

## 源数据模型（Source Data Model）

源数据模型是一个有序的行列表。每一行是从源列名到单元格值的映射。

`source_sheet` 选择工作表。若省略，则使用首个工作表。如果 `source_sheet` 以 `*` 结尾，则视为前缀模式。实现必须（**MUST**）在工作簿顺序中选择第一个名称以 `*` 之前的前缀开始的工作表。如果没有工作表匹配，则为错误。精确的工作表名匹配优先于前缀匹配。

`source_table` 在所选工作表内被解释：

| 形式 | 含义 |
|---|---|
| `N` | 第 `N` 行包含源列名。源列由非空单元格构成，从第一个非空单元格延伸到最后一个非空单元格。`N` 之下的所有行直到工作表已用行末尾都是数据行。 |
| `A1:D` | 单元格 `A1:D1` 包含源列名。下方行直到工作表已用行末尾为数据行。 |
| `A1:D200` | 单元格 `A1:D1` 包含源列名。`A:D` 列中的 `2:200` 行为数据行。 |

若省略 `source_table`，则默认为 `1`。

`N` 必须（**MUST**）是 1 起的正整数。范围形式必须（**MUST**）使用绝对 Excel A1 坐标，包含左列、首行、右列以及可选的末行。左列不得（**MUST NOT**）位于右列右侧。可选的末行不得（**MUST NOT**）在首行之上。

当范围形式的末行等于首行（例如 `A1:D1`）时，源表包含列名以及零数据行。这是合法的。

源表列名单元格在 trim 之前使用与源数据单元格相同的有效文本/值提取方式。

列名规则：

1. 源列名单元格的值被转为字符串并 trim。
2. 源列名大小写敏感。
3. 富文本源列名单元格通过连接其文本片段读取。
4. 公式源列名单元格使用缓存的公式结果。如果没有可用的缓存结果，则为错误。
5. 所选源表内空列名为错误。
6. 重复的源列名为错误。
7. 空数据行被跳过。
8. 水平合并的表头单元格在合并主单元格的列索引处构成一列（依 ADR-0033）。同一行但与主单元格不同列的从属单元格是透明的：它们不贡献列，也不会引起重复名错误。表头行中的垂直合并按从属单元格列读取主单元格的文本，保持不变。如果所选范围只包含合并的从属单元格（窗口内没有主单元格），则为错误（`xl3/source/missing-header`）；请扩大范围以包含合并主单元格。
9. 表头单元格文本中的换行符（CRLF、CR 或 LF —— 包括通过 Alt+Enter 输入的换行）按 ADR-0041 修订在读取时被归一化为**单个空格**（U+0020）。连续多个换行被折叠为一个空格。空格折叠后的形式即为列名；模板通过相同的空格形式（`{{ [단위: 원] }}`）引用它。trim 与 trim 后空检测（规则 5）在换行归一化*之后*应用。表头归一化与数据行不对称，依 ADR-0041 的原始范围，数据行中 LF 按字面保留。

**数据行**（表头行之下的行）中的合并单元格依 ADR-0035 遵循另一条规则：合并从属单元格的值即合并主单元格的值。跨 *N* 个数据行的垂直合并产出 *N* 行数据，每行在该列共享主单元格的值。数据行中的水平合并把主单元格在该行的值赋给每一个从属列。空数据行跳过在合并广播*之后*评估。希望某次垂直合并被视为一条逻辑记录的作者应当（**SHOULD**）取消合并源数据区域。

因此，对于行号简写形式（`source_table = N`），在推断源列跨度之后，首个与末个非空列名单元格之间的空缺即为错误。

## 空值（Empty Values）

如果一个值缺失 —— 源列不存在于这一行，或单元格为空 —— 或者它是一个内容全为 Unicode 空白的字符串，则该值为**空**。

数字（包括 `0`）从不为空。布尔（包括 `false`）从不为空。日期从不为空。非空字符串从不为空。缓存结果为空字符串的公式按此规则视为空。

Excel 错误单元格（`#N/A`、`#VALUE!`、`#DIV/0!`、`#REF!`、`#NAME?`、`#NUM!`、`#NULL!`）—— 无论是静态值还是携带为公式缓存结果 —— 按此规则同样视为空（ADR-0017）。实现遇到时可以（**MAY**）发出警告；警告不得（**MUST NOT**）改变输出语义。

空值谓词支配规范中提到空值的每一处：

- `IFEMPTY(value, fallback)` 在 `value` 为空时返回 `fallback`。
- `COUNT([field])` 在某行的 `[field]` 值非空时计入该行。
- 当源表列跨度内每一个单元格都为空时，源行为空。空数据行在分组与渲染之前被跳过。
- 列表工作表条目通过丢弃工作表第一列中的空单元格而读取。
- 空的源行值永远不匹配 `@filter [field] in __lists__[name]`。同一值始终匹配 `@filter [field] !in __lists__[name]`。

## 列表工作表（List Sheets）

模板可以（**MAY**）通过提供名为 `__lists__` 的保留工作表来声明具名成员列表。第 1 行是表头；每个表头单元格是一个列表的名字。第 1 行下方，每一列存放该列表的值。

```
__lists__:
| fruits | allowed_status | excluded_regions |
|--------|----------------|------------------|
| apple  | open           | test             |
| banana | pending        | internal         |
| cherry | reviewing      |                  |
```

`__lists__` 工作表：

- 可以（**MAY**）在模板中可见、隐藏或深度隐藏。
- 必须（**MUST**）从输出工作簿中移除。
- 每个单元格按 [比较与字符串强制转换](./language.md#comparison-and-string-coercion) 转换为规范字符串形式，并 trim Unicode 空白。trim 后为空的单元格（依 [空值](#空值empty-values)）被跳过。
- 每列内部的顺序被保留。重复条目不会被去除。

列表通过 filter 指令引用：

```
{{ @filter [Fruit] in __lists__[fruits] }}
{{ @filter [Status] !in __lists__[allowed_status] }}
```

`__lists__[name]` 是一个列表数组。它仅在 `@filter ... in` 与 `@filter ... !in` 内合法；在其他位置使用会抛出 `xl3/lists/invalid-use`，依 ADR-0057。这覆盖了单元格表达式中的列表引用、作为 `=`/`!=` 等的操作数、作为函数参数，以及作为 `@sort`/`@top` 参数的位置。

引用未在 `__lists__` 中声明的列表名（或在没有 `__lists__` 工作表时引用 `__lists__[name]`）会抛出 `xl3/lists/missing-reference`。

## 渲染阶段（Render Phases）

实现必须（**MUST**）按以下概念顺序渲染：

1. 解析 `__config__`、`__inputs__`、`__lists__`、工作表模板、指令与变量。
2. 读取源行。
3. 解析模板表达式引用的源列。
4. 按 `output_file_pattern` 将源行拆分为文件分组。
5. 按工作表名分组键将文件分组拆分为工作表分组。
6. 对当前行集应用指令。
7. 展开 repeat 块。
8. 对静态单元格与数据单元格求值。
9. 从输出中移除保留的 `__<name>__` 工作表与指令行。
10. 写出输出文件。

具体实现策略可以不同，但可观察输出必须（**MUST**）与该顺序一致。

### 块展开 —— 列范围 splice（ADR-0066）

步骤 7（"展开 repeat 块"）在 splice 的**列范围**上具有规范性。给定一个行范围为 `[r_start..r_end]`、列范围为 `[c_start..c_end]` 的数据块（推导见 `language.md` 的 "Data Blocks"），将该块展开为 `N` 条记录时，行为如下：

- **Inside cells**（列在 `[c_start..c_end]` 内）：
  - 对于 `[r_start..r_end]` 中的行：按每条记录克隆到 `r_start..r_start + N * (r_end - r_start + 1) - 1`。
  - 对于行 `r > r_end`：下移 `(N - 1) * (r_end - r_start + 1)` 行。
- **Outside cells**（列在 `[c_start..c_end]` 外）：
  - 无论展开因子 `N` 是多少，都保持在原始 `(r, c)` 位置。
  - 它们的单元格值、公式文本与样式必须（**MUST**）按字面保留。

因此，splice 的行位移效果是**列范围**的：同一次 OOXML 行插入只移动内部列单元格，渲染器在同一渲染阶段把外部列单元格恢复到其原始行位置。执行整行 splice 的实现必须（**MUST**）随后执行 outside-cell restore pass，以满足此契约。

## 顺序（Ordering）

输出顺序是确定性的且由源驱动：

- **文件分组**按**首见**顺序出现。引擎按源的自然顺序遍历源行；第一个 `output_file_pattern` 求值为文件名 `X` 的行使该分组先被发出。
- **文件内的工作表分组**按**首见**顺序覆盖该文件分组的行列表。第一条匹配的行决定工作表的位置。
- 单源迭代顺序是 `source_table` 自上而下的读取顺序。在多源数据（见 [外部数据源](#外部数据源external-data-sources)）情形下，该规则适用于*主*源的行；命名源参与聚合与连接，但不影响输出顺序。

排序稳定性定义于 [`@sort`](./language.md#sort)：等值排序键保留源顺序。

## 指令（Directives）

指令按以下顺序应用：

```text
source -> join -> filter -> sort -> group -> top -> repeat
```

多个 filter 之间以逻辑 AND 组合。当存在多个 sort 时，第一个 `@sort` 是主键，后续 sort 作为决胜键。

`@group`（ADR-0038）将过滤/排序之后的行集划分为 N 级嵌套分组，并在单一数据块内驱动交错的 `@subtotal` 行发射。分组顺序是 `@sort` *之后*的遇见顺序；`@group` 自身不重新排序。`@top` 在分组之后于行级应用 —— 仅当某个分组的数据行通过 `@top` 截断后仍存在时，其小计行才会发射。

`@repeat right` 改变块的展开方向，并非数据过滤指令。没有显式 `@repeat` 时，数据块按垂直方向（向下）展开 —— 每个源行渲染一行。

## 单元格文本提取（Cell Text Extraction）

模板表达式解析与源行读取作用于每个单元格的有效文本/值：

- 普通字符串、数字、布尔与日期单元格按其单元格值读取。
- 富文本单元格按其文本片段顺序拼接读取。
- 公式单元格不会被 XTL 重新计算。若工作簿包含缓存的公式结果，则使用该缓存结果。若公式单元格作为源数据值被读取且无可用缓存结果，则为错误。

## 源值模型（Source Value Model）

源值是以下种类之一（依 ADR-0017）：

| 种类 | 备注 |
|---|---|
| Missing | 该行不存在源列，或单元格为空。依 [空值](#空值empty-values) 视为空。 |
| String | Unicode 文本。仅在完全为空白时按 ADR-0007 视为空。 |
| Number | IEEE 754 双精度浮点。`NaN` 与无穷不由规范一致的运算产生；它们字符串化为 `""` 并作为空值流转。 |
| Boolean | `TRUE` / `FALSE`。 |
| Date | 日历时刻；可能携带时间分量，也可能不携带。 |

Excel 单元格形态映射到种类：

| Excel 单元格 | XTL 种类 |
|---|---|
| 空白 | Missing |
| 字符串 / 内联 / 共享字符串 | String |
| 数字（含按非日期格式存储为序列的日期） | Number |
| 日期格式的单元格 | Date |
| 布尔 | Boolean |
| 带缓存结果的公式 | 该结果的种类 |
| 错误单元格（`#N/A`、`#VALUE!`、`#DIV/0!`、…） | Missing（依 [空值](#空值empty-values)） |

百分比格式的 Excel 单元格以其底层 Number 值流转（50% → `0.5`）。需要格式化输出的模板使用 `TEXT(value, "0%")`（XTL 0.1 核心表之外的扩展格式），或依赖模板单元格的数字格式被保留。

## 单元格求值（Cell Evaluation）

### 单一表达式单元格（Single-Expression Cells）

完整内容为一个模板表达式的单元格属于单一表达式单元格：

```text
{{ [OrderDate] }}
```

依 ADR-0052，"完整内容"是在**去除首尾 Unicode 空白**后对单元格文本求值。形如 `  {{ [OrderDate] }}  `（仅外围空白）的单元格属于单一表达式单元格。被 trim 掉的空白不属于渲染值。

无分隔符的相邻模板块 —— `{{ [A] }}{{ [B] }}` —— **不**是单一表达式单元格。它们按下文规则属于混合文本单元格；其结果以规范字符串形式拼接。希望获得类型保留的单一表达式行为的作者应使用显式的 `&` 形式：`{{ [A] & [B] }}`。

单一表达式单元格在可能的情况下保留求值得到的值类型。

如果模板单元格具有数字/日期/文本格式，实现必须（**MUST**）将字符串源值强制转换以匹配该格式：

- 类日期格式将支持的日期字符串或 Excel 序列数字强制转换为日期。
- 类数字格式将数字字符串强制转换为数字。
- 文本格式 `@` 强制转换为字符串。

如果强制转换失败，实现必须（**MUST**）报告错误。

XTL 0.1 在规范上不强制定义支持的日期格式与数字格式 token 的最小集合，留给各实现自行决定。所支持格式少于他实现的实现可声明部分一致性。

### 混合文本单元格（Mixed Text Cells）

包含围绕一个或多个表达式的字面文本的单元格属于混合文本单元格：

```text
Order date: {{ [OrderDate] }}
```

包含相邻、无分隔符的模板块（`{{ [A] }}{{ [B] }}`）的单元格按 ADR-0052 也属于混合文本单元格。

混合文本单元格按字符串渲染。模板的数字/日期格式不会强制转换混合文本单元格。依 [空值](#空值empty-values) 视为空的值（含按 ADR-0053 的六个源侧 Excel 错误哨兵）在其位置贡献 `""`；引擎产出的 `#DIV/0!` 在其位置替换为字面字符串 `"#DIV/0!"`（ADR-0025）。

### TEXT 函数

对于 XTL 0.1 核心格式，`TEXT(value, format)` 返回一个字符串。它旨在用于文件名与显式显示字符串，而不是用于应保持数值/日期值的单元格。

XTL 0.1 核心 `TEXT()` 表之外的格式属于实现自定义的扩展。一致性语料不对这些格式断言特定结果。

## 输出文件名（Output Filenames）

`output_file_pattern` 求值产出的每个输出文件名必须（**MUST**）按以下顺序进行清理：

1. **替换被禁字符**为 `_`：
   - 字符集 `< > : " / \ | ? *`
   - `0x00`-`0x1F` 范围内的 ASCII 控制字符。
2. **trim** 首尾空白以及尾随的 `.` 字符。
3. **保留名守卫**：如果在 `.xlsx` 扩展名之前的基名（大小写不敏感）等于 `CON`、`PRN`、`AUX`、`NUL`、`COM1`-`COM9`、`LPT1`-`LPT9` 之一，则在基名末尾追加一个 `_`。
4. 如果步骤 1-3 之后产出空文件名或空基名，则为错误。
5. 如果产出文件名的 UTF-8 字节长度超过 255，则为错误。实现不得（**MUST NOT**）静默截断。
6. 当步骤 1-3 中的任一步改变了渲染字符串时，实现应当（**SHOULD**）发出警告，包含原文件名与清理后的文件名。警告不得（**MUST NOT**）改变输出语义。

这些规则仅适用于文件名。工作表名遵循 Excel 自身的被禁字符集与 31 字符长度限制，由实现单独定义。

Unicode 字符（例如 CJK、带重音字母、emoji）不受限制：明确被禁集合之外的任何码点都将保留。

## 样式与工作簿结构（Styles and Workbook Structure）

实现必须（**MUST**）在渲染输出中按字面保留以下模板特性（依 ADR-0036）：

- 单元格样式（字体、填充、边框、对齐）
- 数字/日期格式
- 行高与列宽
- 模板与源数据行中的合并单元格（源表头依 ADR-0033，源数据行依 ADR-0035）
- 图片及其锚定范围
- 条件格式规则及其 `sqref` 范围
- 命名范围 / 已定义名称（工作簿级与工作表级）
- 打印区域与打印标题（重复行 / 列）
- 冻结窗格 / 拆分（工作表 `views`）
- 工作表保护状态与每个单元格的 locked / hidden 标志
- 数据验证规则（下拉、范围约束）及其范围
- 单元格批注（备注）

上述均**按字面**保留。当 `@repeat` 展开行时，范围、锚点与引用**不会**自动扩展：引擎将模板的编码原样带到输出中。希望某条规则（例如条件格式）覆盖 repeat 展开行的作者应当（**SHOULD**）在模板中使用整列引用（例如 `$A:$A`）来锚定，而不依赖引擎侧的扩展。

图表在 XTL 0.1 中属于**实现自定义**（依 ADR-0036 条款 3 与 ADR-0006）；移植可以保留、丢失或部分保留图表对象。未来某个 ADR 将在 Stage 2 一致性触及图表时规范地固定图表行为。

样式保留并不凌驾于值语义之上。例如，`TEXT()` 返回的字符串即使模板单元格具有日期格式，也仍然是字符串。

## 错误（Errors）

以下情形为错误：

- 引用不存在的源列（`xl3/source/unknown-column`）。
- 引用未在 `__sources__` 中声明的源（`xl3/source/undeclared`）。
- 引用 `__lists__` 中不存在的列表（`xl3/lists/missing-reference`）。
- 使用无效的指令。
- 使用无效的 `source_table`。
- 使用空或重复的源列名。
- 作者创建的工作表匹配保留的双下划线模式 `^__[a-z]+__$`（依 ADR-0011，`xl3/sheet/reserved-name`）。
- 把 `__sources__` 声明工作表当作值字典引用（例如 `__sources__[Customers]`，`xl3/sources/not-a-dictionary`）；请直接使用源名。
- 单一表达式单元格的值未能强制转换为其模板单元格格式（`xl3/cell/numfmt-coercion`）。
- 应用清理规则之后产出无效的输出文件名（`xl3/filename/empty`、`xl3/filename/too-long`）。
- 在 repeat 块之外调用 `ROW()`（`xl3/cell/row-outside-repeat`）。
- 不带缓存结果的源公式单元格（`xl3/cell/formula-no-cache`）。
- 缺少必需的 `__inputs__`（`xl3/inputs/missing-required`）、输入值无效，或 `select` 值不在 `options` 中（完整输入错误清单见 ADR-0010）。
- XLOOKUP 无匹配且无后备值（`xl3/xlookup/no-match`）、裸方括号实参（`xl3/xlookup/bare-bracket`）或源不一致的数组（`xl3/xlookup/source-mismatch`）。
- `@join` 引用未声明的源（`xl3/join/undeclared-source`）或 `on` 子句格式不正确（`xl3/join/bad-on-clause`）。
- 在行级引用非活动源的列（`xl3/source/row-cross-block`）。
- 不支持的表达式语法 —— 一元 `+`/`--`，或对非字面量（列引用、保留工作表引用或子表达式）应用一元 `-`（`xl3/eval/unsupported-syntax`，依 ADR-0028）。
- 指令语法无效 —— 同一数据块内重复的 `@source` 或 `@join`，或空的指令正文（`xl3/directive/invalid-syntax`，依 ADR-0029）；`@top` 或 `@repeat right` 的整数不 ≥ 1（依 ADR-0055）。
- 字符串字面量不闭合的模板块 —— 通常是 `}}` 嵌入在 `"..."` 内部（`xl3/parser/unbalanced-literal`，依 ADR-0051）。
- 数据单元格中无法解析为布尔字面量的裸标识符（`xl3/expression/unknown-name`，依 ADR-0054）。
- `__lists__[name]` 引用用于 `@filter ... in` / `@filter ... !in` 以外的位置（`xl3/lists/invalid-use`，依 ADR-0057）。
- 聚合函数（`SUM`、`AVERAGE`、`MIN`、`MAX`、单参 `COUNT`）的实参不是 `[Column]` 或 `Source[Column]` 引用（`xl3/eval/bad-aggregate-arg`，依 ADR-0059）。

依 ADR-0015，每个规范定义的错误都携带形如 `xl3/<category>/<id>` 的稳定 `error.code`。宿主使用该码进行本地化与程序化分派；英文 `Error.message` 仍然是一致性契约。

实现可以（**MAY**）为非致命的可移植性问题提供警告，但警告不得（**MUST NOT**）改变输出语义。

## 资源限制（Resource limits）

### 规范层立场

资源限制 —— 输入模板最大大小、源行最大计数、输出工作簿最大大小、`@repeat` 最大迭代次数、最大递归深度 —— 属于**实现自定义**。XTL 0.1 规范不强制规定具体边界。实现应当（**SHOULD**）记录其限制，并应当（**SHOULD**）在触及限制时抛出稳定的 `xl3/limits/...` 错误码，但这些码本身并不属于规范契约，因为宿主在部署形态（浏览器、CLI、服务器）与威胁模型上差异极大。

接受不可信模板的宿主（例如接受用户上传 `.xlsx` 的 SaaS）必须（**MUST**）在引擎之上的层级强制实施自有限制 —— 沙箱、请求大小上限、超时 —— 并且不应当（**SHOULD NOT**）依赖引擎来检测恶意输入。

### 实现限制 —— 参考实现（xl3-js）

参考实现发布以下软上限（ROADMAP 关口 G21）。这些是*正确性边界*，而非安全边界 —— 接受不可信输入的宿主必须（**MUST**）按 [`SECURITY.md`](../SECURITY.md) 添加自有强制层。下表值为 0.6.0 草案，会随基准语料（G8）落地而收紧。

| 维度 | 软上限（草案） | 触限行为 |
|---|---|---|
| 每个块的源行数 | 1,000,000 | 实现自定义；ExcelJS 的内存模型是瓶颈 |
| 每个输出工作表的总单元格数 | Excel 的 17,179,869,184（1,048,576 × 16,384 硬上限） | xl3 不会合成超过 Excel 工作表上限的单元格；超过此值的输出会抛出错误 |
| `@repeat` 迭代次数 | 由源行数限定 | 没有独立的迭代上限；源本身就是节流阀 |
| `__sources__` 数量 | 实现自定义；规范无限制 | 声明的上限只通过警告传出 |
| 文件分组输出数 | 实现自定义 | 参考实现每个分组发出一个文件；宿主应当（**SHOULD**）在外部加帽 |

### 流式策略（Streaming policy）

参考实现在 1.x 中将模板与数据完全加载到内存中。**流式 I/O 显式延后至 1.1+**：它需要规范化、水印以及背压 API，这些都会改变公开表面。需要大规模转换的宿主应当（**SHOULD**）在*源*边界进行分片（把一个 10M 行的表拆为 10 × 1M 行的转换），而不是等待流式 I/O。

### AbortSignal

`convert()` 与 `preview()` 的 `options` 实参接受可选的 `AbortSignal`（按关口 G21 计划在 0.7-0.8 落地）。当该信号被中止时，进行中的转换会抛出稳定错误码（`xl3/abort/cancelled`）；不会发出任何部分输出。需要将转换与挂钟预算竞速的宿主使用此钩子来确定性地强制超时。

该 API 是**向前兼容**的 —— 向 `ConvertOptions` 增加可选参数不影响已有调用方；按 ADR-0015，错误码是只追加的。
