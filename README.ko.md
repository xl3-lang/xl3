# xl3

> Excel 변환을, Excel 안에서, Excel 문법으로.
> 반복되는 Excel 변환 규칙을 엑셀 파일 안에 넣어 둡니다.

**상태:** alpha · XTL spec 0.1 (draft) · 1.0 전까지 breaking change 가능

xl3는 기술적으로는 안정되어 가는 단계지만 프로젝트로서는 아직 형성기에
있습니다 — 메인테이너 1명, production reference case 없음, 거버넌스
방금 문서화. Audit 패스로 silent-fallthrough 동작은 모두 정리됐고
(ADR 37개, fixture 123개, Stage 2 전부 green), 언어 표면은 early
adopter가 시도해볼 만큼 안정됐습니다. **지금 가장 가치 있는 기여는
실제 사용 후 피드백**입니다 — 1.0 blocker는 [ROADMAP.md](./ROADMAP.md),
의사결정 방식은 [GOVERNANCE.md](./GOVERNANCE.md) 참고.

**0.5.x 주요 변경** (2026년 5월): 소스 워크북의 **병합 헤더 셀** 네이티브
지원 (ADR-0033) — 한국식 vendor 양식(거래명세서, 정산서, 발주서) 에서
흔한 패턴. 데이터 행의 병합 셀은 마스터 값을 슬레이브에 broadcast
(ADR-0035). 이미지·조건부서식·이름 정의·틀고정·시트 보호·데이터 유효성·
셀 주석을 다루는 정규 보존 매트릭스 추가 (ADR-0036).

