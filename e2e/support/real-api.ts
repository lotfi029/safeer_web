/**
 * Stage 2: API-level setup that works on both backends, so one spec runs against the mock and the real
 * API. Staff accounts come from real-db.ts on the real API and from the mock's fixture accounts (or the
 * mock-only `/__staff` route for disabled/locked variants) on the mock. Applications in a given status
 * are built through the public apply API and moved on by a seeded admin through the admin API (real),
 * or restored from the mock's seeded fixtures (mock). OTP codes come from the API's dev hook
 * (`GET /__dev/otp/:applicationId`, NODE_ENV=test) or the fixed mock code.
 */
import { request as pwRequest, type APIRequestContext, type APIResponse } from '@playwright/test';
import { randomInt } from 'node:crypto';
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
export const MOCK_OTP = '123456';
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
      id: { admin: '1', reviewer: '2', editor: '3', support: '4' }[role],
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
  async upload<T>(path: string, docType: string, file: UploadFile): Promise<T> {
    const res = await ApiClient.ok(
      await this.ctx.post(path, {
        multipart: {
          docType,
          file: { name: file.name, mimeType: file.mimeType, buffer: file.buffer },
        },
        headers: this.headers(),
      }),
      `UPLOAD ${path}`,
    );
    return (await res.json()) as T;
  }
  dispose(): Promise<void> {
    return this.ctx.dispose();
  }
}

export interface UploadFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export const pdf = (name: string): UploadFile => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n%e2e\n'),
});

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
/** One seeded admin per worker for setup calls (moving applications on, creating slots, reading inboxes). */
export function setupAdmin(): Promise<ApiClient> {
  adminClient ??= staffAccount('admin', { fresh: !usingMockApi }).then(staffClient);
  return adminClient;
}

export async function disposeSetupAdmin(): Promise<void> {
  const c = adminClient;
  adminClient = undefined;
  if (c) await (await c).dispose();
}

// ---------------------------------------------------------------- applications

export type AppStatus =
  'draft' | 'new' | 'under_review' | 'docs_missing' | 'interview' | 'accepted' | 'rejected';

/** Seeded in mocks/fixtures/applications.json (one application per status). */
export const MOCK_REFS: Record<AppStatus, string> = {
  under_review: 'SA-2026-00101',
  docs_missing: 'SA-2026-00102',
  interview: 'SA-2026-00103',
  accepted: 'SA-2026-00104',
  rejected: 'SA-2026-00105',
  new: 'SA-2026-00106',
  draft: 'SA-2026-00107',
};

export interface TestApplication {
  id: string;
  reference: string;
  email: string;
  status: AppStatus;
  /** A list search (`q`) that finds this application and its siblings made with the same tag. */
  search: string;
}

/** A fresh email and phone (the API refuses a second active application for either). */
export function newApplicant(tag: string) {
  const n = String(randomInt(0, 1e8)).padStart(8, '0');
  return { email: `${tag}-${n}@example.invalid`, phone: `+9665${n}` };
}

export const STEP1 = {
  firstName: 'Sara',
  lastName: 'Ali',
  birthDate: '2001-05-06',
  nationality: 'SA',
  gender: 'female',
} as const;
export const STEP2 = {
  university: '[University]',
  major: '[Major]',
  degreeLevel: 'bachelor',
} as const;

/** The files every submitted e2e application carries (same names as the mock fixtures' base names). */
export const DOC_FILES = {
  id_copy: pdf('id-card.pdf'),
  certificate: pdf('certificate.pdf'),
  admission_letter: pdf('admission.pdf'),
} as const;

interface AdminDoc {
  id: string;
  docType: string;
  status: string;
}

/**
 * An application in `status` for a portal or admin spec. Mock: a fresh copy of the seeded fixture
 * (`/__clone`), so specs never share one.
 * Real: created through the public API (step 1, step 2, consent, three documents, submit) and moved on
 * by the worker's seeded admin: `docs_missing` has its ID copy rejected (certificate and admission
 * accepted) and documents requested; `interview` passes through under_review.
 */
