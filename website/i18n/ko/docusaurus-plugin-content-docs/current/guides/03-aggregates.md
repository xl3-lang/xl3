# 03 · 행에 대한 집계

## 시나리오

데이터 블록 아래에 합계 푸터 행을 붙이거나, 회사 전체 합계처럼 원본 전체를 가로지르는 집계 값을 헤더 셀에 끌어옵니다.

## 대괄호 집계 — 데이터 블록을 대상으로

```text
{{ SUM([Renewal]) }}
{{ COUNT([Renewal]) }}
{{ AVERAGE([Renewal]) }}
{{ MIN([Renewal]) }}
{{ MAX([Renewal]) }}
```

**데이터 블록** 안에서 쓰면 반복되는 원본 행 위에서 누적됩니다. **푸터 행**(데이터 블록 아래쪽 행, 같은 데이터 블록 행에는 템플릿 블록이 없는 경우)에서 쓰면 방금 펼쳐진 블록의 결과를 가리킵니다.

```text
| A1: Account     | B1: Renewal             |
| A2: {{ [Acct] }}| B2: {{ [Renewal] }}     | ← 데이터 블록
| A3: Total       | B3: {{ SUM([Renewal]) }}| ← 푸터
```

원본 행 3개로 펼치면 3행이 5행으로 밀려나고, `B5` 에는 세 `Renewal` 값의 합이 들어갑니다.

## 원본 한정 집계 — 원본 전체를 대상으로

```text
{{ SUM(Renewals[Amount]) }}        # 활성 블록이 아니라 원본 전체
{{ COUNT(Customers[Account]) }}
```

`SUM(SourceName[Column])` 으로 쓰면 xl3 는 이름으로 지정한 **원본 전체**를 합칩니다 — 필터나 조인을 거친 블록이 아닙니다. 블록이 필터되어도 값이 바뀌면 안 되는 헤더의 "전체 합계" 셀에서 이 형태를 씁니다.

`Renewals` 는 `__sources__` 에서 선언한 이름입니다. [Recipe 07](./07-multi-source-join.md) 을 참고하세요.

## 필터는 블록만 바꾸고 원본은 건드리지 않음

```text
{{ @filter [Region] = "Seoul" }}
{{ [Account] }}    | {{ [Renewal] }}
Total:              | {{ SUM([Renewal]) }}        # Seoul 행만
Overall:            | {{ SUM(Source[Renewal]) }}  # 전체 행
```

`SUM([Renewal])` 은 필터 적용 후의 블록을 반영합니다. `SUM(Source[Renewal])` 은 필터를 무시합니다.

## 참고

- 집계는 ADR-0007 에 따라 빈 값을 건너뜁니다.
- `COUNT` 는 비어 있지 않은 값만 셉니다. 빈 값을 포함한 전체 행 수가 필요하면, 절대 비지 않는 컬럼에 대해 `COUNT(Source[any-required-col])` 을 쓰세요.
- 비어 있지 않은 값이 0개인 상태에서 `AVERAGE` 는 에러 대신 빈 값을 돌려줍니다.
- 스펙 참고: [`spec/language.md`](../../spec/language.md) 의 "Aggregates", 원본 의미론은 ADR-0012.
