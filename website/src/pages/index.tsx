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
          Excel conversion, inside Excel. Keep recurring Excel transformation
          rules inside workbook templates — no macros, no vendor cloud, no
          host code rewriting Excel files row-by-row.
        </p>
        <div className={styles.buttons}>
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
    body: 'Every silent-fallthrough surface either errors with a stable xl3/<category>/<id> code or is normatively pinned. CHANGELOG tracks each ADR.',
  },
  {
    title: 'Designed to be ported',
    body: "PORTERS_GUIDE catalogs the gotchas — NFC/NFD, IEEE 754, timezone handling. The conformance corpus is the executable contract.",
  },
] as const;

function Features() {
  return (
    <section className={styles.features}>
      <div className="container">
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

function QuickInstall() {
  return (
    <section className={styles.install}>
      <div className="container">
        <h2>Quick install</h2>
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
        <Features />
        <QuickInstall />
      </main>
    </Layout>
  );
}
