import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import clsx from 'clsx';
import { CodeCard } from '@site/src/components/CodeCard';
import { ExcelPreview, ExcelPreviewFrame } from '@site/src/components/ExcelPreview';
import type { Workbook } from '@site/src/components/ExcelPreview';
import styles from '../index.module.css';

const CONFIG_PREVIEW_KO: Workbook = {
  kind: '__config__',
  title: '템플릿이 원본 데이터의 모양을 지정합니다.',
  note: 'source_table이 원본 테이블의 시작 위치와 포함할 컬럼을 엔진에 알려줍니다.',
  workbookTitle: 'template.xlsx',
  workbookSubtitle: '업무 규칙이 들어 있는 엑셀 파일',
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
          <p className={styles.kicker}>엑셀에서 엑셀로 · 규칙은 엑셀 파일 안에</p>
          <h1 className={styles.heroTitle}>Excel 변환 로직은 Excel 파일 안에 산다.</h1>
          <p className={styles.heroLead}>
            xl3는 변환 규칙을 코드가 아니라 <code>template.xlsx</code> 안에
            넣습니다. 비개발자도 직접 열어 고칠 수 있습니다 — 평소 쓰던{' '}
            <code>IF</code>, <code>SUM</code>, 컬럼 참조 문법 그대로니까요.
          </p>
          <div className={styles.heroLinks}>
            <Link className="button button--primary button--lg" to="/ko/converter">
              브라우저에서 시도하기
            </Link>
            <Link className="button button--secondary button--lg" to="#walkthrough">
              워크플로우 보기
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
        <aside className={styles.flowPanel} aria-label="xl3 워크플로우">
          <div className={styles.flowRole}>
            <span>개발자</span>
            <strong>엔진을 한 번 정의</strong>
          </div>
          <div className={styles.flowStack}>
            <div className={styles.flowFile}>
              <span>raw.xlsx</span>
              <small>운영자 데이터</small>
            </div>
            <div className={styles.flowPlus}>+</div>
            <div className={styles.flowFile}>
              <span>template.xlsx</span>
              <small>아카이빙된 규칙</small>
            </div>
            <div className={styles.flowArrow}>↓</div>
            <div className={styles.flowResult}>
              <span>완성된 엑셀 파일</span>
              <small>운영자가 다운로드</small>
            </div>
          </div>
          <code>convert(template, raw)</code>
        </aside>
      </div>
    </header>
  );
}

const WALKTHROUGH_STEPS = [
  { index: '01', title: 'Excel 안에서 contract 정의', body: '__config__, source_table, XTL 표현식으로 raw 엑셀이 어떻게 보고서가 되는지 정의합니다.' },
  { index: '02', title: '단순한 업로드 흐름 노출', body: '비개발자가 raw 엑셀 파일과 승인된 템플릿을 선택하고 변환기를 실행합니다.' },
  { index: '03', title: '완성된 엑셀 파일 생성', body: '결과는 시트 구조, 숫자 형식, 스타일, 병합 셀까지 유지하면서 값만 데이터에서 렌더링됩니다.' },
  { index: '04', title: '업무 규칙 아카이빙', body: '템플릿이 인수인계 산출물이 됩니다. 반복되는 엑셀 업무가 어떻게 동작하는지 담긴 포터블 파일입니다.' },
] as const;

