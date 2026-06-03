---
sidebar_label: '17 · 編寫範本時的顯示'
pagination_label: '17 · 編寫範本時的顯示'
---

# 17 · 編寫範本時看到的畫面

## 常見情境

你打開 `template.xlsx` 編輯。看到：

- 一個儲存格 `=VLOOKUP("Acme", Data!A:B, 2, FALSE)` 顯示 `#N/A`。
- 一個儲存格 `=Data!B2 + 100` 顯示 `#VALUE!`。
- 一個格式為 `NT$#,##0` 的儲存格，顯示 `{{ [金額] }}` 純文字。
- 點進佔位符儲存格時跳出資料驗證警告。

**這些都不是 bug。** xl3 渲染範本後，這些都會消失：

- Data 工作表的佔位符被替換成真正的值。
- VLOOKUP 找到 A 欄的 "Acme"。
- `+100` 變得可行，因為儲存格現在是數字。
- 貨幣格式套用到替換後的數字。
- 驗證規則套用到實際的值。

這篇食譜解釋*為何*編寫範本時會看到這些畫面、以及覺得吵雜時可以怎麼處理。（背後的規格契約是 ADR-0049。）

## 為何佔位符顯示為字面文字

當範本儲存格值為 `{{ [金額] }}`、格式為 `#,##0.00`，Excel 看到的是一個非數值字串在數值儲存格裡。Excel 的行為：

- 原樣顯示文字（不自動套用格式）。
- 不會顯示「數字以文字儲存」綠色三角形（這個 heuristic 需要看起來像數字的內容；`{{ ... }}` 顯然不是數字）。
- 不會報錯（它就是一個字面字串，不是有缺陷的公式）。

編輯時儲存格顯示 `{{ [金額] }}`。xl3 渲染後同一個儲存格顯示 `1,234.56`（或值 × 格式組合出的內容）。

**這是刻意的。** 可見的佔位符讓範本*自說明*：不需要實際跑，就能看到哪些儲存格是動態、哪些是固定。審閱者打開檔案就能直接讀到契約。

## 為何儀表板公式顯示錯誤（以及怎麼整理）

儀表板工作表常有這類公式：

```excel
=VLOOKUP("Acme", Data!A:B, 2, FALSE)
=Data!B2 + 100
=AVERAGE(Data!B:B)
=SUMPRODUCT((Data!A:A="VIP") * Data!B:B)
```

打開範本（渲染之前），這些都參照 Data 工作表的佔位符列。Lookup 找不到（字串不會配對到字面值的 key）；對字串做算術會回 `#VALUE!`。結果：編寫時儀表板裡一堆紅色儲存格。

### 修正：用 `IFERROR` 包起來

Excel 原生的答案。每條公式加一行，幾秒鐘就會。

```excel
=IFERROR(VLOOKUP("Acme", Data!A:B, 2, FALSE), "—")
=IFERROR(Data!B2 + 100, 0)
=IFERROR(AVERAGE(Data!B:B), 0)
=IFERROR(SUMPRODUCT((Data!A:A="VIP") * Data!B:B), 0)
```

渲染前範本檢視：乾淨（`—`、`0`）。
渲染後輸出：真實值（xl3 依 [ADR-0046](/zh-TW/spec/decisions/0046-cell-formula-preservation) 不會動公式文字；Excel 在開啟時重算，wrapper 變得透明）。

### 哪些公式需要包

| 公式 | 範本檢視會錯嗎？ | 要包嗎？ |
|---|---|---|
| `=SUM(Data!B:B)` | 否 — SUM 略過範圍中的文字，回傳 0 | 選用 |
| `=SUMIF(Data!A:A, "VIP", Data!B:B)` | 否 — 沒比對到就回 0 | 選用 |
| `=COUNTIF(Data!A:A, "VIP")` | 否 — 回 0 | 選用 |
| `=AVERAGE(Data!B:B)` | **是** — 沒數字時回 `#DIV/0!` | 要 |
| `=VLOOKUP("key", Data!..., ...)` | **是** — 沒配對到時 `#N/A` | 要 |
| `=INDEX(...,MATCH("key",Data!A:A,0))` | **是** — `#N/A` | 要 |
| `=Data!B2 + N`（儲存格層級算術） | **是** — `#VALUE!` | 要 |
| `=Data!B2 & " text"`（文字串接） | 否 — 與佔位符的字串串接會成功 | 不用 |
| `=COUNTA(Data!A:A)` | 否 — 計算非空白儲存格，佔位符算數 | 不用 |

