#!/usr/bin/env node
/**
 * S8 (VPS deploy review): load check for the SSR server's API proxy. Boots the mock API and the built
 * SSR server, sends sequential and concurrent keep-alive requests to /api/v1/site through it, and
 * fails if the server logs a MaxListenersExceededWarning or its memory keeps climbing between rounds.
 *
 * Usage: node scripts/proxy-load.mjs [serverEntry=dist/safeer_web-e2e/server/server.mjs]
 * Env: LOAD_ROUNDS (default 6), LOAD_SEQUENTIAL (500), LOAD_CONCURRENCY (20), LOAD_BATCHES (50)
 * RSS comes from /proc (Linux); elsewhere only the warning check runs.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Agent, request } from 'node:http';

const serverEntry = process.argv[2] ?? 'dist/safeer_web-e2e/server/server.mjs';
const API_PORT = 3195;
// Not 4190: that is ManageSieve, on the Fetch spec's blocked-port list.
const SSR_PORT = 4195;
const ROUNDS = Number(process.env.LOAD_ROUNDS ?? 6);
/** Rounds of warm-up (JIT, caches, the heap growing to its working size) before RSS is compared. */
const WARMUP_ROUNDS = 2;
const SEQUENTIAL = Number(process.env.LOAD_SEQUENTIAL ?? 500);
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY ?? 20);
const BATCHES = Number(process.env.LOAD_BATCHES ?? 50);

const children = [];
function start(command, args, env) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  return child;
}
process.on('exit', () => children.forEach((c) => c.kill()));

async function waitFor(url, output = () => '') {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch (e) {
      if (process.env.LOAD_DEBUG) console.error(url, String(e.cause ?? e.message));
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${url} did not come up\n${output()}`);
}

function get(agent, path) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: SSR_PORT, path, agent }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
}

function rssMb(pid) {
  try {
    const kb = Number(/VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'))?.[1]);
    return Math.round(kb / 102.4) / 10;
  } catch {
    return null;
  }
}

start(process.execPath, ['e2e/mock-api/server.mjs'], { MOCK_API_PORT: String(API_PORT) });
const ssr = start(process.execPath, [serverEntry], {
  NODE_ENV: 'production',
  HOST: '127.0.0.1',
  PORT: String(SSR_PORT),
  API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`,
  PUBLIC_SITE_URL: `http://localhost:${SSR_PORT}`,
  TRUST_PROXY: '1',
});
let stderr = '';
let stdout = '';
ssr.stderr.on('data', (d) => (stderr += d));
ssr.stdout.on('data', (d) => (stdout += d));

await waitFor(`http://127.0.0.1:${API_PORT}/api/v1/health`);
await waitFor(`http://127.0.0.1:${SSR_PORT}/healthz`, () => stdout + stderr);

const samples = [];
let total = 0;
for (let round = 1; round <= ROUNDS; round++) {
  const sequential = new Agent({ keepAlive: true, maxSockets: 1 });
  for (let i = 0; i < SEQUENTIAL; i++) {
    if ((await get(sequential, '/api/v1/site?lang=ar')) !== 200) throw new Error('non-200');
  }
  sequential.destroy();
  const pooled = new Agent({ keepAlive: true, maxSockets: CONCURRENCY });
  for (let b = 0; b < BATCHES; b++) {
    const statuses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => get(pooled, '/api/v1/site?lang=en')),
    );
    if (statuses.some((s) => s !== 200)) throw new Error('non-200');
  }
  pooled.destroy();
  total += SEQUENTIAL + CONCURRENCY * BATCHES;
  samples.push(rssMb(ssr.pid));
  console.log(`round ${round}: ${total} requests, SSR RSS ${samples.at(-1) ?? 'n/a'} MB`);
}

const warned = /MaxListenersExceededWarning/.test(stderr);
console.log(`MaxListenersExceededWarning: ${warned ? 'YES' : 'none'}`);
// After the warm-up rounds, RSS must stay flat: a per-request leak grows with every round.
const settled = samples.slice(WARMUP_ROUNDS).filter((s) => s !== null);
const growth = settled.length > 1 ? settled.at(-1) - settled[0] : 0;
console.log(
  `RSS, rounds ${WARMUP_ROUNDS + 1} → ${ROUNDS}: ${settled.join(' → ')} MB (growth ${growth.toFixed(1)} MB)`,
);
if (warned) process.exit(1);
if (growth > 10) {
  console.error('RSS kept growing between rounds');
  process.exit(1);
}
console.log('proxy load check: ok');
process.exit(0);
