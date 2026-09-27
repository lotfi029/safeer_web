/**
 * Mock of safeer_api, shared by the Node e2e mock server (e2e/mock-api/server.mjs) and the in-app
 * dev interceptor (src/app/core/api/mocks) so the two can never drift (review F6). Shapes follow
 * docs/api/CONTRACT-NOTES.md; content comes only from mocks/fixtures (spec/prototype text or [...]).
 *
 * Every item here is live in the real API (safeer_api v1.0.0-rc1), and the e2e-real CI job runs the
 * same specs against it; the mock exists for fast, deterministic runs and for states the dev seed
 * lacks (seeded applications, preview tokens, staff accounts, auth tokens). The public fixtures are
 * recorded from the API (scripts/record-fixtures.mjs).
 */
import { adminRoutes, contactMessage } from './admin.mjs';
import { collapseBilingual, resolveLang } from './collapse.mjs';

export const MOCK_OTP_CODE = '123456';
export const MOCK_STAFF_PASSWORD = 'mock-password';
const FIXTURE_STAFF = new Set(
  ['admin', 'reviewer', 'editor', 'support'].map((r) => `${r}@mock.invalid`),
);

/** A staff row as the API returns it (PublicUser): never the password, lock state as isLocked/lockedUntil. */
function publicStaff(user) {
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
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const REQUIRED_DOC_TYPES = ['id_copy', 'certificate', 'admission_letter'];
const DOC_TYPES = [...REQUIRED_DOC_TYPES, 'other'];
const EDITABLE = ['draft'];
const STEP1 = [
  'firstName',
  'middleName',
  'lastName',
  'birthDate',
  'phone',
  'nationality',
  'idNumber',
  'email',
  'currentJob',
  'gender',
];
const STEP2 = ['university', 'major', 'degreeLevel', 'scholarshipNote'];
const NULLABLE = ['middleName', 'idNumber', 'currentJob', 'scholarshipNote'];

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

/** Minimal strict-schema checks mirroring application-fields.schema.ts. */
function validateFields(body, { allowed, required = [] }) {
  const issues = [];
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key))
      issues.push({ path: [key], message: 'Unrecognized key', code: 'unrecognized_keys' });
  }
  for (const key of required) {
    if (body[key] === undefined || body[key] === null || body[key] === '')
      issues.push({ path: [key], message: 'Required', code: 'invalid_type' });
  }
  for (const [key, value] of Object.entries(body)) {
    if (value === null && !NULLABLE.includes(key))
      issues.push({ path: [key], message: 'Expected string, received null', code: 'invalid_type' });
    if (value === '')
      issues.push({
        path: [key],
        message: 'String must contain at least 1 character(s)',
        code: 'too_small',
      });
    if (key === 'email' && value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))
      issues.push({ path: [key], message: 'Invalid email', code: 'invalid_string' });
    if (key === 'birthDate' && value && !/^\d{4}-\d{2}-\d{2}$/.test(value))
      issues.push({ path: [key], message: 'Invalid date', code: 'invalid_string' });
    if (key === 'nationality' && value && !/^[A-Za-z]{2}$/.test(value))
      issues.push({ path: [key], message: 'Invalid country', code: 'invalid_string' });
    if (key === 'gender' && value && !['male', 'female'].includes(value))
      issues.push({ path: [key], message: 'Invalid enum value', code: 'invalid_enum_value' });
    if (key === 'degreeLevel' && value && !['bachelor', 'master', 'phd'].includes(value))
      issues.push({ path: [key], message: 'Invalid enum value', code: 'invalid_enum_value' });
    if (key === 'consent' && typeof value !== 'boolean')
      issues.push({ path: [key], message: 'Expected boolean', code: 'invalid_type' });
  }
  return issues;
}

