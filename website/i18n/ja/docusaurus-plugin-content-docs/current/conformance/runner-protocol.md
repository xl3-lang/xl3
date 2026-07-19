# 適合性ランナープロトコル

適合性コーパスと、適合性を主張したい XTL 実装の間の契約を定義します。

## ランナーとは

**適合性ランナー** とは、以下を行う小さなプログラムです:

1. `conformance/fixtures/` 内のフィクスチャを反復する
2. 各フィクスチャの `template.xlsx` + `data.xlsx` に対して、テスト対象の実装を呼び出す
3. 実装の出力をフィクスチャの `expected.xlsx`（または `expected/` ディレクトリ）と比較する
4. フィクスチャごとに pass / fail / skip を標準フォーマットで報告する

実装ごとに独自のランナーを提供します（呼び出し方法は言語固有のため）が、すべてのランナーは比較可能な出力を生成します。

## フィクスチャの読み込み

ランナーは `conformance/fixtures/` のサブディレクトリを列挙してフィクスチャを発見します。各サブディレクトリは `<NNN>-<slug>/` という名前です（例: `001-basic-substitution`）。

各フィクスチャについて、ランナーは次を読み込みます:

- `template.xlsx` — 入力テンプレート
- `data.xlsx` — 入力ソースデータ
- `expected.xlsx`（単一出力の場合） **または** `.xlsx` ファイルの `expected/` ディレクトリ（複数ファイルグループの場合、出力ゼロの場合を含む）
- `meta.yaml` — フィクスチャのメタデータ

出力ファイルがゼロであることを期待する静的フィクスチャは、空の `expected/` ディレクトリを使用します。

エラーフィクスチャは `expected.xlsx` と `expected/` を省略します。`meta.yaml` で `expected_error` を宣言します。期待される結果は、実装が宣言されたテキストを含むエラーを報告することです。

動的フィクスチャは `expected.xlsx` と `expected/` を省略します。`meta.yaml` で `expected_dynamic` を宣言します。期待される結果は、ランナーがランナー開始タイムスタンプと宣言されたアサーションルールから計算します。動的フィクスチャは、`TODAY()` のように仕様上明示的に時間依存とされる挙動のために予約されています。

## 必須の `meta.yaml` フィールド

```yaml
description: string         # one-line human description
spec_section: string        # the spec section this fixture exercises
spec_version: string        # minimum XTL version (e.g., "0.1")
tags: [string, ...]         # filter tags (e.g., [substitution, repeat, aggregate])
```

`tags` はフィクスチャ側の利便性のためのフィールドで、`--filter=<tag>` CLI フラグ用です。タグの値は適合性契約の一部では **ありません** — ランナーはこれを不透明な文字列として扱わなければならず（**MUST**）、別のフィクスチャとタグ集合が異なるという理由でフィクスチャを拒否すべきではありません（**SHOULD NOT**）。リファレンスコーパスは小文字・ハイフン区切りのトークンを使用していますが、正規の分類体系を強制しているわけではありません。

オプションフィールド:

```yaml
verified_by: [hand | excel-formulas | manual-script | reference-impl]
expected_warnings: [string, ...]   # warnings the impl should emit
expected_error: string             # expected error message substring; no expected output is required
expected_error_code: string        # optional ADR-0015 stable error code (e.g. "xl3/source/undeclared")
expected_dynamic: string           # dynamic assertion kind; no expected output is required
comparison_stage: 1 | 2            # minimum comparison stage for static-output fixtures; default is 1
skip_reason: string                # if fixture is currently broken
inputs:                            # host-supplied runtime inputs (ADR-0010)
  - name: region
    value: Seoul
```

`inputs` ブロックは、ランナーが ADR-0010 の `__inputs__` シートに従って実装にランタイム入力として渡す名前/値ペアを列挙します。ランナーはこれらの値を実装の変換エントリポイントに転送しなければなりません（**MUST**）。`__inputs__` シートを持たないテンプレートはこのフィールドを無視します。

ステージゲーティングメタデータ:

- `comparison_stage` は静的出力フィクスチャにのみ適用されます。デフォルトは `1` です。`2` は、スタイル、マージ、パッケージパート、バイナリメディアなど、ステージ 1 で観察できないワークブック内容を主張する場合にのみ使用してください。
- `expected_error` フィクスチャと `expected_dynamic` フィクスチャは、合否判定にワークブック比較ステージを使用しません。ランナーは現在の実行ステージを依然として報告しますが、これらのフィクスチャは独自のエラーまたは動的アサーションのルールを保ちます。
- `expected_dynamic` は、現在定義されている `utc_today` アサーション種別について `dynamic_cells` を必要とします。静的出力フィクスチャとエラーフィクスチャは `dynamic_cells` を省略します。

