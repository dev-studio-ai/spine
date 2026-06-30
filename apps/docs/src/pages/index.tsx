import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';

import styles from './index.module.css';

const FEATURES: { title: string; body: ReactNode }[] = [
  {
    title: 'No reflect-metadata',
    body: (
      <>
        Decorators store metadata as plain own-property symbols. Safe under
        esbuild/swc with no global polyfill and no surprise runtime weight.
      </>
    ),
  },
  {
    title: 'Transport-agnostic',
    body: (
      <>
        The <code>Gateway</code> pipeline decouples controllers from whatever
        carries the bytes — IPC, HTTP, WebSocket, or nothing at all.
      </>
    ),
  },
  {
    title: 'Structured lifecycle',
    body: (
      <>
        Every module flows through <code>init → start → stop</code>. Graceful
        shutdown, signal handling, and ordered teardown come for free.
      </>
    ),
  },
  {
    title: 'Familiar patterns',
    body: (
      <>
        Modules, dependency injection, guards, and validation — the patterns you
        already know, at a fraction of the runtime weight.
      </>
    ),
  },
  {
    title: 'Composable à la carte',
    body: (
      <>
        Layered packages: take the core, add a gateway, bind a transport. Pull in
        only the pieces your process actually needs.
      </>
    ),
  },
  {
    title: 'Built for long-lived Node',
    body: (
      <>
        Background workers, CLI daemons, Electron mains, services — anything that
        outgrows a flat <code>index.ts</code>.
      </>
    ),
  },
];

const SNIPPET = `import { App, Module, OnInit } from '@spinejs/core';

@Module({ inject: [] })
class GreeterModule implements OnInit {
  async onInit() {
    console.log('Hello from SpineJS');
  }
}

const app = new App([GreeterModule]);
await app.init();
await app.start();`;

function Hero(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={styles.hero}>
      <div className={clsx('container', styles.heroInner)}>
        <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>{siteConfig.title}</h1>
          <p className={styles.heroTagline}>{siteConfig.tagline}</p>
          <div className={styles.heroButtons}>
            <Link className="button button--primary button--lg" to="/docs/intro">
              Get started
            </Link>
            <Link
              className={clsx('button button--secondary button--lg', styles.ghostButton)}
              to="/docs/gateway/overview"
            >
              Gateway design
            </Link>
          </div>
        </div>
        <div className={styles.heroCode}>
          <CodeBlock language="typescript">{SNIPPET}</CodeBlock>
        </div>
      </div>
    </header>
  );
}

function Features(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className={styles.featureGrid}>
          {FEATURES.map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureBody}>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} — ${siteConfig.tagline}`}
      description="Modules, dependency injection, and lifecycle for long-lived Node processes."
    >
      <Hero />
      <main>
        <Features />
      </main>
    </Layout>
  );
}