function deriveTimeline(app) {
  const keys = ['received', 'documents', 'review', 'interview', 'decision'];
  const map = {
    draft: ['pending', 'pending', 'pending', 'pending', 'pending'],
    new: ['done', 'done', 'now', 'pending', 'pending'],
    under_review: ['done', 'done', 'now', 'pending', 'pending'],
    docs_missing: ['done', 'now', 'pending', 'pending', 'pending'],
    interview: ['done', 'done', 'done', 'now', 'pending'],
    accepted: ['done', 'done', 'done', 'done', 'done'],
    rejected: ['done', 'done', 'done', app.interview ? 'done' : 'pending', 'done'],
  };
  return keys.map((key, i) => ({ key, state: map[app.status][i] }));
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
    applicantSessions: new Map(),
    applications: new Map(clone(fixtures.applications ?? []).map((a) => [a.id, a])),
    otps: new Map(),
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

  function applicantFrom(req) {
    const sid = cookie(req.headers.cookie, 'sf_app_sid');
    const session = sid ? db.applicantSessions.get(sid) : undefined;
    return session ? { session, app: db.applications.get(session.applicationId) } : undefined;
  }

  function checkCsrf(req, expected) {
    return req.headers['x-csrf-token'] === expected;
  }

  function newApplicantSession(app) {
    const sid = token();
    const csrfToken = token();
    db.applicantSessions.set(sid, { applicationId: app.id, csrfToken });
    return { sid, csrfToken, cookie: `sf_app_sid=${sid}; Path=/; SameSite=Strict` };
  }

  function portalMe(app, session) {
    const actionNeeded = app.actionNeeded ?? null;
    return {
      reference: app.reference,
      status: app.status,
      currentStep: app.currentStep,
      personal: Object.fromEntries(STEP1.map((k) => [k, app[k] ?? null])),
      study: Object.fromEntries(STEP2.map((k) => [k, app[k] ?? null])),
      submittedAt: app.submittedAt ?? null,
      decidedAt: app.decidedAt ?? null,
      timeline: deriveTimeline(app),
      actionNeeded,
      recentEvents: (app.events ?? []).slice(-5).reverse(),
      interview: app.interview ?? null,
      csrfToken: session.csrfToken,
    };
  }

  function documentsOf(app) {
    const current = (app.documents ?? []).filter((d) => !d.supersededBy);
    const done = REQUIRED_DOC_TYPES.filter((t) =>
      current.some((d) => d.docType === t && d.status !== 'rejected'),
    );
    return {
      documents: current.map(
        ({ id, docType, originalName, mime, sizeBytes, status, rejectionReason, createdAt }) => ({
          id,
          docType,
          originalName,
          mime,
          sizeBytes,
          status,
          rejectionReason: rejectionReason ?? null,
          createdAt,
        }),
      ),
      completeness: {
        done: done.length,
        required: REQUIRED_DOC_TYPES.length,
        missingTypes: REQUIRED_DOC_TYPES.filter((t) => !done.includes(t)),
      },
    };
  }

  function findByIdentifier(identifier) {
    const id = String(identifier ?? '')
      .trim()
      .toLowerCase();
    const phone = id.replace(/[\s-]/g, '').replace(/^05/, '+9665');
    return [...db.applications.values()].find(
      (a) =>
        a.reference.toLowerCase() === id ||
        (a.email ?? '').toLowerCase() === id ||
        (a.phone ?? '').replace(/[\s-]/g, '') === phone,
    );
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
          !['scholarship', 'partnership', 'feedback', 'other'].includes(body.subject)
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

    // ---------- apply ----------
    [
      'POST',
      /^\/api\/v1\/applications$/,
      ({ body }) => {
        const issues = validateFields(body ?? {}, {
          allowed: STEP1,
          required: [
            'firstName',
            'lastName',
            'birthDate',
            'phone',
            'nationality',
            'email',
            'gender',
          ],
        });
        if (issues.length) return problem(400, 'VALIDATION_FAILED', { issues });
        // B2: a second active application for the same email OR phone (like the API).
        const digits = (x) => String(x ?? '').replace(/[\s-]/g, '');
        const samePhone = (x) => digits(x) === digits(body.phone);
        const active = [...db.applications.values()].find(
          (a) =>
            (a.email?.toLowerCase() === body.email.toLowerCase() || samePhone(a.phone)) &&
            !['accepted', 'rejected'].includes(a.status),
        );
        if (active) return problem(409, 'APPLICATION_EXISTS');
        const id = String(++db.seq);
        const app = {
          id,
          reference: `SA-${new Date().getFullYear()}-${String(db.seq).padStart(5, '0')}`,
          status: 'draft',
          currentStep: 1,
          ...body,
          documents: [],
          events: [],
        };
        db.applications.set(id, app);
        const s = newApplicantSession(app);
        return json(
          201,
          { reference: app.reference, csrfToken: s.csrfToken },
          { 'set-cookie': s.cookie },
        );
      },
    ],

    // ---------- portal auth ----------
    [
      'POST',
      /^\/api\/v1\/portal\/auth\/request-otp$/,
      ({ body }) => {
        const app = findByIdentifier(body?.identifier);
        if (app) db.otps.set(app.id, { code: MOCK_OTP_CODE, attempts: 0 });
        return json(200, { ok: true, channelHint: body?.channel ?? 'email' });
      },
    ],
    [
      'POST',
      /^\/api\/v1\/portal\/auth\/verify-otp$/,
      ({ body }) => {
        const app = findByIdentifier(body?.identifier);
        const otp = app && db.otps.get(app.id);
        if (!app || !otp || body?.code !== otp.code) return problem(401, 'OTP_INVALID');
        db.otps.delete(app.id);
        const s = newApplicantSession(app);
        return json(200, { csrfToken: s.csrfToken }, { 'set-cookie': s.cookie });
      },
    ],
    [
      'POST',
      /^\/api\/v1\/portal\/auth\/logout$/,
      ({ req }) => {
        const sid = cookie(req.headers.cookie, 'sf_app_sid');
        if (sid) db.applicantSessions.delete(sid);
        return json(
          200,
          { ok: true },
          { 'set-cookie': 'sf_app_sid=; Path=/; Max-Age=0; SameSite=Strict' },
        );
      },
    ],

    // ---------- portal (applicant session) ----------
    [
      'GET',
      /^\/api\/v1\/portal\/me$/,
      ({ req }) => {
        const a = applicantFrom(req);
        return a ? json(200, portalMe(a.app, a.session)) : problem(401, 'UNAUTHENTICATED');
      },
    ],
    [
      'GET',
      /^\/api\/v1\/portal\/notifications$/,
      ({ req, query }) => {
        const a = applicantFrom(req);
        if (!a) return problem(401, 'UNAUTHENTICATED');
        // C35: paged like the real API (newest first, limit ≤ 50).
        const page = Math.max(1, Number(query.get('page')) || 1);
        const limit = Math.min(50, Math.max(1, Number(query.get('limit')) || 20));
        const all = (a.app.events ?? [])
          .slice()
          .reverse()
          .map(({ id, type, createdAt, data }) => ({ id, type, createdAt, data: data ?? null }));
        return json(200, {
          data: all.slice((page - 1) * limit, page * limit),
          total: all.length,
          page,
          limit,
        });
      },
    ],
    [
      'PATCH',
      /^\/api\/v1\/portal\/application$/,
      ({ req, body }) => {
        const a = applicantFrom(req);
        if (!a) return problem(401, 'UNAUTHENTICATED');
        if (!checkCsrf(req, a.session.csrfToken)) return problem(403, 'FORBIDDEN');
        if (!EDITABLE.includes(a.app.status)) return problem(409, 'APPLICATION_LOCKED');
        const issues = validateFields(body ?? {}, { allowed: [...STEP1, ...STEP2, 'consent'] });
        if (issues.length) return problem(400, 'VALIDATION_FAILED', { issues });
        Object.assign(a.app, body);
        const touched = Object.keys(body).some((k) => STEP2.includes(k) || k === 'consent') ? 2 : 1;
        a.app.currentStep = Math.max(a.app.currentStep, touched);
        return json(200, { status: a.app.status, currentStep: a.app.currentStep });
      },
    ],
    [
      'POST',
      /^\/api\/v1\/portal\/application\/submit$/,
      ({ req, body }) => {
        const a = applicantFrom(req);
        if (!a) return problem(401, 'UNAUTHENTICATED');
        if (!checkCsrf(req, a.session.csrfToken)) return problem(403, 'FORBIDDEN');
        if (a.app.status !== 'draft') return problem(409, 'APPLICATION_LOCKED');
        const merged = { ...a.app, ...(body ?? {}) };
        const required = [
          'firstName',
          'lastName',
          'birthDate',
          'phone',
          'nationality',
          'email',
          'gender',
          'university',
          'major',
          'degreeLevel',
        ];
        const issues = required
          .filter((k) => !merged[k])
          .map((k) => ({ path: [k], message: 'Required', code: 'invalid_type' }));
        if (merged.consent !== true)
          issues.push({
            path: ['consent'],
            message: 'Invalid literal value, expected true',
            code: 'invalid_literal',
          });
        if (issues.length) return problem(400, 'VALIDATION_FAILED', { issues });
        const missing = documentsOf(a.app).completeness.missingTypes;
        if (missing.length) return problem(409, 'DOCUMENTS_INCOMPLETE', { missing });
        Object.assign(a.app, body, { status: 'new', submittedAt: nowIso(), currentStep: 3 });
        (a.app.events ??= []).push({
          id: token(),
          type: 'SUBMITTED',
          createdAt: a.app.submittedAt,
          data: null,
        });
        return json(200, { status: 'new', submittedAt: a.app.submittedAt });
      },
    ],
    [
      'GET',
      /^\/api\/v1\/portal\/documents$/,
      ({ req }) => {
        const a = applicantFrom(req);
        return a ? json(200, documentsOf(a.app)) : problem(401, 'UNAUTHENTICATED');
      },
    ],
    [
      'POST',
      /^\/api\/v1\/portal\/documents$/,
      ({ req, body }) => {
        const a = applicantFrom(req);
        if (!a) return problem(401, 'UNAUTHENTICATED');
        if (!checkCsrf(req, a.session.csrfToken)) return problem(403, 'FORBIDDEN');
        const docType = body?.docType;
        const file = body?.file;
        if (!DOC_TYPES.includes(docType) || !file)
          return problem(400, 'VALIDATION_FAILED', {
            issues: [{ path: ['docType'], message: 'Invalid', code: 'custom' }],
          });
        if (!ALLOWED_MIME.includes(file.type))
          return problem(400, 'VALIDATION_FAILED', {
            issues: [{ path: ['file'], message: 'Unsupported file type', code: 'custom' }],
          });
        if (file.size > MAX_UPLOAD_BYTES)
          return problem(400, 'VALIDATION_FAILED', {
            issues: [{ path: ['file'], message: 'File too large', code: 'custom' }],
          });
        // B3: draft, or docs_missing for rejected/requested types; never supersede an accepted doc.
        const docs = a.app.documents ?? (a.app.documents = []);
        const current = docs.find((d) => d.docType === docType && !d.supersededBy);
        const requested =
          a.app.actionNeeded?.docTypes ??
          (a.app.actionNeeded?.docType ? [a.app.actionNeeded.docType] : []);
        const allowed =
          a.app.status === 'draft' ||
          (a.app.status === 'docs_missing' &&
            (requested.includes(docType) || current?.status === 'rejected'));
        if (!allowed || current?.status === 'accepted') return problem(409, 'APPLICATION_LOCKED');
        const doc = {
          id: token(),
          docType,
          originalName: file.name,
          mime: file.type,
          sizeBytes: file.size,
          status: 'under_review',
          rejectionReason: null,
          createdAt: nowIso(),
        };
        if (current) current.supersededBy = doc.id;
        docs.push(doc);
        return json(201, doc);
      },
    ],
    [
      'DELETE',
      /^\/api\/v1\/portal\/documents\/([^/]+)$/,
      ({ req, params }) => {
        const a = applicantFrom(req);
        if (!a) return problem(401, 'UNAUTHENTICATED');
        if (!checkCsrf(req, a.session.csrfToken)) return problem(403, 'FORBIDDEN');
        if (a.app.status !== 'draft') return problem(409, 'APPLICATION_LOCKED');
        const docs = a.app.documents ?? [];
        const i = docs.findIndex((d) => d.id === params[0]);
        if (i < 0) return problem(404, 'NOT_FOUND');
        docs.splice(i, 1);
        return { status: 204, headers: {}, body: null };
      },
    ],
    [
      'GET',
      /^\/api\/v1\/portal\/documents\/([^/]+)\/file$/,
      ({ req, params }) => {
        const a = applicantFrom(req);
        if (!a) return problem(401, 'UNAUTHENTICATED');
        const doc = (a.app.documents ?? []).find((d) => d.id === params[0]);
        return doc
          ? {
              status: 200,
              headers: {
                'content-type': 'text/plain',
                'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`,
              },
              body: '[mock file]',
            }
          : problem(404, 'NOT_FOUND');
      },
    ],
    [
      'GET',
      /^\/api\/v1\/portal\/interview-slots$/,
      ({ req }) => {
        const a = applicantFrom(req);
        if (!a) return problem(401, 'UNAUTHENTICATED');
        if (a.app.status !== 'interview') return problem(409, 'INTERVIEW_NOT_AVAILABLE');
        if (a.app.interview) return json(200, []);
        return json(
          200,
          (db.fixtures.interviewSlots ?? [])
            .filter((s) => !s.applicationId && s.startsAt > nowIso())
            .map(({ id, startsAt, endsAt, location }) => ({
              id,
              startsAt,
              endsAt,
              location,
              applicationId: null,
            })),
        );
      },
    ],
    [
      'POST',
      /^\/api\/v1\/portal\/interview$/,
      ({ req, body }) => {
        const a = applicantFrom(req);
        if (!a) return problem(401, 'UNAUTHENTICATED');
        if (!checkCsrf(req, a.session.csrfToken)) return problem(403, 'FORBIDDEN');
        if (a.app.status !== 'interview') return problem(409, 'INTERVIEW_NOT_AVAILABLE');
        const slot = (db.fixtures.interviewSlots ?? []).find((s) => s.id === String(body?.slotId));
        if (!slot || slot.applicationId || a.app.interview)
          return problem(409, 'SLOT_ALREADY_BOOKED');
        slot.applicationId = a.app.id;
        a.app.interview = {
          id: slot.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          location: slot.location,
        };
        (a.app.events ??= []).push({
          id: token(),
          type: 'INTERVIEW_BOOKED',
          createdAt: nowIso(),
          data: null,
        });
        // C17: the booked slot (the real API returns the slot it booked).
        return json(201, a.app.interview);
      },
    ],
    [
      'DELETE',
      /^\/api\/v1\/portal\/interview$/,
      ({ req }) => {
        const a = applicantFrom(req);
        if (!a) return problem(401, 'UNAUTHENTICATED');
        if (!checkCsrf(req, a.session.csrfToken)) return problem(403, 'FORBIDDEN');
        if (!a.app.interview) return problem(404, 'NOT_FOUND');
        const slot = (db.fixtures.interviewSlots ?? []).find((s) => s.id === a.app.interview.id);
        if (slot) slot.applicationId = null;
        a.app.interview = null;
        (a.app.events ??= []).push({
          id: token(),
          type: 'INTERVIEW_CANCELLED',
          createdAt: nowIso(),
          data: null,
        });
        return json(200, { cancelled: true });
      },
    ],

    // ---------- staff ----------
    [
      'POST',
      /^\/api\/v1\/admin\/auth\/login$/,
      ({ body }) => {
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
        db.staffSessions.set(sid, { user: publicStaff(user), csrfToken });
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
