---
sidebar_label: '17 · テンプレート作成時の表示'
pagination_label: '17 · テンプレート作成時の表示'
---

# 17 · テンプレート作成時の表示動作

## よくある状況

`template.xlsx` を Excel で開いて編集中です。次のようなものが見えます:

- `=VLOOKUP("アクメ", Data!A:B, 2, FALSE)` セルが `#N/A` として表示される。
- `=Data!B2 + 100` セルが `#VALUE!` として表示される。
- 通貨書式 `¥#,##0` に設定されたセルに `{{ [金額] }}` が普通のテキストとして見える。
- プレースホルダセルをクリックするとデータ入力規則の警告が出る。

**このうちどれもバグではありません。** xl3 がテンプレートをレンダーするとすべて消えます:

- Data シートのプレースホルダが実際の値に置き換わります。
- VLOOKUP が A 列で「アクメ」を見つけます。
- セルが今は数値になっているので `+100` が動作します。
- 通貨書式が置き換わった数値に適用されます。
- 入力規則は実際の値に適用されます。

このレシピは*なぜ*テンプレートビューがそう見えるのか、そしてノイズが多すぎると感じたときにどう整理できるかを説明します。(ADR-0049 がこの動作の normative
contract です。)

## なぜプレースホルダがリテラルテキストとして表示されるのか

テンプレートセル値が `{{ [金額] }}` で書式が `#,##0.00` の場合、Excel は数値セルに非数値文字列が入っている状況を見ます。Excel の動作:

- テキストをそのまま表示(自動書式適用なし)。
- 「テキストとして保存された数値」緑の三角形を表示しない(ヒューリスティックが数値らしく見える内容を要求するが `{{ ... }}` は明らかに数値ではない)。
- エラーとして処理しない(不正な数式ではなくただの文字列だから)。

編集ビューでは `{{ [金額] }}` が見え、xl3 がレンダーした後は同じセルに `1,234.56`(値 × 書式の組み合わせによる結果)が見えます。

**これは意図された動作です。** プレースホルダが目に見えることがテンプレートを*self-documenting* にしてくれます ― 実行しなくてもどのセルが動的でどのセルが固定なのか一目でわかります。レビュアーがファイルを開くだけで contract を読み取れます。

## なぜダッシュボード数式がエラーを見せるのか(整理する方法)

ダッシュボードシートには次のような数式がよく入ります:

```excel
=VLOOKUP("アクメ", Data!A:B, 2, FALSE)
=Data!B2 + 100
=AVERAGE(Data!B:B)
=SUMPRODUCT((Data!A:A="VIP") * Data!B:B)
```

テンプレートを開いたとき(レンダー前)これらの数式は Data シートのプレースホルダ行を参照します。ルックアップはマッチを見つけられず(文字列はリテラルキーと一致しない)、文字列算術は `#VALUE!` を返します。結果としてダッシュボードは作成中に赤いセルだらけになります。

### 解決: `IFERROR` で包む

Excel ネイティブな正解です。数式ごとに 1 行、覚えるのは数秒。

```excel
=IFERROR(VLOOKUP("アクメ", Data!A:B, 2, FALSE), "—")
=IFERROR(Data!B2 + 100, 0)
=IFERROR(AVERAGE(Data!B:B), 0)
=IFERROR(SUMPRODUCT((Data!A:A="VIP") * Data!B:B), 0)
```

