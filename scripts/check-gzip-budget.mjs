#!/usr/bin/env node
/**
 * Initial public bundle budget: < 150 KB gzip (brief hard rule 7). Angular budgets count raw bytes,
 * so this sums the gzip size of every initial file: the scripts and stylesheets the CSR index
 * references, plus everything those scripts import statically. Usage: node scripts/check-gzip-budget.mjs [browserDir] [limitKB]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = process.argv[2] ?? 'dist/safeer_web/browser';
const limitKb = Number(process.argv[3] ?? 150);
const html = readFileSync(join(dist, 'index.csr.html'), 'utf8');

const refs = new Set();
for (const tag of html.match(/<(script|link)\b[^>]*>/g) ?? []) {
  const src = /\bsrc="([^"]+)"/.exec(tag)?.[1];
  const href = /\bhref="([^"]+)"/.exec(tag)?.[1];
  const rel = /\brel="([^"]+)"/.exec(tag)?.[1];
  if (tag.startsWith('<script') && src) refs.add(src);
  if (tag.startsWith('<link') && href && (rel === 'modulepreload' || rel === 'stylesheet'))
    refs.add(href);
}

/**
 * Follow the static imports of every initial script, so the total is the real initial set even
 * without `modulepreload` hints (Phase 10 turned `index.preloadInitial` off). Dynamic `import("…")`
 * (lazy routes) doesn't match: the quote must directly follow `from` / `import`.
 */
const STATIC_IMPORT = /(?:\bfrom|\bimport)\s*"\.\/([^"]+\.js)"/g;
const queue = [...refs].filter((r) => r.endsWith('.js'));
while (queue.length) {
  const file = queue.shift().replace(/^\//, '');
  for (const [, dep] of readFileSync(join(dist, file), 'utf8').matchAll(STATIC_IMPORT)) {
    if (!refs.has(dep) && !refs.has(`/${dep}`)) {
      refs.add(dep);
      queue.push(dep);
    }
  }
}

let total = 0;
for (const ref of [...refs].filter((r) => !/^(https?:)?\/\//.test(r))) {
  const size = gzipSync(readFileSync(join(dist, ref.replace(/^\//, ''))), { level: 9 }).length;
  total += size;
  console.log(`${(size / 1024).toFixed(1).padStart(7)} KB  ${ref}`);
}
const totalKb = total / 1024;
console.log(`${totalKb.toFixed(1).padStart(7)} KB  initial total (gzip), limit ${limitKb} KB`);
if (totalKb > limitKb) {
  console.error('gzip budget exceeded');
  process.exit(1);
}
