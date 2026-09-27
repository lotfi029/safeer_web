/**
 * Stage 2: direct access to the real API's e2e database, for the states the API can't produce on its
 * own: one staff user per role (the dev seed only has the bootstrap admin), disabled and locked
 * accounts, and invitation/reset tokens with a known raw value (the API only mails them).
 *
 * Active only when E2E_API_URL is set (the `e2e-real` job and local real-API runs); every call throws
 * otherwise, so a mock run can never touch MySQL. It connects to the database scripts/real-api.mjs
 * migrates (same env: DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME) and loads mysql2 and argon2 from
 * the API checkout (SAFEER_API_DIR, default ../safeer_api), so the hashes come from the exact argon2
 * build the API verifies with. Rows are written the way the API writes them (auth.service.ts,
 * session-token.util.ts), with every datetime from MySQL's UTC_TIMESTAMP(3): the API runs in UTC.
 *
 * Seeded users all have an `@e2e.invalid` email, and cleanup only ever matches on that domain.
 */
import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import type { TestType } from '@playwright/test';
import { apiEnv } from '../../scripts/api-env.mjs';

export type StaffRole = 'admin' | 'reviewer' | 'editor' | 'support';
export type StaffStatus = 'active' | 'disabled' | 'invited';
export type TokenPurpose = 'invite' | 'reset';

export interface SeededStaff {
  id: number;
  name: string;
  email: string;
  password: string;
  role: StaffRole;
}

/** Mirrors safeer_api src/auth/argon2-options.ts (drift-tested against docs/api/src/auth/argon2-options.ts). */
export const ARGON2_OPTIONS = { memoryCost: 65_536, timeCost: 3, parallelism: 4 } as const;
/** Mirrors auth.service.ts INVITE_TOKEN_HOURS / RESET_TOKEN_MINUTES. */
export const TOKEN_TTL = {
  invite: 'INTERVAL 48 HOUR',
  reset: 'INTERVAL 60 MINUTE',
} as const satisfies Record<TokenPurpose, string>;
export const E2E_EMAIL_DOMAIN = 'e2e.invalid';

export const realDbEnabled = !!process.env['E2E_API_URL'];

/** session-token.util.ts hashToken: SHA-256 hex of the raw base64url token. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** auth.service.ts: 32 random bytes, base64url. */
export function newRawToken(): string {
  return randomBytes(32).toString('base64url');
}

export function seededIdentity(role: StaffRole, rand = randomBytes(4).toString('hex')) {
  return { name: `E2E ${role} ${rand}`, email: `e2e-${role}-${rand}@${E2E_EMAIL_DOMAIN}` };
}

interface Conn {
  execute(sql: string, params?: unknown[]): Promise<[unknown, unknown]>;
  end(): Promise<void>;
}

let conn: Promise<Conn> | undefined;
const created = new Set<number>();

function apiRequire() {
  const apiDir = resolve(process.env['SAFEER_API_DIR'] ?? '../safeer_api');
  return createRequire(join(apiDir, 'package.json'));
}

function assertEnabled(): void {
  if (!realDbEnabled) throw new Error('real-db is only available when E2E_API_URL is set');
}

function db(): Promise<Conn> {
  assertEnabled();
  conn ??= (async () => {
    const env = apiEnv();
    const mysql = apiRequire()('mysql2/promise');
    return (await mysql.createConnection({
      host: env.DB_HOST,
      port: Number(env.DB_PORT),
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      timezone: 'Z',
    })) as Conn;
  })();
  return conn;
}

async function argonHash(password: string): Promise<string> {
  const argon2 = apiRequire()('argon2');
  return argon2.hash(password, { type: argon2.argon2id, ...ARGON2_OPTIONS });
}

/**
 * A temporary staff user with a known password. `locked` sets a brute-force lock one hour out
 * (locked_until/lock_count, migration 008); `status` covers disabled and invited accounts.
 */
export async function seedStaff(
  role: StaffRole,
  { status = 'active', locked = false }: { status?: StaffStatus; locked?: boolean } = {},
): Promise<SeededStaff> {
  const c = await db();
  const { name, email } = seededIdentity(role);
  const password = `e2e-${randomBytes(12).toString('base64url')}`;
  const [res] = await c.execute(
    `INSERT INTO users (name, email, password_hash, role, status, failed_logins, locked_until, lock_count)
     VALUES (?, ?, ?, ?, ?, 0, ${locked ? 'UTC_TIMESTAMP(3) + INTERVAL 1 HOUR' : 'NULL'}, ?)`,
    [name, email, await argonHash(password), role, status, locked ? 1 : 0],
  );
  const id = Number((res as { insertId: number }).insertId);
  created.add(id);
  return { id, name, email, password, role };
}

/** Ends a seeded lock as if its time had passed (no waiting on the real clock). */
export async function expireLock(userId: number): Promise<void> {
  const c = await db();
  await c.execute(
    'UPDATE users SET locked_until = UTC_TIMESTAMP(3) - INTERVAL 1 SECOND WHERE id = ? AND email LIKE ?',
    [userId, `%@${E2E_EMAIL_DOMAIN}`],
  );
}

/** Reads a seeded user's lockout columns (asserting the API's own lock after failed logins). */
export async function staffRow(userId: number) {
  const c = await db();
  const [rows] = await c.execute(
    'SELECT status, failed_logins AS failedLogins, locked_until AS lockedUntil, lock_count AS lockCount FROM users WHERE id = ?',
    [userId],
  );
  return (rows as Array<Record<string, unknown>>)[0];
}

/** An invitation or reset token stored exactly as the API stores one; returns the raw value for the link. */
export async function insertAuthToken(
  userId: number,
  purpose: TokenPurpose,
): Promise<{ token: string; hash: string }> {
  const c = await db();
  const token = newRawToken();
  const hash = hashToken(token);
  await c.execute(
    `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
     VALUES (?, ?, ?, UTC_TIMESTAMP(3) + ${TOKEN_TTL[purpose]})`,
    [userId, purpose, hash],
  );
  return { token, hash };
}

/**
 * Deletes the users this worker seeded plus any `@e2e.invalid` leftovers from a crashed run. Tokens and
 * sessions cascade; notes, events and replies they wrote keep their rows with the author set to NULL.
 */
export async function cleanupRealDb(): Promise<void> {
  if (!realDbEnabled || !conn) return;
  const c = await conn;
  await c.execute('DELETE FROM users WHERE email LIKE ?', [`%@${E2E_EMAIL_DOMAIN}`]);
  created.clear();
}

/** Deletes only the users this worker seeded (safe while other workers are still running). */
export async function cleanupSeeded(): Promise<void> {
  if (!realDbEnabled || !conn || !created.size) return;
  const c = await conn;
  const ids = [...created];
  await c.execute(
    `DELETE FROM users WHERE email LIKE ? AND id IN (${ids.map(() => '?').join(',')})`,
    [`%@${E2E_EMAIL_DOMAIN}`, ...ids],
  );
  created.clear();
}

export async function closeRealDb(): Promise<void> {
  if (!conn) return;
  const c = await conn;
  conn = undefined;
  await c.end();
}

/** Registers the per-file cleanup: `useRealDb(test)` at the top of a spec that seeds. */
export function useRealDb(test: TestType<object, object>): void {
  test.afterAll(async () => {
    await cleanupSeeded();
    await closeRealDb();
  });
}
