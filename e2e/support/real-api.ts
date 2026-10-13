/**
 * Stage 2: API-level setup that works on both backends, so one spec runs against the mock and the real
 * API. Staff accounts come from real-db.ts on the real API and from the mock's fixture accounts (or the
 * mock-only `/__staff` route for disabled/locked variants) on the mock. Contact messages and newsletter
 * sign-ups go through the public API and are found again through the admin API.
 */
import { request as pwRequest, type APIRequestContext, type APIResponse } from '@playwright/test';
import { MOCK_API_URL, usingMockApi } from './env';
import {
  expireLock,
  insertAuthToken,
  seedStaff,
  type StaffRole,
  type StaffStatus,
  type TokenPurpose,
} from './real-db';

export const API_ORIGIN = process.env['E2E_API_URL'] || MOCK_API_URL;
export const API = `${API_ORIGIN}/api/v1`;
const MOCK_STAFF_PASSWORD = 'mock-password';

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  role: StaffRole;
}

/**
 * A staff login for `role`. Real API: a fresh seeded user (its own login-limiter budget). Mock: the
 * fixture account, or a fresh mock user when a status/lock variant (or `fresh`) is asked for.
 */
export async function staffAccount(
  role: StaffRole,
  opts: { status?: StaffStatus; locked?: boolean; fresh?: boolean } = {},
): Promise<StaffAccount> {
  if (!usingMockApi) {
    const s = await seedStaff(role, opts);
    return { ...s, id: String(s.id) };
  }
  if (!opts.status && !opts.locked && !opts.fresh) {
    return {
      id: { admin: '1', editor: '3', support: '4' }[role],
      name: '[...]',
      email: `${role}@mock.invalid`,
      password: MOCK_STAFF_PASSWORD,
      role,
    };
  }
  const ctx = await pwRequest.newContext();
  try {
    const res = await ctx.post(`${MOCK_API_URL}/__staff`, { data: { role, ...opts } });
    return (await res.json()) as StaffAccount;
  } finally {
    await ctx.dispose();
  }
}

/** An invitation (`invite`) or reset link token for `user` (the mock's own token store on the mock). */
export async function authToken(user: StaffAccount, purpose: TokenPurpose): Promise<string> {
  if (!usingMockApi) return (await insertAuthToken(Number(user.id), purpose)).token;
  const ctx = await pwRequest.newContext();
  try {
    const res = await ctx.post(`${MOCK_API_URL}/__auth-token`, {
      data: { purpose: purpose === 'invite' ? 'accept' : 'reset', userId: user.id },
    });
    return ((await res.json()) as { token: string }).token;
  } finally {
    await ctx.dispose();
  }
}

/** Lets a locked account's lock run out now. */
export async function unlockNow(user: StaffAccount): Promise<void> {
  if (!usingMockApi) return expireLock(Number(user.id));
  const ctx = await pwRequest.newContext();
  try {
    await ctx.post(`${MOCK_API_URL}/__staff/${user.id}/expire-lock`);
  } finally {
    await ctx.dispose();
  }
}

/** A signed-in API client with its own cookie jar; writes carry the session's CSRF token. */
export class ApiClient {
  constructor(
    readonly ctx: APIRequestContext,
    public csrf = '',
  ) {}

  static async create(): Promise<ApiClient> {
    return new ApiClient(await pwRequest.newContext({ baseURL: `${API}/` }));
  }

  private headers() {
    return this.csrf ? { 'x-csrf-token': this.csrf } : {};
  }

  private static async ok(res: APIResponse, what: string): Promise<APIResponse> {
    if (!res.ok()) throw new Error(`${what} → ${res.status()} ${await res.text()}`);
    return res;
  }

  async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const res = await ApiClient.ok(await this.ctx.get(path, { params }), `GET ${path}`);
    return (await res.json()) as T;
  }
  async post<T>(path: string, data?: unknown): Promise<T> {
    const res = await ApiClient.ok(
      await this.ctx.post(path, { data: data ?? {}, headers: this.headers() }),
      `POST ${path}`,
    );
    return (await res.json()) as T;
  }
  async patch<T>(path: string, data: unknown): Promise<T> {
    const res = await ApiClient.ok(
      await this.ctx.patch(path, { data, headers: this.headers() }),
      `PATCH ${path}`,
    );
    return (await res.json()) as T;
  }
  async del<T>(path: string): Promise<T> {
    const res = await ApiClient.ok(
      await this.ctx.delete(path, { headers: this.headers() }),
      `DELETE ${path}`,
    );
    return (await res.json()) as T;
  }
  dispose(): Promise<void> {
    return this.ctx.dispose();
  }
}

