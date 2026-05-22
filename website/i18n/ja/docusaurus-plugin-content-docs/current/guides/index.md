---
slug: /guides
sidebar_label: '概要'
pagination_label: '概要'
---

# XTL ガイド

よく使うレポートワークフロー向けの、コピー&ペーストで使える短いレシピ集です。各レシピはシナリオ、テンプレートセル、期待される結果で構成された短いマークダウンページです。

これらのガイドは既存の 2 つのドキュメントを補完します:

- **[`examples/`](https://github.com/jinyoung4478/xl3/tree/main/examples/)** には実行可能なテンプレートが 4 つあり、組み合わさった形を end-to-end で示しています。1 つコピーして出発点として使ってください。日本語の例は `04-cafe-weekly-report` を参考にしてください。
- **[`spec/language.md`](../spec/language.md)** は各関数とディレクティブの正式なリファレンスです(英語)。レシピでカバーできていないケースに遭遇したら参照してください。

ここにあるレシピは「プロダクション品質の現実性」より「X を示す最小のテンプレート」を優先しています ― 形は覚えているけれど構文がうろ覚えのときに素早く参照できることを目的としています。

## レシピ

| # | レシピ | 学べる内容 |
|---|---|---|
| 01 | [5 分ではじめる](./01-getting-started.md) | テンプレート + データ → 結果。置換と `__config__`。 |
| 02 | [条件付きセル](./02-conditional-cells.md) | `IF`、`IFEMPTY`、比較演算子、truthiness。 |
| 03 | [行の集計](./03-aggregates.md) | `SUM`、`COUNT`、`AVERAGE`、`MIN`、`MAX` ― ブロック単位とソース全体。 |
| 04 | [グループごとに 1 ファイル](./04-file-per-group.md) | `output_file_pattern` によるファイルグループ化。 |
| 05 | [グループごとに 1 シート](./05-sheet-per-group.md) | シートグループ化 + リストベースのフィルタ。 |
| 06 | [実行時入力値](./06-runtime-inputs.md) | 実行単位の値(月、地域など)のための `__inputs__`。 |
| 07 | [複数ソース + `@join`](./07-multi-source-join.md) | `__sources__`、`@source`、`@join`。 |
| 08 | [`XLOOKUP`](./08-xlookup.md) | クロスソース検索。 |
| 09 | [並べ替えと上位 N 件](./09-sort-and-top.md) | `@sort`(stable)、`@top`、複数キー並べ替え。 |
| 10 | [スタイルとブランディング](./10-styling-and-branding.md) | `tabColor`、セル結合、`numFmt`、`TEXT()`。 |
| 11 | [`TEXT()` 書式設定](./11-text-formatting.md) | 通貨、日付、パーセント。`numFmt` と `TEXT()` の使い分け。 |
| 12 | [空値を詳しく扱う](./12-empty-values.md) | `IFEMPTY`、空とゼロの落とし穴、`(blank)`、疎データの集計。 |
| 13 | [ホスト向けエラーハンドリング](./13-error-handling.md) | `XtlError` の捕捉、コードカタログ、fail-fast のための `preview()`。 |
| 14 | [値の辞書としての `__config__`](./14-config-values.md) | 作成者定義キー、型認識、`__config__` vs `__inputs__`。 |
| 15 | [ディレクティブの組み合わせ](./15-directive-composition.md) | 実行順序、複数 `@filter` の AND 結合、禁止される組み合わせ。 |
| 16 | [XTL 関数と Excel 数式](./16-xtl-vs-excel-formula.md) | `{{ ... }}` と `=...` セル数式の使い分け。ADR-0043 の render-time / open-time の境界。 |
| 17 | [テンプレート作成時の表示](./17-template-authoring-display.md) | テンプレート編集中に Excel で見える内容(エラー、プレースホルダ)、それが想定通りである理由、ダッシュボード用の `IFERROR` wrap 慣行。 |
| 18 | [`@group` と `@subtotal`](./18-group-and-subtotal.md) | 1 つのデータブロック内にグループごとの小計行を差し込む(ADR-0038) ― 単一レベル、ネスト、最外 @subtotal による総合計。 |

## レシピの読み方

各レシピは同じ構造です:

1. **シナリオ** ― 運用担当者の目的を 1 文で。
2. **`__config__`** ― 必要なキー。
3. **テンプレートセル** ― 目的を達成するための最小のセル集合。
4. **データ** ― 小さな入力テーブル。
5. **結果** ― `convert()` が返すもの。
6. **メモ** ― 注意点と、もっと知りたいときのスペックへのポインタ。

## 表記規則

- セルは `[row, col]` ではなく Excel の `A1` 表記を使います。
- `__config__` の値は簡潔さのために `key = value` の形式で書きますが、実際の `template.xlsx` 内では 2 つの列(`A: key`、`B: value`)に入ります。
- 元データはレシピを短く保つためにマークダウンテーブルで表示します。実際の `data.xlsx` では `source_sheet` と同じ名前のワークシートにそれらの行が入っています。

## レシピを試す

ガイドのレシピは文書中心です ― すべてのレシピに実行可能な `.xlsx` ペアが付属しているわけではありません。試すには:

1. Excel を開いて新しいワークブックを作成します。
2. レシピに記載されたキーで `__config__` シートを追加します。
3. `source_sheet` と同じ名前のデータシートを追加します。
4. レシピのセルでテンプレートシートを追加します。
5. `template.xlsx` として保存し、データは `data.xlsx` として保存します。
6. `convert(templateBuffer, dataBuffer)` を実行します([README](/readme#usage) 参照)。

または、より速く [実行可能な例](https://github.com/jinyoung4478/xl3/tree/main/examples/) のどれかをコピーして好みに合わせて変更してください。
