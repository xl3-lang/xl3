---
sidebar_label: '08 · XLOOKUP 查找'
pagination_label: '08 · XLOOKUP 查找'
---

# 08 · `XLOOKUP`

## 情境

你想用一把鑰匙，從另一個來源拉出單一欄的值 — 就像一發 `VLOOKUP` / `INDEX(MATCH(...))` / SQL `LEFT JOIN ... LIMIT 1`。

## 基本形態

```text
{{ XLOOKUP(lookup_value, lookup_array, return_array) }}
{{ XLOOKUP(lookup_value, lookup_array, return_array, fallback) }}
```

- `lookup_value` — 你要找的值。
- `lookup_array` — 要搜尋的另一來源的某欄。
- `return_array` — 要從另一來源回傳的某欄。
- `fallback`（選填） — 找不到對應列時要回傳的值。

第一筆配對到的列的 `return_array` 值會被回傳。比較方式遵循 XTL 的標準比較演算法（數字或數值字串時做數值比較、字串時做碼點比較）。不支援萬用字元、不做近似比對、不做反向搜尋 — 這些依 ADR-0013 不在範圍內。

## 範例

`__sources__`：

| name | sheet | table |
|---|---|---|
| `客戶資料` | `Customers` | `1` |

範本儲存格：

```text
A2: {{ [customer_id] }}
B2: {{ XLOOKUP([customer_id], 客戶資料[id], 客戶資料[name]) }}
C2: {{ XLOOKUP([customer_id], 客戶資料[id], 客戶資料[tier]) }}
```

對於預設來源的每一列，xl3 會在 客戶資料 中找出符合 `id` 的列，並拉出 `name` / `tier`。

## 找不到時的行為

如果 `lookup_value` 不在 `lookup_array` 裡，且沒提供 fallback，xl3 會丟 `xl3/xlookup/no-match`。規格傾向「大聲失敗」而非默默漏資料。

要抑制這個錯誤，請在第四個引數提供 fallback：

```text
{{ XLOOKUP([customer_id], 客戶資料[id], 客戶資料[name], "(未知)") }}
```

找不到時改回傳 fallback。若想允許沒比對到、但又不想留佔位字，請在來源端先 filter，或改用 `@join`（沒比對到的列會整列被丟棄）。

## 來源不一致的保護

`lookup_array` 與 `return_array` **必須**來自同一個來源。`XLOOKUP([id], 客戶資料[id], 續約資料[name])` 會丟 `xl3/xlookup/source-mismatch` — 混用來源等於從一個「跟比對到的列毫無關聯的列位置」拿值。

## 效能

xl3 在第一次對某對 `(rows, column)` 做 XLOOKUP 時會建立索引，後續對同欄的查找就是 O(1)。轉換流程中第一次查找付出 O(N) 成本；同一個資料區塊內的後續查找都是常數時間。

## 備註

- 比較感知型別：數字與數值字串可跨界比對，所以 `XLOOKUP("42", 客戶資料[id], ...)` 能找到 `id` 為數字 `42` 的列。
- 若每一筆主列都該配對另一筆，請用 `@join`；只是想從另一來源拉一個儲存格的值，請用 `XLOOKUP`。
- 規格參考：[`spec/language.md`](../../spec/language.md) 的「XLOOKUP」；ADR-0013。
