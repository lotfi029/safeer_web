/**
 * Admin system routes of the mock API (Stage 2, Phase 9): users and invitations, site settings and
 * cache, mail/SMS settings, templates, test sends and logs, audit, newsletter export/delete, interview
 * slots, account (password, sessions) and application anonymise. Rules follow safeer_api v1.0.0-rc1
 * (users.service.ts, site-settings.dto.ts, mail/sms services, admin-interview-slots.controller.ts,
 * auth.service.ts); seed values are recorded from the API (fixtures/adminSystem.json) and shapes are
 * drift-tested (mocks/admin-shapes.test.mjs).
 */
import { publicStaff } from './backend.mjs';

const ROLES = ['admin', 'reviewer', 'editor', 'support'];
const MAP_EMBED_ALLOW_LIST = [
  { host: 'www.google.com', pathPrefix: '/maps/embed' },
  { host: 'www.openstreetmap.org', pathPrefix: '/' },
];
const SITE_PATH_RE = /^\/(?!\/)[^\s\\]*$/;
const SAFE_URL_RE = /^(https?:\/\/[^/\s]+|mailto:|tel:)[^\s\\]*$/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SOCIALS = [
  'facebookUrl',
  'instagramUrl',
  'xUrl',
  'youtubeUrl',
  'linkedinUrl',
  'whatsappUrl',
  'tiktokUrl',
];

function mapEmbedAllowed(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return false;
    return MAP_EMBED_ALLOW_LIST.some(
      (a) => url.hostname === a.host && url.pathname.startsWith(a.pathPrefix),
    );
  } catch {
    return false;
  }
}

function sidOf(req) {
  return /(?:^|;\s*)sf_sid=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
}

