# XTL 實作

[XTL 規範](./spec/)的各種實作。xl3 是參考實作。

| 語言 | Repo | 套件 | 規範版本 | 符合性 | 備註 |
|---|---|---|---|---|---|
| TypeScript | [`jinyoung4478/xl3`](https://github.com/jinyoung4478/xl3) | [`@jinyoung4478/xl3`](https://www.npmjs.com/package/@jinyoung4478/xl3) | XTL 0.1（草案） | 參考實作；**139/139** 測試案例通過（133 Stage 1 + 6 僅 Stage 2） | 瀏覽器 + Node ≥ 20.12；runner 透過 `npx xl3-conformance`；CI 跑 3-TZ 矩陣 |
| Python | [`jinyoung4478/xl3-py`](https://github.com/jinyoung4478/xl3-py) | _（未發佈）_ | XTL 0.1（草案） | **草案**，開發中 | 與參考實作並行追蹤；在 [`conformance/reports/`](./conformance/reports/) 放一份 `--report=json` 產物，`npm run conformance:dashboard` 就會收進來 |

## 新增實作

請先讀 [`PORTERS_GUIDE.md`](./PORTERS_GUIDE.md) — 它區分了「規範性需求」與「TS 實作偶然細節」，並給出對應符合性語料庫的建議開發順序。

要在這裡列出移植：

1. 實作 XTL 0.1 中你要目標的[符合性測試案例](./conformance/fixtures/)所需的部分。
2. 依 [`conformance/runner-protocol.md`](./conformance/runner-protocol.md) 跑你的實作通過 [`conformance/`](./conformance/)。
3. 送 PR 在上方表格加一列：語言、套件 URL、目標規範版本、符合性狀態（full／partial／N of M 測試案例）。

開發中的移植也歡迎 — 即使符合性還是部份，也可以把進行中的 repo 連結列上。

## 規範遵循等級

- **reference** — 此實作。對其宣告的規範版本而言，定義上即為符合。
- **full** — 通過所宣告規範版本的所有符合性測試案例。
- **partial (N/M)** — 通過 M 個測試案例中的 N 個。列出尚未支援的測試案例類別。
- **draft** — 早期 WIP，尚未跑符合性測試。
