---
sidebar_label: '12 · 深入處理空值'
pagination_label: '12 · 深入處理空值'
---

# 12 · 深入處理空值

## XTL 中的「空」是什麼意思

依 ADR-0007：

- **空**：missing / null / undefined，**或**只含 Unicode 空白的字串。
- **非空**：數字 `0`、布林 `false`、任何非空白字串、任何日期。

字串 `"0"` 與 `"false"` 是非空。要把它們過濾掉，請明確比較：`[金額] != "0"`。

## `IFEMPTY` — 空值的 fallback

```text
{{ IFEMPTY([負責人], "未指派") }}
{{ IFEMPTY([備註], "—") }}
{{ IFEMPTY([地區], __config__[default_region]) }}
```

`IFEMPTY(value, fallback)` 只在 `value` 為空時回傳 `fallback`。對 `0` 或 `false` **不會**觸發。

## 空值 vs 零 — 常見的 bug

```text
{{ IFEMPTY([金額], "n/a") }}          → 金額為 0 的列會輸出「0」（數字）
{{ IF([金額] = 0, "n/a", [金額]) }}  → 金額為 0 的列會輸出「n/a」
```

如果你希望「缺漏」與「零」都被讀成 `n/a`：

```text
{{ IF(IFEMPTY([金額], 0) = 0, "n/a", [金額]) }}
```

## 群組鍵為空 → `(blank)`

依 ADR-0026，群組鍵為空的列會：

- 用在 `output_file_pattern` 時，產生名為 `(blank).xlsx` 的檔案。
- 用在工作表範本名稱時，產生名為 `(blank)` 的工作表。

這對齊 Excel 樞紐分析表的慣例。如果你寧可直接報錯，請在來源端先 filter：

```text
{{ @filter [地區] != "" }}        ← 丟掉地區為空的列
```

## 彙總中的空值

`SUM`、`COUNT`、`AVERAGE`、`MIN`、`MAX` 會略過空值：

```text
資料：    [10, 20, "", 30]
SUM：     60     （不是 error）
COUNT：   3      （不是 4）
AVERAGE： 20     （不是 15）
```

對零個非空值做 `AVERAGE` 會回傳空值（不是 error）。要顯式偵測這種情況，請用 `IFEMPTY` 包起來：

```text
{{ IFEMPTY(AVERAGE([金額]), "no data") }}
```

## `IF` 條件中的空值

真假判定（依 ADR-0008）：

- 空 → falsy。
- 數字 `0` → falsy。
- 布林 `false` → falsy。
- 字串 `"0"` 與 `"false"` → **truthy**（非空字串）。
- 任何日期 → truthy。

```text
{{ IF([地區], [地區], "未知") }}      → 地區為 "" 時輸出 ""，否則輸出地區
{{ IF([金額], [金額], "no data") }}   → 金額為 0 或空時輸出 "no data"
```

## 單一表達式儲存格的空輸出

依 ADR-0026：儲存格只含 `{{ expr }}` 且求值為空時，會產生一個空儲存格（不報錯）。儲存格在 OOXML 中仍存在，值為空。透過 xl3 再讀一次時會依 ADR-0007 視為空。

如果儲存格混了字面值：`{{ [金額] }} 元`，結果是 `" 元"`（空數字字串化成空，加上前置空格）。

## 規格指引

- [`spec/evaluation.md`](../../spec/evaluation.md) 的「Empty Values」。
- ADR-0007（空值定義）、ADR-0008（真假判定）、ADR-0026（生命週期）。
- [食譜 02](./02-conditional-cells.md) 介紹 IF / IFEMPTY 基本用法。
