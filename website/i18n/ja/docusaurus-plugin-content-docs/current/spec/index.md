# 仕様ナビゲーションインデックス

ポーター（移植担当者）とレビュアー向けのクロスリファレンス表です。各行は言語／評価モデルの各セクションを、それを定義する ADR と、それを検証する適合性フィクスチャに対応付けています。「X に関する規範的な記述はどこにあるか？」を grep を使わずに引きたいときに利用してください。

フィクスチャ列には最も若い番号のフィクスチャを掲載しています。ADR ↔ フィクスチャの完全な対応表は [`coverage.md`](/ja/conformance/coverage) を参照してください。

| 対象領域 | 仕様セクション | 関連 ADR | サンプルフィクスチャ |
|---|---|---|---|
| テンプレートブロック `{{ ... }}` | language.md "Template Blocks" | — | 001 |
| ソース列 `[Col]` | language.md "Source Columns" | — | 001, 002 |
| ソース接頭辞付きブラケット `Source[Col]` | language.md "Source Columns"; evaluation.md "External Data Sources" | ADR-0012 | 069, 070, 071 |
| リテラル（文字列 / 数値 / 真偽値） | language.md "Literals" | — | 011, 012 |
| 演算子 (`=`, `!=`, `>`, `<`, `>=`, `<=`, `+`, `-`, `*`, `/`, `&`) | language.md "Operators" | ADR-0009 | 058, 059, 061 |
| 比較アルゴリズム | language.md "Comparison Algorithm" | ADR-0009, ADR-0017 | 059–064, 087, 088 |
| 正規文字列形式 | language.md "Canonical String Form" | ADR-0009, ADR-0017 | 061–063, 087 |
| `IF()` | language.md "IF" | ADR-0008 | 055–058 |
| `IFEMPTY()` | language.md "IFEMPTY" | ADR-0007 | 050, 051 |
| `XLOOKUP()` | language.md "XLOOKUP" | ADR-0013 | 074–078 |
| 集計関数 (`SUM`/`COUNT`/`AVERAGE`/`MIN`/`MAX`) | language.md "Aggregates" | ADR-0007, ADR-0012 | 052, 070, 091 |
| `ROUND()` / `ABS()` | language.md "Numeric Functions" | — | 005, 016 |
| `TEXT()` | language.md "Text Formatting" | — | 011, 012, 016 |
| `ROW()` | language.md "Row and Date Functions" | — | 037 |
| `TODAY()` | language.md "Row and Date Functions" | ADR-0001 | 023 |
| `@filter` | language.md "Filter" | ADR-0007（メンバーシップ）, ADR-0009（比較） | 003, 035, 054 |
| `@sort` | language.md "Sort" | ADR-0009, ADR-0016 | 036, 083, 084 |
| `@top` | language.md "Top" | — | 036 |
| `@repeat right` | language.md "Repeat Right" | — | 004 |
| `@source` | language.md "Source"; evaluation.md "External Data Sources" | ADR-0012 | 071, 072 |
| `@join` | language.md "Join"; evaluation.md "External Data Sources" | ADR-0014 | 079–082 |
| グループキー | language.md "Group Keys" | ADR-0016 | 015, 085, 086 |
| 空値 | evaluation.md "Empty Values" | ADR-0007 | 050–054 |
| truthiness（真偽性） | evaluation.md (cross-ref) | ADR-0008 | 055–058 |
| 予約シート（dunder） | evaluation.md "Reserved Sheets" | ADR-0011 | 094 |
| `__config__` | evaluation.md "Template Configuration" | ADR-0011 | ほぼ全て |
| `__inputs__` | evaluation.md "Inputs" | ADR-0010, ADR-0011 | 065–068 |
| `__sources__` | evaluation.md "External Data Sources" | ADR-0011, ADR-0012 | 069–073 |
| `__lists__` | evaluation.md "List Sheets" | ADR-0007, ADR-0011 | 053, 054 |
| ソース値モデル | evaluation.md "Source Value Model" | ADR-0017 | 087–090 |
| ソースデータモデル（ゼロ行、ヘッダー読み込み） | evaluation.md "Source Data Model" | — | 028–031 |
| セルテキスト抽出 | evaluation.md "Cell Text Extraction" | — | 013, 014 |
| 単一式セル / numFmt による型変換 | evaluation.md "Single-Expression Cells" | ADR-0003 | 008–010 |
| 出力ファイル名 | evaluation.md "Output Filenames" | ADR-0002 | 006, 007, 019, 020 |
| エラー（カタログ） | evaluation.md "Errors" | ADR-0015 | 017–022, 067, 072–082, 091 |
| リソース制限 | evaluation.md "Resource Limits" | — | （実装定義；フィクスチャなし） |
| レンダリングフェーズ | evaluation.md "Render Phases" | — | 002 |
| 順序付け | evaluation.md "Ordering" | ADR-0016 | 083–086 |
| Stage 2 OOXML 正規化 | conformance/runner-protocol.md "Stage 2" | ADR-0006 | 024–027, 093 |
| 動的適合性アサーション | conformance/runner-protocol.md "Dynamic" | ADR-0005 | 023 |
| Excel バージョン互換性 | （情報提供） | ADR-0022 | （フィクスチャなし；オーサリングガイダンス） |
| 演算子による型強制 + Excel デフォルト原則 | language.md "Arithmetic" | ADR-0023 | 100, 101 |
| 関数のアリティ（規範的な表） | language.md "Functions" arity table | ADR-0024 | 102, 103 |
| ゼロ除算 → `#DIV/0!` エラーセル | language.md "Arithmetic" | ADR-0025 | 106 |
| 複数の `@filter` は AND で合成 | language.md "Filter" | （ADR なし；仕様行） | 104 |
| `{{ }}` 内の空白は意味を持たない | language.md "Template Blocks" | （ADR なし；仕様行） | 105 |
| 空値のライフサイクル（セル + グループキー） | evaluation.md "Source Data Model" + "Output Filenames" | ADR-0026 | 107, 108 |
| 予約列名 + ディレクティブの検証 | evaluation.md "Source Data Model" + "Directives" | ADR-0027 | 109, 110, 111 |
| リテラル構文の制約（文字列 + 数値） | language.md "Literals" | ADR-0028 | 112, 113 |
| ディレクティブ合成 + ソースエッジセマンティクス | evaluation.md "External Data Sources" + "Source Data Model" | ADR-0029 | 114, 115, 116, 117 |
| Unicode 正規化（適用しない） | language.md "Comparison Algorithm" | ADR-0030 | 118 |
| 出力ファイル名の衝突はエラー | evaluation.md "Output Filenames" | ADR-0031 | 119 |
| 細部の上限とワークブックのパススルー | evaluation.md "Source Data Model" + "Cell Evaluation" | ADR-0032 | 120 |

