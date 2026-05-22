# 路線圖

要達成 **XTL 1.0**（規範）與 **xl3 1.0**（參考實作），需要完成哪些事。

目前版本是 **0.7.0**（npm），對應 **XTL 0.1（草案）**。0.x 期間仍可能出現破壞性變更。1.0 的切版時機取決於下方列出的事項，並非看日期。

> **深層的版本規劃**寫在
> [`docs/internal/blueprint-to-1.0.md`](./docs/internal/blueprint-to-1.0.md)
> — 包含落差分析、哲學界線（xl3 ≠ JXLS）、各版本的逐步計畫。
> 本文件是電梯簡報；藍圖才是論述依據。
>
> **1.0 里程碑的唯一事實來源是下方表格。** 當本檔與藍圖衝突時，
> 以本表為準；藍圖會跟著更新對齊。

## 1.0 對 xl3 而言代表什麼

1.0 的目標是**讓營運人員能放心信任**：規範不會隨意改、參考實作不會給意外、整體介面小到讓營運人員不必看程式碼也能審閱範本。它**不是**要在功能上跟 JXLS 比拼齊全 — xl3 刻意只提供較小的介面（ADR-0043 + ADR-0048）。預期的主要使用者是**管理大量客戶專屬發票格式的韓國營運團隊**（거래명세서、정산서、발주서）；引擎在此利基之外仍可一般化使用，但這個利基是切入點。

## 1.0 里程碑表（唯一事實來源）

每個關卡都有負責人、用以關閉它的產出物、通過／不通過的判準、若無法達成的退路，以及目標版本。下方各版本的逐步計畫會用 ID 引用這些關卡。

