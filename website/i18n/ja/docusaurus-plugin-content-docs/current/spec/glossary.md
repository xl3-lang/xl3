# 用語集

XTL の仕様ドキュメント、ADR、適合性フィクスチャ全体で使われる用語です。定義が他ドキュメントのセクションを参照する場合、そのセクションが規範的であり、このページは要約資料です。

## A

### Active source
裸のブラケットによるフィールド参照（`[Column]`）がデータブロック内で解決対象とする名前付きソース。`@source` によって設定されるか、それがない場合は `__config__` の `source_sheet` で宣言されたデフォルトソースが用いられます。（ADR-0012、evaluation.md "External Data Sources" を参照。）

### Aggregate function
列参照を引数に取り、多数の行に対して 1 つのスカラー結果を返す関数：`SUM`、`AVERAGE`、`AVG`、`MIN`、`MAX`、`COUNT`。ソース接頭辞付き集計（`SUM(Source[col])`）はそのソースの全行集合に対して動作し、裸の集計（`SUM([col])`）はアクティブブロックのフィルタ済み行に対して動作します。（ADR-0012、language.md "Aggregates" を参照。）

## B

### Block
*data block* を参照。

### Bracket field
`[Column]` という形の列参照。データブロック内で、アクティブソースの現在行に対して解決されます。データブロックの外では構文エラーとなります。（language.md "Source Columns" を参照。）

## C

### Canonical string form
`&` 連結、リストメンバーシップ、比較アルゴリズムの文字列フォールバックで使われる、決定論的な値の文字列表現。Empty → `""`；Boolean → `TRUE`/`FALSE`（大文字）；有限 Number → ECMAScript の最短ラウンドトリップ可能形式；String → そのまま；Date → `YYYY-MM-DD` または `YYYY-MM-DDTHH:mm:ss`（UTC）。（ADR-0009、ADR-0017、language.md "Canonical String Form" を参照。）

### Conformance corpus
`conformance/fixtures/` 配下のフィクスチャディレクトリの集合。各ディレクトリには `template.xlsx`、`data.xlsx`、必要に応じて `expected.xlsx`、`meta.yaml` が含まれます。このコーパスは実行可能な契約であり、仕様の文章とパスするフィクスチャが食い違った場合は文章の側が負けます。（conformance/runner-protocol.md を参照。）

## D

### Data block
テンプレートシート内で、レンダリング時にマッチするソース行ごとに 1 度ずつ展開される連続した行範囲。レンダラーは裸の `[Column]` 参照を含むセルを見つけることで検出します。範囲は `@source`、`@filter`、`@sort`、`@top`、`@repeat right`、`@join` ディレクティブによって変更可能です。（evaluation.md "Render Phases" を参照。）

### Default source
`__config__.source_sheet` で参照されるワークブックから暗黙にロードされるソース。`@source` ディレクティブを持たないデータブロック内では、それがアクティブソースとなります。内部名は `default`。作成者は通常 `@source default` を明示的に書くことはありません。

### Directive
内容が `@` で始まるテンプレートブロック。ディレクティブは周囲のデータブロックを修飾します。XTL 0.1 のディレクティブ一式：`@filter`、`@sort`、`@top`、`@repeat right`、`@source`、`@join`。（language.md "Directives" を参照。）

### Dunder (sheet)
名前が `^__[a-z]+__$` のパターンにマッチする予約シート ― すなわち二重アンダースコアで囲まれたもの。宣言済みの 4 つの dunder シートは `__config__`、`__inputs__`、`__sources__`、`__lists__` です。このパターンにマッチする作成者作成のシートはパース時に拒否されます。（ADR-0011 を参照。）

## E

### Empty value
欠落している値（`null`/`undefined`）、空文字列、または Unicode 空白だけで構成された文字列。Numbers（`0` を含む）、Booleans（`false` を含む）、Dates は、値によらず空（empty）にはなりません。（ADR-0007、evaluation.md "Empty Values" を参照。）

### Excel error sentinel
値が `#N/A`、`#VALUE!`、`#DIV/0!` などのいずれかであるセル。ADR-0017 に従って empty として読まれます。実装は遭遇時に警告を出してもかまいません（**MAY**）。

### Expression
`{{ ... }}` テンプレートブロックの中身。リテラル、関数呼び出し、ブラケット参照、予約シート参照、またはそれらを演算子で結合した任意の組み合わせとなり得ます。（形式文法は spec/grammar.ebnf を参照。）

## F

### File group
`__config__.output_file_pattern` のグループキーで宣言された列によってソース行をグループ化したもの。各グループが 1 つの出力 `.xlsx` ファイルになります。ソースの自然な行順で最初に現れた順序で出力されます（ADR-0016 に従う）。

