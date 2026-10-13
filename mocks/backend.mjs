/**
 * Mock of safeer_api, shared by the Node e2e mock server (e2e/mock-api/server.mjs) and the in-app
 * dev interceptor (src/app/core/api/mocks) so the two can never drift (review F6). Shapes follow
 * docs/api/CONTRACT-NOTES.md; content comes only from mocks/fixtures (spec/prototype text or [...]).
 *
 * Every item here is live in the real API (safeer_api), and the e2e-real CI job runs the same specs
 * against it; the mock exists for fast, deterministic runs and for states the dev seed lacks (preview
 * tokens, staff accounts, auth tokens). The public fixtures are
 * recorded from the API (scripts/record-fixtures.mjs).
 */
import { adminRoutes, contactMessage } from './admin.mjs';
import { collapseBilingual, resolveLang } from './collapse.mjs';

export const MOCK_STAFF_PASSWORD = 'mock-password';
const FIXTURE_STAFF = new Set(['admin', 'editor', 'support'].map((r) => `${r}@mock.invalid`));

/** A staff row as the API returns it (PublicUser): never the password, lock state as isLocked/lockedUntil. */
export function publicStaff(user) {
  const { password: _password, ...rest } = user;
  const lockedUntil = user.lockedUntil ?? null;
  return {
    id: rest.id,
    name: rest.name,
    email: rest.email,
    role: rest.role,
    status: user.status ?? 'active',
    isLocked: !!lockedUntil && Date.parse(lockedUntil) > Date.now(),
    lockedUntil,
    failedLogins: user.failedLogins ?? 0,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt ?? '2026-09-01T09:00:00.000Z',
    updatedAt: user.updatedAt ?? '2026-09-01T09:00:00.000Z',
  };
}
const json = (status, body, headers = {}) => ({
  status,
  headers: { 'content-type': 'application/json', ...headers },
  body,
});
const problem = (status, code, extra = {}) =>
  json(
    status,
    {
      type: `https://safeer-sa.org/errors/${code.toLowerCase().replace(/_/g, '-')}`,
      title: code,
      status,
      code,
      requestId: 'mock',
      ...extra,
    },
    { 'content-type': 'application/problem+json' },
  );
const clone = (v) => JSON.parse(JSON.stringify(v));
const nowIso = () => new Date().toISOString();

