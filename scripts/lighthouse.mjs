/**
 * Lighthouse (Phase 10): mobile (Lighthouse's default form factor and throttling) on home, the news
 * list and an article, against the production build served by scripts/lighthouse-serve.mjs.
 * Targets: Performance ≥ 90, Accessibility / Best practices / SEO ≥ 95, on the median of 3 runs.
 *
 * Playwright's Chromium is launched with a debugging port and Lighthouse attaches to it: this avoids
 * chrome-launcher, whose temp-profile cleanup fails on Windows (EPERM) and kills `lhci` there.
 * Reports (HTML + JSON per page) and `summary.json` go to .lighthouseci/.
 *
 * Usage: npm run build && npm run lighthouse
 */
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import lighthouse from 'lighthouse';
import { chromium } from 'playwright-core';

const SSR_PORT = Number(process.env['LH_SSR_PORT'] ?? 4300);
const DEBUG_PORT = Number(process.env['LH_DEBUG_PORT'] ?? 9333);
const RUNS = Number(process.env['LH_RUNS'] ?? 3);
/** Report-only (CI, until the performance work lands): print, annotate and summarise, but exit 0. */
const REPORT_ONLY = process.env['LH_REPORT_ONLY'] === '1';
const BASE = `http://localhost:${SSR_PORT}`;
const OUT = '.lighthouseci';

/** The article is the mock fixtures' newest post (mocks/fixtures/posts.json). */
const PAGES = {
  home: '/ar',
  news: '/ar/news',
  article: '/ar/news/dates-distribution-2020',
};
const MIN = { performance: 0.9, accessibility: 0.95, 'best-practices': 0.95, seo: 0.95 };

function serve() {
  const child = spawn(process.execPath, ['scripts/lighthouse-serve.mjs'], {
    env: { ...process.env, LH_SSR_PORT: String(SSR_PORT) },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('lighthouse-serve ready')) resolve(child);
    });
    child.once('exit', (code) => reject(new Error(`lighthouse-serve exited with ${code}`)));
  });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const server = await serve();
const browser = await chromium.launch({ args: [`--remote-debugging-port=${DEBUG_PORT}`] });
mkdirSync(OUT, { recursive: true });
const summary = {};
/** The representative run's metrics (ms), so a CI log shows where the time went. */
const metrics = {};
let failed = false;
try {
  for (const [name, path] of Object.entries(PAGES)) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      const result = await lighthouse(`${BASE}${path}`, {
        port: DEBUG_PORT,
        output: ['html', 'json'],
        logLevel: 'error',
      });
      if (!result) throw new Error(`no Lighthouse result for ${path}`);
      runs.push(result);
    }
    // The median run by performance score (what `lhci` calls the representative run).
    const perf = runs.map((r) => r.lhr.categories.performance.score ?? 0);
    const rep = runs[perf.indexOf(median(perf))];
    writeFileSync(`${OUT}/${name}.html`, rep.report[0]);
    writeFileSync(`${OUT}/${name}.json`, rep.report[1]);
    summary[name] = { url: path };
    const audits = rep.lhr.audits;
    metrics[name] = {
      fcp: Math.round(audits['first-contentful-paint'].numericValue),
      lcp: Math.round(audits['largest-contentful-paint'].numericValue),
      tbt: Math.round(audits['total-blocking-time'].numericValue),
      si: Math.round(audits['speed-index'].numericValue),
      cls: Number(audits['cumulative-layout-shift'].numericValue.toFixed(3)),
      benchmarkIndex: rep.lhr.environment.benchmarkIndex,
    };
    for (const [cat, min] of Object.entries(MIN)) {
      const score = median(runs.map((r) => r.lhr.categories[cat].score ?? 0));
      summary[name][cat] = Math.round(score * 100);
      if (score < min) failed = true;
    }
  }
} finally {
  await browser.close();
  server.kill();
}

writeFileSync(`${OUT}/summary.json`, `${JSON.stringify({ scores: summary, metrics }, null, 2)}\n`);
console.table(summary);
console.table(metrics);

// GitHub Actions: a table in the job summary, so the numbers are visible without the artifact.
const stepSummary = process.env['GITHUB_STEP_SUMMARY'];
if (stepSummary) {
  const rows = Object.entries(summary).map(([name, s]) => {
    const m = metrics[name];
    return `| ${name} | ${s.performance} | ${s.accessibility} | ${s['best-practices']} | ${s.seo} | ${m.fcp} | ${m.lcp} | ${m.tbt} | ${m.si} | ${m.cls} |`;
  });
  const lines = [
    `### Lighthouse (mobile, median of ${RUNS})${REPORT_ONLY ? ' — report-only' : ''}`,
    '',
    '| Page | Perf | A11y | BP | SEO | FCP ms | LCP ms | TBT ms | SI ms | CLS |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    `CPU benchmark index: ${Object.values(metrics)[0]?.benchmarkIndex ?? '—'}`,
    '',
  ];
  appendFileSync(stepSummary, lines.join('\n'));
}

if (failed) {
  const message = `Below target (performance ≥ ${MIN.performance * 100}, others ≥ ${MIN.seo * 100}). See ${OUT}/*.html`;
  if (REPORT_ONLY) {
    console.log(`::warning title=Lighthouse below target (report-only)::${message}`);
  } else {
    console.error(message);
    process.exit(1);
  }
}