function Walkthrough() {
  return (
    <section id="walkthrough" className={styles.walkthrough}>
      <div className="container">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>워크플로우 모델</p>
          <h2 className={styles.sectionTitle}>엔진은 코드에, 워크플로우는 엑셀 파일에.</h2>
          <p>
            개발자는 변환기를 한 번만 만듭니다. 반복되는 업무 규칙, source
            테이블 매핑, 레이아웃, 출력 모양은 팀이 아카이빙하고 인수인계할 수
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
            <p className={styles.kicker}>왜 개발자가 xl3를 쓰나</p>
            <h2 className={styles.sectionTitle}>반복 보고 업무를 일회성 스크립트에서 꺼내기.</h2>
          </div>
          <div className={styles.prose}>
            <p>
              Python 스크립트, VBA 매크로, 서비스별 자동화는 엑셀 업무를
              자동화할 수 있습니다. 하지만 비즈니스 규칙은 코드, 계정, 담당자의
              기억에 흩어지는 경우가 많습니다.
            </p>
            <p>
              xl3는 재사용 가능한 엔진과 엑셀 파일별 contract를 분리합니다.
              개발자는 TypeScript 통합을 관리하고, 반복되는 엑셀 업무는 각각의
              템플릿 엑셀 파일로 이동합니다.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const RELIABILITY_CARDS = [
  { title: '인수인계 산출물로서의 템플릿', body: '보고 규칙이 엑셀 파일 안에 살아 있어서 검토, 버전 관리, 아카이빙, 다음 담당자에게 인계가 모두 됩니다.', tag: 'template.xlsx' },
  { title: '운영자 친화적인 실행', body: '런타임은 브라우저 페이지로 노출할 수 있습니다. raw 데이터 업로드, 템플릿 선택, 결과 다운로드.', tag: 'raw.xlsx → result.xlsx' },
  { title: '개발자가 소유하는 엔진', body: '배포, 검증, 통합은 코드에서. 템플릿별 업무 규칙은 엑셀에 남습니다.', tag: 'convert(template, raw)' },
] as const;

const COMPARISONS: Array<{ tool: string; bestAt: string; tradeoff: string }> = [
  {
    tool: 'xl3',
    bestAt: '파일 기반 Excel 변환. 업무 규칙은 template.xlsx 안에 남습니다.',
    tradeoff: 'Alpha입니다. XTL surface는 의도적으로 작고 아직 진화 중입니다.',
  },
  {
    tool: 'Python / VBA 스크립트',
    bestAt: '기존 스프레드시트에 가까운 빠른 일회성 자동화.',
    tradeoff: '규칙이 코드나 한 담당자의 기억에 남아 검토와 인수인계가 어렵습니다.',
  },
  {
    tool: 'Power Query / Office Scripts',
    bestAt: 'Microsoft 365 워크플로우, Excel 생태계 안의 데이터 정리.',
    tradeoff: '자동화가 tenant/계정에 묶여 포터블한 엑셀 파일 형태로 남기 어렵습니다.',
  },
  {
    tool: 'Spreadsheet SDK (SheetJS, ExcelJS, Aspose)',
    bestAt: '저수준 또는 고기능 프로그래밍 방식의 엑셀 파일 생성.',
    tradeoff: '보고서별 규칙을 개발자가 application code 안에 직접 넣게 됩니다.',
  },
  {
    tool: 'Template engine (JXLS, xltpl)',
    bestAt: '스프레드시트형 템플릿 기반 서버사이드 보고서 생성.',
    tradeoff: '언어/runtime에 묶이는 경우가 많고, 운영자 흐름이 중심 제품 형태는 아닙니다.',
  },
  {
    tool: '문서 생성 SaaS (Plumsail, Conga)',
    bestAt: '관리형 문서 워크플로우, integration, approval.',
    tradeoff: '규칙이 vendor service 안에 남고, 포터블한 self-host 템플릿이 아닙니다.',
  },
  {
    tool: 'LLM 기반 spreadsheet 생성',
    bestAt: '일회성 탐색과 초안 생성.',
    tradeoff: '반복 운영 업무를 위한 결정적 변환 계약으로 쓰기 어렵습니다.',
  },
];

function Comparison() {
  return (
    <section id="compare" className={styles.comparison}>
      <div className="container">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>비교</p>
          <h2 className={styles.sectionTitle}>같은 문제, 다른 모양.</h2>
        </div>
        <div className={styles.comparisonTable}>
          <table>
            <thead>
              <tr>
                <th>접근</th>
                <th>잘하는 것</th>
                <th>tradeoff</th>
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
          <p className={styles.kicker}>운영 적합성</p>
          <h2 className={styles.sectionTitle}>자동화가 아니라 인수인계를 위해 설계.</h2>
          <p>
            업무를 실제로 돌리는 사람은 코드를 읽지 않아도 되어야 합니다.
            안정적인 변환기, 승인된 템플릿, 예측 가능한 결과 엑셀 파일이
            필요합니다.
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
          XTL 0.1은 <strong>ADR 32개</strong>, <strong>conformance fixture 119개</strong>를
          포함하며 Stage 2 전부 green입니다. TypeScript reference implementation은{' '}
          <a href="https://www.npmjs.com/package/@jinyoung4478/xl3">@jinyoung4478/xl3</a>로
          공개되어 있습니다 — 다른 언어로의 포팅은{' '}
          <Link to="/PORTERS_GUIDE">Porter&apos;s Guide</Link>를 참고하세요.
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
          <p className={styles.kicker}>Developer API</p>
          <h2 className={styles.sectionTitle}>같은 워크플로우를 제품에 연결하기.</h2>
          <p>
            데모 흐름을 내부 포털, CLI, 서비스 엔드포인트로 만들 때 패키지를
            사용합니다. 운영자 경험은 파일 기반으로 유지하면서, 앱은 배포와
            검증을 책임집니다.
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
              [{ kind: 'comment', text: '// OutputFile[] → 포맷된 .xlsx 결과' }],
            ]}
          />
        </div>
        <p className={styles.apiCta}>
          <Link to="/cookbook/getting-started">Cookbook 01 — 5분 시작하기</Link>
          {' · '}
          <Link to="/spec/">Spec 읽기</Link>
          {' · '}
          <Link to="/PORTERS_GUIDE">Porter&apos;s Guide</Link>
        </p>
      </div>
    </section>
  );
}

export default function HomeKo() {
  return (
    <Layout
      title="xl3 — Excel 변환 로직은 Excel 파일 안에 산다"
      description="xl3는 Excel 변환 로직을 코드가 아니라 Excel 파일 안에 넣습니다. 비개발자도 평소 쓰던 Excel 문법 그대로 변환 규칙을 직접 열어 보고 고칠 수 있습니다."
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
