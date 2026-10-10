#!/usr/bin/env node
/**
 * W1/W24: regenerate the public mock fixtures from a running safeer_api, so the mock can't drift from
 * the real response shapes. Each endpoint is fetched in `ar` and `en` and merged back into the
 * bilingual `xAr`/`xEn` form that mocks/collapse.mjs collapses (its exact inverse).
 *
 * Usage: node scripts/record-fixtures.mjs [--api http://127.0.0.1:3900] [--only board,partners] [--out mocks/fixtures]
 * Boot the API first (scripts/real-api.mjs). Review the diff: the mock-only e2e specs assert some
 * fixture content, so a recorded fixture can need a spec update.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Public fixtures and how to fetch them. Not recorded here: `posts` (the mock needs drafts, preview
 * tokens and bodies the list endpoint doesn't return), `testimonials` (the dev seed has no published
 * quotes), and the staff/portal fixtures (accounts, applications, slots), which are mock state.
 */
export const RECORDABLE = {
  site: { path: '/site' },
  home: { path: '/home' },
  board: { path: '/board' },
  workAreas: { path: '/work-areas' },
  partners: { path: '/partners' },
  documents: { path: '/documents' },
  newsCategories: { path: '/news-categories' },
  aboutItems: { path: '/about-items' },
};

/**
 * Merges the `ar` and `en` responses of one endpoint into a bilingual fixture: a string that differs
 * between the two becomes `xAr`/`xEn`; anything equal stays as-is (the API falls back to Arabic when
 * English is empty, so equal means "not translated", which collapse() also serves as-is).
 */
export function mergeBilingual(ar, en, path = '$') {
  if (Array.isArray(ar)) {
    if (!Array.isArray(en) || en.length !== ar.length) {
      throw new Error(`${path}: ar and en arrays differ in length`);
    }
    return ar.map((v, i) => mergeBilingual(v, en[i], `${path}[${i}]`));
  }
  if (ar !== null && typeof ar === 'object') {
    if (en === null || typeof en !== 'object' || Array.isArray(en)) {
      throw new Error(`${path}: ar is an object, en is not`);
    }
    const out = {};
    for (const [key, v] of Object.entries(ar)) {
      const w = en[key];
      if (typeof v === 'string' && typeof w === 'string' && v !== w) {
        out[`${key}Ar`] = v;
        out[`${key}En`] = w;
      } else {
        out[key] = mergeBilingual(v, w, `${path}.${key}`);
      }
    }
    return out;
  }
  return ar;
}

async function fetchLang(api, path, lang) {
  const url = `${api}/api/v1${path}${path.includes('?') ? '&' : '?'}lang=${lang}`;
  const res = await fetch(url, { headers: { 'Accept-Language': lang } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.json();
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const api = opt('api', process.env['E2E_API_URL'] || 'http://127.0.0.1:3900').replace(/\/$/, '');
  const out = opt('out', 'mocks/fixtures');
  const only = opt('only', '')?.split(',').filter(Boolean) ?? [];
  const names = only.length ? only : Object.keys(RECORDABLE);
  mkdirSync(out, { recursive: true });
  for (const name of names) {
    const spec = RECORDABLE[name];
    if (!spec)
      throw new Error(`unknown fixture "${name}" (recordable: ${Object.keys(RECORDABLE)})`);
    const [ar, en] = await Promise.all([
      fetchLang(api, spec.path, 'ar'),
      fetchLang(api, spec.path, 'en'),
    ]);
    const file = join(out, `${name}.json`);
    const merged = mergeBilingual(ar, en);
    // `_` keys are fixture metadata; collapse() drops them. Arrays can't carry one.
    const fixture = Array.isArray(merged)
      ? merged
      : {
          _source: `Recorded from GET /api/v1${spec.path} by scripts/record-fixtures.mjs`,
          ...merged,
        };
    writeFileSync(file, `${JSON.stringify(fixture, null, 2)}\n`);
    console.log(`recorded ${file}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
