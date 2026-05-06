# xl3

> workbook template으로 Excel 변환 엔진을 만듭니다.
> 실무자는 raw Excel을 올리고 완성된 workbook을 내려받습니다.

**상태:** alpha · XTL spec 0.1 (draft) · 1.0 전까지 breaking change 가능

[English](./README.md) · [Website](https://xl3.io) · [Spec](./spec) · [Implementations](./IMPLEMENTATIONS.md)

---

## xl3는 무엇인가요?

xl3는 반복되는 Excel 변환 업무를 template workbook으로 표현하고 실행하는
TypeScript 라이브러리입니다.

개발자는 재사용 가능한 엔진을 코드로 정의합니다. workbook별 업무 규칙,
raw 헤더 매핑, 레이아웃, 출력 모양은 `template.xlsx` 안에 둡니다.
비개발자는 단순한 파일 흐름을 사용합니다. raw Excel을 올리고, 승인된
템플릿을 선택하고, 완성된 workbook을 내려받습니다.

```text
raw.xlsx        (실무자 데이터)
       +
template.xlsx   (업무 규칙 + workbook 레이아웃)
       ↓
result.xlsx     (완성된 workbook)
```

템플릿은 **Excel에서 직접 작성**합니다. `_config`에 설정을 넣고,
`{{ [Account] }}` 또는 `{{ IF([Renewal] > 10000, "Priority", "Standard") }}`
같은 표현식을 셀에 넣고, 저장하고, xl3를 실행하면 됩니다. 매크로도,
숨겨진 스크립트도, 벤더 클라우드도 필요하지 않습니다.

템플릿은 인수인계용 산출물이 됩니다. 자동화 코드를 읽지 않아도 검토하고,
버전 관리하고, 보관하고, 다음 담당자에게 넘길 수 있습니다.

## 간단한 예시

템플릿에는 일반 Excel 내용, `_config`, xl3 표현식을 함께 넣을 수 있습니다.

| `_config` key | 값 |
|---|---|
| `source_sheet` | `Raw` |
| `source_header_range` | `A1:D1` |
| `output_file_pattern` | `customer-renewal-report.xlsx` |

| 셀 | 템플릿 값 |
|---|---|
| A5 | `{{ [Account] }}` |
| B5 | `{{ [Region] }}` |
| C5 | `{{ [Renewal] }}` |
| E5 | `{{ IF([Renewal] > 10000, "Priority", "Standard") }}` |

데이터 Excel 파일이 다음과 같다면:

| Account | Region | Renewal | Owner |
|---|---|---:|---|
| Acme Logistics | Seoul | 18400 | Mina |
| Beta Works | Busan | 7200 | Joon |

xl3는 다음 결과를 렌더링합니다.

| Account | Region | Renewal | Owner | Tier |
|---|---|---:|---|---|
| Acme Logistics | Seoul | 18400 | Mina | Priority |
| Beta Works | Busan | 7200 | Joon | Standard |

출력은 여전히 `.xlsx` 파일입니다. 템플릿의 서식, 숫자 형식, 병합 셀은
우연히 따라오는 부가 요소가 아니라 결과의 일부로 취급됩니다.

언어 초안은 [`spec/`](./spec)에 있고, 구현 중립적인 fixture corpus와 runner
protocol은 [`conformance/`](./conformance)에 있습니다.

## 왜 xl3가 필요한가요?

많은 보고 업무는 이미 스프레드시트 안에 있습니다. 리뉴얼 보고서, 정산서,
인보이스 export, 내부 운영용 템플릿이 모두 Excel로 돌아갑니다. 이런 업무는
Python script, VBA macro, 서비스별 workflow로 자동화되곤 합니다. 문제는
업무 규칙이 코드, 계정, 담당자의 기억에 흩어지기 쉽다는 점입니다.

xl3는 재사용 가능한 엔진과 workbook별 변환 계약을 분리합니다. 배포, 검증,
서비스 통합은 코드에서 관리하고, 반복되는 업무 흐름은 workbook 안에 둡니다.

## xl3가 강조하는 것

- **실무자에게 단순한 흐름.** raw `.xlsx`와 승인된 템플릿을 넣으면 완성된
  workbook이 나옵니다.
- **규칙은 workbook과 함께 이동합니다.** `_config`, 표현식, 레이아웃, 출력
  모양이 `template.xlsx` 안에 아카이빙됩니다.
- **엔진은 개발자가 관리합니다.** TypeScript API를 브라우저 페이지, 내부 포털,
  CLI, 서비스 endpoint에 연결할 수 있습니다.
- **Excel은 계속 Excel입니다.** 스타일, 숫자 형식, 시트 구조, 병합 셀은 결과의
  일부로 유지됩니다.
- **매크로나 벤더 클라우드가 없습니다.** 템플릿 동작은 명시적인 workbook
  콘텐츠입니다.

## 비교

|  | xl3 | xltpl (Python) | JXLS (Java) | Plumsail | VBA macros | LLMs |
|---|---|---|---|---|---|---|
| Excel을 템플릿으로 사용 | ✅ | ✅ | ✅ (셀 안 XML) | ✅ | n/a | ❌ |
| 브라우저 네이티브 | ✅ | ❌ | ❌ | ❌ | ❌ | 일부 |
| 공개 spec | ✅ (XTL, CC-BY-4.0) | ❌ | ❌ | ❌ closed | n/a | ❌ |
| 결정적/재현 가능 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 비개발자 작성 가능 | ✅ | ❌ | ❌ | ✅ | ⚠️ | ✅ |
| 셀프 호스팅/벤더 락인 없음 | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |

## 설치

```bash
npm install xl3
```

## 사용법

```ts
import { convert } from 'xl3';

const templateBuffer = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
const dataBuffer = await fetch('./data.xlsx').then((r) => r.arrayBuffer());

const outputs = await convert(templateBuffer, dataBuffer);
// outputs: OutputFile[] — 템플릿의 grouping rule에 따라 하나 이상의 .xlsx 출력
```

브라우저와 Node 18 이상에서 동작합니다.

[xl3.io](https://xl3.io)에서 브라우저 흐름을 바로 시험해볼 수 있습니다.
첨부된 예시 파일을 그대로 실행하거나, raw/template workbook을 내려받아
확인하거나, 원하는 파일로 교체할 수 있습니다.

템플릿의 숨김 `_config` sheet에서 raw 파일의 헤더 셀을 지정할 수 있습니다.

| Key | 예시 | 의미 |
|---|---|---|
| `source_sheet` | `Raw` | 원본 worksheet 이름, 또는 `*`로 끝나는 prefix pattern |
| `source_header_range` | `A1:D1` | 헤더 셀 범위. 그 아래 행을 데이터로 읽음 |
| `source_range` | `A1:D200` | 전체 원본 범위. 첫 행은 헤더, 나머지는 데이터 |

헤더 범위는 고정되어 있고 데이터 행 수가 계속 달라지는 경우
`source_header_range`를 쓰면 됩니다. `source_range`와 동시에 설정하면
안 됩니다.

## Spec

XTL spec은 언어 중립적이며 [`spec/`](./spec)에 있습니다. 이 저장소는 TypeScript
reference implementation을 제공합니다. 다른 언어 포트도 환영합니다. 자세한 내용은
[IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md)를 참고하세요.

conformance corpus를 로컬에서 실행할 수 있습니다.

```bash
npm run conformance
node dist/bin/conformance.js --fixture-dir=conformance/fixtures --comparison-stage=2
```

## 프로젝트 구조

- `spec/` — normative XTL language draft
- `conformance/` — 구현 중립적인 fixture corpus와 runner protocol
- `src/` — TypeScript reference implementation

spec이 기준입니다. Conformance fixture는 spec 동작을 실행 가능하게 만듭니다.
reference implementation은 유용하지만 그 자체가 기준은 아닙니다.

## 라이선스

- Code (`src/`, `conformance/`): [MIT](./LICENSE)
- XTL spec (`spec/`): [CC-BY-4.0](./spec/LICENSE)

---

Microsoft와 Excel은 Microsoft Corporation의 상표입니다. xl3는 Microsoft와
관련이 없습니다. Office Open XML 형식(`.xlsx`)은 ISO/IEC 29500으로 공개되어
있습니다.
