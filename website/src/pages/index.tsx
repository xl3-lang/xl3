import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import clsx from 'clsx';
import styles from './index.module.css';

function Hero() {
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <h1 className="hero__title">xl3</h1>
        <p className="hero__subtitle">
          Excel conversion, inside Excel, in Excel syntax. Keep recurring
          Excel transformation rules inside workbook templates — no macros,
          no vendor cloud, no host code rewriting Excel files row-by-row.
        </p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/playground/">
            Try the playground
          </Link>
          <Link className="button button--secondary button--lg" to="/cookbook/">
            Read the cookbook
          </Link>
          <Link className="button button--secondary button--lg" to="/spec/">
            Read the spec
          </Link>
          <Link
            className="button button--secondary button--lg"
            href="https://github.com/jinyoung4478/xl3"
          >
            GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}

function Workflow() {
  return (
    <section className={styles.workflow}>
      <div className="container">
        <h2>How it works</h2>
        <div className={clsx('row', styles.workflowRow)}>
          <div className="col col--4">
            <div className={styles.workflowStep}>
              <div className={styles.workflowKey}>raw.xlsx</div>
              <p>The input data the operator already has — exports from a CRM, accounting system, internal portal.</p>
            </div>
          </div>
          <div className="col col--4">
            <div className={styles.workflowStep}>
              <div className={styles.workflowKey}>template.xlsx</div>
              <p>The workflow contract. <code>__config__</code> plus cells with <code>{'{{ [Account] }}'}</code>, <code>{'{{ IF([Renewal] > 10000, "A", "B") }}'}</code>, <code>{'{{ @sort [Amount] desc }}'}</code>.</p>
            </div>
          </div>
          <div className="col col--4">
            <div className={styles.workflowStep}>
              <div className={styles.workflowKey}>result.xlsx</div>
              <p>The finished workbook — styling, number formats, merges preserved. Hand it off to the next operator.</p>
            </div>
          </div>
        </div>
        <p className={styles.workflowFooter}>
          Templates are authored in Excel itself. The template is the
          handover artifact — reviewed, versioned, archived, passed to the
          next operator without asking them to read code.
        </p>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    title: 'Rules travel with the workbook',
    body: '__config__, expressions, and layout are archived in template.xlsx. Operators read and edit; developers do not become a bottleneck.',
  },
  {
    title: 'Language-neutral spec',
    body: '32 ADRs, 119 conformance fixtures, all green at Stage 2. The TypeScript implementation is the reference impl, not the spec.',
  },
  {
    title: 'Audit-pass complete',
    body: 'Every silent-fallthrough surface either errors with a stable xl3/<category>/<id> code or is normatively pinned.',
  },
  {
    title: 'Designed to be ported',
    body: "Porter's Guide catalogs the gotchas — NFC/NFD, IEEE 754, timezone handling. The conformance corpus is the executable contract.",
  },
] as const;

function Features() {
  return (
    <section className={styles.features}>
      <div className="container">
        <h2>What xl3 emphasizes</h2>
        <div className="row">
          {FEATURES.map(({ title, body }) => (
            <div key={title} className="col col--6 margin-bottom--lg">
              <div className={styles.featureCard}>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </div>
          ))}
        </div>
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
];

function Comparison() {
  return (
    <section className={styles.comparison}>
      <div className="container">
        <h2>How it compares</h2>
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

function QuickInstall() {
  return (
    <section className={styles.install}>
      <div className="container">
        <h2>Install</h2>
        <pre>
          <code>{`npm install @jinyoung4478/xl3`}</code>
        </pre>
        <pre>
          <code>{`import { convert } from '@jinyoung4478/xl3';

const outputs = await convert(templateBuffer, dataBuffer, {
  inputs: { month: '2026-05' },
});`}</code>
        </pre>
        <p>Runs in browsers and Node ≥ 20.12.</p>
        <p>
          <Link to="/cookbook/getting-started">Cookbook 01 — Getting started in 5 minutes</Link>
          {' · '}
          <Link to="/playground/">Try the browser playground</Link>
        </p>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <Layout
      title="xl3 — Excel conversion, inside Excel"
      description="xl3 puts Excel transformation logic inside the Excel file, not in code. Non-developers can read and edit the rules directly, in the same Excel syntax they already know."
    >
      <Hero />
      <main>
        <Workflow />
        <Features />
        <Comparison />
        <QuickInstall />
      </main>
    </Layout>
  );
}
