---
sidebar_label: '14 · 當作值字典的 __config__'
pagination_label: '14 · 當作值字典的 __config__'
---

# 14 · `__config__` 當作值字典使用

## 情境

好幾個儲存格都參照同一個常數 — 部門名稱、日期門檻、續約上限。把字面值塞進每個儲存格很脆弱；改一次要在範本裡到處找。`__config__` 同時也能當作值字典，作者可以從任何儲存格讀取。

## 機制

依 ADR-0011，`__config__` 是保留的設定工作表。有兩欄：`key` 與 `value`。某些鍵是規格定義的（`name`、`description`、`source_sheet`、`source_table`、`output_file_pattern`、`match_pattern`）。其他任何鍵都是作者自訂，並可透過以下方式取用：

```text
{{ __config__[key_name] }}
```

## 範例

`__config__`：

| 鍵 | 值 |
|---|---|
| `source_sheet` | `原始` |
| `source_table` | `1` |
| `output_file_pattern` | `report.xlsx` |
| `priority_threshold` | `10000` |
| `default_region` | `台北` |
| `report_owner` | `小敏` |

範本儲存格：

```text
{{ "製表人 " & __config__[report_owner] }}
{{ IF([續約金額] > __config__[priority_threshold], "優先", "普通") }}
{{ IFEMPTY([地區], __config__[default_region]) }}
```

把 `priority_threshold` 從 10000 改成 5000，所有儲存格一次更新。作者只需要改 `__config__` 的一個儲存格，不必處理散落在報表裡的 20 個表達式。

## 型別感知

存進 `__config__` 的值會帶著作者使用的儲存格型別：

- 數字儲存格成為數字（`10000` 以數值比較）。
- 字串儲存格成為字串。
- 日期儲存格成為日期。
- 布林成為布林。

```text
__config__[priority_threshold] > 5000     ← 數值比較
__config__[start_date] = TODAY()           ← 日期比較
```

如果需要強制型別，請以正確的 Excel 儲存格型別儲存。要在範本中做顯式轉換，請用 `TEXT()`（數字 → 字串）或算術（`__config__[x] + 0`，把數值字串強制轉為數字）。

## 不能拿來重用的保留鍵

依 ADR-0011，下列 `__config__` 鍵是規格定義、引擎自己讀的；請勿用自訂語意覆寫：

- `name`
- `description`
- `source_sheet`
- `source_table`
- `output_file_pattern`
- `match_pattern`

自訂鍵**不得**符合 `^__[a-z]+__$`（依 ADR-0027，前後雙底線像 `__foo__` 是保留）。開頭單一 `_` 是 OK 的。其他識別字都行。

## 為什麼不放在來源資料裡？

工作流程中「共用常數」有兩種選擇：

1. **`__config__` 作者自訂鍵** — 值住在範本裡。更新需要重新發版範本。適合「組織級常數，操作員不該修改」。
2. **`__inputs__` 宣告 + `default`** — 值住在範本裡，但宿主可在每次執行時覆寫。適合「每次執行可調整的參數」（目標月份、門檻）。

`__config__` 用於「這份範本寫死這些常數；要改就改範本」。`__inputs__` 用於「這份範本接受參數；每次執行由宿主決定」。

## 規格指引

- ADR-0011 — Reserved sheet naming。
- [`spec/evaluation.md`](../../spec/evaluation.md) 的「Template Configuration」。
- [食譜 06](./06-runtime-inputs.md) 介紹 `__inputs__`（每次執行可調整的替代方案）。