| ID | 關卡 | 負責人 | 產出物 | 通過判準 | 退路 | 目標 |
|----|------|-------|----------|----------------|----------|--------|
| G1 | 符合性測試案例 ≥ 140 | 維護者 | `conformance/fixtures/` | `ls conformance/fixtures/ \| wc -l` ≥ 140 | — | 0.7.1（目前 139；0.7.0 ADR 已預留 141–187 號） |
| G2 | Stage 2 OOXML 正規化規範完成 | 維護者 | ADR-0006 + src/ 內的正規化器 | 由 fixtures 024-027、093 + ADR-0006 修訂涵蓋 | — | 已完成 |
| G3 | 錯誤碼目錄凍結 | 維護者 | `src/__tests__/error-codes.test.ts` 快照 | 目錄快照連續 30 天無變動 | — | 0.9-rc（時鐘於 2026-05-22 因 0.7.0 新增 4 個錯誤碼而重置） |
| G4 | JXLS 邊界公開 | 維護者 | ADR-0048 | 檔案存在，且引用 PORTERS_GUIDE | — | 已完成 |
| G5 | 延遲實作 ADR 落地 | 維護者 | ADR-0038 實作 ✅（2026-05-18）+ ADR-0040 PE 實作 | ADR-0038 部份已交付（fixtures 132-135）；ADR-0040 CF/DV 範圍擴充仍待處理 | — | 0.6（部份）／0.7.1 |
| G6 | 公開 API 介面凍結 | 維護者 | `src/__tests__/api-surface.test.ts` 快照 | 快照連續 30 天無變動 | — | 0.9-rc |
| G7 | `@stable` 匯出加上 JSDoc 範例 | 維護者 | TypeDoc 產出 | 每個 `@stable` 符號都有 `@example` 區塊 | — | 0.8 |
| G8 | 效能特徵已量化 | 維護者 | `scripts/BENCH.md` | 公佈 1k/10k/100k 列 × 5/10/20 欄矩陣 + 記憶體上限 + parse/eval/write 分項 | — | 0.7.1 |
| G9 | 效能回歸測試案例 | 維護者 | 符合性語料庫 | ≥ 2 個大型測試案例，採用比例式斷言 | — | 0.7.1 |
| G10 | 跨瀏覽器冒煙測試 | 維護者 | `ci.yml` | Safari + Firefox 載入打包檔 + 每次執行至少跑 1 次 convert() | — | 0.7.1 |
| G11 | Stage 2 納入 CI | 維護者 | `ci.yml` | 每個 PR 都跑 `npm run conformance:stage2` | — | 0.7.1 |
| G12 | 釘住未決行為（pivot／sparkline／ListObject／分頁符） | 維護者 | 符合性測試案例 + 各項對應 ADR | 每項：用測試案例釘住現行行為，或以 ADR 明確延後到 1.x | 以 ADR 延後到 1.1 | 0.7.1／0.8 |
| G13 | 第二語言實作驗證 | 外部（xl3-py） | `conformance/reports/*.json` | xl3-py 通過 ≥ 80% Stage 1 或 ≥ 80% Stage 2，或在其他關卡全部關閉的 12 個月內，於另一種語言（Rust／Go／Java）有文件化的 50% 骨架 | 透過公開 ADR 修訂 GOVERNANCE，接受單一實作的 1.0 | 0.7.x–0.8.x |
| G14 | 外部貢獻者撰寫的 ADR | 外部 | `spec/decisions/NNNN-*.md` | ≥ 1 個 ADR 的 Author 是非維護者（依行數計算 Context／Decision 章節 ≥ 60%） | 設 18 個月期限，到期後改為：≥ 2 個外部撰寫的食譜，或 ≥ 5 個外部撰寫的符合性測試案例 | 0.8 |
| G15 | 生產環境參考案例 | 外部（維護者協助） | `IMPLEMENTATIONS.md` 的「Production users」列 | ≥ 1 個具名使用者，可為 (a) 取得列名許可的外部公司，或 (b) 維護者本人服務的雇主在生產環境定期執行 xl3 並公開案例研究 | — | 0.8 |
| G16 | 擴大維護者陣容 | 維護者 | `GOVERNANCE.md` | ≥ 2 人對 ADR 與實作 PR 具有接受／拒絕的權限 | 以修訂 GOVERNANCE 的方式明確接受單一維護者形式的 1.0 治理 | 0.8 |
| G17 | 韓文食譜 i18n 完成 | 維護者 | `website/i18n/ko/.../guides/` | 所有食譜皆有韓文翻譯 | — | 已完成（0.6） |
| G18 | README 中的生產使用案例 | 維護者 | `README.md` | 將「alpha」狀態替換為具體的生產環境參考案例（與 G15 連動） | — | 1.0（與 G15 同步） |
| G19 | 0.x → 1.0 移轉指南 | 維護者 | `docs/migration-0.x-to-1.0.md` | 記錄每項行為變更，或確認僅為新增 | 若確認僅為新增，可降級為 CHANGELOG 註記 | 0.8 |
| G20 | SECURITY.md + 威脅模型 | 維護者 | `SECURITY.md` + 規範修訂 | 文件化 zip-bomb／過大的活頁簿／公式執行立場 + limits API | — | 0.7.1 |
| G21 | 硬性限制有文件（1.1 前不做串流） | 維護者 | spec/evaluation.md | 公佈列／記憶體硬性上限值 + AbortSignal API | — | 0.7.1 |
| G22 | API 介面 — 內部 model 型別分離 | 維護者 | `src/index.ts` 匯出 + STABILITY.md | 僅 `convert`／`preview`／`analyze` + 標示 `@stable` 的穩定介面對外；model／parser 型別標為 `@experimental` 或搬到 `xl3/internal` | — | 已完成（0.6） |
| G23 | RC 浸泡期 | 維護者 | git tags | RC 已發佈；連續 ≥ 21 天浸泡（依審查意見從 7 天延長）；0 個關鍵問題 | — | 0.9-rc |
| G24 | 「穩定季」結束檢查 | 維護者 | 發佈行事曆 | 最後一個關卡打 ✅ 之後的 90 天視窗；期間規範／API／錯誤碼皆無破壞性變更 | 破壞性變更 → 時鐘重置 | 介於最後關卡打勾與 1.0 切版之間 |

### 定義（可驗證）

- **外部貢獻者（G14）：** 不在 `GOVERNANCE.md` 維護者名單中，且在 PR 開啟當下不在已合併 ADR commit 的 `Co-authored-by` 歷史中。順手修錯字不算；需以具名 Author 出現在 ADR 前言；依行數需撰寫 ≥ 60% 的 Context／Decision 章節。
- **破壞性變更（G24、G23）：** 對 (a) 公開 API 介面快照、(b) 錯誤碼目錄（重新命名／移除／重新用途）、(c) ADR 從 `accepted` 改為 `rejected` 或狀態翻轉為矛盾的任一變更。Patch 版與僅新增的 ADR 不會讓季度時鐘重置。
- **關鍵 bug 修正（G23 RC 例外）：** (a) `convert()` 中的靜默資料遺失、(b) 文件與執行期之間的錯誤碼目錄不一致，或 (c) 已 `accepted` 的 ADR 中 MUST 寫法無法依字面實作。維護者需在 PR 中指出屬於 (a)／(b)／(c) 哪一類。
- **資料遺失測試（G24 可驗證形式）：** 語料庫中需有專屬的 `data-loss/` 測試案例群組（≥ 8 個），涵蓋靜默字串化、numFmt 遺失、公式改寫、日期往返路徑；全部在參考實作通過。
- **季度時鐘啟動時機（G24 vs G23）：** 90 天的季度從**最後一個關卡**打 ✅ 的那天開始。發佈 RC **不會**啟動時鐘；時鐘必須在 RC 發佈之前就已啟動。若 RC 浸泡期間發生破壞性變更，浸泡期（G23）與季度（G24）都會重置。

