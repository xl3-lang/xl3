---
sidebar_label: '15 · 組合指示子'
pagination_label: '15 · 組合指示子'
---

# 15 · 組合指示子（`@filter`、`@sort`、`@top`、`@source`、`@join`）

## 指示子是什麼，不是什麼

指示子（`@filter`、`@sort`、`@top`、`@source`、`@join`）住在**資料區塊**內，塑造區塊迭代的列集合。不論它們在來源儲存格中的順序，都會以固定順序求值：

1. **`@source <Name>`** — 選擇區塊要迭代的來源。
2. **`@join <Source> on ...`** — 把主列和另一來源的列配對。
3. **`@filter <condition>`** — 保留條件為 truthy 的列。
4. **`@sort <column> [asc|desc]`** — 對列排序。
5. **`@top <N>`** — 在篩選與排序後保留前 N 列。

寫作建議：把指示子依執行順序排列。規格沒有強制 — 但能讓範本可讀性更好。

## 怎麼組合

常見形態：金額最大的 5 筆台北續約。

```text
{{ @filter [地區] = "台北" }}
{{ @filter [金額] > 1000 }}
{{ @sort [金額] desc }}
{{ @top 5 }}
{{ [客戶] }} | {{ [金額] }}
```

求值順序：
1. 篩選 地區=台北。
2. 篩選 金額>1000（與上一條 AND 串接）。
3. 對倖存的列依金額由大到小排序。
4. 取前 5。

## 多個 `@filter` 以 AND 串接

依 ADR-0029，同一區塊內多個 `@filter` 以 AND 合併。沒有 `OR` 關鍵字。要表達 OR：

- 用 `IN` 合併成單一 filter：
  `{{ @filter [地區] in __lists__[active_regions] }}`
- 拆成兩個資料區塊（各放在自己的範本區域），讓兩個被渲染的列集合自然聯集。
- 在來源端先處理。

## 組合 `@source` + `@join`

```text
{{ @source 續約資料 }}
{{ @join 客戶資料 on 續約資料[customer_id] = 客戶資料[id] }}
{{ @filter 客戶資料[tier] = "A" }}
{{ @sort 續約資料[amount] desc }}
{{ @top 10 }}
{{ 續約資料[customer_id] }}
{{ 客戶資料[name] }}
{{ 續約資料[amount] }}
```

步驟：
1. 在 續約資料 上迭代（依 `@source`）。
2. 以 id 做 inner-join 配對 客戶資料；沒比對到的列丟掉。
3. 只保留 客戶資料 等級為 "A" 的聯結列。
4. 依 續約資料.amount 降冪排序。
5. 取前 10。

`@filter` 可以參照任一來源的欄位；裸方括號參照活動區塊的來源，明確的 `Source[Column]` 則指向聯結那邊。

## 禁用的組合

依 ADR-0029：

- 每個資料區塊**最多一個 `@source`**。重複會丟 `xl3/directive/invalid-syntax`。
- 每個資料區塊**最多一個 `@join`**。多重 join 不在範圍內。
- **不允許自我聯結**。`@join S on S[a] = S[b]`（`S` 是當前活動來源）會丟 `xl3/join/bad-on-clause`。

## `@top` 接 `@sort`

```text
{{ @sort [金額] desc }}
{{ @top 10 }}
```

沒有排序的 Top-N 沒有意義。若沒搭配 `@sort` 就寫 `@top`，會取得來源順序的前 N 列 — 偶有用處，但很少是作者本意。

## filter 後變空

如果 `@filter` 把所有列都篩掉，資料區塊展開為零列。範本列的樣式 / 格式會留在輸出，但不會產生任何資料列。下方的頁尾列仍可見。

## 規格指引

- ADR-0029 — Directive composition + source edge semantics。
- [`spec/language.md`](../../spec/language.md) 的「Filter」、「Sort」、「Top」、「Source」、「Join」。
- [食譜 05](./05-sheet-per-group.md) 介紹 `@filter in __lists__[…]`。
- [食譜 07](./07-multi-source-join.md) 介紹 `@source` + `@join` 基本用法。
- [食譜 09](./09-sort-and-top.md) 介紹 `@sort` + `@top` 基本用法。
