#!/usr/bin/env node
/**
 * W24: migrate and boot a built safeer_api checkout for e2e against the real API. Shared by the `e2e-real`
 * CI job and local runs so the two can't drift. Does not build the API (`npm ci && npm run build` first).
 *
 * Usage: node scripts/real-api.mjs [apiDir=../safeer_api] [--detach] [--no-migrate]
 * Env (defaults): DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=root DB_PASSWORD='' DB_NAME=safeer API_PORT=3900
 *
 * NODE_ENV=test is deliberate: the API's TestAwareThrottlerGuard skips every per-IP @Throttle bucket
 * (applications 5/h, OTP 5/h, contact 3/h, admin login 5/min) unless a request sends
 * `x-test-enforce-throttle: 1`. Every e2e request reaches the API from 127.0.0.1 through the SSR proxy
 * with parallel workers, so ordering specs would not stay inside those budgets. `test` is in the API's
 * DEV_ENVS, so it still gets the dev seed (migrations/dev) and the dev OTP hook, exactly like development.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, openSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The e2e SSR origin (playwright.config.ts): emailed links and CORS point here. */
export const FRONTEND_ORIGIN = 'http://localhost:4100';

/**
 * The API's environment. Values mirror safeer_api's own CI job (none are real secrets: CI-only, no
 * production data ever touches these databases).
 */
export function apiEnv(env = process.env) {
  return {
    NODE_ENV: 'test',
    PORT: env.API_PORT || '3900',
    DB_HOST: env.DB_HOST || '127.0.0.1',
    DB_PORT: env.DB_PORT || '3306',
    DB_USER: env.DB_USER || 'root',
    DB_PASSWORD: env.DB_PASSWORD ?? '',
    DB_NAME: env.DB_NAME || 'safeer',
    SESSION_COOKIE_NAME: 'sf_sid',
    SESSION_IDLE_HOURS: '8',
    SESSION_ABSOLUTE_DAYS: '30',
    APP_ENCRYPTION_KEY: 'ukhiU9W4qpmJr9pwnzL01FaECwZTTOF3Y2vPKga7xrk=',
    STORAGE_DRIVER: 'local',
    STORAGE_ROOT: './var/assets',
    BOOTSTRAP_ADMIN_EMAIL: 'admin@safeer-sa.org',
    BOOTSTRAP_ADMIN_PASSWORD: 'ci-only-password-not-a-secret',
    IP_HASH_SALT: 'ci-only-salt-not-a-secret',
    CORS_ORIGINS: FRONTEND_ORIGIN,
    FRONTEND_BASE_URL: FRONTEND_ORIGIN,
    CACHE_TTL_SECONDS: '60',
    CACHE_MAX_ENTRIES: '500',
    ALLOW_DEV_PASSWORD_FIXUP: 'true',
  };
}

async function setCollation(apiDir, env) {
  // mysql:8.0 creates MYSQL_DATABASE with the server default; match the API's utf8mb4_unicode_ci.
  const mysql = createRequire(join(apiDir, 'package.json'))('mysql2/promise');
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await conn.query(
      `ALTER DATABASE \`${env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await conn.end();
  }
}

async function isUp(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

/** Polls until healthy; fails early if our own child exits (a port clash would otherwise look healthy). */
async function waitForHealth(url, child, timeoutMs = 60_000) {
  let exited = null;
  child.once('exit', (code) => (exited = code ?? 1));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exited !== null) throw new Error(`API exited with code ${exited} before it was healthy`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`API not healthy at ${url} after ${timeoutMs / 1000}s`);
}

async function main() {
  const args = process.argv.slice(2);
  const apiDir = resolve(args.find((a) => !a.startsWith('--')) ?? '../safeer_api');
  const detach = args.includes('--detach');
  if (!existsSync(join(apiDir, 'dist/main.js'))) {
    console.error(`No build in ${apiDir}: run "npm ci && npm run build" there first.`);
    process.exitCode = 1;
    return;
  }
  const env = { ...process.env, ...apiEnv() };
  const health = `http://127.0.0.1:${env.PORT}/health`;
  if (await isUp(health)) {
    console.error(`Something already answers on ${health}; stop it first (or set API_PORT).`);
    process.exitCode = 1;
    return;
  }

  if (!args.includes('--no-migrate')) {
    await setCollation(apiDir, env);
    const migrate = spawnSync(process.execPath, ['scripts/migrate.mjs'], {
      cwd: apiDir,
      env,
      stdio: 'inherit',
    });
    if (migrate.status !== 0) {
      process.exitCode = migrate.status ?? 1;
      return;
    }
  }

  const log = openSync(join(apiDir, 'api.log'), 'a');
  const api = spawn(process.execPath, ['--enable-source-maps', 'dist/main.js'], {
    cwd: apiDir,
    env,
    detached: detach,
    windowsHide: true,
    stdio: detach ? ['ignore', log, log] : 'inherit',
  });
  try {
    await waitForHealth(health, api);
  } catch (err) {
    console.error(`${err.message} (log: ${join(apiDir, 'api.log')})`);
    api.kill();
    process.exitCode = 1;
    return;
  }
  console.log(`safeer_api up (NODE_ENV=test): E2E_API_URL=http://127.0.0.1:${env.PORT}`);
  if (detach) {
    console.log(`pid ${api.pid}; log ${join(apiDir, 'api.log')}`);
    // Let the event loop drain rather than process.exit(): exiting with the child's handles open trips a libuv assertion on Windows.
    api.unref();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
