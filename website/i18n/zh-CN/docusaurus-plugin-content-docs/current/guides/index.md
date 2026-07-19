---
slug: /guides
sidebar_label: '概览'
pagination_label: '概览'
---

# XTL 指南

针对常见报表工作流的精简、可直接复制粘贴的速查手册。每篇指南都是一页简短的 Markdown，包含场景、模板单元格与期望输出。

这些指南是对现有两类资料的补充：

- **[`examples/`](https://github.com/xl3-lang/xl3/tree/main/examples/)** 中提供了四份可运行的模板，端到端地展示组合后的形态。挑一份复制下来作为起点即可。中文示例请参考 `04-cafe-weekly-report`。
- **[`spec/language.md`](/zh-CN/spec/language)** 是每个函数和指令的规范参考（英文）。当某个场景在速查手册中找不到时，请查阅它。

这里的速查手册更看重"用最小的模板演示某个特性"，而不是"贴近生产现实"——目标是当你大致记得形态、但忘了具体语法时能快速翻到答案。

## 速查列表

| # | 速查 | 你将学到 |
|---|---|---|
| 01 | [5 分钟入门](/guides/getting-started) | 模板 + 数据 → 输出。替换与 `__config__`。 |
| 02 | [条件单元格](/guides/conditional-cells) | `IF`、`IFEMPTY`、比较运算符、真值判定。 |
| 03 | [行集合上的聚合](/guides/aggregates) | `SUM`、`COUNT`、`AVERAGE`、`MIN`、`MAX`——按数据块 vs 按整张源。 |
| 04 | [按分组拆分文件](/guides/file-per-group) | 通过 `output_file_pattern` 进行文件分组。 |
| 05 | [按分组拆分工作表](/guides/sheet-per-group) | 工作表分组 + 列表过滤。 |
| 06 | [运行时输入](/guides/runtime-inputs) | 用 `__inputs__` 接收每次运行的参数（月份、区域等）。 |
| 07 | [多数据源 + `@join`](/guides/multi-source-join) | `__sources__`、`@source`、`@join`。 |
| 08 | [`XLOOKUP`](/guides/xlookup) | 跨源查找。 |
| 09 | [排序与 Top-N](/guides/sort-and-top) | `@sort`（稳定排序）、`@top`、多键排序。 |
| 10 | [样式与品牌化](/guides/styling-and-branding) | `tabColor`、合并单元格、`numFmt`、`TEXT()`。 |
| 11 | [`TEXT()` 格式化](/guides/text-formatting) | 货币、日期、百分比；`numFmt` 与 `TEXT()` 的取舍。 |
| 12 | [空值进阶](/guides/empty-values) | `IFEMPTY`、空与零的陷阱、`(blank)`、稀疏数据上的聚合。 |
| 13 | [宿主侧的错误处理](/guides/error-handling) | 捕获 `XtlError`、错误码目录、用于快速失败的 `preview()`。 |
| 14 | [当作值字典的 `__config__`](/guides/config-values) | 作者自定义键、类型感知、`__config__` vs `__inputs__`。 |
| 15 | [组合指令](/guides/directive-composition) | 执行顺序、多个 `@filter` 的 AND、禁止的组合。 |
| 16 | [XTL 函数 vs Excel 公式](/guides/xtl-vs-excel-formula) | 何时使用 `{{ ... }}` vs `=...` 单元格公式。ADR-0043 中的渲染时 / 打开时分界线。 |
| 17 | [模板编辑时的显示](/guides/template-authoring-display) | 编辑模板时 Excel 中看到的画面（错误、占位符），为什么这是预期行为，以及面板用 `IFERROR` 包裹的惯例。 |
| 18 | [`@group` 与 `@subtotal`](/guides/group-and-subtotal) | 在同一数据块内交错输出分组小计行（ADR-0038）——单层、嵌套、用最外层 @subtotal 实现总计。 |

## 如何阅读一篇速查

每篇速查都遵循相同结构：

1. **场景**——一句话描述操作员希望得到的结果。
2. **`__config__`**——需要的键。
3. **模板单元格**——能产出结果的最小单元格集合。
4. **数据**——一小张输入表。
5. **输出**——`convert()` 返回的内容。
6. **备注**——需要小心的点，以及想深入了解时该看哪一段规范。

## 表示约定

- 单元格沿用 Excel 使用的 `A1` 表示法，而不是 `[row, col]`。
- `__config__` 的值为了简洁写成 `key = value`，但在真实的 `template.xlsx` 中它们占两列（`A: key`、`B: value`）。
- 源数据用 Markdown 表格展示以保持速查简短。真实的 `data.xlsx` 会把这些行放在与 `source_sheet` 同名的工作表里。

## 运行一篇速查

指南中的速查以文档为主——不是每篇都附带可运行的 `.xlsx` 二人组。想自己跑一遍：

1. 打开 Excel，新建一个工作簿。
2. 添加 `__config__` 工作表，填入速查中列出的键。
3. 添加与 `source_sheet` 同名的数据工作表。
4. 添加模板工作表，把速查中的单元格内容填入。
5. 另存为 `template.xlsx`，数据另存为 `data.xlsx`。
6. 调用 `convert(templateBuffer, dataBuffer)`（参考 [README](/readme#usage)）。

或者更快——直接复制一份[可运行示例](https://github.com/xl3-lang/xl3/tree/main/examples/)再按需修改。
