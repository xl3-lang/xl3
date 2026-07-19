---
slug: /implementations
---

# XTL 実装一覧

[XTL 仕様](./spec/) の実装一覧です。xl3 がリファレンス実装です。

| 言語 | リポジトリ | パッケージ | 仕様バージョン | 適合性 | 備考 |
|---|---|---|---|---|---|
| TypeScript | [`xl3-lang/xl3`](https://github.com/xl3-lang/xl3) | [`@xl3-lang/xl3`](https://www.npmjs.com/package/@xl3-lang/xl3) | XTL 0.1(ドラフト) | リファレンス。**139/139** フィクスチャが通過(Stage 1 が 133 件 + Stage 2 のみ 6 件) | ブラウザ + Node ≥ 20.12;ランナーは `npx xl3-conformance`;CI で 3 タイムゾーンのマトリクスを実行 |
| Python | [`jinyoung4478/xl3-py`](https://github.com/jinyoung4478/xl3-py) | _(未公開)_ | XTL 0.1(ドラフト) | **ドラフト**、開発中 | リファレンス実装と並走して追跡。[`conformance/reports/`](https://github.com/xl3-lang/xl3/tree/main/conformance/reports) 配下に `--report=json` のアーティファクトを置けば、`npm run conformance:dashboard` が拾います |

## 実装の追加

まず [`PORTERS_GUIDE.md`](https://xl3.io/porters-guide) を読んでください — 仕様上の規範的要件と TS 実装に固有の都合を区別し、適合性コーパスに沿った推奨開発順を提示しています。

ここに移植を掲載するには:

1. 対象とする [適合性フィクスチャ](https://github.com/xl3-lang/xl3/tree/main/conformance/fixtures) を通過できる程度に XTL 0.1 を実装する。
2. [`conformance/runner-protocol.md`](/conformance/runner-protocol) に従って [`conformance/`](./conformance/) に対して実装を動かす。
3. 上の表に言語、パッケージ URL、対象とする仕様バージョン、適合性ステータス(full / partial / N of M フィクスチャ)を加える PR を送る。

積極的に開発中の移植も歓迎します — 適合性が部分的でも、進行中のリポジトリをリンクしてください。

## 仕様適合レベル

- **reference** — 本実装。宣言された仕様バージョンに対して定義上適合。
- **full** — 宣言された仕様バージョンの適合性フィクスチャをすべて通過。
- **partial(N/M)** — M 件中 N 件を通過。未対応のフィクスチャカテゴリを併記する。
- **draft** — 初期 WIP、適合性はまだ走らせていない。
