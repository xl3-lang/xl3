# 符合性執行器協定

定義符合性語料庫，與任何想主張符合性的 XTL 實作之間的契約。

## 何謂執行器

**符合性執行器** 是一支小程式，負責：

1. 走訪 `conformance/fixtures/` 下的 fixture
2. 對每個 fixture 的 `template.xlsx` + `data.xlsx` 呼叫待測實作
3. 將實作的輸出與該 fixture 的 `expected.xlsx`（或 `expected/` 目錄）比對
4. 以標準格式逐 fixture 回報通過 / 失敗 / 略過

每個實作提供自己的執行器（因為呼叫方式因語言而異），但所有執行器都產生可互相比較的輸出。

## 載入 fixture

執行器透過列舉 `conformance/fixtures/` 的子目錄來探索 fixture。各子目錄命名為 `<NNN>-<slug>/`（例如 `001-basic-substitution`）。

對每個 fixture，執行器讀取：

- `template.xlsx` — 輸入範本
- `data.xlsx` — 輸入來源資料
- `expected.xlsx`（單一輸出情境）**或** `expected/` 目錄內的 `.xlsx` 檔（多檔案群組情境，含零輸出情境）
- `meta.yaml` — fixture 中繼資料

預期零個輸出檔的靜態 fixture，使用一個空的 `expected/` 目錄。

錯誤 fixture 省略 `expected.xlsx` 與 `expected/`。它們在 `meta.yaml` 中宣告 `expected_error`；預期結果是實作回報一個訊息包含該宣告文字的錯誤。

動態 fixture 省略 `expected.xlsx` 與 `expected/`。它們在 `meta.yaml` 中宣告 `expected_dynamic`；預期結果由執行器依執行器啟動時間戳與所宣告的斷言規則計算。動態 fixture 保留給規格中明確與時間相依的行為，例如 `TODAY()`。

## `meta.yaml` 必填欄位

```yaml
description: string         # 一行式的人類描述
spec_section: string        # 此 fixture 練習的規格章節
spec_version: string        # 最低 XTL 版本（例如 "0.1"）
tags: [string, ...]         # 篩選標籤（例如 [substitution, repeat, aggregate]）
```

`tags` 是給 `--filter=<tag>` CLI 旗標使用的 fixture 端便利欄位。標籤值 **NOT** 是符合性契約的一部分——執行器 **MUST** 把它們視為不透明字串，並且 **SHOULD NOT** 因為一個 fixture 的標籤集合與另一個不同，就拒絕該 fixture。參考語料庫使用小寫、連字號分隔的詞符，但並未強制一套正規分類。

選填欄位：

```yaml
verified_by: [hand | excel-formulas | manual-script | reference-impl]
expected_warnings: [string, ...]   # 實作應發出的警告
expected_error: string             # 預期錯誤訊息子字串；不需要預期輸出
expected_error_code: string        # 選填的 ADR-0015 穩定錯誤碼（例如 "xl3/source/undeclared"）
expected_dynamic: string           # 動態斷言種類；不需要預期輸出
comparison_stage: 1 | 2            # 靜態輸出 fixture 的最低比對階段；預設為 1
skip_reason: string                # 若 fixture 目前已壞掉
inputs:                            # 宿主提供的執行階段輸入（ADR-0010）
  - name: region
    value: Seoul
```

`inputs` 區塊列出名稱/值對，執行器會把它們以執行階段輸入的形式（依 ADR-0010 的 `__inputs__` 工作表）傳給實作。執行器 **MUST** 將這些值轉送到實作的轉換入口。沒有 `__inputs__` 工作表的範本會忽略此欄位。

階段把關用中繼資料：

- `comparison_stage` 僅適用於靜態輸出 fixture，預設為 `1`。只有當 fixture 斷言階段 1 無法觀察的活頁簿內容（例如樣式、合併、套件 part 或二進位媒體）時，才使用 `2`。
- `expected_error` fixture 與 `expected_dynamic` fixture，其通過/失敗不採用活頁簿比對階段。執行器仍會回報目前執行的階段，但這些 fixture 自有錯誤或動態斷言規則。
- 對於目前定義的 `utc_today` 斷言種類，`expected_dynamic` **MUST** 一併包含 `dynamic_cells`。靜態輸出與錯誤 fixture 省略 `dynamic_cells`。

