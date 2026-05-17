import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import clsx from 'clsx';
import { CodeCard } from '@site/src/components/CodeCard';
import { ExcelPreview, ExcelPreviewFrame } from '@site/src/components/ExcelPreview';
import type { Workbook } from '@site/src/components/ExcelPreview';
import styles from '@site/src/pages/index.module.css';

const CONFIG_PREVIEW_KO: Workbook = {
  kind: '__config__',
  title: '템플릿이 원본 데이터의 형태를 정의합니다.',
  note: 'source_table 이 원본 테이블의 시작 위치와 사용할 컬럼 범위를 엔진에 알려줍니다.',
  workbookTitle: 'template.xlsx',
  workbookSubtitle: '변환 규칙이 들어 있는 엑셀 파일',
  formula: 'B2  source_table = 1',
  sheetName: '__config__',
  rows: [
    ['key', 'value', 'notes'],
    ['source_sheet', 'Raw', 'worksheet to read'],
    ['source_table', '1', 'column names and data rows'],
  ],
  classes: [
    ['header', 'header', 'header'],
    ['', 'selected currency', ''],
    ['', 'currency', ''],
  ],
};

function Hero() {
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className={clsx('container', styles.heroLayout)}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>엑셀 안에서, 엑셀 문법으로 · 규칙은 엑셀 파일에</p>
          <h1 className={styles.heroTitle}>엑셀 변환은 엑셀 안에서 끝납니다.</h1>
          <p className={styles.heroLead}>
            xl3 는 변환 규칙을 코드가 아니라 <code>template.xlsx</code> 안에
            담아둡니다. 비개발자도 직접 열어 수정할 수 있습니다 — 평소 쓰던{' '}
            <code>IF</code>, <code>SUM</code>, 컬럼 참조 문법 그대로니까요.
          </p>
          <div className={styles.heroLinks}>
            <Link className="button button--primary button--lg" to="/ko/try">
              브라우저에서 바로 써보기
            </Link>
            <Link className="button button--secondary button--lg" to="#walkthrough">
              워크플로 살펴보기
            </Link>
            <Link
              className="button button--secondary button--lg"
              href="https://github.com/jinyoung4478/xl3"
            >
              GitHub
            </Link>
            <Link
              className="button button--secondary button--lg"
              href="https://www.npmjs.com/package/@jinyoung4478/xl3"
            >
              npm
            </Link>
          </div>
        </div>
        <aside className={styles.flowPanel} aria-label="xl3 워크플로">
          <div className={styles.flowRole}>
            <span>개발자</span>
            <strong>엔진은 한 번만 만들면 됩니다</strong>
          </div>
          <div className={styles.flowStack}>
            <div className={styles.flowFile}>
              <span>raw.xlsx</span>
              <small>운영팀이 보낸 원본 데이터</small>
            </div>
            <div className={styles.flowPlus}>+</div>
            <div className={styles.flowFile}>
              <span>template.xlsx</span>
              <small>업무 규칙이 담긴 템플릿</small>
            </div>
            <div className={styles.flowArrow}>↓</div>
            <div className={styles.flowResult}>
              <span>완성된 엑셀 파일</span>
              <small>운영팀이 그대로 다운로드</small>
            </div>
          </div>
          <code>convert(template, raw)</code>
        </aside>
      </div>
    </header>
  );
}

const WALKTHROUGH_STEPS = [
  { index: '01', title: '엑셀 안에서 변환 규칙을 정의', body: '__config__, source_table, XTL 표현식으로 원본 엑셀이 어떻게 결과 보고서가 되는지 적어둡니다.' },
  { index: '02', title: '업로드 흐름은 단순하게', body: '운영팀은 원본 엑셀을 올리고, 승인된 템플릿을 고르고, 변환을 실행합니다. 그것뿐입니다.' },
  { index: '03', title: '결과는 완성된 엑셀로', body: '시트 구조, 숫자 형식, 스타일, 병합 셀까지 그대로 유지된 채 데이터만 채워진 엑셀이 나옵니다.' },
  { index: '04', title: '업무 규칙을 파일로 보관', body: '템플릿이 곧 인수인계 자산이 됩니다. 매번 반복되는 엑셀 업무가 어떻게 동작하는지 한 파일에 정리되어 다음 담당자에게 그대로 넘어갑니다.' },
] as const;