/** Signs `user` in through the API and returns a client carrying the staff session. */
export async function staffClient(user: StaffAccount): Promise<ApiClient> {
  const client = await ApiClient.create();
  const { csrfToken } = await client.post<{ csrfToken: string }>('admin/auth/login', {
    email: user.email,
    password: user.password,
  });
  client.csrf = csrfToken;
  return client;
}

let adminClient: Promise<ApiClient> | undefined;
/** One seeded admin per worker for setup calls (reading inboxes, seeding content). */
export function setupAdmin(): Promise<ApiClient> {
  adminClient ??= staffAccount('admin', { fresh: !usingMockApi }).then(staffClient);
  return adminClient;
}

export async function disposeSetupAdmin(): Promise<void> {
  const c = adminClient;
  adminClient = undefined;
  if (c) await (await c).dispose();
}

/** Contact/newsletter bodies the API accepts: `formRenderedAt` is already more than 3 s old. */
export const aged = () => Date.now() - 5000;

// ---------------------------------------------------------------- contact / newsletter

export interface TestMessage {
  id: string;
  name: string;
  email: string;
  body: string;
}

/**
 * A contact message sent through the public API (`formRenderedAt` 5 s old, so the API's too-fast check
 * keeps it), then found through the admin API: a silent spam drop also answers `{ ok: true }`.
 */
export async function postContact(tag: string, subject = 'inquiry'): Promise<TestMessage> {
  // The API's person-name rule allows Arabic/Latin letters, spaces, ' and - only (no digits).
  const name = `Sender ${lettersOnly(tag)}`;
  const email = `${tag}@example.invalid`;
  const body = `[${tag}] [...]`;
  const ctx = await pwRequest.newContext();
  try {
    const res = await ctx.post(`${API}/contact`, {
      data: { name, email, subject, body, website: '', formRenderedAt: aged() },
    });
    if (!res.ok()) throw new Error(`POST contact → ${res.status()} ${await res.text()}`);
  } finally {
    await ctx.dispose();
  }
  const found = await findMessage(name);
  if (!found) throw new Error(`contact message "${name}" was not stored`);
  return { id: found.id, name, email, body };
}

/** The newest inbox row from `name` (admin API), or undefined. */
export async function findMessage(
  name: string,
): Promise<{ id: string; status: string } | undefined> {
  const admin = await setupAdmin();
  const page = await admin.get<{ data: Array<{ id: string; name: string; status: string }> }>(
    'admin/messages',
    { limit: 100 },
  );
  return page.data.find((m) => m.name === name);
}

/** The subscriber row for `email` (admin API, newest first), or undefined. */
export async function findSubscriber(
  email: string,
): Promise<{ id: string; email: string } | undefined> {
  const admin = await setupAdmin();
  const page = await admin.get<{ data: Array<{ id: string; email: string }> }>('admin/newsletter', {
    limit: 100,
  });
  return page.data.find((s) => s.email === email);
}

/** Digits → letters, anything else outside a person-name → '-' (`msg-a-123` → `msg-a-bcd`). */
export function lettersOnly(value: string): string {
  return value.replace(/[0-9]/g, (d) => 'abcdefghij'[Number(d)]).replace(/[^A-Za-z' -]/g, '-');
}

/** A newsletter sign-up through the public API (aged `formRenderedAt`); returns the address. */
export async function postNewsletter(tag: string): Promise<string> {
  const email = `${tag}@example.invalid`;
  const ctx = await pwRequest.newContext();
  try {
    const res = await ctx.post(`${API}/newsletter`, {
      data: { email, website: '', formRenderedAt: aged() },
    });
    if (!res.ok()) throw new Error(`POST newsletter → ${res.status()} ${await res.text()}`);
  } finally {
    await ctx.dispose();
  }
  return email;
}