執行器 **MUST** 將 `expected_error` fixture 標記為：

- 當實作回報的錯誤包含 `expected_error` 時為 `pass`
- 當實作成功時為 `fail`
- 當實作回報不同錯誤時為 `fail`

`expected_error` 與 `expected_dynamic` 互斥。

## 動態斷言

動態斷言讓渲染時行為可被測試，而不用提交一份很快就過期的 `expected.xlsx`。執行器 **MUST** 在執行第一個 fixture 前捕捉單一的執行器啟動時間戳，並對該次執行中的所有動態 fixture 使用同一個時間戳。這能避免同一份報告中各 fixture 之間出現午夜邊界差異。

XTL 0.1 定義一種動態斷言：

```yaml
expected_dynamic: utc_today
dynamic_cells:
  - sheet: Report
    cell: A2
    format: YYYY-MM-DD
```

對 `utc_today` 而言，每個列出之儲存格的預期值，是執行器啟動時間戳的 UTC 日曆日期，並以所列出的 XTL `TEXT()` 日期格式格式化。實作輸出 **MUST** 在每個列出的工作表/儲存格座標，包含預期的字串值。

執行器 **MUST** 將 `expected_dynamic` fixture 標記為：

- 當實作成功且每個列出的動態儲存格都相符時為 `pass`
- 當實作回報錯誤時為 `fail`
- 當任何列出的動態儲存格與計算出的預期值不同時為 `fail`

未實作所宣告 `expected_dynamic` 種類的執行器 **MUST** 將該 fixture 標記為 `skip` 並附上原因。它們 **MUST NOT** 把它回報為通過。

## 比對階段

符合性協定有兩個比對階段：

- **階段 1：儲存格值比對。** 執行器在以試算表程式庫載入 `.xlsx` 檔後，比對工作表名稱與非輔助儲存格的值。此階段刻意忽略樣式、合併、頁面設定、嵌入媒體、超過快取值的公式以及套件結構。在正規 OOXML 比對仍在制定與實作期間，這對 XTL 0.1 啟動版語料庫已經足夠。
- **階段 2：正規 OOXML 比對。** 執行器在對所產生 `.xlsx` 檔的 OOXML 套件進行正規化後比對。這是完整靜態輸出符合性的目標，因為它能抓到階段 1 看不到的版面、樣式、合併、工作表結構與套件層級的回歸。

錯誤 fixture 與動態 fixture 不屬於活頁簿輸出比對。不論比對階段為何，它們仍沿用各自的 `expected_error` 與 `expected_dynamic` 通過/失敗規則。

報告 **SHOULD** 標明每次執行所使用的比對階段。實作 **MUST NOT** 從只跑階段 1 的執行中主張階段 2 符合性。靜態輸出 fixture **MAY** 在 `meta.yaml` 中宣告 `comparison_stage`。當 fixture 宣告的比對階段高於執行器目前的階段時，執行器 **MUST** 略過該 fixture。

## 階段 2 輸出比對

比對是在 **正規化後** 的 OOXML 上進行。最低正規化規則：

1. zip 內的檔案 **MUST** 依內容比對，而非依 zip 中繼資料（時間戳、壓縮、項目順序或壓縮等級）。
2. 套件 part 名稱在正規化後 **MUST** 相符。除非後續 ADR 將該 part 標為易變，否則缺少或多餘的活頁簿 part 視為差異。
3. XML 檔案 **MUST** 在解析並以決定性的命名空間宣告、屬性順序、引號樣式與空元素表示法重新序列化後比對。
4. 除非後續 ADR 明確將某特定元素集合標為無序，否則 XML 元素順序 **MUST** 被保留。在這類規則出現之前，關聯檔案是有序的套件資料，不是集合。
5. 下列欄位在比對前會被剝除（它們反映產生器中繼資料，而非內容）：
   - `cp:lastModifiedBy`、`dc:creator`、`dcterms:created`、`dcterms:modified`
   - 任何 `<calcPr>` 的 `calcId` 屬性（Excel 計算引擎版本）
   - 當能透過活頁簿關聯與工作表名稱解析時，產生的工作表 id 與工作表 part 檔名
   - ExcelJS 可能新增或省略的預設頁面設定值（`copies="1"`、`firstPageNumber="1"`、`useFirstPageNumber="1"`）
