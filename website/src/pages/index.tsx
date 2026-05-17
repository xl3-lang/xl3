import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import clsx from 'clsx';
import { CodeCard } from '@site/src/components/CodeCard';
import { ExcelPreview, ExcelPreviewFrame } from '@site/src/components/ExcelPreview';
import type { Workbook } from '@site/src/components/ExcelPreview';
import styles from './index.module.css';

const CONFIG_PREVIEW: Workbook = {
  kind: '__config__',
  title: 'The template declares the source shape.',
  note: 'source_table tells the engine where the raw table starts and which columns belong to it.',
  workbookTitle: 'template.xlsx',
  workbookSubtitle: 'workbook with transformation rules',
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
          <p className={styles.kicker}>Excel-to-Excel · logic stays in the workbook</p>
          <h1 className={styles.heroTitle}>Excel transformation logic, inside the Excel file.</h1>
          <p className={styles.heroLead}>
            xl3 puts the transformation rules inside <code>template.xlsx</code>,
            not in code. Non-developers can open it and edit the rules
            directly — they are written with the same <code>IF</code>,{' '}
            <code>SUM</code>, and column references they already use day to day.
          </p>
          <div className={styles.heroLinks}>
            <Link className="button button--primary button--lg" to="/try">
              Try the converter
            </Link>
            <Link className="button button--secondary button--lg" to="#walkthrough">
              See the workflow
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
        <aside className={styles.flowPanel} aria-label="xl3 workflow">
          <div className={styles.flowRole}>
            <span>Developer</span>
            <strong>defines the engine once</strong>
          </div>
          <div className={styles.flowStack} aria-label="Operator file flow">
            <div className={styles.flowFile}>
              <span>raw.xlsx</span>
              <small>operator data</small>
            </div>
            <div className={styles.flowPlus}>+</div>
            <div className={styles.flowFile}>
              <span>template.xlsx</span>
              <small>archived rules</small>
            </div>
            <div className={styles.flowArrow}>↓</div>
            <div className={styles.flowResult}>
              <span>finished workbook</span>
              <small>for the operator</small>
            </div>
          </div>
          <code>convert(template, raw)</code>
        </aside>
      </div>
    </header>
  );
}

const WALKTHROUGH_STEPS = [
  {
    index: '01',
    title: 'Define the contract in Excel',
    body: 'Use __config__, source_table, and XTL expressions to describe how raw workbooks become reports.',
  },
  {
    index: '02',
    title: 'Expose a simple upload flow',
    body: 'Non-developers choose a raw Excel file and the approved template, then run the converter.',
  },
  {
    index: '03',
    title: 'Generate finished workbooks',
    body: 'The output keeps sheet structure, number formats, styles, and merged cells while values are rendered from data.',
  },
  {
    index: '04',
    title: 'Archive the operating rules',
    body: 'The template becomes the handover artifact: a portable file that captures how the recurring Excel job works.',
  },
] as const;

