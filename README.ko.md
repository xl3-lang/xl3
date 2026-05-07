# xl3

> Excel 변환을, Excel 안에서, Excel 문법으로.
> 반복되는 Excel 변환 규칙을 엑셀 파일 안에 넣어 둡니다.

**상태:** alpha · XTL spec 0.1 (draft) · 1.0 전까지 breaking change 가능

[English](./README.md) · [Website](https://xl3.io) · [Spec](./spec) · [Implementations](./IMPLEMENTATIONS.md)

---

## xl3는 무엇인가요?

xl3는 Excel 변환 로직을 **코드가 아니라 Excel 파일 안**에 넣습니다.
비개발자도 변환 규칙을 직접 열어 읽고 고칠 수 있습니다 — `IF`, `SUM`,
열 참조처럼 평소 쓰던 Excel 문법 그대로니까요. 개발자는 엔진을 배포하고,
반복되는 변환 작업은 엑셀 파일이 짊어집니다.

프레임은 단순합니다.

- 누가: 코드를 읽지 않아도 되는 실무자와 운영자가
- 무엇을: 반복되는 엑셀 변환 작업을
- 어떻게: `IF`, `SUM` 같은 익숙한 엑셀 함수로, **엑셀 파일 안에서 직접**

```text
raw.xlsx        (입력 데이터)
       +
template.xlsx   (변환 규칙)
       ↓
result.xlsx     (완성된 엑셀 파일)
```

개발자는 엔진을 코드로 소유합니다. 실무자는 파일 기반 흐름을 사용합니다.
raw Excel을 올리고, 승인된 템플릿을 선택하고, 완성된 엑셀 파일을 내려받으면
됩니다.

템플릿은 **Excel에서 직접 작성**합니다. `__config__`에 설정을 넣고,
`{{ [Account] }}` 또는 `{{ IF([Renewal] > 10000, "Priority", "Standard") }}`
같은 표현식을 셀에 넣고, 저장하고, xl3를 실행하면 됩니다. 매크로도,
숨겨진 스크립트도, 벤더 클라우드도 필요하지 않습니다.

템플릿은 인수인계용 산출물이 됩니다. 자동화 코드를 읽지 않아도 검토하고,
버전 관리하고, 보관하고, 다음 담당자에게 넘길 수 있습니다.

## 간단한 예시

템플릿에는 일반 Excel 내용, `__config__`, xl3 표현식을 함께 넣을 수 있습니다.

| `__config__` key | 값 |
|---|---|
| `source_sheet` | `Raw` |
| `source_table` | `1` |
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
Python 스크립트, VBA 매크로, 서비스별 자동화 도구로 처리되곤 합니다. 문제는
업무 규칙이 코드, 계정, 담당자의 기억에 흩어지기 쉽다는 점입니다.

xl3는 재사용 가능한 엔진과 엑셀 파일별 변환 규칙을 분리합니다. 배포, 검증,
서비스 통합은 코드에서 관리하고, 반복되는 업무 흐름은 엑셀 파일 안에 둡니다.

## xl3가 강조하는 것

- **파일 기반 흐름.** raw `.xlsx`와 승인된 템플릿을 넣으면 완성된 엑셀 파일이
  나옵니다.
- **규칙은 엑셀 파일과 함께 이동합니다.** `__config__`, 표현식, 레이아웃, 출력
  모양이 `template.xlsx` 안에 아카이빙됩니다.
- **엔진은 개발자가 관리합니다.** TypeScript API를 브라우저 페이지, 내부 포털,
  CLI, 서비스 endpoint에 연결할 수 있습니다.
- **Excel은 계속 Excel입니다.** 스타일, 숫자 형식, 시트 구조, 병합 셀은 결과의
  일부로 유지됩니다.
- **매크로나 벤더 클라우드가 없습니다.** 템플릿 동작은 엑셀 파일에 명시적으로
  적혀 있는 내용 그대로입니다.

## 비교

| 접근 | 잘하는 것 | tradeoff |
|---|---|---|
| **xl3** | 실무자가 raw `.xlsx`를 올리고 완성된 엑셀 파일을 내려받는 파일 기반 Excel 변환 엔진을 만들기. 업무 규칙은 `template.xlsx` 안에 남습니다. | Alpha입니다. XTL surface는 의도적으로 작고 아직 진화 중입니다. |
| Python/VBA script | 기존 스프레드시트에 가까운 빠른 일회성 자동화. | 업무 규칙이 코드나 특정 담당자의 기억에 남기 쉬워 검토와 인수인계가 어려워집니다. |
| Power Query / Office Scripts / Power Automate | Microsoft 365 안에서 데이터 정리, 작업 자동화, 흐름 연결. | 플랫폼 적합성은 강하지만 자동화가 tenant, 계정, 환경에 묶이고 독립적인 엑셀 파일로 남기 어렵습니다. |
| SheetJS, ExcelJS, Aspose.Cells 같은 spreadsheet SDK | 엑셀 파일을 세밀하게 읽고 쓰는 저수준/고기능 프로그래밍. | 보고서별 규칙을 개발자가 application code 안에 직접 넣는 경우가 많습니다. |
| JXLS, xltpl 같은 template/report engine | 스프레드시트형 템플릿 기반 서버사이드 보고서 생성. | 유용하지만 언어/runtime에 묶이는 경우가 많고, 실무자용 브라우저 흐름과 엑셀 파일 단위 인수인계가 중심 제품 형태는 아닙니다. |
| Plumsail, Formstack, Conga 같은 문서 생성 SaaS | 관리형 문서 자동화, integration, approval, delivery. | 규칙이 vendor service 안에 남고, self-host 가능한 독립적인 엑셀 템플릿이 중심은 아닙니다. |
| LLM 기반 spreadsheet 생성 | 일회성 탐색과 초안 생성. | 반복 운영 업무를 위한 결정적 변환 계약으로 쓰기 어렵습니다. |

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
첨부된 예시 파일을 그대로 실행하거나, raw/template 엑셀 파일을 내려받아
확인하거나, 원하는 파일로 교체할 수 있습니다.

템플릿의 숨김 `__config__` sheet에서 raw 파일의 source table을 지정할 수 있습니다.

| Key | 예시 | 의미 |
|---|---|---|
| `source_sheet` | `Raw` | 원본 worksheet 이름, 또는 `*`로 끝나는 prefix pattern |
| `source_table` | `1` | 1행을 컬럼명으로 보고, 그 아래 행을 데이터로 읽음 |
| `source_table` | `A1:D` | A1-D1을 컬럼명으로 보고, 그 아래 행을 데이터로 읽음 |
| `source_table` | `A1:D200` | A1-D1을 컬럼명으로 보고, A2-D200을 데이터로 읽음 |

raw 파일의 N번 행이 컬럼명인 일반적인 경우에는 `source_table = N`을 쓰면
됩니다. 테이블이 중간 컬럼에서 시작하거나 끝 행을 제한해야 하면 range form을
사용합니다.

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
