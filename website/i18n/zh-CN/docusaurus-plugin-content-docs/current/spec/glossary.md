# 术语表

XTL 规范文档、ADR 与一致性 fixture 中所使用的术语。若某条定义引用了另一份文档中的章节，则那一章节才是规范性的；本页仅作汇总。

## A

### Active source

活动源。在数据块内部，使裸方括号字段引用（`[Column]`）得以解析的具名源。由 `@source` 设置；若未设置，则使用 `__config__` 中通过 `source_sheet` 声明的默认源。（见 ADR-0012、evaluation.md "External Data Sources"。）

### Aggregate function

聚合函数。其参数为列引用、其结果是对多行求得单一标量的函数：`SUM`、`AVERAGE`、`AVG`、`MIN`、`MAX`、`COUNT`。带源前缀的聚合（`SUM(Source[col])`）作用于源的完整行集；裸聚合（`SUM([col])`）作用于活动数据块过滤后的行。（见 ADR-0012、language.md "Aggregates"。）

## B

### Block

数据块。见 *data block*。

### Bracket field

方括号字段。形如 `[Column]` 的列引用。在数据块内部解析到活动源的当前行。在数据块之外属于语法错误。（见 language.md "Source Columns"。）

## C

### Canonical string form

规范字符串形式。由 `&` 拼接、列表成员判定，以及比较算法的字符串回退所使用的确定性字符串表示。空 → `""`；布尔 → `TRUE`/`FALSE`（大写）；有限 Number → ECMAScript 最短可往返形式；String → 自身；Date → `YYYY-MM-DD` 或 `YYYY-MM-DDTHH:mm:ss`（UTC）。（见 ADR-0009、ADR-0017、language.md "Canonical String Form"。）

### Conformance corpus

一致性语料。位于 `conformance/fixtures/` 下的 fixture 目录集合，每个目录包含 `template.xlsx`、`data.xlsx`，可选的 `expected.xlsx` 以及 `meta.yaml`。该语料是可执行的契约：与某个通过 fixture 相矛盾的规范文本以失败论。（见 conformance/runner-protocol.md。）

## D

### Data block

数据块。模板工作表中一段连续的行范围，会在渲染时按匹配的源行每行展开一次。渲染器通过查找带有裸 `[Column]` 引用的单元格来识别它；该范围可被 `@source`、`@filter`、`@sort`、`@top`、`@repeat right` 与 `@join` 指令修饰。（见 evaluation.md "Render Phases"。）

### Default source

默认源。由 `__config__.source_sheet` 引用的工作簿所隐式加载的源。在没有 `@source` 指令的数据块内部，它就是活动源。内部名：`default`。作者通常不会显式书写 `@source default`。

### Directive

指令。其内容以 `@` 起始的模板块。指令修饰其所在的数据块。XTL 0.1 的指令集：`@filter`、`@sort`、`@top`、`@repeat right`、`@source`、`@join`。（见 language.md "Directives"。）

### Dunder (sheet)

Dunder 工作表。名称匹配 `^__[a-z]+__$` 模式的保留工作表——即以双下划线包裹。声明在册的 dunder 工作表有四张：`__config__`、`__inputs__`、`__sources__`、`__lists__`。匹配该模式的作者自建工作表会在解析时被拒绝。（见 ADR-0011。）

## E

### Empty value

空值。一个值满足以下条件之一即视为空：缺失（`null`/`undefined`）、空字符串、或仅由 Unicode 空白字符组成的字符串。Number（包括 `0`）、Boolean（包括 `false`）与 Date 永远不为空，无论其值为何。（见 ADR-0007、evaluation.md "Empty Values"。）

### Excel error sentinel

Excel 错误哨兵。值为 `#N/A`、`#VALUE!`、`#DIV/0!` 等的单元格。按 ADR-0017 读作空。实现可以（**MAY**）在遇到时发出警告。

### Expression

表达式。`{{ ... }}` 模板块的内容。可以是字面量、函数调用、方括号引用、保留工作表引用，或上述项通过运算符组合而成的任意形态。（形式语法见 spec/grammar.ebnf。）

## F

### File group

文件分组。源行按 `__config__.output_file_pattern` 中声明的分组键聚合而成的组。每个组对应一份输出 `.xlsx`。按源的自然行序的首见顺序输出（按 ADR-0016）。