ランナーは `expected_error` フィクスチャを次のようにマークしなければなりません（**MUST**）:

- 実装が `expected_error` を含むエラーを報告した場合 `pass`
- 実装が成功した場合 `fail`
- 実装が異なるエラーを報告した場合 `fail`

`expected_error` と `expected_dynamic` は相互排他です。

## 動的アサーション

動的アサーションは、古くなった `expected.xlsx` をコミットすることなく、描画時の挙動をテスト可能にします。ランナーは最初のフィクスチャを実行する前に単一のランナー開始タイムスタンプをキャプチャし、実行中のすべての動的フィクスチャに対してそのタイムスタンプを使用しなければなりません（**MUST**）。これにより、同じレポート内のフィクスチャ間で深夜境界の差異が発生するのを避けます。

XTL 0.1 は 1 つの動的アサーション種別を定義します:

```yaml
expected_dynamic: utc_today
dynamic_cells:
  - sheet: Report
    cell: A2
    format: YYYY-MM-DD
```

`utc_today` の場合、リストされた各セルの期待値は、ランナー開始タイムスタンプからの UTC 暦日を、リストされた XTL `TEXT()` 日付フォーマットで整形したものです。実装の出力は、リストされた各シート/セル座標に期待される文字列値を含まなければなりません（**MUST**）。

ランナーは `expected_dynamic` フィクスチャを次のようにマークしなければなりません（**MUST**）:

- 実装が成功し、リストされたすべての動的セルが一致した場合 `pass`
- 実装がエラーを報告した場合 `fail`
- リストされた動的セルのいずれかが計算された期待値と異なる場合 `fail`

宣言された `expected_dynamic` 種別を実装していないランナーは、フィクスチャを `skip` としてマークし、理由を含めなければなりません（**MUST**）。pass として報告してはいけません（**MUST NOT**）。

## 比較ステージ

適合性プロトコルには 2 つの比較ステージがあります:

- **ステージ 1: セル値比較。** ランナーは、スプレッドシートライブラリを通じて `.xlsx` ファイルを読み込んだ後、ワークシート名と補助でないセル値を比較します。このステージは意図的にスタイル、マージ、ページ設定、埋め込みメディア、キャッシュされた値以外の数式、パッケージ構造を無視します。正規 OOXML 比較が仕様化・実装される間、XTL 0.1 ブートストラップコーパスには十分です。
- **ステージ 2: 正規 OOXML 比較。** ランナーは、生成された `.xlsx` ファイルの OOXML パッケージを正規化したうえで比較します。これは完全な静的出力適合性のターゲットであり、ステージ 1 では見えないレイアウト、スタイル、マージ、シート構造、パッケージの退行を検出できます。

エラーフィクスチャと動的フィクスチャは、ワークブック出力比較ではありません。比較ステージにかかわらず、`expected_error` と `expected_dynamic` の合否ルールを保ちます。

レポートは各実行で使用した比較ステージを示すべきです（**SHOULD**）。実装はステージ 1 のみの実行からステージ 2 適合性を主張してはいけません（**MUST NOT**）。静的出力フィクスチャは `meta.yaml` で `comparison_stage` を宣言できます（**MAY**）。ランナーは、宣言された比較ステージがランナーの現在のステージより大きい場合、フィクスチャをスキップしなければなりません（**MUST**）。

## ステージ 2 出力比較 {#stage-2-output-comparison}

比較は **正規化された（canonicalized）** OOXML に対して実行されます。最小の正規化ルール:

1. zip 内のファイルは、zip メタデータ（タイムスタンプ、圧縮、エントリ順、圧縮レベル）ではなく内容で比較されなければなりません（**MUST**）。
2. パッケージパート名は正規化後に一致しなければなりません（**MUST**）。欠落または余分なワークブックパートは、後の ADR がそのパートを揮発性としてマークしない限り差異とみなされます。
3. XML ファイルは、決定的な名前空間宣言、属性順、引用スタイル、空要素表現でパースおよび再シリアライズした後で比較されなければなりません（**MUST**）。
4. XML 要素の順序は、後の ADR が特定の要素コレクションを順序なしと明示的にマークしない限り、保持されなければなりません（**MUST**）。リレーションシップファイルは、そのようなルールが存在するまでは順序付きパッケージデータであって集合ではありません。
5. 以下のフィールドは比較前に除去されます（コンテンツではなく生成元のメタデータを反映するため）:
   - `cp:lastModifiedBy`、`dc:creator`、`dcterms:created`、`dcterms:modified`
   - 任意の `<calcPr>` `calcId` 属性（Excel 計算エンジンのバージョン）
   - ワークブックのリレーションシップとシート名から解決可能な、生成されたシート ID とシートパートのファイル名
   - ExcelJS が追加または省略する可能性のあるデフォルトページ設定値（`copies="1"`、`firstPageNumber="1"`、`useFirstPageNumber="1"`）
