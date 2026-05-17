import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import clsx from 'clsx';
import styles from './404.module.css';

export default function NotFound() {
  return (
    <Layout
      title="404 — Not found"
      description="The page you're looking for isn't here. Try the guides, the spec, or the converter."
    >
      <main className={styles.page}>
        <div className="container">
          <p className={styles.code}>404</p>
          <h1 className={styles.title}>That page is not in this workbook.</h1>
          <p className={styles.body}>
            The URL you followed does not match a page on xl3.io. Use one of
            the cards below to jump to the main areas of the site.
          </p>

          <div className={styles.cards}>
            <Link className={styles.card} to="/">
              <strong>Home</strong>
              <span>The xl3 landing page</span>
            </Link>
            <Link className={styles.card} to="/guides">
              <strong>Guides</strong>
              <span>Ten short, copy-paste recipes</span>
            </Link>
            <Link className={styles.card} to="/spec/">
              <strong>Spec</strong>
              <span>The XTL 0.1 language reference</span>
            </Link>
            <Link className={styles.card} to="/try">
              <strong>Try it</strong>
              <span>Run xl3 in the browser</span>
            </Link>
            <Link className={clsx(styles.card, styles.outbound)} href="https://github.com/jinyoung4478/xl3">
              <strong>GitHub</strong>
              <span>Source, issues, discussions</span>
            </Link>
            <Link className={styles.card} to="/porters-guide">
              <strong>Porter&apos;s Guide</strong>
              <span>For second-language implementations</span>
            </Link>
          </div>

          <p className={styles.foot}>
            If you think this URL should resolve to something,{' '}
            <Link href="https://github.com/jinyoung4478/xl3/issues">file an issue</Link>.
          </p>
        </div>
      </main>
    </Layout>
  );
}