function Walkthrough() {
  return (
    <section id="walkthrough" className={styles.walkthrough}>
      <div className="container">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>Workflow model</p>
          <h2 className={styles.sectionTitle}>Keep the engine in code, keep the workflow in the workbook.</h2>
          <p>
            Developers build the converter once. The recurring business rules,
            source table mapping, layout, and output shape stay inside the
            workbook template that teams can archive and hand over.
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
              kind={CONFIG_PREVIEW.kind}
              title={CONFIG_PREVIEW.title}
              note={CONFIG_PREVIEW.note}
            >
              <ExcelPreview workbook={CONFIG_PREVIEW} />
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
            <p className={styles.kicker}>Why developers use it</p>
            <h2 className={styles.sectionTitle}>Move recurring report logic out of one-off scripts.</h2>
          </div>
          <div className={styles.prose}>
            <p>
              Python scripts, VBA macros, and service-specific workflows can
              automate Excel, but the business rules often end up scattered
              across code, accounts, and tribal knowledge.
            </p>
            <p>
              xl3 separates the reusable engine from the workbook-specific
              contract. Developers maintain the TypeScript integration, while
              each recurring Excel job can travel as a template workbook.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const RELIABILITY_CARDS = [
  {
    title: 'Template as handover',
    body: 'Report rules live in a workbook file that can be reviewed, versioned, archived, and passed to the next operator.',
    tag: 'template.xlsx',
  },
  {
    title: 'Operator-friendly run',
    body: 'The runtime can be exposed as a browser page: upload raw data, select the template, download the workbook.',
    tag: 'raw.xlsx → result.xlsx',
  },
  {
    title: 'Developer-owned engine',
    body: 'Keep deployment, validation, and integration in code while template-specific workflow rules stay in Excel.',
    tag: 'convert(template, raw)',
  },
] as const;

function Reliability() {
  return (
    <section id="conformance" className={styles.reliability}>
      <div className="container">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>Operational fit</p>
          <h2 className={styles.sectionTitle}>Built for handoff, not just automation.</h2>
          <p>
            The people running the workflow should not need to read code. They
            need a stable converter, an approved template, and a predictable
            result workbook.
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
          XTL 0.1 ships with <strong>32 ADRs</strong>, <strong>119 conformance fixtures</strong>,
          all green at Stage 2. The TypeScript reference implementation is published
          at <a href="https://www.npmjs.com/package/@jinyoung4478/xl3">@jinyoung4478/xl3</a>{' '}
          — the <Link to="/porters-guide">Porter's Guide</Link> documents the
          contract so a second-language port can match it.
        </p>
      </div>
    </section>
  );
}

const COMPARISONS: Array<{ tool: string; bestAt: string; tradeoff: string }> = [
  {
    tool: 'xl3',
    bestAt: 'File-based Excel transformation. Workflow rules stay in template.xlsx.',
    tradeoff: 'Alpha. XTL surface is intentionally small and still evolving.',
  },
  {
    tool: 'Python / VBA scripts',
    bestAt: 'Fast one-off automation close to existing spreadsheets.',
    tradeoff: "Rules live in code or one maintainer's memory; handoff and review are harder.",
  },
  {
    tool: 'Power Query / Office Scripts',
    bestAt: 'Microsoft 365 workflows, data shaping inside the Excel ecosystem.',
    tradeoff: 'Workflows become tenant/account-specific rather than portable workbook artifacts.',
  },
  {
    tool: 'Spreadsheet SDKs (SheetJS, ExcelJS, Aspose)',
    bestAt: 'Low-level or full-featured programmatic workbook generation.',
    tradeoff: 'Developers usually encode report rules directly in application code.',
  },
  {
    tool: 'Template engines (JXLS, xltpl)',
    bestAt: 'Server-side report generation from spreadsheet-like templates.',
    tradeoff: 'Often language/runtime-specific; operator-facing flows are not the focus.',
  },
  {
    tool: 'Doc-gen SaaS (Plumsail, Conga)',
    bestAt: 'Managed document workflows, integrations, approvals.',
    tradeoff: 'Rules live in a vendor service, not a portable self-hostable template.',
  },
  {
    tool: 'LLM-based spreadsheet generation',
    bestAt: 'Ad hoc exploration and drafting.',
    tradeoff: 'Not a deterministic transformation contract for recurring operational work.',
  },
];

function Comparison() {
  return (
    <section id="compare" className={styles.comparison}>
      <div className="container">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>How it compares</p>
          <h2 className={styles.sectionTitle}>The same problem, different shapes.</h2>
        </div>
        <div className={styles.comparisonTable}>
          <table>
            <thead>
              <tr>
                <th>Approach</th>
                <th>Best at</th>
                <th>Tradeoff</th>
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

function DeveloperApi() {
  return (
    <section id="api" className={styles.api}>
      <div className="container">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>Developer API</p>
          <h2 className={styles.sectionTitle}>Wire the same workflow into your product.</h2>
          <p>
            Use the package when the demo flow needs to become an internal
            portal, a CLI, or a service endpoint. The operator experience can
            stay file-based while your app owns deployment and validation.
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
              [{ kind: 'comment', text: '// OutputFile[] → formatted .xlsx workbook(s)' }],
            ]}
          />
        </div>
        <p className={styles.apiCta}>
          <Link to="/guides/getting-started">Cookbook 01 — Getting started in 5 minutes</Link>
          {' · '}
          <Link to="/spec/">Read the spec</Link>
          {' · '}
          <Link to="/porters-guide">Porter's Guide</Link>
        </p>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <Layout
      title="xl3 — Excel transformation logic, inside the Excel file"
      description="xl3 puts Excel transformation logic inside the Excel file, not in code. Non-developers can read and edit the rules directly, in the same Excel syntax they already know."
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
