---
sidebar_label: '12 · 空值进阶'
pagination_label: '12 · 空值进阶'
---

# 12 · 空值进阶

## XTL 中"空"的定义

按 ADR-0007：

- **空**：missing/null/undefined，或仅含 Unicode 空白字符的字符串。
- **非空**：数字 `0`、布尔 `false`、任何非空白字符串、任何日期。

字符串 `"0"` 和 `"false"` 是非空的。要把它们过滤掉，请显式比较：`[金额] != "0"`。

## `IFEMPTY` — 缺失值的回退

```text
{{ IFEMPTY([负责人], "未指派") }}
{{ IFEMPTY([备注], "—") }}
{{ IFEMPTY([区域], __config__[default_region]) }}
```

`IFEMPTY(value, fallback)` 仅当 `value` 为空时返回 `fallback`。对 `0` 或 `false` **不触发**。

## 空 vs 零 — 一个常见 bug

```text
{{ IFEMPTY([金额], "n/a") }}        → 对金额为零的行，返回数字 "0"
{{ IF([金额] = 0, "n/a", [金额]) }} → 对金额为零的行，返回 "n/a"
```

如果你希望"缺失"和"零"都显示为 `n/a`：

```text
{{ IF(IFEMPTY([金额], 0) = 0, "n/a", [金额]) }}
```

## 空的分组键 → `(blank)`

按 ADR-0026，分组键值为空的行会产生：

- 文件名 `(blank).xlsx`（如果用在 `output_file_pattern` 里）。
- 工作表名 `(blank)`（如果用在工作表名模板里）。

这与 Excel 数据透视表惯例一致。如果你更希望响亮失败，请在上游过滤：

```text
{{ @filter [区域] != "" }}        ← 丢弃区域为空的行
```

## 聚合里的空值

`SUM`、`COUNT`、`AVERAGE`、`MIN`、`MAX` 会跳过空值：

```text
data:    [10, 20, "", 30]
SUM:     60     （不报错）
COUNT:   3      （而不是 4）
AVERAGE: 20     （而不是 15）
```

对 0 个非空值求 `AVERAGE` 返回空（empty），不报错。要显式检测这种情况，用 `IFEMPTY` 包裹：

```text
{{ IFEMPTY(AVERAGE([金额]), "无数据") }}
```

## `IF` 条件里的空值

真值判定（按 ADR-0008）：

- 空 → 假。
- 数字 `0` → 假。
- 布尔 `false` → 假。
- 字符串 `"0"` 和 `"false"` → **真**（非空字符串）。
- 任意日期 → 真。

```text
{{ IF([区域], [区域], "未知") }}      → 区域为 "" 时返回 ""，否则返回区域
{{ IF([金额], [金额], "无数据") }}    → 金额为 0 或空时返回 "无数据"
```

## 单表达式单元格中的空值

按 ADR-0026：只包含 `{{ expr }}` 的单元格，如果表达式求值为空，结果就是一个空单元格（不报错）。该单元格在 OOXML 中存在，但其值为空。再次通过 xl3 读取时按 ADR-0007 仍为空。

如果单元格混合了字面量：`{{ [金额] }} 元`，结果会是 `" 元"`（空数字字符串化为空 + 前置的空格）。

## 规范参考

- [`spec/evaluation.md`](/spec/evaluation) "Empty Values"。
- ADR-0007（空值定义）、ADR-0008（真值判定）、ADR-0026（生命周期）。
- [Cookbook 02](/guides/conditional-cells) ——IF / IFEMPTY 基础。
