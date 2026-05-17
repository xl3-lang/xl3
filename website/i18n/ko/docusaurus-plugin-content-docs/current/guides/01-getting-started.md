# 01 · 5분 만에 시작하기

## 시나리오

고객 갱신 내역이 담긴 `.xlsx` 파일이 있습니다. 행 구성은 그대로 두되, 갱신 금액으로부터 산출한 "Tier" 컬럼을 추가한 한 장짜리 리포트를 만들고 싶습니다.

## `__config__`

| key | value |
|---|---|
| `source_sheet` | `Raw` |
| `source_table` | `1` |
| `output_file_pattern` | `renewal-report.xlsx` |

## 템플릿 셀 (시트 `Report`)

| Cell | Value |
|---|---|
| A1 | `Account` |
| B1 | `Region` |
| C1 | `Renewal` |
| D1 | `Tier` |
| A2 | `{{ [Account] }}` |
| B2 | `{{ [Region] }}` |
| C2 | `{{ [Renewal] }}` |
| D2 | `{{ IF([Renewal] > 10000, "Priority", "Standard") }}` |

## 원본 데이터 (시트 `Raw`)

| Account | Region | Renewal |
|---|---|---:|
| Acme Logistics | Seoul | 18400 |
| Beta Works | Busan | 7200 |
| Coreon Foods | Seoul | 25100 |

## 결과 (`renewal-report.xlsx`, 시트 `Report`)

| Account | Region | Renewal | Tier |
|---|---|---:|---|
| Acme Logistics | Seoul | 18400 | Priority |
| Beta Works | Busan | 7200 | Standard |
| Coreon Foods | Seoul | 25100 | Priority |

## 참고

- 템플릿의 2행이 **데이터 블록**입니다. xl3는 원본의 행 하나를 결과의 행 하나로 펼치고, 템플릿 행에 설정된 스타일·숫자 서식·병합 셀을 그대로 유지합니다.
- `[Account]` 는 **컬럼 참조**입니다 — 현재 원본 행의 `Account` 컬럼 값으로 치환됩니다.
- `{{ ... }}` 는 **템플릿 블록**으로, 중괄호 안의 내용은 XTL 표현식으로 평가됩니다. 중괄호 안의 공백은 의미가 없습니다.
- 데이터 블록은 템플릿 블록이 없는 첫 번째 비어 있지 않은 행에서 멈춥니다. 푸터 행(예: "합계" 셀)을 추가해두면 그 위에서 데이터 블록만 펼쳐지고 푸터는 제자리에 머뭅니다.

함께 보기: [`spec/language.md`](../../spec/language.md) 의 "Template Blocks" 와 "Source Columns" 항목.
