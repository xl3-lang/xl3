# 04 · 그룹별로 파일 나누기

## 시나리오

갱신 리포트를 큰 파일 하나가 아니라 지역별로 하나씩 `.xlsx` 로 떨어뜨리고 싶습니다. 운영팀은 각 지역 파일을 해당 지역 담당자에게 그대로 전달하면 됩니다.

## `__config__`

| key | value |
|---|---|
| `source_sheet` | `Raw` |
| `source_table` | `1` |
| `output_file_pattern` | `{{ [Region] }}.xlsx` |

그룹 키는 `output_file_pattern` 에서 참조한 값입니다. xl3 는 그 패턴이 평가된 값을 기준으로 원본 행을 그룹화하고, 서로 다른 값마다 파일을 하나씩 만들어 냅니다.

## 원본 데이터 (시트 `Raw`)

| Account | Region | Renewal |
|---|---|---:|
| Acme | Seoul | 18400 |
| Beta | Busan | 7200 |
| Coreon | Seoul | 25100 |

## 결과

파일 두 개:

- `Seoul.xlsx` — Acme 와 Coreon 행이 들어갑니다.
- `Busan.xlsx` — Beta 가 들어갑니다.

## 다중 키로 그룹화

```text
output_file_pattern = {{ [Region] }}-{{ [Tier] }}.xlsx
```

그룹 키가 튜플 `(Region, Tier)` 이 됩니다. 서로 다른 튜플마다 별도 파일이 만들어집니다 — `Seoul-A.xlsx`, `Seoul-B.xlsx`, `Busan-A.xlsx` 같은 식으로요.

## 파일명 정리(sanitization)

xl3 는 ADR-0002 에 따라 파일명을 정리합니다 — `/ \ : * ? " < > |` 에 속한 금지 문자와 제어 문자는 각각 `_` 하나로 1:1 치환되고, 앞쪽 공백과 뒤쪽 점·공백은 잘려 나갑니다. 연속된 `_` 는 합쳐지지 **않습니다**. 서로 다른 두 그룹 값이 같은 파일명으로 정리되면 — 예를 들어 `Seoul/Korea` 와 `Seoul:Korea` 가 모두 `Seoul_Korea.xlsx` 가 되는 경우(금지 문자 하나당 `_` 하나씩) — xl3 는 ADR-0031 에 따라 조용히 덮어쓰는 대신 `xl3/filename/collision` 에러를 던집니다.

## 그룹 키가 비어 있을 때

행의 그룹 키 값이 비어 있으면 xl3 는 ADR-0026 에 따라 Excel 피벗 관례인 `(blank)` 리터럴로 대체합니다. 해당 행은 `(blank).xlsx` 에 담깁니다.

## 참고

- 파일 순서는 ADR-0016 에 따라 원본에서 처음 등장한 순서를 따릅니다.
- 한 파일 안에서 지역별 시트로 나누는 시트 단위 그룹화는 [Recipe 05](./05-sheet-per-group.md) 를 참고하세요.