## 各版本逐步計畫

以關卡為準，不以日期為準。日期估計已移除 — 每個里程碑在其列出的關卡關閉時才會切版。

### 0.6.0 — 延遲實作、窄範圍

主題：把影響最大的延遲實作關卡乾淨地關掉。

關閉的關卡：**G5**（僅 `@group`／`@subtotal` 實作 — ADR-0040 PE 的其餘部分移到 0.6.1）、**G17**（韓文食譜還缺 16/17 篇翻譯）、**G22**（在 `@group` 暴露新內部型別之前先把 API 介面收乾淨）。

先前「0.6.0 一次包山包海」的計畫，依工程可行性審查的判斷範圍過大。光是 ADR-0038 的實作就是一整條管線插入（新指示子、群組邊界狀態機、transform-pass 切分、渲染器重寫、群組範圍的彙總求值）。把 0.6.0 拆開才能讓里程碑順利出貨。

### 0.6.1 — 其餘的延遲實作（已規劃，尚未出貨）

關閉的關卡：**G5** 完成（ADR-0040 PE：CF/DV `sqref` 範圍擴充），以及朝 **G12** 推進的 pivot／分頁符行為測試案例。

截至 0.7.0 出貨時的狀態：本里程碑因規範稽核批次（0.7.0）而被略過。G5/G12 的工作併入 0.7.1。

### 0.7.0 — 規範稽核批次（2026-05-22 出貨）

主題：關閉透過深度稽核 lexer、儲存格分類、指示子組合、彙總引數、保留工作表語意所浮現的 17 個語法衝突落差。原始里程碑表中並未排定；原本掛在 0.7.0 的效能／CI／limits 工作改至 **0.7.1**。

已出貨的產出物：

- 15 個新 ADR（0051–0065）+ 對 ADR-0021（群組順序目錄條目）與 ADR-0041（標頭儲存格多行正規化）的修訂。
- 4 個新錯誤碼 — `xl3/parser/unbalanced-literal`、`xl3/lists/invalid-use`、`xl3/eval/bad-aggregate-arg`、`xl3/expression/unknown-name`。
- 文法新增：`positive_integer`、`group_directive`、`subtotal_directive`、`aggregate_call`、詞法消歧註記。
- `src/directive-parser.ts` 對前置零整數的嚴格化處理。
- 兩道並行審查（claude-general + codex）；所有 CRITICAL／HIGH 發現於打標籤前皆已關閉。

關卡影響：

- **G1** — 目前 139 個測試案例。0.7.0 的 ADR 預留了 **141–187** 號；實作仍待處理。等這批測試案例在 0.7.1 落地後，G1 才會關閉。
- **G3** — 30 天錯誤碼目錄時鐘於 2026-05-22 因 4 個新錯誤碼**重置**。
- **G6** — 公開 API 介面無變更；G6 時鐘不受影響。

### 0.7.1 — 效能 + 外部驗證起步（從原 0.7.0 重新編號）

關閉的關卡：**G5** 完成（ADR-0040 CF/DV `sqref` 範圍）、**G8**（效能基準）、**G9**（效能回歸測試案例）、**G10**（跨瀏覽器）、**G11**（Stage 2 納入 CI）、**G20**（SECURITY.md 草稿 + 威脅模型）、**G21**（硬性限制 + AbortSignal 文件）。

也會把 0.7.0 ADR 預留的 141–187 號測試案例落地，藉此達成 **G1 ≥ 140 測試案例**的下限。

朝向：**G12**（釘住未決行為）、**G13**（xl3-py）。

重新貼標：在 G8 公佈、且 xl3-py 達到 ≥ 50% Stage 1 後，`alpha` → `beta`。

### 0.8.0 — 社群層面的關卡

關閉的關卡：**G14**（外部 ADR）、**G15**（生產案例）、**G16**（維護者擴編，或明確接受單一維護者形式）、**G19**（移轉指南）、**G20** 完成。

這個里程碑會是最長的一個。計畫是在招募期間持續推出 0.8.x patch，而不是默默乾等。

### 0.9.0-rc.x — 1.0 前的凍結

關閉的關卡：**G3**、**G6**、**G7**、**G23**（≥ 21 天 RC 浸泡）。

G23 開始後，G24 的季度時鐘就會啟動（它必須在 G3／G6／G7 等關卡關閉期間就已啟動 — 見上方定義）。

### 1.0.0 — 最終切版

關閉的關卡：**G24**（最後一個關卡打勾後，90 天季度走完）。

## 招募與對外推廣

社群層面的關卡（G13／G14／G15／G16）需要的是人，不是程式碼。本專案有兩個截然不同的招募面：

### 韓國營運受眾（G15、未來的食譜貢獻者）

