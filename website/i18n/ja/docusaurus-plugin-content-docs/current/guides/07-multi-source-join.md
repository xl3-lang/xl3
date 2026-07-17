---
sidebar_label: '07 · 複数ソースと @join'
pagination_label: '07 · 複数ソースと @join'
---

# 07 · 複数ソース + `@join`

## シナリオ

更新データには `customer_id` しかなく、顧客の正式な名称は別の `顧客` テーブルにあります。更新行に顧客の `Name` と `ランク` をジョインして付加したい状況です。

## `__sources__` にソースを宣言

| name | sheet | table | description |
|---|---|---|---|
| `更新一覧` | `更新一覧` | `1` | 更新単位の行 |
| `顧客` | `顧客` | `1` | 顧客 1 行 |

`__config__` の `source_sheet` は依然として暗黙のデフォルトソースの役割を果たします。このデフォルトソースは接頭辞なしで `[Column]` として参照し、名前付きソースは `SourceName[Column]` 形式で書きます。

## `@source` でブロックのアクティブソースを切り替える

```text
{{ @source 更新一覧 }}
{{ [customer_id] }}   ← bare bracket resolves against 更新一覧
{{ [amount] }}
```

データブロックはデフォルトで `source_sheet` に設定されたソースを反復します。`@source <Name>` を使うと、そのブロックに限り反復対象を `<Name>` に切り替えます。

## `@join` で主ソースと別ソースの行をペアリング

```text
{{ @source 更新一覧 }}
{{ @join 顧客 on 更新一覧[customer_id] = 顧客[id] }}
{{ [customer_id] }}             ← 更新一覧 row
{{ 顧客[name] }}            ← joined customer row
{{ 顧客[ランク] }}
{{ [amount] }}
```

`@join` は **inner join、first match** です。

- 更新一覧の各行に対して、`id = customer_id` の顧客行のうち**最初の 1 つ**を探します。
- マッチがない場合、その更新一覧行は結果から除外されます。
- 複数行がマッチしても最初のマッチ 1 つだけ使います。

`on` 句は両ソース名を明示する必要があります。ADR-0029 に従って自己ジョイン(`@join S on S[a] = S[b]`、`S` がアクティブソースの場合)は `xl3/join/bad-on-clause` が発生します。

## ジョインなしで他ソースの値だけを引き込む: `XLOOKUP`

すべての更新一覧行を顧客行とペアリングする必要がないなら、`XLOOKUP` の方が軽量です。

```text
{{ XLOOKUP([customer_id], 顧客[id], 顧客[name]) }}
```

[Recipe 08](/guides/xlookup) を参照してください。

## クロスソース集計

名前付きソースに対する集計は、ジョインやフィルタが適用されたブロックではなく**ソース全体**を対象とします。

```text
{{ COUNT(顧客[id]) }}      ← total customers, ignores filters
{{ SUM(更新一覧[金額]) }}      ← total renewals, ignores filters
```

[Recipe 03](/guides/aggregates) を参照してください。

## メモ

- データブロックあたり `@source` と `@join` はそれぞれ 1 つだけ許容されます。重複は ADR-0029 に従って `xl3/directive/invalid-syntax` を発生させます。
- マルチジョイン(`@join` のチェーン)は ADR-0014 に従って一旦保留されています。
- 関数名のマッチは大文字小文字を区別しません ― `if`、`If`、`IF` はすべて同じです。
- スペック参照: [`spec/evaluation.md`](/ja/spec/evaluation) の「External Data Sources」、ADR-0012、ADR-0014。