レンダー前のテンプレートビュー: きれい(`—`、`0`)。
レンダー後の出力: 実際の値(xl3 は数式テキストを触りません ―
[ADR-0046](https://xl3.io/spec/decisions/cell-formula-preservation) 参照、Excel が
開くときに再計算し wrapper は自然に消えます)。

### どの数式を包む必要があるか

| 数式 | テンプレートビューエラー? | 包む? |
|---|---|---|
| `=SUM(Data!B:B)` | いいえ ― SUM は範囲内のテキストを無視し 0 を返す | 任意 |
| `=SUMIF(Data!A:A, "VIP", Data!B:B)` | いいえ ― マッチなしで 0 | 任意 |
| `=COUNTIF(Data!A:A, "VIP")` | いいえ ― 0 を返す | 任意 |
| `=AVERAGE(Data!B:B)` | **はい** ― 数値がないと `#DIV/0!` | はい |
| `=VLOOKUP("key", Data!..., ...)` | **はい** ― マッチなしで `#N/A` | はい |
| `=INDEX(...,MATCH("key",Data!A:A,0))` | **はい** ― `#N/A` | はい |
| `=Data!B2 + N`(セル単位算術) | **はい** ― `#VALUE!` | はい |
| `=Data!B2 & " text"`(テキスト連結) | いいえ ― プレースホルダとの文字列連結は問題なし | いいえ |
| `=COUNTA(Data!A:A)` | いいえ ― 空でないセルを数えるのでプレースホルダもカウントされる | いいえ |

**経験則:** プレースホルダ行に対して `#N/A`、`#VALUE!`、`#DIV/0!` を返す数式だけ包んでください。集計型関数(`SUM`、`COUNT*`、`SUMIF*`)はテキストに耐えるので包む必要がありません。

## レンダーされた出力を検証する

テンプレートビューからレンダー結果を推測する必要はありません。素早い 3 つの経路:

### 1. xl3.io プレイグラウンド

`template.xlsx` + サンプル `data.xlsx`(またはバンドルされたサンプル)を
[xl3.io](https://xl3.io) にドロップすると、レンダーされたワークブックが数秒で出てきます。

### 2. ホストの `preview()` API

TypeScript ホストに xl3 を埋め込んでいるなら:

```ts
import { preview } from '@xl3-lang/xl3';

const result = await preview(templateBuffer, dataBuffer);
console.log(result.sources);   // 検出されたソース行
console.log(result.files);     // 出力ファイルとシート
console.log(result.warnings);  // 非致命的な問題
```

`preview()` は `convert()` と同じパース + 初期評価段階を走らせますが、ワークブックのバイトは作りません ― 全体レンダーを走らせる前にホスト側で検証するのに便利です。

### 3. 素早い CLI スモークテスト

```bash
# 新鮮なサンプルが欲しければ example ワークブックをビルド
npm run examples:build

# 1 つレンダーして確認
node -e "
import('@xl3-lang/xl3').then(async ({ convert }) => {
  const fs = await import('node:fs/promises');
  const tpl = await fs.readFile('./template.xlsx');
  const data = await fs.readFile('./data.xlsx');
  const outs = await convert(tpl.buffer, data.buffer);
  for (const o of outs) await fs.writeFile('rendered-' + o.filename, o.data);
})
"
```

`rendered-*.xlsx` を開いて実際の出力を確認してください。

## 作成中のデータ入力規則の警告

「0 ~ 100 の数値」のような入力規則を列に掛けておき、作成中にプレースホルダセルをクリックすると、Excel が入力規則の警告を出します(「この値が規則に合いません」)。

選択肢:

- **入力規則スタイルを `警告` または `情報` に**変更(`停止` の代わり) ―
  警告は出ますが編集を妨げません。
- **プレースホルダではないセルに入力規則を掛けてデータ行に伝播させる。** xl3 の
  保存ルール(ADR-0036 §8)が展開された行に規則を持っていきます。
- **クリック時の警告を受け入れる** ― xl3 が実際の値に置き換えた瞬間、警告は
  消え、レンダーされたファイルを見る運用担当者はこの警告を絶対に見ません。

## xl3 が意図的に*しない*こと

[ADR-0049](https://xl3.io/spec/decisions/template-display-vs-render-output) の
contract:

1. xl3 はテンプレートビュー用にプレースホルダをサンプル値で事前置換**しません**。
   (視覚的プレースホルダのシグナルを失うため。)
2. xl3 はセルごとに別々の `numFmt` を 2 つ(「テンプレートビュー書式」vs「レンダー書式」)
   維持**しません**。(追加のスペック面積、利得が小さい。)
3. xl3 はダッシュボード数式を自動的に `IFERROR` で包**みません**。(ADR-0046
   が禁止する形で数式テキストを変更することになり、実際の作成者ミスを黙って飲み込む
   危険がある。)

作成者はテンプレートビューを担当し、エンジンはレンダー出力を担当します。両者は設計上
別物です。

## 参照

- [ADR-0049 — Template-display vs render-output: intentional asymmetry](https://xl3.io/spec/decisions/template-display-vs-render-output)
- [ADR-0046 — Cell formula preservation contract](https://xl3.io/spec/decisions/cell-formula-preservation)
- [Cookbook 16 — XTL 関数 vs Excel 数式](/guides/xtl-vs-excel-formula)
- [`preview()` API ドキュメント](https://xl3.io/api/functions/preview)