### Filter

过滤。基于谓词从数据块中剔除行的指令。两种形式：`@filter [field] op value` 与 `@filter [field] in __lists__[name]`（或 `!in`）。

## G

### Group key

分组键。其不同取值将源行划分为文件分组（当该列出现在 `output_file_pattern` 中时）或工作表分组（当该列出现在工作表名模板中时）的列。

## I

### Informational ADR

信息性 ADR。状态为 `informational` 的 ADR——文档、审计或过程材料，不约束实现行为。（见 ADR-0004 作为示例，0000-template.md 列出状态分类。）

### Input

输入。在 `__inputs__` 中声明、由宿主通过 `convert(...)` 的 `inputs` 选项提供的运行时值。按声明的 `type`（text、number、date、select）进行强制转换。（见 ADR-0010。）

## J

### Join

连接。`@join` 指令将活动源的每一行与第二个源中按键首次匹配的行配对。XTL 0.1 支持具有确定性首匹配顺序的内连接语义。（见 ADR-0014。）

## L

### List sheet

列表工作表。`__lists__` 中的一列，其取值构成 `@filter ... in __lists__[name]` 的成员集合。（见 ADR-0011、evaluation.md "List Sheets"。）

## N

### Named source

具名源。在 `__sources__` 中以显式名称声明的源。可从任何接受带源前缀方括号的位置以 `Name[Column]` 引用。默认源在此意义上**不算**"具名"。

## P

### Primary source

主源。在 `@join` 块内部即活动源——其行驱动迭代。被连接的源通过 `JoinedSource[Column]` 引用提供配对的列。

## R

### Reserved sheet

保留工作表。`__config__`、`__inputs__`、`__sources__`、`__lists__` 之一。它们的名称与行为由 ADR-0011 定义。匹配 dunder 模式的作者自建工作表，无论是否匹配上述四个声明在册名称之一，均视为保留（并被拒绝）。保留工作表不会出现在输出工作簿中。

### Reserved-sheet reference

保留工作表引用。形如 `__sheet__[key]` 的模板表达式，用于在某张保留工作表的键-值表中查找 `key`。对 `__config__`、`__inputs__` 与 `__lists__` 有效；形如 `__sources__[name]` 的写法属于错误（`xl3/sources/not-a-dictionary`），因为 `__sources__` 是声明工作表，而非值字典。

## S

### Sheet group

工作表分组。源行按工作表模板名称中的键聚合而成的组。每个组对应文件内的一张输出工作表。按首见顺序输出（按 ADR-0016）。

### Single-expression cell

单表达式单元格。其模板内容恰好为一个 `{{ expression }}` 且别无其他的单元格。当此类单元格的数字格式兼容时，会保留源值的类型（Date 仍为 Date，Number 仍为 Number）。（见 ADR-0003、evaluation.md "Single-Expression Cells"。）

### Source

源。由引擎读取以提供行数据的工作表（或工作表 + 表区域）。默认源来自 `__config__.source_sheet`；具名源在 `__sources__` 中声明。（见 ADR-0012。）

### Source-prefixed bracket

带源前缀的方括号。形如 `Source[Column]` 的引用，其中 `Source` 是一个声明在册的源名。在 `@source` 块内部解析到该源的当前行列；在静态上下文中则作为聚合或 `XLOOKUP` 对该源完整行集的输入。（见 ADR-0012。）

## T

### Template block

模板块。在 Excel 单元格值中划定一段 XTL 表达式或指令的 `{{ ... }}` 语法。（见 language.md "Template Blocks"。）

### Truthy / falsy

真值 / 假值。一个值为真，除非它为空（按 ADR-0007）、为布尔 `false`，或为数值 `0`。字符串 `"0"` 与 `"false"` 为真，因为它们是非空字符串。（见 ADR-0008。）

## X

### XLOOKUP

XLOOKUP。一个在源中查找某一列等于给定值的第一行，并从该行返回某一列的函数。其基本 3 参形态及可选的回退参数对齐 Excel 签名。通配符、近似与反向搜索模式不在 XTL 0.1 的范围内。（见 ADR-0013、language.md "XLOOKUP"。）

### XTL

XTL。Excel Template Language（Excel 模板语言）。由 `spec/` 所定义的语言。实现中立；xl3 是其 TypeScript 参考实现。
