#!/usr/bin/env node
/**
 * Stage 2: records the response *shapes* (keys and value types, never values) of the admin endpoints
 * from a running safeer_api into mocks/fixtures/admin-shapes.json. mocks/admin-shapes.test.mjs then
 * checks the mock's admin responses against them, so the mock can't drift from rc1. No admin data
 * is hand-written: the mock builds its responses from its own state; this file only pins the shape.
 *
 * Usage: node scripts/record-admin-shapes.mjs [--api http://127.0.0.1:3900] [--only overview,messages]
 * Signs in as a temporary admin seeded through e2e/support/real-db.ts (removed afterwards; set
 * DB_PORT etc. as for scripts/real-api.mjs). The e2e database needs at least one application under
 * review and one contact message (run the e2e suite against it first).
 */
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * Endpoint → path. `{application}`/`{message}`/`{applicationWithDocs}` resolve from the list calls.
 * Phases 8–9 add their endpoints here.
 */
export const ADMIN_SHAPES = {
  me: '/admin/me',
  roles: '/admin/roles',
  overview: '/admin/overview',
  applications: '/admin/applications?limit=5&status=under_review',
  applicationCounts: '/admin/applications/counts',
  assignees: '/admin/applications/assignees',
  application: '/admin/applications/{application}',
  messages: '/admin/messages?limit=5',
  message: '/admin/messages/{message}',
  newsletter: '/admin/newsletter?limit=5',
};

/**
 * The shape of a JSON value: objects keep their keys, arrays the union of their elements' shapes
 * (first element wins per key), primitives become their type name, `null` stays `null`.
 */
export function shapeOf(value) {
  if (value === null) return null;
  if (Array.isArray(value)) {
    if (!value.length) return [];
    return [value.map(shapeOf).reduce(mergeShapes)];
  }
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shapeOf(v)]));
  }
  return typeof value;
}

/** Combines two shapes of the same field (fills `null` and empty arrays in from the other side). */
export function mergeShapes(a, b) {
  if (a === null || (Array.isArray(a) && !a.length)) return b ?? a;
  if (b === null || (Array.isArray(b) && !b.length)) return a;
  if (Array.isArray(a) && Array.isArray(b)) return [mergeShapes(a[0], b[0])];
  if (typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = k in out ? mergeShapes(out[k], v) : v;
    return out;
  }
  return a;
}

/**
 * Differences between an actual shape and the recorded one: missing or extra keys and type
 * mismatches. `null` (a nullable field that happened to be null), `[]` and `'any'` match anything.
 */
export function shapeDiff(actual, recorded, path = '$') {
  if (actual === null || recorded === null || recorded === 'any') return [];
  if (Array.isArray(actual) || Array.isArray(recorded)) {
    if (!Array.isArray(actual) || !Array.isArray(recorded)) return [`${path}: array vs non-array`];
    if (!actual.length || !recorded.length) return [];
    return shapeDiff(actual[0], recorded[0], `${path}[]`);
  }
  if (typeof actual === 'object' || typeof recorded === 'object') {
    if (typeof actual !== 'object' || typeof recorded !== 'object')
      return [`${path}: ${JSON.stringify(actual)} vs ${JSON.stringify(recorded)}`];
    const out = [];
    for (const k of Object.keys(recorded))
      if (!(k in actual)) out.push(`${path}.${k}: missing in the mock`);
    for (const k of Object.keys(actual))
      if (!(k in recorded)) out.push(`${path}.${k}: not in the API response`);
    for (const k of Object.keys(recorded))
      if (k in actual) out.push(...shapeDiff(actual[k], recorded[k], `${path}.${k}`));
    return out;
  }
  return actual === recorded ? [] : [`${path}: ${actual} vs ${recorded}`];
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const api = `${opt('api', process.env['E2E_API_URL'] || 'http://127.0.0.1:3900').replace(/\/$/, '')}/api/v1`;
  const out = opt('out', 'mocks/fixtures/admin-shapes.json');
  const only = opt('only', '')?.split(',').filter(Boolean) ?? [];
  process.env['E2E_API_URL'] ||= api.replace(/\/api\/v1$/, '');
  // Node strips the TypeScript types; real-db.ts only imports node built-ins and api-env.mjs.
  const db = await import('../e2e/support/real-db.ts');
  const admin = await db.seedStaff('admin');
  try {
    await record(api, admin, out, only);
  } finally {
    await db.cleanupSeeded();
    await db.closeRealDb();
  }
}

async function record(api, admin, out, only) {
  const login = await fetch(`${api}/admin/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: admin.email, password: admin.password }),
  });
  if (!login.ok) throw new Error(`login → ${login.status} ${await login.text()}`);
  const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
  const get = async (path) => {
    const res = await fetch(`${api}${path}`, { headers: { cookie } });
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.json();
  };

  const ids = {
    application: (await get('/admin/applications?limit=1&status=under_review')).data[0]?.id,
    message: (await get('/admin/messages?limit=1')).data[0]?.id,
  };
  const shapes = {
    _source: 'Recorded from safeer_api by scripts/record-admin-shapes.mjs (shapes only, no values)',
  };
  for (const [name, template] of Object.entries(ADMIN_SHAPES)) {
    if (only.length && !only.includes(name)) continue;
    const path = template.replace(/\{(\w+)\}/g, (_, k) => {
      if (!ids[k]) throw new Error(`${name}: no ${k} in the database to record`);
      return ids[k];
    });
    shapes[name] = shapeOf(await get(path));
    // An event's `data` differs by event type: pin only that it's there.
    if (name === 'application' && shapes[name].events?.[0]) shapes[name].events[0].data = 'any';
    console.log(`recorded ${name}`);
  }
  writeFileSync(out, `${JSON.stringify(shapes, null, 2)}\n`);
  console.log(`wrote ${out}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