function cookie(header, name) {
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

function token() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function createMockBackend(fixtures) {
  const db = {
    fixtures: clone(fixtures),
    staffSessions: new Map(),
    loginAttempts: new Map(),
    // W16: `purpose:token` of the unused invitation/reset links (single-use, like the API).
    // `purpose:token` → the staff id it belongs to (null for the two demo links).
    authTokens: new Map([
      ['accept:mock-invite', null],
      ['reset:mock-reset', null],
    ]),
    newsletter: new Map(),
    messages: [],
    audit: [],
    seq: 184,
  };

  const collapse = (value, lang) => collapseBilingual(clone(value), lang);

  function staffFrom(req) {
    const sid = cookie(req.headers.cookie, 'sf_sid');
    return sid ? db.staffSessions.get(sid) : undefined;
  }

  function checkCsrf(req, expected) {
    return req.headers['x-csrf-token'] === expected;
  }

  const routes = [
    // ---------- health ----------
    ['GET', /^\/api\/v1\/health$/, () => json(200, { status: 'ok' })],

    // ---------- public content ----------
    ['GET', /^\/api\/v1\/site$/, ({ lang }) => json(200, collapse(db.fixtures.site, lang))],
    [
      'GET',
      /^\/api\/v1\/home$/,
      ({ lang }) =>
        db.fixtures.home ? json(200, collapse(db.fixtures.home, lang)) : problem(404, 'NOT_FOUND'),
    ],
    [
      'GET',
      /^\/api\/v1\/pages\/([a-z0-9-]+)$/,
      ({ lang, params }) => {
        const page = (db.fixtures.pages ?? []).find((p) => p.slug === params[0]);
        return page ? json(200, collapse(page, lang)) : problem(404, 'NOT_FOUND');
      },
    ],
    [
      'GET',
      /^\/api\/v1\/about-items$/,
      ({ lang, query }) => {
        const kinds = String(query.get('kind') ?? '')
          .split(',')
          .filter(Boolean);
        const all = db.fixtures.aboutItems ?? {};
        const out = {};
        for (const kind of kinds.length ? kinds : Object.keys(all))
          if (all[kind]) out[kind] = all[kind];
        return json(200, collapse(out, lang));
      },
    ],
    [
      'GET',
      /^\/api\/v1\/board$/,
      ({ lang }) => json(200, collapse(db.fixtures.board ?? { board: [], executive: [] }, lang)),
    ],
    [
      'GET',
      /^\/api\/v1\/work-areas$/,
      ({ lang }) => json(200, collapse(db.fixtures.workAreas ?? [], lang)),
    ],
    [
      'GET',
      /^\/api\/v1\/testimonials$/,
      ({ lang }) =>
        json(
          200,
          collapse(db.fixtures.testimonials ?? { featured: [], list: [], themes: [] }, lang),
        ),
    ],
    [
      'GET',
      /^\/api\/v1\/partners$/,
      ({ lang, query }) => {
        const category = query.get('category');
        const list = (db.fixtures.partners ?? []).filter(
          (p) => !category || p.category === category,
        );
        return json(200, collapse(list, lang));
      },
    ],
    [
      'GET',
      /^\/api\/v1\/documents$/,
      ({ lang }) => json(200, collapse(db.fixtures.documents ?? [], lang)),
    ],
    [
      'GET',
      /^\/api\/v1\/news-categories$/,
      ({ lang }) => json(200, collapse(db.fixtures.newsCategories ?? [], lang)),
    ],
    [
      'GET',
      /^\/api\/v1\/news\/featured$/,
      ({ lang }) => {
        const post = (db.fixtures.posts ?? []).find((p) => p.isFeatured && p.isPublished !== false);
        return json(200, post ? collapse(summary(post), lang) : null);
      },
    ],
    [
      'GET',
      /^\/api\/v1\/news$/,
      ({ lang, query }) => {
        const page = Math.max(1, Number(query.get('page')) || 1);
        const limit = Math.min(48, Math.max(1, Number(query.get('limit')) || 12));
        const category = query.get('category');
        // C42: an unknown category is a 400, like the real API.
        if (category && !(db.fixtures.newsCategories ?? []).some((c) => c.slug === category))
          return problem(400, 'VALIDATION_FAILED');
        const q = (query.get('q') ?? '').trim().toLowerCase();
        const all = (db.fixtures.posts ?? [])
          .filter((p) => !category || p.category?.slug === category)
          .filter(
            (p) =>
              !q ||
              `${p.titleAr} ${p.titleEn ?? ''} ${p.excerptAr ?? ''} ${p.excerptEn ?? ''}`
                .toLowerCase()
                .includes(q),
          )
          .sort((a, b) => (b.publishedOn ?? '').localeCompare(a.publishedOn ?? '')); // DESC, NULLs last (MySQL)
        return json(200, {
          data: collapse(all.slice((page - 1) * limit, page * limit).map(summary), lang),
          total: all.length,
          page,
          limit,
        });
      },
    ],
    [
      'GET',
      /^\/api\/v1\/news\/([^/]+)$/,
      ({ lang, params, query }) => {
        const post = (db.fixtures.posts ?? []).find(
          (p) => p.slug === decodeURIComponent(params[0]),
        );
        if (!post || (!post.isPublished && query.get('preview') !== 'mock-preview'))
          return problem(404, 'NOT_FOUND');
        const related = (db.fixtures.posts ?? [])
          .filter((p) => p.id !== post.id && p.isPublished !== false)
          .slice(0, 3)
          .map(summary);
        return json(
          200,
          collapse(
            {
              ...summary(post),
              bodyAr: post.bodyAr,
              bodyEn: post.bodyEn,
              readMinutes: post.readMinutes ?? 2,
              related,
              ...(post.isPublished === false
                ? { previewFileQuery: `preview=mock-preview&post=${post.id}` }
                : {}),
            },
            lang,
          ),
        );
      },
    ],
    [
      'GET',
      /^\/api\/v1\/sitemap-index$/,
      () =>
        json(200, {
          pages: (db.fixtures.pages ?? []).map((p) => ({
            slug: p.slug,
            updatedAt: p.updatedAt ?? '2026-09-01T00:00:00.000Z',
          })),
          posts: (db.fixtures.posts ?? [])
            .filter((p) => p.isPublished !== false)
            .map((p) => ({ slug: p.slug, updatedAt: p.updatedAt ?? p.publishedOn })),
          categories: (db.fixtures.newsCategories ?? []).map((c) => ({ slug: c.slug })),
        }),
    ],
    [
      'GET',
      /^\/api\/v1\/meta\/countries$/,
      ({ lang }) => json(200, collapse(db.fixtures.countries ?? [], lang)),
    ],
    [
      'GET',
      /^\/api\/v1\/redirects\/resolve$/,
      ({ query }) => {
        const hit = (db.fixtures.redirects ?? []).find((r) => r.fromPath === query.get('path'));
        return hit
          ? json(200, { toPath: hit.toPath, statusCode: hit.statusCode ?? 301 })
          : problem(404, 'NOT_FOUND');
      },
    ],

    // ---------- public forms ----------
    [
      'POST',
      /^\/api\/v1\/contact$/,
      ({ body, lang }) => {
        const issues = [];
        for (const k of ['name', 'email', 'subject', 'body'])
          if (!body?.[k]) issues.push({ path: [k], message: 'Required', code: 'invalid_type' });
        if (body?.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email))
          issues.push({ path: ['email'], message: 'Invalid email', code: 'invalid_string' });
        // The API's personName(): Arabic or Latin letters, marks, spaces, ' and - only.
        if (
          body?.name &&
          !/^(?:(?=[\p{Script=Arabic}\p{Script=Latin}])\p{L}|\p{M}|['’ -])+$/u.test(body.name)
        )
          issues.push({
            path: ['name'],
            message: "must contain only Arabic or Latin letters, spaces, ' and -",
            code: 'invalid_format',
          });
        if (
          body?.subject &&
          !['inquiry', 'partnership', 'support', 'feedback', 'other'].includes(body.subject)
        )
          issues.push({
            path: ['subject'],
            message: 'Invalid enum value',
            code: 'invalid_enum_value',
          });
        if (typeof body?.formRenderedAt !== 'number')
          issues.push({ path: ['formRenderedAt'], message: 'Required', code: 'invalid_type' });
        if (issues.length) return problem(400, 'VALIDATION_FAILED', { issues });
        if (!body.website) db.messages.push(contactMessage(db, body, lang, nowIso));
        return json(201, { ok: true });
      },
    ],
    [
      'POST',
      /^\/api\/v1\/newsletter$/,
      ({ body, lang }) => {
        if (!body?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email))
          return problem(400, 'VALIDATION_FAILED', {
            issues: [{ path: ['email'], message: 'Invalid email', code: 'invalid_string' }],
          });
        // A NewsletterSubscriber row (the admin newsletter list shows these).
        const address = String(body.email).trim().toLowerCase();
        if (!body.website && !db.newsletter.has(address))
          db.newsletter.set(address, {
            id: String(++db.seq),
            email: address,
            locale: lang,
            confirmedAt: null,
            ipHash: null,
            unsubscribedAt: null,
            createdAt: nowIso(),
          });
        // rc1 answers a bare `{ ok: true }` (CONTRACT-NOTES mentions `pendingConfirmation`; it isn't sent).
        return json(201, { ok: true });
      },
    ],
    [
      'POST',
      /^\/api\/v1\/newsletter\/confirm$/,
      ({ body }) => {
        if (!body?.email || body?.token !== 'mock-token')
          return problem(400, 'VALIDATION_FAILED', {
            issues: [{ path: ['token'], message: 'Invalid token', code: 'custom' }],
          });
        // Like the API: sets confirmedAt on a pending, still-subscribed row (if any).
        const row = db.newsletter.get(String(body.email).trim().toLowerCase());
        if (row && !row.confirmedAt && !row.unsubscribedAt) row.confirmedAt = nowIso();
        return json(200, { ok: true });
      },
    ],
    [
      'POST',
      /^\/api\/v1\/newsletter\/unsubscribe$/,
      ({ body }) => {
        if (!body?.email || body?.token !== 'mock-token')
          return problem(400, 'VALIDATION_FAILED', {
            issues: [{ path: ['token'], message: 'Invalid token', code: 'custom' }],
          });
        const row = db.newsletter.get(String(body.email).trim().toLowerCase());
        if (row && !row.unsubscribedAt) row.unsubscribedAt = nowIso();
        return json(200, { ok: true });
      },
    ],

    // ---------- staff ----------
    [
      'POST',
      /^\/api\/v1\/admin\/auth\/login$/,
      ({ req, body }) => {
        const email = String(body?.email ?? '').toLowerCase();
        // Like the API's per-email limiter (5/min), except for the shared fixture accounts that
        // parallel mock specs all sign in with.
        if (!FIXTURE_STAFF.has(email)) {
          const now = Date.now();
          const recent = (db.loginAttempts.get(email) ?? []).filter((t) => now - t < 60_000);
          recent.push(now);
          db.loginAttempts.set(email, recent);
          if (recent.length > 5) return problem(429, 'RATE_LIMITED');
        }
        const user = (db.fixtures.staff ?? []).find((u) => u.email.toLowerCase() === email);
        // A2/C3: unknown, wrong password, disabled and locked all get the same 401.
        const usable =
          user &&
          body?.password === (user.password ?? MOCK_STAFF_PASSWORD) &&
          (user.status ?? 'active') === 'active' &&
          !(user.lockedUntil && Date.parse(user.lockedUntil) > Date.now());
        if (!usable) return problem(401, 'UNAUTHENTICATED');
        const sid = token();
        const csrfToken = token();
        const at = nowIso();
        db.staffSessions.set(sid, {
          id: String(++db.seq),
          user: publicStaff(user),
          csrfToken,
          userAgent: req.headers['user-agent'] ?? null,
          createdAt: at,
          lastSeenAt: at,
        });
        return json(
          200,
          { user: publicStaff(user), csrfToken },
          { 'set-cookie': `sf_sid=${sid}; Path=/; SameSite=Strict` },
        );
      },
    ],
    [
      'GET',
      /^\/api\/v1\/admin\/me$/,
      ({ req }) => {
        const s = staffFrom(req);
        return s
          ? json(200, { ...s.user, csrfToken: s.csrfToken })
          : problem(401, 'UNAUTHENTICATED');
      },
    ],
    [
      'POST',
      /^\/api\/v1\/admin\/auth\/logout$/,
      ({ req }) => {
        const sid = cookie(req.headers.cookie, 'sf_sid');
        if (sid) db.staffSessions.delete(sid);
        return json(
          200,
          { ok: true },
          { 'set-cookie': 'sf_sid=; Path=/; Max-Age=0; SameSite=Strict' },
        );
      },
    ],
    // Always `{ ok: true }` (no enumeration); the real API mails a reset link to active accounts.
    [
      'POST',
      /^\/api\/v1\/admin\/auth\/forgot$/,
      ({ body }) =>
        typeof body?.email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)
          ? json(201, { ok: true })
          : problem(400, 'VALIDATION_FAILED', {
              issues: [{ path: ['email'], message: 'Invalid email', code: 'invalid_string' }],
            }),
    ],
    // W16: invitation / reset links. Like the API: public, single-use tokens, `password` min 8, and
    // an unknown or used token is a 400 with no field issues ("invalid or expired").
    [
      'POST',
      /^\/api\/v1\/admin\/auth\/(accept|reset)\/([^/]+)$/,
      ({ params, body }) => {
        const [purpose, raw] = params;
        if (typeof body?.password !== 'string' || body.password.length < 8)
          return problem(400, 'VALIDATION_FAILED', {
            issues: [{ path: ['password'], message: 'Too small', code: 'too_small' }],
          });
        const key = `${purpose}:${decodeURIComponent(raw)}`;
        if (!db.authTokens.has(key)) return problem(400, 'VALIDATION_FAILED');
        // Like the API: the password is set and the account becomes active (accepting an invite).
        const user = (db.fixtures.staff ?? []).find((u) => u.id === db.authTokens.get(key));
        // C3: only an invited account can accept; only an active one can reset.
        if (user && (user.status ?? 'active') !== (purpose === 'accept' ? 'invited' : 'active'))
          return problem(400, 'VALIDATION_FAILED');
        if (user) {
          user.password = body.password;
          if (purpose === 'accept') user.status = 'active';
          user.lockedUntil = null;
        }
        db.authTokens.delete(key);
        return json(200, { ok: true });
      },
    ],
    [
      'GET',
      /^\/api\/v1\/admin\/roles$/,
      ({ req }) =>
        staffFrom(req)
          ? json(200, { roles: db.fixtures.roles.roles, matrix: db.fixtures.roles.matrix })
          : problem(401, 'UNAUTHENTICATED'),
    ],

    // ---------- admin (mocks/admin.mjs) ----------
    ...adminRoutes({ db, json, problem, clone, nowIso, token, staffFrom, checkCsrf }),
  ];

  function summary(p) {
    const {
      id,
      slug,
      titleAr,
      titleEn,
      excerptAr,
      excerptEn,
      publishedOn,
      isFeatured,
      coverAsset,
      category,
    } = p;
    return {
      id,
      slug,
      titleAr,
      titleEn,
      excerptAr,
      excerptEn,
      publishedOn,
      isFeatured: !!isFeatured,
      coverAsset: coverAsset ?? null,
      category: category ?? null,
    };
  }

  /**
   * @param {{ method: string, url: string, headers: Record<string, string|undefined>, body?: any }} req
   *   `url` is path + query; `body` is parsed JSON or `{ docType, file: { name, size, type } }` for uploads.
   */
  function handle(req) {
    const url = new URL(req.url, 'http://mock');
    const lang = resolveLang(url.searchParams.get('lang'), req.headers['accept-language']);
    for (const [method, pattern, handler] of routes) {
      if (method !== req.method) continue;
      const m = pattern.exec(url.pathname);
      if (m)
        return handler({ req, body: req.body, params: m.slice(1), query: url.searchParams, lang });
    }
    return problem(404, 'NOT_FOUND');
  }

  return { handle, db };
}