6. テキストラン内の意味のない空白は保持されます（意味的に重要である可能性があるため）。
7. セルの `r`（参照）属性は厳密に一致しなければなりません（**MUST**）。`<row>` 内のセル順序も一致しなければなりません（**MUST**）。
8. 画像のようなバイナリパッケージパートは、バイト単位で完全一致しなければなりません（**MUST**）。

JS リファレンスランナーには、適合性比較のためのステージ 2 正規化器が含まれています。これは意図的にサポートされている XTL フィクスチャが生成する OOXML と上記の正規化ルールに範囲を限定しており、汎用の XML 正規化ライブラリではありません。特に、完全な XML C14N サポート、DTD/エンティティ処理、意味的な名前空間書き換え、ここに明示されている以外のアプリケーション固有の順序なしコレクションルールについては主張しません。追加の OOXML 等価性ルールが必要なフィクスチャは、まずこのプロトコルを更新してください。

### 既知の正規化のギャップ

これらのケースは現在の正規化器では正規化 **されません**。出現した場合は差異として扱われます。根拠については [ADR-0006](https://xl3.io/spec/decisions/stage-2-ooxml-conformance) の修正条項を参照してください。

- **デフォルト属性の等価性。** OOXML のデフォルトが指定しているブール属性について、省略 vs デフォルト値としての記述（例: `applyFont="0"`）は差異として扱われます。
- **カラー hex の大文字小文字。** `rgb="FF000000"` と `rgb="ff000000"` は異なる文字列として比較されます。
- **名前空間プレフィックスのバインディング。** 同じ名前空間 URI にバインドされた異なるプレフィックスは統一されません。

ライター横断フィクスチャがこれらのギャップの 1 つを **真に揮発性のある** 差異として（差異に扮した内容差異ではなく）露出した場合、プロトコルとリファレンス正規化器を併せて拡張すべきです。実装がこれらのルールをローカルでひそかに緩めてはいけません（**MUST NOT**）。

## ランナー CLI の規約

実装はこの最小インターフェースのランナーを公開すべきです:

```
<runner> [--fixture-dir=<path>] [--filter=<tag>] [--spec-version=<x.y>] [--comparison-stage=1|2] [--report=json|text]
```

ステージ 2 正規化器を提供する実装は、決定的なパート順序で正規パッケージ内容を出力するデバッグ用コマンドも公開すべきです（**SHOULD**）:

```
<runner> canonicalize <input.xlsx> [--part=<canonical-part-name>]
```

`--part` が省略された場合、コマンドは正規パッケージパート名をキーとする JSON オブジェクトを出力すべきです（**SHOULD**）。`--part` が指定された場合、そのパートの正規内容のみを出力すべきです（**SHOULD**）。

JSON レポートフォーマット:

```json
{
  "implementation": "xl3-js",
  "version": "0.1.0-alpha.0",
  "spec_version": "0.1",
  "comparison_stage": 1,
  "results": [
    {
      "fixture": "001-basic-substitution",
      "status": "pass",
      "duration_ms": 12
    },
    {
      "fixture": "007-aggregate-sum",
      "status": "fail",
      "duration_ms": 8,
      "diff": "cell B5: expected 1234, got 1234.0"
    }
  ],
  "summary": {
    "total": 42,
    "passed": 40,
    "failed": 1,
    "skipped": 1
  }
}
```

## 適合性の報告

実装は、公開された適合性実行へのリンクによって自身の適合性レベルを報告します。期待される形式:

```
xl3-py 0.2.0 — XTL 0.1 conformance: 38/42 (passes filter, repeat, aggregate; fails image-clone, _config-pattern-match, two date-edge cases)
```

リポジトリの [`IMPLEMENTATIONS.md`](/implementations) には、既知の実装とその適合性レベルがリストされています。
