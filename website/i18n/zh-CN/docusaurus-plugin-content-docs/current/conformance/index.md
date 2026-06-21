# XTL 一致性套件

本目录存放**一致性语料**——任何 XTL 实现想要声明一致性都必须通过的测试用例（fixture）。该语料是 XTL 行为的可执行定义。

## 目录结构

```
conformance/
├── README.md            ← 本文件
├── AUTHORING.md         ← 如何添加 fixture（避免"以 JS 为真理"的陷阱）
├── runner-protocol.md   ← 实现应如何运行此套件
└── fixtures/
    └── <NNN>-<slug>/
        ├── template.xlsx
        ├── data.xlsx
        ├── expected.xlsx        ← 规范的预期输出（单文件场景）
        ├── expected/            ← 或者一个目录的文件（多文件或零输出场景）
        │   └── *.xlsx
        ├── no expected output   ← 用于 expected_error fixture
        ├── no static expected   ← 用于 expected_dynamic fixture
        └── meta.yaml            ← 描述、规范小节引用、标签
```

## "通过"的含义

静态输出 fixture 通过的条件是：当实现以 `template.xlsx` 与 `data.xlsx` 作为输入时，产生的输出与 `expected.xlsx`（或 `expected/` 目录下的内容）匹配。阶段 1 的运行器可以比较更上层的工作表/单元格值。阶段 2 的运行器在对 OOXML zip 进行**规范化（canonical normalization）**之后，按字节比较工作簿内容：

- zip 内文件按名称排序
- XML 以确定性的规范形式序列化
- 文本运行中的空白保留
- 剥离生成器元数据（creator、modifiedBy、lastModified）

比较阶段与规范化规则参见 [`runner-protocol.md`](/zh-CN/conformance/runner-protocol)。

错误 fixture 通过的条件是：实现报告的错误信息包含 fixture 中 `expected_error` 指定的文本。错误 fixture 不包含 `expected.xlsx` 或 `expected/` 目录。

动态 fixture 通过的条件是：实现的输出与 `meta.yaml` 中 `expected_dynamic` 声明的动态断言相符。动态 fixture 不包含 `expected.xlsx` 或 `expected/` 目录。

## 版本管理

每个 fixture 目录的 `meta.yaml` 中声明其所需的最低规范版本（`spec_version: 0.1`）。实现报告其目标规范版本；套件据此过滤 fixture。

静态输出 fixture 还可以声明 `comparison_stage`。该字段默认为 `1`；需要规范 OOXML 比较的 fixture 声明为 `comparison_stage: 2`。

## Fixture 元数据

语料使用的 `meta.yaml` 字段：

| 字段 | 必填 | 适用范围 | 含义 |
|---|---:|---|---|
| `description` | 是 | 所有 fixture | fixture 所断言契约的一行描述。 |
| `spec_section` | 是 | 所有 fixture | 定义该行为的规范或 ADR 小节。 |
| `spec_version` | 是 | 所有 fixture | fixture 所需的 XTL 最低版本。 |
| `tags` | 是 | 所有 fixture | 用于报告和定向运行的可过滤分类。 |
| `verified_by` | 否 | 所有 fixture | 独立的撰写校验，如 `hand` 或 `manual-script`。 |
| `expected_warnings` | 否 | 所有 fixture | 实现应当（**SHOULD**）发出的稳定警告子串。 |
| `expected_error` | 否 | 错误 fixture | 稳定的错误子串；省略静态预期输出。 |
| `expected_dynamic` | 否 | 动态 fixture | 动态断言种类；当前仅 `utc_today`。 |
| `dynamic_cells` | 与 `expected_dynamic` 配合 | 动态 fixture | 由运行器计算的工作表/单元格/格式断言。 |
| `comparison_stage` | 否 | 静态输出 fixture | 最低比较阶段；默认为 `1`，对 OOXML 敏感的检查使用 `2`。 |
| `skip_reason` | 否 | 所有 fixture | 已知失效 fixture 被临时跳过的原因。 |

`expected_error` 与 `expected_dynamic` 互斥。静态输出 fixture 使用 `expected.xlsx` 或 `expected/`；空的 `expected/` 目录表示零个输出文件。错误与动态 fixture 省略静态预期输出。

## Fixture 目录

XTL 0.1 引导语料当前包含如下 fixture：