**經驗法則：** 對佔位符列會回 `#N/A`、`#VALUE!`、`#DIV/0!` 的公式都要包。彙總類函式（`SUM`、`COUNT*`、`SUMIF*`）容忍文字，不用包。

## 驗證渲染輸出

不必從範本檢視推測渲染結果。三條快速路徑：

### 1. xl3.io 遊樂場

把 `template.xlsx` + 範例 `data.xlsx`（或用內附的範例）丟到 [xl3.io](https://xl3.io)。幾秒內就能看到渲染後的活頁簿。

### 2. 宿主裡用 `preview()` API

如果你把 xl3 嵌入 TypeScript 宿主：

```ts
import { preview } from '@jinyoung4478/xl3';

const result = await preview(templateBuffer, dataBuffer);
console.log(result.sources);   // 偵測到的來源列
console.log(result.files);     // 輸出檔案與工作表
console.log(result.warnings);  // 任何非致命問題
```

`preview()` 跑與 `convert()` 相同的 parse + early-evaluation 階段，但不產生活頁簿位元組 — 適合在發起完整渲染前做宿主端驗證。

### 3. CLI 快速 smoke test

```bash
# 重建範例活頁簿（想要新鮮樣本時）
npm run examples:build

# 渲染一份並檢查
node -e "
import('@jinyoung4478/xl3').then(async ({ convert }) => {
  const fs = await import('node:fs/promises');
  const tpl = await fs.readFile('./template.xlsx');
  const data = await fs.readFile('./data.xlsx');
  const outs = await convert(tpl.buffer, data.buffer);
  for (const o of outs) await fs.writeFile('rendered-' + o.filename, o.data);
})
"
```

打開 `rendered-*.xlsx` 看實際輸出。

## 編寫時的資料驗證提示

如果你給某欄設定了「必須是 0 到 100 之間的數字」這類驗證，編寫時點進佔位符儲存格，Excel 就會跳驗證提示（「此值與規則不符」）。

選擇：

- **把驗證樣式設成 `警告` 或 `資訊`**，而不是 `停止` — 提示仍會出現，但不阻擋編輯。
- **把驗證放在非佔位符儲存格、再讓它傳播到資料列**。xl3 的保留機制（ADR-0036 §8）會把規則帶到展開後的列。
- **接受點擊時的提示** — 一旦 xl3 替換成真實值就消失，操作員看渲染後的檔案根本不會遇到。

## xl3 刻意**不做**什麼

這是 [ADR-0049](/zh-TW/spec/decisions/0049-template-display-vs-render-output) 的契約：

1. xl3 **不會**在範本檢視中用範例值預先替換佔位符。（那會抹掉視覺上的佔位符訊號。）
2. xl3 **不會**為每個儲存格維護兩份 `numFmt`（「範本檢視格式」vs「渲染格式」）。（規格面變大，效益微薄。）
3. xl3 **不會**自動把儀表板公式用 `IFERROR` 包起來。（會以 ADR-0046 禁止的方式改寫公式；會默默吞掉作者真正的錯誤。）

範本檢視由作者負責；渲染輸出由引擎負責。它們在設計上就是兩件不同的事。

## 延伸閱讀

- [ADR-0049 — Template-display vs render-output: intentional asymmetry](/zh-TW/spec/decisions/0049-template-display-vs-render-output)
- [ADR-0046 — Cell formula preservation contract](/zh-TW/spec/decisions/0046-cell-formula-preservation)
- [食譜 16 — XTL 函式 vs Excel 公式](./16-xtl-vs-excel-formula.md)
- [`preview()` API 文件](/zh-TW/api/functions/preview)