## 実装定義の境界

XTL 0.1 では以下の領域を意図的に実装に委ねています。2 つのポート間でこれらの選択が異なっていても、どちらも非適合（non-conformant）にはなりません。完全なカタログは [ADR-0021](/ja/spec/decisions/implementation-defined-boundaries) を参照してください。

| 領域 | XTL 0.1 のスタンス |
|---|---|
| メモリ／ストリーミングモデル | 実装定義 |
| 同期 vs. 非同期 API の形状 | 実装定義 |
| ソース中のネイティブ Excel 数式 | 必須：キャッシュ済みの結果を読む。欠落していればエラー |
| テンプレート中のネイティブ Excel 数式 | 実装定義（典型的にはパススルー） |
| コア表外の `TEXT()` 書式 | 実装定義の拡張 |
| 行展開時の結合セル保存 | 必須（データブロックの上下）；データブロック内部は実装定義 |
| `__config__` 作成者定義キー | 必須：`{{ __config__[key] }}` 経由でアクセス可能 |
| 空ソース（行数ゼロ） | 実装定義の出力、エラーにはしない |
| サニタイズ後のシート名衝突 | 実装定義 |
| 空のテンプレートブロック `{{   }}` | エラー |
| 入力中の非テンプレート・非予約シート | 実装定義（典型的にはパススルー） |

## 延期された対象領域

以下は 1.0 には含まれません。延期 ADR がその理由と、将来の仕様で当該領域を追加するために規範的に取り組まなければならない（**MUST**）事項を説明しています。

| 対象領域 | 状態 | 延期 ADR |
|---|---|---|
| 日付演算（`EOMONTH`, `EDATE`, `DATEDIF`, …） | 延期 | ADR-0019 |
| ロケール対応の照合（collation） | 延期 | ADR-0020 |
| 複数 `@join`、left-join、複数行マッチ | 延期 | ADR-0014（out-of-scope セクション） |
| XLOOKUP のワイルドカード / 近似 / 逆方向検索 | 延期 | ADR-0013（out-of-scope セクション） |
| クロスライター Stage 2 のギャップ（デフォルト属性、色 hex の大小文字、namespace prefix） | 延期 | ADR-0006 amendment |