function Walkthrough() {
  return (
    <section id="walkthrough" className={styles.walkthrough}>
      <div className="container">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>워크플로 모델</p>
          <h2 className={styles.sectionTitle}>엔진은 코드에, 업무 규칙은 엑셀 파일에.</h2>
          <p>
            개발자는 변환 엔진을 한 번만 만듭니다. 매번 바뀌는 업무 규칙, 원본
            테이블 매핑, 레이아웃, 결과물의 모양은 팀이 보관하고 인수인계할 수
            있는 엑셀 파일 안에 남습니다.
          </p>
        </div>
        <div className={styles.walkthroughLayout}>
          <div className={styles.stepsGrid}>
            {WALKTHROUGH_STEPS.map((s) => (
              <article key={s.index} className={styles.stepCard}>
                <span className={styles.stepIndex}>{s.index}</span>
                <div>
                  <h3 className={styles.stepTitle}>{s.title}</h3>
                  <p className={styles.stepBody}>{s.body}</p>
                </div>
              </article>
            ))}
          </div>
          <div className={styles.previewColumn}>
            <ExcelPreviewFrame
              kind={CONFIG_PREVIEW_KO.kind}
              title={CONFIG_PREVIEW_KO.title}
              note={CONFIG_PREVIEW_KO.note}
            >
              <ExcelPreview workbook={CONFIG_PREVIEW_KO} />
            </ExcelPreviewFrame>
          </div>
        </div>
      </div>
    </section>
  );
}

