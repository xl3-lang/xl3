# xl3

> **AI가 만든 Excel 리포트를 결정론적으로 실행하는 런타임.**
> LLM이 템플릿을 쓰고, xl3가 워크북을 렌더합니다 — 같은 템플릿, 같은
> 데이터, 항상 같은 바이트.

**상태:** alpha · XTL spec 0.1 (draft) · 1.0 전까지 breaking change 가능

xl3는 `.xlsx` 파일 두 개 — **템플릿**(워크플로 계약)과 **원본 데이터** —
를 받아 완성된 서식 워크북으로 변환하는 작은 TypeScript 엔진입니다.
템플릿 자체가 `.xlsx`이며, 익숙한 Excel 함수와, 워크북이 *써지기 전에*
알아야 할 값(필터, 그룹, 집계, 파일명 패턴 등) 만을 위한 작은 임베디드
표현식 언어 (XTL) 로 작성됩니다.

LLM (Claude, GPT, Gemini, Cursor, Codex, …) 이 템플릿을 생성·수정·검토
하는 파이프라인에서, **실행 레이어가 결정론적이고 점검 가능하며 검증
가능해야 할 때** 잘 맞습니다 — "AI 가 출력 셀을 추측" 하지 않습니다.

[English](./README.md) · **한국어** · [日本語](./README.ja.md) · [简体中文](./README.zh-CN.md) · [繁體中文](./README.zh-TW.md) · [Español](./README.es.md) · [Website](https://xl3.io) · [Spec](./spec) · [LLM authoring guide](./docs/llm-template-authoring.md) · [Implementations](./IMPLEMENTATIONS.md) · [Roadmap](./ROADMAP.md) · [Governance](./GOVERNANCE.md)

---

## 분리 구조: 모델이 쓰고, 런타임이 렌더한다

```text
  ┌──────────────────────────┐         ┌──────────────────────────┐
  │   LLM (Claude / GPT /    │         │         xl3              │
  │   Gemini / Cursor / …)   │         │  (결정론적 런타임)        │
  │                          │         │                          │
  │   자연어                 │         │   template.xlsx          │
  │   + 샘플 리포트     ───► │  생성   │   + raw.xlsx             │
  │                          │         │   → result.xlsx          │
  │   "월별 정산서를         │         │                          │
  │    지역별로,             │         │   같은 입력 →            │
  │    소계 행 포함"         │         │   항상 같은 바이트       │
  └──────────────────────────┘         └──────────────────────────┘
       창의적, 확률적                      지루하고 재현 가능
```

LLM 은 프롬프트와 샘플로부터 리포트 **모양을 초안화** 하는 데는
강합니다. 하지만 같은 `.xlsx` 를 두 번 똑같이 만들거나, 셀 스타일을
보존하거나, "이 컬럼은 항상 SUM 집계" 같은 약속을 지키는 데는 약합니다.
xl3 가 그 갭을 메웁니다 — 모델은 `.xlsx` 템플릿을 한 번만 만들면
되고, 그 이후의 모든 렌더는 `(template, data, inputs)` 의 순수
함수입니다.

이 분리 구조 때문에 [`docs/llm-template-authoring.md`](./docs/llm-template-authoring.md),
154 개 conformance fixture 코퍼스, 그리고 의도적으로 작은 XTL 표면이
존재합니다.

## 간단한 예시

템플릿에는 일반 Excel 내용, `__config__`, xl3 표현식을 함께 넣을 수 있습니다.

| `__config__` key | 값 |
|---|---|
| `source_sheet` | `원본` |
| `source_table` | `1` |
| `output_file_pattern` | `거래처-갱신-리포트.xlsx` |

| 셀 | 템플릿 값 |
|---|---|
| A5 | `{{ [거래처] }}` |
| B5 | `{{ [지역] }}` |
| C5 | `{{ [갱신액] }}` |
| E5 | `{{ IF([갱신액] > 10000, "우선", "일반") }}` |

데이터 Excel 파일이 다음과 같다면:

| 거래처 | 지역 | 갱신액 | 담당자 |
|---|---|---:|---|
| 한솔물산 | 서울 | 18400 | 민아 |
| 베타웍스 | 부산 | 7200 | 준호 |

xl3는 다음 결과를 렌더링합니다:

| 거래처 | 지역 | 갱신액 | 담당자 | 등급 |
|---|---|---:|---|---|
| 한솔물산 | 서울 | 18400 | 민아 | 우선 |
| 베타웍스 | 부산 | 7200 | 준호 | 일반 |

…숫자 형식, 채우기, 테두리, 병합 헤더, 푸터 행이 모두 그대로 보존됩니다.
출력은 변환 없이 Excel · Numbers · Google Sheets 에서 바로 열리는 `.xlsx`
입니다.

언어 초안은 [`spec/`](./spec) 에, 구현 중립적인 fixture corpus 와 runner
protocol 은 [`conformance/`](./conformance) 에 있습니다.

## 왜 런타임은 지루해야 하는가

한 문장 요약: **LLM 이 만들어낸 Excel 은 토큰 하나만 잘못돼도 깨진
리포트가 됩니다.** 셀 수식이 어긋나고, 병합이 한 행 밀리고, 통화 기호가
숫자 서식 대신 리터럴 `$` 가 되는 식이죠. xl3 의 일은 그 템플릿의
*실행* 을 예측 가능하게 만들어, 모델이 *한 번만* 맞으면 되도록 하는
것입니다.

구체적으로:

- **작고 점검 가능한 XTL 표면 (ADR-0043).** 어떤 함수가 XTL 에
  살려면, 그 값이 워크북이 써지기 *전에* 알려져야 합니다. 그 외의
  모든 것은 평범한 Excel 셀 수식이고, Excel 이 열릴 때 직접 평가합니다.
  언어가 작을수록 LLM 이 배워야 할 표면도 작고, 검증해야 할 표면도
  작습니다. 대조표는
  [Cookbook 16](./docs/guides/16-xtl-vs-excel-formula.md) 참고.
- **Conformance 코퍼스.** 70 ADR 위에 154 fixture, 전부 green.
  LLM 이 만든 템플릿을 실제 사용자 데이터에 닿기 *전에* 검증할 수
  있는 테스트베드입니다.
- **하나의 구현, 하나의 스펙.** [`spec/`](./spec) 디렉토리가 이
  TypeScript 레퍼런스와는 별개로 XTL 을 정의합니다. 다른 런타임으로의
  포팅도 환영 — 코퍼스가 곧 계약입니다.
- **매크로도 외부 클라우드도 없음.** 템플릿은 평범한 `.xlsx` 입니다.
  diff 로 비교하고, PR 로 리뷰하고, xl3 를 모르는 사람에게도 그대로
  넘길 수 있습니다.

같은 특성은 **LLM 이 없는 흐름에서도** 유용합니다 — 실무자와 분석가가
템플릿을 직접 읽고 편집할 수 있으니까요. 평소 쓰던 `IF`, `SUM`, 컬럼
참조 그대로의 문법입니다. AI 앵글이 진입점이고, 사람이 읽을 수 있다는
점이 긴 꼬리입니다.

## 최근 변경

**0.7.0 → 0.8.0** (2026년 5월): 데이터 블록이 **컬럼 스코프
(column-scoped)** 로 바뀌었습니다 (ADR-0066). 사이드 요약표, 헤더 컬럼,
오른쪽의 메모는 블록이 확장돼도 원래 행 위치에 그대로 남습니다. 오래된
두 버그 (#46 shared-formula owner 중복, #47 변위된 사이드 셀의 stale
수식 참조) 를 구조적으로 닫았습니다. 명시적 **`@block`** 디렉티브
(ADR-0067) 도 추가 — bare / 컬럼 범위 / 직사각형 세 형태. `@block` 을
쓰는 시트에는 엄격(strict) 멀티 블록 판정이 적용됩니다 (ADR-0068).
**하위 호환:** `@block` 도 없고 블록 바깥 컬럼에 내용도 없는 템플릿은
0.7.x 와 완전히 동일하게 렌더됩니다 — `@block` 은 opt-in 입니다.

**0.6.0 → 0.7.0**: 15-ADR 패스 (ADR-0051..0065) 로 "같은 템플릿 모양이
두 가지로 해석되거나 조용히 흘러가버리던" 잔여 문법 충돌 지점을 모두
닫았습니다. 가장 큰 사용자 영향은 **집계 인자 형태 제한** (ADR-0059) —
`SUM`, `AVERAGE`, `MIN`, `MAX`, 1-arg `COUNT` 인자는 단일 컬럼 참조만
허용하며, 행별 산술식은 파싱 시점에 거부됩니다. 원본에 헬퍼 컬럼을
추가하거나, 푸터 셀에 네이티브 엑셀 `=SUMPRODUCT(...)` 를 쓰면 됩니다
([Cookbook 03](./docs/guides/03-aggregates.md) 참고).

**0.5.x → 0.6.0**: 병합 헤더 셀 네이티브 지원 (ADR-0033) — 한국식 vendor
양식 (거래명세서, 정산서, 발주서) 에서 흔한 패턴; 병합 데이터 행의
마스터 값 broadcast (ADR-0035); 이미지·조건부서식·이름 정의·틀고정·시트
보호·데이터 유효성·셀 주석을 다루는 정규 보존 매트릭스 (ADR-0036);
고객별/월별 소계 행을 한 데이터 블록 안에 끼워 넣는 **`@group` /
`@subtotal`** 디렉티브 (ADR-0038).

[전체 변경 로그 →](./CHANGELOG.md)

## 비교

| 접근 | 잘하는 영역 | AI 기반 Excel 관점의 트레이드오프 |
|---|---|---|
| **xl3** | LLM 이 작성한 Excel 파이프라인의 실행 절반. 모델은 템플릿을 한 번 쓰고, xl3 가 매 실행마다 결정론적으로 렌더. | Alpha; 메인테이너 1명; XTL 표면은 의도적으로 작게 유지하며 1.0 전까지 다듬는 중. |
| LLM → xlsx 직접 호출 (스프레드시트 SDK function call) | 빠른 탐색·일회성 차트. | 매 렌더가 비결정적 — 온도 0 에서도 스타일·숫자 형식·합계가 실행마다 어긋납니다. |
| SheetJS / ExcelJS / openpyxl | 저수준 워크북 생성. | 모델이 SDK 전체 표면을 배워서 매번 다시 emit 해야 합니다 — "템플릿" 이 애플리케이션 코드일 뿐, 휴대 가능한 파일이 아닙니다. |
| Power Query / Office Scripts / Power Automate | Microsoft 365 안에서의 데이터 가공·워크플로 자동화. | 테넌트에 묶임 — 업무 규칙이 워크북과 함께 이동하지 않습니다. |
| JXLS / xltpl / jsreport xlsx recipe | 스프레드시트형 템플릿 기반의 서버 사이드 리포트 생성. | 유용하지만 LLM-as-author 모델 이전 시대 설계 — 템플릿 DSL 이 크고 모델이 emit 하기 어렵습니다. |
| Plumsail / Conga / Formstack 같은 문서 생성 SaaS | 관리형 문서 워크플로·결재·배송. | 규칙이 vendor 서비스 안에 머물고, LLM 에게 직접 편집을 맡길 수 있는 휴대 가능한 워크북이 아닙니다. |

## 솔직한 상태 안내

- **Alpha.** XTL 은 spec 0.1 (draft). 동작은 빠르게 안정되고 있지만,
  1.0 전까지 언어 표면이 바뀔 수 있습니다.
- **메인테이너 1명.** Production reference case 는 아직 없습니다.
  의미 있는 곳에 xl3 를 쓰셨다면, *그 사실을 알려주시는 것* 이 지금
  가장 가치 있는 기여입니다 — 이슈, discussion thread, "우리한테 잘
  동작했어요" 한 줄도 좋습니다. 이 피드백이 *진짜 워크플로에 맞는
  1.0* 과 *제 상상 속 1.0* 의 차이를 결정합니다.
- **ADR 70 개, conformance fixture 154 개, 모두 green.** 언어 표면은
  early adopter 가 시도해볼 만큼 안정됐습니다.
- **MIT, TypeScript, Node ≥ 20.12, 브라우저에서 동작.**

1.0 의 blocker 는 [ROADMAP.md](./ROADMAP.md), 의사결정 방식은
[GOVERNANCE.md](./GOVERNANCE.md) 참고.

> **LLM 으로 xl3 템플릿을 만들고 있다면**
> [`docs/llm-template-authoring.md`](./docs/llm-template-authoring.md)
> 를 먼저 읽으세요. LLM 이 거의 매번 반복하는 한 가지 실수 (스타일이
> 남아 출력마다 빈 행으로 따라붙는 문제) 와 그 회피 방법을 다룹니다.
> 본문은 영문입니다 — LLM 이 직접 참조하는 문서이므로 영어로 유지.

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
<script src="https://cdn.jsdelivr.net/npm/@jinyoung4478/xl3@0.8.0/dist/xl3.bundle.iife.min.js"></script>
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
| `source_sheet` | `원본` | 원본 시트 이름, 또는 `*` 로 끝나는 접두사 패턴 |
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
{{ 거래처[거래처명] }}
{{ SUM(갱신현황[금액]) }}
{{ XLOOKUP([거래처코드], 거래처[코드], 거래처[거래처명]) }}
```

`@source <Name>` 은 데이터 블록의 기본 소스를 `<Name>` 으로 바꿔서 단축형
`[Column]` 도 `<Name>` 기준으로 해석되게 합니다. `@join` 은 두 번째 소스의
행을 키 기준으로 기본 행과 짝지웁니다 (inner join, 첫 매치 사용). 전체
디렉티브 문법은 [`spec/language.md`](./spec/language.md) 를 참고하세요.

## 가이드

자주 쓰는 패턴을 모은 짧은 레시피 18 개가
[`docs/guides/`](./docs/guides) 에 있습니다. 시작하기, 조건문, 집계,
파일·시트 그룹화, 런타임 입력값, 조인, `XLOOKUP`, 정렬·Top-N, 브랜딩,
멀티라인 텍스트, 빈 값, 에러 처리, `__config__` 값, 디렉티브 조합, XTL
vs Excel 수식, 템플릿 작성 시 표시, `@group` / `@subtotal` 까지 다룹니다.

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
