---
sidebar_label: '07 · 多数据源与 @join'
pagination_label: '07 · 多数据源与 @join'
---

# 07 · 多数据源 + `@join`

## 场景

续约数据里有一个 `customer_id`，但客户的完整名字放在另一张 `Customers` 表里。你希望续约行能把客户的 `Name` 和 `Tier` 一并带上。

## 在 `__sources__` 中声明源

| name | sheet | table | description |
|---|---|---|---|
| `Renewals` | `Renewals` | `1` | 一行一条续约记录 |
| `Customers` | `Customers` | `1` | 一行一个客户 |

`__config__` 中的默认 `source_sheet` 仍然是隐式的；你可以用 `[Column]` 直接引用它的列而不加源前缀。命名源则用 `SourceName[Column]` 引用。

## `@source` 切换数据块的活动源

```text
{{ @source Renewals }}
{{ [customer_id] }}   ← 裸括号在 Renewals 中解析
{{ [amount] }}
```

默认情况下，数据块迭代的是 `source_sheet` 所配置的源。`@source <Name>` 把当前数据块切到 `<Name>`。

## `@join` 把主表行与另一源的行配对

```text
{{ @source Renewals }}
{{ @join Customers on Renewals[customer_id] = Customers[id] }}
{{ [customer_id] }}             ← Renewals 行
{{ Customers[name] }}            ← 关联到的客户行
{{ Customers[tier] }}
{{ [amount] }}
```

`@join` 是**内连接、取首个匹配**：

- 对每条 Renewals 行，找到第一条满足 `id = customer_id` 的 Customers 行。
- 找不到匹配时，这条 Renewals 行被丢弃。
- 多行匹配：只取第一条。

`on` 子句必须按名字引用两个源。自连接（`@join S on S[a] = S[b]`，其中 `S` 是活动源）会按 ADR-0029 抛出 `xl3/join/bad-on-clause`。

## 不连接、只取单值：`XLOOKUP`

如果你不需要把每条 Renewals 行都与 Customers 行配对，`XLOOKUP` 更轻量：

```text
{{ XLOOKUP([customer_id], Customers[id], Customers[name]) }}
```

参考 [Recipe 08](./08-xlookup.md)。

## 跨源聚合

对命名源的聚合操作的是**整张源**，而不是连接 / 过滤后的数据块：

```text
{{ COUNT(Customers[id]) }}      ← 客户总数，忽略过滤
{{ SUM(Renewals[amount]) }}      ← 续约总额，忽略过滤
```

参考 [Recipe 03](./03-aggregates.md)。

## 备注

- 每个数据块只能写一个 `@source` 和一个 `@join`。重复会按 ADR-0029 抛出 `xl3/directive/invalid-syntax`。
- 多路 join（串联多个 `@join`）按 ADR-0014 暂未支持。
- 函数名匹配大小写不敏感：`if`、`If`、`IF` 都行。
- 规范参考：[`spec/evaluation.md`](/zh-CN/spec/evaluation) "External Data Sources"；ADR-0012、ADR-0014。
