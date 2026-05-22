# 為 xl3 貢獻

xl3 是 [XTL 規範](./spec/)的 TypeScript 參考實作。本檔同時涵蓋實作與規範的貢獻路徑。

在 0.x 階段，本專案由單一作者維護。歡迎貢獻，但規範變更的門檻較高 — XTL 致力成為穩定、語言中立的標準。

決策方式請見 [GOVERNANCE.md](./GOVERNANCE.md)，1.0 切版的阻塞項目請見 [ROADMAP.md](./ROADMAP.md)。

## 快速開始

```bash
git clone https://github.com/jinyoung4478/xl3.git
cd xl3
npm install
npm test
```

## 三類貢獻

### 1. 實作 bug（本 repo，`src/`）

與規範不一致的參考實作 bug 永遠歡迎。步驟：

1. 開一個議題，附最小重現範例（template.xlsx + data.xlsx + 觀察到 vs 預期輸出）。
2. 若有修正，送 PR 並在 `src/__tests__/` 加上回歸測試。

若 bug 屬於「實作符合規範但規範錯了」，請見 (3)。

### 2. 規範問題與澄清（`spec/`）

規範具規範性。若你發現未定義清楚的行為：

1. 開一個議題並貼上 `spec` 標籤。
2. 若答案很小（錯字、澄清），歡迎直接 PR。
3. 若答案牽涉設計決策，維護者會在 [`spec/decisions/`](./spec/decisions/) 草擬 ADR。

### 3. 符合性測試案例（`conformance/fixtures/`）

符合性語料庫是 XTL 的可執行定義。這裡的測試案例比任何單一實作都更長壽。**撰寫前請先讀 [`conformance/AUTHORING.md`](./conformance/AUTHORING.md)。**

首要規則：**預期輸出依規範撰寫，不從 JS 實作產生。** 只把 JS 實作的行為紀錄下來的測試案例，會把實作凍結成事實上的規範 — 這正是 XTL 想避免的。

### 4. 移植到其他語言

歡迎其他語言的實作，並在 [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md) 追蹤。要列入移植：

1. 依規範實作，不要依 JS 實作。
2. 依 [`conformance/runner-protocol.md`](./conformance/runner-protocol.md) 跑你的實作通過符合性語料庫。
3. 送 PR 在 `IMPLEMENTATIONS.md` 新增一列。

## 程式撰寫慣例（TypeScript 實作）

- TypeScript strict 模式開啟；PR 必須能型別檢查通過（`npm run typecheck`）。
- 測試放在 `src/__tests__/`。以 `npm test` 執行。
- 新功能需有測試。Bug 修正需有回歸測試。
- 除非必要，避免新增執行期相依套件。目前的相依：`exceljs`、`jszip`。

## Commit 訊息

可採用 [Conventional Commits](https://www.conventionalcommits.org/)：

- `feat:` — 實作的新功能
- `fix:` — 實作的 bug 修正
- `spec:` — `spec/` 底下規範文字的變更
- `conformance:` — 測試案例語料庫或 runner 協定的變更
- `docs:` — README、CONTRIBUTING 等
- `chore:` — 工具、CI、相依
- `test:` — 實作中僅變更測試

破壞性變更加上 `!`（例如 `feat!: rename count to rowcount`）。

## 0.x 期間的規範變更

0.x 期間允許規範的破壞性變更，但必須：

1. 由 [`spec/decisions/`](./spec/decisions/) 中 `status: accepted` 的 ADR 推動。
2. 提升規範 minor 版本號（`0.1` → `0.2`）。
3. 與 `conformance/fixtures/` 的測試案例更新一同落地。

1.0 之後，破壞性規範變更需要 XTL 2.0 加移轉指南。

## 發佈（僅限維護者）

1. 解決所有列入該次發佈的進行中 ADR。
2. 更新 `CHANGELOG.md`。
3. 在 `package.json` 提升版本。
4. `npm publish`（由 `prepublishOnly` 控管：型別檢查 + 測試 + 建置）。
5. 為該 commit 打標籤（`git tag v0.1.0 && git push --tags`）。

## 適合新手的貢獻

若你想貢獻但沒有特定癢處，這幾項投資報酬率最高。每項都對應 [ROADMAP.md](./ROADMAP.md) 的某個 1.0 阻塞項目。

1. **提案一個符合性測試案例**，補上目前還沒有測試案例的規範規則。使用「**Conformance fixture proposal**」議題範本。撰寫測試案例本身不需要 TypeScript — 只需 `template.xlsx` + `data.xlsx` + 預期輸出（或預期錯誤）。
2. **食譜翻譯。** 在 [`docs/guides/`](./docs/guides/) 裡的 15 篇食譜中挑一篇，翻譯成韓文（或任何其他語言）。把檔案放在 `docs/guides/<lang>/NN-*.md` 並送 PR。協調成本低、價值高。
3. **以真實報表資料跑 xl3 並回報摩擦點。** 開一個簡短議題並貼 `early-adopter-feedback` 標籤，內容包含：嘗試做什麼報表、哪些順利、哪些不順、希望 XTL 多支援什麼。這會塑造 1.0 的樣貌。
4. **規範澄清。** 若你讀規範時發現某句話有歧義，開議題並貼 `spec` 標籤，附上原句加上兩種合理解釋。即使未被接受，通常也會觸發規範改善。
5. **移植進度。** 在做 [xl3-py](https://github.com/jinyoung4478/xl3-py) 或其他移植嗎？放一份 `conformance/reports/<impl>-<version>.json`（格式定義於 [`conformance/runner-protocol.md`](./conformance/runner-protocol.md)），儀表板會自動收進來。

## 行為準則

請彼此尊重。歡迎技術決策上的不同意見；不接受人身攻擊。
