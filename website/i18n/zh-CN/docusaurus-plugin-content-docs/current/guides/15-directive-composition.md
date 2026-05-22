---
sidebar_label: '15 · 组合指令'
pagination_label: '15 · 组合指令'
---

# 15 · 组合指令（`@filter`、`@sort`、`@top`、`@source`、`@join`）

## 指令是什么、不是什么

指令（`@filter`、`@sort`、`@top`、`@source`、`@join`）位于**数据块**内部，用来塑造数据块迭代的那一组行。无论它们在源单元格里出现的顺序如何，都按固定顺序求值：

1. **`@source <Name>`** ——挑选数据块要迭代的源。
2. **`@join <Source> on ...`** ——把主表行与另一源的行配对。
3. **`@filter <condition>`** ——保留条件为真的行。
4. **`@sort <column> [asc|desc]`** ——给行排序。
5. **`@top <N>`** ——过滤、排序之后保留前 N 行。

写法建议：把指令按它们的执行顺序排列。规范并不要求这样写——但这样写读起来更顺。

## 组合在一起

常见形态：北京区高价值续约前 5 名。

```text
{{ @filter [区域] = "北京" }}
{{ @filter [金额] > 1000 }}
{{ @sort [金额] desc }}
{{ @top 5 }}
{{ [客户] }} | {{ [金额] }}
```

求值顺序：
1. 过滤 区域 = 北京。
2. 过滤 金额 > 1000（与上一条以 AND 组合）。
3. 对剩余的行按金额降序排序。
4. 取前 5 条。

## 多个 `@filter` 以 AND 组合

按 ADR-0029，同一数据块内的多个 `@filter` 互相以 AND 组合。**没有 `OR` 关键字**。要表达 OR，可以：

- 用 `IN` 合并为一个过滤器：
  `{{ @filter [区域] in __lists__[active_regions] }}`
- 拆成两个数据块（各自一段模板区域），让两个行集合通过都被渲染来"求并"。
- 在上游预处理。

## 组合 `@source` + `@join`

```text
{{ @source Renewals }}
{{ @join Customers on Renewals[customer_id] = Customers[id] }}
{{ @filter Customers[tier] = "A" }}
{{ @sort Renewals[amount] desc }}
{{ @top 10 }}
{{ Renewals[customer_id] }}
{{ Customers[name] }}
{{ Renewals[amount] }}
```

步骤：
1. 迭代 Renewals（由 `@source` 指定）。
2. 按 id 对 Customers 做内连接；无匹配的行被丢弃。
3. 仅保留 Customers 等级为 "A" 的连接结果。
4. 按 Renewals.amount 降序排序。
5. 取前 10 条。

`@filter` 可以引用两个源中任意一个的列；裸括号按活动数据块的源解析列，显式形态 `Source[Column]` 则解析到指定一侧。

## 禁止的组合

按 ADR-0029：

- **每个数据块最多一个 `@source`**。重复会抛出 `xl3/directive/invalid-syntax`。
- **每个数据块最多一个 `@join`**。多路 join 不在范围内。
- **不允许自连接**。`@join S on S[a] = S[b]`（其中 `S` 是活动源）会抛出 `xl3/join/bad-on-clause`。

## `@top` 跟在 `@sort` 之后

```text
{{ @sort [金额] desc }}
{{ @top 10 }}
```

没有排序的 Top-N 是没有意义的。如果只写 `@top` 不写 `@sort`，得到的是源顺序中的前 N 行——偶尔有用，但很少是作者真正的意思。

## 过滤后为空

如果 `@filter` 把所有行都丢掉了，数据块就展开为 0 行。模板行的样式 / 格式仍保留在输出，但不会产生数据行。数据块下方的页脚行依然可见。

## 规范参考

- ADR-0029 ——指令组合 + 源边界语义。
- [`spec/language.md`](../../spec/language.md) "Filter"、"Sort"、"Top"、"Source"、"Join"。
- [Cookbook 05](./05-sheet-per-group.md) ——`@filter in __lists__[…]`。
- [Cookbook 07](./07-multi-source-join.md) ——`@source` + `@join` 基础。
- [Cookbook 09](./09-sort-and-top.md) ——`@sort` + `@top` 基础。
