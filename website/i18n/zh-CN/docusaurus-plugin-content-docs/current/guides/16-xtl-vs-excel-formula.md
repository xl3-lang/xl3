---
sidebar_label: '16 · XTL 函数与 Excel 公式对比'
pagination_label: '16 · XTL 函数与 Excel 公式对比'
---

# 16 · XTL 函数 vs Excel 公式

## 常见坑点 — 从这里开始

你打开这页通常是因为某些东西没按预期工作。最有可能的几种情况：

### "我想在单元格里显示 `￥1,234,567`，`TEXT([金额], "￥#,##0")` 不起作用"

XTL 的 `TEXT()` 故意只提供了一小套格式 token，货币 token 不在其中。正确做法是用单元格的**数字格式（numFmt）**：

| 步骤 | 位置 |
|---|---|
| 1. 在模板单元格里把单元格格式设为 `"￥"#,##0` | Excel 的"设置单元格格式"对话框 → 自定义 |
| 2. 在该单元格里写 `{{ [金额] }}`（裸数字） | XTL 替换 |

渲染出的单元格里存的是数字，Excel 把它显示为 `￥1,234,567`。因为值仍然是数字，排序、过滤和下游公式都能照常工作。

同样的模式可以处理 `(1,234)` 形式的会计负数（`#,##0;(#,##0)`）、百分比（`0.00%`）和日期（`yyyy-mm-dd`）。

### "我想让 `=B2*2` 按行计算，但每行都显示同一个结果"

xl3 在 `@repeat` 行展开时**逐字保留**你的公式文本——它**不会**把 `B2` 重写成 `B3`、`B4` 等（契约见 ADR-0046）。

改用 XTL 表达式：

```text
{{ [金额] * 2 }}
```

这会在每行渲染时求值，并把计算出的数字写入对应单元格。结果一样，但没有行引用混乱的问题。

### "我想在底部加合计，`=SUM(B2:B5)` 在行展开时范围不会跟着扩"

根源相同——xl3 不会重写范围引用。两种选项：

- **整列引用** 写在页脚：`=SUM(B:B)`（或在上游用 `@filter` 只留下数据行）。
- **XTL 聚合**：在页脚单元格里写 `{{ SUM([金额]) }}`。渲染时计算并写入数字。

### "我想给每行加可点击的链接"

使用 XTL 的 `HYPERLINK()` 函数（URL/label 都可以引用列）：

```text
{{ HYPERLINK([链接], [显示名]) }}
```

如果是静态 URL，单元格里写普通的 `=HYPERLINK("https://...", "label")` 公式也可以（xl3 会保留）。

### "我写了 5 个分支的 `IF(...)`，嵌套读不下去"

`IFS(c1, v1, c2, v2, ...)` 是 XTL 的多分支条件函数。最后以 `TRUE, default` 收尾作为兜底：

```text
{{ IFS([R] > 10000, "VIP", [R] > 1000, "普通", TRUE, "轻量") }}
```

### "我想要 `SUMPRODUCT` 那种 `SUM(数量 * 单价)`"

XTL 聚合不接受参数里的按行算术。`{{ SUM([数量] * [单价]) }}`、`{{ SUM([A] + [B]) }}`、`{{ AVERAGE([销售额] - [成本]) }}` 这类形态会在解析期抛出 `xl3/eval/bad-aggregate-arg`（ADR-0059）。参数必须是单一列引用：`[Column]` 或 `Source[Column]`。

三种解决方案（按推荐顺序）：

