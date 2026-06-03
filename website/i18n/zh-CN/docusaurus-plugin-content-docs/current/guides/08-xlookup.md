---
sidebar_label: '08 · XLOOKUP 查找'
pagination_label: '08 · XLOOKUP 查找'
---

# 08 · `XLOOKUP`

## 场景

你想按一个键，从另一个源里拉出某一列的值。类似一次性的 `VLOOKUP` / `INDEX(MATCH(...))` / SQL `LEFT JOIN ... LIMIT 1`。

## 基本形态

```text
{{ XLOOKUP(lookup_value, lookup_array, return_array) }}
{{ XLOOKUP(lookup_value, lookup_array, return_array, fallback) }}
```

- `lookup_value` ——要查找的值。
- `lookup_array` ——另一源中用于搜索的列。
- `return_array` ——另一源中要返回值的列。
- `fallback`（可选） ——当没有匹配行时返回的值。

返回的是首条匹配行对应的 `return_array` 值。比较遵循 XTL 的标准比较算法（数字或数字形字符串按数值比较，字符串按 Unicode 码点比较）。不支持通配符、模糊匹配、反向搜索——按 ADR-0013 都不在范围之内。

## 示例

`__sources__`：

| name | sheet | table |
|---|---|---|
| `Customers` | `Customers` | `1` |

模板单元格：

```text
A2: {{ [customer_id] }}
B2: {{ XLOOKUP([customer_id], Customers[id], Customers[name]) }}
C2: {{ XLOOKUP([customer_id], Customers[id], Customers[tier]) }}
```

对默认源中的每一行，xl3 都按 `id` 在 Customers 中找到对应行，拉出 `name` / `tier`。

## 无匹配时的行为

如果 `lookup_value` 不在 `lookup_array` 中，且未提供 fallback，xl3 会抛出 `xl3/xlookup/no-match`。规范偏向"响亮失败"而非"静默丢失数据"。

要抑制错误，将 fallback 作为第 4 个参数传入：

```text
{{ XLOOKUP([customer_id], Customers[id], Customers[name], "(未知)") }}
```

没有匹配行时，返回 fallback。如果想"放过未匹配且不留占位符"，请在上游过滤，或改用 `@join`（会整行丢弃未匹配的行）。

## 跨源不一致保护

`lookup_array` 与 `return_array` **必须**来自同一个源。`XLOOKUP([id], Customers[id], Renewals[name])` 会抛出 `xl3/xlookup/source-mismatch`——混用源意味着要从一个跟匹配行没有任何意义关系的行位置取值。

## 性能

xl3 在首次对某个 `(rows, column)` 对执行 XLOOKUP 时会建立索引，因此后续对同一列的查找是 O(1)。每次 converter 运行的首次查找付出 O(N) 成本；同一数据块内的后续查找是常数时间。

## 备注

- 比较有类型感知：数字与数字形字符串可以跨类型匹配，所以 `XLOOKUP("42", Customers[id], ...)` 能找到 `id` 是数字 `42` 的行。
- 当每条主表行都需要与连接行配对时用 `@join`；只要从另一个源取一个单元格时用 `XLOOKUP`。
- 规范参考：[`spec/language.md`](/zh-CN/spec/language) "XLOOKUP"；ADR-0013。
