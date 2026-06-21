# XTL 適合性スイート

このディレクトリには **適合性コーパス** を収めています。XTL の実装が適合性を主張するために通過しなければならないテストフィクスチャ群です。このコーパスは XTL の挙動を実行可能な形で定義したものです。

## ディレクトリ構成

```
conformance/
├── README.md            ← このファイル
├── AUTHORING.md         ← フィクスチャの追加方法（JS を真実とみなす罠を避ける）
├── runner-protocol.md   ← 実装がスイートを実行する方法
└── fixtures/
    └── <NNN>-<slug>/
        ├── template.xlsx
        ├── data.xlsx
        ├── expected.xlsx        ← 正規の期待出力（単一ファイルの場合）
        ├── expected/            ← もしくは複数ファイル（または出力ゼロ）の場合のディレクトリ
        │   └── *.xlsx
        ├── no expected output   ← expected_error フィクスチャ向け
        ├── no static expected   ← expected_dynamic フィクスチャ向け
        └── meta.yaml            ← 説明、仕様セクション参照、タグ
```

## 「合格」の意味

静的出力フィクスチャは、`template.xlsx` と `data.xlsx` が与えられたときに実装が生成する出力が `expected.xlsx`（または `expected/` の内容）と一致すれば合格です。ステージ 1 のランナーは、より高レベルのワークシート/セル値での比較を行うことができます。ステージ 2 のランナーは OOXML zip の **正規化（canonical normalization）** を行ったうえで、バイト等価なワークブック内容を比較します。

- zip 内のファイルを名前順にソート
- XML を決定的な正規形でシリアライズ
- テキストラン内の空白は保持
- 生成元メタデータを除去（creator、modifiedBy、lastModified）

比較ステージと正規化ルールについては [`runner-protocol.md`](/ja/conformance/runner-protocol) を参照してください。

エラーフィクスチャは、実装がフィクスチャの `expected_error` テキストを含むエラーを報告した場合に合格となります。エラーフィクスチャは `expected.xlsx` や `expected/` ディレクトリを持ちません。

動的フィクスチャは、実装の出力が `meta.yaml` の `expected_dynamic` で宣言された動的アサーションと一致した場合に合格となります。動的フィクスチャも `expected.xlsx` や `expected/` ディレクトリを持ちません。

## バージョニング

各フィクスチャディレクトリには `meta.yaml` があり、必要とする最小仕様バージョン（`spec_version: 0.1`）を宣言します。実装は自身がターゲットとする仕様バージョンを報告し、スイートはそれに応じてフィクスチャをフィルタリングします。

静的出力フィクスチャは `comparison_stage` も宣言できます。このフィールドはデフォルトで `1` であり、正規 OOXML 比較を必要とするフィクスチャは `comparison_stage: 2` を宣言します。

## フィクスチャメタデータ

コーパスで使用される `meta.yaml` のフィールド:

| フィールド | 必須 | 適用対象 | 意味 |
|---|---:|---|---|
| `description` | はい | すべてのフィクスチャ | フィクスチャが主張する 1 行の契約。 |
| `spec_section` | はい | すべてのフィクスチャ | 当該挙動を定義する仕様または ADR のセクション。 |
| `spec_version` | はい | すべてのフィクスチャ | フィクスチャが要求する最小 XTL バージョン。 |
| `tags` | はい | すべてのフィクスチャ | レポートおよび絞り込み実行のためのフィルタ可能なカテゴリ。 |
| `verified_by` | いいえ | すべてのフィクスチャ | 独立した作成時チェック（例: `hand` や `manual-script`）。 |
| `expected_warnings` | いいえ | すべてのフィクスチャ | 実装が発するべき安定した警告部分文字列。 |
| `expected_error` | いいえ | エラーフィクスチャ | 安定したエラー部分文字列。静的な期待出力は省略する。 |
| `expected_dynamic` | いいえ | 動的フィクスチャ | 動的アサーションの種類。現在は `utc_today`。 |
| `dynamic_cells` | `expected_dynamic` と併用 | 動的フィクスチャ | ランナーが計算するシート/セル/フォーマットのアサーション。 |
| `comparison_stage` | いいえ | 静的出力フィクスチャ | 最小比較ステージ。デフォルトは `1`、OOXML に敏感なチェックには `2` を使用する。 |
| `skip_reason` | いいえ | すべてのフィクスチャ | 既知の壊れたフィクスチャをスキップする一時的な理由。 |

