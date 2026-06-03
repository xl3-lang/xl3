# 规范导航索引

供移植者与审阅者使用的交叉索引表。每一行将语言/求值章节链接到定义它的 ADR，以及验证它的一致性 fixture。当你想回答"关于 X 的规范性文本在哪里？"而不想 grep 时，请使用本页。

fixture 列展示编号最低的 fixture；完整的 ADR ↔ fixture 矩阵请参见 [`coverage.md`](/zh-CN/conformance/coverage)。

| 表面 | 规范章节 | 主导 ADR | 示例 fixture |
|---|---|---|---|
| 模板块 `{{ ... }}` | language.md "Template Blocks" | — | 001 |
| 源列 `[Col]` | language.md "Source Columns" | — | 001, 002 |
| 带源前缀的方括号 `Source[Col]` | language.md "Source Columns"; evaluation.md "External Data Sources" | ADR-0012 | 069, 070, 071 |
| 字面量（字符串 / 数字 / 布尔） | language.md "Literals" | — | 011, 012 |
| 运算符（`=`、`!=`、`>`、`<`、`>=`、`<=`、`+`、`-`、`*`、`/`、`&`） | language.md "Operators" | ADR-0009 | 058, 059, 061 |
| 比较算法 | language.md "Comparison Algorithm" | ADR-0009, ADR-0017 | 059–064, 087, 088 |
| 规范字符串形式 | language.md "Canonical String Form" | ADR-0009, ADR-0017 | 061–063, 087 |
| `IF()` | language.md "IF" | ADR-0008 | 055–058 |
| `IFEMPTY()` | language.md "IFEMPTY" | ADR-0007 | 050, 051 |
| `XLOOKUP()` | language.md "XLOOKUP" | ADR-0013 | 074–078 |
| 聚合（`SUM`/`COUNT`/`AVERAGE`/`MIN`/`MAX`） | language.md "Aggregates" | ADR-0007, ADR-0012 | 052, 070, 091 |
| `ROUND()` / `ABS()` | language.md "Numeric Functions" | — | 005, 016 |
| `TEXT()` | language.md "Text Formatting" | — | 011, 012, 016 |
| `ROW()` | language.md "Row and Date Functions" | — | 037 |
| `TODAY()` | language.md "Row and Date Functions" | ADR-0001 | 023 |
| `@filter` | language.md "Filter" | ADR-0007（成员判定）、ADR-0009（比较） | 003, 035, 054 |
| `@sort` | language.md "Sort" | ADR-0009, ADR-0016 | 036, 083, 084 |
| `@top` | language.md "Top" | — | 036 |
| `@repeat right` | language.md "Repeat Right" | — | 004 |
| `@source` | language.md "Source"; evaluation.md "External Data Sources" | ADR-0012 | 071, 072 |
| `@join` | language.md "Join"; evaluation.md "External Data Sources" | ADR-0014 | 079–082 |
| 分组键 | language.md "Group Keys" | ADR-0016 | 015, 085, 086 |
| 空值 | evaluation.md "Empty Values" | ADR-0007 | 050–054 |
| 真值判定 | evaluation.md（交叉引用） | ADR-0008 | 055–058 |
| 保留工作表（dunder） | evaluation.md "Reserved Sheets" | ADR-0011 | 094 |
| `__config__` | evaluation.md "Template Configuration" | ADR-0011 | 多数 |
| `__inputs__` | evaluation.md "Inputs" | ADR-0010, ADR-0011 | 065–068 |
| `__sources__` | evaluation.md "External Data Sources" | ADR-0011, ADR-0012 | 069–073 |
| `__lists__` | evaluation.md "List Sheets" | ADR-0007, ADR-0011 | 053, 054 |
| 源值模型 | evaluation.md "Source Value Model" | ADR-0017 | 087–090 |
| 源数据模型（零行、表头读取） | evaluation.md "Source Data Model" | — | 028–031 |
| 单元格文本抽取 | evaluation.md "Cell Text Extraction" | — | 013, 014 |
| 单表达式单元格 / numFmt 强制转换 | evaluation.md "Single-Expression Cells" | ADR-0003 | 008–010 |
| 输出文件名 | evaluation.md "Output Filenames" | ADR-0002 | 006, 007, 019, 020 |
| 错误（目录） | evaluation.md "Errors" | ADR-0015 | 017–022, 067, 072–082, 091 |
| 资源限制 | evaluation.md "Resource Limits" | — | （实现自定义；无 fixture） |
| 渲染阶段 | evaluation.md "Render Phases" | — | 002 |
| 顺序 | evaluation.md "Ordering" | ADR-0016 | 083–086 |
| Stage 2 OOXML 规范化 | conformance/runner-protocol.md "Stage 2" | ADR-0006 | 024–027, 093 |
| 动态一致性断言 | conformance/runner-protocol.md "Dynamic" | ADR-0005 | 023 |
| Excel 版本兼容性 | （信息性） | ADR-0022 | （无 fixture；编写指导） |
| 运算符强制转换 + Excel 默认原则 | language.md "Arithmetic" | ADR-0023 | 100, 101 |
| 函数元数（规范性表格） | language.md "Functions" 元数表 | ADR-0024 | 102, 103 |
| 除零 → `#DIV/0!` 错误单元格 | language.md "Arithmetic" | ADR-0025 | 106 |
| 多个 `@filter` 以 AND 组合 | language.md "Filter" | （无 ADR；规范行） | 104 |
| `{{ }}` 内部空白无关 | language.md "Template Blocks" | （无 ADR；规范行） | 105 |
| 空值生命周期（单元格 + 分组键） | evaluation.md "Source Data Model" + "Output Filenames" | ADR-0026 | 107, 108 |
| 保留列名 + 指令校验 | evaluation.md "Source Data Model" + "Directives" | ADR-0027 | 109, 110, 111 |
| 字面量语法约束（字符串 + 数字） | language.md "Literals" | ADR-0028 | 112, 113 |
| 指令组合 + 源边界语义 | evaluation.md "External Data Sources" + "Source Data Model" | ADR-0029 | 114, 115, 116, 117 |
| Unicode 规范化（不应用） | language.md "Comparison Algorithm" | ADR-0030 | 118 |
| 输出文件名冲突视为错误 | evaluation.md "Output Filenames" | ADR-0031 | 119 |
| 边界限制与工作簿透传 | evaluation.md "Source Data Model" + "Cell Evaluation" | ADR-0032 | 120 |