6. 文字 run 內的非顯著空白會被保留（它可能具有語意）。
7. 儲存格 `r`（reference）屬性 **MUST** 完全相符；`<row>` 內儲存格的順序 **MUST** 相符。
8. 二進位套件 part，例如影像，**MUST** 以精確位元組比對。

JS 參考執行器附帶一個用於符合性比對的階段 2 正規化器。它刻意限縮到由所支援的 XTL fixture 所產生的 OOXML，加上上述正規化規則；它不是通用的 XML 正規化函式庫。特別是，它並不主張完整支援 XML C14N、DTD/實體處理、語意命名空間改寫，或除此處明列之外的應用程式特有無序集合規則。若 fixture 需要額外的 OOXML 等價規則，**SHOULD** 先更新本協定。

### 已知正規化缺口

下列情況目前的正規化器 **NOT** 進行正規化。若它們出現就會被視為差異。理由見 [ADR-0006](/zh-TW/spec/decisions/0006-stage-2-ooxml-conformance) 修訂。

- **預設屬性等價。** 對 OOXML 預設值有定義的布林屬性，省略與顯式發出預設值（例如 `applyFont="0"`）會被視為差異。
- **色彩十六進位大小寫。** `rgb="FF000000"` 與 `rgb="ff000000"` 視為不同字串。
- **命名空間前綴繫結。** 同一命名空間 URI 繫結到不同前綴時，不會被統一。

當某個跨書寫器 fixture 把上述缺口暴露成 **真正易變** 的差異（不是把內容差異包裝成這種差異），協定與參考正規化器 **SHOULD** 一起延伸。實作 **MUST NOT** 在本機悄悄放寬這些規則。

## 執行器 CLI 慣例

實作 **SHOULD** 對外提供一個具備下列最低介面的執行器：

```
<runner> [--fixture-dir=<path>] [--filter=<tag>] [--spec-version=<x.y>] [--comparison-stage=1|2] [--report=json|text]
```

提供階段 2 正規化器的實作 **SHOULD** 同時對外提供一個除錯指令，以決定性的 part 順序印出正規化後的套件內容：

```
<runner> canonicalize <input.xlsx> [--part=<canonical-part-name>]
```

當省略 `--part` 時，該指令 **SHOULD** 發出一個以正規套件 part 名稱為鍵的 JSON 物件。當提供 `--part` 時，**SHOULD** 只發出該正規 part 的內容。

JSON 報告格式：

```json
{
  "implementation": "xl3-js",
  "version": "0.1.0-alpha.0",
  "spec_version": "0.1",
  "comparison_stage": 1,
  "results": [
    {
      "fixture": "001-basic-substitution",
      "status": "pass",
      "duration_ms": 12
    },
    {
      "fixture": "007-aggregate-sum",
      "status": "fail",
      "duration_ms": 8,
      "diff": "cell B5: expected 1234, got 1234.0"
    }
  ],
  "summary": {
    "total": 42,
    "passed": 40,
    "failed": 1,
    "skipped": 1
  }
}
```

## 回報符合性

實作透過連結至一份公開的符合性執行結果，回報其符合性等級。預期形式如下：

```
xl3-py 0.2.0 — XTL 0.1 conformance: 38/42 (passes filter, repeat, aggregate; fails image-clone, _config-pattern-match, two date-edge cases)
```

repo 中的 [`IMPLEMENTATIONS.md`](/zh-TW/implementations) 列出已知實作及其符合性等級。