/** @param {object} ctx `{ db, json, problem, nowIso, token, guard, audit, clone }` from mocks/admin.mjs */
export function systemRoutes(ctx) {
  const { db, json, problem, nowIso, token, guard, audit, clone } = ctx;
  const seed = clone(db.fixtures.adminSystem ?? {});
  db.system ??= {
    settings: seed.settings ?? {},
    mail: { settings: seed.mailSettings ?? {}, templates: seed.mailTemplates ?? [], log: [] },
    sms: { settings: seed.smsSettings ?? {}, templates: seed.smsTemplates ?? [], log: [] },
    cache: { entries: 12, maxEntries: 500, hits: 40, misses: 10, uptimeSeconds: 3600 },
  };
  const staff = () => db.fixtures.staff;
  const invalid = (path, message, code = 'custom') =>
    problem(400, 'VALIDATION_FAILED', { issues: [{ path: [path], message, code }] });
  const activeAdmins = (exceptId) =>
    staff().filter(
      (u) => u.role === 'admin' && (u.status ?? 'active') === 'active' && u.id !== exceptId,
    ).length;
  const revokeSessions = (userId) => {
    for (const [sid, s] of db.staffSessions) if (s.user.id === userId) db.staffSessions.delete(sid);
  };
  const paged = (rows, query, def = 20, max = 100) => {
    const limit = Math.min(max, Math.max(1, Number(query.get('limit')) || def));
    const page = Math.max(1, Number(query.get('page')) || 1);
    return { data: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit };
  };

  const routes = [
    // ---------- users ----------
    [
      'GET',
      /^\/api\/v1\/admin\/users$/,
      ({ req }) => {
        const g = guard(req, 'users');
        return g.error ?? json(200, staff().map(publicStaff));
      },
    ],
    [
      'POST',
      /^\/api\/v1\/admin\/auth\/invite$/,
      ({ req, body }) => {
        const g = guard(req, 'users', { write: true });
        if (g.error) return g.error;
        if (!body?.email || !EMAIL_RE.test(body.email)) return invalid('email', 'Invalid email');
        if (!body?.name || String(body.name).length > 120) return invalid('name', 'Required');
        if (!ROLES.includes(body?.role)) return invalid('role', 'Invalid enum value');
        if (staff().some((u) => u.email.toLowerCase() === String(body.email).toLowerCase())) {
          return problem(409, 'VALIDATION_FAILED', {
            title: 'A user with that email already exists',
          });
        }
        const user = {
          id: String(++db.seq),
          name: body.name,
          email: body.email,
          role: body.role,
          status: 'invited',
          lockedUntil: null,
          lastLoginAt: null,
          password: `unusable-${token()}`,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        staff().push(user);
        db.authTokens.set(`accept:${token()}`, user.id);
        audit(g.staff, 'create', 'users', user.id, user.email);
        return json(201, publicStaff(user));
      },
    ],
    [
      'GET',
      /^\/api\/v1\/admin\/users\/([^/]+)$/,
      ({ req, params }) => {
        const g = guard(req, 'users');
        if (g.error) return g.error;
        const u = staff().find((x) => x.id === params[0]);
        return u ? json(200, publicStaff(u)) : problem(404, 'NOT_FOUND');
      },
    ],
    [
      'PATCH',
      /^\/api\/v1\/admin\/users\/([^/]+)$/,
      ({ req, params, body }) => {
        const g = guard(req, 'users', { write: true });
        if (g.error) return g.error;
        const u = staff().find((x) => x.id === params[0]);
        if (!u) return problem(404, 'NOT_FOUND');
        const b = body ?? {};
        if (b.role !== undefined && !ROLES.includes(b.role))
          return invalid('role', 'Invalid enum value');
        if (b.status !== undefined && !['active', 'disabled'].includes(b.status))
          return invalid('status', 'Invalid enum value');
        if (b.email !== undefined && !EMAIL_RE.test(b.email))
          return invalid('email', 'Invalid email');
        if (b.role !== undefined && b.role !== u.role && u.id === g.staff.id) {
          return problem(403, 'FORBIDDEN', { title: 'You cannot change your own role' });
        }
        const isActiveAdmin = u.role === 'admin' && (u.status ?? 'active') === 'active';
        if (isActiveAdmin && b.role && b.role !== 'admin' && !activeAdmins(u.id))
          return problem(409, 'LAST_ADMIN');
        if (isActiveAdmin && b.status === 'disabled' && !activeAdmins(u.id))
          return problem(409, 'LAST_ADMIN');
        if (u.status === 'invited' && b.status === 'active') {
          return problem(409, 'VALIDATION_FAILED', {
            title: 'An invited user becomes active by accepting the invitation',
          });
        }
        if (
          b.email &&
          staff().some((x) => x.id !== u.id && x.email.toLowerCase() === b.email.toLowerCase())
        ) {
          return problem(409, 'CONFLICT');
        }
        const before = publicStaff(u);
        for (const k of ['name', 'email', 'role', 'status']) if (b[k] !== undefined) u[k] = b[k];
        if (b.unlock === true) Object.assign(u, { lockedUntil: null, failedLogins: 0 });
        if (b.status === 'disabled') revokeSessions(u.id);
        u.updatedAt = nowIso();
        audit(g.staff, 'update', 'users', u.id, u.email, { before, after: publicStaff(u) });
        return json(200, publicStaff(u));
      },
    ],
    [
      'DELETE',
      /^\/api\/v1\/admin\/users\/([^/]+)$/,
      ({ req, params }) => {
        const g = guard(req, 'users', { write: true });
        if (g.error) return g.error;
        const i = staff().findIndex((x) => x.id === params[0]);
        if (i < 0) return problem(404, 'NOT_FOUND');
        const u = staff()[i];
        if (u.id === g.staff.id)
          return problem(403, 'FORBIDDEN', { title: 'You cannot delete your own account' });
        if (u.role === 'admin' && (u.status ?? 'active') === 'active' && !activeAdmins(u.id))
          return problem(409, 'LAST_ADMIN');
        staff().splice(i, 1);
        revokeSessions(u.id);
        audit(g.staff, 'delete', 'users', u.id, u.email, { before: publicStaff(u), after: null });
        return json(200, { deleted: true });
      },
    ],

    // ---------- settings + cache ----------
    [
      'GET',
      /^\/api\/v1\/admin\/settings$/,
      ({ req }) => {
        const g = guard(req, 'settings');
        return g.error ?? json(200, db.system.settings);
      },
    ],
    [
      'PUT',
      /^\/api\/v1\/admin\/settings$/,
      ({ req, body }) => {
        const g = guard(req, 'settings', { write: true });
        if (g.error) return g.error;
        const b = body ?? {};
        for (const k of Object.keys(b)) {
          if (!(k in db.system.settings) || ['id', 'updatedBy', 'updatedAt'].includes(k)) {
            return invalid(k, 'Unrecognized key', 'unrecognized_keys');
          }
        }
        if ('orgNameAr' in b && !b.orgNameAr) return invalid('orgNameAr', 'Required');
        for (const k of SOCIALS) {
          if (b[k] && !SAFE_URL_RE.test(b[k]))
            return invalid(k, 'must be an http(s), mailto: or tel: URL');
        }
        if (b.mapEmbedUrl && !mapEmbedAllowed(b.mapEmbedUrl)) {
          return invalid(
            'mapEmbedUrl',
            'must be an https Google Maps embed (www.google.com/maps/embed…) or OpenStreetMap (www.openstreetmap.org) URL',
          );
        }
        if (b.mapLat !== undefined && b.mapLat !== null && !(b.mapLat >= -90 && b.mapLat <= 90))
          return invalid('mapLat', 'Out of range');
        if (b.mapLng !== undefined && b.mapLng !== null && !(b.mapLng >= -180 && b.mapLng <= 180))
          return invalid('mapLng', 'Out of range');
        if ('applicationRefPrefix' in b && !/^[A-Z]{1,10}$/.test(String(b.applicationRefPrefix))) {
          return invalid('applicationRefPrefix', 'must be uppercase letters only');
        }
        if (b.email && !EMAIL_RE.test(b.email)) return invalid('email', 'Invalid email');
        const before = clone(db.system.settings);
        Object.assign(db.system.settings, b, { updatedBy: g.staff.id, updatedAt: nowIso() });
        audit(g.staff, 'update', 'site_settings', '1', 'site_settings', {
          before,
          after: clone(db.system.settings),
        });
        return json(200, db.system.settings);
      },
    ],
    [
      'GET',
      /^\/api\/v1\/admin\/cache\/stats$/,
      ({ req }) => {
        const g = guard(req, 'settings');
        if (g.error) return g.error;
        const c = db.system.cache;
        return json(200, { ...c, hitRate: c.hits / Math.max(1, c.hits + c.misses) });
      },
    ],
    [
      'DELETE',
      /^\/api\/v1\/admin\/cache$/,
      ({ req }) => {
        const g = guard(req, 'settings', { write: true });
        if (g.error) return g.error;
        const purged = db.system.cache.entries;
        db.system.cache.entries = 0;
        audit(g.staff, 'delete', 'cache', null, null);
        return json(200, { purged, tag: null });
      },
    ],

    // ---------- audit ----------
    [
      'GET',
      /^\/api\/v1\/admin\/audit$/,
      ({ req, query }) => {
        const g = guard(req, 'audit');
        if (g.error) return g.error;
        const entity = query.get('entity');
        const actor = query.get('actor');
        const rows = db.audit.filter(
          (r) => (!entity || r.entityType === entity) && (!actor || r.actorId === actor),
        );
        return json(200, paged(rows, query, 50, 200));
      },
    ],

    // ---------- newsletter (list is in admin.mjs) ----------
    [
      'GET',
      /^\/api\/v1\/admin\/newsletter\/export\.csv$/,
      ({ req, query }) => {
        const g = guard(req, 'inbox');
        if (g.error) return g.error;
        const status = query.get('status');
        const rows = [...db.newsletter.values()].filter((n) =>
          status === 'subscribed'
            ? !n.unsubscribedAt && n.confirmedAt
            : status === 'pending'
              ? !n.unsubscribedAt && !n.confirmedAt
              : status === 'unsubscribed'
                ? !!n.unsubscribedAt
                : true,
        );
        const lines = rows.map((n) =>
          [n.email, n.locale, n.createdAt, n.confirmedAt ?? '', n.unsubscribedAt ?? ''].join(','),
        );
        return {
          status: 200,
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': 'attachment; filename="newsletter-subscribers.csv"',
          },
          body: `﻿${['Email,Locale,Subscribed at,Confirmed at,Unsubscribed at', ...lines].join('\r\n')}\r\n`,
        };
      },
    ],
    [
      'DELETE',
      /^\/api\/v1\/admin\/newsletter\/([^/]+)$/,
      ({ req, params }) => {
        const g = guard(req, 'inbox', { write: true });
        if (g.error) return g.error;
        const hit = [...db.newsletter.entries()].find(([, n]) => n.id === params[0]);
        if (!hit) return problem(404, 'NOT_FOUND');
        db.newsletter.delete(hit[0]);
        audit(g.staff, 'delete', 'newsletter_subscribers', params[0], hit[1].email);
        return json(200, { deleted: true });
      },
    ],

    // ---------- account ----------
    [
      'PATCH',
      /^\/api\/v1\/admin\/auth\/password$/,
      ({ req, body }) => {
        const g = guard(req, null, { write: true });
        if (g.error) return g.error;
        const u = staff().find((x) => x.id === g.staff.id);
        if (typeof body?.newPassword !== 'string' || body.newPassword.length < 8)
          return invalid('newPassword', 'Too small', 'too_small');
        if (!u || (u.password ?? 'mock-password') !== body.currentPassword) {
          return problem(401, 'UNAUTHENTICATED', { title: 'Current password is incorrect' });
        }
        u.password = body.newPassword;
        const current = sidOf(req);
        for (const [sid, s] of db.staffSessions)
          if (s.user.id === u.id && sid !== current) db.staffSessions.delete(sid);
        return json(200, { ok: true });
      },
    ],
    [
      'GET',
      /^\/api\/v1\/admin\/auth\/sessions$/,
      ({ req }) => {
        const g = guard(req);
        if (g.error) return g.error;
        const current = sidOf(req);
        const rows = [...db.staffSessions.entries()]
          .filter(([, s]) => s.user.id === g.staff.id)
          .map(([sid, s]) => ({
            id: s.id,
            userAgent: s.userAgent ?? null,
            createdAt: s.createdAt,
            lastSeenAt: s.lastSeenAt,
            isCurrent: sid === current,
          }))
          .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
        return json(200, rows);
      },
    ],
    [
      'DELETE',
      /^\/api\/v1\/admin\/auth\/sessions$/,
      ({ req }) => {
        const g = guard(req, null, { write: true });
        if (g.error) return g.error;
        const current = sidOf(req);
        let ended = 0;
        for (const [sid, s] of db.staffSessions) {
          if (s.user.id === g.staff.id && sid !== current) {
            db.staffSessions.delete(sid);
            ended++;
          }
        }
        return json(200, { ended });
      },
    ],
    [
      'DELETE',
      /^\/api\/v1\/admin\/auth\/sessions\/([^/]+)$/,
      ({ req, params }) => {
        const g = guard(req, null, { write: true });
        if (g.error) return g.error;
        const hit = [...db.staffSessions.entries()].find(([, s]) => s.id === params[0]);
        if (!hit) return problem(404, 'NOT_FOUND', { title: 'Session not found' });
        if (hit[1].user.id !== g.staff.id && g.staff.role !== 'admin')
          return problem(403, 'FORBIDDEN');
        db.staffSessions.delete(hit[0]);
        return json(200, { ok: true });
      },
    ],

    // ---------- interview slots (shared with the portal's booking) ----------
    [
      'GET',
      /^\/api\/v1\/admin\/interview-slots$/,
      ({ req, query }) => {
        const g = guard(req, 'applications');
        if (g.error) return g.error;
        const rows = (db.fixtures.interviewSlots ?? [])
          .map(adminSlot)
          .filter(
            (s) => !query.get('applicationId') || s.applicationId === query.get('applicationId'),
          )
          .sort((a, b) => Number(b.id) - Number(a.id));
        return json(200, paged(rows, query));
      },
    ],
    [
      'POST',
      /^\/api\/v1\/admin\/interview-slots$/,
      ({ req, body }) => {
        const g = guard(req, 'applications', { write: true });
        if (g.error) return g.error;
        const bad = slotProblem(body, null);
        if (bad) return bad;
        const at = nowIso();
        const slot = {
          id: String(++db.seq),
          startsAt: new Date(body.startsAt).toISOString(),
          endsAt: new Date(body.endsAt).toISOString(),
          locationAr: body.locationAr ?? null,
          locationEn: body.locationEn ?? null,
          applicationId: null,
          createdAt: at,
          updatedAt: at,
        };
        (db.fixtures.interviewSlots ??= []).push(slot);
        return json(201, adminSlot(slot));
      },
    ],
    [
      'GET',
      /^\/api\/v1\/admin\/interview-slots\/([^/]+)$/,
      ({ req, params }) => {
        const g = guard(req, 'applications');
        if (g.error) return g.error;
        const slot = (db.fixtures.interviewSlots ?? []).find((s) => s.id === params[0]);
        return slot ? json(200, adminSlot(slot)) : problem(404, 'NOT_FOUND');
      },
    ],
    [
      'PATCH',
      /^\/api\/v1\/admin\/interview-slots\/([^/]+)$/,
      ({ req, params, body }) => {
        const g = guard(req, 'applications', { write: true });
        if (g.error) return g.error;
        const slot = (db.fixtures.interviewSlots ?? []).find((s) => s.id === params[0]);
        if (!slot) return problem(404, 'NOT_FOUND');
        const bad = slotProblem(body, slot);
        if (bad) return bad;
        for (const k of ['startsAt', 'endsAt'])
          if (body[k]) slot[k] = new Date(body[k]).toISOString();
        for (const k of ['locationAr', 'locationEn']) if (k in body) slot[k] = body[k];
        if (('locationAr' in body || 'locationEn' in body) && 'location' in slot)
          delete slot.location;
        slot.updatedAt = nowIso();
        audit(g.staff, 'update', 'interview_slots', slot.id, null);
        return json(200, adminSlot(slot));
      },
    ],
    [
      'DELETE',
      /^\/api\/v1\/admin\/interview-slots\/([^/]+)$/,
      ({ req, params }) => {
        const g = guard(req, 'applications', { write: true });
        if (g.error) return g.error;
        const list = db.fixtures.interviewSlots ?? [];
        const i = list.findIndex((s) => s.id === params[0]);
        if (i < 0) return problem(404, 'NOT_FOUND');
        if (list[i].applicationId) {
          return problem(409, 'RESOURCE_IN_USE', {
            title: `Interview slot #${params[0]} is already booked and cannot be deleted`,
          });
        }
        list.splice(i, 1);
        return json(200, { deleted: true });
      },
    ],

    // ---------- anonymise ----------
    [
      'DELETE',
      /^\/api\/v1\/admin\/applications\/([^/]+)$/,
      ({ req, params }) => {
        const g = guard(req, 'applications.delete', { write: true });
        if (g.error) return g.error;
        const app = db.applications.get(params[0]);
        if (!app) return problem(404, 'NOT_FOUND', { title: 'Application not found' });
        for (const k of [
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
          'university',
          'major',
          'scholarshipNote',
        ]) {
          app[k] = null;
        }
        const files = (app.documents ?? []).length;
        Object.assign(app, {
          documents: [],
          notes: [],
          events: [],
          anonymizedAt: app.anonymizedAt ?? nowIso(),
        });
        for (const slot of db.fixtures.interviewSlots ?? [])
          if (slot.applicationId === app.id) slot.applicationId = null;
        audit(g.staff, 'delete', 'applications', app.id, app.reference, {
          before: null,
          after: { anonymized: true, filesDeleted: files },
        });
        return json(200, { anonymized: true, reference: app.reference });
      },
    ],
  ];

  // ---------- mail / SMS ----------
  for (const channel of ['mail', 'sms']) {
    const store = db.system[channel];
    const secretKey = channel === 'mail' ? 'password' : 'token';
    const secretFlag = channel === 'mail' ? 'passwordIsSet' : 'tokenIsSet';
    const drivers = channel === 'mail' ? ['smtp', 'log'] : ['log', 'http', 'unifonic'];
    const base = `/api/v1/admin/${channel}`;
    const re = (tail) => new RegExp(`^${base.replace(/\//g, '\\/')}${tail}$`);
    routes.push(
      [
        'GET',
        re('\\/settings'),
        ({ req }) => {
          const g = guard(req, 'settings');
          return g.error ?? json(200, store.settings);
        },
      ],
      [
        'PUT',
        re('\\/settings'),
        ({ req, body }) => {
          const g = guard(req, 'settings', { write: true });
          if (g.error) return g.error;
          const b = { ...(body ?? {}) };
          if (b.driver !== undefined && !drivers.includes(b.driver))
            return invalid('driver', 'Invalid enum value');
          if (secretKey in b) {
            if (typeof b[secretKey] !== 'string' || !b[secretKey])
              return invalid(secretKey, 'Too small', 'too_small');
            store.settings[secretFlag] = true;
            delete b[secretKey];
          }
          for (const k of ['fromEmail', 'replyTo', 'notifyEmail'])
            if (b[k] && !EMAIL_RE.test(b[k])) return invalid(k, 'Invalid email');
          if (
            b.port !== undefined &&
            b.port !== null &&
            !(Number.isInteger(b.port) && b.port >= 1 && b.port <= 65535)
          )
            return invalid('port', 'Invalid');
          Object.assign(store.settings, b, { updatedBy: g.staff.id, updatedAt: nowIso() });
          audit(g.staff, 'update', `${channel}_settings`, '1', null);
          return json(200, store.settings);
        },
      ],
      [
        'POST',
        re('\\/test'),
        ({ req, body }) => {
          const g = guard(req, 'settings', { write: true });
          if (g.error) return g.error;
          const to = String(body?.to ?? '');
          if (channel === 'mail' ? !EMAIL_RE.test(to) : to.length < 3 || to.length > 40)
            return invalid('to', 'Invalid');
          const configured =
            channel === 'mail'
              ? store.settings.driver === 'smtp' && store.settings.host && store.settings.port
              : store.settings.driver !== 'log';
          const result = configured
            ? { ok: true }
            : {
                ok: false,
                error:
                  channel === 'mail'
                    ? 'SMTP is not configured — set driver to "smtp" with a host and port first'
                    : 'SMS is not configured — choose a provider first',
              };
          Object.assign(store.settings, {
            lastTestAt: nowIso(),
            lastTestOk: result.ok,
            lastTestError: result.error ?? null,
          });
          return json(200, result);
        },
      ],
      [
        'GET',
        re('\\/templates'),
        ({ req }) => {
          const g = guard(req, 'settings');
          return (
            g.error ??
            json(
              200,
              [...store.templates].sort((a, b) => a.key.localeCompare(b.key)),
            )
          );
        },
      ],
      [
        'GET',
        re('\\/templates\\/([^/]+)\\/variables'),
        ({ req, params }) => {
          const g = guard(req, 'settings');
          if (g.error) return g.error;
          const tpl = store.templates.find((t) => t.key === params[0]);
          return tpl
            ? json(200, { variables: tpl.variables })
            : problem(404, 'NOT_FOUND', { title: 'Template not found' });
        },
      ],
      [
        'POST',
        re('\\/templates\\/([^/]+)\\/preview'),
        ({ req, params, body }) => {
          const g = guard(req, 'settings', { write: true });
          if (g.error) return g.error;
          const tpl = store.templates.find((t) => t.key === params[0]);
          if (!tpl) return problem(404, 'NOT_FOUND', { title: 'Template not found' });
          const en = body?.locale === 'en';
          const fill = (text) =>
            String(text ?? '').replace(
              /\{\{\s*(\w+)\s*\}\}/g,
              (_, n) => body?.vars?.[n] ?? `[${n}]`,
            );
          const bodyText = fill(en && tpl.bodyEn ? tpl.bodyEn : tpl.bodyAr);
          return json(
            200,
            channel === 'mail'
              ? {
                  subject: fill(en && tpl.subjectEn ? tpl.subjectEn : tpl.subjectAr),
                  html: `<p>${bodyText}</p>`,
                  text: bodyText,
                }
              : { message: bodyText },
          );
        },
      ],
      [
        'GET',
        re('\\/templates\\/([^/]+)'),
        ({ req, params }) => {
          const g = guard(req, 'settings');
          if (g.error) return g.error;
          const tpl = store.templates.find((t) => t.key === params[0]);
          return tpl ? json(200, tpl) : problem(404, 'NOT_FOUND', { title: 'Template not found' });
        },
      ],
      [
        'PUT',
        re('\\/templates\\/([^/]+)'),
        ({ req, params, body }) => {
          const g = guard(req, 'settings', { write: true });
          if (g.error) return g.error;
          const tpl = store.templates.find((t) => t.key === params[0]);
          if (!tpl) return problem(404, 'NOT_FOUND', { title: 'Template not found' });
          const b = body ?? {};
          for (const k of ['key', 'variables', 'id'])
            if (k in b) return invalid(k, 'Unrecognized key', 'unrecognized_keys');
          if (channel === 'sms' && b.bodyAr && b.bodyAr.length > 480)
            return invalid('bodyAr', 'Too big', 'too_big');
          for (const k of ['subjectAr', 'subjectEn', 'bodyAr', 'bodyEn']) {
            for (const m of String(b[k] ?? '').matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
              if (!tpl.variables.includes(m[1]))
                return problem(400, 'UNKNOWN_VARIABLE', { variable: m[1] });
            }
          }
          Object.assign(tpl, b, { updatedBy: g.staff.id, updatedAt: nowIso() });
          audit(g.staff, 'update', `${channel}_templates`, tpl.id, tpl.key);
          return json(200, tpl);
        },
      ],
      [
        'GET',
        re('\\/log'),
        ({ req, query }) => {
          const g = guard(req, 'settings');
          if (g.error) return g.error;
          const status = query.get('status');
          const template = query.get('template');
          const rows = store.log.filter(
            (r) => (!status || r.status === status) && (!template || r.templateKey === template),
          );
          return json(200, paged(rows, query, 50, 200));
        },
      ],
    );
  }
  routes.push([
    'POST',
    /^\/api\/v1\/admin\/mail\/log\/([^/]+)\/retry$/,
    ({ req, params }) => {
      const g = guard(req, 'settings', { write: true });
      if (g.error) return g.error;
      const row = db.system.mail.log.find((r) => r.id === params[0]);
      if (!row) return problem(404, 'NOT_FOUND');
      if (row.status === 'sent') return json(200, row);
      if (!row.hasPayload)
        return problem(400, 'VALIDATION_FAILED', {
          title: 'This message can no longer be retried',
        });
      Object.assign(row, {
        status: 'sent',
        attempts: row.attempts + 1,
        sentAt: nowIso(),
        error: null,
      });
      return json(200, row);
    },
  ]);

  // ---------- redirects (the same table `GET /redirects/resolve` reads) ----------
  const redirects = () => {
    const list = (db.fixtures.redirects ??= []);
    for (const r of list) {
      r.id ??= String(++db.seq);
      r.hits ??= 0;
      r.statusCode ??= 301;
      r.createdAt ??= '2026-09-01T09:00:00.000Z';
    }
    return list;
  };
  const publicRedirect = ({ id, fromPath, toPath, statusCode, hits, createdAt }) => ({
    id,
    fromPath,
    toPath,
    statusCode,
    hits,
    createdAt,
  });
  /** redirect.dto.ts + the service's chain checks. */
  function redirectProblem(b, current) {
    for (const k of ['fromPath', 'toPath']) {
      if (!current && !b[k]) return invalid(k, 'Required', 'invalid_type');
      if (
        b[k] !== undefined &&
        (String(b[k]).length < 2 || String(b[k]).length > 255 || !SITE_PATH_RE.test(b[k]))
      ) {
        return invalid(k, 'must be a path on this site starting with a single "/"');
      }
    }
    if (b.statusCode !== undefined && ![301, 302].includes(b.statusCode))
      return invalid('statusCode', 'Invalid');
    const from = b.fromPath ?? current?.fromPath;
    const to = b.toPath ?? current?.toPath;
    if (from === to) {
      return current
        ? problem(400, 'VALIDATION_FAILED', { title: 'fromPath and toPath must differ' })
        : invalid('toPath', 'fromPath and toPath must differ');
    }
    const others = redirects().filter((r) => r.id !== current?.id);
    if (others.some((r) => r.fromPath === from)) {
      return problem(409, 'REDIRECT_CHAIN', { title: `A redirect from ${from} already exists` });
    }
    if (others.some((r) => r.fromPath === to || r.toPath === from)) {
      return problem(409, 'REDIRECT_CHAIN', {
        title: 'Redirects must not chain — point the redirect at the final page',
      });
    }
    return null;
  }
  routes.push(
    [
      'GET',
      /^\/api\/v1\/admin\/redirects$/,
      ({ req, query }) => {
        const g = guard(req, 'content');
        if (g.error) return g.error;
        const q = (query.get('q') ?? '').toLowerCase();
        const rows = redirects()
          .filter(
            (r) => !q || r.fromPath.toLowerCase().includes(q) || r.toPath.toLowerCase().includes(q),
          )
          .sort((a, b) => Number(b.id) - Number(a.id))
          .map(publicRedirect);
        return json(200, paged(rows, query));
      },
    ],
    [
      'POST',
      /^\/api\/v1\/admin\/redirects$/,
      ({ req, body }) => {
        const g = guard(req, 'content', { write: true });
        if (g.error) return g.error;
        const bad = redirectProblem(body ?? {}, null);
        if (bad) return bad;
        const row = {
          id: String(++db.seq),
          fromPath: body.fromPath,
          toPath: body.toPath,
          statusCode: body.statusCode ?? 301,
          hits: 0,
          createdAt: nowIso(),
        };
        redirects().push(row);
        return json(201, publicRedirect(row));
      },
    ],
    [
      'GET',
      /^\/api\/v1\/admin\/redirects\/([^/]+)$/,
      ({ req, params }) => {
        const g = guard(req, 'content');
        if (g.error) return g.error;
        const row = redirects().find((r) => r.id === params[0]);
        return row ? json(200, publicRedirect(row)) : problem(404, 'NOT_FOUND');
      },
    ],
    [
      'PATCH',
      /^\/api\/v1\/admin\/redirects\/([^/]+)$/,
      ({ req, params, body }) => {
        const g = guard(req, 'content', { write: true });
        if (g.error) return g.error;
        const row = redirects().find((r) => r.id === params[0]);
        if (!row) return problem(404, 'NOT_FOUND');
        const bad = redirectProblem(body ?? {}, row);
        if (bad) return bad;
        for (const k of ['fromPath', 'toPath', 'statusCode'])
          if (body[k] !== undefined) row[k] = body[k];
        return json(200, publicRedirect(row));
      },
    ],
    [
      'DELETE',
      /^\/api\/v1\/admin\/redirects\/([^/]+)$/,
      ({ req, params }) => {
        const g = guard(req, 'redirects.delete', { write: true });
        if (g.error) return g.error;
        const list = redirects();
        const i = list.findIndex((r) => r.id === params[0]);
        if (i < 0) return problem(404, 'NOT_FOUND');
        list.splice(i, 1);
        return json(200, { deleted: true });
      },
    ],
  );

  function adminSlot(s) {
    return {
      id: s.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      locationAr: s.locationAr ?? s.location ?? null,
      locationEn: s.locationEn ?? null,
      applicationId: s.applicationId ?? null,
      createdAt: s.createdAt ?? '2026-09-01T09:00:00.000Z',
      updatedAt: s.updatedAt ?? '2026-09-01T09:00:00.000Z',
    };
  }

  function slotProblem(body, current) {
    const b = body ?? {};
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
    for (const k of ['startsAt', 'endsAt']) {
      if (!current && !b[k]) return invalid(k, 'Required', 'invalid_type');
      if (b[k] && !iso.test(b[k])) return invalid(k, 'Invalid ISO datetime', 'invalid_format');
    }
    if ('applicationId' in b)
      return invalid('applicationId', 'Unrecognized key', 'unrecognized_keys');
    const start = Date.parse(b.startsAt ?? current?.startsAt);
    const end = Date.parse(b.endsAt ?? current?.endsAt);
    if (!(end > start)) {
      return current
        ? problem(400, 'VALIDATION_FAILED', { title: 'endsAt must be after startsAt' })
        : invalid('endsAt', 'endsAt must be after startsAt');
    }
    return null;
  }

  return routes;
}
