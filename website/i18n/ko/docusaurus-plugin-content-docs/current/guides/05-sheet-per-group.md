# 05 · 그룹별 시트 분리

## 시나리오

같은 갱신 리포트를 파일 하나로 만들되, 지역마다 시트를 따로 두고 싶습니다. 추가로 특정 상태값 목록에 해당하는 "갱신 불가" 시트도 한 장 붙입니다.

## 접근: 시트 이름에 그룹 키를 박는다

템플릿 시트의 이름 자체가 시트 템플릿입니다. xl3는 그룹 키의 고유 값마다 시트를 하나씩 펼치면서 템플릿 내용을 그대로 복제합니다.

```text
Template sheet name:  Region-{{ [Region] }}
```

xl3는 `Region-{{ [Region] }}` 라는 시트 이름을 그대로 읽어 들여 원본 행을 `Region` 으로 그룹핑하고, 지역마다 시트 하나씩을 `Region-Seoul`, `Region-Busan` 처럼 펼쳐냅니다.

## `__config__`

| key | value |
|---|---|
| `source_sheet` | `Raw` |
| `source_table` | `1` |
| `output_file_pattern` | `regions.xlsx` |

## 템플릿 (시트 이름 `Region-{{ [Region] }}`)

| Cell | Value |
|---|---|
| A1 | `Account` |
| B1 | `Renewal` |
| A2 | `{{ [Account] }}` |
| B2 | `{{ [Renewal] }}` |
| A3 | `Total` |
| B3 | `{{ SUM([Renewal]) }}` |

## 원본 데이터

| Account | Region | Renewal |
|---|---|---:|
| Acme | Seoul | 18400 |
| Beta | Busan | 7200 |
| Coreon | Seoul | 25100 |

## 결과 (`regions.xlsx`)

- 시트 `Region-Seoul`: Acme, Coreon, Total=43500.
- 시트 `Region-Busan`: Beta, Total=7200.

## 명명된 목록으로 시트 필터링하기

자주 쓰는 패턴 하나 — 그룹마다 시트를 만들면서, 별도로 "$5k 미만 갱신 전체" 시트를 상태 목록 기준으로 한 장 더 붙이는 경우입니다. `__lists__` 를 씁니다.

```text
__lists__:
  status_active: ["Active", "Renewing"]
  status_inactive: ["Cancelled", "Lapsed"]
```

그리고 시트 템플릿에서는 이렇게 참조합니다.

```text
Template sheet name: At-Risk
A1: Account | B1: Status | C1: Renewal
A2: {{ @filter [Status] in __lists__[status_active] }}{{ @filter [Renewal] < 5000 }}{{ [Account] }}
B2: {{ [Status] }}
C2: {{ [Renewal] }}
```

한 블록 안의 `@filter` 디렉티브 여러 개는 AND 로 합성됩니다. 즉 각 필터가 직전 결과를 더 좁혀 들어갑니다.

## 참고

- 시트 이름은 Excel 의 31자 제한과 금지 문자(`[ ] / \ ? *`)에 맞춰 정제됩니다. 정제 결과가 충돌하는 경우의 동작은 ADR-0021 에 따라 구현이 정의합니다 — 그룹 키 자체를 상류에서 유일하게 유지하세요.
- 빈 그룹 키는 ADR-0026 에 따라 `(blank)` 리터럴로 처리됩니다.
- 시트 순서는 ADR-0016 에 따라 처음 등장한 순서를 따릅니다.
