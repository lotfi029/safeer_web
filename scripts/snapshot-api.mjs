#!/usr/bin/env node
/**
 * W23: re-snapshot the backend contract into docs/api/ from a pinned safeer_api ref (a tag or SHA),
 * read with `git show` so the API checkout's working tree doesn't matter.
 * Usage: node scripts/snapshot-api.mjs <path-to-safeer_api> <ref>
 * Example: node scripts/snapshot-api.mjs ../safeer_api v1.0.0-rc1
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [repo, ref] = process.argv.slice(2);
if (!repo || !ref) {
  console.error('usage: node scripts/snapshot-api.mjs <path-to-safeer_api> <ref>');
  process.exit(1);
}

const git = (...args) =>
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const sha = git('rev-parse', '--short', `${ref}^{commit}`).trim();
const date = git('show', '-s', '--format=%cs', `${ref}^{commit}`).trim();

// Response shapes live in the public mappers, DTOs (request bodies), controllers (routes, status codes)
// and the few services that build a response inline.
const KEEP = [
  /^src\/.*\/public-[^/]+\.ts$/,
  /^src\/.*\/dto\/[^/]+\.ts$/,
  /^src\/.*\.controller\.ts$/,
  /^src\/common\/problem-details\/error-codes\.ts$/,
  /^src\/common\/query\/list-params\.ts$/,
  /^src\/applications\/application-fields\.schema\.ts$/,
  /^src\/admin-applications\/(admin-applications|admin-overview)\.service\.ts$/,
  /^src\/admin-applications\/transitions\.ts$/,
  /^src\/home\/home\.service\.ts$/,
  /^src\/portal\/(portal-application\.service|portal-documents\.util|portal-timeline|required-doc-types)\.ts$/,
  /^src\/auth\/(role-matrix|argon2-options|session-token\.util)\.ts$/,
  // Stage 2: services whose return values are the admin response shapes (no public mapper).
  /^src\/(messages\/messages|users\/users|media\/media|contact\/contact)\.service\.ts$/,
  /^src\/(mail\/mail|sms\/sms)-(settings|templates)\.service\.ts$/,
  /^src\/portal\/portal-interview\.service\.ts$/,
  /^src\/contact\/newsletter-token\.util\.ts$/,
];
const DOCS = ['openapi.json', 'docs/backend/API-CHANGES.md', 'docs/backend/ARCHITECTURE.md'];

const out = 'docs/api';
rmSync(join(out, 'src'), { recursive: true, force: true });
const files = git('ls-tree', '-r', '--name-only', ref)
  .split('\n')
  .filter((f) => KEEP.some((re) => re.test(f)));

for (const file of [...files, ...DOCS]) {
  const target = join(
    out,
    file.startsWith('docs/backend/') ? file.slice('docs/backend/'.length) : file,
  );
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, git('show', `${ref}:${file}`));
}

writeFileSync(
  join(out, 'SNAPSHOT.json'),
  JSON.stringify({ repo: 'lotfi029/safeer_api', ref, sha, date, files: files.length }, null, 2) +
    '\n',
);
console.log(
  `snapshot: ${files.length} source files + ${DOCS.length} docs from ${ref} (${sha}, ${date}) into ${out}/`,
);
