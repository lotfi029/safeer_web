#!/usr/bin/env node
/**
 * Review F6: the real production artifact must not contain the dev-only `/_kit` route or any mock
 * backend code. Mock modules carry the marker `SAFEER_MOCK_REGISTRY`, the kit route `SAFEER_KIT_ROUTE`.
 * Usage: node scripts/check-prod-artifact.mjs [distDir]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist/safeer_web';
const FORBIDDEN = ['SAFEER_MOCK_REGISTRY', 'SAFEER_KIT_ROUTE', 'mocks/fixtures'];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(m?js|html)$/.test(entry)) yield full;
  }
}

const hits = [];
let files = 0;
for (const file of walk(dist)) {
  files++;
  const text = readFileSync(file, 'utf8');
  for (const marker of FORBIDDEN) if (text.includes(marker)) hits.push(`${file}: ${marker}`);
}
if (files === 0) {
  console.error(`no build output found in ${dist}`);
  process.exit(1);
}
if (hits.length) {
  console.error(`production artifact contains dev-only code:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`prod artifact check: ok (${files} files in ${dist})`);
