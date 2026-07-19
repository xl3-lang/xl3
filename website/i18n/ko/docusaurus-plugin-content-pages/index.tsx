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
  title: '엑셀 파일 자체가 실행 계약입니다.',
  note: 'source_table 은 원본 테이블 위치를 알려주고, XTL 셀은 그 데이터를 어떻게 변환할지 선언합니다.',
  workbookTitle: 'template.xlsx',
  workbookSubtitle: '실행 가능한 엑셀 템플릿',
  formula: 'B2  source_table = 1',
  sheetName: '__config__',
  rows: [
    ['키', '값', '메모'],
    ['source_sheet', '원본', '읽어 들일 워크시트'],
    ['source_table', '1', '컬럼명과 데이터 행 위치'],
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
          <p className={styles.kicker}>선언형 엑셀 템플릿 · 결정적 실행</p>
          <h1 className={styles.heroTitle}>엑셀을 실행 가능한 템플릿으로.</h1>
          <p className={styles.heroLead}>
            xl3 는 워크북을 코드로 그리는 API가 아닙니다. 변환 규칙을{' '}
            <code>template.xlsx</code> 안에 두고, <code>raw.xlsx</code> 데이터를
            넣어 같은 입력에서 같은 결과 워크북을 생성하는 실행 엔진입니다.
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
              href="https://github.com/xl3-lang/xl3"
            >
              GitHub
            </Link>
            <Link
              className="button button--secondary button--lg"
              href="https://www.npmjs.com/package/@xl3-lang/xl3"
            >
              npm
            </Link>
          </div>
        </div>
        <aside className={styles.flowPanel} aria-label="xl3 워크플로">
          <div className={styles.flowRole}>
            <span>개발자</span>
            <strong>데이터와 배포를 책임집니다</strong>
          </div>
          <div className={styles.flowStack}>
            <div className={styles.flowFile}>
              <span>raw.xlsx</span>
              <small>운영팀이 보낸 원본 데이터</small>
            </div>
            <div className={styles.flowPlus}>+</div>
            <div className={styles.flowFile}>
              <span>template.xlsx</span>
              <small>실행 가능한 변환 규칙</small>
            </div>
            <div className={styles.flowArrow}>↓</div>
            <div className={styles.flowResult}>
              <span>완성된 엑셀 파일</span>
              <small>운영팀에 전달</small>
            </div>
          </div>
          <code>convert(template, raw)</code>
        </aside>
      </div>
    </header>
  );
}

const WALKTHROUGH_STEPS = [
  { index: '01', title: '엑셀에서 워크북을 디자인', body: '레이아웃, 병합 셀, 숫자 형식, 라벨은 실무자가 이미 수정하는 엑셀 안에 그대로 둡니다.' },
  { index: '02', title: '변환 규칙을 선언', body: '__config__, source_table, XTL 표현식으로 무엇을 반복하고, 필터링하고, 그룹화하고, 출력할지 적습니다.' },
  { index: '03', title: '원본 데이터로 실행', body: '엔진은 template.xlsx 와 raw.xlsx 를 순수 함수처럼 결합해 매번 같은 결과 워크북을 만듭니다.' },
  { index: '04', title: '템플릿을 인수인계', body: '템플릿이 곧 업무 계약입니다. 반복되는 엑셀 업무가 어떻게 동작하는지 한 파일에 남아 다음 담당자에게 그대로 넘어갑니다.' },
] as const;

