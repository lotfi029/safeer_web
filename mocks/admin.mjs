/**
 * Admin routes of the mock API (Stage 2). Shapes follow safeer_api (docs/api/src: the overview,
 * messages.service.ts, admin-newsletter.controller.ts) and
 * are checked against responses recorded from the real API (mocks/admin-shapes.test.mjs). Role
 * checks use the same matrix as `GET /admin/roles`; writes need the staff CSRF token.
 *
 * Every route here is live in the real API; the e2e suite runs against both.
 */

import { contentRoutes } from './admin-content.mjs';
import { systemRoutes } from './admin-system.mjs';

/**
 * @param {object} ctx
 * @param {any} ctx.db mock state (createMockBackend)
 * @param {Function} ctx.json
 * @param {Function} ctx.problem
 * @param {Function} ctx.clone
 * @param {Function} ctx.nowIso
 * @param {Function} ctx.token
 * @param {Function} ctx.staffFrom
 * @param {Function} ctx.checkCsrf
 */
export function adminRoutes(ctx) {
  const { db, json, problem, clone, nowIso, token, staffFrom, checkCsrf } = ctx;
  db.messages ??= [];
  db.audit ??= [];
  db.seq ??= 184;

  /** Signed-in staff allowed in `area` (and, for writes, holding the CSRF token), or a problem. */
  function guard(req, area, { write = false } = {}) {
    const s = staffFrom(req);
    if (!s) return { error: problem(401, 'UNAUTHENTICATED') };
    if (write && !checkCsrf(req, s.csrfToken)) return { error: problem(403, 'FORBIDDEN') };
    if (area && !(db.fixtures.roles.matrix[area] ?? []).includes(s.user.role))
      return { error: problem(403, 'FORBIDDEN') };
    return { staff: s.user };
  }

  /** An audit row as the API stores it (the overview adds `actorName`; the audit list doesn't). */
  function audit(staff, action, entityType, entityId, entityLabel, diff = null) {
    db.audit.unshift({
      id: String(db.audit.length + 1),
      actorId: staff?.id ?? null,
      action,
      entityType,
      entityId,
      entityLabel,
      diff,
      ipHash: null,
      createdAt: nowIso(),
    });
  }

  const staffName = (id) => (db.fixtures.staff ?? []).find((u) => u.id === id)?.name ?? null;

  function pageOf(rows, query) {
    const limit = Math.min(100, Math.max(1, Number(query.get('limit')) || 20));
    const page = Math.max(1, Number(query.get('page')) || 1);
    return { data: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit };
  }

  /** `GET /admin/overview` without the application blocks (removed with the scholarship feature). */
  function overview(staff) {
    const can = (area) => (db.fixtures.roles.matrix[area] ?? []).includes(staff.role);
    const statCards = {};
    const badges = {};
    if (can('inbox')) {
      statCards.unreadMessages = db.messages.filter((m) => m.status === 'unread').length;
      badges.unreadMessages = statCards.unreadMessages;
    }
    return {
      statCards,
      contentAlerts: {
        noPublishedPartners: !(db.fixtures.partners ?? []).length,
        legacyPostsCount: 0,
        pagesNeedingReviewCount: 0,
      },
      badges,
      recentAuditLog: can('audit')
        ? db.audit.slice(0, 10).map((row) => ({
            id: row.id,
            action: row.action,
            entityType: row.entityType,
            entityId: row.entityId,
            entityLabel: row.entityLabel,
            actorId: row.actorId,
            actorName: staffName(row.actorId),
            createdAt: row.createdAt,
          }))
        : [],
    };
  }

  function messageListItem(m) {
    const trimmed = m.body.trim().replace(/\s+/g, ' ');
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      subject: m.subject,
      status: m.status,
      excerpt: trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed,
      createdAt: m.createdAt,
    };
  }

  function messageRow(m) {
    const { replies: _replies, ...row } = m;
    return row;
  }

  return [
    ...systemRoutes({ db, json, problem, nowIso, token, guard, audit, clone }),
    ...contentRoutes({ db, json, problem, nowIso, guard, fixtures: db.fixtures }),
    [
      'GET',
      /^\/api\/v1\/admin\/overview$/,
      ({ req }) => {
        const g = guard(req);
        return g.error ?? json(200, overview(g.staff));
      },
    ],

    // ---------- messages ----------
    [
      'GET',
      /^\/api\/v1\/admin\/messages$/,
      ({ req, query }) => {
        const g = guard(req, 'inbox');
        if (g.error) return g.error;
        const status = query.get('status');
        const rows = db.messages
          .filter((m) => !['unread', 'read', 'archived'].includes(status) || m.status === status)
          .sort((x, y) => y.createdAt.localeCompare(x.createdAt) || Number(y.id) - Number(x.id))
          .map(messageListItem);
        return json(200, {
          ...pageOf(rows, query),
          unreadCount: db.messages.filter((m) => m.status === 'unread').length,
        });
      },
    ],
    [
      'GET',
      /^\/api\/v1\/admin\/messages\/([^/]+)$/,
      ({ req, params }) => {
        const g = guard(req, 'inbox');
        if (g.error) return g.error;
        const m = db.messages.find((x) => x.id === params[0]);
        if (!m) return problem(404, 'NOT_FOUND');
        if (m.status === 'unread') m.status = 'read';
        return json(200, { ...messageRow(m), replies: clone(m.replies ?? []) });
      },
    ],
    [
      'POST',
      /^\/api\/v1\/admin\/messages\/([^/]+)\/reply$/,
      ({ req, params, body }) => {
        const g = guard(req, 'inbox', { write: true });
        if (g.error) return g.error;
        const m = db.messages.find((x) => x.id === params[0]);
        if (!m) return problem(404, 'NOT_FOUND');
        const text = typeof body?.body === 'string' ? body.body : '';
        if (!text || text.length > 5000)
          return problem(400, 'VALIDATION_FAILED', {
            issues: [{ path: ['body'], message: 'Invalid', code: 'custom' }],
          });
        const reply = {
          id: token(),
          messageId: m.id,
          authorId: g.staff.id,
          body: text,
          mailLogId: null,
          createdAt: nowIso(),
        };
        (m.replies ??= []).push({
          id: reply.id,
          body: text,
          authorId: g.staff.id,
          authorName: g.staff.name,
          createdAt: reply.createdAt,
        });
        if (m.status === 'unread') m.status = 'read';
        return json(201, { message: messageRow(m), reply });
      },
    ],
    [
      'PATCH',
      /^\/api\/v1\/admin\/messages\/([^/]+)$/,
      ({ req, params, body }) => {
        const g = guard(req, 'inbox', { write: true });
        if (g.error) return g.error;
        const m = db.messages.find((x) => x.id === params[0]);
        if (!m) return problem(404, 'NOT_FOUND');
        if (!['unread', 'read', 'archived'].includes(body?.status))
          return problem(400, 'VALIDATION_FAILED', {
            issues: [{ path: ['status'], message: 'Invalid', code: 'custom' }],
          });
        m.status = body.status;
        m.updatedAt = nowIso();
        return json(200, messageRow(m));
      },
    ],
    [
      'POST',
      /^\/api\/v1\/admin\/messages\/([^/]+)\/convert-to-testimonial$/,
      ({ req, params, body }) => {
        const g = guard(req, 'inbox', { write: true });
        if (g.error) return g.error;
        const m = db.messages.find((x) => x.id === params[0]);
        if (!m) return problem(404, 'NOT_FOUND');
        if (typeof body?.quoteAr !== 'string' || !body.quoteAr)
          return problem(400, 'VALIDATION_FAILED', {
            issues: [{ path: ['quoteAr'], message: 'Required', code: 'invalid_type' }],
          });
        const testimonial = {
          id: String(++db.seq),
          quoteAr: body.quoteAr,
          quoteEn: body.quoteEn ?? null,
          authorName: body.authorName ?? m.name,
          authorDescAr: body.authorDesc ?? null,
          authorDescEn: null,
          status: 'pending',
          source: 'contact_form',
          sourceMessageId: m.id,
        };
        (db.pendingTestimonials ??= []).push(testimonial);
        return json(201, testimonial);
      },
    ],
    [
      'DELETE',
      /^\/api\/v1\/admin\/messages\/([^/]+)$/,
      ({ req, params }) => {
        const g = guard(req, 'inbox.delete', { write: true });
        if (g.error) return g.error;
        const i = db.messages.findIndex((x) => x.id === params[0]);
        if (i < 0) return problem(404, 'NOT_FOUND');
        const [m] = db.messages.splice(i, 1);
        audit(g.staff, 'delete', 'contact_messages', m.id, m.email);
        return json(200, { deleted: true });
      },
    ],

    // ---------- newsletter ----------
    [
      'GET',
      /^\/api\/v1\/admin\/newsletter$/,
      ({ req, query }) => {
        const g = guard(req, 'inbox');
        if (g.error) return g.error;
        const status = query.get('status');
        const rows = [...db.newsletter.values()]
          .filter((n) =>
            status === 'subscribed'
              ? !n.unsubscribedAt && n.confirmedAt
              : status === 'pending'
                ? !n.unsubscribedAt && !n.confirmedAt
                : status === 'unsubscribed'
                  ? !!n.unsubscribedAt
                  : true,
          )
          .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
        return json(200, pageOf(rows, query));
      },
    ],
  ];
}

/** The contact form's row (ContactMessage) as the mock stores it. */
export function contactMessage(db, body, lang, nowIso) {
  const at = nowIso();
  return {
    id: String(++db.seq),
    name: body.name,
    phone: body.phone ?? null,
    email: body.email,
    subject: body.subject,
    body: body.body,
    status: 'unread',
    locale: lang,
    ipHash: null,
    userAgent: null,
    createdAt: at,
    updatedAt: at,
    replies: [],
  };
}
