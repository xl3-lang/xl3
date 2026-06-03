---
sidebar_label: '06 · 執行時輸入'
pagination_label: '06 · 執行時輸入'
---

# 06 · 執行時輸入

## 情境

範本是通用的，但每次執行針對的是特定月份或地區。你不希望操作員去動範本 — 而是讓他們在 convert 時把值傳進來。

## 在 `__inputs__` 宣告

| name | type | required | default | label | options |
|---|---|---|---|---|---|
| `month` | `text` | `true` | | `目標月份 (YYYY-MM)` | |
| `region` | `select` | `false` | `全部` | `地區篩選` | `全部\|台北\|高雄\|台中` |

type 可用值：`text`、`number`、`date`、`select`。

## 在範本儲存格、檔名、群組鍵中使用

```text
儲存格：       {{ "報表月份：" & __inputs__[month] }}
檔名：          output_file_pattern = {{ __inputs__[month] }}-續約報表.xlsx
篩選：          {{ @filter [地區] = __inputs__[region] OR __inputs__[region] = "全部" }}
```

慢著 — 最後那條這樣寫不會動；XTL 沒有 `OR` 關鍵字。乾淨的做法是用兩張範本工作表，由上游條件挑選。目前 `__inputs__` 比較直接的用法是把字面值注入儲存格、檔名或固定比較：

```text
{{ @filter [地區] = __inputs__[region] }}
```

…並要求宿主只在操作員選定特定地區後才呼叫 `convert()`。

## 從宿主傳值

```ts
import { convert } from '@jinyoung4478/xl3';

const outputs = await convert(templateBuffer, dataBuffer, {
  inputs: { month: '2026-05', region: '台北' },
});
```

如果 `month` 標記為 required 但 `inputs.month` 沒給，xl3 會在 convert 時丟 `xl3/inputs/missing-required`。如果沒提供 `region`，會 fallback 到 `default`（`全部`）。

## 不執行也能查宣告的輸入

```ts
import { readTemplateInputs } from '@jinyoung4478/xl3';

const inputs = await readTemplateInputs(templateBuffer);
// → [{ name: 'month', type: 'text', required: true, ... }, ...]
```

宿主端在操作員還沒上傳資料檔之前，就可以拿這份資訊渲染輸入表單。

## 動態 default 與 label（ADR-0050）

`default`、`label`、`description`、`options` 欄位是 XTL 範本，會在 input-read 時被求值。你可以從 `__config__` 組合、或呼叫純純量函式：

| name | type | default | label |
|---|---|---|---|
| `title_prefix` | `text` | `{{ __config__[region] }} 對帳單` | `標題前綴` |
| `report_date` | `text` | `{{ TEXT(TODAY(), "YYYY-MM-DD") }}` | `報表日期` |
| `report_label` | `text` | `{{ UPPER(__config__[region]) }}-{{ __config__[period] }}` | `報表標籤` |

呼叫 `readTemplateInputs()` 的宿主 UI 看到的是求值**之後**的字串（例如 `"TW 對帳單"`、當下的 UTC 日期）。使用者不再看到原始的 `{{ ... }}` 佔位符。

**input-read 時可用的綁定：**

- `__config__[key]` — `__config__` 工作表中宣告在前面的值。
- 純純量函式：`TODAY`、`DATE`、`IF`、`IFEMPTY`、`IFS`、`IFERROR`、`UPPER`、`LOWER`、`TRIM`、`TEXT`、`YEAR`、`MONTH`、`DAY`、`EOMONTH`、`EDATE`、`DATEDIF`、`ROUND`、`ABS`。

**不可用 — 在 input-read 時呼叫會丟錯：**

- `[Column]` / `Source[Column]` — 此時還沒有來源列的脈絡。錯誤碼：`xl3/inputs/forward-reference`。
- `__inputs__[name]` — 輸入列彼此是獨立宣告，不是依賴圖。同樣的錯誤碼。
- `ROW()`、`SUM`、`COUNT`、`AVERAGE`、`MIN`、`MAX`、`XLOOKUP` — 這些會讀取尚未存在的 render 狀態或來源資料。錯誤碼：`xl3/inputs/runtime-only-fn`。

> **遷移備註。** 0.6 之前，`__inputs__` 儲存格內的 `{{ ... }}` 會被當成字面文字。若既有範本中有刻意留作字面字元的封閉 `{{ ... }}` 區塊，現在會被當成表達式求值。多數作者不會受影響 — 過去的行為實際操作上反而違反直覺。

## 備註

- `select` 的選項在 `__inputs__` 列裡以 `|` 分隔（例如 `台北|高雄|台中`）。傳入不在選項中的值會丟 `xl3/inputs/select-option`。pipe 拆分發生在儲存格範本求值**之後**，所以 `options: {{ __config__[regions] }}` 是行得通的 — 只要 `__config__[regions]` 是字面字串 `台北|高雄|台中`。
- 日期輸入會以 `YYYY-MM-DD` 或 `YYYY-MM-DDTHH:mm:ss` 解析。
- 數字輸入接受 JS 數字字面值；允許結尾空白。
- 規格參考：[`spec/evaluation.md`](/zh-TW/spec/evaluation) 的「Inputs」；ADR-0010、ADR-0011、ADR-0050。