function Handoff() {
  return (
    <section id="standard" className={styles.handoff}>
      <div className="container">
        <div className={styles.narrativeGrid}>
          <div>
            <p className={styles.kicker}>왜 개발자가 xl3 를 선택하나</p>
            <h2 className={styles.sectionTitle}>반복되는 보고 업무를 일회성 스크립트에서 꺼내옵니다.</h2>
          </div>
          <div className={styles.prose}>
            <p>
              파이썬 스크립트, VBA 매크로, 서비스별 자동화 도구로도 엑셀 업무를
              자동화할 수는 있습니다. 다만 그 과정에서 업무 규칙이 코드 안,
              SaaS 계정, 담당자 머릿속으로 흩어지는 경우가 많습니다.
            </p>
            <p>
              xl3 는 재사용 가능한 엔진과 엑셀 파일별 업무 약속을 분리합니다.
              개발자는 TypeScript 통합과 배포를 관리하고, 매번 바뀌는 엑셀 업무
              규칙은 각 템플릿 엑셀 파일 안에 머무릅니다.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const RELIABILITY_CARDS = [
  { title: '인수인계 가능한 템플릿', body: '업무 규칙이 엑셀 파일 안에 담겨 있어 검토, 버전 관리, 보관, 다음 담당자에게 넘기는 일까지 한 파일로 해결됩니다.', tag: 'template.xlsx' },
  { title: '운영자가 다루기 편한 실행', body: '런타임을 브라우저 페이지로 그대로 노출할 수 있습니다. 원본 데이터 업로드, 템플릿 선택, 결과 다운로드 — 코드를 읽지 않아도 됩니다.', tag: 'raw.xlsx → result.xlsx' },
  { title: '엔진은 개발자가 책임', body: '배포, 검증, 통합은 코드에서. 템플릿별 업무 규칙은 엑셀 파일에. 두 영역의 경계가 명확합니다.', tag: 'convert(template, raw)' },
] as const;

const COMPARISONS: Array<{ tool: string; bestAt: string; tradeoff: string }> = [
  {
    tool: 'xl3',
    bestAt: '파일 기반 엑셀 변환. 업무 규칙은 template.xlsx 안에 머뭅니다.',
    tradeoff: 'Alpha 단계입니다. XTL 언어 표면은 의도적으로 작게 유지하며 아직 다듬는 중입니다.',
  },
  {
    tool: '파이썬 / VBA 스크립트',
    bestAt: '기존 스프레드시트와 가까운 빠른 일회성 자동화.',
    tradeoff: '규칙이 코드나 한 담당자의 기억에 남기 쉬워 검토와 인수인계가 어렵습니다.',
  },
  {
    tool: 'Power Query / Office Scripts',
    bestAt: 'Microsoft 365 워크플로, 엑셀 생태계 안에서의 데이터 가공.',
    tradeoff: '자동화가 테넌트와 계정에 묶여 어디서든 열 수 있는 엑셀 파일 형태로 남기 어렵습니다.',
  },
  {
    tool: '스프레드시트 SDK (SheetJS, ExcelJS, Aspose)',
    bestAt: '저수준 또는 풀-기능 코드 기반 엑셀 파일 생성.',
    tradeoff: '보고서별 규칙을 결국 애플리케이션 코드 안에 직접 넣게 됩니다.',
  },
  {
    tool: '템플릿 엔진 (JXLS, xltpl)',
    bestAt: '스프레드시트형 템플릿 기반의 서버 사이드 보고서 생성.',
    tradeoff: '특정 언어와 런타임에 묶이는 경우가 많고, 운영자 흐름이 메인 제품 형태는 아닙니다.',
  },
  {
    tool: '문서 생성 SaaS (Plumsail, Conga)',
    bestAt: '관리형 문서 워크플로, 외부 통합, 결재 프로세스.',
    tradeoff: '규칙이 vendor 서비스 안에 남고, 자체 호스팅 가능한 포터블 템플릿이 아닙니다.',
  },
  {
    tool: 'LLM 기반 스프레드시트 생성',
    bestAt: '일회성 탐색과 초안 만들기.',
    tradeoff: '반복되는 운영 업무를 위한 결정적 변환 계약으로 쓰기에는 부적합합니다.',
  },
];

function Comparison() {
  return (
    <section id="compare" className={styles.comparison}>
      <div className="container">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>비교</p>
          <h2 className={styles.sectionTitle}>같은 문제, 다른 접근.</h2>
        </div>
        <div className={styles.comparisonTable}>
          <table>
            <thead>
              <tr>
                <th>접근</th>
                <th>잘하는 영역</th>
                <th>대신 잃는 것</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISONS.map((c) => (
                <tr key={c.tool}>
                  <td><strong>{c.tool}</strong></td>
                  <td>{c.bestAt}</td>
                  <td>{c.tradeoff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Reliability() {
  return (
    <section id="conformance" className={styles.reliability}>
      <div className="container">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>운영 환경 적합성</p>
          <h2 className={styles.sectionTitle}>자동화보다 인수인계를 먼저 생각한 설계.</h2>
          <p>
            업무를 실제로 굴리는 사람은 코드를 읽지 않아도 됩니다. 안정적인
            변환 엔진, 승인된 템플릿, 예측 가능한 결과 엑셀 파일이면 충분합니다.
          </p>
        </div>
        <div className={styles.stageGrid}>
          {RELIABILITY_CARDS.map((c) => (
            <article key={c.title} className={styles.stageCard}>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
              <code>{c.tag}</code>
            </article>
          ))}
        </div>
        <p className={styles.conformanceFact}>
          XTL 0.1 은 <strong>ADR 37 개</strong>, <strong>conformance fixture 123 개</strong>를
          포함하며 Stage 2 까지 모두 통과합니다. TypeScript 레퍼런스 구현은{' '}
          <a href="https://www.npmjs.com/package/@jinyoung4478/xl3">@jinyoung4478/xl3</a>로
          공개되어 있습니다 — 다른 언어로의 포팅은{' '}
          <Link to="/porters-guide">Porter&apos;s Guide</Link>를 참고하세요.
        </p>
      </div>
    </section>
  );
}

function DeveloperApi() {
  return (
    <section id="api" className={styles.api}>
      <div className="container">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>개발자 API</p>
          <h2 className={styles.sectionTitle}>같은 워크플로를 제품에 그대로 붙입니다.</h2>
          <p>
            데모의 흐름을 그대로 내부 포털, CLI, 서비스 엔드포인트로 옮길 때
            패키지를 가져다 씁니다. 운영자 입장은 파일 기반으로 그대로 두고,
            애플리케이션이 배포와 검증을 책임집니다.
          </p>
        </div>
        <div className={styles.codePair}>
          <CodeCard
            name="terminal"
            lines={[
              [
                { kind: 'prompt', text: '$' },
                { kind: 'fn', text: 'npm' },
                { kind: 'plain', text: ' ' },
                { kind: 'kw', text: 'install' },
                { kind: 'plain', text: ' ' },
                { kind: 'var', text: '@jinyoung4478/xl3' },
              ],
            ]}
          />
          <CodeCard
            name="example.ts"
            lines={[
              [
                { kind: 'kw', text: 'import' },
                { kind: 'plain', text: ' { ' },
                { kind: 'var', text: 'convert' },
                { kind: 'plain', text: ' } ' },
                { kind: 'kw', text: 'from' },
                { kind: 'plain', text: ' ' },
                { kind: 'string', text: "'@jinyoung4478/xl3'" },
                { kind: 'plain', text: ';' },
              ],
              [{ kind: 'plain', text: '' }],
              [
                { kind: 'kw', text: 'const' },
                { kind: 'plain', text: ' ' },
                { kind: 'const', text: 'outputs' },
                { kind: 'plain', text: ' = ' },
                { kind: 'kw', text: 'await' },
                { kind: 'plain', text: ' ' },
                { kind: 'fn', text: 'convert' },
                { kind: 'plain', text: '(' },
                { kind: 'var', text: 'templateBuffer' },
                { kind: 'plain', text: ', ' },
                { kind: 'var', text: 'dataBuffer' },
                { kind: 'plain', text: ');' },
              ],
              [{ kind: 'comment', text: '// OutputFile[] → 형식이 적용된 .xlsx 결과들' }],
            ]}
          />
        </div>
        <p className={styles.apiCta}>
          <Link to="/guides/getting-started">Cookbook 01 — 5 분 시작하기</Link>
          {' · '}
          <Link to="/spec/">Spec 읽기</Link>
          {' · '}
          <Link to="/porters-guide">Porter&apos;s Guide</Link>
        </p>
      </div>
    </section>
  );
}

export default function HomeKo() {
  return (
    <Layout
      title="xl3 — 엑셀 변환은 엑셀 안에서"
      description="xl3 는 엑셀 변환 규칙을 코드가 아니라 엑셀 파일 안에 담아둡니다. 비개발자도 평소 쓰던 엑셀 문법 그대로 변환 규칙을 직접 열어 보고 고칠 수 있습니다."
    >
      <Hero />
      <main>
        <Walkthrough />
        <Handoff />
        <Reliability />
        <Comparison />
        <DeveloperApi />
      </main>
    </Layout>
  );
}
