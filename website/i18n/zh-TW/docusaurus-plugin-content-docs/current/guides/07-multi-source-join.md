---
sidebar_label: '07 · 多來源與 @join'
pagination_label: '07 · 多來源與 @join'
---

# 07 · 多來源 + `@join`

## 情境

續約資料只有 `customer_id`，客戶完整名稱放在另外一張 `客戶資料` 表。你想要每一筆續約列都附上客戶的 `名稱` 與 `等級`。

## 在 `__sources__` 宣告來源

| name | sheet | table | description |
|---|---|---|---|
| `續約資料` | `Renewals` | `1` | 每筆續約一列 |
| `客戶資料` | `Customers` | `1` | 每位客戶一列 |

`__config__` 預設的 `source_sheet` 仍是隱含可用 — 透過不加前綴的 `[Column]` 參照它。具名來源則透過 `SourceName[Column]` 參照。

## 用 `@source` 切換目前區塊的來源

```text
{{ @source 續約資料 }}
{{ [customer_id] }}   ← 沒加前綴的方括號參照「續約資料」
{{ [amount] }}
```

預設情況下資料區塊會在 `source_sheet` 設定的來源上迭代。`@source <Name>` 會把目前區塊改成在 `<Name>` 上迭代。

## 用 `@join` 把主列和另一來源的列配對

```text
{{ @source 續約資料 }}
{{ @join 客戶資料 on 續約資料[customer_id] = 客戶資料[id] }}
{{ [customer_id] }}             ← 續約資料 的列
{{ 客戶資料[name] }}              ← 配對到的客戶列
{{ 客戶資料[tier] }}
{{ [amount] }}
```

`@join` 是 **inner-join + 取第一筆配對**：

- 對每一筆 續約資料 列，找出 `id = customer_id` 的第一筆 客戶資料 列。
- 找不到配對的續約列會被丟棄。
- 多筆配對時：只用第一筆。

`on` 子句必須以名稱參照兩個來源。自我聯結（`@join S on S[a] = S[b]`，其中 `S` 是目前的活動來源）會依 ADR-0029 丟 `xl3/join/bad-on-clause`。

## 不做聯結也能取跨來源的值：`XLOOKUP`

如果你不需要每筆續約列都和客戶列配對，`XLOOKUP` 更輕量：

```text
{{ XLOOKUP([customer_id], 客戶資料[id], 客戶資料[name]) }}
```

請見 [食譜 08](./08-xlookup.md)。

## 跨來源彙總

對具名來源做彙總時，作用範圍是**整個來源**，不是聯結 / 篩選後的區塊：

```text
{{ COUNT(客戶資料[id]) }}        ← 客戶總數，無視篩選
{{ SUM(續約資料[amount]) }}      ← 續約總額，無視篩選
```

請見 [食譜 03](./03-aggregates.md)。

## 備註

- 每個資料區塊只能有一個 `@source` 與一個 `@join`。重複宣告會依 ADR-0029 丟 `xl3/directive/invalid-syntax`。
- 多重 join（連鎖 `@join`）依 ADR-0014 暫緩。
- 函式名稱比對不分大小寫：`if`、`If`、`IF`。
- 規格參考：[`spec/evaluation.md`](../../spec/evaluation.md) 的「External Data Sources」；ADR-0012、ADR-0014。