## 实现自定义边界

XTL 0.1 有意把以下领域留给各实现自行决定。两个移植在这些方面选择不同**不会**让任何一方丧失一致性。完整目录见 [ADR-0021](/zh-CN/spec/decisions/0021-implementation-defined-boundaries)。

| 领域 | XTL 0.1 立场 |
|---|---|
| 内存 / 流式模型 | 实现自定义 |
| 同步 vs. 异步 API 形态 | 实现自定义 |
| 源中的原生 Excel 公式 | 必须：读取缓存结果，缺失则报错 |
| 模板中的原生 Excel 公式 | 实现自定义（通常透传） |
| 核心表以外的 `TEXT()` 格式 | 实现自定义扩展 |
| 行扩展下的合并单元格保留 | 必须（上方/下方）；数据块内部为实现自定义 |
| `__config__` 中作者自定义的键 | 必须：可通过 `{{ __config__[key] }}` 访问 |
| 空源（零行） | 实现自定义输出，不报错 |
| 文件名清理后的工作表名冲突 | 实现自定义 |
| 空模板块 `{{   }}` | 错误 |
| 输入中非模板、非保留的工作表 | 实现自定义（通常透传） |

## 延后的表面

以下内容**不**在 1.0 中。延后 ADR 解释了原因，并说明未来规范在加入该表面之前必须（**MUST**）解决的问题。

| 表面 | 状态 | 延后 ADR |
|---|---|---|
| 日期算术（`EOMONTH`、`EDATE`、`DATEDIF`、……） | 已延后 | ADR-0019 |
| 区域感知的排序规则 | 已延后 | ADR-0020 |
| 多个 `@join`、左连接、多行匹配 | 已延后 | ADR-0014（范围外章节） |
| XLOOKUP 通配符 / 近似 / 反向 | 已延后 | ADR-0013（范围外章节） |
| 跨写入器的 Stage 2 空白点（默认属性、颜色十六进制大小写、命名空间前缀） | 已延后 | ADR-0006 修订 |