`expected_error` と `expected_dynamic` は相互排他です。静的出力フィクスチャは `expected.xlsx` または `expected/` を使用します。空の `expected/` ディレクトリは出力ファイルがゼロであることを意味します。エラーフィクスチャと動的フィクスチャは静的な期待出力を省略します。

## フィクスチャカタログ

XTL 0.1 のブートストラップコーパスには現在以下のフィクスチャが含まれています:

| ID | フィクスチャ | 契約 |
|---|---|---|
| 001 | `bracket-substitution` | 単一の角括弧付きソース列式は、ソース行ごとに 1 つの出力行として描画される。 |
| 002 | `if-function` | `IF(condition, then, else)` は現在のデータ行内で比較を評価する。 |
| 003 | `list-sheet-filter` | `@filter [field] in _ListSheet` は一致する行を残し、リストシートを出力から削除する。 |
| 004 | `repeat-right-default` | 明示的なカウントを伴わない `@repeat right` は `colSpan = 1` をデフォルトとする。 |
| 005 | `round-half-away-from-zero` | `ROUND()` は Excel スタイルの「ゼロから離れる丸め」を使用する。 |
| 006 | `filename-forbidden-chars` | 禁止されたファイル名文字は `_` に置換される。 |
| 007 | `filename-reserved-name` | Windows 予約デバイス名のベース名には末尾に 1 つの `_` を付ける。 |
| 008 | `numfmt-numeric-string-coercion` | 数値テンプレートフォーマットは数値文字列を数値に強制変換する。 |
| 009 | `numfmt-date-string-coercion` | 日付テンプレートフォーマットは日付らしい文字列を日付値に強制変換する。 |
| 010 | `numfmt-text-format-coercion` | テキストフォーマット `@` は単一式の値を文字列に強制変換する。 |
| 011 | `text-date-format` | `TEXT(date, "YYYY-MM-DD")` は XTL の日付トークンを使った文字列を返す。 |
| 012 | `text-number-format` | `TEXT(number, format)` は XTL 0.1 の最小数値フォーマットサブセットをサポートする。 |
| 013 | `rich-text-template-expression` | リッチテキストのテンプレートセルは、式検出の前にテキストランを連結して解析される。 |
| 014 | `source-formula-cached-result` | ソース数式セルはキャッシュされた結果を使用し、XTL では再計算されない。 |
| 015 | `source-sheet-prefix-first-match` | `source_sheet` のプレフィックスパターンは、ワークブック順で最初に一致するワークシートを選択する。 |
| 016 | `text-number-negative-rounding` | 数値 `TEXT()` フォーマットは負の `.5` 境界をゼロから離れる方向に丸める。 |
| 017 | `source-sheet-prefix-no-match-error` | `source_sheet` プレフィックスが一致しない場合は安定したエラーを報告する。 |
| 018 | `source-formula-missing-cached-result-error` | キャッシュされた結果のないソース数式セルは安定したエラーを報告する。 |
| 019 | `filename-empty-basename-error` | ファイル名のサニタイズはベース名が空の場合にエラーを報告する。 |
| 020 | `filename-length-overflow-error` | ファイル名のサニタイズは 255 バイト制限を超えた場合にエラーを報告する。 |
| 021 | `numfmt-number-coercion-error` | 数値テンプレートフォーマットは強制変換に失敗した場合にエラーを報告する。 |
| 022 | `numfmt-date-coercion-error` | 日付テンプレートフォーマットは強制変換に失敗した場合にエラーを報告する。 |
| 023 | `today-utc-dynamic` | `TODAY()` は動的アサーションを介してランナー開始時刻の UTC 日付を描画する。 |
| 024 | `stage2-merge-preservation` | ステージ 2 比較は、展開されたデータブロックの下にあるマージ範囲が保持されていることを検証する。 |
| 025 | `stage2-style-numfmt-preservation` | ステージ 2 比較は、描画されたセルがテンプレートのスタイルと numFmt を保持していることを検証する。 |
| 026 | `stage2-splice-merge-style-preservation` | ステージ 2 比較は、行の展開がシフトされたマージとスタイル付き/数値書式付きの描画セルの両方を保持することを検証する。 |
| 027 | `stage2-cross-writer-canonicalization` | ステージ 2 比較は、既知の OOXML ライター差異が同一のワークブック内容に正規化されることを検証する。 |
| 028 | `source-table-row-shorthand` | `source_table = N` は行 `N` をソース列名として選択し、その下の行を読み込む。 |
| 029 | `source-table-open-range` | `source_table = B3:D` は列ウィンドウを選択し、使用済み行末まで下の行を読み込む。 |
| 030 | `source-table-finite-range` | `source_table = B3:D4` は宣言された終了行で読み込みを停止する。 |
| 031 | `source-table-zero-data-range` | `source_table = B3:D3` は有効であり、ソース行ゼロを生成する。 |
| 032 | `source-table-empty-column-name-error` | 選択されたスパン内に空のソース列名がある場合は安定したエラーを報告する。 |
| 033 | `source-table-duplicate-column-name-error` | 重複したソース列名は安定したエラーを報告する。 |
| 034 | `source-table-invalid-selector-error` | 行ゼロのような無効なセレクタは安定したエラーを報告する。 |
| 035 | `source-table-rich-text-header` | リッチテキストのソース列名セルは source_table 解析前に連結される。 |
| 036 | `source-table-formula-header` | 数式によるソース列名セルはキャッシュされた結果を使用する。 |
| 037 | `source-table-formula-header-missing-cache-error` | キャッシュされた結果のない数式ソース列名セルは安定したエラーを報告する。 |
| 038 | `source-sheet-exact-match-beats-prefix` | `source_sheet` の完全一致はプレフィックスパターンより優先される。 |
| 039 | `source-sheet-default-first-worksheet` | `source_sheet` が省略された場合、ワークブック順で最初のワークシートが使用される。 |
| 040 | `list-sheet-hidden-states-removed` | 非表示および非常に非表示のリストシートも出力ワークブックから削除される。 |
| 041 | `row-function-inside-repeat-block` | `ROW()` はリピートブロック内の現在の描画データ行の 1 始まりインデックスを返す。 |
| 042 | `row-function-outside-repeat-block-error` | リピートブロック外で `ROW()` を呼ぶと安定したエラーを報告する。 |
| 043 | `ifempty-function` | `IFEMPTY()` は空値の場合にフォールバックを返し、非空値はそのまま通過させる。 |
| 044 | `sort-and-top-order` | `@sort` は `@top` より先に実行され、上位 N 行はソート済み集合から選ばれる。 |
| 045 | `list-sheet-not-in-filter` | `@filter ... !in _Sheet` はリストシートに値がない行を残し、リストシートを出力から削除する。 |
| 046 | `count-field-non-empty` | `COUNT([field])` は現在の行集合の非空値をカウントする。 |
| 047 | `aggregate-functions` | 中核の集計関数は現在描画中の行集合に対して動作する。 |
| 048 | `if-and-comparison-boundaries` | 比較演算子はゼロ境界周辺で `IF()` および `@filter` の挙動を決定する。 |
| 049 | `filename-sanitization-warning` | 描画されたファイル名のサニタイズは、出力セマンティクスを変更せずに警告を発する。 |
| 050 | `empty-ifempty-whitespace-only` | IFEMPTY は ADR-0007 に従い、空白文字のみの文字列を空として扱う。 |
| 051 | `empty-ifempty-zero-not-empty` | IFEMPTY は数値 0 を保持する。数値は ADR-0007 に従い決して空ではない。 |
| 052 | `empty-count-field-whitespace-zero-false` | COUNT([field]) は ADR-0007 に従って非空値をカウントする — 空白は空、0 と FALSE は非空。 |
| 053 | `empty-row-skip-whitespace-only` | すべてのセルが ADR-0007 に従って空であるソース行はスキップされる（空白文字のみのセルを含む）。 |
| 054 | `empty-list-membership` | リストシートは読み込み時に空エントリを除外する。空のソース行値は ADR-0007 に従い `@filter ... in _Sheet` には決して一致しない。 |
| 055 | `if-truthy-zero-and-empty` | IF は ADR-0008 に従い 0 と空値を falsy として扱う。ゼロでない数値、非空文字列、TRUE は truthy。 |
| 056 | `if-truthy-string-zero-not-special` | `IF("0", …)` と `IF("false", …)` は truthy 分岐を取る — 文字列型フラグ値に特例はない。 |
| 057 | `if-truthy-boolean` | Boolean のソースセルは ADR-0008 に従い、IF の truthy 判定を直接駆動する。 |
| 058 | `if-comparison-result` | 比較式の Boolean 結果は ADR-0008 に従い、IF の truthy 判定に直接供給される。 |
| 059 | `compare-numeric-string-vs-number` | 比較は ADR-0009 に従い、共有の `compareValues` の下で数値と数値文字列を解析する。 |
| 060 | `compare-string-codepoint-order` | 文字列のフォールバック比較は ADR-0009 に従い Unicode コードポイント順を使用する — ロケール依存の照合は行わない。 |
| 061 | `concat-canonical-form` | `&` は ADR-0009 に従い、被演算子を正規文字列形式に文字列化する（boolean は大文字、整数は小数点なし）。 |
| 062 | `concat-empty-stringifies-to-empty` | `&` における空の被演算子は ADR-0009 に従い空文字列を寄与する。 |
| 063 | `compare-empty-vs-value` | 2 つの空の被演算子は等価。片方だけが空のとき `=` は ADR-0009 のルール 1 と 2 に従い false となる。 |
| 064 | `compare-unicode-minus-not-numeric` | Unicode マイナス（U+2212）を含む文字列は数値として解析されない。比較は ADR-0009 に従い正規文字列フォールバックに落ちる。 |
| 065 | `input-text-default-applied` | `__inputs__` のテキスト入力デフォルトは、ホストが値を省略した場合に補完される（ADR-0010）。 |
| 066 | `input-text-host-supplied` | ホスト提供の入力はセル、シート名、出力ファイル名パターンを通って流れる（ADR-0010）。 |
| 067 | `input-missing-required-error` | デフォルトなしの必須 `__inputs__` 宣言をホストが省略した場合はエラー（ADR-0010）。 |
| 068 | `input-select-host-supplied` | `select` 入力は、宣言された `|` 区切りのオプションに含まれるホスト値を受け入れる（ADR-0010）。 |
| 069 | `source-multi-declaration` | `__sources__` シートが追加の名前付きソースを宣言する。集計はその全行集合に対して動作する（ADR-0012）。 |
| 070 | `source-aggregate-cross-source` | 名前付きソースに対する COUNT/MIN/MAX は ADR-0012 に従い、その全行集合に対して動作する。 |
| 071 | `source-directive-active` | `@source SourceName` はデータブロックのスコープを指定し、その内側では `[Column]` がそのソースに解決される（ADR-0012）。 |
| 072 | `source-undeclared-error` | `__sources__` で宣言されていないソースを参照する `@source` は ADR-0012 に従いパース時エラー。 |
| 073 | `source-row-cross-error` | 非アクティブなソースの列に対する行レベル参照は ADR-0012 に従いエラー。 |
| 074 | `xlookup-basic` | 3 引数 XLOOKUP は ADR-0013 に従い、lookup-array が一致する最初の行の return-array 列を返す。 |
| 075 | `xlookup-fallback` | 4 引数 XLOOKUP は ADR-0013 に従い、一致がない場合はフォールバックを返す。 |
| 076 | `xlookup-no-match-error` | 3 引数 XLOOKUP はフォールバックなしで一致がない場合 ADR-0013 に従いエラー。 |
| 077 | `xlookup-source-mismatch-error` | XLOOKUP の引数 2 と引数 3 は ADR-0013 に従い同じソースを参照しなければならない。 |
| 078 | `xlookup-bare-bracket-error` | XLOOKUP の引数 2 / 引数 3 は ADR-0013 に従いソースプレフィックス付きの角括弧参照を必要とする。 |
| 079 | `join-basic-inner` | `@join` は ADR-0014 に従い、各プライマリ行を最初に一致する結合行とペアにする。 |
| 080 | `join-no-match-dropped` | `@join` は ADR-0014 に従い inner セマンティクスを使用する — 一致のないプライマリ行は破棄される。 |
| 081 | `join-undeclared-source-error` | `__sources__` で宣言されていないソースを参照する `@join` は ADR-0014 に従いパース時エラー。 |
| 082 | `join-bad-on-clause-error` | `@join` の on 句は ADR-0014 に従い、結合先ソースとブロックのプライマリソースを参照しなければならない。 |
| 083 | `sort-stable-equal-keys` | `@sort` は安定 — キーが等しい行は ADR-0016 に従いソース順序を保持する。 |
| 084 | `sort-multi-stable-priority` | 複数の `@sort` ディレクティブは最初を主キー、後続をタイブレーカーとして適用される（ADR-0016）。 |
| 085 | `file-group-first-seen-order` | ファイルグループは ADR-0016 に従い、ソース行に対して最初に出現した順で出力される。 |
| 086 | `sheet-group-first-seen-order` | ファイル内のシートグループは ADR-0016 に従い最初に出現した順で出力される。 |
| 087 | `date-canonical-string-concat` | `&` 内の Date は ADR-0017 に従い YYYY-MM-DD（深夜）または YYYY-MM-DDTHH:mm:ss を生成する。 |
| 088 | `date-comparison-equality` | Date 値は ADR-0017 に従い、文字列フィルタ値と正規文字列形式を介して比較される。 |
| 089 | `error-sentinel-empty` | Excel のエラーセル（`#N/A`、`#VALUE!` など）は ADR-0017 に従い空として読み取られる。 |
| 090 | `percentage-numeric-flow` | パーセンテージ書式のセルは ADR-0017 に従い、その基となる Number として流れる（50% → 0.5）。 |

## ステータス

XTL 0.1 のコーパスは **ブートストラップ状態** にあります。フィクスチャは [`spec/README.md`](/ja/spec) で既に述べられている挙動についてのみ追加すべきです。CommonMark のような標準化プロジェクトと同じパターンに従います: 散文がルールを定義し、フィクスチャがルールを実行可能にし、実装はどのフィクスチャをパスするかを報告します。

リファレンス実装はそれ自身の挙動を規範的なものとはしません。フィクスチャと実装が食い違う場合は、[`spec/README.md`](/ja/spec) の仕様優先順位に従って実装またはフィクスチャを更新してください。

XTL 0.1 の中核挙動に関するフィクスチャは、[`spec/language.md`](/ja/spec/language) の最小テーブル外の `TEXT()` フォーマットのような、実装定義拡張を避けます。
