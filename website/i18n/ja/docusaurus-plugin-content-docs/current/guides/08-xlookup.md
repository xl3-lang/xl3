---
sidebar_label: '08 · XLOOKUP 検索'
pagination_label: '08 · XLOOKUP 検索'
---

# 08 · `XLOOKUP`

## シナリオ

別のソースからキーで照合して 1 列だけを引き込みたいときに使います。一発の `VLOOKUP` / `INDEX(MATCH(...))` または SQL の `LEFT JOIN ... LIMIT 1` に近い動作です。

## 基本形

```text
{{ XLOOKUP(lookup_value, lookup_array, return_array) }}
{{ XLOOKUP(lookup_value, lookup_array, return_array, fallback) }}
```

- `lookup_value` ― 探す値。
- `lookup_array` ― 別ソースで検索する列。
- `return_array` ― 別ソースから返す列。
- `fallback`(オプション) ― マッチする行がないとき返す値。

マッチする最初の行の `return_array` 値を返します。比較ルールは XTL の標準比較アルゴリズムに従います(数値と数値文字列は数値で、通常文字列はコードポイント単位で)。ADR-0013 に従ってワイルドカード、近似マッチング、逆方向検索はサポートしません。

## 例

`__sources__`:

| name | sheet | table |
|---|---|---|
| `顧客` | `顧客` | `1` |

テンプレートセル:

```text
A2: {{ [customer_id] }}
B2: {{ XLOOKUP([customer_id], 顧客[id], 顧客[name]) }}
C2: {{ XLOOKUP([customer_id], 顧客[id], 顧客[ランク]) }}
```

デフォルトソースの各行ごとに、xl3 が `id` でマッチする顧客行を探し `name` / `tier` を引き出します。

## マッチ失敗時の動作

`lookup_value` が `lookup_array` に無く、fallback も渡されていないとき、xl3 は `xl3/xlookup/no-match` を投げます。スペックはデータが黙って欠落するより、騒がしく失敗する方を優先します。

エラーを避けたければ第 4 引数として fallback 値を渡してください。

```text
{{ XLOOKUP([customer_id], 顧客[id], 顧客[name], "(unknown)") }}
```

マッチする行が無いときは fallback 値が返されます。プレースホルダ無しに欠落を許容したい場合は、上流で事前にフィルタリングするか、マッチのない行を完全に落とす `@join` を使ってください。

## ソース不一致の保護

`lookup_array` と `return_array` は **同じソース**の列でなければなりません。`XLOOKUP([id], 顧客[id], 更新一覧[name])` は `xl3/xlookup/source-mismatch` が発生します ― 別ソースを混ぜると、マッチした行と意味的に何の関係もない位置の値を返すことになるためです。

## パフォーマンス

xl3 はある `(ソース, 列)` ペアに対して XLOOKUP が最初に実行されるときインデックスを作っておくので、同じ列に対する以降のルックアップは O(1) です。変換実行の最初のルックアップが O(N) コストを払い、同じデータブロック内の次のルックアップは定数時間で終わります。

## メモ

- 比較は型を認識します ― 数値と数値文字列は境界を越えてマッチするので、`XLOOKUP("42", 顧客[id], ...)` は `id` が数値 `42` の行を見つけます。
- 主ソースの全行を他ソースの行とペアリングする必要があるなら `@join` を、他ソースから 1 セルだけ引き込めばよいなら `XLOOKUP` を使ってください。
- スペック参照: [`spec/language.md`](/ja/spec/language) の「XLOOKUP」、ADR-0013。
