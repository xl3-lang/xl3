# 06 · 런타임 입력값

## 시나리오

템플릿은 일반적으로 만들어두되, 실행할 때마다 특정 월이나 특정 지역을 지정하고 싶습니다. 운영자가 템플릿을 직접 고치게 만들지 않고, 변환 시점에 값을 넘겨받는 방식입니다.

## `__inputs__` 에 선언

| name | type | required | default | label | options |
|---|---|---|---|---|---|
| `month` | `text` | `true` | | `Target month (YYYY-MM)` | |
| `region` | `select` | `false` | `All` | `Region filter` | `All\|Seoul\|Busan\|Daegu` |

타입은 `text`, `number`, `date`, `select` 중 하나입니다.

## 템플릿 셀, 파일명, 그룹 키에서 사용

```text
Cell:           {{ "Report for " & __inputs__[month] }}
Filename:       output_file_pattern = {{ __inputs__[month] }}-renewals.xlsx
Filter:         {{ @filter [Region] = __inputs__[region] OR __inputs__[region] = "All" }}
```

마지막 줄은 사실 그대로는 동작하지 않습니다 — XTL 에는 `OR` 키워드가 없습니다. 정공법은 시트 템플릿을 두 개 두고 상위 로직으로 분기시키는 것입니다. 일단 `__inputs__` 의 가장 단순한 쓰임새는 셀, 파일명, 또는 고정 비교에 리터럴 값을 꽂아 넣는 것입니다.

```text
{{ @filter [Region] = __inputs__[region] }}

```

…그리고 호스트 측에서는 운영자가 특정 지역을 골랐을 때만 `convert()` 를 호출하도록 합니다.

## 호스트에서 값 전달

```ts
import { convert } from '@jinyoung4478/xl3';

const outputs = await convert(templateBuffer, dataBuffer, {
  inputs: { month: '2026-05', region: 'Seoul' },
});
```

`inputs.month` 가 누락됐는데 `month` 가 required 로 표시되어 있다면, xl3 는 변환 시점에 `xl3/inputs/missing-required` 를 던집니다. `region` 을 넘기지 않으면 `default` 값인 `All` 로 대체됩니다.

## 변환 없이 입력값 정의만 읽기

```ts
import { readTemplateInputs } from '@jinyoung4478/xl3';

const inputs = await readTemplateInputs(templateBuffer);
// → [{ name: 'month', type: 'text', required: true, ... }, ...]
```

운영자가 데이터 파일을 올리기 전에, 호스트 UI 에서 입력 폼을 미리 렌더링할 때 씁니다.

## 참고

- `select` 의 옵션은 `__inputs__` 행 안에서 파이프(`|`)로 구분합니다(예: `Seoul|Busan|Daegu`). 옵션에 없는 값이 들어오면 `xl3/inputs/select-option` 가 발생합니다.
- date 입력값은 `YYYY-MM-DD` 또는 `YYYY-MM-DDTHH:mm:ss` 형식으로 파싱됩니다.
- number 입력값은 JS 숫자 리터럴을 받습니다. 끝의 공백은 허용됩니다.
- 스펙 참조: [`spec/evaluation.md`](../../spec/evaluation.md) 의 "Inputs"; ADR-0010, ADR-0011.