1. **上游添加辅助列** ——在源里加一列 `金额`（用公式计算或预先相乘），然后 `{{ SUM([金额]) }}`。这是 "A × B 之和" 总计的标准 XTL 模式。
2. **在页脚单元格里写原生 Excel `SUMPRODUCT`** ——xl3 按 ADR-0046 原样保留单元格公式。在页脚单元格里直接写 `=SUMPRODUCT(E2:E10000, F2:F10000)`。由于在编写时还不知道渲染后的行数，请使用超出范围（`E2:E10000`）。注意两个页脚陷阱（自列求和；行超出范围导致重复计算）——参见 [LLM 模板编写指南 § Footer pitfalls](https://github.com/jinyoung4478/xl3/blob/main/docs/llm-template-authoring.md#footer-pitfall-1--self-column-sum-raises-순환-참조-circular-reference)。
3. **行级 XTL 单元格 + 渲染输出里的辅助列** ——在行级单元格里写 `{{ [数量] * [单价] }}`（可行，这是非聚合上下文），如果 `HelperColumn` 也是源列，再用 `{{ SUM([HelperColumn]) }}` 求和。否则又回到方案 1 或 2。

为什么有这个限制：XTL 0.x 保持函数面尽量小且可预测。按行计算后聚合（Excel 的数组公式行为）是被延后的特性——参见 ADR-0059 § "Why not allow `SUM([a] + [b])`"。

### "我在找 `SUMIF` / `COUNTIF` / `AVERAGEIF`"

别去找这些函数——用数据块模式。要"统计状态为 VIP 的金额之和"：

```text
{{ @filter [状态] = "VIP" }}
{{ @repeat down }}
... 数据行模板 ...
{{ SUM([金额]) }}
```

如果你既要展示过滤后的总和，又要展示未过滤的行，那就在单元格里直接写 `=SUMIF(B:B, "VIP", C:C)`——xl3 会保留公式，由 Excel 在打开时求值。

### "我想要 `ISBLANK(x)`"

自 0.5.x 起已有（ADR-0047）。当值按 ADR-0007 算空时返回 `true`——包括仅含空白字符的字符串。

```text
{{ IF(ISBLANK([备注]), "(无)", [备注]) }}
```

回退形态也可用 `IFEMPTY([备注], "(无)")`。两者判定的是同一个谓词。

---

## 通用规则

> **只有当值必须在工作簿写出**之前**就知道，才使用 XTL `{{ ... }}`；否则把公式放进单元格，让 Excel 在打开时求值。**

边界就是渲染时刻：

- **渲染前 — 必须 XTL：** `@filter`、`@sort`、`@top`、`@group`、`@subtotal`、源数据聚合（`SUM`、`COUNT`、…）、跨源 `XLOOKUP`、`output_file_pattern`、`__sheet_name_pattern__`、`__inputs__` 默认值。Excel 无法触达这里——没有可供其求值的单元格。
- **渲染后 — Excel 完全够用：** 单元格显示格式、对已渲染值的逐单元格算术、对输出值的字符串变换、类型测试、从输出单元格抽取日期部件。

这一原则是规范性的（ADR-0043），它通过构造让 XTL 函数面保持小。XTL 表里没有的 Excel 函数，都是有意走"Excel 公式路径"的。

---

## 并排速查表

| 目标 | XTL 写法 | Excel 公式写法 | 选哪个 |
|---|---|---|---|
| 显示数字 `1,234,567.00` | `{{ TEXT([A], "#,##0.00") }}`（字符串） | 单元格 `numFmt = "#,##0.00"`，值 `{{ [A] }}`（数字） | **Excel 公式**做视觉；需要字符串时用 XTL |
| 显示 `￥1,234,567` | （XTL 不支持） | 单元格 `numFmt = "￥"#,##0` | **Excel 公式** |
| 负数加括号 | （不支持） | 单元格 `numFmt = #,##0;(#,##0)` | **Excel 公式** |
| 行级算术（`*2`） | `{{ [A] * 2 }}` | `=B2*2` ❌ 不会逐行重写 | **XTL** |
| 页脚 SUM 涵盖展开区域 | `{{ SUM([A]) }}` | `=SUM(B:B)` 整列可用 | 都行 |
| `SUMPRODUCT`：A × B 求和 | 上游辅助列 + `{{ SUM([金额]) }}` | 页脚单元格里 `=SUMPRODUCT(E2:E10000, F2:F10000)` | **Excel 公式**或辅助列——`SUM([A]*[B])` 会抛 `xl3/eval/bad-aggregate-arg` |
| 静态超链接 | （无须） | `=HYPERLINK("...", "label")` | **Excel 公式** |
| 行级动态超链接 | `{{ HYPERLINK([链接], [显示名]) }}` | 难以实现（引号地狱） | **XTL** |
| 过滤"本月" | `{{ @filter MONTH([日期]) = MONTH(TODAY()) }}` | （Excel 无法在渲染前过滤） | **仅 XTL** |
| 文件名 "上个月" | `{{ TEXT(EDATE(TODAY(), -1), "YYYY-MM") }}.xlsx` | （文件名里没有公式路径） | **仅 XTL** |
| 多分支等级标签 | `{{ IFS([R]>10000, "VIP", [R]>1000, "Std", TRUE, "轻量") }}` | `=IFS(B2>10000, "VIP", ...)` | 都行；过滤/分组依赖时用 XTL |
| 条件聚合 | `@filter` + `SUM` 块 | `=SUMIF(B:B, "VIP", C:C)` | 块级合计用 XTL；横向跨切面用 Excel 公式 |
| `MOD` / `INT` / `SQRT` / `POWER` | （XTL 不支持） | 单元格公式 | **Excel 公式** |
| 空值检查 | `ISBLANK([X])` 或 `IFEMPTY([X], "fallback")` | `=ISBLANK(B2)` | 都行；ISBLANK 与 Excel 习惯一致 |
| 其他 `IS*` 类型检查 | （不支持） | `=ISNUMBER(B2)` 等 | **Excel 公式** |

---

## 快速决策树

```
该值影响：
  • 哪些行被渲染？             → @filter / @sort       (XTL)
  • 行如何分组？               → @group / @subtotal    (XTL)
  • 输出文件名？               → {{ ... }}             (XTL)
  • 工作表名？                  → {{ ... }}             (XTL)
  • __inputs__ 默认值？        → {{ ... }}             (XTL)
  • 行级计算后的显示？         → {{ ... }}             (XTL)
  • 单元格的*视觉外观*？       → 单元格 numFmt         (Excel 侧)
  • 行级公式？                  → {{ ... }} 表达式      (XTL)
  • 整列 / 静态计算？           → 单元格里 =FORMULA    (Excel 侧)
```

---

## 为什么会有这条规则

XTL 函数面通过构造保持小（ADR-0043），让 porter 有清晰的目录可实现。仅供单元格输出的函数只会重复 Excel 已有的能力，并使规范膨胀。

权衡在于：当作者使用单元格公式时，xl3 输出的工作簿不再完全自包含——打开它依赖 Excel 重算。对大多数业务报表来说，这本来就是预期工作流。

当你发现自己想要某个 XTL 没有的函数时：

1. **该值是否用在指令（`@filter`、`@sort`、`@top`、`@group`、`@subtotal`）中，或用在 `output_file_pattern` / `__sheet_name_pattern__` 里？** → 必须用 XTL。如果 XTL 没有你需要的函数，请用 "Function re-proposal" 模板在 GitHub Issues 上提议。
2. **否则** → 直接把 Excel 公式放进单元格。xl3 会保留它，Excel 在打开时求值。

## 另见

- [ADR-0043 — Excel-native preference principle](/zh-CN/spec/decisions/0043-excel-native-preference)
- [ADR-0044 — Function batch accepted](/zh-CN/spec/decisions/0044-function-batch-accepted)
- [ADR-0045 — Function batch rejected](/zh-CN/spec/decisions/0045-function-batch-rejected)
- [ADR-0046 — Cell formula preservation contract](/zh-CN/spec/decisions/0046-cell-formula-preservation)
- [ADR-0047 — ISBLANK as IFEMPTY alias](/zh-CN/spec/decisions/0047-isblank-as-ifempty-alias)
- [Cookbook 10 — 样式与品牌化](./10-styling-and-branding.md) ——`numFmt` 才是答案的时候
- [Cookbook 11 — TEXT() 格式化](./11-text-formatting.md) ——`TEXT()` *正是* 答案的时候
- [Cookbook 12 — 空值进阶](./12-empty-values.md) ——IFEMPTY / ISBLANK 搭档
