import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';
import clsx from 'clsx';
import { CodeCard } from '@site/src/components/CodeCard';
import { ExcelPreview, ExcelPreviewFrame } from '@site/src/components/ExcelPreview';
import type { Workbook } from '@site/src/components/ExcelPreview';
import styles from './index.module.css';

const CONFIG_PREVIEW: Workbook = {
  kind: '__config__',
  title: 'The workbook is the execution contract.',
  note: 'source_table tells xl3 where the raw table starts; XTL cells declare what should happen to it.',
  workbookTitle: 'template.xlsx',
  workbookSubtitle: 'executable Excel template',
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
          <p className={styles.kicker}>
            <Translate id="homepage.hero.kicker" description="Hero section eyebrow / kicker line">
              Declarative Excel templates · deterministic execution
            </Translate>
          </p>
          <h1 className={styles.heroTitle}>
            <Translate id="homepage.hero.title" description="Hero section H1">
              Make Excel an executable template.
            </Translate>
          </h1>
          <p className={styles.heroLead}>
            <Translate
              id="homepage.hero.lead"
              description="Hero section lead paragraph; {template}, {raw}, {result} are inline code refs"
              values={{
                template: <code>template.xlsx</code>,
                raw: <code>raw.xlsx</code>,
                result: <code>result.xlsx</code>,
              }}
            >
              {
                'xl3 is an open standard, not a workbook API: put the transformation rules inside {template}, provide {raw}, and a conforming engine returns {result} — same inputs, same workbook, every time.'
              }
            </Translate>
          </p>
          <div className={styles.heroLinks}>
            <Link className="button button--primary button--lg" to="/try">
              <Translate id="homepage.hero.cta.try" description="Hero primary CTA button">
                Try the converter
              </Translate>
            </Link>
            <Link className="button button--secondary button--lg" to="#walkthrough">
              <Translate id="homepage.hero.cta.workflow" description="Hero secondary CTA — scroll to workflow section">
                See the workflow
              </Translate>
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
        <aside
          className={styles.flowPanel}
          aria-label={translate({
            id: 'homepage.hero.flowPanel.ariaLabel',
            message: 'xl3 workflow',
            description: 'Aria label for the workflow diagram aside',
          })}
        >
          <div className={styles.flowRole}>
            <span>
              <Translate id="homepage.hero.flow.role.developer" description="Workflow diagram — actor label">
                Developer
              </Translate>
            </span>
            <strong>
              <Translate id="homepage.hero.flow.role.developerRole" description="What the developer does in the workflow">
                owns data and deployment
              </Translate>
            </strong>
          </div>
          <div
            className={styles.flowStack}
            aria-label={translate({
              id: 'homepage.hero.flowStack.ariaLabel',
              message: 'Operator file flow',
              description: 'Aria label for the file-flow stack inside the workflow diagram',
            })}
          >
            <div className={styles.flowFile}>
              <span>raw.xlsx</span>
              <small>
                <Translate id="homepage.hero.flow.raw.label" description="Workflow diagram — what raw.xlsx is">
                  operator data
                </Translate>
              </small>
            </div>
            <div className={styles.flowPlus}>+</div>
            <div className={styles.flowFile}>
              <span>template.xlsx</span>
              <small>
                <Translate id="homepage.hero.flow.template.label" description="Workflow diagram — what template.xlsx is">
                  executable rules
                </Translate>
              </small>
            </div>
            <div className={styles.flowArrow}>↓</div>
            <div className={styles.flowResult}>
              <span>
                <Translate id="homepage.hero.flow.result.label" description="Workflow diagram — output label">
                  finished workbook
                </Translate>
              </span>
              <small>
                <Translate id="homepage.hero.flow.result.sublabel" description="Workflow diagram — output sublabel">
                  for the operator
                </Translate>
              </small>
            </div>
          </div>
          <code>convert(template, raw)</code>
        </aside>
      </div>
    </header>
  );
}

