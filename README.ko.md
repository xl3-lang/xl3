# xl3

> Excel 파일 자체를 템플릿으로 사용합니다. 다른 Excel 파일의 데이터를 넣으면,
> 서식이 유지된 결과 Excel 파일이 나옵니다.

**상태:** alpha · XTL spec 0.1 (draft) · 1.0 전까지 breaking change 가능

[English](./README.md) · [Website](https://xl3.io) · [Spec](./spec) · [Implementations](./IMPLEMENTATIONS.md)

---

## xl3는 무엇인가요?

xl3는 Excel-to-Excel 템플릿 엔진입니다.

일반 `.xlsx` 파일을 템플릿으로 만들고, 셀 안에 `{{ [Customer] }}` 또는
`{{ IF([Amount] > 1000, "VIP", "Standard") }}` 같은 표현식을 넣습니다.
그 다음 xl3에 데이터 `.xlsx` 파일을 입력하면, 스프레드시트 구조, 스타일,
숫자 형식, 병합 셀을 보존한 새 Excel 파일을 생성합니다.

```text
data.xlsx       (원본 데이터)
       +
template.xlsx   (Excel 템플릿)
       ↓
result.xlsx     (서식이 유지된 결과 파일)
```

템플릿은 **Excel에서 직접 작성**합니다. 셀에 변수를 넣고, 저장하고,
xl3를 실행하면 됩니다. 매크로도, 숨겨진 스크립트도, 벤더 클라우드도 필요하지
않습니다.

Excel 사용자는 문서를 설계하고, 개발자는 데이터 흐름을 자동화합니다.

## 간단한 예시

템플릿에는 일반 Excel 내용과 xl3 표현식을 함께 넣을 수 있습니다.

| 셀 | 템플릿 값 |
|---|---|
| A1 | `Customer` |
| B1 | `Amount` |
| A2 | `{{ [Customer] }}` |
| B2 | `{{ TEXT([Amount], "#,##0.00") }}` |

데이터 Excel 파일이 다음과 같다면:

| Customer | Amount |
|---|---:|
| Acme | 1200 |
| Beta | 350 |

xl3는 다음 결과를 렌더링합니다.

| Customer | Amount |
|---|---:|
| Acme | 1,200.00 |
| Beta | 350.00 |

출력은 여전히 `.xlsx` 파일입니다. 템플릿의 서식, 숫자 형식, 병합 셀은
우연히 따라오는 부가 요소가 아니라 결과의 일부로 취급됩니다.

언어 초안은 [`spec/`](./spec)에 있고, 구현 중립적인 fixture corpus와 runner
protocol은 [`conformance/`](./conformance)에 있습니다.

## 왜 xl3가 필요한가요?

많은 보고 업무는 이미 스프레드시트 안에 있습니다. 보고서 양식, 인보이스,
정산서, 데이터 export, 내부 운영용 템플릿이 모두 Excel로 돌아갑니다. xl3는
이 작성 방식을 그대로 유지합니다. 스프레드시트는 템플릿으로 남고, 변환 규칙은
명시적이고 결정적이며 테스트 가능한 형태가 됩니다.

목표는 Excel을 코드로 대체하는 것이 아닙니다. Excel을 작성 도구로 유지하면서,
반복적인 데이터 채우기 작업을 작고 검증 가능한 템플릿 언어로 옮기는 것입니다.

## xl3가 강조하는 것

- **Excel in, Excel out.** 템플릿과 원본 데이터가 모두 `.xlsx` 파일입니다.
- **템플릿은 실제 스프레드시트입니다.** 레이아웃과 서식은 workbook 안에 남습니다.
- **서식도 계약의 일부입니다.** 스타일, 숫자 형식, 병합 셀은 Stage 2 conformance
  테스트로 검증됩니다.
- **매크로가 없습니다.** 템플릿 동작은 명시적인 셀 표현식으로 표현됩니다.
- **conformance로 검증됩니다.** TypeScript reference implementation은 현재
  Stage 2 OOXML 비교를 포함한 XTL 0.1 fixture corpus를 통과합니다.

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