[English](./README.md) · [Website](https://xl3.io) · [Spec](./spec) · [Implementations](./IMPLEMENTATIONS.md) · [Roadmap](./ROADMAP.md) · [Governance](./GOVERNANCE.md)

> **LLM(Claude, GPT, Gemini, Codex, Cursor 등)으로 xl3 템플릿을 만들고 있다면** [`docs/llm-template-authoring.md`](./docs/llm-template-authoring.md)를 먼저 읽으세요. LLM이 거의 매번 반복하는 한 가지 실수(스타일이 남아 출력마다 빈 행으로 따라붙는 문제)와 그 회피 방법을 다룹니다. 본문은 영문입니다 — LLM이 직접 참조하는 문서이므로 영어로 유지합니다.

---

## xl3는 무엇인가요?

xl3 는 엑셀 변환 규칙을 **코드가 아니라 엑셀 파일 안**에 담아둡니다.
비개발자도 변환 규칙을 직접 열어 읽고 고칠 수 있습니다 — `IF`, `SUM`,
컬럼 참조처럼 평소에 쓰던 엑셀 문법 그대로니까요. 개발자는 엔진만 한 번
만들어 배포하고, 반복되는 변환 업무는 템플릿 엑셀 파일이 책임집니다.

구조는 단순합니다.

- 누가: 코드를 읽지 않아도 되는 실무자와 운영자가
- 무엇을: 반복되는 엑셀 변환 업무를
- 어떻게: `IF`, `SUM` 같은 익숙한 엑셀 함수로, **엑셀 파일 안에서 직접**

```text
raw.xlsx        (입력 데이터)
       +
template.xlsx   (변환 규칙)
       ↓
result.xlsx     (완성된 엑셀 파일)
```

개발자는 엔진을 코드로 관리하고, 실무자는 파일 기반 흐름을 씁니다.
원본 엑셀을 올리고, 승인된 템플릿을 고르고, 완성된 결과 엑셀을 받으면
끝입니다.

템플릿은 **엑셀에서 직접 작성**합니다. `__config__` 시트에 설정을 넣고,
`{{ [Account] }}` 또는 `{{ IF([Renewal] > 10000, "Priority", "Standard") }}`
같은 표현식을 셀에 입력하고, 저장한 뒤 xl3 를 실행하면 됩니다. 매크로도,
숨겨진 스크립트도, 외부 클라우드도 필요 없습니다.

템플릿은 그대로 인수인계 자산이 됩니다. 자동화 코드를 따로 읽지 않아도
검토하고, 버전을 매기고, 보관하고, 다음 담당자에게 그대로 넘길 수 있습니다.

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

## 왜 xl3 가 필요한가요?

많은 보고 업무는 이미 스프레드시트 안에 있습니다. 갱신 보고서, 정산서,
인보이스 내보내기, 내부 운영용 양식이 모두 엑셀로 돌아갑니다. 이런 업무는
파이썬 스크립트, VBA 매크로, 서비스별 자동화 도구로 처리되곤 합니다. 문제는
그 과정에서 업무 규칙이 코드, 계정, 담당자 머릿속으로 흩어진다는 점입니다.

xl3 는 재사용 가능한 엔진과 엑셀 파일별 변환 규칙을 분리합니다. 배포, 검증,
서비스 연동은 코드에서 관리하고, 반복되는 업무 흐름은 엑셀 파일 안에 그대로
둡니다.

## xl3 가 지향하는 것

- **파일 기반 흐름.** 원본 `.xlsx` 와 승인된 템플릿을 넣으면 완성된 엑셀
  파일이 나옵니다.
- **규칙은 엑셀 파일과 함께 이동합니다.** `__config__`, 표현식, 레이아웃, 출력
  모양이 `template.xlsx` 안에 보관됩니다.
- **엔진은 개발자가 관리합니다.** TypeScript API 를 브라우저 페이지, 내부
  포털, CLI, 서비스 엔드포인트에 그대로 붙일 수 있습니다.
- **엑셀은 계속 엑셀입니다.** 스타일, 숫자 형식, 시트 구조, 병합 셀이 결과
  엑셀에 그대로 남습니다.
- **매크로도 외부 클라우드도 없습니다.** 템플릿 동작은 엑셀 파일에 그대로
  적혀 있는 내용입니다.

## 비교

| 접근 | 잘하는 영역 | 대신 잃는 것 |
|---|---|---|
| **xl3** | 운영팀이 원본 `.xlsx` 를 올리고 완성된 엑셀 파일을 내려받는 파일 기반 엑셀 변환 엔진. 업무 규칙은 `template.xlsx` 안에 머뭅니다. | Alpha 단계입니다. XTL 언어 표면은 의도적으로 작게 유지하며 아직 다듬는 중입니다. |
| 파이썬 / VBA 스크립트 | 기존 스프레드시트와 가까운 빠른 일회성 자동화. | 업무 규칙이 코드나 한 담당자의 기억에 남기 쉬워 검토와 인수인계가 어렵습니다. |
| Power Query / Office Scripts / Power Automate | Microsoft 365 안에서 데이터 가공과 워크플로 자동화. | 플랫폼 적합성은 강하지만 자동화가 테넌트와 계정에 묶여 독립된 엑셀 파일 형태로 남기 어렵습니다. |
| SheetJS / ExcelJS / Aspose.Cells 같은 스프레드시트 SDK | 엑셀 파일을 세밀하게 읽고 쓰는 저수준·풀-기능 코드. | 보고서별 규칙을 결국 애플리케이션 코드 안에 직접 넣게 됩니다. |
| JXLS / xltpl 같은 템플릿·리포트 엔진 | 스프레드시트형 템플릿 기반의 서버 사이드 보고서 생성. | 유용하지만 특정 언어와 런타임에 묶이는 경우가 많고, 운영자 흐름이나 엑셀 파일 단위 인수인계가 메인 제품 형태는 아닙니다. |
| Plumsail / Formstack / Conga 같은 문서 생성 SaaS | 관리형 문서 자동화, 외부 연동, 결재, 배송. | 규칙이 vendor 서비스 안에 남고, 자체 호스팅 가능한 독립 템플릿이 메인은 아닙니다. |
| LLM 기반 스프레드시트 생성 | 일회성 탐색과 초안 작성. | 반복되는 운영 업무를 위한 결정적 변환 계약으로 쓰기에는 부적합합니다. |

## 설치

```bash
npm install @jinyoung4478/xl3
```

## 사용법

```ts
import { convert } from '@jinyoung4478/xl3';

const templateBuffer = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
const dataBuffer = await fetch('./data.xlsx').then((r) => r.arrayBuffer());

const outputs = await convert(templateBuffer, dataBuffer);
// outputs: OutputFile[] — 템플릿의 grouping rule에 따라 하나 이상의 .xlsx 출력
```

브라우저와 Node 20.12 이상에서 동작합니다.

### 번들러 없이 `<script>`로 사용

번들러를 쓰지 않는 환경에서는 자체 포함 IIFE 번들을 그대로 가져오면
`window.xl3` 로 사용할 수 있습니다.

```html
<script src="https://cdn.jsdelivr.net/npm/@jinyoung4478/xl3@0.5.1/dist/xl3.bundle.iife.min.js"></script>
<script>
  const tpl = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
  const data = await fetch('./data.xlsx').then((r) => r.arrayBuffer());
  const outputs = await xl3.convert(tpl, data);
</script>
```

번들 크기는 약 1 MB (minified, gzip 약 300 KB). ExcelJS 와 JSZip 이 같이
들어가 있어 다른 의존성 없이 한 줄 include 로 바로 동작합니다.

[xl3.io](https://xl3.io) 에서 브라우저 흐름을 바로 시험해볼 수 있습니다.
첨부된 샘플 파일을 그대로 실행해도 되고, 원본·템플릿 엑셀 파일을 내려받아
살펴봐도 되고, 원하는 파일로 교체해서 돌려봐도 됩니다.

템플릿의 숨김 `__config__` 시트에서 원본 파일의 소스 테이블 위치를 지정할
수 있습니다.

| 키 | 예시 | 의미 |
|---|---|---|
| `source_sheet` | `Raw` | 원본 시트 이름, 또는 `*` 로 끝나는 접두사 패턴 |
| `source_table` | `1` | 1 행을 컬럼명으로 읽고, 그 아래 행들을 데이터로 처리 |
| `source_table` | `A1:D` | A1-D1 을 컬럼명으로 읽고, 그 아래 행들을 데이터로 처리 |
| `source_table` | `A1:D200` | A1-D1 을 컬럼명으로 읽고, A2-D200 영역을 데이터로 처리 |

원본 파일의 N 번 행이 컬럼명인 일반적인 경우에는 `source_table = N` 한 줄이면
됩니다. 테이블이 중간 컬럼에서 시작하거나 끝 행을 제한해야 할 때만 범위
형식을 씁니다.

### 예약 시트

템플릿은 양쪽이 더블 언더스코어로 감싸진 예약 시트 네 개를 사용합니다
(ADR-0011 기준).

| 시트 | 용도 |
|---|---|
| `__config__` | 템플릿 작성자가 정의하는 설정과 값 사전. `{{ __config__[name] }}` 로 참조 |
| `__inputs__` | 실행 시점에 호스트가 넘기는 입력값 (ADR-0010). `name`/`type`/`default`/`label`/`description`/`options` 컬럼으로 선언 |
| `__sources__` | 기본 `source_sheet` 외에 추가로 쓰는 이름 붙은 데이터 소스 (ADR-0012). `name`/`sheet`/`table`/`description` 컬럼으로 선언 |
| `__lists__` | `@filter [field] in __lists__[name]` 등에서 쓰는 멤버십 목록 |

작성자가 만든 시트 이름이 `^__[a-z]+__$` 패턴에 걸리면 파싱 단계에서
거절됩니다.

### 다중 소스 (Multi-source) 데이터

기본 `source_sheet` 외에도 템플릿이 `__sources__` 에서 이름 붙은 소스를
선언하고 엑셀 구조화 참조 (structured reference) 형식으로 가져올 수 있습니다.

```text
{{ Customers[Account] }}
{{ SUM(Renewals[Amount]) }}
{{ XLOOKUP([Account], Customers[Account], Customers[Name]) }}
```

`@source <Name>` 은 데이터 블록의 기본 소스를 `<Name>` 으로 바꿔서 단축형
`[Column]` 도 `<Name>` 기준으로 해석되게 합니다. `@join` 은 두 번째 소스의
행을 키 기준으로 기본 행과 짝지웁니다 (inner join, 첫 매치 사용). 전체
디렉티브 문법은 [`spec/language.md`](./spec/language.md) 를 참고하세요.

## 가이드

자주 쓰는 패턴을 모은 짧은 레시피 10 개가
[`docs/guides/`](./docs/guides) 에 있습니다. 시작하기, 조건문, 집계,
파일·시트 그룹화, 런타임 입력값, 조인, `XLOOKUP`, 정렬·Top-N, 브랜딩까지
다룹니다.

## Spec

XTL 스펙은 언어 중립적이며 [`spec/`](./spec) 에 있습니다. 이 저장소는
TypeScript 레퍼런스 구현을 함께 제공합니다. 다른 언어 포팅도 환영합니다 —
자세한 내용은 [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md) 참고.

Conformance 코퍼스는 로컬에서 바로 돌려볼 수 있습니다.

```bash
npm run conformance
node dist/bin/conformance.js --fixture-dir=conformance/fixtures --comparison-stage=2
```

## 프로젝트 구조

- `spec/` — 정규 XTL 언어 초안
- `conformance/` — 구현 중립적인 fixture 코퍼스와 runner protocol
- `src/` — TypeScript 레퍼런스 구현

스펙이 진실의 출처입니다. Conformance fixture 는 그 스펙 동작을 실행 가능한
형태로 굳혀둡니다. 레퍼런스 구현은 유용한 도구이지만 그 자체가 기준은
아닙니다.

## 라이선스

- Code (`src/`, `conformance/`): [MIT](./LICENSE)
- XTL spec (`spec/`): [CC-BY-4.0](./spec/LICENSE)

---

Microsoft와 Excel은 Microsoft Corporation의 상표입니다. xl3는 Microsoft와
관련이 없습니다. Office Open XML 형식(`.xlsx`)은 ISO/IEC 29500으로 공개되어
있습니다.