export async function applicationIn(
  status: AppStatus,
  tagIn: string = status,
): Promise<TestApplication> {
  const tag = tagIn.replace(/_/g, '-');
  if (usingMockApi) {
    const ctx = await pwRequest.newContext();
    try {
      const res = await ctx.post(
        `${MOCK_API_URL}/__clone?reference=${MOCK_REFS[status]}&tag=${encodeURIComponent(tag)}`,
      );
      const copy = (await res.json()) as { id: string; reference: string; email: string };
      return { ...copy, status, search: tag };
    } finally {
      await ctx.dispose();
    }
  }
  const who = newApplicant(tag);
  const applicant = await ApiClient.create();
  try {
    const { reference, csrfToken } = await applicant.post<{ reference: string; csrfToken: string }>(
      'applications',
      { ...STEP1, ...who },
    );
    applicant.csrf = csrfToken;
    const admin = await setupAdmin();
    const found = await admin.get<{ data: Array<{ id: string; reference: string }> }>(
      'admin/applications',
      { q: reference, status: 'draft' },
    );
    const id = found.data.find((a) => a.reference === reference)?.id;
    if (!id) throw new Error(`application ${reference} not found through the admin API`);
    const app: TestApplication = { id, reference, email: who.email, status, search: tag };
    if (status === 'draft') return app;

    await applicant.patch('portal/application', { ...STEP2, consent: true });
    for (const [docType, file] of Object.entries(DOC_FILES)) {
      await applicant.upload('portal/documents', docType, file);
    }
    await applicant.post('portal/application/submit', {
      ...STEP1,
      ...who,
      ...STEP2,
      consent: true,
    });
    if (status === 'new') return app;

    const path = `admin/applications/${id}`;
    await admin.patch(path, { status: 'under_review' });
    if (status === 'docs_missing') {
      const detail = await admin.get<{ documents: AdminDoc[] }>(path);
      for (const doc of detail.documents) {
        await admin.patch(
          `${path}/documents/${doc.id}`,
          doc.docType === 'id_copy'
            ? { status: 'rejected', reason: '[The ID copy is not readable]' }
            : { status: 'accepted' },
        );
      }
      await admin.post(`${path}/request-documents`, { docTypes: ['id_copy'] });
    } else if (status === 'interview' || status === 'accepted' || status === 'rejected') {
      await admin.patch(path, { status });
    }
    return app;
  } finally {
    await applicant.dispose();
  }
}

/** The sign-in code just issued for `app` (call after requesting it). */
export async function otpFor(app: TestApplication): Promise<string> {
  if (usingMockApi) return MOCK_OTP;
  const ctx = await pwRequest.newContext();
  try {
    const res = await ctx.get(`${API}/__dev/otp/${app.id}`);
    if (!res.ok()) throw new Error(`no OTP for ${app.reference}: ${res.status()}`);
    return ((await res.json()) as { code: string }).code;
  } finally {
    await ctx.dispose();
  }
}

/** Real API: open interview slots in the future (the mock has seeded ones). */
export async function openInterviewSlots(count = 2): Promise<Array<{ id: string }>> {
  if (usingMockApi) return [];
  const admin = await setupAdmin();
  const slots = [];
  // Days ahead plus a random minute offset keep parallel workers' slots from colliding.
  const base = Date.now() + (7 + randomInt(0, 300)) * 86_400_000 + randomInt(0, 600) * 60_000;
  for (let i = 0; i < count; i++) {
    const startsAt = new Date(base + i * 3_600_000);
    slots.push(
      await admin.post<{ id: string }>('admin/interview-slots', {
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 1_800_000).toISOString(),
        locationAr: '[المقر]',
        locationEn: '[Office]',
      }),
    );
  }
  return slots;
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
export async function postContact(tag: string, subject = 'scholarship'): Promise<TestMessage> {
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
