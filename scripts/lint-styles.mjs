#!/usr/bin/env node
/**
 * RTL/LTR + design-token guard (sessions plan R9). Scans src/**\/*.{ts,html,css} only.
 *  1. Physical-direction Tailwind utilities (ml-, pr-, left-, text-right, rounded-l-…) → use logical
 *     ones (ms-, pe-, start-, text-end, rounded-s-…).
 *  2. Physical CSS properties in .css (margin-left, left:, text-align: right…).
 *  3. Hex colours anywhere except src/styles/tokens.css.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOKENS_FILE = 'src/styles/tokens.css';

const TW_PHYSICAL =
  /(?<![\w-])-?(?:ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|scroll-ml|scroll-mr|scroll-pl|scroll-pr)-[\w.[\]/%-]+|(?<![\w-])(?:text-left|text-right|float-left|float-right|clear-left|clear-right|border-l|border-r|rounded-l|rounded-r|space-x-reverse)(?![\w-])/g;
const CSS_PHYSICAL =
  /\b(?:margin|padding|border|scroll-margin|scroll-padding)-(?:left|right)\b|(?:^|[\s;{])(?:left|right)\s*:|\btext-align\s*:\s*(?:left|right)\b|\bfloat\s*:\s*(?:left|right)\b|\bclear\s*:\s*(?:left|right)\b|\bborder-(?:top|bottom)-(?:left|right)-radius\b/gm;
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const QUOTED_HEX = /(['"`])(?:(?!\1)[^\n])*?#[0-9a-fA-F]{3,8}\b/g;
const ARBITRARY_OR_STYLE_HEX = /\[#[0-9a-fA-F]{3,8}\]|style="[^"]*#[0-9a-fA-F]{3,8}\b/g;

/** Class-bearing contexts in templates/TS: `class="…"`, `[class]="…"`, `ngClass`, host `class:`. */
const CLASS_CONTEXT = /(?:\bclass|ngClass|\[class\]|\[ngClass\])\s*[=:]\s*(["'`])([\s\S]*?)\1/g;

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

export function lintSource(file, text) {
  const problems = [];
  const push = (index, message) => problems.push({ file, line: lineOf(text, index), message });
  const normalized = file.split(sep).join('/');
  const isTokens = normalized.endsWith(TOKENS_FILE);

  if (file.endsWith('.css')) {
    for (const m of text.matchAll(CSS_PHYSICAL)) {
      push(m.index, `physical CSS property "${m[0].trim()}" — use a logical property`);
    }
    if (!isTokens) {
      for (const m of text.matchAll(HEX))
        push(m.index, `hex colour ${m[0]} outside ${TOKENS_FILE}`);
    }
    return problems;
  }

  for (const ctx of text.matchAll(CLASS_CONTEXT)) {
    for (const m of ctx[2].matchAll(TW_PHYSICAL)) {
      push(
        ctx.index,
        `physical utility "${m[0]}" — use ms-/me-/ps-/pe-/start-/end-/text-start/text-end`,
      );
    }
  }
  const hexPattern = file.endsWith('.html') ? ARBITRARY_OR_STYLE_HEX : QUOTED_HEX;
  for (const m of text.matchAll(hexPattern)) {
    push(m.index, `hex colour outside ${TOKENS_FILE}: ${m[0].slice(0, 40)}`);
  }
  return problems;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|html|css)$/.test(entry)) yield full;
  }
}

export function lintTree(root) {
  const problems = [];
  for (const file of walk(join(root, 'src'))) {
    problems.push(...lintSource(relative(root, file), readFileSync(file, 'utf8')));
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const problems = lintTree(process.cwd());
  for (const p of problems) console.error(`${p.file}:${p.line}  ${p.message}`);
  if (problems.length) {
    console.error(`\nlint-styles: ${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log('lint-styles: ok');
}