function useWalkthroughSteps() {
  return [
    {
      index: '01',
      title: translate({
        id: 'homepage.walkthrough.step01.title',
        message: 'Design the workbook in Excel',
        description: 'Walkthrough step 01 title',
      }),
      body: translate({
        id: 'homepage.walkthrough.step01.body',
        message:
          'Keep layout, merged cells, number formats, and labels where the business team already edits them.',
        description: 'Walkthrough step 01 body',
      }),
    },
    {
      index: '02',
      title: translate({
        id: 'homepage.walkthrough.step02.title',
        message: 'Declare transformation rules',
        description: 'Walkthrough step 02 title',
      }),
      body: translate({
        id: 'homepage.walkthrough.step02.body',
        message:
          'Use __config__, source_table, and XTL expressions to say what should repeat, filter, group, and render.',
        description: 'Walkthrough step 02 body',
      }),
    },
    {
      index: '03',
      title: translate({
        id: 'homepage.walkthrough.step03.title',
        message: 'Execute with raw data',
        description: 'Walkthrough step 03 title',
      }),
      body: translate({
        id: 'homepage.walkthrough.step03.body',
        message:
          'The engine combines template.xlsx and raw.xlsx as a pure function, producing the same workbook every run.',
        description: 'Walkthrough step 03 body',
      }),
    },
    {
      index: '04',
      title: translate({
        id: 'homepage.walkthrough.step04.title',
        message: 'Hand off the template',
        description: 'Walkthrough step 04 title',
      }),
      body: translate({
        id: 'homepage.walkthrough.step04.body',
        message:
          'The template becomes the handover artifact: a portable file that captures how the recurring Excel job works.',
        description: 'Walkthrough step 04 body',
      }),
    },
  ] as const;
}