通道：韓國開發者社群（Naver Café、Kakao 오픈톡、LinkedIn KR）、企業內部／供應商範本作者問卷。每次 minor 釋出都搭配一篇與發佈時刻連動的韓文貼文（0.6 = 用於發票小計樣式的 `@group`／`@subtotal` demo；0.7 = 效能數字；0.8 = 案例研究）。

### 英文 OSS 受眾（G13、G14）

通道：HN、lobste.rs、r/excel、研討會 CFP（JSConf、給 xl3-py 的 EuroPython）。每個重大時刻都搭配一份具體的對外產出：

- 0.7.0 釋出：「Show HN: xl3 0.7 — 100k 列的 Excel 範本引擎」
- 0.8.0 釋出：案例研究 + xl3-py 符合性儀表板
- 1.0.0 釋出：規範 + 多實作驗證

## 1.0 的非目標

以下都是刻意延後的項目。每項都有對應的 ADR 解釋原因：

- **超出 Y/M/D/EOMONTH/EDATE/DATEDIF 的日期運算** — 其餘相關函式依 [ADR-0019 修訂](./spec/decisions/0019-deferred-date-arithmetic.md)延後。
- **語言環境感知的字串排序** — [ADR-0020](./spec/decisions/0020-deferred-locale-collation.md)。
- **多重 join、left-join、多列匹配** — [ADR-0014](./spec/decisions/0014-source-joins.md) 的 out-of-scope 章節。
- **XLOOKUP 萬用字元／近似比對／反向搜尋** — [ADR-0013](./spec/decisions/0013-xlookup-cross-source-lookup.md) 的 out-of-scope 章節。
- **動態插入圖片** — [ADR-0037](./spec/decisions/0037-rejected-dynamic-image-insertion.md)。
- **執行期儲存格變更** — [ADR-0042](./spec/decisions/0042-rejected-runtime-cell-mutation.md)。
- **依 ADR-0043 關卡被否決的函式** — 數學擴充、型別判定（除 ADR-0047 的 `ISBLANK` 外）、NOW／WEEKDAY 等、條件式彙總、TEXT() 格式 token 擴充。詳見 [ADR-0045](./spec/decisions/0045-function-batch-rejected.md)。
- **串流輸出／類 SXSSF。** 延後至 1.1+。**1.0 時改以文件記載記憶體／列硬性限制（G21）。**
- **範本編譯快取 API。** 延後至 1.1+。
- **PDF／HTML 輸出。** 不在範圍內；xl3 是 xlsx 進、xlsx 出。
- **跨寫入器的 Stage 2 測試案例（除 `093` 外）** — 見 [ADR-0006](./spec/decisions/0006-stage-2-ooxml-conformance.md) 修訂。

這些都仍是 **XTL 1.1、1.2、1.x** 視需求列入的候選項目。

## 如何協助關閉項目

| 項目 | 如何協助 |
|---|---|
| G13 第二實作 ≥ 80% | 參與 [xl3-py](https://github.com/jinyoung4478/xl3-py)，或自行起手新移植（Rust、Java、Go）。詳見 [PORTERS_GUIDE.md](./PORTERS_GUIDE.md)。 |
| G14 外部 ADR | 挑一個延後的項目（pivot table 保留、分頁符、ADR-0045 切出來的函式），在 `spec/decisions/` 草擬一份 ADR。詳見 [GOVERNANCE.md](./GOVERNANCE.md) 的「變更如何進入專案」。GitHub 上提供了一些 `good-first-ADR` 議題作為起手 ADR 雛形。 |
| G15 生產案例 | 在公司內部使用 xl3，分享哪些順利、哪些不順。如果適合，可在 [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md) 加一列。維護者本人的雇主（Snack24h）若推出公開案例研究亦符合資格。 |
| G17 韓文食譜 16+17 i18n | 翻譯最新的兩篇食譜（其餘皆已完成）。 |
| G8 效能基準 | 用具代表性的範本跑 `npm run bench` 並分享結果。 |
| G10 跨瀏覽器 | 在打包檔的冒煙測試中加上 Safari + Firefox。 |
| 函式重新提案 | 若你需要某個依 ADR-0045 被否決的函式，請依 [`Function re-proposal`](https://github.com/jinyoung4478/xl3/issues/new?template=function-reproposal.md) 議題範本提出。 |

## 本路線圖如何演進

本文件是公開的電梯簡報，里程碑表才是唯一事實來源。較深層的
[`docs/internal/blueprint-to-1.0.md`](./docs/internal/blueprint-to-1.0.md)
承載落差分析、哲學界線與各版本理由。當關卡打勾時，兩份文件都會更新。當有新落差浮現時，兩份文件都會加上。

對 1.0 里程碑表的刪減與新增，與其他事項一樣，透過相同的 ADR／議題流程討論。
