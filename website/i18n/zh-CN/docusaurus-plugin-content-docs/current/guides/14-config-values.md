---
sidebar_label: '14 · 当作值字典的 __config__'
pagination_label: '14 · 当作值字典的 __config__'
---

# 14 · `__config__` 作为值字典

## 场景

很多单元格会引用同一个常量——部门名、日期阈值、续约下限。把字面量散落到每个单元格里很脆弱，一次更新就要在模板里到处搜。`__config__` 同时也充当一份值字典，作者可以在任意单元格中读取它。

## 工作原理

按 ADR-0011，`__config__` 是一张保留的配置工作表，有两列：`key` 和 `value`。一些键是规范定义的（`name`、`description`、`source_sheet`、`source_table`、`output_file_pattern`、`match_pattern`）。其它键由作者自定义，可以通过下面的方式访问：

```text
{{ __config__[key_name] }}
```

## 示例

`__config__`：

| 键 | 值 |
|---|---|
| `source_sheet` | `原始` |
| `source_table` | `1` |
| `output_file_pattern` | `report.xlsx` |
| `priority_threshold` | `10000` |
| `default_region` | `北京` |
| `report_owner` | `美娜` |

模板单元格：

```text
{{ "制作：" & __config__[report_owner] }}
{{ IF([续约金额] > __config__[priority_threshold], "优先", "普通") }}
{{ IFEMPTY([区域], __config__[default_region]) }}
```

把 `priority_threshold` 从 10000 改成 5000，每个相关单元格都会同步更新。作者只需在 `__config__` 中改一行，不必去改散落各处的 20 条表达式。

## 类型感知

存进 `__config__` 的值会保留作者所用单元格的类型：

- 数字单元格变成数字（`10000` 按数值比较）。
- 字符串单元格变成字符串。
- 日期单元格变成 Date。
- 布尔变成布尔。

```text
__config__[priority_threshold] > 5000     ← 数值比较
__config__[start_date] = TODAY()           ← 日期比较
```

如果要强制某种类型，请按对应的 Excel 单元格类型存储。在模板里显式转换可使用 `TEXT()`（数字 → 字符串）或算术（`__config__[x] + 0` 把数字形字符串强转为数字）。

## 不可复用的保留键

按 ADR-0011，下列 `__config__` 键由规范定义、由引擎读取，请不要用自定义语义遮蔽它们：

- `name`
- `description`
- `source_sheet`
- `source_table`
- `output_file_pattern`
- `match_pattern`

自定义键**不可**匹配 `^__[a-z]+__$`（按 ADR-0027，被双下划线包裹的名字如 `__foo__` 是保留的）。开头单个 `_` 没问题。其它任何合法标识符都可以。

## 为什么不放到源数据里？

在工作流里实现"共享常量"有两种方式：

1. **`__config__` 自定义键** ——值放在模板里。更新意味着要为模板出新版本。适合组织级常量，操作员不应改动。
2. **带 `default` 的 `__inputs__` 声明** ——值放在模板里，但宿主可以按运行覆盖。适合按次运行的参数（目标月份、阈值），操作员可能会调整。

用 `__config__` 表示"模板写死了这些常量；要改就出新模板"。用 `__inputs__` 表示"模板接收参数；每次运行由宿主决定"。

## 规范参考

- ADR-0011 ——保留工作表命名。
- [`spec/evaluation.md`](/spec/evaluation) "Template Configuration"。
- [Cookbook 06](/guides/runtime-inputs) ——`__inputs__`（按次运行的替代方案）。
