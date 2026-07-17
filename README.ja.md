# xl3

> **AI 生成 Excel レポートのための決定論的ランタイム。**
> LLM がテンプレートを書き、xl3 がワークブックをレンダリングする —
> 同じテンプレート、同じデータなら、いつでも同じバイトを返します。

**ステータス:** alpha · XTL spec 0.1 (draft) · 1.0 までは breaking change の可能性あり

xl3 は、**テンプレート** (ワークフロー契約) と **元データ** という 2 つの
`.xlsx` ファイルを、完成した整形済みワークブックへと変換する小さな
TypeScript エンジンです。テンプレートはそれ自体が `.xlsx` であり、
Excel 上で慣れ親しんだ数式を使って作成します。加えて、ワークブックを
書き出す *前* に確定している必要があるもの — フィルタ、グループ、集計、
ファイル名パターンなど — のために、埋め込みの小さな式言語 (XTL) を
利用します。

LLM (Claude、GPT、Gemini、Cursor、Codex、…) がテンプレートを生成・編集・
レビューするユースケースに特に向いています。**実行**層が決定論的で、
検査可能で、検証可能であってほしい — 「AI が出力セルを当てずっぽうで埋める」
のではなく、というケースです。

[English](./README.md) · [한국어](./README.ko.md) · **日本語** · [简体中文](./README.zh-CN.md) · [Website](https://xl3.io) · [Spec](./spec) · [LLM authoring guide](./docs/llm-template-authoring.md) · [Implementations](./IMPLEMENTATIONS.md) · [Roadmap](./ROADMAP.md) · [Governance](./GOVERNANCE.md)

---

## 役割分担: モデルが書き、ランタイムがレンダリングする

```text
  ┌──────────────────────────┐         ┌──────────────────────────┐
  │   LLM (Claude / GPT /    │         │         xl3              │
  │   Gemini / Cursor / …)   │         │  (決定論的ランタイム)    │
  │                          │         │                          │
  │   自然言語               │         │   template.xlsx          │
  │   + サンプル帳票    ───► │ 生成    │   + raw.xlsx             │
  │                          │         │   → result.xlsx          │
  │   「地域別の月次精算、   │         │                          │
  │    地域ごとの小計        │         │   同じ入力なら           │
  │    付きで」              │         │   常に同じバイト         │
  └──────────────────────────┘         └──────────────────────────┘
       創造的・確率的                       退屈で再現可能
```

LLM は、プロンプトとサンプルから帳票の形を *ドラフトする* のは得意です。
一方で、同じ `.xlsx` を二度生み出すこと、セルスタイルを保つこと、
「この列は必ず SUM で集計する」といった約束を守ることは苦手です。xl3 は
その間を埋めます — モデルはテンプレートの `.xlsx` を一度だけ書き出し、
以降のレンダリングはすべて `(template, data, inputs)` の純粋関数です。

この役割分担こそが、[`docs/llm-template-authoring.md`](./docs/llm-template-authoring.md)、
154 件の conformance fixture コーパス、そして意図的に小さく保たれた
XTL の表面が想定している対象です。

## 簡単な例

テンプレートには通常の Excel コンテンツ、`__config__`、xl3 の式を同居させられます。

| `__config__` キー | 値 |
|---|---|
| `source_sheet` | `元データ` |
| `source_table` | `1` |
| `output_file_pattern` | `取引先-更新レポート.xlsx` |

| セル | テンプレート値 |
|---|---|
| A5 | `{{ [取引先] }}` |
| B5 | `{{ [地域] }}` |
| C5 | `{{ [更新金額] }}` |
| E5 | `{{ IF([更新金額] > 10000, "優先", "標準") }}` |

データワークブックが次のような内容だとすると:

| 取引先 | 地域 | 更新金額 | 担当者 |
|---|---|---:|---|
| アクメ商事 | 東京 | 18400 | 美咲 |
| ベータワークス | 大阪 | 7200 | 健太 |

xl3 は次のように出力します。

| 取引先 | 地域 | 更新金額 | 担当者 | ランク |
|---|---|---:|---|---|
| アクメ商事 | 東京 | 18400 | 美咲 | 優先 |
| ベータワークス | 大阪 | 7200 | 健太 | 標準 |

…テンプレートの数値書式、塗りつぶし、罫線、結合ヘッダ、フッタ行などは
そのまま保たれます。出力は Excel、Numbers、Google Sheets で変換なしに
そのまま開ける `.xlsx` です。

言語仕様のドラフトは [`spec/`](./spec) に、実装に依存しない fixture
コーパスとランナープロトコルは [`conformance/`](./conformance) にあります。

## なぜランタイムは退屈であるべきなのか

一文で言えば — **LLM が Excel として生成するものは、たった一つのトークンずれで
壊れた帳票になりかねません。** セル数式がずれる、結合が一行ずれる、通貨記号が
数値書式ではなく文字列の `$` になってしまう。xl3 の仕事は、その
テンプレートの *実行* を予測可能にし、モデルは *一度* 正しければ済むように
することです。

具体的には:

- **小さく監査可能な XTL の表面 (ADR-0043)。** XTL に関数が存在するのは、
  その値がワークブック書き出し *前* に確定している必要がある場合に
  限ります。それ以外はすべて普通の Excel セル数式とし、Excel が開いた
  時点で評価します。言語が小さければ、LLM が学ぶべき表面も小さく、
  検証すべき表面も小さくなります。並べて見たい場合は
  [Cookbook 16](./docs/guides/16-xtl-vs-excel-formula.md) を参照して
  ください。
- **Conformance コーパス。** 154 件の fixture、すべて green、70 件の
  ADR を網羅。LLM が生成したテンプレートを、ユーザーデータに触れる
  *前に* 突き合わせて検証できるテストベッドです。
- **実装は 1 つ、仕様は 1 つ。** [`spec/`](./spec) ディレクトリは XTL を
  この TypeScript リファレンス実装から独立に定義しています。他ランタイム
  への移植は歓迎します。契約はコーパスです。
- **マクロなし、ベンダークラウドなし。** テンプレートは普通の `.xlsx`
  です。差分を取り、pull request でレビューし、xl3 のことを知らない
  人間レビュアーにも渡せます。

同じ性質は、**LLM がループに入っていなくても** xl3 を有用にします — 運用者や
アナリストはテンプレートを直接読み書きできます。式は彼らが日常的に使っている
`IF`、`SUM`、列参照と同じ語彙で書かれているからです。AI という切り口は
くさび、人間にとっての読みやすさはロングテールです。

## 他のアプローチとの比較

| アプローチ | 得意な領域 | AI 主導の Excel に対するトレードオフ |
|---|---|---|
| **xl3** | LLM が著者となる Excel パイプラインのうち、実行を担う半分。モデルがテンプレートを一度書き、xl3 が毎回決定論的にレンダリングする。 | Alpha 段階。メンテナー 1 名。XTL の表面は意図的に小さく、1.0 までは進化中。 |
| LLM から直接 xlsx を生成 (スプレッドシート SDK への function-call) | 探索的なドラフト作成、一回限りの図表。 | 各レンダリングが非決定論的。temperature 0 でも、スタイル、数値書式、合計が実行ごとにずれる。 |
| SheetJS / ExcelJS / openpyxl | 低レベルなワークブック生成。 | モデルが SDK 表面全体を学び、毎回それを書き出さなければならない。「テンプレート」はアプリケーションコードであり、可搬なファイルではない。 |
| Power Query / Office Scripts / Power Automate | Microsoft 365 ワークフロー、データ整形、Excel エコシステム内でのアクション自動化。 | テナント拘束で、ワークフロールールはワークブックと一緒に旅をしない。 |
| JXLS / xltpl / jsreport xlsx recipe | スプレッドシート風テンプレートからのサーバーサイドレポート生成。 | 有用だが、LLM をテンプレート著者とするモデルより前の世代。テンプレート DSL は大きく、モデルが書き出す前提では設計されていない。 |
| ドキュメント生成 SaaS (Plumsail、Conga、Formstack) | マネージド文書ワークフロー、外部連携、承認、配信。 | ルールがベンダーサービス側に残り、LLM に渡して編集させられる可搬なワークブックではない。 |

## インストール

```bash
npm install @jinyoung4478/xl3
```

## 使い方

```ts
import { convert } from '@jinyoung4478/xl3';

const templateBuffer = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
const dataBuffer = await fetch('./data.xlsx').then((r) => r.arrayBuffer());

const outputs = await convert(templateBuffer, dataBuffer);
// outputs: OutputFile[] — テンプレートのグルーピングルールに応じて 1 つ以上の .xlsx
```

ブラウザと Node (20.12 以上) で動作します。

### バンドラなしの `<script>` での利用

バンドラを使わないプロジェクト向けに、自己完結型の IIFE バンドルを提供しています。読み込むと `window.xl3` として利用できます。

```html
<script src="https://cdn.jsdelivr.net/npm/@jinyoung4478/xl3@0.8.0/dist/xl3.bundle.iife.min.js"></script>
<script>
  const tpl = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
  const data = await fetch('./data.xlsx').then((r) => r.arrayBuffer());
  const outputs = await xl3.convert(tpl, data);
</script>
```

バンドルサイズは約 1 MB (minified、gzip で約 300 KB) です。ExcelJS と JSZip がインライン化されているため、他に依存はありません。

ブラウザでのフローは [xl3.io](https://xl3.io) でそのまま試せます。添付のサンプルファイルをそのまま実行することも、元データ/テンプレートのワークブックをダウンロードして調べることも、どちらかを自分のファイルに差し替えて動かすこともできます。

### Excel バージョン互換性

xl3 は `.xlsx` ファイルを OOXML 経由で読み取り、設計上はおおむねバージョン非依存です — キャッシュ済みの数式結果を読み、日付を UTC で正規化し、セル値層では OOXML のシリアライズ差異を無視します。完全なマトリックスは [ADR-0022](./spec/decisions/0022-excel-version-compatibility.md) を参照してください。要点を言えば、動的なものはすべて XTL の `{{ ... }}` 文法に寄せ、データブロック内ではグラフ/ピボット/ネイティブ数式を避け、組織として日付システム (1900) を 1 つに統一する、ということです。

テンプレートは、非表示の `__config__` シートでソーステーブルを指定します。

| キー | 例 | 意味 |
|---|---|---|
| `source_sheet` | `元データ` | ソースワークシート名、または `*` で終わる接頭辞パターン |
| `source_table` | `1` | 1 行目を列名として読み、その下を行データとして扱う |
| `source_table` | `A1:D` | A1-D1 を列名として読み、その下を行データとして扱う |
| `source_table` | `A1:D200` | A1-D1 を列名として読み、A2-D200 領域を行データとして扱う |

ソースの N 行目に列名が並ぶ一般的なケースでは `source_table = N` の一行で済みます。テーブルが途中の列から始まる、または終了行を制限したい場合にだけ範囲形式を使います。

### 予約シート

テンプレートは、両端をダブルアンダースコアで囲まれた 4 つの予約シートを使います (ADR-0011 に準拠)。

| シート | 用途 |
|---|---|
| `__config__` | テンプレート作成者が定義する設定と値辞書。`{{ __config__[name] }}` で参照 |
| `__inputs__` | 実行時にホストが渡す値 (ADR-0010)。`name`/`type`/`default`/`label`/`description`/`options` 列で宣言 |
| `__sources__` | デフォルトの `source_sheet` 以外で使う名前付きデータソース (ADR-0012)。`name`/`sheet`/`table`/`description` 列で宣言 |
| `__lists__` | `@filter [field] in __lists__[name]` などで使うメンバーシップリスト |

作成者が `^__[a-z]+__$` パターンに一致するシート名を付けると、パース時点で拒否されます。

### マルチソースデータ

デフォルトの `source_sheet` 以外にも、テンプレートは `__sources__` で名前付きソースを宣言し、Excel の構造化参照形式で参照できます。

```text
{{ Customers[Account] }}
{{ SUM(Renewals[Amount]) }}
{{ XLOOKUP([Account], Customers[Account], Customers[Name]) }}
```

`@source <Name>` はデータブロックのデフォルトソースを `<Name>` に切り替え、ブラケット短縮形 (`[Column]`) も `<Name>` を基準に解決されるようにします。`@join` は 2 つ目のソースの行を、キーをもとに主たる行とペアリングします (inner-join、最初のマッチを採用)。完全なディレクティブ文法は [`spec/language.md`](./spec/language.md) を参照してください。

### ランタイム入力

実行ごとの値 (対象月、取引先フィルタ、ラベルなど) が必要なテンプレートは、それらを `__inputs__` で宣言し、ホスト側が `convert(...)` に渡します。

```ts
await convert(templateBuffer, dataBuffer, {
  inputs: { month: '2026-05', region: '東京' },
});
```

入力値はセル (`{{ __inputs__[month] }}`)、ファイル名パターン、グループキーへ流れ込みます。

## サンプル

実運用に近い形のテンプレートが 4 つ [`examples/`](./examples) にあります: 基本的な更新レポート、地域ごとのシート分割 + リストフィルタ、ランタイム入力付きのマルチソース join、そして `@group` + `@subtotal` のカテゴリ別小計を示すカフェ週次レポート。`npm run examples:build && npm run examples:run` で実行できます。

## ガイド

よくあるワークフロー向けの短いコピー & ペースト用レシピは [`docs/guides/`](./docs/guides) にあります。レシピは 18 本あり、入門、条件分岐、集計、ファイル/シート単位のグルーピング、ランタイム入力、join、`XLOOKUP`、ソート/トップ N、スタイリング、複数行テキスト、空値、エラーハンドリング、`__config__` 値、ディレクティブ組み合わせ、XTL と Excel 数式の使い分け、テンプレート作成時の表示、`@group` / `@subtotal` までを網羅しています。

## Spec

XTL の仕様は言語中立で、[`spec/`](./spec) にあります。このリポジトリは TypeScript リファレンス実装を提供します。他言語への移植も歓迎します — 詳細は [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md) を参照してください。

Conformance コーパスはローカルで実行できます。

```bash
npm run conformance
node dist/bin/conformance.js --fixture-dir=conformance/fixtures --comparison-stage=2
```

最新のリファレンス実装の実行サマリと、[`conformance/reports/`](./conformance/reports/) に置かれた外部ポートのレポート列は、[`conformance/DASHBOARD.md`](./conformance/DASHBOARD.md) にまとまっています。`npm run conformance:dashboard` で再生成できます。

## プロジェクト構造

- `spec/` — 規範的な XTL 言語ドラフト。
- `conformance/` — 実装に依存しない fixture コーパスとランナープロトコル。
- `src/` — TypeScript リファレンス実装。

仕様 (spec) が真の出典です。Conformance fixture は仕様の挙動を実行可能な形で固定します。リファレンス実装は有用ですが、それ自体は規範ではありません。

## ライセンス

- コード (`src/`、`conformance/`): [MIT](./LICENSE)
- XTL 仕様 (`spec/`): [CC-BY-4.0](./spec/LICENSE)

---

Microsoft および Excel は Microsoft Corporation の商標です。xl3 は Microsoft とは関係ありません。Office Open XML 形式 (`.xlsx`) は ISO/IEC 29500 として公開されています。
