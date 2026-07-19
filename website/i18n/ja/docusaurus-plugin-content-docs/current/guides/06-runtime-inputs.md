---
sidebar_label: '06 · 実行時入力値'
pagination_label: '06 · 実行時入力値'
---

# 06 · ランタイム入力値

## シナリオ

テンプレートは汎用的に作っておきつつ、実行のたびに特定の月や地域を指定したいとします。運用担当者にテンプレート自体を編集させるのではなく、変換時に値を渡してもらう方式です。

## `__inputs__` に宣言

| name | type | required | default | label | options |
|---|---|---|---|---|---|
| `month` | `text` | `true` | | `対象月 (YYYY-MM)` | |
| `region` | `select` | `false` | `全体` | `地域 filter` | `全体\|東京\|大阪\|名古屋` |

タイプは `text`、`number`、`date`、`select` のいずれかです。

## テンプレートセル、ファイル名、グループキーで使用

```text
Cell:           {{ "レポート ― " & __inputs__[month] }}
Filename:       output_file_pattern = {{ __inputs__[month] }}-renewals.xlsx
Filter:         {{ @filter [地域] = __inputs__[region] OR __inputs__[region] = "全体" }}
```

最後の行は実はそのままでは動作しません ― XTL には `OR` キーワードがありません。正攻法はシートテンプレートを 2 つ用意して上位ロジックで分岐させることです。まず `__inputs__` の最も単純な使い方は、セル、ファイル名、または固定比較にリテラル値を差し込むことです。

```text
{{ @filter [地域] = __inputs__[region] }}

```

…そしてホスト側では、運用担当者が特定の地域を選んだときだけ `convert()` を呼ぶようにします。

## ホストから値を渡す

```ts
import { convert } from '@xl3-lang/xl3';

const outputs = await convert(templateBuffer, dataBuffer, {
  inputs: { month: '2026-05', region: '東京' },
});
```

`inputs.month` が欠落しているのに `month` が required になっていれば、xl3 は変換時点で `xl3/inputs/missing-required` を投げます。`region` を渡さなければ `default` 値の `全体` に置き換わります。

## 変換せずに入力値定義だけを読む

```ts
import { readTemplateInputs } from '@xl3-lang/xl3';

const inputs = await readTemplateInputs(templateBuffer);
// → [{ name: 'month', type: 'text', required: true, ... }, ...]
```

運用担当者がデータファイルをアップロードする前に、ホスト UI で入力フォームを事前にレンダリングするときに使います。

## 計算された default と label (ADR-0050)

`default`、`label`、`description`、`options` 列は入力値を読む時点で評価される XTL テンプレートです。`__config__` から値を取得したり純粋スカラー関数を呼び出して動的に構成できます:

| name | type | default | label |
|---|---|---|---|
| `title_prefix` | `text` | `{{ __config__[region] }} 取引明細書` | `タイトル接頭辞` |
| `report_date` | `text` | `{{ TEXT(TODAY(), "YYYY-MM-DD") }}` | `レポート日付` |
| `report_label` | `text` | `{{ UPPER(__config__[region]) }}-{{ __config__[period] }}` | `レポートラベル` |

`readTemplateInputs()` を呼ぶホスト UI は評価後の文字列(例:
`"東京 取引明細書"`、現在の UTC 日付)を見ます。ユーザーにはもう生の
`{{ ... }}` プレースホルダは表示されません。

**入力値評価時に利用可能なバインディング:**

- `__config__[key]` ― `__config__` シートで先に宣言された値。
- 純粋スカラー関数: `TODAY`、`DATE`、`IF`、`IFEMPTY`、`IFS`、`IFERROR`、
  `UPPER`、`LOWER`、`TRIM`、`TEXT`、`YEAR`、`MONTH`、`DAY`、`EOMONTH`、
  `EDATE`、`DATEDIF`、`ROUND`、`ABS`。

**利用不可 ― 入力値評価時にエラー:**

- `[Column]` / `Source[Column]` ― ソース行コンテキストがまだ無い。
  エラーコード: `xl3/inputs/forward-reference`。
- `__inputs__[name]` ― 入力行同士は独立した宣言であり依存グラフではない。同じ
  エラーコード。
- `ROW()`、`SUM`、`COUNT`、`AVERAGE`、`MIN`、`MAX`、`XLOOKUP` ― レンダー状態や
  まだロードされていないソースデータを読む。エラーコード:
  `xl3/inputs/runtime-only-fn`。

> **マイグレーションメモ。** 0.6 以前のバージョンでは `__inputs__` セルの
> `{{ ... }}` はリテラルテキストとして扱われていました。既存テンプレートが
> `{{ ... }}` の閉じたブロックをリテラル文字として意図して書いていた場合、
> これからはその文字列が式として評価されます。ほとんどの作成者には影響しません ―
> 以前の動作は実際には混乱を招くケースでした。

## メモ

- `select` のオプションは `__inputs__` 行内でパイプ(`|`)で区切ります(例: `東京|大阪|名古屋`)。オプションにない値が渡されると `xl3/inputs/select-option` が発生します。パイプ分割はセルテンプレート評価の**後**に動作するので、`options: {{ __config__[regions] }}` のような式も `__config__[regions]` が `東京|大阪|名古屋` というリテラル文字列であれば正常動作します。
- date 入力値は `YYYY-MM-DD` または `YYYY-MM-DDTHH:mm:ss` 形式でパースされます。
- number 入力値は JS 数値リテラルを受け付けます。末尾の空白は許容されます。
- スペック参照: [`spec/evaluation.md`](/spec/evaluation) の「Inputs」、ADR-0010、ADR-0011、ADR-0050。
