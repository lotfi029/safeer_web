/**
 * Admin routes of the mock API (Stage 2). Shapes follow safeer_api v1.0.0-rc1 (docs/api/src: the
 * admin-applications service/controllers, messages.service.ts, admin-newsletter.controller.ts) and
 * are checked against responses recorded from the real API (mocks/admin-shapes.test.mjs). Role
 * checks use the same matrix as `GET /admin/roles`; writes need the staff CSRF token.
 *
 * Every route here is live in the real API; the e2e suite runs against both.
 */

export const STATUS_TRANSITIONS = {
  draft: [],
  new: ['under_review'],
  under_review: ['docs_missing', 'interview', 'accepted', 'rejected'],
  docs_missing: ['under_review'],
  interview: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
};
const REQUEST_DOCUMENTS_ALLOWED_FROM = ['new', 'under_review', 'interview'];
const UNREVIEWABLE = ['draft', 'accepted', 'rejected'];
const STATUSES = [
  'draft',
  'new',
  'under_review',
  'docs_missing',
  'interview',
  'accepted',
  'rejected',
];
const DOC_TYPES = ['id_copy', 'certificate', 'admission_letter', 'other'];
const CSV_ROW_CAP = 5000;

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

  function audit(staff, action, entityType, entityId, entityLabel) {
    db.audit.unshift({
      id: String(db.audit.length + 1),
      action,
      entityType,
      entityId,
      entityLabel,
      actorId: staff?.id ?? null,
      actorName: staff?.name ?? null,
      createdAt: nowIso(),
    });
  }

  const staffName = (id) => (db.fixtures.staff ?? []).find((u) => u.id === id)?.name ?? null;
  const currentDocs = (app) => (app.documents ?? []).filter((d) => !d.supersededBy);
  const fullName = (a) => [a.firstName, a.middleName, a.lastName].filter(Boolean).join(' ');

  function addEvent(app, type, staff, data, visibleToApplicant = true) {
    (app.events ??= []).push({
      id: token(),
      type,
      actorId: staff?.id ?? null,
      createdAt: nowIso(),
      visibleToApplicant,
      data: data ?? null,
    });
  }

  /** The portal's "action needed" (portal-application.service.ts): a rejected doc wins over a request. */
  function syncActionNeeded(app) {
    const rejected = currentDocs(app).find((d) => d.status === 'rejected');
    if (rejected) {
      app.actionNeeded = {
        type: 'document_rejected',
        docType: rejected.docType,
        reason: rejected.rejectionReason ?? null,
      };
      return;
    }
    const lastRequest = [...(app.events ?? [])].reverse().find((e) => e.type === 'DOCS_REQUESTED');
    app.actionNeeded =
      app.status === 'docs_missing' && lastRequest
        ? { type: 'documents_requested', docTypes: lastRequest.data?.docTypes ?? [] }
        : null;
  }

  function adminDocument(app, d) {
    return {
      id: d.id,
      docType: d.docType,
      originalName: d.originalName,
      mime: d.mime,
      sizeBytes: d.sizeBytes,
      status: d.status,
      rejectionReason: d.rejectionReason ?? null,
      createdAt: d.createdAt,
      reviewedBy: d.reviewedBy ?? null,
      reviewedAt: d.reviewedAt ?? null,
      supersededAt: d.supersededBy ? (d.supersededAt ?? d.createdAt) : null,
      downloadPath: d.supersededBy ? null : `admin/applications/${app.id}/documents/${d.id}/file`,
    };
  }

  function listItem(a) {
    return {
      id: a.id,
      reference: a.reference,
      status: a.status,
      currentStep: a.currentStep ?? 1,
      firstName: a.firstName ?? null,
      middleName: a.middleName ?? null,
      lastName: a.lastName ?? null,
      email: a.email ?? null,
      phone: a.phone ?? null,
      nationality: a.nationality ?? null,
      university: a.university ?? null,
      degreeLevel: a.degreeLevel ?? null,
      submittedAt: a.submittedAt ?? null,
      createdAt: a.createdAt ?? a.submittedAt ?? '2026-09-01T09:00:00.000Z',
      assignedReviewer: a.assignedReviewerId
        ? { id: a.assignedReviewerId, name: staffName(a.assignedReviewerId) ?? '' }
        : null,
      hasUnreviewedResubmission: !!a.hasUnreviewedResubmission,
    };
  }

  function detail(a) {
    return {
      id: a.id,
      reference: a.reference,
      status: a.status,
      currentStep: a.currentStep ?? 1,
      personal: {
        firstName: a.firstName ?? null,
        middleName: a.middleName ?? null,
        lastName: a.lastName ?? null,
        birthDate: a.birthDate ?? null,
        phone: a.phone ?? null,
        nationality: a.nationality ?? null,
        idNumber: a.idNumber ?? null,
        email: a.email ?? null,
        currentJob: a.currentJob ?? null,
        gender: a.gender ?? null,
      },
      study: {
        university: a.university ?? null,
        major: a.major ?? null,
        degreeLevel: a.degreeLevel ?? null,
        scholarshipNote: a.scholarshipNote ?? null,
      },
      consentAt: a.consent ? (a.submittedAt ?? null) : null,
      submittedAt: a.submittedAt ?? null,
      decidedAt: a.decidedAt ?? null,
      locale: a.locale ?? 'ar',
      createdAt: a.createdAt ?? a.submittedAt ?? '2026-09-01T09:00:00.000Z',
      updatedAt: a.updatedAt ?? a.submittedAt ?? '2026-09-01T09:00:00.000Z',
      assignedReviewer: a.assignedReviewerId
        ? {
            id: a.assignedReviewerId,
            name: staffName(a.assignedReviewerId) ?? '',
            email:
              (db.fixtures.staff ?? []).find((u) => u.id === a.assignedReviewerId)?.email ?? '',
          }
        : null,
      documents: currentDocs(a).map((d) => adminDocument(a, d)),
      notes: [...(a.notes ?? [])].reverse(),
      events: [...(a.events ?? [])].reverse().map((e) => ({
        id: e.id,
        type: e.type,
        actorId: e.actorId ?? null,
        actorName: e.actorId ? staffName(e.actorId) : null,
        visibleToApplicant: e.visibleToApplicant ?? true,
        data: e.data ?? null,
        createdAt: e.createdAt,
      })),
    };
  }

  function filtered(query) {
    const status = query.get('status');
    const q = (query.get('q') ?? '').trim().toLowerCase();
    const reviewerId = query.get('reviewerId');
    return [...db.applications.values()]
      .filter((a) => !status || a.status === status)
      .filter((a) => !reviewerId || a.assignedReviewerId === reviewerId)
      .filter(
        (a) =>
          !q ||
          a.reference.toLowerCase().startsWith(q) ||
          fullName(a).toLowerCase().includes(q) ||
          (a.email ?? '').toLowerCase().includes(q),
      )
      .sort(
        (x, y) =>
          String(y.createdAt ?? y.submittedAt ?? '').localeCompare(
            String(x.createdAt ?? x.submittedAt ?? ''),
          ) || Number(y.id) - Number(x.id),
      );
  }

  function pageOf(rows, query) {
    const limit = Math.min(100, Math.max(1, Number(query.get('limit')) || 20));
    const page = Math.max(1, Number(query.get('page')) || 1);
    return { data: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit };
  }

  function assignees() {
    return (db.fixtures.staff ?? [])
      .filter(
        (u) =>
          ['admin', 'reviewer'].includes(u.role) &&
          (u.status ?? 'active') === 'active' &&
          !(u.lockedUntil && Date.parse(u.lockedUntil) > Date.now()),
      )
      .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
  }

  function changeStatus(app, to, staff) {
    if (!(STATUS_TRANSITIONS[app.status] ?? []).includes(to))
      return problem(409, 'INVALID_STATUS_TRANSITION', { from: app.status, to });
    const from = app.status;
    app.status = to;
    if (to === 'accepted' || to === 'rejected') app.decidedAt = nowIso();
    app.updatedAt = nowIso();
    addEvent(app, 'STATUS_CHANGED', staff, { from, to });
    syncActionNeeded(app);
    audit(staff, 'update', 'applications', app.id, app.reference);
    return null;
  }

  function requestDocuments(app, docTypes, message, staff) {
    if (!REQUEST_DOCUMENTS_ALLOWED_FROM.includes(app.status))
      return problem(409, 'INVALID_STATUS_TRANSITION', { from: app.status, to: 'docs_missing' });
    app.status = 'docs_missing';
    app.updatedAt = nowIso();
    addEvent(app, 'DOCS_REQUESTED', staff, { docTypes, message: message ?? null });
    syncActionNeeded(app);
    return null;
  }

  function assign(app, reviewerId, staff) {
    if (reviewerId !== null && !assignees().some((a) => a.id === reviewerId))
      return problem(400, 'INVALID_ASSIGNEE');
    app.assignedReviewerId = reviewerId;
    addEvent(app, 'REVIEWER_ASSIGNED', staff, { reviewerId }, false);
    return null;
  }

  function csvEscape(value) {
    const s = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function monthKey(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  function overview(staff) {
    const can = (area) => (db.fixtures.roles.matrix[area] ?? []).includes(staff.role);
    const apps = [...db.applications.values()];
    const statCards = {};
    const badges = {};
    const out = { statCards, badges };
    if (can('applications')) {
      const now = new Date();
      const thisMonth = monthKey(now);
      statCards.newApplications = apps.filter((a) => a.status === 'new').length;
      statCards.underReview = apps.filter((a) => a.status === 'under_review').length;
      statCards.acceptedThisMonth = apps.filter(
        (a) =>
          a.status === 'accepted' && a.decidedAt && monthKey(new Date(a.decidedAt)) === thisMonth,
      ).length;
      badges.newApplications = statCards.newApplications;
      out.series = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1));
        const key = monthKey(d);
        return {
          month: key,
          received: apps.filter((a) => a.submittedAt && monthKey(new Date(a.submittedAt)) === key)
            .length,
          accepted: apps.filter(
            (a) =>
              a.status === 'accepted' && a.decidedAt && monthKey(new Date(a.decidedAt)) === key,
          ).length,
        };
      });
      out.latestApplications = apps
        .filter((a) => a.status !== 'draft')
        .sort((x, y) => String(y.submittedAt ?? '').localeCompare(String(x.submittedAt ?? '')))
        .slice(0, 4)
        .map((a) => ({
          id: a.id,
          reference: a.reference,
          name: fullName(a),
          status: a.status,
          submittedAt: a.submittedAt ?? null,
        }));
    }
    if (can('inbox')) {
      statCards.unreadMessages = db.messages.filter((m) => m.status === 'unread').length;
      badges.unreadMessages = statCards.unreadMessages;
    }
    out.contentAlerts = {
      noPublishedPartners: !(db.fixtures.partners ?? []).length,
      legacyPostsCount: 0,
      pagesNeedingReviewCount: 0,
    };
    out.recentAuditLog = can('audit') ? db.audit.slice(0, 10) : [];
    // Key order as the API builds it.
    return {
      statCards: out.statCards,
      ...(out.series ? { series: out.series } : {}),
      ...(out.latestApplications ? { latestApplications: out.latestApplications } : {}),
      contentAlerts: out.contentAlerts,
      badges: out.badges,
      recentAuditLog: out.recentAuditLog,
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

  const findApp = (id) => db.applications.get(id);

  return [
    [
      'GET',
      /^\/api\/v1\/admin\/overview$/,
      ({ req }) => {
        const g = guard(req);
        return g.error ?? json(200, overview(g.staff));
      },
    ],

    // ---------- applications ----------
    [
      'GET',
      /^\/api\/v1\/admin\/applications$/,
      ({ req, query }) => {
        const g = guard(req, 'applications');
        return g.error ?? json(200, { ...pageOf(filtered(query).map(listItem), query) });
      },
    ],
    [
      'GET',
      /^\/api\/v1\/admin\/applications\/counts$/,
      ({ req }) => {
        const g = guard(req, 'applications');
        if (g.error) return g.error;
        const apps = [...db.applications.values()];
        const counts = Object.fromEntries(
          STATUSES.map((s) => [s, apps.filter((a) => a.status === s).length]),
        );
        return json(200, { ...counts, all: apps.length });
      },
    ],
    [
      'GET',
      /^\/api\/v1\/admin\/applications\/assignees$/,
      ({ req }) => {
        const g = guard(req, 'applications');
        return g.error ?? json(200, assignees());
      },
    ],
    [
      'GET',
      /^\/api\/v1\/admin\/applications\/export\.csv$/,
      ({ req, query }) => {
        const g = guard(req, 'applications');
        if (g.error) return g.error;
        const rows = filtered(query);
        const cols = [
          'Reference',
          'Status',
          'Name',
          'Email',
          'Phone',
          'Nationality',
          'ID number',
          'University',
          'Degree',
          'Submitted at',
        ];
        const lines = rows
          .slice(0, CSV_ROW_CAP)
          .map((a) =>
            [
              a.reference,
              a.status,
              fullName(a),
              a.email,
              a.phone,
              a.nationality,
              a.idNumber ? `••••${String(a.idNumber).slice(-4)}` : '',
              a.university,
              a.degreeLevel,
              a.submittedAt ?? '',
            ]
              .map(csvEscape)
              .join(','),
          );
        return {
          status: 200,
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': 'attachment; filename="applications.csv"',
            'x-truncated': String(rows.length > CSV_ROW_CAP),
          },
          body: `﻿${[cols.join(','), ...lines].join('\r\n')}\r\n`,
        };
      },
    ],
    [
      'POST',
      /^\/api\/v1\/admin\/applications\/bulk$/,
      ({ req, body }) => {
        const g = guard(req, 'applications', { write: true });
        if (g.error) return g.error;
        const ids = Array.isArray(body?.ids) ? body.ids : [];
        const action = body?.action;
        if (!ids.length || !['assign', 'status', 'request_documents'].includes(action))
          return problem(400, 'VALIDATION_FAILED', {
            issues: [{ path: ['ids'], message: 'Invalid', code: 'custom' }],
          });
        const results = ids.map((id) => {
          const app = findApp(String(id));
          if (!app) return { id, ok: false, error: 'Not found' };
          let err = null;
          if (action === 'assign') err = assign(app, body.reviewerId ?? null, g.staff);
          if (action === 'status') err = changeStatus(app, body.status, g.staff);
          if (action === 'request_documents')
            err = requestDocuments(app, body.docTypes ?? [], body.message, g.staff);
          return err ? { id, ok: false, error: err.body.title } : { id, ok: true };
        });
        return json(201, results);
      },
    ],
    [
      'GET',
      /^\/api\/v1\/admin\/applications\/([^/]+)$/,
      ({ req, params }) => {
        const g = guard(req, 'applications');
        if (g.error) return g.error;
        const app = findApp(params[0]);
        return app ? json(200, detail(app)) : problem(404, 'NOT_FOUND');
      },
    ],
    [
      'PATCH',
      /^\/api\/v1\/admin\/applications\/([^/]+)$/,
      ({ req, params, body }) => {
        const g = guard(req, 'applications', { write: true });
        if (g.error) return g.error;
        const app = findApp(params[0]);
        if (!app) return problem(404, 'NOT_FOUND');
        if (body?.status === undefined && body?.assignedReviewerId === undefined)
          return problem(400, 'VALIDATION_FAILED', {
            issues: [{ path: [], message: 'Nothing to update', code: 'custom' }],
          });
        if (body.assignedReviewerId !== undefined) {
          const err = assign(app, body.assignedReviewerId, g.staff);
          if (err) return err;
        }
        if (body.status !== undefined && body.status !== app.status) {
          const err = changeStatus(app, body.status, g.staff);
          if (err) return err;
        }
        return json(200, detail(app));
      },
    ],
    [
      'POST',
      /^\/api\/v1\/admin\/applications\/([^/]+)\/request-documents$/,
      ({ req, params, body }) => {
        const g = guard(req, 'applications', { write: true });
        if (g.error) return g.error;
        const app = findApp(params[0]);
        if (!app) return problem(404, 'NOT_FOUND');
        const types = Array.isArray(body?.docTypes) ? body.docTypes : [];
        if (!types.length || types.some((t) => !DOC_TYPES.includes(t)))
          return problem(400, 'VALIDATION_FAILED', {
            issues: [{ path: ['docTypes'], message: 'Invalid', code: 'custom' }],
          });
        const err = requestDocuments(app, types, body.message, g.staff);
        return err ?? json(201, detail(app));
      },
    ],
    [
      'PATCH',
      /^\/api\/v1\/admin\/applications\/([^/]+)\/documents\/([^/]+)$/,
      ({ req, params, body }) => {
        const g = guard(req, 'applications', { write: true });
        if (g.error) return g.error;
        const app = findApp(params[0]);
        const doc = app && (app.documents ?? []).find((d) => d.id === params[1]);
        if (!app || !doc) return problem(404, 'NOT_FOUND');
        if (!['accepted', 'rejected'].includes(body?.status))
          return problem(400, 'VALIDATION_FAILED', {
            issues: [{ path: ['status'], message: 'Invalid', code: 'custom' }],
          });
        const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
        if (body.status === 'rejected' && (!reason || reason.length > 500))
          return problem(400, 'VALIDATION_FAILED', {
            issues: [{ path: ['reason'], message: 'A reason is required', code: 'custom' }],
          });
        if (doc.supersededBy || UNREVIEWABLE.includes(app.status))
          return problem(409, 'DOCUMENT_NOT_REVIEWABLE');
        doc.status = body.status;
        doc.rejectionReason = body.status === 'rejected' ? reason : null;
        doc.reviewedBy = g.staff.id;
        doc.reviewedAt = nowIso();
        addEvent(
          app,
          body.status === 'rejected' ? 'DOCUMENT_REJECTED' : 'DOCUMENT_ACCEPTED',
          g.staff,
          { docType: doc.docType, reason: doc.rejectionReason },
          body.status === 'rejected',
        );
        syncActionNeeded(app);
        return json(200, adminDocument(app, doc));
      },
    ],
    [
      'GET',
      /^\/api\/v1\/admin\/applications\/([^/]+)\/documents\/([^/]+)\/file$/,
      ({ req, params }) => {
        const g = guard(req, 'applications');
        if (g.error) return g.error;
        const app = findApp(params[0]);
        const doc = app && (app.documents ?? []).find((d) => d.id === params[1]);
        if (!doc) return problem(404, 'NOT_FOUND');
        if (doc.supersededBy) return problem(410, 'DOCUMENT_SUPERSEDED');
        return {
          status: 200,
          headers: {
            'content-type': 'text/plain',
            'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`,
          },
          body: '[mock file]',
        };
      },
    ],
    [
      'POST',
      /^\/api\/v1\/admin\/applications\/([^/]+)\/notes$/,
      ({ req, params, body }) => {
        const g = guard(req, 'applications', { write: true });
        if (g.error) return g.error;
        const app = findApp(params[0]);
        if (!app) return problem(404, 'NOT_FOUND');
        const text = typeof body?.body === 'string' ? body.body : '';
        if (!text.trim() || text.length > 5000)
          return problem(400, 'VALIDATION_FAILED', {
            issues: [{ path: ['body'], message: 'Invalid', code: 'custom' }],
          });
        const note = {
          id: token(),
          body: text,
          authorId: g.staff.id,
          authorName: g.staff.name,
          createdAt: nowIso(),
        };
        (app.notes ??= []).push(note);
        return json(201, note);
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
