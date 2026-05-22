# 編寫符合性 Fixture

本目錄下的語料庫，會成為 XTL 的可執行定義。在此編寫的 fixture 會比任何單一實作都長壽。把它們寫好，比寫得多重要許多。

## 「以 JS 實作為真」的反模式

最誘人的捷徑是：

1. 跑一遍 JS 參考實作
2. 把它的輸出存成 `expected.xlsx`
3. 提交並宣稱它就是正規的

這等於把 JS 實作當成了事實上的規格。當 Python 或 Go 移植版本不同意時，誰才對？先跑的人對。規格淪為「JS 實作做了什麼」，標準化就此死亡。

**符合性 fixture 必須依規格撰寫，不能依實作撰寫。**

## 撰寫流程

### 簡單 fixture

1. 閱讀 [`spec/`](../spec/) 中相關章節。
2. 在 Excel（或試算表編輯器）中親手撰寫 `template.xlsx` 與 `data.xlsx`。
3. **親手計算**預期輸出——打開 Excel、打開計算機，一格一格地算。存成 `expected.xlsx`。
4. 執行參考實作。若它與你手算的預期不一致，**不要**修改預期值——開一個 issue：可能是規格錯了、實作錯了，或你手算錯了。

### 複雜 fixture

當無法手算（例如 200 列的總和、多工作表分組）時：

1. 依規格撰寫範本與資料。
2. 透過兩條獨立路徑計算預期值（例如 Excel 公式 + 另一個獨立腳本）。兩者必須一致。
3. 執行參考實作；若它與兩條獨立路徑都一致，再把實作的輸出存成預期值。
4. 在 `meta.yaml` 中記錄：`verified_by: [excel-formulas, manual-script]`。

### `meta.yaml` 應包含什麼

```yaml
description: "Basic per-row substitution with [field] syntax"
spec_section: "Cell-level variables"
spec_version: 0.1
tags: [substitution, basic]
comparison_stage: 1
verified_by: [hand]            # 或 [excel-formulas, manual-script] 等
```

`comparison_stage` 為選填，預設為 `1`。只有當靜態輸出 fixture 需要正規 OOXML 比對來斷言樣式、合併範圍、影像、套件結構或其他階段 1 儲存格值比對看不到的活頁簿特性時，才使用 `2`。

`expected_error` 會把 fixture 轉成錯誤 fixture，**MUST NOT** 與 `expected.xlsx`、`expected/` 或 `expected_dynamic` 一起使用。`expected_dynamic` 會把 fixture 轉成動態斷言 fixture，**MUST** 一併包含 `dynamic_cells`；動態 fixture 同樣省略靜態預期輸出。`comparison_stage` 僅用於靜態輸出 fixture。

### 階段 2 fixture 撰寫注意事項

目前大多數階段 2 fixture（024-026）的 `template.xlsx` 與 `expected.xlsx`，都是用 JS 參考實作內部使用的同一個 `exceljs` 書寫器產出的。兩邊都繞同一個程式庫往返一次，所以它們驗證的是正規化器的 *等價性* 主張（工作表 part 改名、預設頁面設定剝除、屬性順序、引號樣式、空元素表示法），而非 *跨書寫器* 主張。一個只處理 ExcelJS 怪癖的正規化器仍可通過這些 fixture。

Fixture 027 透過親手改寫已撰寫好的 expected 活頁簿的 OOXML 序列化，同時保留相同的活頁簿語意，補上套件層級的書寫器差異覆蓋。但這仍不是「由 Excel、LibreOffice 或其他獨立 OOXML 書寫器存檔的活頁簿」的替代品；當該撰寫環境可用時，這類 fixture 仍是首選的後續強化方向。

最高守則仍然成立：透過執行 JS 實作來產生階段 2 `expected.xlsx`，是被禁止的。以 ExcelJS 撰寫只能作為鷹架式輔助而被接受，因為其套件書寫器是通用的——它不是 XTL 實作。新增一個 `expected.xlsx` 由 Excel 本身（或其他 OOXML 書寫器）儲存的階段 2 fixture，仍是更強的後續方向；在此之前，跨書寫器行為由 fixture 027 的套件重寫，加上 `src/__tests__/conformance-runner.test.ts` 中的正規化器單元測試所覆蓋。

對於錯誤 fixture，省略 `expected.xlsx` 與 `expected/`，並宣告預期診斷中的穩定部分：

```yaml
expected_error: "Source sheet"
```

對於動態 fixture，省略 `expected.xlsx` 與 `expected/`，宣告動態斷言種類，並列出其預期值由執行器計算的儲存格：

```yaml
expected_dynamic: utc_today
dynamic_cells:
  - sheet: Report
    cell: A2
    format: YYYY-MM-DD
```

## 硬性規則

- **預期輸出是撰寫出來的，不是產生出來的。** 若無法親手驗證，就必須獨立驗證。把 `expected.xlsx` 當成規格的一部分，而不是測試輸出。
- **每個 fixture 只測一個概念。** 把 repeat + filter + 彙總混進同一個 fixture 會讓失敗難以診斷。請組合小型 fixture。
- **Fixture 檔案大小要小。** 若一個 fixture 需要 1000 列資料，那測試概念就錯了——產生能驗證相同性質的小型資料。
- **不得包含 PII 或專有資料。** Fixture 採 MIT 授權並公開。只能使用合成資料。
- **範本必須是人類可讀的。** 除非明確要測，否則在 fixture 中避免只能用二進位形式呈現的 Excel 功能（自訂 XML、巨集）。
- **錯誤 fixture 只斷言穩定的診斷。** 比對一段描述契約的短子字串，不要比對絕對路徑這類易變細節。
- **動態 fixture 只斷言規格定義的動態值。** 不可用它來迴避為靜態行為撰寫預期活頁簿。

## 當規格與 fixture 不一致

規格獲勝。請更新 fixture。

## 當 fixture 與實作不一致

Fixture 獲勝。請更新實作。

## 當你在撰寫時發現規格未涵蓋的情境

停下。開一個 issue 並先更新規格。不要提交依賴未明定行為的 fixture——那會把未明定狀態凍結成「語料庫的行為」，反過來逼規格事後配合。