function Walkthrough() {
  const steps = useWalkthroughSteps();
  return (
    <section id="walkthrough" className={styles.walkthrough}>
      <div className="container">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>
            <Translate id="homepage.walkthrough.kicker" description="Walkthrough section kicker">
              Workflow model
            </Translate>
          </p>
          <h2 className={styles.sectionTitle}>
            <Translate id="homepage.walkthrough.title" description="Walkthrough section H2">
              Excel becomes the view. Data stays the model. xl3 executes the contract.
            </Translate>
          </h2>
          <p>
            <Translate id="homepage.walkthrough.lead" description="Walkthrough section lead paragraph">
              Developers wire data, validation, and deployment once. The recurring layout and business rules stay inside an ordinary workbook that teams can review, version, archive, and hand over.
            </Translate>
          </p>
        </div>
        <div className={styles.walkthroughLayout}>
          <div className={styles.stepsGrid}>
            {steps.map((s) => (
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
            <p className={styles.kicker}>
              <Translate id="homepage.handoff.kicker" description="Handoff section kicker">
                Why developers use it
              </Translate>
            </p>
            <h2 className={styles.sectionTitle}>
              <Translate id="homepage.handoff.title" description="Handoff section H2">
                Stop encoding report layout in one-off scripts.
              </Translate>
            </h2>
          </div>
          <div className={styles.prose}>
            <p>
              <Translate id="homepage.handoff.body.p1" description="Handoff body paragraph 1">
                ExcelJS, SheetJS, openpyxl, and Apache POI are excellent workbook APIs. But when report layout, styles, merged cells, and loops live in code, every design change becomes a deployment.
              </Translate>
            </p>
            <p>
              <Translate id="homepage.handoff.body.p2" description="Handoff body paragraph 2">
                xl3 moves the recurring contract back into Excel. The workbook is already the view; XTL makes it executable, while the application only supplies data and runs the engine.
              </Translate>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function useResponsibilityCards() {
  return [
    {
      title: translate({
        id: 'homepage.responsibility.card01.title',
        message: 'Developer',
        description: 'Responsibility section card 01 title',
      }),
      body: translate({
        id: 'homepage.responsibility.card01.body',
        message:
          'Owns the runtime: engine behavior, validation, integration, deployment, and reliability.',
        description: 'Responsibility section card 01 body',
      }),
      tag: 'runtime',
    },
    {
      title: translate({
        id: 'homepage.responsibility.card02.title',
        message: 'Operator',
        description: 'Responsibility section card 02 title',
      }),
      body: translate({
        id: 'homepage.responsibility.card02.body',
        message:
          'Owns the template: layout, columns, repeat rules, output format, and document-specific logic.',
        description: 'Responsibility section card 02 body',
      }),
      tag: 'template.xlsx',
    },
    {
      title: translate({
        id: 'homepage.responsibility.card03.title',
        message: 'Business',
        description: 'Responsibility section card 03 title',
      }),
      body: translate({
        id: 'homepage.responsibility.card03.body',
        message:
          'Uses the final workbook without waiting for every recurring document change to become a release.',
        description: 'Responsibility section card 03 body',
      }),
      tag: 'result.xlsx',
    },
  ] as const;
}

function Responsibility() {
  const cards = useResponsibilityCards();
  return (
    <section className={styles.responsibility}>
      <div className="container">
        <div className={styles.narrativeGrid}>
          <div>
            <p className={styles.kicker}>
              <Translate id="homepage.responsibility.kicker" description="Responsibility section kicker">
                Responsibility-driven automation
              </Translate>
            </p>
            <h2 className={styles.sectionTitle}>
              <Translate id="homepage.responsibility.title" description="Responsibility section H2">
                Move document ownership out of the deploy queue.
              </Translate>
            </h2>
          </div>
          <div className={styles.prose}>
            <p>
              <Translate id="homepage.responsibility.body.p1" description="Responsibility section body paragraph 1">
                Most Excel automation tools make developers faster. xl3 solves a different problem: it lets operators take over the document changes that used to require developer intervention.
              </Translate>
            </p>
            <p>
              <Translate id="homepage.responsibility.body.p2" description="Responsibility section body paragraph 2">
                In production, this model has let developers focus on the runtime while operations teams maintain templates and transformation rules directly in Excel. xl3 reduces the work that must be done by developers, not just the amount of code they write.
              </Translate>
            </p>
          </div>
        </div>
        <div className={styles.stageGrid}>
          {cards.map((c) => (
            <article key={c.tag} className={styles.stageCard}>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
              <code>{c.tag}</code>
            </article>
          ))}
        </div>
        <p className={styles.conformanceFact}>
          <Translate id="homepage.responsibility.fact" description="Responsibility section closing fact">
            xl3 is not trying to replace developers. Developers own the runtime; operators own the templates; document automation becomes an organizational capability instead of a developer-only task.
          </Translate>
        </p>
      </div>
    </section>
  );
}

function useReliabilityCards() {
  return [
    {
      title: translate({
        id: 'homepage.reliability.card01.title',
        message: 'Template as contract',
        description: 'Reliability card 01 title',
      }),
      body: translate({
        id: 'homepage.reliability.card01.body',
        message:
          'Report rules live in a workbook file that can be reviewed, versioned, archived, and passed to the next operator.',
        description: 'Reliability card 01 body',
      }),
      tag: 'template.xlsx',
    },
    {
      title: translate({
        id: 'homepage.reliability.card02.title',
        message: 'Operator-friendly run',
        description: 'Reliability card 02 title',
      }),
      body: translate({
        id: 'homepage.reliability.card02.body',
        message:
          'The engine can be exposed as a browser flow: upload raw data, select the approved template, download the workbook.',
        description: 'Reliability card 02 body',
      }),
      tag: 'raw.xlsx → result.xlsx',
    },
    {
      title: translate({
        id: 'homepage.reliability.card03.title',
        message: 'Developer-owned runtime',
        description: 'Reliability card 03 title',
      }),
      body: translate({
        id: 'homepage.reliability.card03.body',
        message:
          'Keep deployment, validation, and integration in code while template-specific workflow rules stay in Excel.',
        description: 'Reliability card 03 body',
      }),
      tag: 'convert(template, raw)',
    },
  ] as const;
}

function Reliability() {
  const cards = useReliabilityCards();
  return (
    <section id="conformance" className={styles.reliability}>
      <div className="container">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>
            <Translate id="homepage.reliability.kicker" description="Reliability section kicker">
              Why it works
            </Translate>
          </p>
          <h2 className={styles.sectionTitle}>
            <Translate id="homepage.reliability.title" description="Reliability section H2">
              Declarative, deterministic, and small on purpose.
            </Translate>
          </h2>
          <p>
            <Translate id="homepage.reliability.lead" description="Reliability section lead paragraph">
              Users describe what the workbook should do, not how to build every cell. The XTL surface stays small so templates remain readable by humans and easy for AI systems to draft.
            </Translate>
          </p>
        </div>
        <div className={styles.stageGrid}>
          {cards.map((c) => (
            <article key={c.tag} className={styles.stageCard}>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
              <code>{c.tag}</code>
            </article>
          ))}
        </div>
        <p className={styles.conformanceFact}>
          <Translate
            id="homepage.reliability.fact"
            description="Reliability section conformance stats sentence; {adrCount} and {fixtureCount} are pre-bolded counts, {npmLink} and {portersGuideLink} are inline links"
            values={{
              adrCount: <strong>70 ADRs</strong>,
              fixtureCount: <strong>154 conformance fixtures</strong>,
              npmLink: (
                <a href="https://www.npmjs.com/package/@xl3-lang/xl3">@xl3-lang/xl3</a>
              ),
              portersGuideLink: (
                <Link to="/porters-guide">
                  <Translate
                    id="homepage.reliability.fact.portersGuideLabel"
                    description="Link label inside the conformance fact sentence"
                  >
                    Porter's Guide
                  </Translate>
                </Link>
              ),
            }}
          >
            {
              'XTL 0.1 ships with {adrCount}, {fixtureCount}, all green at Stage 2. The TypeScript reference implementation is published at {npmLink} — the {portersGuideLink} documents the contract so a second-language port can match it.'
            }
          </Translate>
        </p>
      </div>
    </section>
  );
}

function useComparisons() {
  return [
    {
      tool: 'xl3',
      bestAt: translate({
        id: 'homepage.comparison.xl3.bestAt',
        message: 'Declarative Excel template execution. The workbook already exists; xl3 runs it with data.',
        description: 'Comparison row xl3 — best at',
      }),
      tradeoff: translate({
        id: 'homepage.comparison.xl3.tradeoff',
        message: 'Alpha; one maintainer; the XTL surface is intentionally small and still evolving until 1.0.',
        description: 'Comparison row xl3 — tradeoff',
      }),
    },
    {
      tool: 'Direct LLM → xlsx',
      bestAt: translate({
        id: 'homepage.comparison.llmDirect.bestAt',
        message: 'Quick exploratory drafting, one-off charts.',
        description: 'Comparison row direct LLM xlsx — best at',
      }),
      tradeoff: translate({
        id: 'homepage.comparison.llmDirect.tradeoff',
        message: 'Each render is non-deterministic; styles, number formats, and totals drift between runs even with temperature 0.',
        description: 'Comparison row direct LLM xlsx — tradeoff',
      }),
    },
    {
      tool: 'Workbook APIs (ExcelJS, SheetJS, openpyxl, POI)',
      bestAt: translate({
        id: 'homepage.comparison.sdk.bestAt',
        message: 'Low-level or full-featured workbook generation from application code.',
        description: 'Comparison row spreadsheet SDKs — best at',
      }),
      tradeoff: translate({
        id: 'homepage.comparison.sdk.tradeoff',
        message: 'Layout, styles, merges, loops, and business rules become code. Non-developers cannot safely edit the template.',
        description: 'Comparison row spreadsheet SDKs — tradeoff',
      }),
    },
    {
      tool: 'Power Query / Office Scripts',
      bestAt: translate({
        id: 'homepage.comparison.powerQuery.bestAt',
        message: 'Microsoft 365 workflows and data shaping inside the Excel ecosystem.',
        description: 'Comparison row Power Query — best at',
      }),
      tradeoff: translate({
        id: 'homepage.comparison.powerQuery.tradeoff',
        message:
          'Tenant-bound; the workflow rules do not travel with the workbook.',
        description: 'Comparison row Power Query — tradeoff',
      }),
    },
    {
      tool: 'Template engines (JXLS, xltpl, jsreport xlsx)',
      bestAt: translate({
        id: 'homepage.comparison.templateEngines.bestAt',
        message: 'Server-side report generation from spreadsheet-like templates.',
        description: 'Comparison row template engines — best at',
      }),
      tradeoff: translate({
        id: 'homepage.comparison.templateEngines.tradeoff',
        message: 'Useful prior art, but often tied to one runtime and not positioned as a small, portable Excel rule format.',
        description: 'Comparison row template engines — tradeoff',
      }),
    },
    {
      tool: 'Doc-gen SaaS (Plumsail, Conga, Formstack)',
      bestAt: translate({
        id: 'homepage.comparison.docgen.bestAt',
        message: 'Managed document workflows, integrations, approvals, and delivery.',
        description: 'Comparison row doc-gen SaaS — best at',
      }),
      tradeoff: translate({
        id: 'homepage.comparison.docgen.tradeoff',
        message: 'Rules live in a vendor service, not in a portable workbook template you can review and run yourself.',
        description: 'Comparison row doc-gen SaaS — tradeoff',
      }),
    },
    {
      tool: 'Python / VBA scripts',
      bestAt: translate({
        id: 'homepage.comparison.scripts.bestAt',
        message: 'Fast one-off automation close to existing spreadsheets.',
        description: 'Comparison row Python/VBA — best at',
      }),
      tradeoff: translate({
        id: 'homepage.comparison.scripts.tradeoff',
        message: "Rules live in code or one maintainer's memory; layout changes still need code changes.",
        description: 'Comparison row Python/VBA — tradeoff',
      }),
    },
  ] as const;
}

function Comparison() {
  const rows = useComparisons();
  return (
    <section id="compare" className={styles.comparison}>
      <div className="container">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>
            <Translate id="homepage.comparison.kicker" description="Comparison section kicker">
              How it compares
            </Translate>
          </p>
          <h2 className={styles.sectionTitle}>
            <Translate id="homepage.comparison.title" description="Comparison section H2">
              The same problem, different shapes.
            </Translate>
          </h2>
        </div>
        <div className={styles.comparisonTable}>
          <table>
            <thead>
              <tr>
                <th>
                  <Translate id="homepage.comparison.col.approach" description="Comparison table column header — tool/approach name">
                    Approach
                  </Translate>
                </th>
                <th>
                  <Translate id="homepage.comparison.col.bestAt" description="Comparison table column header — best at">
                    Best at
                  </Translate>
                </th>
                <th>
                  <Translate id="homepage.comparison.col.tradeoff" description="Comparison table column header — tradeoff">
                    Tradeoff
                  </Translate>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
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
          <p className={styles.kicker}>
            <Translate id="homepage.api.kicker" description="Developer API section kicker">
              Developer API
            </Translate>
          </p>
          <h2 className={styles.sectionTitle}>
            <Translate id="homepage.api.title" description="Developer API section H2">
              Wire the same workflow into your product.
            </Translate>
          </h2>
          <p>
            <Translate id="homepage.api.lead" description="Developer API section lead paragraph">
              Use the package when the demo flow needs to become an internal portal, a CLI, or a service endpoint. The operator experience can stay file-based while your app owns deployment and validation.
            </Translate>
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
              [{ kind: 'comment', text: '// OutputFile[] → formatted .xlsx workbook(s)' }],
            ]}
          />
        </div>
        <p className={styles.apiCta}>
          <Link to="/guides/getting-started">
            <Translate id="homepage.api.cta.cookbook" description="Bottom CTA link — cookbook 01">
              Cookbook 01 — Getting started in 5 minutes
            </Translate>
          </Link>
          {' · '}
          <Link to="/spec/">
            <Translate id="homepage.api.cta.spec" description="Bottom CTA link — spec">
              Read the spec
            </Translate>
          </Link>
          {' · '}
          <Link to="/porters-guide">
            <Translate id="homepage.api.cta.porters" description="Bottom CTA link — Porter's Guide">
              Porter's Guide
            </Translate>
          </Link>
        </p>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <Layout
      title={translate({
        id: 'homepage.layout.title',
        // Names xl3's identity as a standard for Excel transformation, not a
        // library. Docusaurus appends "| xl3", so no brand prefix here.
        message: 'A Standard for Declarative Excel Transformation',
        description: 'HTML <title> for the landing page',
      })}
      description={translate({
        id: 'homepage.layout.description',
        message:
          'xl3 is an open standard for declarative Excel transformation: run an Excel template with data to get the same workbook every time.',
        description: 'HTML <meta description> for the landing page',
      })}
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
