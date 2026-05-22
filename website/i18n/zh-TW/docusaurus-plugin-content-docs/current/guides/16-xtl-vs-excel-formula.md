---
sidebar_label: '16 · XTL 函式 vs Excel 公式'
pagination_label: '16 · XTL 函式 vs Excel 公式'
---

# 16 · XTL 函式 vs Excel 公式

## 常見地雷 — 從這裡開始

你會來看這頁，大概是因為什麼不如預期。最常見的幾種：

### 「我想在儲存格顯示 `NT$1,234,567`，`TEXT([金額], "NT$#,##0")` 沒效」

XTL 的 `TEXT()` 只實作了一小組格式 token；貨幣 token 不在裡面。正確答案是儲存格的**數值格式**：

| 步驟 | 位置 |
|---|---|
| 1. 在範本儲存格中，把儲存格格式設為 `"NT$"#,##0` | Excel 的「儲存格格式」對話框 → 自訂 |
| 2. 在那個儲存格裡放 `{{ [金額] }}`（純數字） | XTL 替換 |

渲染後的儲存格存放數字，Excel 顯示為 `NT$1,234,567`。排序、篩選、後續公式都能繼續運作，因為值仍然是數字。

同樣的模式可處理會計風格的負數 `(1,234)`（`#,##0;(#,##0)`）、百分比（`0.00%`）、日期（`yyyy-mm-dd`）。

### 「我想 `=B2*2` 逐列計算，但每一列都顯示一樣的答案」

xl3 在 `@repeat` 列展開時會**原樣保留**你的公式文字 — 它**不會**把 `B2` 改寫成 `B3`、`B4` 等等。（契約見 ADR-0046。）

請改用 XTL 表達式：

```text
{{ [金額] * 2 }}
```

它會在 render time 逐列求值，把算好的數字寫進每個儲存格。結果相同，沒有列參照混亂。

### 「我想在底部放合計；`=SUM(B2:B5)` 不會隨列展開延伸」

同樣的根因 — xl3 不改寫範圍參照。兩個選擇：

- **整欄參照**寫在頁尾：`=SUM(B:B)`（或在來源端用 `@filter` 只留資料列）。
- **XTL 彙總**：在頁尾儲存格寫 `{{ SUM([金額]) }}`。它會在 render time 計算並寫入數字。

### 「我想每列都有一個可點擊的連結」

用 XTL 的 `HYPERLINK()` 函式（URL / 標籤都能參照欄位）：

```text
{{ HYPERLINK([連結], [標籤]) }}
```

對於靜態 URL，在儲存格寫一條一般的 `=HYPERLINK("https://...", "label")` 公式也行（xl3 會保留）。

### 「我想要 5 個分支的 `IF(...)`，巢狀看不下去」

`IFS(c1, v1, c2, v2, ...)` 是 XTL 用來做多分支條件的函式。最後加 `TRUE, default` 做 fallback：

```text
{{ IFS([R] > 10000, "VIP", [R] > 1000, "普通", TRUE, "輕量") }}
```

### 「我想要像 `SUMPRODUCT` 或陣列公式那樣的 `SUM(Qty * Price)`」

XTL 彙總不接受引數內的逐列算術。`{{ SUM([數量] * [單價]) }}`、`{{ SUM([A] + [B]) }}`、`{{ AVERAGE([營業額] - [成本]) }}` 等形態會在 parse time 丟 `xl3/eval/bad-aggregate-arg`（ADR-0059）。引數必須是單一欄位參考：`[Column]` 或 `Source[Column]`。

三個選擇，依偏好排序：