| ID | Fixture | 契约 |
|---|---|---|
| 001 | `bracket-substitution` | 单个方括号包裹的源列表达式按每个源行渲染一个输出行。 |
| 002 | `if-function` | `IF(condition, then, else)` 在当前数据行内对比较表达式求值。 |
| 003 | `list-sheet-filter` | `@filter [field] in _ListSheet` 保留匹配行并把列表工作表从输出中移除。 |
| 004 | `repeat-right-default` | 没有显式计数的 `@repeat right` 默认 `colSpan = 1`。 |
| 005 | `round-half-away-from-zero` | `ROUND()` 使用 Excel 风格的"四舍五入背离零"。 |
| 006 | `filename-forbidden-chars` | 禁用的文件名字符被替换为 `_`。 |
| 007 | `filename-reserved-name` | Windows 保留的设备基名末尾补一个 `_`。 |
| 008 | `numfmt-numeric-string-coercion` | 数字模板格式将数值字符串强制为数字。 |
| 009 | `numfmt-date-string-coercion` | 日期模板格式将类日期字符串强制为日期值。 |
| 010 | `numfmt-text-format-coercion` | 文本格式 `@` 将单表达式值强制为字符串。 |
| 011 | `text-date-format` | `TEXT(date, "YYYY-MM-DD")` 使用 XTL 日期占位符返回字符串。 |
| 012 | `text-number-format` | `TEXT(number, format)` 支持 XTL 0.1 数字格式的最小子集。 |
| 013 | `rich-text-template-expression` | 富文本模板单元格在表达式检测前会先拼接文本运行。 |
| 014 | `source-formula-cached-result` | 源公式单元格使用缓存结果，XTL 不重新计算。 |
| 015 | `source-sheet-prefix-first-match` | `source_sheet` 前缀模式按工作簿顺序选中第一个匹配的工作表。 |
| 016 | `text-number-negative-rounding` | 数字 `TEXT()` 格式在负数 `.5` 边界处四舍五入背离零。 |
| 017 | `source-sheet-prefix-no-match-error` | `source_sheet` 前缀无匹配时报告稳定错误。 |
| 018 | `source-formula-missing-cached-result-error` | 没有缓存结果的源公式单元格报告稳定错误。 |
| 019 | `filename-empty-basename-error` | 文件名清洗对空基名报告错误。 |
| 020 | `filename-length-overflow-error` | 文件名清洗对超过 255 字节的长度报告错误。 |
| 021 | `numfmt-number-coercion-error` | 数字模板格式在强制失败时报告错误。 |
| 022 | `numfmt-date-coercion-error` | 日期模板格式在强制失败时报告错误。 |
| 023 | `today-utc-dynamic` | `TODAY()` 通过动态断言渲染运行器启动时的 UTC 日期。 |
| 024 | `stage2-merge-preservation` | 阶段 2 比较验证展开数据块下方的合并区域被保留。 |
| 025 | `stage2-style-numfmt-preservation` | 阶段 2 比较验证渲染单元格保留模板样式与 numFmt。 |
| 026 | `stage2-splice-merge-style-preservation` | 阶段 2 比较验证行展开同时保留被位移的合并以及带样式/数字格式的渲染单元格。 |
| 027 | `stage2-cross-writer-canonicalization` | 阶段 2 比较验证已知的 OOXML 写出端差异规范化为相同的工作簿内容。 |
| 028 | `source-table-row-shorthand` | `source_table = N` 选取第 `N` 行作为源列名，并读取其下方的行。 |
| 029 | `source-table-open-range` | `source_table = B3:D` 选取一个列窗口，并读取其下方直至已用行末的行。 |
| 030 | `source-table-finite-range` | `source_table = B3:D4` 在声明的末行处停止读取。 |
| 031 | `source-table-zero-data-range` | `source_table = B3:D3` 有效，产生零个源行。 |
| 032 | `source-table-empty-column-name-error` | 选中跨度内的空源列名报告稳定错误。 |
| 033 | `source-table-duplicate-column-name-error` | 重复的源列名报告稳定错误。 |
| 034 | `source-table-invalid-selector-error` | 无效选择子（如第零行）报告稳定错误。 |
| 035 | `source-table-rich-text-header` | 富文本的源列名单元格在 source_table 解析前会先拼接。 |
| 036 | `source-table-formula-header` | 公式型的源列名单元格使用缓存结果。 |
| 037 | `source-table-formula-header-missing-cache-error` | 没有缓存结果的公式型源列名单元格报告稳定错误。 |
| 038 | `source-sheet-exact-match-beats-prefix` | `source_sheet` 的精确匹配优先于前缀模式。 |
| 039 | `source-sheet-default-first-worksheet` | 如果省略 `source_sheet`，使用工作簿中按顺序的第一个工作表。 |
| 040 | `list-sheet-hidden-states-removed` | 隐藏与极度隐藏的列表工作表仍会从输出工作簿中移除。 |
| 041 | `row-function-inside-repeat-block` | `ROW()` 返回 repeat 块内当前已渲染数据行的 1 起始索引。 |
| 042 | `row-function-outside-repeat-block-error` | 在 repeat 块之外调用 `ROW()` 报告稳定错误。 |
| 043 | `ifempty-function` | `IFEMPTY()` 对空值返回回退值，对非空值原样透传。 |
| 044 | `sort-and-top-order` | `@sort` 在 `@top` 之前运行，因此前 N 行来自已排序集合。 |
| 045 | `list-sheet-not-in-filter` | `@filter ... !in _Sheet` 保留值不在列表工作表中的行，并把列表工作表从输出中移除。 |
| 046 | `count-field-non-empty` | `COUNT([field])` 统计当前行集中非空的值。 |
| 047 | `aggregate-functions` | 核心聚合函数作用于当前已渲染的行集。 |
| 048 | `if-and-comparison-boundaries` | 比较运算符在零边界附近驱动 `IF()` 与 `@filter` 行为。 |
| 049 | `filename-sanitization-warning` | 对渲染后的文件名进行清洗会发出警告，但不改变输出语义。 |
| 050 | `empty-ifempty-whitespace-only` | 按 ADR-0007，IFEMPTY 将仅空白的字符串视为空。 |
| 051 | `empty-ifempty-zero-not-empty` | 按 ADR-0007，IFEMPTY 保留数字 0；数字永远不为空。 |
| 052 | `empty-count-field-whitespace-zero-false` | 按 ADR-0007，COUNT([field]) 统计非空值——空白为空，0 和 FALSE 非空。 |
| 053 | `empty-row-skip-whitespace-only` | 按 ADR-0007，若一个源行的每个单元格都为空（包括仅空白的单元格），该行被跳过。 |
| 054 | `empty-list-membership` | 按 ADR-0007，列表工作表在读入时丢弃空条目；空的源行值永远不匹配 `@filter ... in _Sheet`。 |
| 055 | `if-truthy-zero-and-empty` | 按 ADR-0008，IF 将 0 与空值视为假值；非零数字、非空字符串以及 TRUE 视为真值。 |
| 056 | `if-truthy-string-zero-not-special` | `IF("0", …)` 与 `IF("false", …)` 取真值分支——对字符串型的标志值没有特殊处理。 |
| 057 | `if-truthy-boolean` | 按 ADR-0008，布尔源单元格直接驱动 IF 的真值。 |
| 058 | `if-comparison-result` | 按 ADR-0008，比较表达式的布尔结果直接喂给 IF 的真值。 |
| 059 | `compare-numeric-string-vs-number` | 按 ADR-0009，在共享的 `compareValues` 下，比较会解析数字与数值字符串。 |
| 060 | `compare-string-codepoint-order` | 按 ADR-0009，字符串回退比较使用 Unicode 码点顺序——不进行区域感知的整理。 |
| 061 | `concat-canonical-form` | 按 ADR-0009，`&` 使用规范字符串形式对操作数字符串化（布尔为大写、整数不带小数）。 |
| 062 | `concat-empty-stringifies-to-empty` | 按 ADR-0009，`&` 对空操作数贡献空字符串。 |
| 063 | `compare-empty-vs-value` | 按 ADR-0009 规则 1 与 2，两个空操作数比较相等；恰好一个为空则 `=` 为假。 |
| 064 | `compare-unicode-minus-not-numeric` | 按 ADR-0009，含 Unicode 减号（U+2212）的字符串不解析为数字；比较回落到规范字符串。 |
| 065 | `input-text-default-applied` | 按 ADR-0010，宿主省略值时 `__inputs__` 文本输入的默认值会填入。 |
| 066 | `input-text-host-supplied` | 按 ADR-0010，宿主提供的输入会流经单元格、工作表名和输出文件名模式。 |
| 067 | `input-missing-required-error` | 按 ADR-0010，宿主省略必填的（无默认值的）`__inputs__` 声明属于错误。 |
| 068 | `input-select-host-supplied` | 按 ADR-0010，`select` 输入接受声明的竖线分隔选项中列出的宿主值。 |
| 069 | `source-multi-declaration` | 按 ADR-0012，`__sources__` 工作表声明了一个额外的具名源；对其聚合作用于其完整行集。 |
| 070 | `source-aggregate-cross-source` | 按 ADR-0012，对具名源的 COUNT/MIN/MAX 作用于其完整行集。 |
| 071 | `source-directive-active` | 按 ADR-0012，`@source SourceName` 限定数据块范围；其中 `[Column]` 解析到该源。 |
| 072 | `source-undeclared-error` | 按 ADR-0012，`@source` 引用未在 `__sources__` 中声明的源属于解析期错误。 |
| 073 | `source-row-cross-error` | 按 ADR-0012，对非活动源列的行级引用属于错误。 |
| 074 | `xlookup-basic` | 按 ADR-0013，三参数 XLOOKUP 对首个查找数组匹配的行返回对应的返回数组列。 |
| 075 | `xlookup-fallback` | 按 ADR-0013，四参数 XLOOKUP 在没有匹配时返回回退值。 |
| 076 | `xlookup-no-match-error` | 按 ADR-0013，无回退值的三参数 XLOOKUP 在没有匹配时报错。 |
| 077 | `xlookup-source-mismatch-error` | 按 ADR-0013，XLOOKUP 的第 2 个与第 3 个参数必须引用同一个源。 |
| 078 | `xlookup-bare-bracket-error` | 按 ADR-0013，XLOOKUP 的第 2/3 个参数要求带源前缀的方括号引用。 |
| 079 | `join-basic-inner` | 按 ADR-0014，`@join` 将每个主行与首个匹配的被联结行配对。 |
| 080 | `join-no-match-dropped` | 按 ADR-0014，`@join` 使用 inner 语义——没有匹配的主行被丢弃。 |
| 081 | `join-undeclared-source-error` | 按 ADR-0014，`@join` 引用未在 `__sources__` 中声明的源属于解析期错误。 |
| 082 | `join-bad-on-clause-error` | 按 ADR-0014，`@join` 的 on 子句必须引用被联结的源以及该块的主源。 |
| 083 | `sort-stable-equal-keys` | 按 ADR-0016，`@sort` 是稳定的——键相等的行保留源顺序。 |
| 084 | `sort-multi-stable-priority` | 按 ADR-0016，多条 `@sort` 指令按首条 = 主键、后续指令为决胜键的方式应用。 |
| 085 | `file-group-first-seen-order` | 按 ADR-0016，文件分组按源行中的首次出现顺序输出。 |
| 086 | `sheet-group-first-seen-order` | 按 ADR-0016，文件内的工作表分组按首次出现顺序输出。 |
| 087 | `date-canonical-string-concat` | 按 ADR-0017，`&` 中的日期产出 YYYY-MM-DD（午夜）或 YYYY-MM-DDTHH:mm:ss。 |
| 088 | `date-comparison-equality` | 按 ADR-0017，日期值通过规范字符串形式与字符串过滤值比较。 |
| 089 | `error-sentinel-empty` | 按 ADR-0017，Excel 错误单元格（`#N/A`、`#VALUE!`……）读取为空。 |
| 090 | `percentage-numeric-flow` | 按 ADR-0017，百分比格式的单元格以其底层数字流转（50% → 0.5）。 |

## 状态

XTL 0.1 语料处于**引导状态**。仅应针对已在 [`spec/README.md`](/zh-CN/spec) 中表述的行为添加 fixture，遵循 CommonMark 等标准项目的同一模式：散文定义规则，fixture 让规则可执行，实现报告其通过了哪些 fixture。

参考实现本身的行为不具有规范性。当 fixture 与实现不一致时，依据 [`spec/README.md`](/zh-CN/spec) 中的规范优先级，更新实现或更新 fixture。

XTL 0.1 核心行为的 fixture 避免使用实现定义的扩展，例如 [`spec/language.md`](/zh-CN/spec/language) 中最小表格之外的 `TEXT()` 格式。
