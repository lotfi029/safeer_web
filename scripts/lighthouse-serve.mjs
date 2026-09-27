/**
 * Serves the production build for Lighthouse CI (lighthouserc.cjs `startServerCommand`): the e2e mock
 * API (fixture content) plus `dist/safeer_web` with NODE_ENV=production, so the audit sees the real
 * artifact, headers and CSP. Prints "lighthouse-serve ready" once both answer their health checks.
 * Usage: node scripts/lighthouse-serve.mjs   (after `npm run build`)
 */
import { spawn } from 'node:child_process';

const API_PORT = Number(process.env['LH_API_PORT'] ?? 3190);
const SSR_PORT = Number(process.env['LH_SSR_PORT'] ?? 4300);

const children = [
  spawn(process.execPath, ['e2e/mock-api/server.mjs'], {
    env: { ...process.env, MOCK_API_PORT: String(API_PORT) },
    stdio: 'inherit',
  }),
  spawn(process.execPath, ['dist/safeer_web/server/server.mjs'], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(SSR_PORT),
      API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`,
      PUBLIC_SITE_URL: `http://localhost:${SSR_PORT}`,
    },
    stdio: 'inherit',
  }),
];

function stop() {
  for (const child of children) child.kill();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
process.once('exit', stop);
for (const child of children) {
  child.once('exit', (code) => {
    stop();
    process.exit(code ?? 1);
  });
}

async function up(url) {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${url} did not come up`);
}

await up(`http://127.0.0.1:${API_PORT}/api/v1/health`);
await up(`http://localhost:${SSR_PORT}/healthz`);
console.log('lighthouse-serve ready');
