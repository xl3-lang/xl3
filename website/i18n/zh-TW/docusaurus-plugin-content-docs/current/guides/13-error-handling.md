---
sidebar_label: '13 · 宿主端錯誤處理'
pagination_label: '13 · 宿主端錯誤處理'
---

# 13 · 宿主端的錯誤處理

## 情境

你的應用呼叫 `convert(templateBuffer, dataBuffer)`。範本有打錯字，或資料缺了必要欄位。然後呢？

xl3 會丟出**結構化錯誤**（依 ADR-0015），帶有穩定的 `error.code` 字串。宿主透過 code dispatch — 用於在地化、重試邏輯，或操作員友善的訊息。

## Catch + dispatch

```ts
import { convert, isXtlError } from '@jinyoung4478/xl3';

try {
  const outputs = await convert(templateBuffer, dataBuffer, options);
  // ship outputs
} catch (err) {
  if (isXtlError(err)) {
    switch (err.code) {
      case 'xl3/source/missing-header':
        return showOperator('資料檔缺少必要欄位。', err.message);
      case 'xl3/inputs/missing-required':
        return promptForMissingInput(err.message);
      case 'xl3/filename/collision':
        return showOperator('兩個輸出檔將會同名，請檢查資料。', err.message);
      default:
        return showOperator('轉換失敗。', err.message);
    }
  }
  // 非 xl3 錯誤：八成是系統層的問題，往上拋。
  throw err;
}
```

`isXtlError(value)` 只對 `code` 以 `xl3/` 開頭的 `Error` 實例回傳 `true`。一般的 `Error` 或 DOMException 等不會 match。

## 錯誤碼目錄

穩定、僅新增。改名屬於 breaking change（ADR-0015）。目前的集合：

- **`xl3/cell/*`** — 儲存格層級失敗（`formula-no-cache`、`numfmt-coercion`、`row-outside-repeat`）
- **`xl3/eval/*`** — 表達式求值（`arity-mismatch`、`operand-coercion`、`unsupported-syntax`）
- **`xl3/config/*`** — `__config__` 問題
- **`xl3/inputs/*`** — 執行時輸入失敗
- **`xl3/source/*`** — 來源資料問題（缺表頭、未宣告的來源、保留欄名）
- **`xl3/sources/*`** — `__sources__` 工作表問題
- **`xl3/sheet/*`** — 工作表名稱問題
- **`xl3/directive/*`** — 指示子語法
- **`xl3/join/*`** — `@join` 子句問題
- **`xl3/xlookup/*`** — `XLOOKUP` 失敗
- **`xl3/filename/*`** — 輸出檔名問題
- **`xl3/parser/*`** — parser 失敗
- **`xl3/lists/*`** — `__lists__` 參照問題

完整清單在 [`src/error-codes.ts`](https://github.com/jinyoung4478/xl3/blob/main/src/error-codes.ts)。

## 值得顯式處理的常見情境

**必要輸入缺漏** (`xl3/inputs/missing-required`)：
範本把某個輸入標為 `required: true`，但宿主沒供應。彈出表單請操作員補上，再重試。

**檔名碰撞** (`xl3/filename/collision`)：
兩個不同的檔案群組鍵清洗後變成同一個檔名（例如 `台北/台灣` 與 `台北:台灣` 都變成 `台北_台灣.xlsx`）。通常要清的是操作員的資料，不是範本。

**XLOOKUP 來源不一致** (`xl3/xlookup/source-mismatch`)：
範本作者寫了 `XLOOKUP(x, A[k], B[v])`，但 `A` 與 `B` 是不同來源。要改的是範本 — 與操作員無關。

**XLOOKUP 找不到對應** (`xl3/xlookup/no-match`)：
查找值不在查找欄裡。要嘛操作員的資料不完整，要嘛範本應該改用 `@join`（會丟掉沒比對到的列）。

## 在地化

`error.message` 是英文。要在地化，請在宿主端依 `error.code` dispatch，提供你自己的訊息 — **不要**翻譯引擎本身的英文字串。英文文字屬於 conformance 契約的一部分（fixtures 會用其子字串做比對）。

## convert 之前先 preview

`preview(template, data, options)` 跑的是和 `convert` 相同的 parse + dispatch，但不渲染活頁簿。如果宿主在「Convert」之前有「Validate」按鈕，就呼叫 `preview` — 快、能抓到一樣的錯，不浪費 xlsx 產出。

```ts
const preview = await xl3.preview(template, data, options);
// preview.warnings: 非致命的問題
// preview.inputs:   解析後的輸入值（套用 default + 強制轉型後）
// preview.files / preview.sources: convert() 將會產出的內容
```

## 規格指引

- ADR-0015 — Structured error reporting。
- [`spec/evaluation.md`](../../spec/evaluation.md) 的「Errors」。
- [食譜 06](./06-runtime-inputs.md) 涵蓋輸入相關錯誤。