### Filter
データブロックから述語に基づいて行をドロップするディレクティブ。2 つの形式があります：`@filter [field] op value`、および `@filter [field] in __lists__[name]`（または `!in`）。

## G

### Group key
そのカラムの distinct な値が、ソース行をファイルグループに分割する（カラムが `output_file_pattern` に現れる場合）、またはシートグループに分割する（カラムがシート名テンプレートに現れる場合）カラム。

## I

### Informational ADR
ステータスが `informational` の ADR ― 実装の挙動を縛らない、ドキュメント・監査・プロセス資料です。（例として ADR-0004、ステータス分類については 0000-template.md を参照。）

### Input
`__inputs__` で宣言され、`convert(...)` の `inputs` オプションを介してホストから供給される実行時の値。宣言された `type`（text、number、date、select）に従って型強制されます。（ADR-0010 を参照。）

## J

### Join
`@join` ディレクティブで、アクティブソースの各行を、キーで第 2 のソースの最初にマッチする行とペアリングします。XTL 0.1 は inner-join セマンティクスと決定論的な first-match 順序付けをサポートします。（ADR-0014 を参照。）

## L

### List sheet
`__lists__` 内のカラムで、その値の集合が `@filter ... in __lists__[name]` のメンバーシップ集合になります。（ADR-0011、evaluation.md "List Sheets" を参照。）

## N

### Named source
`__sources__` で明示的な名前と共に宣言されたソース。ソース接頭辞付きブラケットが有効な任意の場所から `Name[Column]` として参照されます。デフォルトソースはこの意味での「named」ではありません。

## P

### Primary source
`@join` ブロック内のアクティブソース。その行が反復を駆動します。join されたソースは、`JoinedSource[Column]` 参照を通じてペアリングされたカラムを提供します。

## R

### Reserved sheet
`__config__`、`__inputs__`、`__sources__`、`__lists__` のいずれか。その名前と挙動は ADR-0011 で定義されています。dunder パターンにマッチする作成者作成のシートは、宣言済みの 4 つの名前のどれかと一致するかにかかわらず予約扱い（かつ拒否）となります。予約シートは出力ワークブックには現れません。

### Reserved-sheet reference
`__sheet__[key]` という形のテンプレート式で、予約シートのキー-値テーブルから `key` を引きます。`__config__`、`__inputs__`、`__lists__` に対して有効です。`__sources__[name]` の形式はエラー（`xl3/sources/not-a-dictionary`）です。なぜなら `__sources__` は宣言シートであって値の辞書ではないからです。

## S

### Sheet group
シートテンプレートの名前に含まれるキーによってソース行をグループ化したもの。各グループはそのファイル内の 1 つの出力ワークシートになります。最初に現れた順で出力されます（ADR-0016 に従う）。

### Single-expression cell
テンプレート内容が厳密に 1 つの `{{ expression }}` であり、それ以外を含まないセル。そうしたセルは、セルの数値書式（number format）が互換性を持つ場合に、ソース値の型を保持します（Date は Date のまま、Number は Number のまま）。（ADR-0003、evaluation.md "Single-Expression Cells" を参照。）

### Source
エンジンが行データを得るために読み込むワークシート（またはワークシート + テーブル範囲）。デフォルトソースは `__config__.source_sheet` から取得され、名前付きソースは `__sources__` で宣言されます。（ADR-0012 を参照。）

### Source-prefixed bracket
`Source[Column]` という形の参照で、ここで `Source` は宣言されたソース名です。`@source` ブロックの内側ではソースの現在行のカラムに解決され、静的コンテキストではそのソースの全行集合に対する集計や `XLOOKUP` に供給されます。（ADR-0012 を参照。）

## T

### Template block
Excel セルの値内で XTL の式またはディレクティブを区切る `{{ ... }}` 構文。（language.md "Template Blocks" を参照。）

### Truthy / falsy
値は、empty（ADR-0007 に従う）、Boolean の `false`、数値 `0` のいずれでもなければ truthy です。文字列 `"0"` と `"false"` は空でない文字列なので truthy です。（ADR-0008 を参照。）

## X

### XLOOKUP
ソース内でルックアップ列がある値と等しい最初の行を見つけ、その行のあるカラムを返す関数。基本的な 3 引数形式とオプションのフォールバックについては Excel のシグネチャを踏襲します。ワイルドカード、近似、逆方向検索モードは XTL 0.1 のスコープ外です。（ADR-0013、language.md "XLOOKUP" を参照。）

### XTL
Excel Template Language。`spec/` で定義される言語です。実装に中立であり、xl3 は TypeScript のリファレンス実装です。