1. **來源端輔助欄** — 在來源新增 `金額` 欄（計算或預先相乘），然後 `{{ SUM([金額]) }}`。這是 XTL 對於「A × B 的合計」的正規模式。
2. **頁尾儲存格寫原生 Excel `SUMPRODUCT`** — xl3 會原樣保留儲存格公式（ADR-0046）。在頁尾儲存格直接寫 `=SUMPRODUCT(E2:E10000, F2:F10000)`。請用偏大的範圍（`E2:E10000`），因為展開後的列數在編寫時未知。注意兩個頁尾陷阱（自欄參照；列超出造成重覆計算） — 見 [LLM 範本編寫指南 § Footer pitfalls](../llm-template-authoring.md#footer-pitfall-1--self-column-sum-raises-순환-참조-circular-reference)。
3. **逐列 XTL 儲存格 + 渲染輸出的輔助欄** — 在列層級儲存格放 `{{ [數量] * [單價] }}`（這個可行，因為它不是 aggregate context），再用 `{{ SUM([HelperColumn]) }}` 做頁尾 — 但前提是 HelperColumn 也是來源欄。否則只能回到方案 1 或 2。

為何有此限制：XTL 0.x 保持函式面小且可預測。逐列計算後彙總（Excel 的陣列公式行為）是延後特性 — 見 ADR-0059 §「Why not allow `SUM([a] + [b])`」。

### 「我在找 `SUMIF` / `COUNTIF` / `AVERAGEIF`」

別找這個函式 — 用資料區塊模式。例如「狀態 = VIP 的金額加總」：

```text
{{ @filter [狀態] = "VIP" }}
{{ @repeat down }}
... 資料列範本 ...
{{ SUM([金額]) }}
```

如果你需要同時顯示「篩選後的合計」與「未篩選的列」，就在儲存格直接寫 `=SUMIF(B:B, "VIP", C:C)` — xl3 會保留公式，Excel 在開啟時求值。

### 「我想要 `ISBLANK(x)`」

從 0.5.x 開始就有（ADR-0047）。值依 ADR-0007 為空時回傳 `true` — 包含只含空白字元的字串。

```text
{{ IF(ISBLANK([備註]), "(無)", [備註]) }}
```

也可以用 `IFEMPTY([備註], "(無)")` 作為 fallback 形式。兩者檢查相同的條件。

---

## 一般法則

> **只有當值必須在活頁簿被寫出之前就確定時，才用 XTL `{{ ... }}`。否則把公式放在儲存格，讓 Excel 在開啟時求值。**

界線就是 render time：

- **Render 之前 — 只能用 XTL：** `@filter`、`@sort`、`@top`、`@group`、`@subtotal`、來源資料彙總（`SUM`、`COUNT` …）、跨來源 `XLOOKUP`、`output_file_pattern`、`__sheet_name_pattern__`、`__inputs__` 預設值。Excel 觸不到這些 — 沒有儲存格讓它求值。
- **Render 之後 — Excel 沒問題：** 儲存格顯示格式、針對渲染後值的逐儲存格算術、輸出值的字串轉換、型別檢查、從輸出儲存格抽取日期成分。

這條原則具規範性 — ADR-0043 — 在結構上把 XTL 函式面保持精簡。每個不在 XTL 表中的 Excel 函式，就是刻意走 Excel 公式路線。

---

## 並列對照表

| 目標 | XTL 做法 | Excel 公式做法 | 採用 |
|---|---|---|---|
| 數字顯示為 `1,234,567.00` | `{{ TEXT([A], "#,##0.00") }}`（字串） | 儲存格 `numFmt = "#,##0.00"`，值 `{{ [A] }}`（數字） | 視覺用 **Excel 公式**；要字串時用 XTL |
| 顯示 `NT$1,234,567` | （XTL 不支援） | 儲存格 `numFmt = "NT$"#,##0` | **Excel 公式** |
| 負值用括號 | （不支援） | 儲存格 `numFmt = #,##0;(#,##0)` | **Excel 公式** |
| 逐列算術（`*2`） | `{{ [A] * 2 }}` | `=B2*2` ❌ 不會逐列改寫 | **XTL** |
| 隨展開範圍的頁尾 SUM | `{{ SUM([A]) }}` | `=SUM(B:B)` 整欄可用 | 兩者皆可 |
| A × B 的總和（SUMPRODUCT） | 來源端輔助欄 + `{{ SUM([金額]) }}` | 頁尾儲存格寫 `=SUMPRODUCT(E2:E10000, F2:F10000)` | **Excel 公式**或輔助欄 — `SUM([A]*[B])` 會丟 `xl3/eval/bad-aggregate-arg` |
| 靜態超連結 | （不需要） | `=HYPERLINK("...", "label")` | **Excel 公式** |
| 逐列動態超連結 | `{{ HYPERLINK([連結], [標籤]) }}` | 不可行（引號地獄） | **XTL** |
| 篩出「本月」的列 | `{{ @filter MONTH([日期]) = MONTH(TODAY()) }}` | （Excel 無法在 render 前篩選） | **僅 XTL** |
| 檔名是「上一個月」 | `{{ TEXT(EDATE(TODAY(), -1), "YYYY-MM") }}.xlsx` | （檔名沒有公式路徑） | **僅 XTL** |
| 多分支等級標籤 | `{{ IFS([R]>10000, "VIP", [R]>1000, "普通", TRUE, "輕量") }}` | `=IFS(B2>10000, "VIP", ...)` | 兩者皆可；filter / group 依此值時用 XTL |
| 條件彙總 | `@filter` + `SUM` 區塊 | `=SUMIF(B:B, "VIP", C:C)` | 區塊合計用 XTL；跨切面用 Excel 公式 |
| `MOD` / `INT` / `SQRT` / `POWER` | （XTL 不支援） | 儲存格公式 | **Excel 公式** |
| 空值檢查 | `ISBLANK([X])` 或 `IFEMPTY([X], "fallback")` | `=ISBLANK(B2)` | 皆可；ISBLANK 符合 Excel 慣用 |
| 其他 `IS*` 型別測試 | （不支援） | `=ISNUMBER(B2)` 等 | **Excel 公式** |

---

## 快速決策樹

```
這個值會影響：
  • 哪些列會被渲染？           → @filter / @sort       (XTL)
  • 列如何分組？               → @group / @subtotal    (XTL)
  • 輸出檔名？                  → {{ ... }}             (XTL)
  • 工作表名稱？                → {{ ... }}             (XTL)
  • __inputs__ 的 default？     → {{ ... }}             (XTL)
  • 逐列計算後的顯示？           → {{ ... }}             (XTL)
  • 儲存格「外觀」？             → 儲存格 numFmt          (Excel 側)
  • 逐列公式？                   → {{ ... }} 表達式      (XTL)
  • 整欄／靜態計算？             → 儲存格寫 =FORMULA     (Excel 側)
```

---

## 為什麼有這條規則

XTL 函式面在結構上保持精簡（ADR-0043），讓 porter 有清楚可實作的目錄。為「只用於儲存格輸出」加函式只是重複 Excel 已經做的事，讓規格膨脹。

代價：當作者用了儲存格公式，xl3 的輸出活頁簿就不是完全自包含 — 開啟它得仰賴 Excel 重新計算。對大多數營運報表而言這是預期工作流程。

當你發現自己在伸手找 XTL 沒有的函式：

1. **這個值是否用在指示子（`@filter`、`@sort`、`@top`、`@group`、`@subtotal`）內、或 `output_file_pattern` / `__sheet_name_pattern__` 內？** → 必須用 XTL。若 XTL 沒提供你需要的，請開 issue 用「Function re-proposal」範本（見 GitHub issues）。
2. **否則** → 把 Excel 公式直接放在儲存格。xl3 會保留它；Excel 在開啟時求值。

## 延伸閱讀

- [ADR-0043 — Excel-native preference principle](../../spec/decisions/0043-excel-native-preference.md)
- [ADR-0044 — Function batch accepted](../../spec/decisions/0044-function-batch-accepted.md)
- [ADR-0045 — Function batch rejected](../../spec/decisions/0045-function-batch-rejected.md)
- [ADR-0046 — Cell formula preservation contract](../../spec/decisions/0046-cell-formula-preservation.md)
- [ADR-0047 — ISBLANK as IFEMPTY alias](../../spec/decisions/0047-isblank-as-ifempty-alias.md)
- [食譜 10 — 樣式與品牌化](./10-styling-and-branding.md) — `numFmt` 是正確答案的時機
- [食譜 11 — TEXT() 格式化](./11-text-formatting.md) — `TEXT()` *是*正確答案的時機
- [食譜 12 — 深入處理空值](./12-empty-values.md) — IFEMPTY / ISBLANK 的搭檔