function Walkthrough() {
  return (
    <section id="walkthrough" className={styles.walkthrough}>
      <div className="container">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>워크플로 모델</p>
          <h2 className={styles.sectionTitle}>Excel은 View, Data는 Model, xl3는 실행 엔진.</h2>
          <p>
            개발자는 데이터, 검증, 배포를 한 번 연결합니다. 반복되는 레이아웃과
            업무 규칙은 팀이 검토하고 버전 관리하고 인수인계할 수 있는 평범한
            엑셀 파일 안에 남습니다.
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
            <h2 className={styles.sectionTitle}>보고서 레이아웃을 일회성 스크립트에 묶지 않습니다.</h2>
          </div>
          <div className={styles.prose}>
            <p>
              ExcelJS, SheetJS, openpyxl, Apache POI 는 훌륭한 워크북 API입니다.
              하지만 보고서 레이아웃, 스타일, 병합 셀, 반복 규칙이 코드 안에
              들어가면 작은 디자인 변경도 배포가 됩니다.
            </p>
            <p>
              xl3 는 반복되는 업무 계약을 다시 엑셀 파일로 옮깁니다. 워크북은
              이미 View이고, XTL은 그 View를 실행 가능하게 만듭니다. 애플리케이션은
              데이터만 공급하고 엔진을 실행하면 됩니다.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const RESPONSIBILITY_CARDS = [
  {
    title: '개발자',
    body: '엔진 동작, 검증, 통합, 배포, 안정성 같은 Runtime 영역을 책임집니다.',
    tag: 'runtime',
  },
  {
    title: '운영자',
    body: '레이아웃, 컬럼, 반복 규칙, 출력 형식, 문서별 변환 로직을 템플릿 안에서 관리합니다.',
    tag: 'template.xlsx',
  },
  {
    title: '비즈니스',
    body: '반복 문서 변경이 매번 배포가 되기를 기다리지 않고 완성된 결과를 사용합니다.',
    tag: 'result.xlsx',
  },
] as const;

function Responsibility() {
  return (
    <section className={styles.responsibility}>
      <div className="container">
        <div className={styles.narrativeGrid}>
          <div>
            <p className={styles.kicker}>책임 중심 문서 자동화</p>
            <h2 className={styles.sectionTitle}>문서 자동화의 소유권을 배포 대기열 밖으로 옮깁니다.</h2>
          </div>
          <div className={styles.prose}>
            <p>
              대부분의 엑셀 자동화 도구는 개발자를 더 빠르게 만드는 데 집중합니다.
              xl3 는 다른 문제를 풉니다. 개발자가 처리하던 반복 문서 변경을
              운영자가 직접 맡을 수 있게 만듭니다.
            </p>
            <p>
              실제 운영에서는 개발자가 Runtime 개선에 집중하고, 운영 인력이
              템플릿과 변환 규칙을 엑셀 안에서 직접 관리하는 모델이 자리 잡았습니다.
              xl3 가 줄이는 것은 코드의 양만이 아니라 개발자가 반드시 해야 하는
              업무의 양입니다.
            </p>
          </div>
        </div>
        <div className={styles.stageGrid}>
          {RESPONSIBILITY_CARDS.map((c) => (
            <article key={c.title} className={styles.stageCard}>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
              <code>{c.tag}</code>
            </article>
          ))}
        </div>
        <p className={styles.conformanceFact}>
          xl3 는 개발자를 대체하려는 프로젝트가 아닙니다. 개발자는 Runtime을
          만들고, 운영자는 Template를 관리합니다. 문서 자동화가 개발자의 전유물에서
          조직 전체의 역량으로 확장됩니다.
        </p>
      </div>
    </section>
  );
}

const RELIABILITY_CARDS = [
  { title: '계약으로서의 템플릿', body: '업무 규칙이 엑셀 파일 안에 담겨 있어 검토, 버전 관리, 보관, 다음 담당자에게 넘기는 일까지 한 파일로 해결됩니다.', tag: 'template.xlsx' },
  { title: '운영자가 다루기 편한 실행', body: '런타임을 브라우저 페이지로 그대로 노출할 수 있습니다. 원본 데이터 업로드, 템플릿 선택, 결과 다운로드 — 코드를 읽지 않아도 됩니다.', tag: 'raw.xlsx → result.xlsx' },
  { title: '런타임은 개발자가 책임', body: '배포, 검증, 통합은 코드에서. 템플릿별 업무 규칙은 엑셀 파일에. 두 영역의 경계가 명확합니다.', tag: 'convert(template, raw)' },
] as const;

const COMPARISONS: Array<{ tool: string; bestAt: string; tradeoff: string }> = [
  {
    tool: 'xl3',
    bestAt: '선언형 엑셀 템플릿 실행. 워크북은 이미 존재하고, xl3 는 데이터를 넣어 실행합니다.',
    tradeoff: 'Alpha 단계입니다. XTL 언어 표면은 의도적으로 작게 유지하며 아직 다듬는 중입니다.',
  },
  {
    tool: '파이썬 / VBA 스크립트',
    bestAt: '기존 스프레드시트와 가까운 빠른 일회성 자동화.',
    tradeoff: '규칙이 코드나 한 담당자의 기억에 남기 쉽고, 레이아웃 변경도 코드 변경이 됩니다.',
  },
  {
    tool: 'Power Query / Office Scripts',
    bestAt: 'Microsoft 365 워크플로, 엑셀 생태계 안에서의 데이터 가공.',
    tradeoff: '자동화가 테넌트와 계정에 묶여 어디서든 열 수 있는 엑셀 파일 형태로 남기 어렵습니다.',
  },
  {
    tool: '워크북 API (ExcelJS, SheetJS, openpyxl, POI)',
    bestAt: '애플리케이션 코드에서 저수준 또는 풀-기능 엑셀 파일 생성.',
    tradeoff: '레이아웃, 스타일, 병합, 반복, 업무 규칙이 모두 코드가 되어 비개발자가 안전하게 수정하기 어렵습니다.',
  },
  {
    tool: '템플릿 엔진 (JXLS, xltpl)',
    bestAt: '스프레드시트형 템플릿 기반의 서버 사이드 보고서 생성.',
    tradeoff: '유용한 선행 사례지만 특정 런타임에 묶이기 쉽고, 작은 포터블 엑셀 규칙 포맷으로 포지셔닝되어 있지는 않습니다.',
  },
  {
    tool: '문서 생성 SaaS (Plumsail, Conga)',
    bestAt: '관리형 문서 워크플로, 외부 통합, 결재 프로세스.',
    tradeoff: '규칙이 vendor 서비스 안에 남고, 직접 검토하고 실행할 수 있는 포터블 엑셀 템플릿이 아닙니다.',
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
          <p className={styles.kicker}>왜 동작하는가</p>
          <h2 className={styles.sectionTitle}>선언형, 결정적, 의도적으로 작은 언어.</h2>
          <p>
            사용자는 모든 셀을 어떻게 만들지 명령하지 않고, 워크북이 무엇을
            해야 하는지 선언합니다. XTL 표면은 작게 유지되어 사람이 읽기 쉽고,
            AI가 초안을 만들기도 쉽습니다.
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
          XTL 0.1 은 <strong>ADR 70 개</strong>, <strong>conformance fixture 154 개</strong>를
          포함하며 Stage 2 까지 모두 통과합니다. TypeScript 레퍼런스 구현은{' '}
          <a href="https://www.npmjs.com/package/@xl3-lang/xl3">@xl3-lang/xl3</a>로
          공개되어 있습니다 — 다른 언어로의 포팅은{' '}
          <Link to="/porters-guide">포팅 가이드 (영문)</Link>를 참고하세요.
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
                { kind: 'var', text: '@xl3-lang/xl3' },
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
                { kind: 'string', text: "'@xl3-lang/xl3'" },
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
          <Link to="/guides/getting-started">레시피 01 — 5분 시작하기</Link>
          {' · '}
          <Link to="/spec/">명세 읽기 (영문)</Link>
          {' · '}
          <Link to="/porters-guide">포팅 가이드 (영문)</Link>
        </p>
      </div>
    </section>
  );
}

export default function HomeKo() {
  return (
    <Layout
      title="엑셀 선언형 템플릿 엔진"
      description="엑셀 파일에 변환 규칙을 담고 데이터와 함께 실행해 같은 워크북을 생성합니다."
    >
      <Hero />
      <main>
        <Walkthrough />
        <Handoff />
        <Responsibility />
        <Reliability />
        <Comparison />
        <DeveloperApi />
      </main>
    </Layout>
  );
}
